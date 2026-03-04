<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RoleService;
use App\Support\AvatarUrl;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SupportController extends Controller
{
    private const OPEN_TICKET_STATUSES = ["pending", "open", "active"];
    private const CLOSED_TICKET_STATUSES = ["expired", "rejected", "deleted", "resolved"];
    private const TICKET_LIFETIME_DAYS = 30;
    private const TICKET_REJECTED_MESSAGE = "Your ticket was rejected by all available admins. Please open a new ticket if you still need help.";
    private const TICKET_EXPIRED_MESSAGE = "This ticket expired after 30 days. Please open a new ticket if your issue is still unresolved.";

    public function __construct(private readonly RoleService $roleService)
    {
    }

    private function normalizeText(mixed $value, int $max = 2000): string
    {
        return mb_substr(trim((string) ($value ?? "")), 0, $max);
    }

    private function parseLimit(mixed $raw, int $fallback = 50, int $max = 500): int
    {
        $n = (int) $raw;
        if ($n <= 0) {
            return $fallback;
        }
        return min($n, $max);
    }

    private function isOpenStatus(?string $status): bool
    {
        return in_array(strtolower((string) $status), self::OPEN_TICKET_STATUSES, true);
    }

    private function isClosedStatus(?string $status): bool
    {
        return in_array(strtolower((string) $status), self::CLOSED_TICKET_STATUSES, true);
    }

    private function authUser(Request $request): ?array
    {
        $authUid = (string) $request->attributes->get("authUid", "");
        $user = $this->roleService->resolveDbUserByAuthUid($authUid);
        if (!$user) {
            return null;
        }
        return AvatarUrl::withNormalizedAvatar($user);
    }

    private function isAdminUser(array $user): bool
    {
        return $this->roleService->isAdminUser((string) $user["id"], $user["email"] ?? null);
    }

    private function mapThread(array $thread, ?array $requester = null, int $rejectionCount = 0): array
    {
        return [
            "id" => $thread["id"],
            "requester_user_id" => $thread["requester_user_id"],
            "subject" => $thread["subject"],
            "context" => $thread["context"],
            "status" => $thread["status"],
            "is_admin_unread" => (bool) ($thread["is_admin_unread"] ?? false),
            "is_user_unread" => (bool) ($thread["is_user_unread"] ?? false),
            "last_message_preview" => $thread["last_message_preview"] ?? "",
            "last_sender_role" => $thread["last_sender_role"] ?? null,
            "last_message_at" => $thread["last_message_at"] ?? null,
            "deleted_by_admin" => (bool) ($thread["deleted_by_admin"] ?? false),
            "assigned_admin_user_id" => $thread["assigned_admin_user_id"] ?? null,
            "assigned_at" => $thread["assigned_at"] ?? null,
            "expires_at" => $thread["expires_at"] ?? null,
            "ticket_rejection_count" => $rejectionCount,
            "is_closed" => $this->isClosedStatus((string) ($thread["status"] ?? "")),
            "created_at" => $thread["created_at"] ?? null,
            "updated_at" => $thread["updated_at"] ?? null,
            "requester" => $requester,
        ];
    }

    private function getThreadById(string $threadId): ?array
    {
        $thread = DB::table("support_chat_threads")->where("id", $threadId)->first();
        return $thread ? (array) $thread : null;
    }

    private function canAccessThread(array $thread, array $user, bool $admin): bool
    {
        if (($thread["deleted_by_admin"] ?? false) === true) {
            return false;
        }

        if ($admin) {
            return ($thread["assigned_admin_user_id"] ?? null) === $user["id"];
        }

        return ($thread["requester_user_id"] ?? null) === $user["id"];
    }

    private function loadRequesterMap(array $rows): array
    {
        $requesterIds = collect($rows)->pluck("requester_user_id")->filter()->unique()->values()->all();
        if (count($requesterIds) === 0) {
            return [];
        }

        $users = DB::table("users")
            ->select("id", "email", "display_name", "avatar_url")
            ->whereIn("id", $requesterIds)
            ->get();

        $map = [];
        foreach ($users as $user) {
            $map[$user->id] = AvatarUrl::withNormalizedAvatar((array) $user);
        }
        return $map;
    }

    private function rejectionCountMap(array $threadIds): array
    {
        if (count($threadIds) === 0) {
            return [];
        }
        $rows = DB::table("support_chat_rejections")
            ->select("thread_id")
            ->whereIn("thread_id", $threadIds)
            ->get();
        $map = [];
        foreach ($rows as $row) {
            $id = (string) $row->thread_id;
            $map[$id] = (int) ($map[$id] ?? 0) + 1;
        }
        return $map;
    }

    private function activeAdminUserIds(): array
    {
        $roleAdmins = DB::table("user_roles")
            ->join("roles", "roles.id", "=", "user_roles.role_id")
            ->join("users", "users.id", "=", "user_roles.user_id")
            ->where("roles.name", "admin")
            ->where("users.is_active", "!=", false)
            ->pluck("user_roles.user_id")
            ->toArray();

        $emailAdmins = DB::table("admin_emails")
            ->where("is_active", true)
            ->pluck("email")
            ->map(fn ($x) => strtolower(trim((string) $x)))
            ->filter()
            ->values()
            ->all();

        $emailAdminIds = [];
        if (count($emailAdmins) > 0) {
            $emailAdminIds = DB::table("users")
                ->whereIn(DB::raw("LOWER(email)"), $emailAdmins)
                ->where("is_active", "!=", false)
                ->pluck("id")
                ->toArray();
        }

        return array_values(array_unique([...$roleAdmins, ...$emailAdminIds]));
    }

    private function expireOverdueTickets(): void
    {
        $now = now();
        $overdueRows = DB::table("support_chat_threads")
            ->select("id")
            ->where("deleted_by_admin", false)
            ->whereIn("status", self::OPEN_TICKET_STATUSES)
            ->where("expires_at", "<", $now)
            ->limit(1000)
            ->get();

        if ($overdueRows->isEmpty()) {
            return;
        }

        $ids = $overdueRows->pluck("id")->values()->all();
        DB::table("support_chat_threads")
            ->whereIn("id", $ids)
            ->whereIn("status", self::OPEN_TICKET_STATUSES)
            ->update([
                "status" => "expired",
                "is_admin_unread" => false,
                "is_user_unread" => true,
                "last_sender_role" => "admin",
                "last_message_preview" => self::TICKET_EXPIRED_MESSAGE,
                "last_message_at" => $now,
                "updated_at" => $now,
            ]);

        $messages = [];
        foreach ($ids as $id) {
            $messages[] = [
                "id" => (string) \Illuminate\Support\Str::uuid(),
                "thread_id" => $id,
                "sender_user_id" => null,
                "sender_role" => "admin",
                "message" => self::TICKET_EXPIRED_MESSAGE,
                "created_at" => $now,
            ];
        }
        DB::table("support_chat_messages")->insert($messages);
    }

    private function createThreadWithInitialMessage(array $payload): array
    {
        $now = now();
        $subject = $this->normalizeText($payload["subject"] ?? "", 160) ?: "Support Request";
        $message = $this->normalizeText($payload["message"] ?? "", 4000);
        $context = $this->normalizeText($payload["context"] ?? "", 120) ?: "dashboard";
        if ($message === "") {
            throw new \InvalidArgumentException("Issue message is required");
        }

        $threadId = (string) \Illuminate\Support\Str::uuid();
        DB::table("support_chat_threads")->insert([
            "id" => $threadId,
            "requester_user_id" => $payload["requesterUserId"],
            "subject" => $subject,
            "context" => $context,
            "status" => "pending",
            "assigned_admin_user_id" => null,
            "assigned_at" => null,
            "expires_at" => now()->addDays(self::TICKET_LIFETIME_DAYS),
            "is_admin_unread" => true,
            "is_user_unread" => false,
            "last_message_preview" => mb_substr($message, 0, 500),
            "last_sender_role" => "member",
            "last_message_at" => $now,
            "deleted_by_admin" => false,
            "created_at" => $now,
            "updated_at" => $now,
        ]);

        $messageId = (string) \Illuminate\Support\Str::uuid();
        DB::table("support_chat_messages")->insert([
            "id" => $messageId,
            "thread_id" => $threadId,
            "sender_user_id" => $payload["requesterUserId"],
            "sender_role" => "member",
            "message" => $message,
            "created_at" => $now,
        ]);

        $thread = (array) DB::table("support_chat_threads")->where("id", $threadId)->first();
        $insertedMessage = (array) DB::table("support_chat_messages")->where("id", $messageId)->first();
        return [$thread, $insertedMessage];
    }

    public function issues(Request $request)
    {
        $user = $this->authUser($request);
        if (!$user) {
            return response()->json(["message" => "User profile not found"], 404);
        }

        try {
            [$thread] = $this->createThreadWithInitialMessage([
                "requesterUserId" => $user["id"],
                "subject" => $request->input("subject"),
                "message" => $request->input("message"),
                "context" => $request->input("context"),
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(["message" => $e->getMessage()], 400);
        }

        return response()->json([
            "success" => true,
            "message" => "Support issue submitted successfully",
            "issueId" => $thread["id"],
            "threadId" => $thread["id"],
        ], 201);
    }

    public function createThread(Request $request)
    {
        $user = $this->authUser($request);
        if (!$user) {
            return response()->json(["message" => "User profile not found"], 404);
        }

        try {
            [$thread, $message] = $this->createThreadWithInitialMessage([
                "requesterUserId" => $user["id"],
                "subject" => $request->input("subject"),
                "message" => $request->input("message"),
                "context" => $request->input("context"),
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(["message" => $e->getMessage()], 400);
        }

        return response()->json([
            "success" => true,
            "thread" => $this->mapThread($thread),
            "message" => $message,
        ], 201);
    }

    public function myThreads(Request $request)
    {
        $this->expireOverdueTickets();
        $user = $this->authUser($request);
        if (!$user) {
            return response()->json(["message" => "User profile not found"], 404);
        }

        $rows = DB::table("support_chat_threads")
            ->where("requester_user_id", $user["id"])
            ->where("deleted_by_admin", false)
            ->orderByDesc("last_message_at")
            ->limit($this->parseLimit($request->query("limit"), 100, 500))
            ->get()
            ->map(fn ($row) => (array) $row)
            ->all();

        $ids = array_values(array_filter(array_map(fn ($row) => $row["id"] ?? null, $rows)));
        $rejectionMap = $this->rejectionCountMap($ids);

        $response = array_map(function ($row) use ($rejectionMap) {
            return $this->mapThread($row, null, (int) ($rejectionMap[$row["id"]] ?? 0));
        }, $rows);

        return response()->json($response);
    }

    public function threadMessages(Request $request, string $threadId)
    {
        $this->expireOverdueTickets();
        $user = $this->authUser($request);
        if (!$user) {
            return response()->json(["message" => "User profile not found"], 404);
        }

        $thread = $this->getThreadById($threadId);
        if (!$thread) {
            return response()->json(["message" => "Thread not found"], 404);
        }

        $admin = $this->isAdminUser($user);
        if (!$this->canAccessThread($thread, $user, $admin)) {
            $message = $admin ? "Access denied. Pick the ticket first or ask the assigned admin." : "Access denied";
            return response()->json(["message" => $message], 403);
        }

        $messages = DB::table("support_chat_messages")
            ->where("thread_id", $threadId)
            ->orderBy("created_at")
            ->limit(2000)
            ->get();

        return response()->json([
            "thread" => $this->mapThread($thread),
            "messages" => $messages,
            "admin" => $admin,
        ]);
    }

    public function sendMessage(Request $request, string $threadId)
    {
        $this->expireOverdueTickets();
        $user = $this->authUser($request);
        if (!$user) {
            return response()->json(["message" => "User profile not found"], 404);
        }

        $thread = $this->getThreadById($threadId);
        if (!$thread) {
            return response()->json(["message" => "Thread not found"], 404);
        }

        $admin = $this->isAdminUser($user);
        if (!$this->canAccessThread($thread, $user, $admin)) {
            $message = $admin ? "Access denied. Pick the ticket first or ask the assigned admin." : "Access denied";
            return response()->json(["message" => $message], 403);
        }

        if ($this->isClosedStatus((string) ($thread["status"] ?? ""))) {
            return response()->json([
                "message" => "This ticket is closed. Start a new ticket to continue.",
            ], 409);
        }

        $message = $this->normalizeText($request->input("message"), 4000);
        if ($message === "") {
            return response()->json(["message" => "Message is required"], 400);
        }

        $senderRole = $admin ? "admin" : "member";
        $now = now();
        $messageId = (string) \Illuminate\Support\Str::uuid();

        DB::table("support_chat_messages")->insert([
            "id" => $messageId,
            "thread_id" => $threadId,
            "sender_user_id" => $user["id"],
            "sender_role" => $senderRole,
            "message" => $message,
            "created_at" => $now,
        ]);

        $nextStatus = $senderRole === "admin"
            ? "active"
            : (($thread["assigned_admin_user_id"] ?? null) ? "active" : "pending");

        DB::table("support_chat_threads")->where("id", $threadId)->update([
            "status" => $nextStatus,
            "last_message_preview" => mb_substr($message, 0, 500),
            "last_sender_role" => $senderRole,
            "last_message_at" => $now,
            "is_admin_unread" => $senderRole === "member",
            "is_user_unread" => $senderRole === "admin",
            "updated_at" => $now,
        ]);

        $updatedThread = (array) DB::table("support_chat_threads")->where("id", $threadId)->first();
        $insertedMessage = (array) DB::table("support_chat_messages")->where("id", $messageId)->first();

        return response()->json([
            "success" => true,
            "thread" => $this->mapThread($updatedThread),
            "message" => $insertedMessage,
            "senderRole" => $senderRole,
        ], 201);
    }

    public function markRead(Request $request, string $threadId)
    {
        $this->expireOverdueTickets();
        $user = $this->authUser($request);
        if (!$user) {
            return response()->json(["message" => "User profile not found"], 404);
        }

        $thread = $this->getThreadById($threadId);
        if (!$thread) {
            return response()->json(["message" => "Thread not found"], 404);
        }

        $admin = $this->isAdminUser($user);
        if (!$this->canAccessThread($thread, $user, $admin)) {
            $message = $admin ? "Access denied. Pick the ticket first or ask the assigned admin." : "Access denied";
            return response()->json(["message" => $message], 403);
        }

        DB::table("support_chat_threads")->where("id", $threadId)->update(
            $admin ? ["is_admin_unread" => false] : ["is_user_unread" => false]
        );

        $updated = (array) DB::table("support_chat_threads")->where("id", $threadId)->first();
        return response()->json([
            "success" => true,
            "thread" => $this->mapThread($updated),
            "admin" => $admin,
        ]);
    }

    public function adminTickets(Request $request)
    {
        $this->expireOverdueTickets();
        $adminUser = $this->authUser($request);
        if (!$adminUser || !$this->isAdminUser($adminUser)) {
            return response()->json(["message" => "Admin profile not found"], 404);
        }

        $rows = DB::table("support_chat_threads")
            ->where("deleted_by_admin", false)
            ->whereNull("assigned_admin_user_id")
            ->whereIn("status", ["pending", "open"])
            ->orderByDesc("last_message_at")
            ->limit($this->parseLimit($request->query("limit"), 200, 1000))
            ->get()
            ->map(fn ($row) => (array) $row)
            ->all();

        $threadIds = array_values(array_filter(array_map(fn ($r) => $r["id"] ?? null, $rows)));
        $myRejectedIds = DB::table("support_chat_rejections")
            ->where("admin_user_id", $adminUser["id"])
            ->whereIn("thread_id", $threadIds)
            ->pluck("thread_id")
            ->toArray();
        $visible = array_values(array_filter($rows, fn ($r) => !in_array($r["id"], $myRejectedIds, true)));

        $requesterMap = $this->loadRequesterMap($visible);
        $rejectionMap = $this->rejectionCountMap(array_values(array_filter(array_map(fn ($r) => $r["id"] ?? null, $visible))));

        return response()->json(array_map(function ($row) use ($requesterMap, $rejectionMap) {
            return $this->mapThread(
                $row,
                $requesterMap[$row["requester_user_id"]] ?? null,
                (int) ($rejectionMap[$row["id"]] ?? 0)
            );
        }, $visible));
    }

    public function pickTicket(Request $request, string $threadId)
    {
        $this->expireOverdueTickets();
        $adminUser = $this->authUser($request);
        if (!$adminUser || !$this->isAdminUser($adminUser)) {
            return response()->json(["message" => "Admin profile not found"], 404);
        }

        $thread = $this->getThreadById($threadId);
        if (!$thread) {
            return response()->json(["message" => "Ticket not found"], 404);
        }
        if (($thread["deleted_by_admin"] ?? false) === true) {
            return response()->json(["message" => "Ticket is not available"], 409);
        }
        if ($this->isClosedStatus((string) ($thread["status"] ?? ""))) {
            return response()->json(["message" => "Ticket is closed and cannot be picked"], 409);
        }
        if (($thread["assigned_admin_user_id"] ?? null) && $thread["assigned_admin_user_id"] !== $adminUser["id"]) {
            return response()->json(["message" => "Ticket already assigned to another admin"], 409);
        }
        if (($thread["assigned_admin_user_id"] ?? null) === $adminUser["id"]) {
            $requesterMap = $this->loadRequesterMap([$thread]);
            $rejectionMap = $this->rejectionCountMap([$thread["id"]]);
            return response()->json([
                "success" => true,
                "alreadyAssigned" => true,
                "thread" => $this->mapThread(
                    $thread,
                    $requesterMap[$thread["requester_user_id"]] ?? null,
                    (int) ($rejectionMap[$thread["id"]] ?? 0)
                ),
            ]);
        }
        if (!$this->isOpenStatus((string) ($thread["status"] ?? ""))) {
            return response()->json(["message" => "Ticket cannot be picked in its current state"], 409);
        }

        DB::table("support_chat_rejections")
            ->where("thread_id", $threadId)
            ->where("admin_user_id", $adminUser["id"])
            ->delete();

        $affected = DB::table("support_chat_threads")
            ->where("id", $threadId)
            ->where("deleted_by_admin", false)
            ->whereNull("assigned_admin_user_id")
            ->whereIn("status", ["pending", "open", "active"])
            ->update([
                "assigned_admin_user_id" => $adminUser["id"],
                "assigned_at" => now(),
                "status" => "active",
                "updated_at" => now(),
            ]);

        if ($affected === 0) {
            $latest = $this->getThreadById($threadId);
            if (!$latest) {
                return response()->json(["message" => "Ticket not found"], 404);
            }
            $message = ($latest["assigned_admin_user_id"] ?? null)
                ? "Ticket was picked by another admin"
                : "Ticket is no longer available";
            return response()->json(["message" => $message, "thread" => $this->mapThread($latest)], 409);
        }

        $picked = (array) DB::table("support_chat_threads")->where("id", $threadId)->first();
        $requesterMap = $this->loadRequesterMap([$picked]);
        $rejectionMap = $this->rejectionCountMap([$picked["id"]]);

        return response()->json([
            "success" => true,
            "thread" => $this->mapThread(
                $picked,
                $requesterMap[$picked["requester_user_id"]] ?? null,
                (int) ($rejectionMap[$picked["id"]] ?? 0)
            ),
        ]);
    }

    public function rejectTicket(Request $request, string $threadId)
    {
        $this->expireOverdueTickets();
        $adminUser = $this->authUser($request);
        if (!$adminUser || !$this->isAdminUser($adminUser)) {
            return response()->json(["message" => "Admin profile not found"], 404);
        }

        $thread = $this->getThreadById($threadId);
        if (!$thread) {
            return response()->json(["message" => "Ticket not found"], 404);
        }
        if (($thread["deleted_by_admin"] ?? false) === true) {
            return response()->json(["message" => "Ticket is not available"], 409);
        }
        if ($this->isClosedStatus((string) ($thread["status"] ?? ""))) {
            return response()->json(["message" => "Ticket is already closed"], 409);
        }
        if ($thread["assigned_admin_user_id"] ?? null) {
            if ($thread["assigned_admin_user_id"] === $adminUser["id"]) {
                return response()->json([
                    "message" => "Ticket is already assigned to you. Use delete/resolve actions instead.",
                ], 409);
            }
            return response()->json(["message" => "Ticket is already assigned to another admin"], 409);
        }
        if (!$this->isOpenStatus((string) ($thread["status"] ?? ""))) {
            return response()->json(["message" => "Ticket cannot be rejected in its current state"], 409);
        }

        DB::table("support_chat_rejections")->updateOrInsert(
            [
                "thread_id" => $threadId,
                "admin_user_id" => $adminUser["id"],
            ],
            [
                "created_at" => now(),
            ]
        );

        $allAdmins = $this->activeAdminUserIds();
        if (count($allAdmins) === 0) {
            $allAdmins = [$adminUser["id"]];
        }

        $rejectionRows = DB::table("support_chat_rejections")
            ->where("thread_id", $threadId)
            ->pluck("admin_user_id")
            ->toArray();
        $rejectedSet = array_values(array_unique($rejectionRows));
        $rejectedByAll = count(array_diff($allAdmins, $rejectedSet)) === 0;

        $updatedThread = $thread;
        $notifyUser = false;
        if ($rejectedByAll) {
            DB::table("support_chat_threads")
                ->where("id", $threadId)
                ->where("deleted_by_admin", false)
                ->whereNull("assigned_admin_user_id")
                ->whereIn("status", self::OPEN_TICKET_STATUSES)
                ->update([
                    "status" => "rejected",
                    "is_admin_unread" => false,
                    "is_user_unread" => true,
                    "last_sender_role" => "admin",
                    "last_message_preview" => self::TICKET_REJECTED_MESSAGE,
                    "last_message_at" => now(),
                    "updated_at" => now(),
                ]);

            DB::table("support_chat_messages")->insert([
                "id" => (string) \Illuminate\Support\Str::uuid(),
                "thread_id" => $threadId,
                "sender_user_id" => null,
                "sender_role" => "admin",
                "message" => self::TICKET_REJECTED_MESSAGE,
                "created_at" => now(),
            ]);

            $updatedThread = $this->getThreadById($threadId) ?? $thread;
            $notifyUser = true;
        }

        $requesterMap = $this->loadRequesterMap([$updatedThread]);
        return response()->json([
            "success" => true,
            "rejectedByAllAdmins" => $notifyUser,
            "notifyUser" => $notifyUser,
            "thread" => $this->mapThread(
                $updatedThread,
                $requesterMap[$updatedThread["requester_user_id"]] ?? null,
                count($rejectedSet)
            ),
            "rejectionCount" => count($rejectedSet),
            "requiredRejections" => count($allAdmins),
        ]);
    }

    public function adminThreads(Request $request)
    {
        $this->expireOverdueTickets();
        $adminUser = $this->authUser($request);
        if (!$adminUser || !$this->isAdminUser($adminUser)) {
            return response()->json(["message" => "Admin profile not found"], 404);
        }

        $state = strtolower($this->normalizeText($request->query("state"), 20) ?: "all");
        $query = DB::table("support_chat_threads")
            ->where("deleted_by_admin", false)
            ->where("assigned_admin_user_id", $adminUser["id"])
            ->orderByDesc("assigned_at")
            ->orderByDesc("last_message_at")
            ->limit($this->parseLimit($request->query("limit"), 200, 1000));

        if ($state === "unread") {
            $query->where("is_admin_unread", true);
        } elseif ($state === "read") {
            $query->where("is_admin_unread", false);
        }

        $rows = $query->get()->map(fn ($row) => (array) $row)->all();
        $requesterMap = $this->loadRequesterMap($rows);
        $rejectionMap = $this->rejectionCountMap(array_values(array_filter(array_map(fn ($r) => $r["id"] ?? null, $rows))));

        return response()->json(array_map(function ($row) use ($requesterMap, $rejectionMap) {
            return $this->mapThread(
                $row,
                $requesterMap[$row["requester_user_id"]] ?? null,
                (int) ($rejectionMap[$row["id"]] ?? 0)
            );
        }, $rows));
    }

    public function deleteAdminThread(Request $request, string $threadId)
    {
        $adminUser = $this->authUser($request);
        if (!$adminUser || !$this->isAdminUser($adminUser)) {
            return response()->json(["message" => "Admin profile not found"], 404);
        }

        $thread = $this->getThreadById($threadId);
        if (!$thread) {
            return response()->json(["message" => "Thread not found"], 404);
        }

        if (($thread["assigned_admin_user_id"] ?? null) !== $adminUser["id"]) {
            return response()->json(["message" => "Only the assigned admin can delete this ticket"], 403);
        }

        DB::table("support_chat_threads")
            ->where("id", $threadId)
            ->where("assigned_admin_user_id", $adminUser["id"])
            ->update([
                "deleted_by_admin" => true,
                "status" => "deleted",
                "is_admin_unread" => false,
                "is_user_unread" => false,
                "updated_at" => now(),
            ]);

        $updated = (array) DB::table("support_chat_threads")->where("id", $threadId)->first();

        return response()->json([
            "success" => true,
            "message" => "Support chat deleted",
            "thread" => $this->mapThread($updated),
        ]);
    }
}
