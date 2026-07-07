import { Router } from "express";
import { prisma } from "../services/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/", async (_req, res) => {
  const plants = await prisma.plant.findMany({
    include: { checkpoints: { include: { aliases: true } }, roundSchedules: true },
    orderBy: { name: "asc" }
  });
  res.json(plants);
});

router.get("/:id", async (req, res) => {
  const plant = await prisma.plant.findUnique({
    where: { id: req.params.id },
    include: { checkpoints: { include: { aliases: true } }, roundSchedules: true }
  });
  if (!plant) return res.status(404).json({ error: "Plant not found" });
  res.json(plant);
});

router.post("/", async (req, res) => {
  const { name, targetCount, toleranceMinutes, notes, active } = req.body;
  const plant = await prisma.plant.create({
    data: { name, targetCount, toleranceMinutes: toleranceMinutes ?? 30, notes, active: active ?? true }
  });
  res.status(201).json(plant);
});

router.put("/:id", async (req, res) => {
  const { name, targetCount, toleranceMinutes, notes, active } = req.body;
  const plant = await prisma.plant.update({
    where: { id: req.params.id },
    data: { name, targetCount, toleranceMinutes, notes, active }
  });
  res.json(plant);
});

router.delete("/:id", async (req, res) => {
  await prisma.plant.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// Checkpoints
router.post("/:id/checkpoints", async (req, res) => {
  const { name, order } = req.body;
  const cp = await prisma.checkpoint.create({
    data: { plantId: req.params.id, name, order: order ?? 0 }
  });
  res.status(201).json(cp);
});

router.put("/checkpoints/:cpId", async (req, res) => {
  const { name, order } = req.body;
  const cp = await prisma.checkpoint.update({ where: { id: req.params.cpId }, data: { name, order } });
  res.json(cp);
});

router.delete("/checkpoints/:cpId", async (req, res) => {
  await prisma.checkpoint.delete({ where: { id: req.params.cpId } });
  res.json({ ok: true });
});

// Round schedules
router.put("/:id/rounds", async (req, res) => {
  const { rounds } = req.body as { rounds: { id?: string; label: string; startTime: string; order: number }[] };
  await prisma.roundSchedule.deleteMany({ where: { plantId: req.params.id } });
  await prisma.roundSchedule.createMany({
    data: rounds.map((r) => ({ plantId: req.params.id, label: r.label, startTime: r.startTime, order: r.order }))
  });
  const plant = await prisma.plant.findUnique({ where: { id: req.params.id }, include: { roundSchedules: true } });
  res.json(plant);
});

export default router;
