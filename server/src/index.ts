import "dotenv/config";
import express from "express";
import cors from "cors";
import session from "express-session";
import path from "path";

import authRoutes from "./routes/auth";
import plantsRoutes from "./routes/plants";
import reportsRoutes from "./routes/reports";
import historyRoutes from "./routes/history";
import settingsRoutes from "./routes/settings";
import aliasesRoutes from "./routes/aliases";
import validateRoutes from "./routes/validate";

const app = express();
const PORT = Number(process.env.PORT ?? 4000);
const isProd = process.env.NODE_ENV === "production";

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "5mb" }));

app.use(
  session({
    secret: process.env.SESSION_SECRET ?? "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd,
      maxAge: Number(process.env.SESSION_TIMEOUT_MINUTES ?? 30) * 60 * 1000
    }
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/plants", plantsRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/aliases", aliasesRoutes);
app.use("/api/validate", validateRoutes);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Serve built client in production
const clientDist = path.join(__dirname, "..", "..", "client", "dist");
app.use(express.static(clientDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(clientDist, "index.html"));
});

app.listen(PORT, () => {
  console.log(`TAG-Patrolling server listening on port ${PORT}`);
});
