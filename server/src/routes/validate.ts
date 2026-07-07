import { Router } from "express";
import { prisma } from "../services/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// Manual alias mapping from a validation issue: approves a raw checkpoint string
// as an alias of a master checkpoint, then re-runs is left to a fresh upload
// (aliases only affect future parses, per the audit-trail requirement).
router.post("/manual-map", async (req, res) => {
  const { checkpointId, rawText } = req.body;
  if (!checkpointId || !rawText) return res.status(400).json({ error: "checkpointId and rawText are required" });

  const alias = await prisma.checkpointAlias.create({
    data: { checkpointId, alias: rawText, approved: true }
  });
  res.status(201).json(alias);
});

export default router;
