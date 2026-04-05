<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class SupabaseStorageService
{
    private function supabaseUrl(): string
    {
        return rtrim((string) env("SUPABASE_URL"), "/");
    }

    private function serviceRoleKey(): string
    {
        return (string) env("SUPABASE_SERVICE_ROLE_KEY");
    }

    private function baseHeaders(): array
    {
        $key = $this->serviceRoleKey();
        return [
            "Authorization" => "Bearer {$key}",
            "apikey" => $key,
        ];
    }

    private function uploadPath(string $authUid, string $originalName): string
    {
        $ext = pathinfo($originalName, PATHINFO_EXTENSION);
        $ext = $ext ? ".{$ext}" : "";
        return "{$authUid}/" . now()->timestamp . "-" . Str::random(12) . $ext;
    }

    public function upload(string $bucket, UploadedFile $file, string $authUid): array
    {
        $path = $this->uploadPath($authUid, $file->getClientOriginalName());
        $url = "{$this->supabaseUrl()}/storage/v1/object/{$bucket}/{$path}";
        $mimeType = $file->getMimeType() ?: "application/octet-stream";

        $uploadResponse = Http::withHeaders([
            ...$this->baseHeaders(),
            "Content-Type" => $mimeType,
            "x-upsert" => "false",
        ])->withBody(file_get_contents($file->getRealPath()), $mimeType)
            ->post($url);

        if (!$uploadResponse->successful()) {
            throw new \RuntimeException("Storage upload failed: {$uploadResponse->body()}");
        }

        if ($bucket === "avatars" || $bucket === "community") {
            $publicUrl = "{$this->supabaseUrl()}/storage/v1/object/public/{$bucket}/{$path}";
            return [
                "path" => $path,
                "url" => $publicUrl,
                "bucket" => $bucket,
                "mimeType" => $mimeType,
            ];
        }

        $signed = $this->createSignedUrl($bucket, $path, 3600);
        if ($signed) {
            return [
                "path" => $path,
                "url" => $signed,
                "bucket" => $bucket,
                "mimeType" => $mimeType,
            ];
        }

        $fallbackPublic = "{$this->supabaseUrl()}/storage/v1/object/public/{$bucket}/{$path}";
        return [
            "path" => $path,
            "url" => $fallbackPublic,
            "bucket" => $bucket,
            "mimeType" => $mimeType,
        ];
    }

    public function createSignedUrl(string $bucket, string $path, int $expiresIn = 3600): ?string
    {
        $url = "{$this->supabaseUrl()}/storage/v1/object/sign/{$bucket}/{$path}";
        $response = Http::withHeaders($this->baseHeaders())->post($url, [
            "expiresIn" => $expiresIn,
        ]);

        if (!$response->successful()) {
            return null;
        }

        $data = (array) $response->json();
        $signedPath = $data["signedURL"] ?? $data["signedUrl"] ?? null;
        if (!$signedPath) {
            return null;
        }

        if (str_starts_with($signedPath, "http://") || str_starts_with($signedPath, "https://")) {
            return $signedPath;
        }

        return "{$this->supabaseUrl()}/storage/v1{$signedPath}";
    }

    public function download(string $bucket, string $path): ?string
    {
        $url = "{$this->supabaseUrl()}/storage/v1/object/{$bucket}/{$path}";
        $response = Http::withHeaders($this->baseHeaders())->get($url);

        if (!$response->successful()) {
            return null;
        }

        return $response->body();
    }

    public function fetchAuthenticatedUser(string $bearerToken): ?array
    {
        $url = "{$this->supabaseUrl()}/auth/v1/user";
        $apiKey = (string) (env("SUPABASE_ANON_KEY") ?: $this->serviceRoleKey());
        if ($apiKey === "") {
            return null;
        }

        $response = Http::withHeaders([
            "Authorization" => "Bearer {$bearerToken}",
            "apikey" => $apiKey,
        ])->acceptJson()->get($url);

        if (!$response->successful()) {
            return null;
        }

        $data = (array) $response->json();
        if (!isset($data["id"])) {
            return null;
        }

        return $data;
    }
}
