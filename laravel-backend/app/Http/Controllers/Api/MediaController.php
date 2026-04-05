<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class MediaController extends Controller
{
    private const PEXELS_SEARCH_URL = "https://api.pexels.com/v1/search";
    private const DEFAULT_QUERY = "choir music performance";
    private const DEFAULT_PER_PAGE = 12;
    private const DEFAULT_MODE = "instruments";
    private const COMPOSITION_BACKGROUND_PER_PAGE = 10;

    private const INSTRUMENT_QUERIES = [
        "piano keys close up",
        "guitar strings close up",
        "drum kit studio",
        "violin on sheet music",
        "trumpet saxophone instruments",
        "music instruments flat lay",
    ];

    private const INSTRUMENT_KEYWORDS = [
        "instrument", "piano", "keyboard", "guitar", "violin", "cello", "trumpet",
        "saxophone", "drum", "percussion", "flute", "clarinet", "sheet music", "music stand",
    ];

    private const FACE_KEYWORDS = [
        "portrait", "face", "selfie", "headshot", "man", "woman", "boy", "girl", "person", "people", "human",
    ];

    private const COMPOSITION_BACKGROUND_KEYWORDS = [
        "background", "texture", "stage", "concert", "music", "sheet", "notes", "choir",
    ];

    private function normalizePerPage(mixed $raw): int
    {
        $v = (int) $raw;
        if ($v <= 0) {
            return self::DEFAULT_PER_PAGE;
        }
        return min(max($v, 4), 20);
    }

    private function normalizeMode(mixed $raw): string
    {
        return strtolower(trim((string) $raw)) === "mixed" ? "mixed" : self::DEFAULT_MODE;
    }

    private function parseQueries(mixed $raw): array
    {
        if ($raw === null) {
            return [];
        }

        return collect(explode(",", (string) $raw))
            ->map(fn ($x) => trim($x))
            ->filter()
            ->values()
            ->all();
    }

    private function parseVoiceParts(mixed $raw): array
    {
        if ($raw === null) {
            return [];
        }

        return collect(explode(",", (string) $raw))
            ->map(fn ($x) => trim($x))
            ->filter()
            ->values()
            ->slice(0, 8)
            ->all();
    }

    private function sanitizePromptText(mixed $value, int $max = 180): string
    {
        return mb_substr(trim(preg_replace('/\s+/', ' ', (string) ($value ?? '')) ?? ''), 0, $max);
    }

    private function normalizePhoto(array $photo): array
    {
        return [
            "id" => $photo["id"] ?? null,
            "photographer" => $photo["photographer"] ?? "",
            "width" => $photo["width"] ?? null,
            "height" => $photo["height"] ?? null,
            "alt" => $photo["alt"] ?? "",
            "src" => [
                "original" => data_get($photo, "src.original"),
                "large2x" => data_get($photo, "src.large2x"),
                "large" => data_get($photo, "src.large"),
                "medium" => data_get($photo, "src.medium"),
                "small" => data_get($photo, "src.small"),
                "portrait" => data_get($photo, "src.portrait"),
                "landscape" => data_get($photo, "src.landscape"),
            ],
            "url" => $photo["url"] ?? null,
        ];
    }

    private function keywordCount(string $text, array $keywords): int
    {
        $score = 0;
        foreach ($keywords as $keyword) {
            if (str_contains($text, $keyword)) {
                $score += 1;
            }
        }
        return $score;
    }

    private function fetchPexels(string $apiKey, string $query, int $perPage): array
    {
        $response = Http::timeout(8)->withHeaders([
            "Authorization" => $apiKey,
        ])->get(self::PEXELS_SEARCH_URL, [
            "query" => $query,
            "per_page" => $perPage,
            "orientation" => "landscape",
            "size" => "large",
        ]);

        if (!$response->successful()) {
            throw new \RuntimeException("Pexels query failed ({$query}): " . $response->body());
        }

        $photos = (array) ($response->json("photos") ?? []);
        return array_map(fn ($item) => $this->normalizePhoto((array) $item), $photos);
    }

    private function buildFallbackCompositionQueries(array $payload): array
    {
        $title = $this->sanitizePromptText($payload["title"] ?? null, 120);
        $description = $this->sanitizePromptText($payload["description"] ?? null, 120);
        $accompaniment = $this->sanitizePromptText($payload["accompaniment"] ?? null, 60);
        $voiceParts = is_array($payload["voiceParts"] ?? null) ? $payload["voiceParts"] : [];
        $firstVoicePart = trim((string) ($voiceParts[0] ?? ""));

        return collect([
            ($title ?: "choral composition") . " classical music background",
            ($title ?: "choir music") . " concert stage lights",
            ($accompaniment ?: "piano") . " sheet music aesthetic",
            ($firstVoicePart ?: "choral") . " rehearsal music background",
            ($description ?: "inspirational choir") . " music poster background",
        ])
            ->map(fn ($item) => $this->sanitizePromptText($item, 120))
            ->filter()
            ->unique()
            ->values()
            ->slice(0, 6)
            ->all();
    }

    private function buildCompositionQueriesWithAI(array $payload): ?array
    {
        $openAiKey = trim((string) env("OPENAI_API_KEY", ""));
        if ($openAiKey === "") {
            return null;
        }

        $model = (string) env("OPENAI_MODEL", "gpt-4o-mini");
        $response = Http::withToken($openAiKey)->acceptJson()->post("https://api.openai.com/v1/chat/completions", [
            "model" => $model,
            "temperature" => 0.3,
            "response_format" => ["type" => "json_object"],
            "messages" => [
                [
                    "role" => "system",
                    "content" => "Create marketing-friendly visual search prompts for stock photos. Return JSON with keys: shortDescription (string), queries (array of 4 to 6 short landscape-friendly search phrases). Avoid people close-up portraits. Prefer music, stage, instruments, sheet music, textures, atmosphere.",
                ],
                [
                    "role" => "user",
                    "content" => json_encode([
                        "title" => $this->sanitizePromptText($payload["title"] ?? null, 120),
                        "description" => $this->sanitizePromptText($payload["description"] ?? null, 240),
                        "language" => $this->sanitizePromptText($payload["language"] ?? null, 40),
                        "accompaniment" => $this->sanitizePromptText($payload["accompaniment"] ?? null, 60),
                        "voiceParts" => array_values(array_slice((array) ($payload["voiceParts"] ?? []), 0, 6)),
                    ]),
                ],
            ],
            "max_tokens" => 420,
        ]);

        if (!$response->successful()) {
            return null;
        }

        $content = data_get($response->json(), "choices.0.message.content");
        if (!is_string($content) || trim($content) === "") {
            return null;
        }

        try {
            $parsed = json_decode($content, true, flags: JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            $start = strpos($content, "{");
            $end = strrpos($content, "}");
            if ($start === false || $end === false || $end <= $start) {
                return null;
            }

            try {
                $parsed = json_decode(substr($content, $start, $end - $start + 1), true, flags: JSON_THROW_ON_ERROR);
            } catch (\Throwable) {
                return null;
            }
        }

        $queries = collect((array) ($parsed["queries"] ?? []))
            ->map(fn ($entry) => $this->sanitizePromptText($entry, 120))
            ->filter()
            ->values()
            ->slice(0, 6)
            ->all();

        if (count($queries) === 0) {
            return null;
        }

        return [
            "queries" => $queries,
            "shortDescription" => $this->sanitizePromptText($parsed["shortDescription"] ?? null, 180),
        ];
    }

    public function landingImages(Request $request)
    {
        $apiKey = trim((string) env("PEXELS_API_KEY", ""));
        if ($apiKey === "") {
            return response()->json([
                "message" => "PEXELS_API_KEY is not configured on the server.",
            ], 500);
        }

        $query = trim((string) $request->query("query", self::DEFAULT_QUERY));
        $perPage = $this->normalizePerPage($request->query("perPage"));
        $mode = $this->normalizeMode($request->query("mode"));
        $customQueries = $this->parseQueries($request->query("queries"));
        $activeQueries = count($customQueries) > 0
            ? $customQueries
            : ($mode === "instruments" ? self::INSTRUMENT_QUERIES : [$query]);

        $perQuery = min(20, max(6, (int) ceil(($perPage * 2) / max(count($activeQueries), 1))));
        $merged = [];
        $errors = [];
        foreach ($activeQueries as $q) {
            try {
                $items = $this->fetchPexels($apiKey, $q, $perQuery);
                foreach ($items as $item) {
                    $merged[$item["id"]] = $item;
                }
            } catch (\Throwable $e) {
                $errors[] = $e->getMessage();
            }
        }

        $scored = [];
        foreach (array_values($merged) as $item) {
            $text = strtolower((string) ($item["alt"] ?? ""));
            $instrumentMatches = $this->keywordCount($text, self::INSTRUMENT_KEYWORDS);
            $faceMatches = $this->keywordCount($text, self::FACE_KEYWORDS);
            if ($mode === "instruments") {
                if ($instrumentMatches === 0) {
                    continue;
                }
                if ($faceMatches >= 2 && $instrumentMatches < $faceMatches) {
                    continue;
                }
            }
            $item["_score"] = ($instrumentMatches * 3) - ($faceMatches * 2);
            $scored[] = $item;
        }

        usort($scored, fn ($a, $b) => ($b["_score"] <=> $a["_score"]));
        $items = array_slice(array_map(function ($row) {
            unset($row["_score"]);
            return $row;
        }, $scored), 0, $perPage);

        return response()->json([
            "source" => "pexels",
            "mode" => $mode,
            ...(count($errors) > 0 ? [
                "warning" => "Some Pexels queries failed; showing partial results",
                "errors" => array_slice($errors, 0, 3),
            ] : []),
            "items" => $items,
        ]);
    }

    public function compositionBackground(Request $request)
    {
        $apiKey = trim((string) env("PEXELS_API_KEY", ""));
        if ($apiKey === "") {
            return response()->json([
                "message" => "PEXELS_API_KEY is not configured on the server.",
            ], 500);
        }

        $title = $this->sanitizePromptText($request->query("title"), 140);
        $description = $this->sanitizePromptText($request->query("description"), 280);
        $language = $this->sanitizePromptText($request->query("language"), 40);
        $accompaniment = $this->sanitizePromptText($request->query("accompaniment"), 60);
        $voiceParts = $this->parseVoiceParts($request->query("voiceParts"));
        $perPage = $this->normalizePerPage($request->query("perPage", self::COMPOSITION_BACKGROUND_PER_PAGE));

        if ($title === "") {
            return response()->json([
                "message" => "title query parameter is required",
            ], 400);
        }

        $source = "fallback";
        $shortDescription = "";
        $queries = $this->buildFallbackCompositionQueries([
            "title" => $title,
            "description" => $description,
            "accompaniment" => $accompaniment,
            "voiceParts" => $voiceParts,
        ]);

        $aiPrompt = $this->buildCompositionQueriesWithAI([
            "title" => $title,
            "description" => $description,
            "language" => $language,
            "accompaniment" => $accompaniment,
            "voiceParts" => $voiceParts,
        ]);
        if ($aiPrompt && count($aiPrompt["queries"] ?? []) > 0) {
            $source = "ai+pexels";
            $queries = $aiPrompt["queries"];
            $shortDescription = $aiPrompt["shortDescription"] ?? "";
        }

        $perQuery = min(20, max(5, (int) ceil(($perPage * 2) / max(count($queries), 1))));
        $merged = [];
        $errors = [];
        foreach ($queries as $query) {
            try {
                $items = $this->fetchPexels($apiKey, $query, $perQuery);
                foreach ($items as $item) {
                    $merged[$item["id"]] = $item;
                }
            } catch (\Throwable $e) {
                $errors[] = $e->getMessage();
            }
        }

        if (count($merged) === 0) {
            return response()->json([
                "source" => "{$source}-empty",
                "shortDescription" => $shortDescription,
                "queries" => $queries,
                "warning" => "Could not fetch background images from Pexels",
                "errors" => array_slice($errors, 0, 3),
                "items" => [],
            ]);
        }

        $scored = [];
        foreach (array_values($merged) as $item) {
            $text = strtolower((string) ($item["alt"] ?? ""));
            $instrumentMatches = $this->keywordCount($text, self::INSTRUMENT_KEYWORDS);
            $faceMatches = $this->keywordCount($text, self::FACE_KEYWORDS);
            $neutralMatches = $this->keywordCount($text, self::COMPOSITION_BACKGROUND_KEYWORDS);
            if ($faceMatches >= 2 && ($instrumentMatches + $neutralMatches) < $faceMatches) {
                continue;
            }

            $item["_score"] = ($instrumentMatches * 3) + $neutralMatches - ($faceMatches * 2);
            $scored[] = $item;
        }

        usort($scored, fn ($a, $b) => ($b["_score"] <=> $a["_score"]));
        $items = array_slice(array_map(function ($row) {
            unset($row["_score"]);
            return $row;
        }, $scored), 0, $perPage);

        return response()->json([
            "source" => $source,
            "shortDescription" => $shortDescription,
            "queries" => $queries,
            ...(count($errors) > 0 ? [
                "warning" => "Some Pexels queries failed; showing partial results",
                "errors" => array_slice($errors, 0, 3),
            ] : []),
            "items" => $items,
        ]);
    }
}
