import { Router } from "express";
import { prisma } from "../services/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const { plantId, date, status } = req.query as { plantId?: string; date?: string; status?: string };

  const where: any = {};
  if (plantId) where.plantId = plantId;
  if (date) where.patrolDate = date;

  const reports = await prisma.validationReport.findMany({
    where,
    include: { plant: true },
    orderBy: { createdAt: "desc" }
  });

  const filtered = status
    ? reports.filter((r) => {
        if (status === "GOOD") return r.achievedPercent >= 90;
        if (status === "WARN") return r.achievedPercent >= 70 && r.achievedPercent < 90;
        if (status === "POOR") return r.achievedPercent < 70;
        return true;
      })
    : reports;

  res.json(filtered);
});

router.get("/dashboard", async (_req, res) => {
  const plants = await prisma.plant.count();
  const today = new Date().toISOString().slice(0, 10);
  const todayUploads = await prisma.validationReport.count({ where: { patrolDate: today } });
  const latest = await prisma.validationReport.findFirst({ orderBy: { createdAt: "desc" }, include: { plant: true } });

  const agg = await prisma.validationReport.aggregate({
    _sum: { duplicateCount: true, missingCount: true, extraCount: true, malfunctionCount: true }
  });

  const recent = await prisma.validationReport.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { plant: true }
  });

  res.json({
    totalPlants: plants,
    todayUploads,
    latestAchievedPercent: latest?.achievedPercent ?? null,
    duplicateCount: agg._sum.duplicateCount ?? 0,
    missingCount: agg._sum.missingCount ?? 0,
    extraCount: agg._sum.extraCount ?? 0,
    malfunctionCount: agg._sum.malfunctionCount ?? 0,
    recent
  });
});

/**
 * Reset: deletes all validation history (reports + their parsed records + issues).
 * Plant Master data (plants, checkpoints, aliases, rounds) is NOT touched.
 * Backs the "Reset" buttons on the Dashboard and History pages.
 */
router.delete("/reset", async (_req, res) => {
  await prisma.validationIssue.deleteMany({});
  await prisma.parsedRecord.deleteMany({});
  const result = await prisma.validationReport.deleteMany({});
  res.json({ ok: true, deletedReports: result.count });
});

export default router;
