import { Router } from "express";

const router = Router();

router.post("/login", (req, res) => {
  const { password } = req.body ?? {};
  const expected = process.env.APP_PASSWORD ?? "";

  if (!password || password !== expected) {
    return res.status(401).json({ error: "Invalid password" });
  }

  req.session.authenticated = true;
  req.session.lastActivity = Date.now();
  res.json({ ok: true });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get("/session", (req, res) => {
  res.json({ authenticated: !!req.session.authenticated });
});

export default router;
