-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ParsedRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "rawLine" TEXT NOT NULL,
    "guard" TEXT,
    "rawCheckpoint" TEXT,
    "normalizedCheckpoint" TEXT,
    "matchedCheckpointId" TEXT,
    "matchType" TEXT,
    "rawTime" TEXT,
    "normalizedTime" TEXT,
    "matchedRound" TEXT,
    "status" TEXT NOT NULL,
    "confidence" REAL,
    "outOfSequence" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ParsedRecord_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ValidationReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ParsedRecord" ("confidence", "guard", "id", "lineNumber", "matchType", "matchedCheckpointId", "matchedRound", "normalizedCheckpoint", "normalizedTime", "rawCheckpoint", "rawLine", "rawTime", "reportId", "status") SELECT "confidence", "guard", "id", "lineNumber", "matchType", "matchedCheckpointId", "matchedRound", "normalizedCheckpoint", "normalizedTime", "rawCheckpoint", "rawLine", "rawTime", "reportId", "status" FROM "ParsedRecord";
DROP TABLE "ParsedRecord";
ALTER TABLE "new_ParsedRecord" RENAME TO "ParsedRecord";
CREATE TABLE "new_ValidationReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plantId" TEXT NOT NULL,
    "patrolDate" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "plannedTarget" INTEGER NOT NULL,
    "validAchieved" INTEGER NOT NULL,
    "achievedPercent" REAL NOT NULL,
    "missingCount" INTEGER NOT NULL,
    "duplicateCount" INTEGER NOT NULL,
    "extraCount" INTEGER NOT NULL,
    "malfunctionCount" INTEGER NOT NULL,
    "reviewCount" INTEGER NOT NULL,
    "outOfTimeCount" INTEGER NOT NULL,
    "outOfSequenceCount" INTEGER NOT NULL DEFAULT 0,
    "roundSummaryJson" TEXT,
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ValidationReport_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ValidationReport" ("achievedPercent", "createdAt", "duplicateCount", "extraCount", "fileName", "id", "malfunctionCount", "missingCount", "outOfTimeCount", "patrolDate", "plannedTarget", "plantId", "rawText", "remarks", "reviewCount", "validAchieved") SELECT "achievedPercent", "createdAt", "duplicateCount", "extraCount", "fileName", "id", "malfunctionCount", "missingCount", "outOfTimeCount", "patrolDate", "plannedTarget", "plantId", "rawText", "remarks", "reviewCount", "validAchieved" FROM "ValidationReport";
DROP TABLE "ValidationReport";
ALTER TABLE "new_ValidationReport" RENAME TO "ValidationReport";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
