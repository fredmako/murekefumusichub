<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RoleService;
use App\Support\AvatarUrl;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function __construct(private readonly RoleService $roleService)
    {
    }

    public function register(Request $request)
    {
        $email = strtolower(trim((string) $request->input("email", "")));
        $displayName = trim((string) $request->input("displayName", ""));
        if ($email === "") {
            return response()->json(["message" => "email is required"], 400);
        }

        $existing = DB::table("users")
            ->whereRaw("LOWER(email) = ?", [$email])
            ->first();
        if ($existing) {
            return response()->json([
                "message" => "User already exists",
                "user" => AvatarUrl::withNormalizedAvatar((array) $existing),
            ], 409);
        }

        $id = (string) Str::uuid();
        DB::table("users")->insert([
            "id" => $id,
            "email" => $email,
            "display_name" => $displayName !== "" ? $displayName : null,
            "theme_settings" => json_encode(["preset" => "emerald"]),
            "created_at" => now(),
            "updated_at" => now(),
        ]);

        $user = DB::table("users")->where("id", $id)->first();
        return response()->json([
            "success" => true,
            "user" => AvatarUrl::withNormalizedAvatar((array) $user),
        ], 201);
    }

    public function login()
    {
        // Supabase Auth handles login on frontend; keep endpoint for compatibility.
        return response()->json([
            "success" => true,
            "message" => "Use Supabase Auth client-side login.",
        ]);
    }

    public function logout()
    {
        return response()->json([
            "success" => true,
            "message" => "Logged out",
        ]);
    }

    public function syncUser(Request $request)
    {
        $authUid = (string) $request->attributes->get("authUid", "");
        if ($authUid === "") {
            return response()->json(["message" => "Unauthorized"], 401);
        }

        $email = strtolower(trim((string) $request->input("email", "")));
        $displayName = trim((string) $request->input("display_name", ""));
        $phone = trim((string) $request->input("phone", ""));
        $avatar = AvatarUrl::normalize($request->input("avatar_url"));
        $themeSettings = $this->roleService->normalizeThemeSettings(
            $request->input("theme_settings"),
            true
        );

        $user = $this->roleService->resolveDbUserByAuthUid($authUid);
        if ($user) {
            $updates = [];
            if ($email !== "") {
                $updates["email"] = $email;
            }
            if ($displayName !== "") {
                $updates["display_name"] = $displayName;
            }
            if ($phone !== "") {
                $updates["phone"] = $phone;
            }
            if ($avatar !== null) {
                $updates["avatar_url"] = $avatar;
            }
            if ($themeSettings !== null) {
                $updates["theme_settings"] = json_encode($themeSettings);
            }
            if (!empty($updates)) {
                $updates["updated_at"] = now();
                DB::table("users")->where("id", $user["id"])->update($updates);
            }
        } else {
            $id = (string) Str::uuid();
            DB::table("users")->insert([
                "id" => $id,
                "auth_uid" => $authUid,
                "email" => $email !== "" ? $email : null,
                "display_name" => $displayName !== "" ? $displayName : null,
                "phone" => $phone !== "" ? $phone : null,
                "avatar_url" => $avatar,
                "theme_settings" => json_encode($themeSettings ?? ["preset" => "emerald"]),
                "created_at" => now(),
                "updated_at" => now(),
            ]);
        }

        $fresh = $this->roleService->resolveDbUserByAuthUid($authUid);
        $roles = $fresh
            ? $this->roleService->resolveRoles((string) $fresh["id"], $fresh["email"] ?? null)
            : [];

        return response()->json([
            "success" => true,
            "user" => $fresh
                ? $this->roleService->presentUser([
                    ...$fresh,
                    "roles" => $roles,
                ])
                : null,
        ]);
    }

    public function me(Request $request)
    {
        $authUid = (string) $request->attributes->get("authUid", "");
        if ($authUid === "") {
            return response()->json(["message" => "Unauthorized"], 401);
        }

        $user = $this->roleService->resolveDbUserByAuthUid($authUid);
        if (!$user) {
            return response()->json(["message" => "User not found"], 404);
        }

        $roles = $this->roleService->resolveRoles($user["id"], $user["email"] ?? null);
        return response()->json($this->roleService->presentUser([
            ...$user,
            "roles" => $roles,
        ]));
    }
}
