<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RoleService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RequestRoleController extends Controller
{
    public function __construct(private readonly RoleService $roleService)
    {
    }

    private function authUid(Request $request): string
    {
        return (string) $request->attributes->get("authUid", "");
    }

    private function requestStatusForUser(string $userId, array $roles): array
    {
        $rows = DB::table("role_requests")
            ->select("requested_role", "status", "requested_at")
            ->where("user_id", $userId)
            ->whereIn("requested_role", ["composer", "admin"])
            ->orderByDesc("requested_at")
            ->get();

        $status = [
            "composer" => "none",
            "admin" => "none",
        ];

        foreach ($rows as $row) {
            $role = (string) ($row->requested_role ?? "");
            if (!array_key_exists($role, $status)) {
                continue;
            }
            if ($status[$role] === "none") {
                $status[$role] = (string) ($row->status ?: "none");
            }
        }

        if (in_array("composer", $roles, true)) {
            $status["composer"] = "approved";
        }
        if (in_array("admin", $roles, true)) {
            $status["admin"] = "approved";
        }

        return $status;
    }

    public function status(Request $request)
    {
        $authUid = $this->authUid($request);
        $user = $this->roleService->resolveDbUserByAuthUid($authUid);
        if (!$user) {
            return response()->json(["message" => "User not found"], 404);
        }

        $roles = $this->roleService->resolveRoles((string) $user["id"], $user["email"] ?? null);
        $requestStatus = $this->requestStatusForUser((string) $user["id"], $roles);

        return response()->json([
            "roles" => $roles,
            "requests" => $requestStatus,
        ]);
    }

    public function requestRole(Request $request)
    {
        $authUid = $this->authUid($request);
        $requestedRole = strtolower(trim((string) $request->input("requestedRole", "")));
        if (!in_array($requestedRole, ["composer", "admin"], true)) {
            return response()->json([
                "message" => 'requestedRole must be "composer" or "admin"',
            ], 400);
        }

        $user = $this->roleService->resolveDbUserByAuthUid($authUid);
        if (!$user) {
            return response()->json(["message" => "User not found"], 404);
        }

        $roles = $this->roleService->resolveRoles((string) $user["id"], $user["email"] ?? null);
        if (in_array($requestedRole, $roles, true)) {
            return response()->json([
                "message" => "You already have {$requestedRole} access.",
                "status" => "approved",
            ], 409);
        }

        $existing = DB::table("role_requests")
            ->select("id", "status")
            ->where("user_id", $user["id"])
            ->where("requested_role", $requestedRole)
            ->orderByDesc("requested_at")
            ->first();

        if ($existing && in_array($existing->status, ["pending", "approved"], true)) {
            if ($requestedRole === "composer" && $existing->status === "pending") {
                DB::table("users")->where("id", $user["id"])->update([
                    "composer_request" => true,
                    "updated_at" => now(),
                ]);
            }

            return response()->json([
                "message" => "You already have a {$existing->status} {$requestedRole} request.",
                "requestId" => $existing->id,
                "status" => $existing->status,
            ], 409);
        }

        if ($existing) {
            DB::table("role_requests")->where("id", $existing->id)->update([
                "status" => "pending",
                "requested_at" => now(),
            ]);

            if ($requestedRole === "composer") {
                DB::table("users")->where("id", $user["id"])->update([
                    "composer_request" => true,
                    "updated_at" => now(),
                ]);
            }

            return response()->json([
                "success" => true,
                "message" => "{$requestedRole} request resubmitted successfully. Awaiting admin approval.",
                "requestId" => $existing->id,
                "status" => "pending",
            ]);
        }

        $requestId = (string) \Illuminate\Support\Str::uuid();
        DB::table("role_requests")->insert([
            "id" => $requestId,
            "user_id" => $user["id"],
            "requested_role" => $requestedRole,
            "status" => "pending",
            "requested_at" => now(),
        ]);

        if ($requestedRole === "composer") {
            DB::table("users")->where("id", $user["id"])->update([
                "composer_request" => true,
                "updated_at" => now(),
            ]);
        }

        return response()->json([
            "success" => true,
            "message" => "{$requestedRole} request submitted successfully. Awaiting admin approval.",
            "requestId" => $requestId,
            "status" => "pending",
        ], 201);
    }
}
