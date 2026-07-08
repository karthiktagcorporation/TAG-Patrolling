import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "../services/prisma";
import { requireAuth } from "../middleware/auth";
import { extractPdfText } from "../parsing/pdfParser";
import { runValidation } from "../services/validationEngine";
import { detectPlantId, detectPatrolDate } from "../parsing/plantFromFilename";

const router = Router();
router.use(requireAuth);

const uploadDir = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  }),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") return cb(new Error("Only PDF files are accepted"));
    cb(null, true);
  },
  limits: { fileSize: 20 * 1024 * 1024 }
});

/**
 * Multi-file upload. Each PDF's plant is auto-detected from its filename, and
 * the patrol date is parsed from the filename too (falling back to the optional
 * `patrolDate` field, then today). Returns one result row per file so partial
 * failures (e.g. an unrecognizable filename) don't fail the whole batch.
 */
router.post("/upload", upload.array("files", 20), async (req, res) => {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) return res.status(400).json({ error: "At least one PDF file is required" });

    const fallbackDate = (req.body.patrolDate as string) || new Date().toISOString().slice(0, 10);
    const plants = await prisma.plant.findMany({ select: { id: true, name: true } });

    const results = [];
    for (const file of files) {
      try {
        const plantId = detectPlantId(file.originalname, plants);
        if (!plantId) {
          results.push({
            fileName: file.originalname,
            error: "Could not detect plant from filename",
            plantName: null,
            reportId: null
          });
          continue;
        }
        const patrolDate = detectPatrolDate(file.originalname) ?? fallbackDate;
        const buffer = fs.readFileSync(file.path);
        const rawText = await extractPdfText(buffer);
        const report = await runValidation({ plantId, patrolDate, fileName: file.originalname, rawText });
        const plant = plants.find((p) => p.id === plantId);
        results.push({
          fileName: file.originalname,
          plantName: plant?.name ?? null,
          patrolDate,
          reportId: report.id,
          plannedTarget: report.plannedTarget,
          validAchieved: report.validAchieved,
          achievedPercent: report.achievedPercent,
          error: null
        });
      } catch (perFileErr: any) {
        results.push({
          fileName: file.originalname,
          error: perFileErr.message ?? "Failed to process PDF",
          plantName: null,
          reportId: null
        });
      }
    }

    res.status(201).json({ results });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message ?? "Failed to process upload" });
  }
});

router.get("/:id", async (req, res) => {
  const report = await prisma.validationReport.findUnique({
    where: { id: req.params.id },
    include: { parsedRecords: true, issues: true, plant: true }
  });
  if (!report) return res.status(404).json({ error: "Report not found" });
  res.json(report);
});

router.put("/:id/remarks", async (req, res) => {
  const { remarks } = req.body;
  if (!remarks || !String(remarks).trim()) return res.status(400).json({ error: "Remarks cannot be empty" });
  const report = await prisma.validationReport.update({
    where: { id: req.params.id },
    data: { remarks: String(remarks).trim() }
  });
  res.json(report);
});

export default router;
