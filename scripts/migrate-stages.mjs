import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.local", "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

// Map old milestone names to stage IDs
// 0: הוזמן, 1: נשלח לסוכן, 2: הגיע לסוכן, 3: נשלח אלינו, 4: הגיע
const milestoneToStage = {
  "הוזמן": 0,
  "נשלח לסוכן": 1,
  "בדרך לסוכן": 1,
  "הגיע לסוכן": 2,
  "הגיע": 4,
  "לא הגיע": 1,
};

async function main() {
  console.log("Migrating milestones to stages...\n");

  const kits = await client.query(api.kits.getAllKits);

  for (const kit of kits) {
    const data = await client.query(api.kits.getKitFull, { kitId: kit.kitId });
    console.log(`Kit: ${kit.name} (${data.samples.length} samples)`);

    for (const sample of data.samples) {
      const milestones = data.sampleMilestones.filter((m) => m.sampleId === sample.sampleId);

      // Find the highest stage from milestones
      let maxStage = -1;
      for (const ms of milestones) {
        const stage = milestoneToStage[ms.name];
        if (stage !== undefined && stage > maxStage) {
          maxStage = stage;
        }
      }

      // Also infer from shippingMethod if no milestones matched
      if (maxStage === -1) {
        if (sample.shippingMethod) {
          maxStage = 0; // at least ordered
        }
      }

      if (maxStage >= 0 && sample.currentStage === undefined) {
        console.log(`  ${sample.sampleId}: stage -> ${maxStage}`);
        await client.mutation(api.kits.updateSample, {
          sampleId: sample.sampleId,
          currentStage: maxStage,
        });
      } else if (sample.currentStage !== undefined) {
        console.log(`  ${sample.sampleId}: already has stage ${sample.currentStage}`);
      } else {
        console.log(`  ${sample.sampleId}: no milestones, skipped`);
      }
    }
  }

  console.log("\nDone!");
}

main().catch(console.error);
