import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Business sequence for the nightly patrol rounds. The source requirement lists
// "23:00, 00:00/12:00 AM equivalent, 01:00 ... 05:00" — 7 rounds total per night.
const ROUND_LABELS = ["R1 23:00", "R2 00:00", "R3 01:00", "R4 02:00", "R5 03:00", "R6 04:00", "R7 05:00"];
const ROUND_TIMES = ["23:00", "00:00", "01:00", "02:00", "03:00", "04:00", "05:00"];

interface PlantSeed {
  name: string;
  targetCount: number;
  checkpoints: string[];
  aliases?: Record<string, string[]>; // checkpoint name -> known alias strings from sample PDFs
}

const PLANTS: PlantSeed[] = [
  {
    name: "TAG 1A",
    targetCount: 28,
    checkpoints: ["HIGH VOLTAGE", "TESTING AREA", "TESTING AREA OUTSIDE", "TESTING AREA COMPOUND WALL"]
  },
  {
    name: "TAG 1B",
    targetCount: 28,
    checkpoints: ["BIKE PARKING", "RUBBER MOLDING GATE", "MAIN ENTRANCE", "DESMA ENTRANCE"],
    aliases: { "RUBBER MOLDING GATE": ["RUBBER MOLDING"] }
  },
  {
    name: "TAG 2",
    targetCount: 77,
    checkpoints: [
      "Material Gate",
      "Shed 3 Compound Wall",
      "Irrigation Well",
      "S 2 Tool Room",
      "S 2 Forging Section",
      "Waiing For Forging",
      "S2 A Corner",
      "Remaining Material Area",
      "S1 inisde Opposite to temple",
      "Near Temple outside S 1",
      "Office Gate"
    ]
  },
  {
    name: "TAG 3",
    targetCount: 49,
    checkpoints: ["SECURITY ROOM", "MAIN ENTRANCE", "OIL TANK", "OFFICE", "ETP", "SOLAR", "CANTEEN"],
    aliases: { "SECURITY ROOM": ["SECURITY"] }
  },
  {
    name: "TAG 4",
    targetCount: 28,
    checkpoints: ["ARMOUR ROD AREA", "CHEMICAL WASHING AREA", "VIBRATION DAMPER SHED", "100 TON WEIGH BRIDGE"],
    aliases: { "VIBRATION DAMPER SHED": ["Vibration dambar Welding shed"] }
  },
  {
    name: "STK",
    targetCount: 21,
    checkpoints: ["ENTRANCE", "BUILDING INSIDE", "COMPOUND WALL"]
  },
  {
    name: "SSVF",
    targetCount: 21,
    checkpoints: ["SECURITY AREA", "EB ROOM", "COOLING TOWER"]
    // NOTE: sample SSVF PDF contains "CYLINDER AREA" which is intentionally NOT
    // aliased to COOLING TOWER here — per requirement, admin must approve it
    // explicitly via the Aliases screen before it counts as valid.
  }
];

async function main() {
  for (const p of PLANTS) {
    const plant = await prisma.plant.upsert({
      where: { name: p.name },
      update: { targetCount: p.targetCount, active: true },
      create: { name: p.name, targetCount: p.targetCount, active: true, toleranceMinutes: 30 }
    });

    for (let i = 0; i < p.checkpoints.length; i++) {
      const cpName = p.checkpoints[i];
      const cp = await prisma.checkpoint.upsert({
        where: { plantId_name: { plantId: plant.id, name: cpName } },
        update: { order: i },
        create: { plantId: plant.id, name: cpName, order: i }
      });

      const aliasList = p.aliases?.[cpName] ?? [];
      for (const alias of aliasList) {
        await prisma.checkpointAlias.upsert({
          where: { checkpointId_alias: { checkpointId: cp.id, alias } },
          update: {},
          create: { checkpointId: cp.id, alias, approved: true }
        });
      }
    }

    for (let i = 0; i < ROUND_LABELS.length; i++) {
      await prisma.roundSchedule.upsert({
        where: { plantId_label: { plantId: plant.id, label: ROUND_LABELS[i] } },
        update: { startTime: ROUND_TIMES[i], order: i },
        create: { plantId: plant.id, label: ROUND_LABELS[i], startTime: ROUND_TIMES[i], order: i }
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

  console.log("Seed complete: 7 plants, checkpoints, aliases, round schedules.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
