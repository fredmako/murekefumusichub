<?php

namespace App\Services;

use App\Support\AvatarUrl;
use Illuminate\Support\Facades\DB;

class RoleService
{
    private const USER_SELECT_COLUMNS = [
        "id",
        "auth_uid",
        "email",
        "display_name",
        "phone",
        "avatar_url",
        "theme_settings",
        "composer_request",
        "is_active",
    ];

    public function resolveDbUserByAuthUid(string $authUid): ?array
    {
        $row = DB::table("users")
            ->select(self::USER_SELECT_COLUMNS)
            ->where("auth_uid", $authUid)
            ->first();

        return $row ? (array) $row : null;
    }

    public function resolveDbUserByIdOrAuth(string $identifier): ?array
    {
        $id = trim($identifier);
        if ($id === "") {
            return null;
        }

        $byId = DB::table("users")
            ->select(self::USER_SELECT_COLUMNS)
            ->where("id", $id)
            ->first();
        if ($byId) {
            return (array) $byId;
        }

        $byAuth = DB::table("users")
            ->select(self::USER_SELECT_COLUMNS)
            ->where("auth_uid", $id)
            ->first();

        return $byAuth ? (array) $byAuth : null;
    }

    public function normalizeThemeSettings(mixed $rawThemeSettings, bool $defaultToEmerald = false): ?array
    {
        $themeSettings = null;

        if (is_array($rawThemeSettings)) {
            $themeSettings = $rawThemeSettings;
        } elseif (is_object($rawThemeSettings)) {
            $themeSettings = (array) $rawThemeSettings;
        } elseif (is_string($rawThemeSettings)) {
            $rawThemeSettings = trim($rawThemeSettings);
            if ($rawThemeSettings !== "") {
                if (str_starts_with($rawThemeSettings, "{") || str_starts_with($rawThemeSettings, "[")) {
                    try {
                        $decoded = json_decode($rawThemeSettings, true, flags: JSON_THROW_ON_ERROR);
                        $themeSettings = is_array($decoded) ? $decoded : null;
                    } catch (\Throwable) {
                        $themeSettings = ["preset" => $rawThemeSettings];
                    }
                } else {
                    $themeSettings = ["preset" => $rawThemeSettings];
                }
            }
        }

        $normalized = [];
        if (is_array($themeSettings)) {
            foreach ([
                "preset",
                "mode",
                "darkHue",
                "uiScale",
                "iconScale",
                "layoutDensity",
                "surfaceStyle",
            ] as $key) {
                $value = trim((string) ($themeSettings[$key] ?? ""));
                if ($value !== "") {
                    $normalized[$key] = $value;
                }
            }
        }

        if (empty($normalized) && $defaultToEmerald) {
            $normalized["preset"] = "emerald";
        }

        return empty($normalized) ? null : $normalized;
    }

    public function encodeThemeSettings(mixed $rawThemeSettings, bool $defaultToEmerald = false): ?string
    {
        $normalized = $this->normalizeThemeSettings($rawThemeSettings, $defaultToEmerald);
        if (!$normalized) {
            return null;
        }

        return json_encode($normalized);
    }

    public function presentUser(array $user, bool $includeRoles = false): array
    {
        $presented = AvatarUrl::withNormalizedAvatar($user);
        $presented["theme_settings"] = $this->normalizeThemeSettings($presented["theme_settings"] ?? null);
        $presented["phone"] = $presented["phone"] ?? null;

        if ($includeRoles && !isset($presented["roles"])) {
            $presented["roles"] = $this->resolveRoles(
                (string) ($presented["id"] ?? ""),
                $presented["email"] ?? null
            );
        }

        return $presented;
    }

    /**
     * @return string[]
     */
    public function resolveRoles(string $userId, ?string $email = null): array
    {
        $roles = ["buyer"];

        try {
            $roleRows = DB::table("user_roles")
                ->join("roles", "roles.id", "=", "user_roles.role_id")
                ->where("user_roles.user_id", $userId)
                ->select("roles.name")
                ->get();

            foreach ($roleRows as $row) {
                $name = strtolower(trim((string) ($row->name ?? "")));
                if ($name !== "" && !in_array($name, $roles, true)) {
                    $roles[] = $name;
                }
            }
        } catch (\Throwable) {
            // Keep fallback buyer role if role mapping tables are unavailable.
        }

        try {
            $composerRow = DB::table("composers")
                ->where("user_id", $userId)
                ->select("id", "is_active")
                ->first();
            if ($composerRow) {
                $isActive = !property_exists($composerRow, "is_active")
                    ? true
                    : (bool) ($composerRow->is_active ?? true);
                if ($isActive && !in_array("composer", $roles, true)) {
                    $roles[] = "composer";
                }
            }
        } catch (\Throwable) {
            // Ignore missing composer table/column in partially migrated environments.
        }

        $normalizedEmail = strtolower(trim((string) ($email ?? "")));
        if ($normalizedEmail !== "") {
            try {
                if ($this->isAdminEmail($normalizedEmail) && !in_array("admin", $roles, true)) {
                    $roles[] = "admin";
                }
            } catch (\Throwable) {
                // Ignore missing admin tables.
            }
        }

        return $roles;
    }

    public function isAdminEmail(string $normalizedEmail): bool
    {
        $configured = collect(explode(",", (string) env("ADMIN_IDENTIFIERS", "")))
            ->map(fn ($x) => strtolower(trim($x)))
            ->filter()
            ->values()
            ->all();

        if (in_array($normalizedEmail, $configured, true)) {
            return true;
        }

        try {
            return DB::table("admin_emails")
                ->whereRaw("LOWER(email) = ?", [$normalizedEmail])
                ->where("is_active", true)
                ->exists();
        } catch (\Throwable) {
            return false;
        }
    }

    public function isAdminUser(string $userId, ?string $email = null): bool
    {
        $roles = $this->resolveRoles($userId, $email);
        return in_array("admin", $roles, true);
    }

    public function ensureBuyerRoleMapping(string $userId): void
    {
        try {
            $buyerRole = DB::table("roles")->where("name", "buyer")->select("id")->first();
        } catch (\Throwable) {
            return;
        }
        if (!$buyerRole) {
            return;
        }

        try {
            $exists = DB::table("user_roles")
                ->where("user_id", $userId)
                ->where("role_id", $buyerRole->id)
                ->exists();
        } catch (\Throwable) {
            return;
        }

        if (!$exists) {
            try {
                DB::table("user_roles")->insert([
                    "user_id" => $userId,
                    "role_id" => $buyerRole->id,
                    "assigned_at" => now(),
                ]);
            } catch (\Throwable) {
                // Ignore duplicate/constraint race failures.
            }
        }
    }
}


