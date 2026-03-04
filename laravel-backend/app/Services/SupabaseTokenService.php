<?php

namespace App\Services;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;

class SupabaseTokenService
{
    /**
     * @return array{sub: string, email: string|null, user_metadata: array, app_metadata: array}
     */
    public function verify(string $token): array
    {
        $jwtSecret = trim((string) env("SUPABASE_JWT_SECRET", ""));

        // Prefer local HS256 verification when secret is configured.
        if ($jwtSecret !== "") {
            try {
                $payload = (array) JWT::decode($token, new Key($jwtSecret, "HS256"));
                $sub = (string) Arr::get($payload, "sub", "");
                if ($sub !== "") {
                    return [
                        "sub" => $sub,
                        "email" => Arr::get($payload, "email"),
                        "user_metadata" => (array) Arr::get($payload, "user_metadata", []),
                        "app_metadata" => (array) Arr::get($payload, "app_metadata", []),
                    ];
                }
            } catch (\Throwable) {
                // Fallback to auth introspection.
            }
        }

        $supabaseUrl = rtrim((string) env("SUPABASE_URL"), "/");
        if ($supabaseUrl === "") {
            throw new \RuntimeException("SUPABASE_URL is not configured.");
        }

        $apiKey = (string) (env("SUPABASE_ANON_KEY") ?: env("SUPABASE_SERVICE_ROLE_KEY"));
        if ($apiKey === "") {
            throw new \RuntimeException("SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY is required for token fallback verification.");
        }

        $response = Http::withHeaders([
            "Authorization" => "Bearer {$token}",
            "apikey" => $apiKey,
        ])->acceptJson()->get("{$supabaseUrl}/auth/v1/user");

        if (!$response->successful()) {
            throw new \RuntimeException("Invalid or expired token.");
        }

        $user = (array) $response->json();
        $sub = (string) Arr::get($user, "id", "");
        if ($sub === "") {
            throw new \RuntimeException("Invalid auth payload.");
        }

        return [
            "sub" => $sub,
            "email" => Arr::get($user, "email"),
            "user_metadata" => (array) Arr::get($user, "user_metadata", []),
            "app_metadata" => (array) Arr::get($user, "app_metadata", []),
        ];
    }
}
