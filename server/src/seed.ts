import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Source of truth: "PUNCHING STATIONS - Copy for GM.xlsx" (2026-07-07 update).
 * Route order, round schedule, and target counts below are transcribed
 * directly from that file. Two round-interval families are used:
 *  - 30-minute interval, 13 rounds (23:00 -> 05:00): TAG 1A, TAG 1B, TAG 3, STK, SSVF
 *  - 40-minute interval, 10 rounds (23:00 -> 05:00): TAG 2, TAG 4
 * Round 1 is always 23:00 per the business rule; times wrap past midnight.
 */

function generateRoundTimes(intervalMinutes: number, count: number): string[] {
  const startMinutes = 23 * 60; // 23:00
  const times: string[] = [];
  for (let i = 0; i < count; i++) {
    const total = (startMinutes + i * intervalMinutes) % (24 * 60);
    const h = Math.floor(total / 60);
    const m = total % 60;
    times.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return times;
}

function roundLabels(count: number): string[] {
  const ordinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  return Array.from({ length: count }, (_, i) => `Round ${i + 1} (${ordinal(i + 1)})`);
}

interface PlantSeed {
  name: string;
  targetCount: number;
  checkpoints: string[]; // in route order
  intervalMinutes: number;
  roundCount: number;
  aliases?: Record<string, string[]>;
}

const PLANTS: PlantSeed[] = [
  {
    name: "TAG 1A",
    targetCount: 52,
    intervalMinutes: 30,
    roundCount: 13,
    checkpoints: ["HIGH VOLTAGE", "TESTING AREA", "TESTING AREA OUTSIDE", "TESTING AREA COMPOUND WALL"]
  },
  {
    name: "TAG 1B",
    targetCount: 52,
    intervalMinutes: 30,
    roundCount: 13,
    checkpoints: ["BIKE PARKING", "RUBBER MOLDING ENTRANCE", "MAIN ENTRANCE", "DESMA ENTRANCE"],
    aliases: { "RUBBER MOLDING ENTRANCE": ["RUBBER MOLDING", "RUBBER MOLDING GATE"] }
  },
  {
    name: "TAG 2",
    targetCount: 80,
    intervalMinutes: 40,
    roundCount: 10,
    checkpoints: [
      "Material Gate",
      "Shed 3 Compound Wall",
      "Before Utility Building",
      "Irrigation Well",
      "S2 A Corner",
      "Remaining Material Area",
      "Near Temple outside S 1",
      "Office Gate"
    ]
  },
  {
    name: "TAG 3",
    targetCount: 91,
    intervalMinutes: 30,
    roundCount: 13,
    checkpoints: ["SECURITY", "MAIN ENTRANCE", "OIL TANK", "OFFICE", "ETP", "SOLAR", "CANTEEN"],
    aliases: { SECURITY: ["SECURITY ROOM"] }
  },
  {
    name: "TAG 4",
    targetCount: 40,
    intervalMinutes: 40,
    roundCount: 10,
    checkpoints: ["ARMOUR ROD AREA", "CHEMICAL WASHING AREA", "VIBRATION DAMPER SHED", "100 TON WEIGH BRIDGE"],
    aliases: { "VIBRATION DAMPER SHED": ["Vibration dambar Welding shed"] }
  },
  {
    name: "STK",
    targetCount: 39,
    intervalMinutes: 30,
    roundCount: 13,
    checkpoints: ["ENTRANCE", "BUILDING INSIDE", "COMPOUND WALL"]
  },
  {
    name: "SSVF",
    targetCount: 39,
    intervalMinutes: 30,
    roundCount: 13,
    checkpoints: ["SECURITY AREA", "EB ROOM", "COOLING TOWER"]
    // NOTE: sample SSVF PDF contains "CYLINDER AREA" — intentionally NOT
    // aliased to COOLING TOWER; admin must approve it explicitly if it
    // should count, per the original spec.
  }
];

async function main() {
  for (const p of PLANTS) {
    const plant = await prisma.plant.upsert({
      where: { name: p.name },
      update: { targetCount: p.targetCount, active: true },
      create: { name: p.name, targetCount: p.targetCount, active: true, toleranceMinutes: 30 }
    });

    // Full replace of route/round master data from the latest Excel file.
    // Safe to delete-and-recreate: ParsedRecord/ValidationReport history
    // stores its own copy of checkpoint names/text and has no DB-level
    // foreign key to Checkpoint, so existing reports remain intact and
    // viewable even though the Checkpoint rows they once matched are gone.
    await prisma.checkpoint.deleteMany({ where: { plantId: plant.id } });
    await prisma.roundSchedule.deleteMany({ where: { plantId: plant.id } });

    for (let i = 0; i < p.checkpoints.length; i++) {
      const cpName = p.checkpoints[i];
      const cp = await prisma.checkpoint.create({
        data: { plantId: plant.id, name: cpName, order: i }
      });

      const aliasList = p.aliases?.[cpName] ?? [];
      for (const alias of aliasList) {
        await prisma.checkpointAlias.create({
          data: { checkpointId: cp.id, alias, approved: true }
        });
      }
    }

    const times = generateRoundTimes(p.intervalMinutes, p.roundCount);
    const labels = roundLabels(p.roundCount);
    for (let i = 0; i < p.roundCount; i++) {
      await prisma.roundSchedule.create({
        data: { plantId: plant.id, label: labels[i], startTime: times[i], order: i }
      });
    }
  }

  await prisma.appSetting.upsert({
    where: { key: "defaultToleranceMinutes" },
    update: {},
    create: { key: "defaultToleranceMinutes", value: "30" }
  });
  await prisma.appSetting.upsert({
    where: { key: "sessionTimeoutMinutes" },
    update: {},
    create: { key: "sessionTimeoutMinutes", value: "30" }
  });

  console.log("Seed complete: 7 plants reseeded from latest Excel route/round/target data.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
