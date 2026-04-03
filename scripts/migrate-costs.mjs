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
  const kit = kits.find((k) => k.name.includes("דרייב באדי"));
  if (!kit) { console.error("Kit not found"); return; }

  const data = await client.query(api.kits.getKitFull, { kitId: kit.kitId });

  // Find "משלוחים" and "קופסה" in finalProducts and migrate to costs
  const costItems = ["משלוחים", "קופסה"];

  for (const name of costItems) {
    const product = data.products.find((p) => p.name === name);
    if (!product) { console.log(`Product "${name}" not found, skipping`); continue; }

    const fp = data.finalProducts.find((f) => f.kitProductId === product.kitProductId);
    if (!fp) { console.log(`Final product for "${name}" not found, skipping`); continue; }

    // Create as cost
    console.log(`Migrating "${name}" ($${fp.totalCost}) to cost`);
    await client.mutation(api.kits.addKitCost, {
      kitId: kit.kitId,
      description: name,
      costType: "fixed",
      amount: fp.totalCost || 0,
    });

    // Delete the final product
    await client.mutation(api.kits.deleteKitFinalProduct, {
      kitFinalProductId: fp.kitFinalProductId,
    });

    // Delete the empty kit product
    const remainingFp = data.finalProducts.filter((f) => f.kitProductId === product.kitProductId && f.kitFinalProductId !== fp.kitFinalProductId);
    const remainingSamples = data.samples.filter((s) => s.kitProductId === product.kitProductId);
    if (remainingFp.length === 0 && remainingSamples.length === 0) {
      console.log(`Deleting empty product "${name}"`);
      await client.mutation(api.kits.deleteKitProduct, { kitProductId: product.kitProductId });
    }
  }

  console.log("Done!");
}

main().catch(console.error);
