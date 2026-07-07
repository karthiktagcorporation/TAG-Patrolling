import { Request, Response, NextFunction } from "express";

declare module "express-session" {
  interface SessionData {
    authenticated?: boolean;
    lastActivity?: number;
  }
}

const timeoutMinutes = Number(process.env.SESSION_TIMEOUT_MINUTES ?? 30);

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.authenticated) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const now = Date.now();
  const last = req.session.lastActivity ?? now;
  if (now - last > timeoutMinutes * 60 * 1000) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "Session expired" });
  }

  req.session.lastActivity = now;
  next();
}
