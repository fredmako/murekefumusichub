<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RoleService;
use App\Services\SupabaseStorageService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PurchaseController extends Controller
{
    private const MIN_PURCHASES_FOR_PERSONALIZED_RECOMMENDATIONS = 3;

    public function __construct(
        private readonly RoleService $roleService,
        private readonly SupabaseStorageService $storageService
    ) {
    }

    private function authUserOr404(Request $request): ?array
    {
        $authUid = (string) $request->attributes->get("authUid", "");
        return $this->roleService->resolveDbUserByAuthUid($authUid);
    }

    private function parseSafeLimit(mixed $raw, int $fallback = 20, int $max = 50): int
    {
        $parsed = (int) $raw;
        if ($parsed <= 0) {
            return $fallback;
        }

        return min($parsed, $max);
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

    private function refreshSignedPdfUrl(?string $pdfUrl): ?string
    {
        $path = $this->extractCompositionStoragePath($pdfUrl);
        if (!$path) {
            return $pdfUrl;
        }

        return $this->storageService->createSignedUrl("compositions", $path, 3600) ?: $pdfUrl;
    }

    private function buildSafePdfFilename(?string $title): string
    {
        $cleaned = trim((string) ($title ?? "composition"));
        $cleaned = preg_replace('/[<>:"\/\\\\|?*\x00-\x1F]/', '', $cleaned) ?? "composition";
        $cleaned = preg_replace('/\s+/', ' ', $cleaned) ?? "composition";
        $cleaned = substr($cleaned, 0, 120);
        if ($cleaned === "") {
            $cleaned = "composition";
        }

        return str_ends_with(strtolower($cleaned), ".pdf") ? $cleaned : "{$cleaned}.pdf";
    }

    private function appendDownloadQuery(string $url, string $fileName): string
    {
        $separator = str_contains($url, "?") ? "&" : "?";
        return "{$url}{$separator}download=" . urlencode($fileName);
    }

    private function recommendationBaseQuery()
    {
        $selects = [
            "compositions.id",
            "compositions.composer_id",
            "compositions.title",
            "compositions.description",
            "compositions.category_id",
            "compositions.price",
            "compositions.pdf_url",
            "compositions.thumbnail_url",
            "compositions.created_at",
            "compositions.duration",
            "compositions.difficulty",
            "compositions.language",
            "compositions.accompaniment",
            "compositions.voice_parts",
            "categories.name as category_name",
            "composers.id as composer_table_id",
            "composer_users.display_name as composer_display_name",
            "composition_stats.views as stats_views",
            "composition_stats.purchases as stats_purchases",
        ];

        if (Schema::hasColumn("compositions", "price_currency")) {
            $selects[] = "compositions.price_currency";
        }

        return DB::table("compositions")
            ->leftJoin("composers", "composers.id", "=", "compositions.composer_id")
            ->leftJoin("users as composer_users", "composer_users.id", "=", "composers.user_id")
            ->leftJoin("categories", "categories.id", "=", "compositions.category_id")
            ->leftJoin("composition_stats", "composition_stats.composition_id", "=", "compositions.id")
            ->select($selects)
            ->where("compositions.is_published", true)
            ->where("compositions.deleted", false);
    }

    private function mapRecommendationRow(object $row): array
    {
        $voiceParts = null;
        $rawVoiceParts = $row->voice_parts ?? null;
        if (is_array($rawVoiceParts)) {
            $voiceParts = $rawVoiceParts;
        } elseif (is_string($rawVoiceParts) && trim($rawVoiceParts) !== "") {
            try {
                $decoded = json_decode($rawVoiceParts, true, flags: JSON_THROW_ON_ERROR);
                $voiceParts = is_array($decoded) ? array_values($decoded) : null;
            } catch (\Throwable) {
                $voiceParts = null;
            }
        }

        return [
            "id" => $row->id,
            "composer_id" => $row->composer_id,
            "title" => $row->title,
            "description" => $row->description,
            "category_id" => $row->category_id,
            "price" => $row->price,
            "price_currency" => Schema::hasColumn("compositions", "price_currency")
                ? ((string) ($row->price_currency ?? "") ?: "KES")
                : "KES",
            "pdf_url" => $this->refreshSignedPdfUrl($row->pdf_url),
            "thumbnail_url" => $row->thumbnail_url,
            "created_at" => $row->created_at,
            "duration" => $row->duration,
            "difficulty" => $row->difficulty,
            "language" => $row->language,
            "accompaniment" => $row->accompaniment,
            "voice_parts" => $voiceParts,
            "categories" => [
                "name" => $row->category_name,
            ],
            "composers" => [
                "id" => $row->composer_table_id,
                "users" => [
                    "display_name" => $row->composer_display_name,
                ],
            ],
            "composition_stats" => [[
                "views" => (int) ($row->stats_views ?? 0),
                "purchases" => (int) ($row->stats_purchases ?? 0),
            ]],
        ];
    }

    private function fetchFallbackRecommendations(string $userId, int $limit): array
    {
        $purchasedCompositionIds = DB::table("purchases")
            ->where("buyer_id", $userId)
            ->where("is_active", true)
            ->pluck("composition_id")
            ->filter()
            ->values()
            ->all();

        $prioritizedCategoryIds = DB::table("purchases")
            ->leftJoin("compositions", "compositions.id", "=", "purchases.composition_id")
            ->where("purchases.buyer_id", $userId)
            ->where("purchases.is_active", true)
            ->whereNotNull("compositions.category_id")
            ->orderByDesc("purchases.purchased_at")
            ->pluck("compositions.category_id")
            ->filter()
            ->unique()
            ->values()
            ->all();

        $preferredRows = [];
        if (count($prioritizedCategoryIds) > 0) {
            $preferredRows = $this->recommendationBaseQuery()
                ->whereIn("compositions.category_id", $prioritizedCategoryIds)
                ->orderByDesc("compositions.created_at")
                ->limit(max($limit * 2, 20))
                ->get()
                ->all();
        }

        $recentRows = $this->recommendationBaseQuery()
            ->orderByDesc("composition_stats.purchases")
            ->orderByDesc("composition_stats.views")
            ->orderByDesc("compositions.created_at")
            ->limit(max($limit * 3, 24))
            ->get()
            ->all();

        $seen = [];
        $results = [];
        foreach ([...$preferredRows, ...$recentRows] as $row) {
            if (in_array($row->id, $seen, true) || in_array($row->id, $purchasedCompositionIds, true)) {
                continue;
            }

            $seen[] = $row->id;
            $results[] = $this->mapRecommendationRow($row);
            if (count($results) >= $limit) {
                break;
            }
        }

        return $results;
    }

    public function index(Request $request)
    {
        $user = $this->authUserOr404($request);
        if (!$user) {
            return response()->json(["message" => "User not found"], 404);
        }

        $rows = DB::table("purchases")
            ->leftJoin("compositions", "compositions.id", "=", "purchases.composition_id")
            ->leftJoin("composers", "composers.id", "=", "compositions.composer_id")
            ->leftJoin("categories", "categories.id", "=", "compositions.category_id")
            ->select([
                "purchases.*",
                "compositions.title as composition_title",
                "compositions.description as composition_description",
                "compositions.pdf_url as composition_pdf_url",
                "compositions.thumbnail_url as composition_thumbnail_url",
                "compositions.price as composition_price",
                "categories.name as category_name",
                "composers.user_id as composer_user_id",
            ])
            ->where("purchases.buyer_id", $user["id"])
            ->where("purchases.is_active", true)
            ->orderByDesc("purchases.purchased_at")
            ->get();

        $data = $rows->map(function ($row) {
            return [
                "id" => $row->id,
                "buyer_id" => $row->buyer_id,
                "composition_id" => $row->composition_id,
                "purchased_at" => $row->purchased_at,
                "price_paid" => $row->price_paid,
                "payment_ref" => $row->payment_ref,
                "is_active" => $row->is_active,
                "compositions" => [
                    "id" => $row->composition_id,
                    "title" => $row->composition_title,
                    "description" => $row->composition_description,
                    "pdf_url" => $this->refreshSignedPdfUrl($row->composition_pdf_url),
                    "thumbnail_url" => $row->composition_thumbnail_url,
                    "price" => $row->composition_price,
                    "categories" => [
                        "name" => $row->category_name,
                    ],
                    "composers" => [
                        "user_id" => $row->composer_user_id,
                    ],
                ],
            ];
        })->values();

        return response()->json($data);
    }

    public function download(Request $request, string $id)
    {
        $user = $this->authUserOr404($request);
        if (!$user) {
            return response()->json(["message" => "User not found"], 404);
        }

        $purchase = DB::table("purchases")
            ->leftJoin("compositions", "compositions.id", "=", "purchases.composition_id")
            ->select(
                "purchases.id",
                "purchases.composition_id",
                "purchases.buyer_id",
                "purchases.is_active",
                "compositions.title as composition_title",
                "compositions.pdf_url as composition_pdf_url"
            )
            ->where("purchases.id", $id)
            ->where("purchases.buyer_id", $user["id"])
            ->where("purchases.is_active", true)
            ->first();

        if (!$purchase) {
            return response()->json([
                "message" => "Authorized purchase not found",
            ], 404);
        }

        $downloadUrl = $this->refreshSignedPdfUrl($purchase->composition_pdf_url);
        if (!$downloadUrl) {
            return response()->json([
                "message" => "Composition PDF not available for this purchase",
            ], 404);
        }

        $fileName = $this->buildSafePdfFilename($purchase->composition_title);

        return response()->json([
            "purchaseId" => $purchase->id,
            "compositionId" => $purchase->composition_id,
            "fileName" => $fileName,
            "downloadUrl" => $this->appendDownloadQuery($downloadUrl, $fileName),
        ]);
    }

    public function store(Request $request)
    {
        $user = $this->authUserOr404($request);
        if (!$user) {
            return response()->json(["message" => "User not found"], 404);
        }

        $compositionId = (string) $request->input("composition_id", "");
        $pricePaid = (float) $request->input("price_paid", 0);
        $paymentRef = $request->input("payment_ref");

        if ($compositionId === "" || $pricePaid <= 0) {
            return response()->json([
                "message" => "composition_id and price_paid are required",
            ], 400);
        }

        $result = DB::selectOne(
            "select purchase_composition(?, ?, ?, ?) as purchase_id",
            [$user["id"], $compositionId, $pricePaid, $paymentRef]
        );

        return response()->json([
            "message" => "Purchase created",
            "purchase" => $result?->purchase_id ?? null,
        ], 201);
    }

    public function destroy(Request $request, string $id)
    {
        if (trim($id) === "") {
            return response()->json(["message" => "Purchase id is required"], 400);
        }

        DB::statement("select discard_purchase(?)", [$id]);
        return response()->json(["message" => "Purchase discarded"]);
    }

    public function recommendations(Request $request)
    {
        $user = $this->authUserOr404($request);
        if (!$user) {
            return response()->json(["message" => "User not found"], 404);
        }

        $limit = $this->parseSafeLimit($request->query("limit", 20), 20, 50);
        $purchaseCount = (int) DB::table("purchases")
            ->where("buyer_id", $user["id"])
            ->where("is_active", true)
            ->count();

        if ($purchaseCount < self::MIN_PURCHASES_FOR_PERSONALIZED_RECOMMENDATIONS) {
            $remainingPurchases = self::MIN_PURCHASES_FOR_PERSONALIZED_RECOMMENDATIONS - $purchaseCount;
            $fallbackRows = $this->fetchFallbackRecommendations((string) $user["id"], $limit);

            return response()->json([
                "recommendations" => $fallbackRows,
                "mode" => "cold_start",
                "personalized" => false,
                "purchaseCount" => $purchaseCount,
                "minimumPurchasesForPersonalized" => self::MIN_PURCHASES_FOR_PERSONALIZED_RECOMMENDATIONS,
                "message" => $remainingPurchases > 0
                    ? "Make {$remainingPurchases} more purchase" . ($remainingPurchases === 1 ? "" : "s") . " to unlock personalized recommendations."
                    : "Make a few purchases to unlock personalized recommendations.",
            ]);
        }

        try {
            $rows = DB::select("select * from get_fyp_recommendations(?, ?)", [$user["id"], $limit]);
            if (count($rows) > 0) {
                $recommendations = collect($rows)->map(function ($row) {
                    $record = (array) $row;
                    if (!isset($record["price_currency"]) || trim((string) $record["price_currency"]) === "") {
                        $record["price_currency"] = "KES";
                    }
                    if (!isset($record["composition_stats"]) || !is_array($record["composition_stats"])) {
                        $record["composition_stats"] = [[
                            "views" => (int) ($record["views"] ?? 0),
                            "purchases" => (int) ($record["purchases"] ?? 0),
                        ]];
                    }
                    if (!empty($record["pdf_url"])) {
                        $record["pdf_url"] = $this->refreshSignedPdfUrl($record["pdf_url"]);
                    }
                    return $record;
                })->values();

                return response()->json([
                    "recommendations" => $recommendations,
                    "mode" => "personalized",
                    "personalized" => true,
                    "purchaseCount" => $purchaseCount,
                    "minimumPurchasesForPersonalized" => self::MIN_PURCHASES_FOR_PERSONALIZED_RECOMMENDATIONS,
                ]);
            }
        } catch (\Throwable) {
            // Fall back below if RPC is unavailable.
        }

        $fallbackRows = $this->fetchFallbackRecommendations((string) $user["id"], $limit);
        return response()->json([
            "recommendations" => $fallbackRows,
            "mode" => "fallback",
            "personalized" => false,
            "purchaseCount" => $purchaseCount,
            "minimumPurchasesForPersonalized" => self::MIN_PURCHASES_FOR_PERSONALIZED_RECOMMENDATIONS,
            "message" => count($fallbackRows) > 0
                ? "Showing fallback recommendations while personalization initializes."
                : "Recommendations are temporarily unavailable. Browse the marketplace catalog while the service recovers.",
        ]);
    }

    public function updatePreferences(Request $request)
    {
        $user = $this->authUserOr404($request);
        if (!$user) {
            return response()->json(["message" => "User not found"], 404);
        }

        $categoryId = $request->input("category_id");
        $weight = $request->input("weight");
        if (!$categoryId || $weight === null) {
            return response()->json([
                "message" => "category_id and weight are required",
            ], 400);
        }

        DB::table("buyer_preferences")->updateOrInsert(
            [
                "buyer_id" => $user["id"],
                "category_id" => $categoryId,
            ],
            [
                "weight" => (int) $weight,
            ]
        );

        return response()->json(["message" => "Preferences updated"]);
    }
}
