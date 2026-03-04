<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RoleService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PurchaseController extends Controller
{
    public function __construct(private readonly RoleService $roleService)
    {
    }

    private function authUserOr404(Request $request): ?array
    {
        $authUid = (string) $request->attributes->get("authUid", "");
        $user = $this->roleService->resolveDbUserByAuthUid($authUid);
        if (!$user) {
            return null;
        }
        return $user;
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
                    "pdf_url" => $row->composition_pdf_url,
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

        $limit = max(1, min((int) $request->query("limit", 20), 100));
        $rows = DB::select("select * from get_fyp_recommendations(?, ?)", [$user["id"], $limit]);
        return response()->json($rows);
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
