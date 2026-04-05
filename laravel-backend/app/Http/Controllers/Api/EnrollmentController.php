<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RegistrationPaymentService;
use App\Services\RoleService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class EnrollmentController extends Controller
{
    public function __construct(
        private readonly RoleService $roleService,
        private readonly RegistrationPaymentService $registrationPayments
    ) {
    }

    private function normalizeText(mixed $value, int $max = 255): string
    {
        return Str::limit(trim((string) ($value ?? "")), $max, "");
    }

    private function normalizeEmail(mixed $value): string
    {
        return Str::limit(strtolower(trim((string) ($value ?? ""))), 255, "");
    }

    private function parseLimit(mixed $raw, int $fallback = 100, int $max = 500): int
    {
        $n = (int) $raw;
        if ($n <= 0) {
            return $fallback;
        }
        return min($n, $max);
    }

    private function isMissingEnrollmentsError(\Throwable $error): bool
    {
        $message = strtolower($error->getMessage());

        return str_contains($message, "enrollments")
            || str_contains($message, "admitted_by")
            || str_contains($message, "admitted_at");
    }

    private function missingEnrollmentsMessage(): string
    {
        return "Enrollments table is missing. Run migration 021_create_enrollments_table.sql and retry.";
    }

    private function registrationRequiredResponse(array $regulations, float $requiredFee)
    {
        return response()->json([
            "code" => "REGISTRATION_PAYMENT_REQUIRED",
            "message" => "Enrollment registration fee payment is required before submitting this enrollment.",
            "registrationType" => RegistrationPaymentService::TYPE_ENROLLMENT,
            "requiredFee" => $requiredFee,
            "bankName" => $regulations["bank_name"] ?? "I&M Bank",
            "bankAccountNumber" => $regulations["bank_account_number"] ?? "0030 7335 5161 50",
            "accountName" => $regulations["account_name"] ?? "Murekefu Music Hub",
        ], 402);
    }

    public function submit(Request $request)
    {
        try {
            $authUid = (string) $request->attributes->get("authUid", "");
            $user = $this->roleService->resolveDbUserByAuthUid($authUid);
            if (!$user || empty($user["id"])) {
                return response()->json([
                    "message" => "User profile not found. Sign in again and retry.",
                ], 404);
            }

            $fullName = $this->normalizeText($request->input("full_name") ?: $request->input("fullName") ?: ($user["display_name"] ?? ""), 160);
            $email = $this->normalizeEmail($request->input("email") ?: ($user["email"] ?? ""));
            $musicClass = $this->normalizeText($request->input("music_class") ?: $request->input("musicClass"), 120);
            $skillLevel = strtolower($this->normalizeText($request->input("skill_level") ?: $request->input("skillLevel"), 32));
            $notes = $this->normalizeText($request->input("notes"), 4000);

            if ($fullName === "") {
                return response()->json(["message" => "Full name is required"], 400);
            }
            if ($email === "") {
                return response()->json(["message" => "Email is required"], 400);
            }
            if ($musicClass === "") {
                return response()->json(["message" => "Music class is required"], 400);
            }
            if ($skillLevel === "") {
                return response()->json(["message" => "Skill level is required"], 400);
            }

            $existing = DB::table("enrollments")
                ->where("user_id", $user["id"])
                ->where("music_class", $musicClass)
                ->whereIn("status", ["pending", "admitted"])
                ->orderByDesc("created_at")
                ->first();

            if ($existing && $existing->status === "pending") {
                return response()->json([
                    "message" => "You already have a pending enrollment for this class.",
                    "enrollmentId" => $existing->id,
                    "status" => $existing->status,
                ], 409);
            }
            if ($existing && $existing->status === "admitted") {
                return response()->json([
                    "message" => "You are already admitted for this class.",
                    "enrollmentId" => $existing->id,
                    "status" => $existing->status,
                ], 409);
            }

            $approvedPayment = null;
            $regulations = $this->registrationPayments->ensureActiveRegistrationRegulations();
            $requiredEnrollmentFee = $this->registrationPayments->getRequiredRegistrationFee(
                $regulations,
                RegistrationPaymentService::TYPE_ENROLLMENT
            );

            if ($requiredEnrollmentFee > 0) {
                $approvedPayment = $this->registrationPayments->findApprovedUnconsumedRegistrationPayment(
                    (string) $user["id"],
                    RegistrationPaymentService::TYPE_ENROLLMENT
                );

                if (!$approvedPayment || empty($approvedPayment["id"])) {
                    return $this->registrationRequiredResponse($regulations, $requiredEnrollmentFee);
                }
            }

            $id = (string) Str::uuid();
            DB::table("enrollments")->insert([
                "id" => $id,
                "user_id" => $user["id"],
                "full_name" => $fullName,
                "email" => $email,
                "music_class" => $musicClass,
                "skill_level" => $skillLevel,
                "notes" => $notes !== "" ? $notes : null,
                "status" => "pending",
                "created_at" => now(),
                "updated_at" => now(),
            ]);

            if ($approvedPayment && !empty($approvedPayment["id"])) {
                $consumedPayment = $this->registrationPayments->consumeRegistrationPaymentSubmission(
                    (string) $approvedPayment["id"],
                    RegistrationPaymentService::TYPE_ENROLLMENT,
                    $id
                );

                if (!$consumedPayment || empty($consumedPayment["id"])) {
                    DB::table("enrollments")->where("id", $id)->delete();

                    return response()->json([
                        "code" => "REGISTRATION_PAYMENT_ALREADY_USED",
                        "message" => "The approved enrollment payment was already used. Submit a new registration payment and try again.",
                    ], 409);
                }
            }

            $row = DB::table("enrollments")->where("id", $id)->first();
            return response()->json([
                "success" => true,
                "message" => "Enrollment submitted successfully",
                "enrollment" => $row,
            ], 201);
        } catch (\Throwable $e) {
            if ($this->isMissingEnrollmentsError($e)) {
                return response()->json([
                    "message" => $this->missingEnrollmentsMessage(),
                ], 500);
            }
            if ($this->registrationPayments->isMissingRegistrationTablesError($e)) {
                return response()->json([
                    "message" => $this->registrationPayments->missingRegistrationTablesMessage(),
                ], 500);
            }

            throw $e;
        }
    }

    public function my(Request $request)
    {
        try {
            $authUid = (string) $request->attributes->get("authUid", "");
            $user = $this->roleService->resolveDbUserByAuthUid($authUid);
            if (!$user || empty($user["id"])) {
                return response()->json(["message" => "User profile not found"], 404);
            }

            $limit = $this->parseLimit($request->query("limit"), 100, 500);
            $rows = DB::table("enrollments")
                ->select("id", "full_name", "email", "music_class", "skill_level", "notes", "status", "admitted_by", "admitted_at", "created_at", "updated_at")
                ->where("user_id", $user["id"])
                ->orderByDesc("created_at")
                ->limit($limit)
                ->get();

            return response()->json($rows);
        } catch (\Throwable $e) {
            if ($this->isMissingEnrollmentsError($e)) {
                return response()->json([
                    "message" => $this->missingEnrollmentsMessage(),
                ], 500);
            }

            throw $e;
        }
    }
}
