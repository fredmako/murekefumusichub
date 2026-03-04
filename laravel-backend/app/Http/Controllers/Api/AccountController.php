<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RoleService;
use App\Support\AvatarUrl;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AccountController extends Controller
{
    private const ALLOWED_THEME_PRESETS = ["emerald", "aurora", "ocean", "sunset", "forest"];

    public function __construct(private readonly RoleService $roleService)
    {
    }

    private function authUid(Request $request): string
    {
        return (string) $request->attributes->get("authUid", "");
    }

    public function update(Request $request)
    {
        $authUid = $this->authUid($request);
        if ($authUid === "") {
            return response()->json(["message" => "No auth uid"], 401);
        }

        $user = $this->roleService->resolveDbUserByAuthUid($authUid);
        if (!$user) {
            return response()->json(["message" => "User row not found"], 404);
        }

        $updates = [];
        if ($request->has("displayName")) {
            $value = trim((string) $request->input("displayName", ""));
            $updates["display_name"] = $value !== "" ? $value : null;
        }
        if ($request->has("avatarUrl")) {
            $updates["avatar_url"] = AvatarUrl::normalize($request->input("avatarUrl"));
        }
        if ($request->has("themeSettings")) {
            $theme = $request->input("themeSettings");
            $preset = strtolower(trim((string) data_get($theme, "preset", "")));
            if (!in_array($preset, self::ALLOWED_THEME_PRESETS, true)) {
                return response()->json([
                    "message" => "Invalid theme settings. Allowed presets: emerald, aurora, ocean, sunset, forest.",
                ], 400);
            }
            $updates["theme_settings"] = json_encode(["preset" => $preset]);
        }

        if (empty($updates)) {
            return response()->json(["message" => "No updatable fields provided"], 400);
        }

        $updates["updated_at"] = now();
        DB::table("users")->where("id", $user["id"])->update($updates);
        $fresh = DB::table("users")->where("id", $user["id"])->first();
        return response()->json(AvatarUrl::withNormalizedAvatar((array) $fresh));
    }

    public function destroy(Request $request)
    {
        $authUid = $this->authUid($request);
        if ($authUid === "") {
            return response()->json(["message" => "No auth uid"], 401);
        }

        $user = $this->roleService->resolveDbUserByAuthUid($authUid);
        if (!$user) {
            return response()->json(["message" => "User not found"], 404);
        }

        DB::transaction(function () use ($user) {
            DB::table("composers")->where("user_id", $user["id"])->delete();
            DB::table("user_roles")->where("user_id", $user["id"])->delete();
            DB::table("role_requests")->where("user_id", $user["id"])->delete();
            DB::table("users")->where("id", $user["id"])->delete();
        });

        return response()->json(["success" => true]);
    }
}
