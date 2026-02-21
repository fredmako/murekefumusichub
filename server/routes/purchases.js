import express from "express";
import { supabase } from "../lib/supabaseClient.js";
import { verifyFirebaseToken } from "../middleware/auth.js";

const router = express.Router();

// GET /api/purchases - get buyer's purchases by firebase UID or supabase user id
router.get("/", verifyFirebaseToken, async (req, res) => {
  try {
    const firebaseUid = req.firebaseDecoded?.uid;
    if (!firebaseUid) {
      return res
        .status(400)
        .json({ message: "firebaseUid is required (from token)" });
    }

    // First resolve firebase UID to supabase user id
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();

    if (userError) throw userError;
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Fetch purchases with composition details
    const { data: purchases, error: purchasesError } = await supabase
      .from("purchases")
      .select(
        `
        *,
        compositions(
          *,
          composers(users(display_name)),
          categories(name)
        )
      `,
      )
      .eq("buyer_id", user.id)
      .eq("is_active", true)
      .order("purchased_at", { ascending: false });

    if (purchasesError) throw purchasesError;

    return res.json(purchases || []);
  } catch (err) {
    console.error("[get-purchases] Error:", err);
    return res.status(500).json({
      message: "Failed to fetch purchases",
      error: err.message,
    });
  }
});

// POST /api/purchases - create a purchase
router.post("/", verifyFirebaseToken, async (req, res) => {
  try {
    const { composition_id, price_paid, payment_ref } = req.body;
    const firebaseUid = req.firebaseDecoded?.uid;

    if (!firebaseUid || !composition_id || !price_paid) {
      return res.status(400).json({
        message:
          "firebaseUid (from token), composition_id, and price_paid are required",
      });
    }

    // Resolve firebase UID to supabase user id
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();

    if (userError) throw userError;
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Create purchase using RPC function
    const { data, error } = await supabase.rpc("purchase_composition", {
      p_buyer_id: user.id,
      p_composition_id: composition_id,
      p_price_paid: price_paid,
      p_payment_ref: payment_ref || null,
    });

    if (error) throw error;

    return res.status(201).json({
      message: "Purchase created",
      purchase: data,
    });
  } catch (err) {
    console.error("[create-purchase] Error:", err);
    return res.status(500).json({
      message: "Failed to create purchase",
      error: err.message,
    });
  }
});

// DELETE /api/purchases/:id - discard/refund a purchase
router.delete("/:id", verifyFirebaseToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "Purchase id is required" });
    }

    // Discard purchase using RPC function
    const { error } = await supabase.rpc("discard_purchase", {
      p_purchase_id: id,
    });

    if (error) throw error;

    return res.json({ message: "Purchase discarded" });
  } catch (err) {
    console.error("[discard-purchase] Error:", err);
    return res.status(500).json({
      message: "Failed to discard purchase",
      error: err.message,
    });
  }
});

// GET /api/purchases/recommendations - get FYP recommendations
router.get("/recommendations", verifyFirebaseToken, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const firebaseUid = req.firebaseDecoded?.uid;

    if (!firebaseUid) {
      return res.status(400).json({ message: "firebaseUid is required" });
    }

    // Resolve firebase UID to supabase user id
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();

    if (userError) throw userError;
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get recommendations using RPC
    const { data, error } = await supabase.rpc("get_fyp_recommendations", {
      p_buyer_id: user.id,
      p_limit: Number(limit),
    });

    if (error) throw error;

    return res.json(data || []);
  } catch (err) {
    console.error("[get-recommendations] Error:", err);
    return res.status(500).json({
      message: "Failed to fetch recommendations",
      error: err.message,
    });
  }
});

// PUT /api/purchases/preferences - update buyer preferences
router.put("/preferences", verifyFirebaseToken, async (req, res) => {
  try {
    const { category_id, weight } = req.body;
    const firebaseUid = req.firebaseDecoded?.uid;

    if (!firebaseUid || !category_id || weight === undefined) {
      return res.status(400).json({
        message:
          "firebaseUid (from token), category_id, and weight are required",
      });
    }

    // Resolve firebase UID to supabase user id
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();

    if (userError) throw userError;
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update preferences
    const { error } = await supabase.from("buyer_preferences").upsert({
      buyer_id: user.id,
      category_id,
      weight,
    });

    if (error) throw error;

    return res.json({ message: "Preferences updated" });
  } catch (err) {
    console.error("[update-preferences] Error:", err);
    return res.status(500).json({
      message: "Failed to update preferences",
      error: err.message,
    });
  }
});

export default router;
