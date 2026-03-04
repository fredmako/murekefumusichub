<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SupabaseStorageService;
use Illuminate\Http\Request;

class UploadController extends Controller
{
    private const BUCKET_MAX_SIZE_BYTES = [
        "avatars" => 8 * 1024 * 1024,
        "thumbnails" => 10 * 1024 * 1024,
        "compositions" => 30 * 1024 * 1024,
    ];

    public function __construct(private readonly SupabaseStorageService $storageService)
    {
    }

    public function upload(Request $request, string $bucket)
    {
        if (!in_array($bucket, ["avatars", "compositions", "thumbnails"], true)) {
            return response()->json(["message" => "Invalid bucket"], 400);
        }

        /** @var \Illuminate\Http\UploadedFile|null $file */
        $file = $request->file("file");
        if (!$file) {
            return response()->json(["message" => "File required"], 400);
        }

        $maxBytes = self::BUCKET_MAX_SIZE_BYTES[$bucket] ?? (30 * 1024 * 1024);
        if ($file->getSize() > $maxBytes) {
            return response()->json([
                "message" => "File too large for {$bucket}. Max size is " . floor($maxBytes / (1024 * 1024)) . "MB.",
            ], 413);
        }

        $mime = strtolower((string) ($file->getClientMimeType() ?: $file->getMimeType()));
        if (in_array($bucket, ["avatars", "thumbnails"], true) && !str_starts_with($mime, "image/")) {
            return response()->json(["message" => "Only image files are allowed for this bucket."], 400);
        }
        if ($bucket === "compositions" && !in_array($mime, ["application/pdf", "application/octet-stream"], true)) {
            return response()->json(["message" => "Only PDF files are allowed for compositions."], 400);
        }

        $authUid = (string) $request->attributes->get("authUid", "");
        if ($authUid === "") {
            return response()->json(["message" => "Unauthorized"], 401);
        }

        try {
            $upload = $this->storageService->upload($bucket, $file, $authUid);
        } catch (\Throwable $e) {
            return response()->json(["message" => $e->getMessage() ?: "Upload failed"], 500);
        }

        return response()->json([
            "success" => true,
            "url" => $upload["url"] ?? null,
        ]);
    }
}
