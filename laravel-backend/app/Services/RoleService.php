<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class RoleService
{
    public function resolveDbUserByAuthUid(string $authUid): ?array
    {
        $row = DB::table("users")
            ->select("id", "auth_uid", "email", "display_name", "avatar_url", "theme_settings", "is_active")
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
            ->select("id", "auth_uid", "email", "display_name", "avatar_url", "theme_settings", "is_active")
            ->where("id", $id)
            ->first();
        if ($byId) {
            return (array) $byId;
        }

        $byAuth = DB::table("users")
            ->select("id", "auth_uid", "email", "display_name", "avatar_url", "theme_settings", "is_active")
            ->where("auth_uid", $id)
            ->first();

        return $byAuth ? (array) $byAuth : null;
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
                ->select("id")
                ->first();
            if ($composerRow && !in_array("composer", $roles, true)) {
                $roles[] = "composer";
            }
        } catch (\Throwable) {
            // Ignore missing composer table in partially migrated environments.
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
