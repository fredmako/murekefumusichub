import express from "express";
import multer from "multer";
import { PDFParse } from "pdf-parse";
import { supabaseAdmin } from "../lib/supabaseServer.js";
import { verifySupabaseToken } from "../middleware/verifySupabaseToken.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const DIFFICULTY_OPTIONS = ["Easy", "Intermediate", "Advanced"];
const LANGUAGE_OPTIONS = [
  "English",
  "Latin",
  "German",
  "French",
  "Italian",
  "Spanish",
];
const ACCOMPANIMENT_OPTIONS = [
  "A cappella",
  "Piano",
  "Organ",
  "String Quartet",
  "Orchestra",
];
const VOICE_PART_OPTIONS = [
  "Soprano",
  "Alto",
  "Tenor",
  "Bass",
  "Soprano I",
  "Soprano II",
];

function parseLimit(raw, fallback = 120, max = 500) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

function extractCompositionStoragePath(pdfUrl) {
  if (!pdfUrl) return null;
  const raw = String(pdfUrl).trim();
  if (!raw) return null;

  // If path is already stored directly, use it as-is.
  if (!/^https?:\/\//i.test(raw)) {
    return raw.replace(/^\/+/, "");
  }

  // For Supabase storage URLs, derive object path from the URL.
  const match = raw.match(
    /\/storage\/v1\/object\/(?:sign|public)\/compositions\/([^?]+)/i,
  );
  if (!match?.[1]) return null;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

async function refreshCompositionPdfUrl(composition) {
  if (!composition?.pdf_url) return composition;

  const storagePath = extractCompositionStoragePath(composition.pdf_url);
  if (!storagePath) return composition;

  const { data, error } = await supabaseAdmin.storage
    .from("compositions")
    .createSignedUrl(storagePath, 3600);

  if (error || !data?.signedUrl) {
    console.warn("[public-composition] Failed to refresh signed URL:", {
      compositionId: composition.id,
      path: storagePath,
      error: error?.message || error || "missing signedUrl",
    });
    return composition;
  }

  return {
    ...composition,
    pdf_url: data.signedUrl,
  };
}

function firstNonEmptyLine(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines[0] || "";
}

function detectDifficulty(text) {
  const lower = text.toLowerCase();
  if (
    lower.includes("advanced") ||
    lower.includes("virtuoso") ||
    lower.includes("professional")
  ) {
    return "Advanced";
  }
  if (
    lower.includes("intermediate") ||
    lower.includes("moderate") ||
    lower.includes("medium")
  ) {
    return "Intermediate";
  }
  return "Easy";
}

function detectLanguage(text) {
  const lower = text.toLowerCase();

  if (
    /\b(kyrie|gloria|sanctus|agnus|dei|miserere|alleluia|magnificat)\b/.test(
      lower,
    )
  ) {
    return "Latin";
  }
  if (/\b(und|der|die|das|herr|gott|ist)\b/.test(lower)) {
    return "German";
  }
  if (/\b(le|la|les|bonjour|seigneur|dieu)\b/.test(lower)) {
    return "French";
  }
  if (/\b(il|lo|gli|signore|dio|ave)\b/.test(lower)) {
    return "Italian";
  }
  if (/\b(el|la|los|las|dios|señor)\b/.test(lower)) {
    return "Spanish";
  }

  return "English";
}

function detectAccompaniment(text) {
  const lower = text.toLowerCase();
  if (lower.includes("a cappella") || lower.includes("acappella")) {
    return "A cappella";
  }
  if (lower.includes("string quartet")) return "String Quartet";
  if (lower.includes("orchestra")) return "Orchestra";
  if (lower.includes("organ")) return "Organ";
  if (lower.includes("piano")) return "Piano";
  return "A cappella";
}

function detectVoiceParts(text) {
  const lower = text.toLowerCase();
  const found = [];

  if (/\bsoprano\s*i\b/.test(lower)) found.push("Soprano I");
  if (/\bsoprano\s*ii\b/.test(lower)) found.push("Soprano II");
  if (/\bsoprano\b/.test(lower) && !found.includes("Soprano"))
    found.push("Soprano");
  if (/\balto\b/.test(lower)) found.push("Alto");
  if (/\btenor\b/.test(lower)) found.push("Tenor");
  if (/\bbass\b/.test(lower)) found.push("Bass");

  if (found.length === 0 && /\bsatb\b/.test(lower)) {
    found.push("Soprano", "Alto", "Tenor", "Bass");
  }

  return found;
}

function detectDuration(text) {
  const match = text.match(/\b([0-5]?\d:[0-5]\d)\b/);
  return match?.[1] || "";
}

function heuristicCompositionMetadata(text) {
  const titleGuess = firstNonEmptyLine(text).slice(0, 120) || "Untitled Composition";
  const voiceParts = detectVoiceParts(text);
  const duration = detectDuration(text);

  return {
    title: titleGuess,
    description:
      "Auto-generated from your uploaded PDF score. Please review and edit before publishing.",
    difficulty: detectDifficulty(text),
    duration,
    language: detectLanguage(text),
    accompaniment: detectAccompaniment(text),
    voiceParts,
  };
}

function normalizeOption(value, options, fallback) {
  const matched = options.find(
    (opt) => opt.toLowerCase() === String(value || "").trim().toLowerCase(),
  );
  return matched || fallback;
}

function normalizeMetadata(raw, fallback) {
  const safe = raw || {};
  const voiceParts = Array.isArray(safe.voiceParts)
    ? safe.voiceParts
        .map((part) => normalizeOption(part, VOICE_PART_OPTIONS, null))
        .filter(Boolean)
    : fallback.voiceParts;

  return {
    title: String(safe.title || fallback.title || "Untitled Composition")
      .trim()
      .slice(0, 255),
    description: String(safe.description || fallback.description || "")
      .trim()
      .slice(0, 1000),
    difficulty: normalizeOption(
      safe.difficulty,
      DIFFICULTY_OPTIONS,
      fallback.difficulty,
    ),
    duration: String(safe.duration || fallback.duration || "")
      .trim()
      .slice(0, 20),
    language: normalizeOption(safe.language, LANGUAGE_OPTIONS, fallback.language),
    accompaniment: normalizeOption(
      safe.accompaniment,
      ACCOMPANIMENT_OPTIONS,
      fallback.accompaniment,
    ),
    voiceParts: [...new Set(voiceParts)].slice(0, 6),
  };
}

async function analyzeMetadataWithAI(rawText) {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) return null;

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const text = rawText.slice(0, 15000);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Extract choral composition metadata from score text. Return JSON only with keys: title, description, difficulty, duration, language, accompaniment, voiceParts. difficulty must be one of Easy|Intermediate|Advanced. accompaniment must be one of A cappella|Piano|Organ|String Quartet|Orchestra. language must be one of English|Latin|German|French|Italian|Spanish. voiceParts must be an array using only Soprano|Alto|Tenor|Bass|Soprano I|Soprano II.",
        },
        {
          role: "user",
          content: text,
        },
      ],
      max_tokens: 400,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorBody}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(content.slice(start, end + 1));
    }
    return null;
  }
}

