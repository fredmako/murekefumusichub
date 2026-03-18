<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RoleService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CheckoutController extends Controller
{
    public function __construct(private readonly RoleService $roleService)
    {
    }

    private function authUserOr404(Request $request): ?array
    {
        $authUid = (string) $request->attributes->get("authUid", "");
        return $this->roleService->resolveDbUserByAuthUid($authUid);
    }

    private function normalizeMpesaCode(mixed $raw): string
    {
        return strtoupper(preg_replace("/\\s+/", "", trim((string) ($raw ?? ""))) ?? "");
    }

    private function isValidMpesaCode(string $code): bool
    {
        return preg_match("/^[A-Z0-9]{8,20}$/", $code) === 1;
    }

    public function status(Request $request)
    {
        $user = $this->authUserOr404($request);
        if (!$user) {
            return response()->json(["message" => "User not found"], 404);
        }

        $rows = DB::table("payment_submissions")
            ->leftJoin("compositions", "compositions.id", "=", "payment_submissions.composition_id")
            ->select([
                "payment_submissions.id",
                "payment_submissions.checkout_batch_id",
                "payment_submissions.composition_id",
                "payment_submissions.amount",
                "payment_submissions.mpesa_code",
                "payment_submissions.status",
                "payment_submissions.submitted_at",
                "payment_submissions.reviewed_at",
                "payment_submissions.admin_notes",
                "compositions.title as composition_title",
            ])
            ->where("payment_submissions.buyer_id", $user["id"])
            ->orderByDesc("payment_submissions.submitted_at")
            ->limit(100)
            ->get()
            ->map(fn ($row) => [
                "id" => $row->id,
                "checkout_batch_id" => $row->checkout_batch_id,
                "composition_id" => $row->composition_id,
                "amount" => $row->amount,
                "mpesa_code" => $row->mpesa_code,
                "status" => $row->status,
                "submitted_at" => $row->submitted_at,
                "reviewed_at" => $row->reviewed_at,
                "admin_notes" => $row->admin_notes,
                "compositions" => ["title" => $row->composition_title],
            ])->values();

        return response()->json($rows);
    }

    public function submit(Request $request)
    {
        $user = $this->authUserOr404($request);
        if (!$user) {
            return response()->json(["message" => "User not found"], 404);
        }

        $mpesaCode = $this->normalizeMpesaCode($request->input("mpesaCode"));
        if (!$this->isValidMpesaCode($mpesaCode)) {
            return response()->json([
                "message" => "Invalid M-Pesa transaction code format. Use the exact code sent by M-Pesa.",
            ], 400);
        }

        $items = $request->input("items", []);
        if (!is_array($items)) {
            $items = [];
        }

        $compositionIds = [];
        foreach ($items as $item) {
            $id = data_get($item, "composition_id") ?: data_get($item, "compositionId");
            if ($id) {
                $compositionIds[] = (string) $id;
            }
        }
        $compositionIds = array_values(array_unique($compositionIds));
        if (count($compositionIds) === 0) {
            return response()->json([
                "message" => "At least one composition is required for checkout submission",
            ], 400);
        }

        $compositions = DB::table("compositions")
            ->select("id", "title", "price")
            ->whereIn("id", $compositionIds)
            ->where("deleted", false)
            ->get();

        $compositionById = [];
        foreach ($compositions as $composition) {
            $compositionById[$composition->id] = $composition;
        }

        $missingIds = array_values(array_filter($compositionIds, fn ($id) => !isset($compositionById[$id])));
        if (count($missingIds) > 0) {
            return response()->json([
                "message" => "Some selected compositions were not found",
                "missingCompositionIds" => $missingIds,
            ], 404);
        }

        $activePurchases = DB::table("purchases")
            ->select("composition_id")
            ->where("buyer_id", $user["id"])
            ->where("is_active", true)
            ->whereIn("composition_id", $compositionIds)
            ->pluck("composition_id")
            ->toArray();

        $pendingSubmissions = DB::table("payment_submissions")
            ->select("composition_id")
            ->where("buyer_id", $user["id"])
            ->where("status", "pending")
            ->whereIn("composition_id", $compositionIds)
            ->pluck("composition_id")
            ->toArray();

        $alreadyPurchased = array_values(array_unique($activePurchases));
        $alreadyPending = array_values(array_unique($pendingSubmissions));

        $eligibleIds = array_values(array_filter(
            $compositionIds,
            fn ($id) => !in_array($id, $alreadyPurchased, true) && !in_array($id, $alreadyPending, true)
        ));

        if (count($eligibleIds) === 0) {
            return response()->json([
                "message" => "All selected items are already purchased or pending approval",
                "skipped" => [
                    "alreadyPurchased" => $alreadyPurchased,
                    "alreadyPending" => $alreadyPending,
                ],
            ], 409);
        }

        $checkoutBatchId = (string) Str::uuid();
        $rows = [];
        $totalAmount = 0.0;
        foreach ($eligibleIds as $compositionId) {
            $amount = (float) ($compositionById[$compositionId]->price ?? 0);
            $rows[] = [
                "id" => (string) Str::uuid(),
                "checkout_batch_id" => $checkoutBatchId,
                "buyer_id" => $user["id"],
                "composition_id" => $compositionId,
                "amount" => $amount,
                "mpesa_code" => $mpesaCode,
                "status" => "pending",
                "submitted_at" => now(),
                "created_at" => now(),
                "updated_at" => now(),
            ];
            $totalAmount += $amount;
        }

        DB::table("payment_submissions")->insert($rows);

        $submitted = DB::table("payment_submissions")
            ->select("id", "checkout_batch_id", "composition_id", "amount", "status")
            ->where("checkout_batch_id", $checkoutBatchId)
            ->get();

        return response()->json([
            "success" => true,
            "checkoutBatchId" => $checkoutBatchId,
            "totalAmount" => $totalAmount,
            "mpesa" => [
                "businessNumber" => env("MPESA_BUSINESS_NUMBER", "400200"),
                "accountNo" => env("MPESA_ACCOUNT_NO", env("MPESA_ACCOUNT_NUMBER", "1131723")),
                "businessName" => env("MPESA_BUSINESS_NAME", "Murekefu Music Hub"),
                "paymentUrl" => env("MPESA_PAYMENT_URL", "https://paynecta.co.ke/pay/music-hub"),
            ],
            "submitted" => $submitted,
            "skipped" => [
                "alreadyPurchased" => $alreadyPurchased,
                "alreadyPending" => $alreadyPending,
            ],
        ], 201);
    }
}
