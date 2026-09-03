import express from "express";
import cors from "cors";
import serverless from "serverless-http";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cors({ origin: true, credentials: true }));

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/api/users", async (_req, res) => {
  const { data, error } = await supabase.from("users").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
app.post("/api/users", async (req, res) => {
  const { data, error } = await supabase.from("users").insert(req.body).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data?.[0]);
});

app.get("/api/account", async (_req, res) => {
  const { data, error } = await supabase.from("accounts").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get("/api/compositions", async (_req, res) => {
  const { data, error } = await supabase.from("compositions").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
app.post("/api/compositions", async (req, res) => {
  const { data, error } = await supabase.from("compositions").insert(req.body).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data?.[0]);
});

app.get("/api/categories", async (_req, res) => {
  const { data, error } = await supabase.from("categories").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get("/api/purchases", async (_req, res) => {
  const { data, error } = await supabase.from("purchases").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
app.post("/api/purchases", async (req, res) => {
  const { data, error } = await supabase.from("purchases").insert(req.body).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data?.[0]);
});

app.post("/api/checkout", async (req, res) => {
  const { data, error } = await supabase.from("checkouts").insert(req.body).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data?.[0]);
});

app.get("/api/admin/stats", async (_req, res) => {
  const [users, compositions, purchases] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("compositions").select("*", { count: "exact", head: true }),
    supabase.from("purchases").select("*", { count: "exact", head: true }),
  ]);
  res.json({
    users: users.count || 0,
    compositions: compositions.count || 0,
    purchases: purchases.count || 0,
  });
});

app.get("/api/support/tickets", async (_req, res) => {
  const { data, error } = await supabase.from("support_tickets").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
app.post("/api/support/tickets", async (req, res) => {
  const { data, error } = await supabase.from("support_tickets").insert(req.body).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data?.[0]);
});

app.get("/api/community/posts", async (_req, res) => {
  const { data, error } = await supabase.from("community_posts").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
app.post("/api/community/posts", async (req, res) => {
  const { data, error } = await supabase.from("community_posts").insert(req.body).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data?.[0]);
});

app.get("/api/notifications", async (_req, res) => {
  const { data, error } = await supabase.from("notifications").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get("/api/enrollments", async (_req, res) => {
  const { data, error } = await supabase.from("enrollments").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
app.post("/api/enrollments", async (req, res) => {
  const { data, error } = await supabase.from("enrollments").insert(req.body).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data?.[0]);
});

app.post("/api/registration", async (req, res) => {
  const { data, error } = await supabase.from("registrations").insert(req.body).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data?.[0]);
});

app.get("/api/media", async (_req, res) => {
  const { data, error } = await supabase.from("media").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
app.post("/api/media", async (req, res) => {
  const { data, error } = await supabase.from("media").insert(req.body).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data?.[0]);
});

app.post("/api/upload", async (req, res) => {
  const { data, error } = await supabase.from("uploads").insert(req.body).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data?.[0]);
});

app.get("/api/user/roles", async (_req, res) => {
  const { data, error } = await supabase.from("user_roles").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
app.post("/api/user/roles", async (req, res) => {
  const { data, error } = await supabase.from("user_roles").insert(req.body).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data?.[0]);
});

app.post("/api/request-role", async (req, res) => {
  const { data, error } = await supabase.from("role_requests").insert(req.body).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data?.[0]);
});

export default serverless(app);
