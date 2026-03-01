import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import usersRouter from "./routes/users.js";
import accountRouter from "./routes/account.js";
import uploadRouter from "./routes/uploads.js";
import rolesRouter from "./routes/role.js";
import requestRoleRouter from "./routes/requestRole.js";
import compositionsRouter from "./routes/compositions.js";
import purchasesRouter from "./routes/purchases.js";
import categoriesRouter from "./routes/categories.js";
import adminRouter from "./routes/admin.js";

dotenv.config();

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`[api] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
  });
  next();
});
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  }),
);

app.use("/api/users", usersRouter);
app.use("/api/account", accountRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/user", rolesRouter);
app.use("/api", requestRoleRouter);
app.use("/api/compositions", compositionsRouter);
app.use("/api/purchases", purchasesRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/admin", adminRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/health", (_req, res) => res.json({ ok: true }));

app.use((err, _req, res, _next) => {
  console.error("[server] Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

const PORT = Number(process.env.PORT || 3001);
let serverInstance = null;

export function startServer(port = PORT) {
  if (serverInstance) return serverInstance;
  serverInstance = app.listen(port, () => {
    console.log(`[server] listening on http://localhost:${port}`);
  });
  return serverInstance;
}

export function stopServer() {
  if (!serverInstance) return;
  serverInstance.close();
  serverInstance = null;
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  startServer(PORT);
}

export default app;
