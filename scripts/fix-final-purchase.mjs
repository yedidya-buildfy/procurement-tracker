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

  // Items to add: קופסה ($0.4/unit, $1400 total) and משלוחים ($0.1904/unit, $666.4 total)
  const missingItems = [
    { name: "קופסה", pricePerUnit: 0.4, totalCost: 1400 },
    { name: "משלוחים", pricePerUnit: 0.1904, totalCost: 666.4 },
  ];

  for (const item of missingItems) {
    // Check if product exists
    let product = data.products.find((p) => p.name === item.name);
    let kitProductId;

    if (product) {
      kitProductId = product.kitProductId;
    } else {
      console.log(`Creating product: ${item.name}`);
      kitProductId = await client.mutation(api.kits.addKitProduct, {
        kitId: kit.kitId,
        name: item.name,
      });
    }

    // Check if final product already exists
    const existing = data.finalProducts.find((fp) => fp.kitProductId === kitProductId);
    if (existing) {
      console.log(`${item.name} already exists in final purchase, skipping`);
      continue;
    }

    console.log(`Adding final product: ${item.name}`);
    await client.mutation(api.kits.addKitFinalProduct, {
      kitProductId,
      pricePerUnit: item.pricePerUnit,
      totalCost: item.totalCost,
    });
  }

  console.log("Done!");
}

main().catch(console.error);
