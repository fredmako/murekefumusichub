<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RegistrationPaymentService;
use App\Services\RoleService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class RequestRoleController extends Controller
{
    public function __construct(
        private readonly RoleService $roleService,
        private readonly RegistrationPaymentService $registrationPayments
    ) {
    }

    private function authUid(Request $request): string
    {
        return (string) $request->attributes->get("authUid", "");
    }

    private function requestedRoleFromRequest(Request $request): string
    {
        return strtolower(trim((string) $request->input("requestedRole", $request->query("requestedRole", "composer")))) === "admin"
            ? "admin"
            : "composer";
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

    private function inviteSupportsRequestedRole(): bool
    {
        return Schema::hasColumn("invites", "requested_role");
    }

    private function inviteSupportsUsedBy(): bool
    {
        return Schema::hasColumn("invites", "used_by");
    }

    private function inviteSupportsUsedAt(): bool
    {
        return Schema::hasColumn("invites", "used_at");
    }

    private function inviteQuery(string $email, string $requestedRole)
    {
        $query = DB::table("invites")
            ->whereRaw("LOWER(email) = ?", [$email])
            ->orderByDesc("created_at");

        if ($this->inviteSupportsRequestedRole()) {
            $query->where("requested_role", $requestedRole);
        }

        return $query;
    }

    private function selectInvite(array $baseColumns)
    {
        $columns = $baseColumns;
        if ($this->inviteSupportsRequestedRole()) {
            $columns[] = "requested_role";
        }
        if ($this->inviteSupportsUsedBy()) {
            $columns[] = "used_by";
        }
        if ($this->inviteSupportsUsedAt()) {
            $columns[] = "used_at";
        }

        return $columns;
    }

    private function ensureUserRoleAssignment(string $userId, string $roleName): void
    {
        $roleId = DB::table("roles")
            ->where("name", $roleName)
            ->value("id");

        if (!$roleId) {
            return;
        }

        DB::table("user_roles")->updateOrInsert(
            [
                "user_id" => $userId,
                "role_id" => $roleId,
            ],
            [
                "assigned_at" => now(),
            ]
        );
    }

    private function ensureComposerProfile(string $userId): void
    {
        $activationColumnExists = Schema::hasColumn("composers", "is_active");
        $composerProfile = DB::table("composers")
            ->where("user_id", $userId)
            ->first();

        if ($composerProfile) {
            if ($activationColumnExists && (bool) ($composerProfile->is_active ?? true) === false) {
                DB::table("composers")
                    ->where("id", $composerProfile->id)
                    ->update([
                        "is_active" => true,
                        "updated_at" => now(),
                    ]);
            }

            return;
        }

        $payload = [
            "id" => (string) Str::uuid(),
            "user_id" => $userId,
            "created_at" => now(),
        ];
        if ($activationColumnExists) {
            $payload["is_active"] = true;
        }

        DB::table("composers")->insert($payload);
    }

    private function markRoleRequestApproved(string $userId, string $requestedRole): ?string
    {
        $existingRequest = DB::table("role_requests")
            ->select("id")
            ->where("user_id", $userId)
            ->where("requested_role", $requestedRole)
            ->orderByDesc("requested_at")
            ->first();

        if ($existingRequest) {
            DB::table("role_requests")
                ->where("id", $existingRequest->id)
                ->update([
                    "status" => "approved",
                    "requested_at" => now(),
                ]);

            return (string) $existingRequest->id;
        }

        $requestId = (string) Str::uuid();
        DB::table("role_requests")->insert([
            "id" => $requestId,
            "user_id" => $userId,
            "requested_role" => $requestedRole,
            "status" => "approved",
            "requested_at" => now(),
        ]);

        return $requestId;
    }

    private function registrationRequiredResponse(array $regulations, float $requiredFee, string $registrationType, string $message)
    {
        return response()->json([
            "code" => "REGISTRATION_PAYMENT_REQUIRED",
            "message" => $message,
            "registrationType" => $registrationType,
            "requiredFee" => $requiredFee,
            "bankName" => $regulations["bank_name"] ?? "I&M Bank",
            "bankAccountNumber" => $regulations["bank_account_number"] ?? "0030 7335 5161 50",
            "accountName" => $regulations["account_name"] ?? "Murekefu Music Hub",
        ], 402);
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

    public function inviteStatus(Request $request)
    {
        $authUid = $this->authUid($request);
        $requestedRole = $this->requestedRoleFromRequest($request);
        $user = $this->roleService->resolveDbUserByAuthUid($authUid);
        if (!$user) {
            return response()->json(["message" => "User not found"], 404);
        }

        $normalizedEmail = strtolower(trim((string) ($user["email"] ?? "")));
        if ($normalizedEmail === "") {
            return response()->json([
                "available" => false,
                "requestedRole" => $requestedRole,
            ]);
        }

        $invite = $this->inviteQuery($normalizedEmail, $requestedRole)
            ->select($this->selectInvite(["id", "email", "created_at", "used"]))
            ->first();

        if (!$invite) {
            return response()->json([
                "available" => false,
                "requestedRole" => $requestedRole,
            ]);
        }

        $usedBy = $this->inviteSupportsUsedBy() ? ($invite->used_by ?? null) : null;
        $acceptedByCurrentUser = (bool) ($invite->used ?? false) && $usedBy === $user["id"];
        $canAccept = !(bool) ($invite->used ?? false) || $acceptedByCurrentUser;

        return response()->json([
            "available" => true,
            "requestedRole" => $requestedRole,
            "canAccept" => $canAccept,
            "accepted" => $acceptedByCurrentUser,
            "invite" => [
                "id" => $invite->id,
                "email" => $invite->email,
                "used" => (bool) ($invite->used ?? false),
                "usedBy" => $usedBy,
                "usedAt" => $this->inviteSupportsUsedAt() ? ($invite->used_at ?? null) : null,
                "createdAt" => $invite->created_at ?? null,
            ],
        ]);
    }

    public function acceptInvite(Request $request)
    {
        $authUid = $this->authUid($request);
        $requestedRole = $this->requestedRoleFromRequest($request);
        $user = $this->roleService->resolveDbUserByAuthUid($authUid);
        if (!$user) {
            return response()->json(["message" => "User not found"], 404);
        }

        $normalizedEmail = strtolower(trim((string) ($user["email"] ?? "")));
        if ($normalizedEmail === "") {
            return response()->json([
                "message" => "User email is required to accept invites",
            ], 400);
        }

        $invite = $this->inviteQuery($normalizedEmail, $requestedRole)
            ->select($this->selectInvite(["id", "email", "used", "created_at"]))
            ->first();

        if (!$invite) {
            return response()->json([
                "message" => "No active {$requestedRole} invite found for your account.",
            ], 404);
        }

        if ((bool) ($invite->used ?? false) && $this->inviteSupportsUsedBy()) {
            $usedBy = (string) ($invite->used_by ?? "");
            if ($usedBy !== "" && $usedBy !== (string) $user["id"]) {
                return response()->json([
                    "message" => "This invite was already accepted by another user.",
                ], 409);
            }
        }

        DB::transaction(function () use ($user, $requestedRole, $invite) {
            $this->ensureUserRoleAssignment((string) $user["id"], $requestedRole);
            if ($requestedRole === "composer") {
                $this->ensureComposerProfile((string) $user["id"]);
                DB::table("users")->where("id", $user["id"])->update([
                    "composer_request" => false,
                    "updated_at" => now(),
                ]);
            }

            $this->markRoleRequestApproved((string) $user["id"], $requestedRole);

            $inviteUpdates = [
                "used" => true,
            ];
            if ($this->inviteSupportsUsedBy()) {
                $inviteUpdates["used_by"] = $user["id"];
            }
            if ($this->inviteSupportsUsedAt()) {
                $inviteUpdates["used_at"] = now();
            }

            DB::table("invites")
                ->where("id", $invite->id)
                ->update($inviteUpdates);
        });

        $updatedInvite = DB::table("invites")
            ->where("id", $invite->id)
            ->select($this->selectInvite(["id", "email", "used", "created_at"]))
            ->first();

        $roles = $this->roleService->resolveRoles((string) $user["id"], $user["email"] ?? null);

        return response()->json([
            "success" => true,
            "message" => "{$requestedRole} invite accepted successfully.",
            "requestedRole" => $requestedRole,
            "roles" => $roles,
            "invite" => $updatedInvite ? [
                "id" => $updatedInvite->id,
                "email" => $updatedInvite->email,
                "used" => (bool) ($updatedInvite->used ?? false),
                "usedBy" => $this->inviteSupportsUsedBy() ? ($updatedInvite->used_by ?? null) : null,
                "usedAt" => $this->inviteSupportsUsedAt() ? ($updatedInvite->used_at ?? null) : null,
                "createdAt" => $updatedInvite->created_at ?? null,
            ] : null,
        ]);
    }

    public function requestRole(Request $request)
    {
        try {
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

            $approvedPayment = null;
            if ($requestedRole === "composer") {
                $regulations = $this->registrationPayments->ensureActiveRegistrationRegulations();
                $requiredComposerFee = $this->registrationPayments->getRequiredRegistrationFee(
                    $regulations,
                    RegistrationPaymentService::TYPE_COMPOSER_REQUEST
                );

                if ($requiredComposerFee > 0) {
                    $approvedPayment = $this->registrationPayments->findApprovedUnconsumedRegistrationPayment(
                        (string) $user["id"],
                        RegistrationPaymentService::TYPE_COMPOSER_REQUEST
                    );

                    if (!$approvedPayment || empty($approvedPayment["id"])) {
                        return $this->registrationRequiredResponse(
                            $regulations,
                            $requiredComposerFee,
                            RegistrationPaymentService::TYPE_COMPOSER_REQUEST,
                            "Composer request payment is required before submitting this role request."
                        );
                    }
                }
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

                if ($approvedPayment && !empty($approvedPayment["id"])) {
                    $consumedPayment = $this->registrationPayments->consumeRegistrationPaymentSubmission(
                        (string) $approvedPayment["id"],
                        RegistrationPaymentService::TYPE_COMPOSER_REQUEST,
                        (string) $existing->id
                    );

                    if (!$consumedPayment || empty($consumedPayment["id"])) {
                        DB::table("role_requests")->where("id", $existing->id)->update([
                            "status" => "rejected",
                        ]);
                        DB::table("users")->where("id", $user["id"])->update([
                            "composer_request" => false,
                            "updated_at" => now(),
                        ]);

                        return response()->json([
                            "code" => "REGISTRATION_PAYMENT_ALREADY_USED",
                            "message" => "The approved composer registration payment was already used. Submit a new payment and try again.",
                        ], 409);
                    }
                }

                return response()->json([
                    "success" => true,
                    "message" => "{$requestedRole} request resubmitted successfully. Awaiting admin approval.",
                    "requestId" => $existing->id,
                    "status" => "pending",
                ]);
            }

            $requestId = (string) Str::uuid();
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

                if ($approvedPayment && !empty($approvedPayment["id"])) {
                    $consumedPayment = $this->registrationPayments->consumeRegistrationPaymentSubmission(
                        (string) $approvedPayment["id"],
                        RegistrationPaymentService::TYPE_COMPOSER_REQUEST,
                        $requestId
                    );

                    if (!$consumedPayment || empty($consumedPayment["id"])) {
                        DB::table("role_requests")->where("id", $requestId)->delete();
                        DB::table("users")->where("id", $user["id"])->update([
                            "composer_request" => false,
                            "updated_at" => now(),
                        ]);

                        return response()->json([
                            "code" => "REGISTRATION_PAYMENT_ALREADY_USED",
                            "message" => "The approved composer registration payment was already used. Submit a new payment and try again.",
                        ], 409);
                    }
                }
            }

            return response()->json([
                "success" => true,
                "message" => "{$requestedRole} request submitted successfully. Awaiting admin approval.",
                "requestId" => $requestId,
                "status" => "pending",
            ], 201);
        } catch (\Throwable $e) {
            if ($this->registrationPayments->isMissingRegistrationTablesError($e)) {
                return response()->json([
                    "message" => $this->registrationPayments->missingRegistrationTablesMessage(),
                ], 500);
            }

            throw $e;
        }
    }
}
