<?php

namespace App\Support;

class AvatarUrl
{
    public static function normalize(?string $value): ?string
    {
        $raw = trim((string) ($value ?? ""));
        if ($raw === "") {
            return null;
        }

        if (!str_starts_with($raw, "http://") && !str_starts_with($raw, "https://")) {
            return null;
        }

        $withoutQuery = explode("?", $raw, 2)[0];
        $normalized = str_replace("/storage/v1/object/sign/avatars/", "/storage/v1/object/public/avatars/", $withoutQuery);
        $normalized = str_replace("/storage/v1/object/sign/avatars%2F", "/storage/v1/object/public/avatars/", $normalized);
        $normalized = str_replace("%2F", "/", $normalized);
        $normalized = str_replace("%2f", "/", $normalized);

        return $normalized;
    }

    public static function withNormalizedAvatar(array $row): array
    {
        if (array_key_exists("avatar_url", $row)) {
            $row["avatar_url"] = self::normalize($row["avatar_url"]);
        }

        return $row;
    }
}
