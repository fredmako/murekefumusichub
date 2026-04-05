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
        "community" => 30 * 1024 * 1024,
    ];

    private const COMMUNITY_DOCUMENT_MIME_TYPES = [
        "application/pdf",
        "text/plain",
        "text/csv",
        "application/rtf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ];

    private const COMMUNITY_DOCUMENT_EXTENSIONS = [
        ".pdf",
        ".doc",
        ".docx",
        ".txt",
        ".rtf",
        ".csv",
        ".xls",
        ".xlsx",
        ".ppt",
        ".pptx",
    ];

    public function __construct(private readonly SupabaseStorageService $storageService)
    {
    }

    public function upload(Request $request, string $bucket)
    {
        if (!in_array($bucket, ["avatars", "compositions", "thumbnails", "community"], true)) {
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
        $extension = "." . strtolower((string) $file->getClientOriginalExtension());
        if (in_array($bucket, ["avatars", "thumbnails"], true) && !str_starts_with($mime, "image/")) {
            return response()->json(["message" => "Only image files are allowed for this bucket."], 400);
        }
        if ($bucket === "compositions") {
            $allowedCompositionMimeTypes = [
                "application/pdf",
                "application/octet-stream",
                "audio/midi",
                "audio/x-midi",
                "audio/mid",
                "application/x-midi",
            ];
            $isMidiExtension = in_array($extension, [".mid", ".midi"], true);
            $isPdfExtension = $extension === ".pdf";

            if (
                !in_array($mime, $allowedCompositionMimeTypes, true)
                && !($mime === "application/octet-stream" && ($isMidiExtension || $isPdfExtension))
            ) {
                return response()->json(["message" => "Only PDF or MIDI files are allowed for compositions."], 400);
            }
        }
        if ($bucket === "community") {
            $isSupportedCommunityAttachment = str_starts_with($mime, "image/")
                || str_starts_with($mime, "video/")
                || str_starts_with($mime, "audio/")
                || in_array($mime, self::COMMUNITY_DOCUMENT_MIME_TYPES, true)
                || in_array($extension, self::COMMUNITY_DOCUMENT_EXTENSIONS, true);

            if (!$isSupportedCommunityAttachment) {
                return response()->json([
                    "message" => "Community attachments must be an image, video, audio file, or supported document.",
                ], 400);
            }
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
            "path" => $upload["path"] ?? null,
            "bucket" => $upload["bucket"] ?? $bucket,
            "mimeType" => $upload["mimeType"] ?? $mime,
        ]);
    }
}
