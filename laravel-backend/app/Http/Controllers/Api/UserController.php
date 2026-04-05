<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RoleService;
use App\Support\AvatarUrl;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class UserController extends Controller
{
    public function __construct(private readonly RoleService $roleService)
    {
    }

    public function show(string $id)
    {
        $row = DB::table("users")
            ->select("id", "auth_uid", "email", "display_name", "phone", "avatar_url", "theme_settings", "created_at")
            ->where("id", $id)
            ->first();

        if (!$row) {
            return response()->json(["message" => "User not found"], 404);
        }

        $user = (array) $row;
        $roles = $this->roleService->resolveRoles((string) $user["id"], $user["email"] ?? null);
        return response()->json($this->roleService->presentUser([
            ...$user,
            "roles" => $roles,
        ]));
    }

    public function byAuthUid(string $authUid)
    {
        $row = DB::table("users")
            ->select("id", "auth_uid", "email", "display_name", "phone", "avatar_url", "theme_settings", "created_at")
            ->where("auth_uid", $authUid)
            ->first();

        if (!$row) {
            return response()->json(["message" => "User not found"], 404);
        }

        $user = (array) $row;
        $roles = $this->roleService->resolveRoles((string) $user["id"], $user["email"] ?? null);
        return response()->json($this->roleService->presentUser([
            ...$user,
            "roles" => $roles,
        ]));
    }

    public function ensure(Request $request)
    {
        $authUid = trim((string) $request->input("auth_uid", ""));
        if ($authUid === "") {
            return response()->json(["message" => "auth_uid required"], 400);
        }

        $email = trim(strtolower((string) $request->input("email", "")));
        $displayName = trim((string) $request->input("display_name", ""));
        $phone = trim((string) $request->input("phone", ""));
        $avatarUrl = AvatarUrl::normalize($request->input("avatar_url"));
        $themeSettings = $this->roleService->normalizeThemeSettings(
            $request->input("theme_settings"),
            true
        ) ?? ["preset" => "emerald"];

        $existing = DB::table("users")
            ->select("id", "auth_uid", "email", "display_name", "phone", "avatar_url", "theme_settings")
            ->where("auth_uid", $authUid)
            ->first();
        if ($existing) {
            return response()->json($this->roleService->presentUser((array) $existing));
        }

        if ($email !== "") {
            $emailMatch = DB::table("users")
                ->select("id", "auth_uid", "email", "display_name", "phone", "avatar_url", "theme_settings")
                ->whereRaw("LOWER(email) = ?", [$email])
                ->first();

            if ($emailMatch) {
                $mergedThemeSettings = $this->roleService->normalizeThemeSettings(
                    $themeSettings,
                    true
                ) ?? ["preset" => "emerald"];
                DB::table("users")->where("id", $emailMatch->id)->update([
                    "auth_uid" => $authUid,
                    "display_name" => $displayName !== "" ? $displayName : $emailMatch->display_name,
                    "phone" => $phone !== "" ? $phone : $emailMatch->phone,
                    "avatar_url" => $avatarUrl ?: $emailMatch->avatar_url,
                    "theme_settings" => json_encode($mergedThemeSettings),
                    "updated_at" => now(),
                ]);

                $updated = DB::table("users")
                    ->select("id", "auth_uid", "email", "display_name", "phone", "avatar_url", "theme_settings")
                    ->where("id", $emailMatch->id)
                    ->first();

                return response()->json($this->roleService->presentUser((array) $updated));
            }
        }

        $insert = [
            "id" => (string) Str::uuid(),
            "auth_uid" => $authUid,
            "email" => $email !== "" ? $email : null,
            "display_name" => $displayName !== "" ? $displayName : null,
            "phone" => $phone !== "" ? $phone : null,
            "avatar_url" => $avatarUrl,
            "theme_settings" => json_encode($themeSettings),
            "created_at" => now(),
            "updated_at" => now(),
        ];

        DB::table("users")->insert($insert);
        $id = $insert["id"];
        $created = DB::table("users")
            ->select("id", "auth_uid", "email", "display_name", "phone", "avatar_url", "theme_settings")
            ->where("id", $id)
            ->first();

        return response()->json($this->roleService->presentUser((array) $created), 201);
    }

    public function update(Request $request, string $id)
    {
        $updates = [];

        if ($request->has("display_name")) {
            $name = trim((string) $request->input("display_name", ""));
            $updates["display_name"] = $name !== "" ? $name : null;
        }
        if ($request->has("phone")) {
            $phone = trim((string) $request->input("phone", ""));
            $updates["phone"] = $phone !== "" ? $phone : null;
        }
        if ($request->has("email")) {
            $email = trim((string) $request->input("email", ""));
            $updates["email"] = $email !== "" ? strtolower($email) : null;
        }
        if ($request->has("avatar_url")) {
            $updates["avatar_url"] = AvatarUrl::normalize($request->input("avatar_url"));
        }
        if ($request->has("theme_settings")) {
            $updates["theme_settings"] = $this->roleService->encodeThemeSettings(
                $request->input("theme_settings"),
                true
            );
        }

        if (empty($updates)) {
            return response()->json(["message" => "No updatable fields provided"], 400);
        }

        $updates["updated_at"] = now();
        $affected = DB::table("users")->where("id", $id)->update($updates);
        if ($affected === 0) {
            return response()->json(["message" => "User not found"], 404);
        }

        $row = DB::table("users")->where("id", $id)->first();
        $roles = $this->roleService->resolveRoles((string) $row->id, $row->email ?? null);
        return response()->json([
            "message" => "User updated",
            "user" => $this->roleService->presentUser([
                ...(array) $row,
                "roles" => $roles,
            ]),
        ]);
    }
}
