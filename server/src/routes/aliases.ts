import { Router } from "express";
import { prisma } from "../services/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.post("/", async (req, res) => {
  const { checkpointId, alias, approved } = req.body;
  const created = await prisma.checkpointAlias.create({
    data: { checkpointId, alias, approved: approved ?? true }
  });
  res.status(201).json(created);
});

router.put("/:id", async (req, res) => {
  const { alias, approved } = req.body;
  const updated = await prisma.checkpointAlias.update({
    where: { id: req.params.id },
    data: { alias, approved }
  });
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  await prisma.checkpointAlias.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;
