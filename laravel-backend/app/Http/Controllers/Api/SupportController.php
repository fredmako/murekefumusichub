<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RoleService;
use App\Support\AvatarUrl;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class SupportController extends Controller
{
    private const OPEN_TICKET_STATUSES = ["pending", "open", "active"];
    private const CLOSED_TICKET_STATUSES = ["expired", "rejected", "deleted", "resolved"];
    private const TICKET_LIFETIME_DAYS = 30;
    private const TICKET_REJECTED_MESSAGE = "Your ticket was rejected by all available admins. Please open a new ticket if you still need help.";
    private const TICKET_EXPIRED_MESSAGE = "This ticket expired after 30 days. Please open a new ticket if your issue is still unresolved.";
    private const ANNOUNCEMENT_ROLE_OPTIONS = ["student", "buyer", "composer", "admin"];
    private const AI_DRAFT_USE_CASES = ["support", "message", "announcement"];

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

    private function normalizeAdminThreadType(mixed $value): string
    {
        $normalized = strtolower($this->normalizeText($value, 24));
        return in_array($normalized, ["notification", "ticket", "direct"], true)
            ? $normalized
            : "direct";
    }

    private function defaultAdminThreadSubject(string $threadType): string
    {
        return match ($threadType) {
            "notification" => "Admin Notification",
            "ticket" => "Support Ticket Follow-up",
            default => "Direct Admin Chat",
        };
    }

    private function defaultAdminThreadContext(string $threadType): string
    {
        return match ($threadType) {
            "notification" => "admin-notification",
            "ticket" => "admin-ticket",
            default => "admin-direct",
        };
    }

    private function parseJsonObject(?string $content): ?array
    {
        $content = trim((string) ($content ?? ""));
        if ($content === "") {
            return null;
        }

        try {
            $decoded = json_decode($content, true, flags: JSON_THROW_ON_ERROR);
            return is_array($decoded) ? $decoded : null;
        } catch (\Throwable) {
            $start = strpos($content, "{");
            $end = strrpos($content, "}");
            if ($start === false || $end === false || $end <= $start) {
                return null;
            }

            try {
                $decoded = json_decode(substr($content, $start, $end - $start + 1), true, flags: JSON_THROW_ON_ERROR);
                return is_array($decoded) ? $decoded : null;
            } catch (\Throwable) {
                return null;
            }
        }
    }

    private function normalizeAnnouncementRoles(mixed $rawRoles): array
    {
        $roles = is_array($rawRoles)
            ? $rawRoles
            : explode(",", (string) ($rawRoles ?? ""));

        return collect($roles)
            ->map(fn ($role) => strtolower($this->normalizeText($role, 32)))
            ->filter(fn ($role) => in_array($role, self::ANNOUNCEMENT_ROLE_OPTIONS, true))
            ->unique()
            ->values()
            ->all();
    }

    private function normalizeAiDraftUseCase(mixed $value): string
    {
        $normalized = strtolower($this->normalizeText($value, 24));
        return in_array($normalized, self::AI_DRAFT_USE_CASES, true)
            ? $normalized
            : "message";
    }

    private function generateProfessionalDraft(array $payload): array
    {
        $openAiKey = trim((string) env("OPENAI_API_KEY", ""));
        if ($openAiKey === "") {
            throw new \RuntimeException("AI assistant is not configured. Set OPENAI_API_KEY on the backend.", 503);
        }

        $model = (string) env("OPENAI_MODEL", "gpt-4o-mini");
        $response = Http::withToken($openAiKey)->acceptJson()->post("https://api.openai.com/v1/chat/completions", [
            "model" => $model,
            "temperature" => 0.25,
            "response_format" => ["type" => "json_object"],
            "messages" => [
                [
                    "role" => "system",
                    "content" => "You rewrite operational platform messages in a clear professional tone. Return JSON only with keys: subject, message. Keep message concise, respectful, and action-oriented. Do not use markdown.",
                ],
                [
                    "role" => "user",
                    "content" => json_encode($payload),
                ],
            ],
            "max_tokens" => 500,
        ]);

        if (!$response->successful()) {
            throw new \RuntimeException("AI draft generation failed: " . $response->body(), $response->status() >= 500 ? 502 : $response->status());
        }

        $parsed = $this->parseJsonObject((string) data_get($response->json(), "choices.0.message.content"));
        $draftSubject = $this->normalizeText($parsed["subject"] ?? ($payload["subject"] ?? null), 160);
        $draftMessage = $this->normalizeText($parsed["message"] ?? ($payload["message"] ?? null), 4000);
        if ($draftMessage === "") {
            throw new \RuntimeException("AI draft returned an empty message", 502);
        }

        return [
            "success" => true,
            "useCase" => $payload["useCase"] ?? "message",
            "model" => $model,
            "draft" => [
                "subject" => $draftSubject,
                "message" => $draftMessage,
            ],
        ];
    }

    private function resolveAnnouncementRecipients(array $targetRoles, ?string $senderUserId = null): array
    {
        if (count($targetRoles) === 0) {
            return [];
        }

        $users = DB::table("users")
            ->select("id", "email", "display_name", "avatar_url", "is_active")
            ->where(function ($query) {
                $query->whereNull("is_active")
                    ->orWhere("is_active", true);
            })
            ->get()
            ->map(fn ($user) => AvatarUrl::withNormalizedAvatar((array) $user))
            ->values()
            ->all();

        if (count($users) === 0) {
            return [];
        }

        $userIds = array_values(array_filter(array_map(fn ($user) => $user["id"] ?? null, $users)));
        $rolesByUserId = [];
        foreach ($userIds as $userId) {
            $rolesByUserId[$userId] = [];
        }

        try {
            $roleRows = DB::table("user_roles")
                ->join("roles", "roles.id", "=", "user_roles.role_id")
                ->whereIn("user_roles.user_id", $userIds)
                ->select("user_roles.user_id", "roles.name")
                ->get();
            foreach ($roleRows as $row) {
                $roleName = strtolower(trim((string) ($row->name ?? "")));
                if ($roleName === "") {
                    continue;
                }
                $rolesByUserId[$row->user_id] ??= [];
                if (!in_array($roleName, $rolesByUserId[$row->user_id], true)) {
                    $rolesByUserId[$row->user_id][] = $roleName;
                }
            }
        } catch (\Throwable) {
            // Ignore missing role mapping tables.
        }

        try {
            $composerRows = DB::table("composers")
                ->select("user_id")
                ->whereIn("user_id", $userIds)
                ->get();
            foreach ($composerRows as $row) {
                if (!isset($rolesByUserId[$row->user_id])) {
                    continue;
                }
                if (!in_array("composer", $rolesByUserId[$row->user_id], true)) {
                    $rolesByUserId[$row->user_id][] = "composer";
                }
            }
        } catch (\Throwable) {
            // Ignore missing composers table.
        }

        $usersByEmail = [];
        foreach ($users as $user) {
            $email = strtolower(trim((string) ($user["email"] ?? "")));
            if ($email !== "") {
                $usersByEmail[$email] = $user["id"];
            }
        }

        try {
            $adminEmails = DB::table("admin_emails")
                ->where("is_active", true)
                ->pluck("email")
                ->map(fn ($email) => strtolower(trim((string) $email)))
                ->filter()
                ->values()
                ->all();
            foreach ($adminEmails as $email) {
                $userId = $usersByEmail[$email] ?? null;
                if (!$userId) {
                    continue;
                }
                if (!in_array("admin", $rolesByUserId[$userId], true)) {
                    $rolesByUserId[$userId][] = "admin";
                }
            }
        } catch (\Throwable) {
            // Ignore missing admin_emails table.
        }

        try {
            $enrollmentRows = DB::table("enrollments")
                ->select("user_id", "email", "status")
                ->whereIn("status", ["pending", "admitted"])
                ->get();
            foreach ($enrollmentRows as $row) {
                $userId = $row->user_id ?: ($usersByEmail[strtolower(trim((string) ($row->email ?? "")))] ?? null);
                if (!$userId || !isset($rolesByUserId[$userId])) {
                    continue;
                }
                if (!in_array("student", $rolesByUserId[$userId], true)) {
                    $rolesByUserId[$userId][] = "student";
                }
            }
        } catch (\Throwable) {
            // Ignore missing enrollments table.
        }

        foreach ($userIds as $userId) {
            if (empty($rolesByUserId[$userId])) {
                $rolesByUserId[$userId][] = "buyer";
            }
        }

        return array_values(array_filter(array_map(function ($user) use ($rolesByUserId, $targetRoles, $senderUserId) {
            $userId = $user["id"] ?? null;
            if (!$userId || ($senderUserId && $senderUserId === $userId)) {
                return null;
            }

            $roles = $rolesByUserId[$userId] ?? ["buyer"];
            foreach ($roles as $role) {
                if (in_array($role, $targetRoles, true)) {
                    return [
                        ...$user,
                        "roles" => $roles,
                    ];
                }
            }

            return null;
        }, $users)));
    }

    private function loadMemberThreadsForUser(string $userId, int $limit = 100): array
    {
        $rows = DB::table("support_chat_threads")
            ->where("requester_user_id", $userId)
            ->where("deleted_by_admin", false)
            ->orderByDesc("last_message_at")
            ->limit($limit)
            ->get()
            ->map(fn ($row) => (array) $row)
            ->all();

        $threadIds = array_values(array_filter(array_map(fn ($row) => $row["id"] ?? null, $rows)));
        $rejectionMap = $this->rejectionCountMap($threadIds);

        return array_map(function ($row) use ($rejectionMap) {
            return $this->mapThread($row, null, (int) ($rejectionMap[$row["id"]] ?? 0));
        }, $rows);
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

    public function createAdminThread(Request $request)
    {
        $this->expireOverdueTickets();
        $adminUser = $this->authUser($request);
        if (!$adminUser || !$this->isAdminUser($adminUser)) {
            return response()->json(["message" => "Admin profile not found"], 404);
        }

        $targetUserId = $this->normalizeText(
            $request->input("targetUserId", $request->input("requesterUserId")),
            120
        );
        if ($targetUserId === "") {
            return response()->json(["message" => "targetUserId is required"], 400);
        }
        if ($targetUserId === $adminUser["id"]) {
            return response()->json([
                "message" => "Cannot start an admin support thread with yourself",
            ], 400);
        }

        $message = $this->normalizeText($request->input("message"), 4000);
        if ($message === "") {
            return response()->json(["message" => "Message is required"], 400);
        }

        $targetUser = DB::table("users")
            ->select("id", "email", "display_name", "avatar_url", "is_active")
            ->where("id", $targetUserId)
            ->first();
        if (!$targetUser) {
            return response()->json(["message" => "Target user not found"], 404);
        }
        if ($targetUser->is_active === false) {
            return response()->json([
                "message" => "Cannot start a chat with a suspended user",
            ], 409);
        }

        $threadType = $this->normalizeAdminThreadType($request->input("threadType"));
        $subject = $this->normalizeText($request->input("subject"), 160)
            ?: $this->defaultAdminThreadSubject($threadType);
        $context = $this->normalizeText($request->input("context"), 120)
            ?: $this->defaultAdminThreadContext($threadType);
        $now = now();
        $threadId = (string) \Illuminate\Support\Str::uuid();
        $messageId = (string) \Illuminate\Support\Str::uuid();

        DB::table("support_chat_threads")->insert([
            "id" => $threadId,
            "requester_user_id" => $targetUserId,
            "subject" => $subject,
            "context" => $context,
            "status" => "active",
            "assigned_admin_user_id" => $adminUser["id"],
            "assigned_at" => $now,
            "expires_at" => now()->addDays(self::TICKET_LIFETIME_DAYS),
            "is_admin_unread" => false,
            "is_user_unread" => true,
            "last_message_preview" => mb_substr($message, 0, 500),
            "last_sender_role" => "admin",
            "last_message_at" => $now,
            "deleted_by_admin" => false,
            "created_at" => $now,
            "updated_at" => $now,
        ]);

        DB::table("support_chat_messages")->insert([
            "id" => $messageId,
            "thread_id" => $threadId,
            "sender_user_id" => $adminUser["id"],
            "sender_role" => "admin",
            "message" => $message,
            "created_at" => $now,
        ]);

        $thread = (array) DB::table("support_chat_threads")->where("id", $threadId)->first();
        $insertedMessage = (array) DB::table("support_chat_messages")->where("id", $messageId)->first();

        return response()->json([
            "success" => true,
            "threadType" => $threadType,
            "thread" => $this->mapThread(
                $thread,
                AvatarUrl::withNormalizedAvatar((array) $targetUser),
                0
            ),
            "message" => $insertedMessage,
        ], 201);
    }

    public function aiDraft(Request $request)
    {
        $user = $this->authUser($request);
        if (!$user) {
            return response()->json(["message" => "User profile not found"], 404);
        }

        $message = $this->normalizeText($request->input("message", $request->input("text")), 4000);
        if ($message === "") {
            return response()->json(["message" => "message is required"], 400);
        }

        $useCase = $this->normalizeAiDraftUseCase($request->input("useCase"));
        $audienceRoles = $this->normalizeAnnouncementRoles($request->input("audienceRoles", $request->input("roles")));
        $subject = $this->normalizeText($request->input("subject"), 160);
        $context = $this->normalizeText($request->input("context"), 160);

        try {
            $result = $this->generateProfessionalDraft([
                "useCase" => $useCase,
                "audienceRoles" => $audienceRoles,
                "context" => $context !== "" ? $context : null,
                "subject" => $subject !== "" ? $subject : null,
                "message" => $message,
            ]);

            return response()->json($result);
        } catch (\RuntimeException $e) {
            $status = $e->getCode() >= 400 ? $e->getCode() : 500;
            return response()->json([
                "message" => $e->getMessage() ?: "Failed to generate AI draft",
                "error" => $e->getMessage() ?: "UNKNOWN_ERROR",
            ], $status);
        }
    }

    public function createAnnouncement(Request $request)
    {
        $this->expireOverdueTickets();
        $adminUser = $this->authUser($request);
        if (!$adminUser || !$this->isAdminUser($adminUser)) {
            return response()->json(["message" => "Admin profile not found"], 404);
        }

        $targetRoles = $this->normalizeAnnouncementRoles(
            $request->input("targetRoles", $request->input("roles"))
        );
        if (count($targetRoles) === 0) {
            return response()->json([
                "message" => "At least one target role is required. Use student, buyer, composer, or admin.",
            ], 400);
        }

        $message = $this->normalizeText($request->input("message"), 4000);
        if ($message === "") {
            return response()->json(["message" => "Announcement message is required"], 400);
        }

        $subject = $this->normalizeText($request->input("subject"), 160) ?: "Platform Announcement";
        $context = $this->normalizeText($request->input("context"), 120) ?: "admin-announcement";
        $recipients = $this->resolveAnnouncementRecipients($targetRoles, (string) $adminUser["id"]);
        if (count($recipients) === 0) {
            return response()->json([
                "message" => "No active users match the selected target roles",
            ], 404);
        }

        $now = now();
        $threadRows = [];
        $messageRows = [];
        $createdThreadIds = [];
        foreach ($recipients as $recipient) {
            $threadId = (string) \Illuminate\Support\Str::uuid();
            $createdThreadIds[] = $threadId;
            $threadRows[] = [
                "id" => $threadId,
                "requester_user_id" => $recipient["id"],
                "subject" => $subject,
                "context" => $context,
                "status" => "active",
                "assigned_admin_user_id" => $adminUser["id"],
                "assigned_at" => $now,
                "expires_at" => now()->addDays(self::TICKET_LIFETIME_DAYS),
                "is_admin_unread" => false,
                "is_user_unread" => true,
                "last_message_preview" => mb_substr($message, 0, 500),
                "last_sender_role" => "admin",
                "last_message_at" => $now,
                "deleted_by_admin" => false,
                "created_at" => $now,
                "updated_at" => $now,
            ];
            $messageRows[] = [
                "id" => (string) \Illuminate\Support\Str::uuid(),
                "thread_id" => $threadId,
                "sender_user_id" => $adminUser["id"],
                "sender_role" => "admin",
                "message" => $message,
                "created_at" => $now,
            ];
        }

        DB::table("support_chat_threads")->insert($threadRows);
        DB::table("support_chat_messages")->insert($messageRows);

        return response()->json([
            "success" => true,
            "recipientCount" => count($recipients),
            "targetRoles" => $targetRoles,
            "createdThreadIds" => $createdThreadIds,
            "message" => "Announcement sent",
        ], 201);
    }

    public function inbox(Request $request)
    {
        $this->expireOverdueTickets();
        $user = $this->authUser($request);
        if (!$user) {
            return response()->json(["message" => "User profile not found"], 404);
        }

        $limit = $this->parseLimit($request->query("limit"), 100, 500);
        $threads = $this->loadMemberThreadsForUser((string) $user["id"], $limit);
        $unreadThreads = array_values(array_filter($threads, fn ($thread) => (bool) ($thread["is_user_unread"] ?? false)));

        return response()->json([
            "threads" => $threads,
            "unreadThreads" => $unreadThreads,
            "unreadCount" => count($unreadThreads),
            "lastUpdatedAt" => now()->toISOString(),
        ]);
    }

    public function myThreads(Request $request)
    {
        $this->expireOverdueTickets();
        $user = $this->authUser($request);
        if (!$user) {
            return response()->json(["message" => "User profile not found"], 404);
        }

        $limit = $this->parseLimit($request->query("limit"), 100, 500);
        return response()->json($this->loadMemberThreadsForUser((string) $user["id"], $limit));
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
