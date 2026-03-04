<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RoleService;

class RoleController extends Controller
{
    public function __construct(private readonly RoleService $roleService)
    {
    }

    public function rolesByAuthUid(string $authUid)
    {
        if (trim($authUid) === "") {
            return response()->json(["error" => "Auth UID is required"], 400);
        }

        $user = $this->roleService->resolveDbUserByAuthUid($authUid);
        if (!$user) {
            return response()->json(["buyer"]);
        }

        $roles = $this->roleService->resolveRoles((string) $user["id"], $user["email"] ?? null);
        $this->roleService->ensureBuyerRoleMapping((string) $user["id"]);

        return response()->json($roles);
    }
}
