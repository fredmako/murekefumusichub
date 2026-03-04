<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RoleService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class EnrollmentController extends Controller
{
    public function __construct(private readonly RoleService $roleService)
    {
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

    public function submit(Request $request)
    {
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

        $row = DB::table("enrollments")->where("id", $id)->first();
        return response()->json([
            "success" => true,
            "message" => "Enrollment submitted successfully",
            "enrollment" => $row,
        ], 201);
    }

    public function my(Request $request)
    {
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
    }
}
