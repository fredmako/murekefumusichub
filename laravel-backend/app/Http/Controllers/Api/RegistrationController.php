<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RegistrationPaymentService;
use App\Services\RoleService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RegistrationController extends Controller
{
    public function __construct(
        private readonly RoleService $roleService,
        private readonly RegistrationPaymentService $registrationPayments
    ) {
    }

    private function authUser(Request $request): ?array
    {
        $authUid = (string) $request->attributes->get("authUid", "");
        if ($authUid === "") {
            return null;
        }

        return $this->roleService->resolveDbUserByAuthUid($authUid);
    }

    public function regulations()
    {
        try {
            $regulations = $this->registrationPayments->ensureActiveRegistrationRegulations();
            return response()->json(
                $this->registrationPayments->formatPublicRegulations($regulations)
            );
        } catch (\Throwable $error) {
            if ($this->registrationPayments->isMissingRegistrationTablesError($error)) {
                return response()->json([
                    "message" => $this->registrationPayments->missingRegistrationTablesMessage(),
                ], 500);
            }

            return response()->json([
                "message" => $error->getMessage() ?: "Failed to fetch registration regulations",
            ], 500);
        }
    }

    public function myPayments(Request $request)
    {
        $user = $this->authUser($request);
        if (!$user || empty($user["id"])) {
            return response()->json([
                "message" => "User profile not found. Sign in again and retry.",
            ], 404);
        }

        try {
            $requestedType = $this->registrationPayments->normalizeRegistrationType($request->query("type"));

            $query = DB::table("registration_payment_submissions")
                ->select(
                    "id",
                    "registration_type",
                    "amount",
                    "payment_ref",
                    "status",
                    "is_consumed",
                    "submitted_at",
                    "reviewed_at",
                    "admin_notes",
                    "consumed_at",
                    "consumed_for",
                    "consumed_target_id"
                )
                ->where("requester_id", $user["id"])
                ->orderByDesc("submitted_at")
                ->limit(100);

            if ($requestedType) {
                $query->where("registration_type", $requestedType);
            }

            return response()->json($query->get());
        } catch (\Throwable $error) {
            if ($this->registrationPayments->isMissingRegistrationTablesError($error)) {
                return response()->json([
                    "message" => $this->registrationPayments->missingRegistrationTablesMessage(),
                ], 500);
            }

            return response()->json([
                "message" => $error->getMessage() ?: "Failed to fetch registration payments",
            ], 500);
        }
    }

    public function submitPayment(Request $request)
    {
        $user = $this->authUser($request);
        if (!$user || empty($user["id"])) {
            return response()->json([
                "message" => "User profile not found. Sign in again and retry.",
            ], 404);
        }

        $registrationType = $this->registrationPayments->normalizeRegistrationType(
            $request->input("registrationType", $request->input("registration_type"))
        );
        $paymentRef = $this->registrationPayments->normalizePaymentRef(
            $request->input("paymentRef", $request->input("payment_ref", $request->input("mpesaCode")))
        );

        if (!$registrationType) {
            return response()->json([
                "message" => "registrationType must be enrollment or composer_request",
            ], 400);
        }

        if (!$this->registrationPayments->isValidPaymentRef($paymentRef)) {
            return response()->json([
                "message" => "Invalid payment reference format. Use the exact transaction reference from your bank/M-Pesa confirmation.",
            ], 400);
        }

        try {
            $regulations = $this->registrationPayments->ensureActiveRegistrationRegulations();
            $requiredFee = $this->registrationPayments->getRequiredRegistrationFee($regulations, $registrationType);

            if ($requiredFee <= 0) {
                return response()->json([
                    "message" => "No registration fee is currently configured for this service. Payment submission is not required.",
                    "registrationType" => $registrationType,
                    "requiredFee" => $requiredFee,
                ], 409);
            }

            $pendingRow = DB::table("registration_payment_submissions")
                ->select("id", "status")
                ->where("requester_id", $user["id"])
                ->where("registration_type", $registrationType)
                ->where("status", "pending")
                ->first();

            if ($pendingRow?->id) {
                return response()->json([
                    "message" => "You already have a pending registration payment submission.",
                    "submissionId" => $pendingRow->id,
                ], 409);
            }

            $approvedRow = $this->registrationPayments->findApprovedUnconsumedRegistrationPayment(
                (string) $user["id"],
                $registrationType
            );
            if ($approvedRow["id"] ?? null) {
                return response()->json([
                    "message" => "You already have an approved registration payment ready for use.",
                    "submissionId" => $approvedRow["id"],
                    "status" => $approvedRow["status"] ?? null,
                ], 409);
            }

            DB::table("registration_payment_submissions")->insert([
                "requester_id" => $user["id"],
                "registration_type" => $registrationType,
                "amount" => $requiredFee,
                "payment_ref" => $paymentRef,
                "status" => "pending",
                "submitted_at" => now(),
            ]);

            $inserted = DB::table("registration_payment_submissions")
                ->select(
                    "id",
                    "registration_type",
                    "amount",
                    "payment_ref",
                    "status",
                    "submitted_at",
                    "reviewed_at"
                )
                ->where("requester_id", $user["id"])
                ->where("registration_type", $registrationType)
                ->where("payment_ref", $paymentRef)
                ->orderByDesc("submitted_at")
                ->first();

            return response()->json([
                "success" => true,
                "message" => "Registration payment reference submitted. Awaiting admin approval.",
                "submission" => $inserted,
                "regulations" => [
                    "enrollmentFee" => (float) ($regulations["enrollment_fee"] ?? 0),
                    "composerRequestFee" => (float) ($regulations["composer_request_fee"] ?? 0),
                    "bankName" => $regulations["bank_name"] ?? "I&M Bank",
                    "bankAccountNumber" => $regulations["bank_account_number"] ?? "0030 7335 5161 50",
                    "accountName" => $regulations["account_name"] ?? "Murekefu Music Hub",
                ],
            ], 201);
        } catch (\Throwable $error) {
            if ($this->registrationPayments->isMissingRegistrationTablesError($error)) {
                return response()->json([
                    "message" => $this->registrationPayments->missingRegistrationTablesMessage(),
                ], 500);
            }

            if (str_contains(strtolower($error->getMessage()), "duplicate")) {
                return response()->json([
                    "message" => "A pending registration payment submission already exists for this request.",
                ], 409);
            }

            return response()->json([
                "message" => $error->getMessage() ?: "Failed to submit registration payment",
            ], 500);
        }
    }
}
