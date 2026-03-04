<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AllowConfiguredCors
{
    /**
     * @return string[]
     */
    private function allowedOrigins(): array
    {
        $raw = [
            (string) env("CORS_ORIGIN", ""),
            (string) env("ALLOWED_ORIGINS", ""),
        ];

        $items = [];
        foreach ($raw as $chunk) {
            foreach (explode(",", $chunk) as $origin) {
                $origin = trim($origin);
                if ($origin !== "") {
                    $items[] = $origin;
                }
            }
        }

        return array_values(array_unique($items));
    }

    public function handle(Request $request, Closure $next): Response
    {
        $origin = (string) $request->headers->get("Origin", "");
        $allowed = $this->allowedOrigins();
        $allowAny = count($allowed) === 0 || in_array("*", $allowed, true);

        if (!$allowAny && $origin !== "" && !in_array($origin, $allowed, true)) {
            return response()->json(["message" => "CORS blocked for origin: {$origin}"], 403);
        }

        if ($request->getMethod() === "OPTIONS") {
            $response = response("", 204);
        } else {
            $response = $next($request);
        }

        $allowOrigin = $origin !== "" ? $origin : ($allowAny ? "*" : ($allowed[0] ?? "*"));
        $response->headers->set("Access-Control-Allow-Origin", $allowOrigin);
        $response->headers->set("Vary", "Origin");
        $response->headers->set("Access-Control-Allow-Credentials", "true");
        $response->headers->set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Requested-With");
        $response->headers->set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");

        return $response;
    }
}
