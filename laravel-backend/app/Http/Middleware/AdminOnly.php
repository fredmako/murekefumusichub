<?php

namespace App\Http\Middleware;

use App\Services\RoleService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AdminOnly
{
    public function __construct(private readonly RoleService $roleService)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $authUid = (string) $request->attributes->get("authUid", "");
        if ($authUid === "") {
            return response()->json(["message" => "Unauthorized"], 401);
        }

        $user = $this->roleService->resolveDbUserByAuthUid($authUid);
        if (!$user) {
            return response()->json(["message" => "Admin access required"], 403);
        }

        $isAdmin = $this->roleService->isAdminUser((string) $user["id"], $user["email"] ?? null);
        if (!$isAdmin) {
            return response()->json(["message" => "Admin access required"], 403);
        }

        $request->attributes->set("dbUser", $user);
        return $next($request);
    }
}
