import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "../services/prisma";
import { requireAuth } from "../middleware/auth";
import { extractPdfText } from "../parsing/pdfParser";
import { runValidation } from "../services/validationEngine";

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

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { plantId, patrolDate } = req.body;
    if (!plantId || !patrolDate) return res.status(400).json({ error: "plantId and patrolDate are required" });
    if (!req.file) return res.status(400).json({ error: "PDF file is required" });

    const buffer = fs.readFileSync(req.file.path);
    const rawText = await extractPdfText(buffer);

    const report = await runValidation({
      plantId,
      patrolDate,
      fileName: req.file.originalname,
      rawText
    });

    res.status(201).json(report);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message ?? "Failed to process PDF" });
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
