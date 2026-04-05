<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RegistrationPaymentService;
use App\Services\RoleService;
use App\Support\AvatarUrl;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class AdminController extends Controller
{
    public function __construct(
        private readonly RoleService $roleService,
        private readonly RegistrationPaymentService $registrationPayments
    )
    {
    }

    private function parseLimit(mixed $raw, int $fallback = 200, int $max = 1000): int
    {
        $n = (int) $raw;
        if ($n <= 0) {
            return $fallback;
        }
        return min($n, $max);
    }

    private function resolveDbUser(mixed $identifier): ?array
    {
        return $this->roleService->resolveDbUserByIdOrAuth(trim((string) $identifier));
    }

    private function isComposerActivationColumnMissing(): bool
    {
        try {
            DB::table("composers")->select("is_active")->limit(1)->get();
            return false;
        } catch (\Throwable $e) {
            $message = strtolower($e->getMessage());
            return str_contains($message, "is_active");
        }
    }

    private function isProtectedAdminIdentifier(?string $email): bool
    {
        $normalized = strtolower(trim((string) ($email ?? "")));
        if ($normalized === "") {
            return false;
        }

        $configured = collect(explode(",", (string) env("ADMIN_IDENTIFIERS", "")))
            ->map(fn ($value) => strtolower(trim((string) $value)))
            ->filter()
            ->values()
            ->all();

        return in_array($normalized, $configured, true);
    }

    private function deleteSupabaseAuthUser(?string $authUid): void
    {
        $authUid = trim((string) ($authUid ?? ""));
        if ($authUid === "") {
            return;
        }

        $supabaseUrl = rtrim((string) env("SUPABASE_URL", ""), "/");
        $serviceRole = (string) env("SUPABASE_SERVICE_ROLE_KEY", "");
        if ($supabaseUrl === "" || $serviceRole === "") {
            logger()->warning("Supabase auth deletion skipped: SUPABASE_URL or SERVICE_ROLE_KEY missing.");
            return;
        }

        $response = Http::withHeaders([
            "Authorization" => "Bearer {$serviceRole}",
            "apikey" => $serviceRole,
        ])->acceptJson()->delete("{$supabaseUrl}/auth/v1/admin/users/{$authUid}");

        if (!$response->successful()) {
            throw new \RuntimeException("Failed to delete Supabase auth user.");
        }
    }

    private function insertPurchaseWithFallback(array $payload): array
    {
        $id = (string) Str::uuid();
        DB::table("purchases")->insert([
            "id" => $id,
            ...$payload,
        ]);

        $row = DB::table("purchases")->where("id", $id)->first();
        return (array) $row;
    }

    private function hasInviteRequestedRoleColumn(): bool
    {
        return Schema::hasColumn("invites", "requested_role");
    }

    private function hasCompositionVerificationColumns(): bool
    {
        return Schema::hasColumn("compositions", "is_verified")
            && Schema::hasColumn("compositions", "verified_at")
            && Schema::hasColumn("compositions", "verified_by");
    }

    private function requireRegulationsController(Request $request): array|\Illuminate\Http\JsonResponse
    {
        $adminUser = $this->resolveDbUser($request->attributes->get("authUid"));
        if (!$adminUser?["id"]) {
            return response()->json(["error" => "Admin user not found"], 404);
        }

        $regulations = $this->registrationPayments->ensureActiveRegistrationRegulations();
        $controllingIdentifier = $regulations["controlling_admin_identifier"]
            ?? $this->registrationPayments->defaultControllingAdminIdentifier();

        if (!$this->registrationPayments->isRegulationsControllerUser($adminUser, $controllingIdentifier)) {
            return response()->json([
                "error" => "Only {$controllingIdentifier} can manage registration regulations.",
                "controllingAdminIdentifier" => $controllingIdentifier,
            ], 403);
        }

        return [
            "adminUser" => $adminUser,
            "regulations" => $regulations,
            "controllingIdentifier" => $controllingIdentifier,
        ];
    }

    private function formatRegistrationPaymentSubmission(object $submission, array $usersById = []): array
    {
        $requester = isset($usersById[$submission->requester_id])
            ? AvatarUrl::withNormalizedAvatar($usersById[$submission->requester_id])
            : null;
        $reviewer = isset($usersById[$submission->reviewed_by])
            ? AvatarUrl::withNormalizedAvatar($usersById[$submission->reviewed_by])
            : null;

        return [
            ...((array) $submission),
            "requester" => $requester,
            "reviewer" => $reviewer,
        ];
    }

    public function bootstrap()
    {
        $roles = DB::table("roles")->select("id", "name")->get();
        $invites = DB::table("invites")
            ->select("id", "email", "invited_by", "created_at", "used")
            ->orderByDesc("created_at")
            ->limit(50)
            ->get();

        $pendingRequests = DB::table("role_requests")
            ->select("id", "user_id", "requested_role", "status", "requested_at")
            ->where("requested_role", "composer")
            ->where("status", "pending")
            ->orderByDesc("requested_at")
            ->limit(50)
            ->get();

        $requestUserIds = collect($pendingRequests)->pluck("user_id")->filter()->unique()->values()->all();
        $requestUsers = [];
        $requestRolesByUserId = [];

        if (count($requestUserIds) > 0) {
            $users = DB::table("users")
                ->select("id", "email", "display_name")
                ->whereIn("id", $requestUserIds)
                ->get();
            foreach ($users as $user) {
                $requestUsers[$user->id] = $user;
            }

            $roleRows = DB::table("user_roles")
                ->join("roles", "roles.id", "=", "user_roles.role_id")
                ->whereIn("user_roles.user_id", $requestUserIds)
                ->select("user_roles.user_id", "roles.name")
                ->get();
            foreach ($roleRows as $row) {
                $requestRolesByUserId[$row->user_id] ??= [];
                if (!in_array($row->name, $requestRolesByUserId[$row->user_id], true)) {
                    $requestRolesByUserId[$row->user_id][] = $row->name;
                }
            }
        }

        $formattedRequests = collect($pendingRequests)->map(function ($r) use ($requestUsers, $requestRolesByUserId) {
            $user = $requestUsers[$r->user_id] ?? null;
            return [
                "id" => $r->user_id,
                "request_id" => $r->id,
                "user_id" => $r->user_id,
                "email" => $user?->email,
                "display_name" => $user?->display_name,
                "displayName" => $user?->display_name,
                "requested_role" => $r->requested_role,
                "status" => $r->status,
                "created_at" => $r->requested_at,
                "roles" => $requestRolesByUserId[$r->user_id] ?? [],
            ];
        })->values();

        $totalUsers = DB::table("users")->count();
        $totalCompositions = DB::table("compositions")->where("deleted", false)->count();
        $totalTransactions = DB::table("purchases")->count();

        return response()->json([
            "roles" => $roles,
            "invites" => $invites,
            "requests" => $formattedRequests,
            "stats" => [
                "totalUsers" => $totalUsers,
                "totalCompositions" => $totalCompositions,
                "totalTransactions" => $totalTransactions,
                "totalRevenue" => 0,
            ],
        ]);
    }

    public function roles()
    {
        return response()->json(DB::table("roles")->get());
    }

    public function users()
    {
        $users = DB::table("users")
            ->select("id", "auth_uid", "email", "display_name", "phone", "avatar_url", "is_active", "composer_request", "deleted", "created_at", "updated_at")
            ->orderByDesc("created_at")
            ->get()
            ->map(fn ($u) => AvatarUrl::withNormalizedAvatar((array) $u))
            ->values();

        $userRoles = DB::table("user_roles")
            ->leftJoin("roles", "roles.id", "=", "user_roles.role_id")
            ->select("user_roles.user_id", "user_roles.role_id", "roles.name")
            ->get()
            ->map(fn ($r) => [
                "user_id" => $r->user_id,
                "role_id" => $r->role_id,
                "roles" => ["name" => $r->name],
            ])
            ->values();

        return response()->json([
            "users" => $users,
            "userRoles" => $userRoles,
        ]);
    }

    public function compositions(Request $request)
    {
        $selects = [
            "compositions.id",
            "compositions.title",
            "compositions.description",
            "compositions.price",
            "compositions.created_at",
            "compositions.composer_id",
            "compositions.pdf_url",
            "composers.id as composer_row_id",
            "composers.user_id as composer_user_id",
            "users.display_name as composer_display_name",
            "users.email as composer_email",
        ];

        if ($this->hasCompositionVerificationColumns()) {
            $selects[] = "compositions.is_verified";
            $selects[] = "compositions.verified_at";
            $selects[] = "compositions.verified_by";
            if (Schema::hasColumn("compositions", "verification_notes")) {
                $selects[] = "compositions.verification_notes";
            }
        }

        $rows = DB::table("compositions")
            ->leftJoin("composers", "composers.id", "=", "compositions.composer_id")
            ->leftJoin("users", "users.id", "=", "composers.user_id")
            ->select($selects)
            ->where("compositions.deleted", false)
            ->orderByDesc("compositions.created_at")
            ->limit($this->parseLimit($request->query("limit"), 400, 1000))
            ->get()
            ->map(function ($row) {
                return [
                    "id" => $row->id,
                    "title" => $row->title,
                    "description" => $row->description,
                    "price" => $row->price,
                    "pdf_url" => $row->pdf_url ?? null,
                    "created_at" => $row->created_at,
                    "composer_id" => $row->composer_id,
                    "is_verified" => (bool) ($row->is_verified ?? false),
                    "verified_at" => $row->verified_at ?? null,
                    "verified_by" => $row->verified_by ?? null,
                    "verification_notes" => $row->verification_notes ?? null,
                    "composers" => [
                        "id" => $row->composer_row_id,
                        "user_id" => $row->composer_user_id,
                        "users" => [
                            "display_name" => $row->composer_display_name,
                            "email" => $row->composer_email,
                        ],
                    ],
                ];
            })->values();

        return response()->json($rows);
    }

    public function transactions(Request $request)
    {
        $limit = $this->parseLimit($request->query("limit"), 200, 1000);

        $purchases = DB::table("purchases")->orderByDesc("purchased_at")->limit($limit)->get();
        $submissions = DB::table("payment_submissions")->orderByDesc("submitted_at")->limit($limit)->get();

        $compositionIds = collect($purchases)->pluck("composition_id")
            ->merge(collect($submissions)->pluck("composition_id"))
            ->filter()->unique()->values()->all();

        $userIds = collect($purchases)->pluck("buyer_id")
            ->merge(collect($submissions)->pluck("buyer_id"))
            ->merge(collect($submissions)->pluck("reviewed_by"))
            ->filter()->unique()->values()->all();

        $compositionsById = DB::table("compositions")
            ->select("id", "title", "composer_id")
            ->whereIn("id", $compositionIds ?: ["00000000-0000-0000-0000-000000000000"])
            ->get()
            ->keyBy("id");

        $usersById = DB::table("users")
            ->select("id", "display_name", "email")
            ->whereIn("id", $userIds ?: ["00000000-0000-0000-0000-000000000000"])
            ->get()
            ->keyBy("id");

        $purchaseRows = collect($purchases)->map(function ($purchase) use ($compositionsById, $usersById) {
            return [
                ...((array) $purchase),
                "id" => "purchase:" . $purchase->id,
                "source" => "purchase",
                "transaction_kind" => "purchase",
                "transaction_id" => $purchase->id,
                "status" => "approved",
                "payment_ref" => $purchase->payment_ref,
                "purchased_at" => $purchase->purchased_at ?: $purchase->created_at,
                "compositions" => $purchase->composition_id ? $compositionsById->get($purchase->composition_id) : null,
                "buyers" => $purchase->buyer_id ? [
                    "id" => $purchase->buyer_id,
                    "user_id" => $purchase->buyer_id,
                    "users" => $usersById->get($purchase->buyer_id),
                ] : null,
                "can_approve" => false,
                "can_reject" => false,
            ];
        });

        $submissionRows = collect($submissions)->map(function ($submission) use ($compositionsById, $usersById) {
            return [
                ...((array) $submission),
                "id" => "submission:" . $submission->id,
                "source" => "payment_submission",
                "transaction_kind" => "manual_checkout",
                "transaction_id" => $submission->id,
                "payment_submission_id" => $submission->id,
                "price_paid" => (float) ($submission->amount ?? 0),
                "payment_ref" => $submission->mpesa_code,
                "purchased_at" => $submission->submitted_at ?: $submission->reviewed_at,
                "compositions" => $submission->composition_id ? $compositionsById->get($submission->composition_id) : null,
                "buyers" => $submission->buyer_id ? [
                    "id" => $submission->buyer_id,
                    "user_id" => $submission->buyer_id,
                    "users" => $usersById->get($submission->buyer_id),
                ] : null,
                "reviewer" => $submission->reviewed_by ? $usersById->get($submission->reviewed_by) : null,
                "can_approve" => $submission->status === "pending",
                "can_reject" => $submission->status === "pending",
            ];
        });

        $formatted = $submissionRows->merge($purchaseRows)
            ->sortByDesc(fn ($row) => strtotime((string) ($row["purchased_at"] ?? "1970-01-01")))
            ->take($limit)
            ->values();

        return response()->json($formatted);
    }

    public function enrollments(Request $request)
    {
        $status = strtolower(trim((string) $request->query("status", "all")));
        if (!in_array($status, ["all", "pending", "admitted", "rejected"], true)) {
            return response()->json([
                "message" => "status must be one of: all, pending, admitted, rejected",
            ], 400);
        }

        $query = DB::table("enrollments")
            ->select("id", "user_id", "full_name", "email", "music_class", "skill_level", "notes", "status", "admitted_by", "admitted_at", "created_at", "updated_at")
            ->orderByDesc("created_at")
            ->limit($this->parseLimit($request->query("limit"), 300, 1000));
        if ($status !== "all") {
            $query->where("status", $status);
        }
        $rows = $query->get();

        $userIds = collect($rows)->pluck("user_id")
            ->merge(collect($rows)->pluck("admitted_by"))
            ->filter()->unique()->values()->all();

        $usersById = DB::table("users")
            ->select("id", "email", "display_name", "avatar_url")
            ->whereIn("id", $userIds ?: ["00000000-0000-0000-0000-000000000000"])
            ->get()
            ->mapWithKeys(fn ($u) => [$u->id => AvatarUrl::withNormalizedAvatar((array) $u)]);

        $response = $rows->map(function ($row) use ($usersById) {
            return [
                ...((array) $row),
                "requester" => $row->user_id ? $usersById->get($row->user_id) : null,
                "admitted_admin" => $row->admitted_by ? $usersById->get($row->admitted_by) : null,
            ];
        })->values();

        return response()->json($response);
    }

    public function admitEnrollment(Request $request, string $enrollmentId)
    {
        if (trim($enrollmentId) === "") {
            return response()->json(["error" => "enrollmentId is required"], 400);
        }

        $adminUser = $this->resolveDbUser($request->attributes->get("authUid"));
        if (!$adminUser) {
            return response()->json(["error" => "Admin user not found"], 404);
        }

        $current = DB::table("enrollments")->where("id", $enrollmentId)->first();
        if (!$current) {
            return response()->json(["error" => "Enrollment not found"], 404);
        }
        if ($current->status === "admitted") {
            return response()->json([
                "success" => true,
                "alreadyAdmitted" => true,
                "enrollment" => $current,
            ]);
        }

        DB::table("enrollments")->where("id", $enrollmentId)->update([
            "status" => "admitted",
            "admitted_by" => $adminUser["id"],
            "admitted_at" => now(),
            "updated_at" => now(),
        ]);

        $updated = DB::table("enrollments")->where("id", $enrollmentId)->first();
        return response()->json([
            "success" => true,
            "message" => "Enrollment admitted",
            "enrollment" => [
                ...((array) $updated),
                "admitted_admin" => [
                    "id" => $adminUser["id"],
                    "email" => $adminUser["email"] ?? null,
                    "display_name" => $adminUser["display_name"] ?? null,
                ],
            ],
        ]);
    }

    public function invites()
    {
        return response()->json(DB::table("invites")->orderByDesc("created_at")->get());
    }

    public function composerRequests()
    {
        $requests = DB::table("role_requests")
            ->select("id", "user_id", "requested_role", "status", "requested_at")
            ->where("requested_role", "composer")
            ->orderByDesc("requested_at")
            ->get();

        $userIds = collect($requests)->pluck("user_id")->filter()->unique()->values()->all();
        $usersById = DB::table("users")
            ->select("id", "email", "display_name")
            ->whereIn("id", $userIds ?: ["00000000-0000-0000-0000-000000000000"])
            ->get()
            ->keyBy("id");

        $roleRows = DB::table("user_roles")
            ->join("roles", "roles.id", "=", "user_roles.role_id")
            ->whereIn("user_roles.user_id", $userIds ?: ["00000000-0000-0000-0000-000000000000"])
            ->select("user_roles.user_id", "roles.name")
            ->get();
        $rolesByUserId = [];
        foreach ($roleRows as $row) {
            $rolesByUserId[$row->user_id] ??= [];
            if (!in_array($row->name, $rolesByUserId[$row->user_id], true)) {
                $rolesByUserId[$row->user_id][] = $row->name;
            }
        }

        $formatted = $requests->map(function ($req) use ($usersById, $rolesByUserId) {
            $user = $usersById->get($req->user_id);
            return [
                "id" => $req->user_id,
                "request_id" => $req->id,
                "user_id" => $req->user_id,
                "email" => $user?->email,
                "display_name" => $user?->display_name,
                "displayName" => $user?->display_name,
                "requested_role" => $req->requested_role,
                "status" => $req->status,
                "created_at" => $req->requested_at,
                "roles" => $rolesByUserId[$req->user_id] ?? [],
            ];
        })->values();

        return response()->json($formatted);
    }

    public function stats()
    {
        $totalUsers = DB::table("users")->count();
        $totalCompositions = DB::table("compositions")->count();
        $purchases = DB::table("purchases")->select("price_paid")->get();
        $totalRevenue = collect($purchases)->reduce(fn ($sum, $p) => $sum + (float) ($p->price_paid ?? 0), 0.0);

        return response()->json([
            "totalUsers" => $totalUsers,
            "totalCompositions" => $totalCompositions,
            "totalRevenue" => $totalRevenue,
            "totalTransactions" => count($purchases),
        ]);
    }

    public function debugCompositions()
    {
        $rows = DB::table("compositions")
            ->select("id", "title", "composer_id", "deleted", "created_at")
            ->get();

        return response()->json([
            "total" => $rows->count(),
            "data" => $rows,
        ]);
    }

    public function createInvite(Request $request)
    {
        $email = strtolower(trim((string) $request->input("email", "")));
        if ($email === "") {
            return response()->json(["error" => "Email is required"], 400);
        }

        $requestedRole = strtolower(trim((string) $request->input("requestedRole", "composer"))) === "admin"
            ? "admin"
            : "composer";

        $id = (string) Str::uuid();
        $payload = [
            "id" => $id,
            "email" => $email,
            "invited_by" => $request->input("invited_by"),
            "created_at" => now(),
            "used" => false,
        ];
        if ($this->hasInviteRequestedRoleColumn()) {
            $payload["requested_role"] = $requestedRole;
        }

        DB::table("invites")->insert($payload);

        return response()->json(DB::table("invites")->where("id", $id)->first(), 201);
    }

    public function revokeInvite(string $email)
    {
        $normalized = strtolower(trim(urldecode($email)));
        DB::table("invites")->where("email", $normalized)->delete();
        return response()->json(["success" => true, "message" => "Invite revoked"]);
    }

    public function promoteComposer(string $userIdentifier)
    {
        $user = $this->resolveDbUser($userIdentifier);
        if (!$user) {
            return response()->json(["error" => "User not found"], 404);
        }

        DB::table("role_requests")
            ->where("user_id", $user["id"])
            ->where("requested_role", "composer")
            ->where("status", "pending")
            ->update(["status" => "approved"]);

        DB::table("users")->where("id", $user["id"])->update([
            "composer_request" => false,
            "updated_at" => now(),
        ]);

        $composerRole = DB::table("roles")->where("name", "composer")->first();
        if ($composerRole) {
            DB::table("user_roles")->updateOrInsert(
                [
                    "user_id" => $user["id"],
                    "role_id" => $composerRole->id,
                ],
                [
                    "assigned_at" => now(),
                ]
            );
        }

        $composerProfile = null;
        $activationColumnMissing = false;
        try {
            $composerProfile = DB::table("composers")
                ->where("user_id", $user["id"])
                ->select("id", "is_active")
                ->first();
        } catch (\Throwable $e) {
            if ($this->isComposerActivationColumnMissing()) {
                $activationColumnMissing = true;
                $composerProfile = DB::table("composers")
                    ->where("user_id", $user["id"])
                    ->select("id")
                    ->first();
            } else {
                throw $e;
            }
        }

        if ($composerProfile && !$activationColumnMissing && (bool) ($composerProfile->is_active ?? true) === false) {
            DB::table("composers")
                ->where("id", $composerProfile->id)
                ->update([
                    "is_active" => true,
                    "updated_at" => now(),
                ]);
        }

        if (!$composerProfile) {
            $payload = [
                "id" => (string) Str::uuid(),
                "user_id" => $user["id"],
                "created_at" => now(),
            ];
            if (!$activationColumnMissing) {
                $payload["is_active"] = true;
            }
            DB::table("composers")->insert($payload);
        }

        return response()->json(["success" => true, "message" => "User promoted to composer"]);
    }

    public function promoteAdmin(string $userIdentifier)
    {
        $user = $this->resolveDbUser($userIdentifier);
        if (!$user) {
            return response()->json(["error" => "User not found"], 404);
        }

        $adminRole = DB::table("roles")->where("name", "admin")->first();
        if ($adminRole) {
            DB::table("user_roles")->updateOrInsert(
                [
                    "user_id" => $user["id"],
                    "role_id" => $adminRole->id,
                ],
                [
                    "assigned_at" => now(),
                ]
            );
        }

        DB::table("role_requests")
            ->where("user_id", $user["id"])
            ->where("requested_role", "admin")
            ->where("status", "pending")
            ->update(["status" => "approved"]);

        return response()->json(["success" => true, "message" => "User promoted to admin"]);
    }

    public function demoteComposer(string $userIdentifier)
    {
        $user = $this->resolveDbUser($userIdentifier);
        if (!$user) {
            return response()->json(["error" => "User not found"], 404);
        }

        $activationColumnMissing = false;
        $composerProfile = null;
        try {
            $composerProfile = DB::table("composers")
                ->where("user_id", $user["id"])
                ->select("id", "is_active")
                ->first();
        } catch (\Throwable $e) {
            if ($this->isComposerActivationColumnMissing()) {
                $activationColumnMissing = true;
                $composerProfile = DB::table("composers")
                    ->where("user_id", $user["id"])
                    ->select("id")
                    ->first();
            } else {
                throw $e;
            }
        }

        if ($composerProfile && $activationColumnMissing) {
            return response()->json([
                "message" => "Composer activation column is missing. Run migration 027_add_composers_is_active.sql, then retry.",
            ], 500);
        }

        $composerRole = DB::table("roles")->where("name", "composer")->first();
        if ($composerRole) {
            DB::table("user_roles")
                ->where("user_id", $user["id"])
                ->where("role_id", $composerRole->id)
                ->delete();
        }

        if ($composerProfile && !$activationColumnMissing) {
            DB::table("composers")
                ->where("id", $composerProfile->id)
                ->update([
                    "is_active" => false,
                    "updated_at" => now(),
                ]);
        }

        return response()->json([
            "success" => true,
            "message" => "Composer access removed",
            "userId" => $user["id"],
        ]);
    }

    public function demoteAdmin(string $userIdentifier)
    {
        $user = $this->resolveDbUser($userIdentifier);
        if (!$user) {
            return response()->json(["error" => "User not found"], 404);
        }

        $normalizedEmail = strtolower(trim((string) ($user["email"] ?? "")));
        if ($this->isProtectedAdminIdentifier($normalizedEmail)) {
            return response()->json([
                "error" => "This admin is protected by the server allowlist and cannot be depromoted here.",
            ], 403);
        }

        $adminRole = DB::table("roles")->where("name", "admin")->first();
        if ($adminRole) {
            DB::table("user_roles")
                ->where("user_id", $user["id"])
                ->where("role_id", $adminRole->id)
                ->delete();
        }

        if ($normalizedEmail !== "") {
            DB::table("admin_emails")
                ->whereRaw("LOWER(email) = ?", [$normalizedEmail])
                ->where("is_active", true)
                ->update(["is_active" => false]);
        }

        return response()->json([
            "success" => true,
            "message" => "Admin access removed",
            "userId" => $user["id"],
        ]);
    }

    public function suspend(string $userIdentifier)
    {
        $user = $this->resolveDbUser($userIdentifier);
        if (!$user) {
            return response()->json(["error" => "User not found"], 404);
        }

        DB::table("users")->where("id", $user["id"])->update([
            "is_active" => false,
            "updated_at" => now(),
        ]);

        return response()->json(["success" => true, "message" => "User suspended"]);
    }

    public function unsuspend(string $userIdentifier)
    {
        $user = $this->resolveDbUser($userIdentifier);
        if (!$user) {
            return response()->json(["error" => "User not found"], 404);
        }

        DB::table("users")->where("id", $user["id"])->update([
            "is_active" => true,
            "updated_at" => now(),
        ]);

        return response()->json(["success" => true, "message" => "User unsuspended"]);
    }

    public function deleteUser(string $userIdentifier)
    {
        $user = $this->resolveDbUser($userIdentifier);
        if (!$user) {
            return response()->json(["error" => "User not found"], 404);
        }

        $normalizedEmail = strtolower(trim((string) ($user["email"] ?? "")));

        DB::table("composers")->where("user_id", $user["id"])->delete();
        DB::table("user_roles")->where("user_id", $user["id"])->delete();
        DB::table("role_requests")->where("user_id", $user["id"])->delete();

        if ($normalizedEmail !== "") {
            DB::table("admin_emails")
                ->whereRaw("LOWER(email) = ?", [$normalizedEmail])
                ->where("is_active", true)
                ->update(["is_active" => false]);
        }

        DB::table("users")->where("id", $user["id"])->delete();

        $this->deleteSupabaseAuthUser($user["auth_uid"] ?? null);

        return response()->json([
            "success" => true,
            "message" => "User deleted",
            "userId" => $user["id"],
        ]);
    }

    public function rejectComposerRequest(string $userIdentifier)
    {
        $user = $this->resolveDbUser($userIdentifier);
        $userId = $user["id"] ?? trim($userIdentifier);
        if ($userId === "") {
            return response()->json(["error" => "Invalid user id"], 400);
        }

        DB::table("role_requests")
            ->where("user_id", $userId)
            ->where("requested_role", "composer")
            ->where("status", "pending")
            ->update(["status" => "rejected"]);

        if ($user) {
            DB::table("users")->where("id", $user["id"])->update([
                "composer_request" => false,
                "updated_at" => now(),
            ]);
        }

        return response()->json(["success" => true, "message" => "Composer request rejected"]);
    }

    public function rejectRoleRequest(Request $request, string $userIdentifier)
    {
        $requestedRole = strtolower(trim((string) $request->input("requestedRole", "composer"))) === "admin"
            ? "admin"
            : "composer";
        $user = $this->resolveDbUser($userIdentifier);
        $userId = $user["id"] ?? trim($userIdentifier);
        if ($userId === "") {
            return response()->json(["error" => "Invalid user id"], 400);
        }

        DB::table("role_requests")
            ->where("user_id", $userId)
            ->where("requested_role", $requestedRole)
            ->where("status", "pending")
            ->update(["status" => "rejected"]);

        if ($requestedRole === "composer" && $user) {
            DB::table("users")->where("id", $user["id"])->update([
                "composer_request" => false,
                "updated_at" => now(),
            ]);
        }

        return response()->json([
            "success" => true,
            "message" => "{$requestedRole} request rejected",
        ]);
    }

    public function approvePaymentSubmission(Request $request, string $submissionId)
    {
        $adminNotes = trim((string) $request->input("adminNotes", ""));
        $reviewer = $this->resolveDbUser($request->attributes->get("authUid"));
        if (!$reviewer) {
            return response()->json(["error" => "Reviewer user not found"], 404);
        }

        $submission = DB::table("payment_submissions")->where("id", $submissionId)->first();
        if (!$submission) {
            return response()->json(["error" => "Payment submission not found"], 404);
        }
        if ($submission->status === "approved") {
            return response()->json([
                "success" => true,
                "alreadyApproved" => true,
                "submission" => $submission,
            ]);
        }
        if ($submission->status === "rejected") {
            return response()->json(["error" => "Rejected submissions cannot be approved"], 409);
        }

        $existingPurchase = DB::table("purchases")
            ->where("buyer_id", $submission->buyer_id)
            ->where("composition_id", $submission->composition_id)
            ->where("is_active", true)
            ->first();

        $purchase = $existingPurchase ? (array) $existingPurchase : null;
        if (!$purchase) {
            $purchase = $this->insertPurchaseWithFallback([
                "buyer_id" => $submission->buyer_id,
                "composition_id" => $submission->composition_id,
                "price_paid" => (float) ($submission->amount ?? 0),
                "payment_ref" => $submission->mpesa_code ?: null,
                "purchased_at" => now(),
                "is_active" => true,
            ]);
        }

        DB::table("payment_submissions")->where("id", $submissionId)->update([
            "status" => "approved",
            "purchase_id" => $purchase["id"] ?? null,
            "reviewed_by" => $reviewer["id"],
            "reviewed_at" => now(),
            "admin_notes" => $adminNotes !== "" ? $adminNotes : null,
            "updated_at" => now(),
        ]);

        $stats = DB::table("composition_stats")->where("composition_id", $submission->composition_id)->first();
        if ($stats) {
            DB::table("composition_stats")->where("composition_id", $submission->composition_id)->update([
                "purchases" => ((int) ($stats->purchases ?? 0)) + 1,
                "last_updated" => now(),
            ]);
        } else {
            DB::table("composition_stats")->insert([
                "composition_id" => $submission->composition_id,
                "views" => 0,
                "purchases" => 1,
                "last_updated" => now(),
            ]);
        }

        $updatedSubmission = DB::table("payment_submissions")->where("id", $submissionId)->first();
        return response()->json([
            "success" => true,
            "message" => "Payment submission approved",
            "submission" => $updatedSubmission,
            "purchase" => $purchase,
        ]);
    }

    public function rejectPaymentSubmission(Request $request, string $submissionId)
    {
        $adminNotes = trim((string) $request->input("adminNotes", ""));
        $reviewer = $this->resolveDbUser($request->attributes->get("authUid"));
        if (!$reviewer) {
            return response()->json(["error" => "Reviewer user not found"], 404);
        }

        $submission = DB::table("payment_submissions")->where("id", $submissionId)->first();
        if (!$submission) {
            return response()->json(["error" => "Payment submission not found"], 404);
        }
        if ($submission->status === "approved") {
            return response()->json(["error" => "Approved submissions cannot be rejected"], 409);
        }

        DB::table("payment_submissions")->where("id", $submissionId)->update([
            "status" => "rejected",
            "reviewed_by" => $reviewer["id"],
            "reviewed_at" => now(),
            "admin_notes" => $adminNotes !== "" ? $adminNotes : null,
            "updated_at" => now(),
        ]);

        $updated = DB::table("payment_submissions")->where("id", $submissionId)->first();
        return response()->json([
            "success" => true,
            "message" => "Payment submission rejected",
            "submission" => $updated,
        ]);
    }

    public function verifyComposition(Request $request, string $compositionId)
    {
        if (trim($compositionId) === "") {
            return response()->json(["error" => "compositionId is required"], 400);
        }
        if (!$this->hasCompositionVerificationColumns()) {
            return response()->json([
                "error" => "Composition verification columns are missing.",
            ], 500);
        }

        $reviewer = $this->resolveDbUser($request->attributes->get("authUid"));
        if (!$reviewer?["id"]) {
            return response()->json(["error" => "Admin user not found"], 404);
        }

        $verificationNotes = trim((string) $request->input("verificationNotes", ""));
        DB::table("compositions")
            ->where("id", $compositionId)
            ->update([
                "is_verified" => true,
                "verified_at" => now(),
                "verified_by" => $reviewer["id"],
                "verification_notes" => $verificationNotes !== "" ? $verificationNotes : null,
                "updated_at" => now(),
            ]);

        $composition = DB::table("compositions")->where("id", $compositionId)->first();
        if (!$composition) {
            return response()->json(["error" => "Composition not found"], 404);
        }

        return response()->json([
            "success" => true,
            "message" => "Composition verified",
            "composition" => $composition,
        ]);
    }

    public function unverifyComposition(Request $request, string $compositionId)
    {
        if (trim($compositionId) === "") {
            return response()->json(["error" => "compositionId is required"], 400);
        }
        if (!$this->hasCompositionVerificationColumns()) {
            return response()->json([
                "error" => "Composition verification columns are missing.",
            ], 500);
        }

        $reason = trim((string) $request->input("reason", ""));
        DB::table("compositions")
            ->where("id", $compositionId)
            ->update([
                "is_verified" => false,
                "verified_at" => null,
                "verified_by" => null,
                "verification_notes" => $reason !== "" ? $reason : null,
                "updated_at" => now(),
            ]);

        $composition = DB::table("compositions")->where("id", $compositionId)->first();
        if (!$composition) {
            return response()->json(["error" => "Composition not found"], 404);
        }

        return response()->json([
            "success" => true,
            "message" => "Composition marked unverified",
            "composition" => $composition,
        ]);
    }

    public function registrationRegulations(Request $request)
    {
        try {
            $context = $this->requireRegulationsController($request);
            if ($context instanceof \Illuminate\Http\JsonResponse) {
                return $context;
            }

            return response()->json(
                $this->registrationPayments->formatPublicRegulations($context["regulations"])
            );
        } catch (\Throwable $e) {
            if ($this->registrationPayments->isMissingRegistrationTablesError($e)) {
                return response()->json([
                    "message" => $this->registrationPayments->missingRegistrationTablesMessage(),
                ], 500);
            }

            throw $e;
        }
    }

    public function updateRegistrationRegulations(Request $request)
    {
        try {
            $context = $this->requireRegulationsController($request);
            if ($context instanceof \Illuminate\Http\JsonResponse) {
                return $context;
            }

            DB::table("registration_regulations")
                ->where("is_active", true)
                ->update(["is_active" => false]);

            DB::table("registration_regulations")->insert([
                "id" => (string) Str::uuid(),
                "enrollment_fee" => (float) $request->input("enrollmentFee", 0),
                "composer_request_fee" => (float) $request->input("composerRequestFee", 0),
                "bank_name" => trim((string) $request->input("bankName", "I&M Bank")),
                "bank_account_number" => trim((string) $request->input("bankAccountNumber", "0030 7335 5161 50")),
                "account_name" => trim((string) $request->input("accountName", "Murekefu Music Hub")),
                "controlling_admin_identifier" => $context["controllingIdentifier"],
                "is_active" => true,
                "updated_at" => now(),
            ]);

            $regulations = $this->registrationPayments->ensureActiveRegistrationRegulations();
            return response()->json([
                "success" => true,
                "regulations" => $this->registrationPayments->formatPublicRegulations($regulations),
            ]);
        } catch (\Throwable $e) {
            if ($this->registrationPayments->isMissingRegistrationTablesError($e)) {
                return response()->json([
                    "message" => $this->registrationPayments->missingRegistrationTablesMessage(),
                ], 500);
            }

            throw $e;
        }
    }

    public function registrationPayments(Request $request)
    {
        try {
            $status = strtolower(trim((string) $request->query("status", "all")));
            $type = $this->registrationPayments->normalizeRegistrationType($request->query("type"));
            $limit = $this->parseLimit($request->query("limit"), 200, 1000);

            $query = DB::table("registration_payment_submissions")
                ->orderByDesc("submitted_at")
                ->limit($limit);

            if (in_array($status, ["pending", "approved", "rejected"], true)) {
                $query->where("status", $status);
            }
            if ($type) {
                $query->where("registration_type", $type);
            }

            $rows = $query->get();
            $userIds = collect($rows)
                ->pluck("requester_id")
                ->merge(collect($rows)->pluck("reviewed_by"))
                ->filter()
                ->unique()
                ->values()
                ->all();

            $usersById = DB::table("users")
                ->select("id", "email", "display_name", "avatar_url")
                ->whereIn("id", $userIds ?: ["00000000-0000-0000-0000-000000000000"])
                ->get()
                ->mapWithKeys(fn ($user) => [$user->id => (array) $user])
                ->all();

            $formatted = $rows->map(fn ($submission) => $this->formatRegistrationPaymentSubmission($submission, $usersById))
                ->values();

            return response()->json($formatted);
        } catch (\Throwable $e) {
            if ($this->registrationPayments->isMissingRegistrationTablesError($e)) {
                return response()->json([
                    "message" => $this->registrationPayments->missingRegistrationTablesMessage(),
                ], 500);
            }

            throw $e;
        }
    }

    public function approveRegistrationPayment(Request $request, string $submissionId)
    {
        try {
            $reviewer = $this->resolveDbUser($request->attributes->get("authUid"));
            if (!$reviewer?["id"]) {
                return response()->json(["error" => "Reviewer user not found"], 404);
            }

            $submission = DB::table("registration_payment_submissions")->where("id", $submissionId)->first();
            if (!$submission) {
                return response()->json(["error" => "Registration payment not found"], 404);
            }

            DB::table("registration_payment_submissions")->where("id", $submissionId)->update([
                "status" => "approved",
                "reviewed_by" => $reviewer["id"],
                "reviewed_at" => now(),
                "admin_notes" => trim((string) $request->input("adminNotes", "")) ?: null,
                "updated_at" => now(),
            ]);

            $updated = DB::table("registration_payment_submissions")->where("id", $submissionId)->first();
            return response()->json([
                "success" => true,
                "message" => "Registration payment approved",
                "submission" => $updated,
            ]);
        } catch (\Throwable $e) {
            if ($this->registrationPayments->isMissingRegistrationTablesError($e)) {
                return response()->json([
                    "message" => $this->registrationPayments->missingRegistrationTablesMessage(),
                ], 500);
            }

            throw $e;
        }
    }

    public function rejectRegistrationPayment(Request $request, string $submissionId)
    {
        try {
            $reviewer = $this->resolveDbUser($request->attributes->get("authUid"));
            if (!$reviewer?["id"]) {
                return response()->json(["error" => "Reviewer user not found"], 404);
            }

            $submission = DB::table("registration_payment_submissions")->where("id", $submissionId)->first();
            if (!$submission) {
                return response()->json(["error" => "Registration payment not found"], 404);
            }

            DB::table("registration_payment_submissions")->where("id", $submissionId)->update([
                "status" => "rejected",
                "reviewed_by" => $reviewer["id"],
                "reviewed_at" => now(),
                "admin_notes" => trim((string) $request->input("adminNotes", "")) ?: null,
                "updated_at" => now(),
            ]);

            $updated = DB::table("registration_payment_submissions")->where("id", $submissionId)->first();
            return response()->json([
                "success" => true,
                "message" => "Registration payment rejected",
                "submission" => $updated,
            ]);
        } catch (\Throwable $e) {
            if ($this->registrationPayments->isMissingRegistrationTablesError($e)) {
                return response()->json([
                    "message" => $this->registrationPayments->missingRegistrationTablesMessage(),
                ], 500);
            }

            throw $e;
        }
    }

    public function notifications()
    {
        $invites = DB::table("invites")
            ->where("used", false)
            ->orderByDesc("created_at")
            ->limit(50)
            ->get();
        $roleRequests = DB::table("role_requests")
            ->where("status", "pending")
            ->orderByDesc("requested_at")
            ->limit(50)
            ->get();
        $paymentRequests = DB::table("payment_submissions")
            ->where("status", "pending")
            ->orderByDesc("submitted_at")
            ->limit(50)
            ->get();

        $roleUserIdentifiers = collect($roleRequests)->pluck("user_id")->filter()->values()->all();
        $paymentBuyerIds = collect($paymentRequests)->pluck("buyer_id")->filter()->values()->all();
        $identifiers = array_values(array_unique([...$roleUserIdentifiers, ...$paymentBuyerIds]));

        $usersById = [];
        $usersByAuthUid = [];
        if (count($identifiers) > 0) {
            $usersByIdRows = DB::table("users")
                ->select("id", "auth_uid", "email", "display_name")
                ->whereIn("id", $identifiers)
                ->get();
            $usersByAuthRows = DB::table("users")
                ->select("id", "auth_uid", "email", "display_name")
                ->whereIn("auth_uid", $identifiers)
                ->get();
            $merged = collect($usersByIdRows)->merge($usersByAuthRows);
            foreach ($merged as $user) {
                $usersById[$user->id] = $user;
                if ($user->auth_uid) {
                    $usersByAuthUid[$user->auth_uid] = $user;
                }
            }
        }

        $resolvedUserIds = array_values(array_unique(array_map(fn ($u) => $u->id, $usersById)));
        $rolesByUserId = [];
        if (count($resolvedUserIds) > 0) {
            $roleRows = DB::table("user_roles")
                ->join("roles", "roles.id", "=", "user_roles.role_id")
                ->whereIn("user_roles.user_id", $resolvedUserIds)
                ->select("user_roles.user_id", "roles.name")
                ->get();
            foreach ($roleRows as $row) {
                $rolesByUserId[$row->user_id] ??= [];
                if (!in_array($row->name, $rolesByUserId[$row->user_id], true)) {
                    $rolesByUserId[$row->user_id][] = $row->name;
                }
            }
        }

        $items = [];
        foreach ($invites as $invite) {
            $items[] = [
                "id" => "invite:" . $invite->id,
                "type" => "invite",
                "email" => $invite->email,
                "invitedBy" => $invite->invited_by,
                "createdAt" => $invite->created_at,
                "used" => $invite->used,
            ];
        }

        foreach ($roleRequests as $req) {
            $user = $usersById[$req->user_id] ?? ($usersByAuthUid[$req->user_id] ?? null);
            $resolvedUserId = $user?->id ?: $req->user_id;
            $displayName = $user?->display_name ?: ($user?->email ?: ("User (" . substr((string) $req->user_id, 0, 8) . "...)"));
            $items[] = [
                "id" => "request:" . $req->id,
                "type" => "request",
                "userId" => $resolvedUserId,
                "requestUserId" => $req->user_id,
                "canApprove" => (bool) $user?->id,
                "email" => $user?->email,
                "displayName" => $displayName,
                "requestedRole" => $req->requested_role,
                "status" => $req->status,
                "createdAt" => $req->requested_at,
                "created_at" => $req->requested_at,
                "roles" => $user?->id ? ($rolesByUserId[$user->id] ?? []) : [],
            ];
        }

        foreach ($paymentRequests as $paymentReq) {
            $user = $usersById[$paymentReq->buyer_id] ?? null;
            $items[] = [
                "id" => "payment:" . $paymentReq->id,
                "type" => "payment_request",
                "submissionId" => $paymentReq->id,
                "userId" => $paymentReq->buyer_id,
                "email" => $user?->email,
                "displayName" => $user?->display_name ?: ($user?->email ?: ("User (" . substr((string) $paymentReq->buyer_id, 0, 8) . "...)")),
                "amount" => (float) ($paymentReq->amount ?? 0),
                "mpesaCode" => $paymentReq->mpesa_code,
                "requestedRole" => null,
                "status" => $paymentReq->status,
                "createdAt" => $paymentReq->submitted_at,
                "created_at" => $paymentReq->submitted_at,
            ];
        }

        return response()->json($items);
    }
}











