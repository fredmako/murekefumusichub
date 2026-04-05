<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RoleService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class NotificationController extends Controller
{
    public function __construct(private readonly RoleService $roleService)
    {
    }

    private function authUser(Request $request): ?array
    {
        $authUid = (string) $request->attributes->get("authUid", "");
        if ($authUid === "") {
            return null;
        }

        return $this->roleService->resolveDbUserByAuthUid($authUid);
    }

    private function normalizeNotificationIds(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }

        return array_values(array_unique(array_filter(array_map(
            fn ($item) => trim((string) ($item ?? "")),
            $value
        ))));
    }

    private function isMissingNotificationReadsTableError(\Throwable $error): bool
    {
        return str_contains(strtolower($error->getMessage()), "user_notification_reads");
    }

    public function read(Request $request)
    {
        $user = $this->authUser($request);
        if (!$user || empty($user["id"])) {
            return response()->json([
                "message" => "User profile not found",
                "ids" => [],
            ], 404);
        }

        try {
            $rows = DB::table("user_notification_reads")
                ->select("notification_id")
                ->where("user_id", $user["id"])
                ->get();

            return response()->json([
                "ids" => $rows
                    ->pluck("notification_id")
                    ->map(fn ($id) => trim((string) ($id ?? "")))
                    ->filter()
                    ->values(),
            ]);
        } catch (\Throwable $error) {
            if ($this->isMissingNotificationReadsTableError($error)) {
                return response()->json(["ids" => []]);
            }

            return response()->json([
                "message" => "Failed to load notification read state",
                "error" => $error->getMessage() ?: "UNKNOWN_ERROR",
            ], 500);
        }
    }

    public function markRead(Request $request)
    {
        $user = $this->authUser($request);
        if (!$user || empty($user["id"])) {
            return response()->json(["message" => "User profile not found"], 404);
        }

        $notificationIds = $this->normalizeNotificationIds(
            $request->input("notificationIds", $request->input("ids"))
        );

        if (count($notificationIds) === 0) {
            return response()->json([
                "success" => true,
                "markedCount" => 0,
                "notificationIds" => [],
            ]);
        }

        try {
            $payload = array_map(fn ($notificationId) => [
                "user_id" => $user["id"],
                "notification_id" => $notificationId,
                "read_at" => now(),
            ], $notificationIds);

            DB::table("user_notification_reads")->upsert(
                $payload,
                ["user_id", "notification_id"],
                ["read_at"]
            );

            return response()->json([
                "success" => true,
                "markedCount" => count($notificationIds),
                "notificationIds" => $notificationIds,
            ]);
        } catch (\Throwable $error) {
            if ($this->isMissingNotificationReadsTableError($error)) {
                return response()->json([
                    "message" => "Notification read tracking is not available yet. Run migration 025_create_user_notification_reads_table.sql and retry.",
                ], 503);
            }

            return response()->json([
                "message" => "Failed to mark notifications as read",
                "error" => $error->getMessage() ?: "UNKNOWN_ERROR",
            ], 500);
        }
    }
}
