<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RoleService;
use App\Services\SupabaseStorageService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class CompositionController extends Controller
{
    private const PRICE_CURRENCY_DEFAULT = "USD";
    private const DIFFICULTY_OPTIONS = ["Easy", "Intermediate", "Advanced"];
    private const LANGUAGE_OPTIONS = ["English", "Latin", "German", "French", "Italian", "Spanish"];
    private const ACCOMPANIMENT_OPTIONS = ["A cappella", "Piano", "Organ", "String Quartet", "Orchestra"];
    private const VOICE_PART_OPTIONS = ["Soprano", "Alto", "Tenor", "Bass", "Soprano I", "Soprano II"];

    public function __construct(
        private readonly RoleService $roleService,
        private readonly SupabaseStorageService $storageService
    ) {
    }

    private function parseLimit(mixed $raw, int $fallback = 120, int $max = 500): int
    {
        $n = (int) $raw;
        if ($n <= 0) {
            return $fallback;
        }
        return min($n, $max);
    }

    private function normalizePriceCurrency(?string $raw): string
    {
        $value = strtoupper(trim((string) ($raw ?? "")));
        if ($value === "") {
            return self::PRICE_CURRENCY_DEFAULT;
        }
        return substr($value, 0, 16);
    }

    private function decodeVoiceParts(mixed $value): ?array
    {
        if (is_array($value)) {
            return $value;
        }

        $raw = trim((string) $value);
        if ($raw === "") {
            return null;
        }

        if (str_starts_with($raw, "{") || str_starts_with($raw, "[")) {
            try {
                $decoded = json_decode($raw, true, flags: JSON_THROW_ON_ERROR);
                return is_array($decoded) ? array_values($decoded) : null;
            } catch (\Throwable) {
                return null;
            }
        }

        return null;
    }

    private function compositionBaseQuery()
    {
        return DB::table("compositions")
            ->leftJoin("composers", "composers.id", "=", "compositions.composer_id")
            ->leftJoin("users as composer_users", "composer_users.id", "=", "composers.user_id")
            ->leftJoin("categories", "categories.id", "=", "compositions.category_id")
            ->leftJoin("composition_stats", "composition_stats.composition_id", "=", "compositions.id")
            ->select([
                "compositions.id",
                "compositions.composer_id",
                "compositions.title",
                "compositions.description",
                "compositions.category_id",
                "compositions.price",
                "compositions.pdf_url",
                "compositions.thumbnail_url",
                "compositions.created_at",
                "compositions.updated_at",
                "compositions.duration",
                "compositions.difficulty",
                "compositions.language",
                "compositions.accompaniment",
                "compositions.voice_parts",
                "compositions.deleted",
                "compositions.is_published",
                "categories.name as category_name",
                "composers.id as composer_table_id",
                "composer_users.display_name as composer_display_name",
                "composer_users.email as composer_email",
                "composition_stats.views as stats_views",
                "composition_stats.purchases as stats_purchases",
            ]);
    }

    private function mapCompositionRow(object $row): array
    {
        $mapped = [
            "id" => $row->id,
            "composer_id" => $row->composer_id,
            "title" => $row->title,
            "description" => $row->description,
            "category_id" => $row->category_id,
            "price" => $row->price,
            "pdf_url" => $row->pdf_url,
            "thumbnail_url" => $row->thumbnail_url,
            "created_at" => $row->created_at,
            "updated_at" => $row->updated_at,
            "duration" => $row->duration,
            "difficulty" => $row->difficulty,
            "language" => $row->language,
            "accompaniment" => $row->accompaniment,
            "voice_parts" => $this->decodeVoiceParts($row->voice_parts),
            "deleted" => (bool) ($row->deleted ?? false),
            "is_published" => (bool) ($row->is_published ?? false),
            "categories" => ["name" => $row->category_name],
            "composers" => [
                "id" => $row->composer_table_id,
                "users" => [
                    "display_name" => $row->composer_display_name,
                    "email" => $row->composer_email,
                ],
            ],
            "composition_stats" => [
                "views" => (int) ($row->stats_views ?? 0),
                "purchases" => (int) ($row->stats_purchases ?? 0),
            ],
        ];

        if (Schema::hasColumn("compositions", "price_currency")) {
            $mapped["price_currency"] = $this->normalizePriceCurrency((string) ($row->price_currency ?? ""));
        } else {
            $mapped["price_currency"] = self::PRICE_CURRENCY_DEFAULT;
        }

        return $mapped;
    }

    private function extractCompositionStoragePath(?string $pdfUrl): ?string
    {
        $raw = trim((string) ($pdfUrl ?? ""));
        if ($raw === "") {
            return null;
        }

        if (!preg_match("/^https?:\\/\\//i", $raw)) {
            return ltrim($raw, "/");
        }

        if (preg_match("#/storage/v1/object/(?:sign|public)/compositions/([^?]+)#i", $raw, $matches) === 1) {
            return urldecode($matches[1]);
        }

        return null;
    }

    private function refreshSignedPdfUrl(array $composition): array
    {
        $path = $this->extractCompositionStoragePath((string) ($composition["pdf_url"] ?? ""));
        if (!$path) {
            return $composition;
        }

        $signed = $this->storageService->createSignedUrl("compositions", $path, 3600);
        if ($signed) {
            $composition["pdf_url"] = $signed;
        }

        return $composition;
    }

    private function firstNonEmptyLine(string $text): string
    {
        foreach (preg_split("/\\r\\n|\\r|\\n/", $text) as $line) {
            $line = trim($line);
            if ($line !== "") {
                return $line;
            }
        }
        return "";
    }

    private function detectDifficulty(string $text): string
    {
        $lower = strtolower($text);
        if (str_contains($lower, "advanced") || str_contains($lower, "virtuoso") || str_contains($lower, "professional")) {
            return "Advanced";
        }
        if (str_contains($lower, "intermediate") || str_contains($lower, "moderate") || str_contains($lower, "medium")) {
            return "Intermediate";
        }
        return "Easy";
    }

    private function detectLanguage(string $text): string
    {
        $lower = strtolower($text);

        if (preg_match("/\\b(kyrie|gloria|sanctus|agnus|dei|miserere|alleluia|magnificat)\\b/i", $lower)) {
            return "Latin";
        }
        if (preg_match("/\\b(und|der|die|das|herr|gott|ist)\\b/i", $lower)) {
            return "German";
        }
        if (preg_match("/\\b(le|la|les|bonjour|seigneur|dieu)\\b/i", $lower)) {
            return "French";
        }
        if (preg_match("/\\b(il|lo|gli|signore|dio|ave)\\b/i", $lower)) {
            return "Italian";
        }
        if (preg_match("/\\b(el|la|los|las|dios|señor)\\b/i", $lower)) {
            return "Spanish";
        }
        return "English";
    }

    private function detectAccompaniment(string $text): string
    {
        $lower = strtolower($text);
        if (str_contains($lower, "a cappella") || str_contains($lower, "acappella")) {
            return "A cappella";
        }
        if (str_contains($lower, "string quartet")) {
            return "String Quartet";
        }
        if (str_contains($lower, "orchestra")) {
            return "Orchestra";
        }
        if (str_contains($lower, "organ")) {
            return "Organ";
        }
        if (str_contains($lower, "piano")) {
            return "Piano";
        }
        return "A cappella";
    }

    private function detectVoiceParts(string $text): array
    {
        $lower = strtolower($text);
        $found = [];
        if (preg_match("/\\bsoprano\\s*i\\b/i", $lower)) {
            $found[] = "Soprano I";
        }
        if (preg_match("/\\bsoprano\\s*ii\\b/i", $lower)) {
            $found[] = "Soprano II";
        }
        if (preg_match("/\\bsoprano\\b/i", $lower) && !in_array("Soprano", $found, true)) {
            $found[] = "Soprano";
        }
        if (preg_match("/\\balto\\b/i", $lower)) {
            $found[] = "Alto";
        }
        if (preg_match("/\\btenor\\b/i", $lower)) {
            $found[] = "Tenor";
        }
        if (preg_match("/\\bbass\\b/i", $lower)) {
            $found[] = "Bass";
        }
        if (count($found) === 0 && preg_match("/\\bsatb\\b/i", $lower)) {
            $found = ["Soprano", "Alto", "Tenor", "Bass"];
        }
        return $found;
    }

    private function detectDuration(string $text): string
    {
        if (preg_match("/\\b([0-5]?\\d:[0-5]\\d)\\b/", $text, $match) === 1) {
            return (string) $match[1];
        }
        return "";
    }

    private function extractTextFromPdfContent(string $binary): string
    {
        // Best-effort extraction without mandatory native extension.
        // If a parser package is installed, it can be swapped in later.
        $decoded = @iconv("UTF-8", "UTF-8//IGNORE", $binary);
        $decoded = $decoded === false ? $binary : $decoded;
        $text = preg_replace('/[^\P{C}\n\r\t]+/u', ' ', $decoded) ?? "";
        $text = preg_replace('/\s+/', ' ', $text) ?? "";
        return trim($text);
    }

    private function heuristicMetadata(string $text): array
    {
        $title = mb_substr($this->firstNonEmptyLine($text) ?: "Untitled Composition", 0, 120);
        return [
            "title" => $title,
            "description" => "Auto-generated from your uploaded PDF score. Please review and edit before publishing.",
            "difficulty" => $this->detectDifficulty($text),
            "duration" => $this->detectDuration($text),
            "language" => $this->detectLanguage($text),
            "accompaniment" => $this->detectAccompaniment($text),
            "voiceParts" => $this->detectVoiceParts($text),
        ];
    }

    private function normalizeOption(string $value, array $options, string $fallback): string
    {
        foreach ($options as $option) {
            if (strtolower(trim($option)) === strtolower(trim($value))) {
                return $option;
            }
        }
        return $fallback;
    }

    private function normalizeMetadata(?array $raw, array $fallback): array
    {
        $safe = is_array($raw) ? $raw : [];
        $voiceParts = [];
        if (isset($safe["voiceParts"]) && is_array($safe["voiceParts"])) {
            foreach ($safe["voiceParts"] as $part) {
                $normalized = $this->normalizeOption((string) $part, self::VOICE_PART_OPTIONS, "");
                if ($normalized !== "") {
                    $voiceParts[] = $normalized;
                }
            }
        } else {
            $voiceParts = $fallback["voiceParts"] ?? [];
        }

        return [
            "title" => mb_substr(trim((string) ($safe["title"] ?? $fallback["title"] ?? "Untitled Composition")), 0, 255),
            "description" => mb_substr(trim((string) ($safe["description"] ?? $fallback["description"] ?? "")), 0, 1000),
            "difficulty" => $this->normalizeOption((string) ($safe["difficulty"] ?? ""), self::DIFFICULTY_OPTIONS, $fallback["difficulty"]),
            "duration" => mb_substr(trim((string) ($safe["duration"] ?? $fallback["duration"] ?? "")), 0, 20),
            "language" => $this->normalizeOption((string) ($safe["language"] ?? ""), self::LANGUAGE_OPTIONS, $fallback["language"]),
            "accompaniment" => $this->normalizeOption((string) ($safe["accompaniment"] ?? ""), self::ACCOMPANIMENT_OPTIONS, $fallback["accompaniment"]),
            "voiceParts" => array_values(array_unique(array_slice($voiceParts, 0, 6))),
        ];
    }

    private function analyzeMetadataWithAI(string $text): ?array
    {
        $key = trim((string) env("OPENAI_API_KEY", ""));
        if ($key === "") {
            return null;
        }

        $model = (string) env("OPENAI_MODEL", "gpt-4o-mini");
        $payloadText = mb_substr($text, 0, 15000);

        $response = Http::withToken($key)->acceptJson()->post("https://api.openai.com/v1/chat/completions", [
            "model" => $model,
            "temperature" => 0.2,
            "response_format" => ["type" => "json_object"],
            "messages" => [
                [
                    "role" => "system",
                    "content" => "Extract choral composition metadata from score text. Return JSON only with keys: title, description, difficulty, duration, language, accompaniment, voiceParts. difficulty must be one of Easy|Intermediate|Advanced. accompaniment must be one of A cappella|Piano|Organ|String Quartet|Orchestra. language must be one of English|Latin|German|French|Italian|Spanish. voiceParts must be an array using only Soprano|Alto|Tenor|Bass|Soprano I|Soprano II.",
                ],
                [
                    "role" => "user",
                    "content" => $payloadText,
                ],
            ],
            "max_tokens" => 400,
        ]);

        if (!$response->successful()) {
            throw new \RuntimeException("OpenAI request failed: " . $response->body());
        }

        $content = data_get($response->json(), "choices.0.message.content");
        if (!is_string($content) || trim($content) === "") {
            return null;
        }

        try {
            return json_decode($content, true, flags: JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            $start = strpos($content, "{");
            $end = strrpos($content, "}");
            if ($start !== false && $end !== false && $end > $start) {
                try {
                    return json_decode(substr($content, $start, ($end - $start + 1)), true, flags: JSON_THROW_ON_ERROR);
                } catch (\Throwable) {
                    return null;
                }
            }
            return null;
        }
    }

    public function analyzePdf(Request $request)
    {
        $file = $request->file("file");
        if (!$file) {
            return response()->json(["message" => "PDF file is required"], 400);
        }
        if (($file->getClientMimeType() ?: $file->getMimeType()) !== "application/pdf") {
            return response()->json(["message" => "Only PDF files are supported"], 400);
        }

        $binary = file_get_contents($file->getRealPath());
        $text = $this->extractTextFromPdfContent($binary ?: "");
        if ($text === "") {
            return response()->json(["message" => "Could not extract readable text from this PDF"], 422);
        }

        $heuristic = $this->heuristicMetadata($text);
        $source = "heuristic";
        $ai = null;
        try {
            $ai = $this->analyzeMetadataWithAI($text);
            if ($ai) {
                $source = "ai";
            }
        } catch (\Throwable) {
            // Fall through to heuristic metadata.
        }

        $metadata = $this->normalizeMetadata($ai, $heuristic);
        return response()->json([
            "success" => true,
            "source" => $source,
            "metadata" => $metadata,
        ]);
    }

    public function index(Request $request)
    {
        $query = $this->compositionBaseQuery()
            ->where("compositions.is_published", true)
            ->where("compositions.deleted", false)
            ->orderByDesc("compositions.created_at")
            ->limit($this->parseLimit($request->query("limit"), 120, 500));

        if ($request->filled("category")) {
            $query->where("compositions.category_id", $request->query("category"));
        }
        if ($request->filled("search")) {
            $search = "%" . trim((string) $request->query("search")) . "%";
            $query->where(function ($q) use ($search) {
                $q->where("compositions.title", "ilike", $search)
                    ->orWhere("compositions.description", "ilike", $search);
            });
        }

        $rows = $query->get()->map(fn ($row) => $this->mapCompositionRow($row))->values();
        return response()->json($rows);
    }

    public function byComposer(string $composerId)
    {
        if (trim($composerId) === "") {
            return response()->json(["message" => "composerId is required"], 400);
        }

        $rows = $this->compositionBaseQuery()
            ->where("compositions.composer_id", $composerId)
            ->where("compositions.deleted", false)
            ->orderByDesc("compositions.created_at")
            ->get()
            ->map(fn ($row) => $this->mapCompositionRow($row))
            ->values();

        return response()->json($rows);
    }

    public function show(string $id)
    {
        if (trim($id) === "") {
            return response()->json(["message" => "id is required"], 400);
        }

        $row = $this->compositionBaseQuery()
            ->where("compositions.id", $id)
            ->first();

        if (!$row) {
            return response()->json(["message" => "Composition not found"], 404);
        }

        try {
            $stats = DB::table("composition_stats")->where("composition_id", $id)->first();
            if ($stats) {
                DB::table("composition_stats")->where("composition_id", $id)->update([
                    "views" => ((int) $stats->views) + 1,
                    "last_updated" => now(),
                ]);
            } else {
                DB::table("composition_stats")->insert([
                    "composition_id" => $id,
                    "views" => 1,
                    "purchases" => 0,
                    "last_updated" => now(),
                ]);
            }
        } catch (\Throwable) {
            // Do not block response on stats update failure.
        }

        $mapped = $this->mapCompositionRow($row);
        $mapped = $this->refreshSignedPdfUrl($mapped);
        return response()->json($mapped);
    }

    public function store(Request $request)
    {
        $authUid = (string) $request->attributes->get("authUid", "");
        $composerId = trim((string) $request->input("composer_id", ""));

        if ($composerId === "") {
            if ($authUid === "") {
                return response()->json(["message" => "composer_id is required when auth uid is missing"], 400);
            }

            $user = $this->roleService->resolveDbUserByAuthUid($authUid);
            if (!$user) {
                return response()->json(["message" => "User profile not found"], 404);
            }

            $composer = DB::table("composers")->where("user_id", $user["id"])->select("id")->first();
            if (!$composer) {
                return response()->json(["message" => "Composer profile not found for current user"], 403);
            }
            $composerId = (string) $composer->id;
        }

        $title = trim((string) $request->input("title", ""));
        if ($title === "") {
            return response()->json(["message" => "title is required"], 400);
        }

        $insert = [
            "id" => (string) Str::uuid(),
            "title" => $title,
            "description" => $request->input("description"),
            "category_id" => $request->input("category_id"),
            "price" => (float) ($request->input("price", 0)),
            "pdf_url" => $request->input("pdf_url") ?: $request->input("file_url"),
            "thumbnail_url" => $request->input("thumbnail_url"),
            "duration" => $request->input("duration") ?: ($request->input("duration_seconds") ? (string) $request->input("duration_seconds") : null),
            "difficulty" => $request->input("difficulty"),
            "language" => $request->input("language"),
            "accompaniment" => $request->input("accompaniment"),
            "voice_parts" => $request->input("voice_parts") ? json_encode($request->input("voice_parts")) : null,
            "composer_id" => $composerId,
            "is_published" => true,
            "deleted" => false,
            "created_at" => now(),
            "updated_at" => now(),
        ];

        if (Schema::hasColumn("compositions", "price_currency")) {
            $insert["price_currency"] = $this->normalizePriceCurrency($request->input("price_currency"));
        }

        DB::table("compositions")->insert($insert);

        try {
            DB::table("composition_stats")->insert([
                "composition_id" => $insert["id"],
                "views" => 0,
                "purchases" => 0,
                "last_updated" => now(),
            ]);
        } catch (\Throwable) {
            // Ignore duplicate/missing stats table issues.
        }

        $row = $this->compositionBaseQuery()->where("compositions.id", $insert["id"])->first();
        return response()->json($this->mapCompositionRow($row), 201);
    }

    public function update(Request $request, string $id)
    {
        if (trim($id) === "") {
            return response()->json(["message" => "id is required"], 400);
        }

        $updates = [];
        foreach ([
            "title",
            "description",
            "category_id",
            "price",
            "is_published",
            "difficulty",
            "language",
            "duration",
            "accompaniment",
            "pdf_url",
            "thumbnail_url",
        ] as $field) {
            if ($request->has($field)) {
                $updates[$field] = $request->input($field);
            }
        }

        if ($request->has("price_currency") && Schema::hasColumn("compositions", "price_currency")) {
            $updates["price_currency"] = $this->normalizePriceCurrency($request->input("price_currency"));
        }
        if ($request->has("voice_parts")) {
            $value = $request->input("voice_parts");
            $updates["voice_parts"] = is_array($value) ? json_encode($value) : null;
        }

        if (empty($updates)) {
            return response()->json(["message" => "No updatable fields provided"], 400);
        }

        $updates["updated_at"] = now();
        $affected = DB::table("compositions")->where("id", $id)->update($updates);
        if ($affected === 0) {
            return response()->json(["message" => "Composition not found"], 404);
        }

        $row = $this->compositionBaseQuery()->where("compositions.id", $id)->first();
        return response()->json([
            "message" => "Composition updated",
            "composition" => $this->mapCompositionRow($row),
        ]);
    }

    public function destroy(Request $request, string $id)
    {
        if (trim($id) === "") {
            return response()->json(["message" => "id is required"], 400);
        }

        $hardDelete = strtolower((string) $request->query("hard", "true")) !== "false";
        if ($hardDelete) {
            try {
                $deleted = DB::table("compositions")->where("id", $id)->delete();
                if ($deleted > 0) {
                    return response()->json([
                        "message" => "Composition deleted from database",
                        "hard" => true,
                    ]);
                }
            } catch (\Throwable) {
                // Fall back to soft delete.
            }
        }

        $affected = DB::table("compositions")->where("id", $id)->update([
            "deleted" => true,
            "is_published" => false,
            "updated_at" => now(),
        ]);

        if ($affected === 0) {
            return response()->json(["message" => "Composition not found"], 404);
        }

        return response()->json([
            "message" => "Composition soft-deleted",
            "hard" => false,
        ]);
    }
}
