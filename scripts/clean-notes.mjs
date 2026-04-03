import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.local", "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

async function main() {
  const kits = await client.query(api.kits.getAllKits);

  for (const kit of kits) {
    const data = await client.query(api.kits.getKitFull, { kitId: kit.kitId });

    for (const sample of data.samples) {
      if (!sample.notes) continue;

      let cleaned = sample.notes;

      // Remove "חנות: דרייב באדי" and "חנות: רוט" patterns
      cleaned = cleaned.replace(/\s*\|\s*חנות:\s*דרייב באדי/g, '');
      cleaned = cleaned.replace(/חנות:\s*דרייב באדי\s*\|?\s*/g, '');
      cleaned = cleaned.replace(/\s*\|\s*חנות:\s*רוט/g, '');
      cleaned = cleaned.replace(/חנות:\s*רוט\s*\|?\s*/g, '');

      // Clean up leftover separators
      cleaned = cleaned.replace(/^\s*\|\s*/, '').replace(/\s*\|\s*$/, '').trim();

      if (cleaned !== sample.notes) {
        console.log(`${sample.sampleId}: "${sample.notes}" -> "${cleaned}"`);
        await client.mutation(api.kits.updateSample, {
          sampleId: sample.sampleId,
          notes: cleaned || undefined,
        });
      }
    }
  }

  console.log("\nDone!");
}

main().catch(console.error);