router.post(
  "/analyze-pdf",
  verifySupabaseToken,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "PDF file is required" });
      }

      if (req.file.mimetype !== "application/pdf") {
        return res.status(400).json({ message: "Only PDF files are supported" });
      }

      const parser = new PDFParse({ data: req.file.buffer });
      let extractedText = "";
      try {
        const parsed = await parser.getText();
        extractedText = String(parsed?.text || "").trim();
      } finally {
        await parser.destroy().catch(() => null);
      }

      if (!extractedText) {
        return res.status(422).json({
          message: "Could not extract readable text from this PDF",
        });
      }

      const heuristic = heuristicCompositionMetadata(extractedText);
      let aiMetadata = null;
      let source = "heuristic";

      try {
        aiMetadata = await analyzeMetadataWithAI(extractedText);
        if (aiMetadata) source = "ai";
      } catch (error) {
        console.warn("[analyze-pdf] AI analysis fallback:", error?.message || error);
      }

      const metadata = normalizeMetadata(aiMetadata, heuristic);

      return res.json({
        success: true,
        source,
        metadata,
      });
    } catch (err) {
      console.error("[analyze-pdf] Error:", err);
      return res.status(500).json({ message: "Failed to analyze PDF" });
    }
  },
);

// GET /api/compositions
router.get("/", async (req, res) => {
  try {
    const { category, search, limit } = req.query;
    const safeLimit = parseLimit(limit, 120, 500);

    let query = supabaseAdmin
      .from("compositions")
      .select(
        `
        id,
        composer_id,
        title,
        description,
        category_id,
        price,
        pdf_url,
        thumbnail_url,
        created_at,
        duration,
        difficulty,
        language,
        accompaniment,
        voice_parts,
        composers(id, users(display_name)),
        categories(name),
        composition_stats(views, purchases)
      `,
      )
      .eq("is_published", true)
      .eq("deleted", false)
      .order("created_at", { ascending: false })
      .limit(safeLimit);

    if (category) query = query.eq("category_id", category);
    if (search)
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error("[public-compositions] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/compositions/:id
// GET /api/compositions/composer/:composerId - get composer's compositions
router.get("/composer/:composerId", async (req, res) => {
  try {
    const { composerId } = req.params;
    if (!composerId)
      return res.status(400).json({ message: "composerId is required" });

    const { data, error } = await supabaseAdmin
      .from("compositions")
      .select(
        `
        *,
        categories(name),
        composition_stats(views, purchases)
      `,
      )
      .eq("composer_id", composerId)
      .eq("deleted", false)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.json(data || []);
  } catch (err) {
    console.error("[get-composer-compositions] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/compositions/:id
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "id is required" });

    const { data, error } = await supabaseAdmin
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
      await supabaseAdmin.rpc("increment_views", { composition_id: id });
    } catch (e) {
      console.warn(
        "[public-composition] increment_views RPC failed:",
        e?.message || e,
      );
    }

    const compositionWithFreshPdfUrl = await refreshCompositionPdfUrl(data);

    return res.json(compositionWithFreshPdfUrl);
  } catch (err) {
    console.error("[public-composition] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/compositions (authenticated)
router.post("/", verifySupabaseToken, async (req, res) => {
  try {
    const {
      title,
      description,
      category_id,
      price,
      file_url,
      pdf_url,
      thumbnail_url,
      duration_seconds,
      duration,
      difficulty,
      language,
      accompaniment,
      voice_parts,
      composer_id,
    } = req.body;

    console.log("[create-composition] incoming request", {
      authUid: req.authUid || null,
      hasComposerIdInBody: Boolean(composer_id),
      title: title || null,
      price: price ?? null,
      hasPdfUrl: Boolean(pdf_url || file_url),
      difficulty: difficulty || null,
      language: language || null,
      accompaniment: accompaniment || null,
      voicePartsCount: Array.isArray(voice_parts) ? voice_parts.length : 0,
    });

    let composerId = composer_id || null;

    if (!composerId) {
      const authUid = req.authUid;
      if (!authUid) {
        return res
          .status(400)
          .json({ message: "composer_id is required when auth uid is missing" });
      }

      const { data: userRow, error: userRowErr } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("auth_uid", authUid)
        .maybeSingle();
      if (userRowErr) throw userRowErr;
      if (!userRow) {
        return res.status(404).json({ message: "User profile not found" });
      }

      const { data: composerRow, error: composerRowErr } = await supabaseAdmin
        .from("composers")
        .select("id")
        .eq("user_id", userRow.id)
        .maybeSingle();
      if (composerRowErr) throw composerRowErr;
      if (!composerRow) {
        console.warn("[create-composition] composer row missing for user", {
          authUid,
          userId: userRow.id,
        });
        return res
          .status(403)
          .json({ message: "Composer profile not found for current user" });
      }

      composerId = composerRow.id;
    }

    if (!title) {
      return res.status(400).json({ message: "title is required" });
    }

    const { data: newComp, error: createErr } = await supabaseAdmin
      .from("compositions")
      .insert({
        title,
        description: description || null,
        category_id: category_id || null,
        price: price || 0,
        pdf_url: pdf_url || file_url || null,
        thumbnail_url: thumbnail_url || null,
        duration: duration || (duration_seconds ? String(duration_seconds) : null),
        difficulty: difficulty || null,
        language: language || null,
        accompaniment: accompaniment || null,
        voice_parts: Array.isArray(voice_parts) ? voice_parts : null,
        composer_id: composerId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createErr) throw createErr;
    console.log("[create-composition] insert success", {
      compositionId: newComp.id,
      composerId: composerId,
    });

    try {
      await supabaseAdmin
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

// PUT /api/compositions/:id - update composition (authenticated)
router.put("/:id", verifySupabaseToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      category_id,
      price,
      is_published,
      difficulty,
      language,
      duration,
      accompaniment,
      voice_parts,
      pdf_url,
      thumbnail_url,
    } = req.body;

    if (!id) return res.status(400).json({ message: "id is required" });

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (category_id !== undefined) updates.category_id = category_id;
    if (price !== undefined) updates.price = price;
    if (is_published !== undefined) updates.is_published = is_published;
    if (difficulty !== undefined) updates.difficulty = difficulty || null;
    if (language !== undefined) updates.language = language || null;
    if (duration !== undefined) updates.duration = duration || null;
    if (accompaniment !== undefined) updates.accompaniment = accompaniment || null;
    if (voice_parts !== undefined)
      updates.voice_parts = Array.isArray(voice_parts) ? voice_parts : null;
    if (pdf_url !== undefined) updates.pdf_url = pdf_url || null;
    if (thumbnail_url !== undefined) updates.thumbnail_url = thumbnail_url || null;

    const { data, error } = await supabaseAdmin
      .from("compositions")
      .update(updates)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data)
      return res.status(404).json({ message: "Composition not found" });

    return res.json({ message: "Composition updated", composition: data });
  } catch (err) {
    console.error("[update-composition] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/compositions/:id - soft delete composition (authenticated)
router.delete("/:id", verifySupabaseToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "id is required" });

    const { error } = await supabaseAdmin
      .from("compositions")
      .update({ deleted: true, is_published: false })
      .eq("id", id);

    if (error) throw error;

    return res.json({ message: "Composition deleted" });
  } catch (err) {
    console.error("[delete-composition] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
