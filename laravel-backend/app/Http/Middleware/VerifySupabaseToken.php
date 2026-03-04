<?php

namespace App\Http\Middleware;

use App\Services\SupabaseTokenService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifySupabaseToken
{
    public function __construct(private readonly SupabaseTokenService $tokenService)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $authHeader = (string) $request->header("Authorization", "");
        if (!str_starts_with($authHeader, "Bearer ")) {
            return response()->json(["message" => "No bearer token provided"], 401);
        }

        $token = trim(substr($authHeader, 7));
        if ($token === "") {
            return response()->json(["message" => "No bearer token provided"], 401);
        }

        try {
            $payload = $this->tokenService->verify($token);
        } catch (\Throwable $e) {
            return response()->json(["message" => $e->getMessage() ?: "Invalid or expired token"], 401);
        }

        $request->attributes->set("auth", $payload);
        $request->attributes->set("authUid", $payload["sub"]);

        return $next($request);
    }
}
