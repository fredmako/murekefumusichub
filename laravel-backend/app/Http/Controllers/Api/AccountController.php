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
    private const ALLOWED_THEME_MODES = ["light", "dark"];
    private const ALLOWED_THEME_DARK_HUES = ["plum", "midnight", "graphite", "forest-night", "ember"];
    private const ALLOWED_THEME_UI_SCALES = ["compact", "comfortable", "expanded"];
    private const ALLOWED_THEME_ICON_SCALES = ["compact", "comfortable", "expanded"];
    private const ALLOWED_THEME_LAYOUT_DENSITIES = ["compact", "comfortable", "airy"];
    private const ALLOWED_THEME_SURFACE_STYLES = ["glass", "solid", "soft"];

    public function __construct(private readonly RoleService $roleService)
    {
    }

    private function authUid(Request $request): string
    {
        return (string) $request->attributes->get("authUid", "");
    }

    private function normalizeThemeSettings(mixed $rawThemeSettings, ?array $existingThemeSettings = null): ?array
    {
        $incoming = $this->roleService->normalizeThemeSettings($rawThemeSettings);
        if ($incoming === null) {
            return null;
        }

        $merged = [
            ...($existingThemeSettings ?? []),
            ...$incoming,
        ];

        $preset = strtolower(trim((string) ($merged["preset"] ?? "")));
        if (!in_array($preset, self::ALLOWED_THEME_PRESETS, true)) {
            return null;
        }
        $merged["preset"] = $preset;

        foreach ([
            "mode" => self::ALLOWED_THEME_MODES,
            "darkHue" => self::ALLOWED_THEME_DARK_HUES,
            "uiScale" => self::ALLOWED_THEME_UI_SCALES,
            "iconScale" => self::ALLOWED_THEME_ICON_SCALES,
            "layoutDensity" => self::ALLOWED_THEME_LAYOUT_DENSITIES,
            "surfaceStyle" => self::ALLOWED_THEME_SURFACE_STYLES,
        ] as $key => $allowedValues) {
            if (!array_key_exists($key, $merged)) {
                continue;
            }

            $value = trim((string) ($merged[$key] ?? ""));
            if ($value === "") {
                unset($merged[$key]);
                continue;
            }

            if (!in_array($value, $allowedValues, true)) {
                return null;
            }

            $merged[$key] = $value;
        }

        return $merged;
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
        if ($request->has("email")) {
            $value = strtolower(trim((string) $request->input("email", "")));
            $updates["email"] = $value !== "" ? $value : null;
        }
        if ($request->has("phone")) {
            $value = trim((string) $request->input("phone", ""));
            $updates["phone"] = $value !== "" ? $value : null;
        }
        if ($request->has("avatarUrl")) {
            $updates["avatar_url"] = AvatarUrl::normalize($request->input("avatarUrl"));
        }
        if ($request->has("themeSettings")) {
            $normalizedThemeSettings = $this->normalizeThemeSettings(
                $request->input("themeSettings"),
                $this->roleService->normalizeThemeSettings($user["theme_settings"] ?? null)
            );
            if ($normalizedThemeSettings === null) {
                return response()->json([
                    "message" => "Invalid theme settings provided.",
                ], 400);
            }
            $updates["theme_settings"] = json_encode($normalizedThemeSettings);
        }

        if (empty($updates)) {
            return response()->json(["message" => "No updatable fields provided"], 400);
        }

        $updates["updated_at"] = now();
        DB::table("users")->where("id", $user["id"])->update($updates);
        $fresh = DB::table("users")->where("id", $user["id"])->first();
        $roles = $this->roleService->resolveRoles((string) $user["id"], $updates["email"] ?? ($user["email"] ?? null));

        return response()->json($this->roleService->presentUser([
            ...(array) $fresh,
            "roles" => $roles,
        ]));
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
