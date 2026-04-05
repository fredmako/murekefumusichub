<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RoleService;
use App\Support\AvatarUrl;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class CommunityController extends Controller
{
    private const PRIMARY_ROOM = [
        "slug" => "murekefu-community",
        "name" => "Murekefu Community",
        "description" => "A shared lounge for learners, composers, buyers, and the Murekefu team.",
    ];

    private const BUBBLE_TONES = ["theme", "ocean", "sunset"];
    private const DENSITIES = ["comfortable", "compact"];
    private const WALLPAPERS = ["aurora", "graphite", "sunrise"];
    private const ATTACHMENT_KINDS = ["text", "image", "video", "audio", "document"];

    /** @var array<string, bool> */
    private static array $columnCache = [];

    public function __construct(private readonly RoleService $roleService)
    {
    }

    private function normalizeText(mixed $value, int $max = 5000): string
    {
        $normalized = str_replace(["\r\n", "\r"], "\n", trim((string) ($value ?? "")));
        return mb_substr($normalized, 0, $max);
    }

    private function normalizeOptionalText(mixed $value, int $max = 255): ?string
    {
        $normalized = $this->normalizeText($value, $max);
        return $normalized !== "" ? $normalized : null;
    }

    private function hasColumn(string $table, string $column): bool
    {
        $key = "{$table}.{$column}";
        if (array_key_exists($key, self::$columnCache)) {
            return self::$columnCache[$key];
        }

        try {
            return self::$columnCache[$key] = Schema::hasColumn($table, $column);
        } catch (\Throwable) {
            return self::$columnCache[$key] = false;
        }
    }

    private function authUser(Request $request): ?array
    {
        $authUid = (string) $request->attributes->get("authUid", "");
        if ($authUid === "") {
            return null;
        }

        return $this->roleService->resolveDbUserByAuthUid($authUid);
    }

    private function sanitizeMessageMetadata(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }

        $metadata = [];
        $mimeType = $this->normalizeOptionalText($value["mimeType"] ?? null, 160);
        $storageBucket = $this->normalizeOptionalText($value["storageBucket"] ?? null, 80);
        $storagePath = $this->normalizeOptionalText($value["storagePath"] ?? null, 500);

        if ($mimeType) {
            $metadata["mimeType"] = $mimeType;
        }
        if ($storageBucket) {
            $metadata["storageBucket"] = $storageBucket;
        }
        if ($storagePath) {
            $metadata["storagePath"] = $storagePath;
        }

        $fileSize = isset($value["fileSize"]) ? (int) $value["fileSize"] : null;
        if ($fileSize !== null && $fileSize >= 0) {
            $metadata["fileSize"] = $fileSize;
        }

        $durationMs = isset($value["durationMs"]) ? (int) $value["durationMs"] : null;
        if ($durationMs !== null && $durationMs >= 0) {
            $metadata["durationMs"] = $durationMs;
        }

        return $metadata;
    }

    private function decodeMetadata(mixed $value): ?array
    {
        if (is_array($value)) {
            return $value;
        }
        if (!is_string($value) || trim($value) === "") {
            return null;
        }

        try {
            $decoded = json_decode($value, true, flags: JSON_THROW_ON_ERROR);
            return is_array($decoded) ? $decoded : null;
        } catch (\Throwable) {
            return null;
        }
    }

    private function isMissingCommunityTablesError(\Throwable $error): bool
    {
        $message = strtolower($error->getMessage());

        return str_contains($message, "community_rooms")
            || str_contains($message, "community_messages")
            || str_contains($message, "community_user_settings");
    }

    private function missingCommunityMigrationResponse()
    {
        return response()->json([
            "message" => "Community chat tables are missing. Run migration 029_create_community_chat_tables.sql, then retry.",
        ], 500);
    }

    private function ensurePrimaryRoom(): array
    {
        $existing = DB::table("community_rooms")
            ->select("id", "slug", "name", "description", "is_public", "created_at", "updated_at")
            ->where("slug", self::PRIMARY_ROOM["slug"])
            ->first();

        if ($existing) {
            return (array) $existing;
        }

        $id = (string) Str::uuid();
        DB::table("community_rooms")->insert([
            "id" => $id,
            "slug" => self::PRIMARY_ROOM["slug"],
            "name" => self::PRIMARY_ROOM["name"],
            "description" => self::PRIMARY_ROOM["description"],
            "is_public" => true,
            "created_at" => now(),
            "updated_at" => now(),
        ]);

        return (array) DB::table("community_rooms")
            ->select("id", "slug", "name", "description", "is_public", "created_at", "updated_at")
            ->where("id", $id)
            ->first();
    }

    private function resolveRoomById(string $roomId): ?array
    {
        $room = DB::table("community_rooms")
            ->select("id", "slug", "name", "description", "is_public", "created_at", "updated_at")
            ->where("id", $roomId)
            ->first();

        return $room ? (array) $room : null;
    }

    private function enrichMessages(array $messages): array
    {
        $senderIds = array_values(array_unique(array_filter(array_map(
            fn ($message) => trim((string) ($message["sender_user_id"] ?? "")),
            $messages
        ))));

        $userMap = [];
        if (count($senderIds) > 0) {
            $users = DB::table("users")
                ->select("id", "display_name", "email", "avatar_url")
                ->whereIn("id", $senderIds)
                ->get();

            foreach ($users as $user) {
                $userMap[$user->id] = AvatarUrl::withNormalizedAvatar((array) $user);
            }
        }

        return array_map(function (array $message) use ($userMap) {
            return [
                ...$message,
                "metadata" => $this->decodeMetadata($message["metadata"] ?? null),
                "sender" => !empty($message["sender_user_id"])
                    ? ($userMap[$message["sender_user_id"]] ?? null)
                    : null,
            ];
        }, $messages);
    }

    public function primaryRoom()
    {
        try {
            $room = $this->ensurePrimaryRoom();

            $query = DB::table("community_messages")
                ->where("room_id", $room["id"]);
            if ($this->hasColumn("community_messages", "deleted_at")) {
                $query->whereNull("deleted_at");
            }

            return response()->json([
                "room" => $room,
                "messageCount" => $query->count(),
            ]);
        } catch (\Throwable $error) {
            if ($this->isMissingCommunityTablesError($error)) {
                return $this->missingCommunityMigrationResponse();
            }

            return response()->json([
                "message" => $error->getMessage() ?: "Failed to load community room.",
            ], 500);
        }
    }

    public function roomMessages(Request $request, string $roomId)
    {
        $roomId = trim($roomId);
        if ($roomId === "") {
            return response()->json(["message" => "Room ID is required."], 400);
        }

        try {
            $room = $this->resolveRoomById($roomId);
            if (!$room) {
                return response()->json(["message" => "Community room not found."], 404);
            }

            $limit = max(1, min((int) $request->query("limit", 150), 300));
            $query = DB::table("community_messages")
                ->select(
                    "id",
                    "room_id",
                    "sender_user_id",
                    "message",
                    "attachment_url",
                    "attachment_name",
                    "attachment_kind",
                    "metadata",
                    "created_at",
                    "updated_at"
                )
                ->where("room_id", $room["id"])
                ->orderBy("created_at")
                ->limit($limit);

            if ($this->hasColumn("community_messages", "deleted_at")) {
                $query->whereNull("deleted_at");
            }

            $messages = $query->get()->map(fn ($row) => (array) $row)->all();

            return response()->json([
                "room" => $room,
                "messages" => $this->enrichMessages($messages),
            ]);
        } catch (\Throwable $error) {
            if ($this->isMissingCommunityTablesError($error)) {
                return $this->missingCommunityMigrationResponse();
            }

            return response()->json([
                "message" => $error->getMessage() ?: "Failed to load community messages.",
            ], 500);
        }
    }

    public function sendMessage(Request $request, string $roomId)
    {
        $user = $this->authUser($request);
        if (!$user || empty($user["id"])) {
            return response()->json(["message" => "User profile not found."], 404);
        }

        $roomId = trim($roomId);
        if ($roomId === "") {
            return response()->json(["message" => "Room ID is required."], 400);
        }

        try {
            $room = $this->resolveRoomById($roomId);
            if (!$room) {
                return response()->json(["message" => "Community room not found."], 404);
            }

            $message = $this->normalizeOptionalText($request->input("message"), 5000);
            $attachmentUrl = $this->normalizeOptionalText($request->input("attachmentUrl", $request->input("attachment_url")), 2000);
            $attachmentName = $this->normalizeOptionalText($request->input("attachmentName", $request->input("attachment_name")), 255);
            $attachmentKind = strtolower((string) ($request->input("attachmentKind", $request->input("attachment_kind", "text"))));
            $attachmentKind = in_array($attachmentKind, self::ATTACHMENT_KINDS, true) ? $attachmentKind : "text";
            $metadata = $this->sanitizeMessageMetadata($request->input("metadata"));

            if (!$message && !$attachmentUrl) {
                return response()->json([
                    "message" => "Write a message or include an attachment before sending.",
                ], 400);
            }

            $id = (string) Str::uuid();
            DB::table("community_messages")->insert([
                "id" => $id,
                "room_id" => $room["id"],
                "sender_user_id" => $user["id"],
                "message" => $message,
                "attachment_url" => $attachmentUrl,
                "attachment_name" => $attachmentName,
                "attachment_kind" => $attachmentKind,
                "metadata" => !empty($metadata) ? json_encode($metadata) : null,
                "created_at" => now(),
                "updated_at" => now(),
            ]);

            $created = (array) DB::table("community_messages")
                ->select(
                    "id",
                    "room_id",
                    "sender_user_id",
                    "message",
                    "attachment_url",
                    "attachment_name",
                    "attachment_kind",
                    "metadata",
                    "created_at",
                    "updated_at"
                )
                ->where("id", $id)
                ->first();

            $enriched = $this->enrichMessages([$created]);

            return response()->json([
                "success" => true,
                "message" => $enriched[0] ?? null,
            ], 201);
        } catch (\Throwable $error) {
            if ($this->isMissingCommunityTablesError($error)) {
                return $this->missingCommunityMigrationResponse();
            }

            return response()->json([
                "message" => $error->getMessage() ?: "Failed to send community message.",
            ], 500);
        }
    }

    public function mySettings(Request $request)
    {
        $user = $this->authUser($request);
        if (!$user || empty($user["id"])) {
            return response()->json(["message" => "User profile not found."], 404);
        }

        try {
            $row = DB::table("community_user_settings")
                ->select("bubble_tone", "density", "wallpaper")
                ->where("user_id", $user["id"])
                ->first();

            return response()->json([
                "settings" => [
                    "bubbleTone" => $row->bubble_tone ?? "theme",
                    "density" => $row->density ?? "comfortable",
                    "wallpaper" => $row->wallpaper ?? "aurora",
                ],
            ]);
        } catch (\Throwable $error) {
            if ($this->isMissingCommunityTablesError($error)) {
                return $this->missingCommunityMigrationResponse();
            }

            return response()->json([
                "message" => $error->getMessage() ?: "Failed to load community settings.",
            ], 500);
        }
    }

    public function updateMySettings(Request $request)
    {
        $user = $this->authUser($request);
        if (!$user || empty($user["id"])) {
            return response()->json(["message" => "User profile not found."], 404);
        }

        $bubbleTone = strtolower(trim((string) $request->input("bubbleTone", $request->input("bubble_tone", "theme"))));
        $density = strtolower(trim((string) $request->input("density", "comfortable")));
        $wallpaper = strtolower(trim((string) $request->input("wallpaper", "aurora")));

        if (!in_array($bubbleTone, self::BUBBLE_TONES, true)) {
            return response()->json(["message" => "Unsupported bubble tone."], 400);
        }
        if (!in_array($density, self::DENSITIES, true)) {
            return response()->json(["message" => "Unsupported chat density."], 400);
        }
        if (!in_array($wallpaper, self::WALLPAPERS, true)) {
            return response()->json(["message" => "Unsupported wallpaper option."], 400);
        }

        try {
            DB::table("community_user_settings")->updateOrInsert(
                ["user_id" => $user["id"]],
                [
                    "bubble_tone" => $bubbleTone,
                    "density" => $density,
                    "wallpaper" => $wallpaper,
                    "updated_at" => now(),
                ]
            );

            return response()->json([
                "success" => true,
                "settings" => [
                    "bubbleTone" => $bubbleTone,
                    "density" => $density,
                    "wallpaper" => $wallpaper,
                ],
            ]);
        } catch (\Throwable $error) {
            if ($this->isMissingCommunityTablesError($error)) {
                return $this->missingCommunityMigrationResponse();
            }

            return response()->json([
                "message" => $error->getMessage() ?: "Failed to save community settings.",
            ], 500);
        }
    }
}
