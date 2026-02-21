import express from "express";
import { supabase } from "../lib/supabaseClient.js";
import { verifyFirebaseToken } from "../middleware/auth.js";

const router = express.Router();

// GET /api/compositions
router.get("/", async (req, res) => {
  try {
    const { category, search, limit } = req.query;

    let query = supabase
      .from("compositions")
      .select(
        `
        *,
        composers(id, users(display_name)),
        categories(name),
        composition_stats(views, purchases)
      `,
      )
      .eq("is_published", true)
      .eq("deleted", false)
      .order("created_at", { ascending: false });

    if (category) query = query.eq("category_id", category);
    if (search)
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    if (limit) query = query.limit(Number(limit));

    const { data, error } = await query;
    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error("[public-compositions] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/compositions/:id
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "id is required" });

    const { data, error } = await supabase
      .from("compositions")
      .select(
        `
        *,
        composers(id, users(display_name, email)),
        categories(name),
        composition_stats(views, purchases)
      `,
      )
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data)
      return res.status(404).json({ message: "Composition not found" });

    try {
      await supabase.rpc("increment_views", { composition_id: id });
    } catch (e) {
      console.warn(
        "[public-composition] increment_views RPC failed:",
        e?.message || e,
      );
    }

    return res.json(data);
  } catch (err) {
    console.error("[public-composition] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/compositions (authenticated)
router.post("/", verifyFirebaseToken, async (req, res) => {
  try {
    const {
      title,
      description,
      category_id,
      price,
      file_url,
      thumbnail_url,
      duration_seconds,
      composer_id,
    } = req.body;

    if (!title || !composer_id) {
      return res
        .status(400)
        .json({ message: "title and composer_id are required" });
    }

    const { data: newComp, error: createErr } = await supabase
      .from("compositions")
      .insert({
        title,
        description: description || null,
        category_id: category_id || null,
        price: price || 0,
        file_url: file_url || null,
        thumbnail_url: thumbnail_url || null,
        duration_seconds: duration_seconds || null,
        composer_id,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createErr) throw createErr;

    try {
      await supabase
        .from("composition_stats")
        .insert({ composition_id: newComp.id });
    } catch (e) {
      console.warn(
        "[create-composition] Failed to init stats:",
        e?.message || e,
      );
    }

    return res.status(201).json(newComp);
  } catch (err) {
    console.error("[create-composition] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
