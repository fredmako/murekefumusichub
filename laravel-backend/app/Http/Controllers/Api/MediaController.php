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
        $response = Http::withHeaders([
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
        foreach ($activeQueries as $q) {
            $items = $this->fetchPexels($apiKey, $q, $perQuery);
            foreach ($items as $item) {
                $merged[$item["id"]] = $item;
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
            "items" => $items,
        ]);
    }
}
