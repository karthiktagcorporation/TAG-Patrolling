-- CreateTable
CREATE TABLE "Plant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "targetCount" INTEGER NOT NULL,
    "toleranceMinutes" INTEGER NOT NULL DEFAULT 30,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Checkpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Checkpoint_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CheckpointAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checkpointId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CheckpointAlias_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "Checkpoint" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoundSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RoundSchedule_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValidationReport" (
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
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ValidationReport_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ParsedRecord" (
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
    CONSTRAINT "ParsedRecord_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ValidationReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValidationIssue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ValidationIssue_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ValidationReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Plant_name_key" ON "Plant"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Checkpoint_plantId_name_key" ON "Checkpoint"("plantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CheckpointAlias_checkpointId_alias_key" ON "CheckpointAlias"("checkpointId", "alias");

-- CreateIndex
CREATE UNIQUE INDEX "RoundSchedule_plantId_label_key" ON "RoundSchedule"("plantId", "label");
