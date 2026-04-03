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
  const { products, samples, finalProducts } = data;

  console.log(`Kit: ${kit.name} (${kit.kitId})`);
  console.log(`Products: ${products.length}, Samples: ${samples.length}, Final: ${finalProducts.length}\n`);

  // Merge map: old name -> target name
  const mergeMap = {
    "חומר ניקוי וציפוי למקלחת": "חומר ניקוי",
    "ציפוי ניקוי": "חומר ניקוי",
    "ציפוי +ניקוי": "חומר ניקוי",
    "ניקוי + ציפוי": "חומר ניקוי",
    "משחת ניקוי וציפוי": "חומר ניקוי",
    "משחת ניקוי כללית (כמו פינק)": "חומר ניקוי",
    "משחה": "חומר ניקוי",
    "ציפוי": "ציפוי ננו",
    "ננו בלבד": "ציפוי ננו",
    "רק ציפוי ספריי קטן": "ציפוי ננו",
    "ספוג": "ספוג ואפליקטור",
    "ספוגי ניקוי לזכוכית ללא חומר": "ספוג ואפליקטור",
    "אפליקטור": "ספוג ואפליקטור",
    "בקבוקונים": "אמפולות",
    "לא מוגדר": "חומר ניקוי",  // Carina Bai was for drive buddy
  };

  // Shampoo products -> separate kit
  const shampooNames = new Set(["שמפואים", "שמפו בכבישה קרה", "שמפו מרכך מסיכה", "סבונים פורמולה אישית"]);

  // Build product name -> kitProductId lookup
  const productByName = new Map();
  for (const p of products) {
    productByName.set(p.name, p);
  }

  // Step 1: Create shampoo kit
  console.log("Creating shampoo kit...");
  const shampooKitId = await client.mutation(api.kits.createKit, {
    name: "שמפואים - רוט",
    notes: "מעקב דוגמיות שמפואים וסבונים",
  });
  console.log(`  Created: ${shampooKitId}\n`);

  // Step 2: Ensure target products exist in drive buddy kit
  const targetNames = new Set(Object.values(mergeMap));
  // Add products that aren't being merged or moved (טבליות, שפורפרת, קופסה, משלוחים)
  for (const p of products) {
    if (!mergeMap[p.name] && !targetNames.has(p.name) && !shampooNames.has(p.name)) {
      targetNames.add(p.name);
    }
  }

  const targetProductIds = new Map(); // target name -> kitProductId
  for (const name of targetNames) {
    const existing = productByName.get(name);
    if (existing) {
      targetProductIds.set(name, existing.kitProductId);
    } else {
      console.log(`  Creating target product: ${name}`);
      const id = await client.mutation(api.kits.addKitProduct, { kitId: kit.kitId, name });
      targetProductIds.set(name, id);
    }
  }

  // Step 3: Reassign samples from merged products to target products
  console.log("\nReassigning samples...");
  for (const sample of samples) {
    const oldProduct = products.find((p) => p.kitProductId === sample.kitProductId);
    if (!oldProduct) continue;

    const targetName = mergeMap[oldProduct.name];
    if (!targetName) continue; // not being merged

    const targetId = targetProductIds.get(targetName);
    if (!targetId || targetId === sample.kitProductId) continue;

    console.log(`  ${sample.sampleId}: "${oldProduct.name}" -> "${targetName}"`);
    await client.mutation(api.kits.reassignSample, {
      sampleId: sample.sampleId,
      newKitProductId: targetId,
    });
  }

  // Step 4: Reassign final products from merged products
  console.log("\nReassigning final products...");
  for (const fp of finalProducts) {
    const oldProduct = products.find((p) => p.kitProductId === fp.kitProductId);
    if (!oldProduct) continue;

    const targetName = mergeMap[oldProduct.name];
    if (!targetName) continue;

    const targetId = targetProductIds.get(targetName);
    if (!targetId || targetId === fp.kitProductId) continue;

    console.log(`  ${fp.kitFinalProductId}: "${oldProduct.name}" -> "${targetName}"`);
    await client.mutation(api.kits.reassignFinalProduct, {
      kitFinalProductId: fp.kitFinalProductId,
      newKitProductId: targetId,
    });
  }

  // Step 5: Move shampoo products to shampoo kit
  console.log("\nMoving shampoo products to new kit...");
  for (const name of shampooNames) {
    const product = productByName.get(name);
    if (!product) continue;

    // First check: do we need to merge this into "שמפואים" target?
    if (name !== "שמפואים") {
      // Reassign samples from this product to the שמפואים product
      const shampooTarget = productByName.get("שמפואים");
      if (shampooTarget) {
        const productSamples = samples.filter((s) => s.kitProductId === product.kitProductId);
        for (const sample of productSamples) {
          console.log(`  Merging sample ${sample.sampleId} from "${name}" -> "שמפואים"`);
          await client.mutation(api.kits.reassignSample, {
            sampleId: sample.sampleId,
            newKitProductId: shampooTarget.kitProductId,
          });
        }
        // Delete the now-empty product
        console.log(`  Deleting empty product: ${name}`);
        await client.mutation(api.kits.deleteKitProduct, { kitProductId: product.kitProductId });
      }
    }
  }

  // Now move the consolidated שמפואים product to the shampoo kit
  const shampooProduct = productByName.get("שמפואים");
  if (shampooProduct) {
    console.log(`  Moving "שמפואים" to shampoo kit`);
    await client.mutation(api.kits.moveProductToKit, {
      kitProductId: shampooProduct.kitProductId,
      newKitId: shampooKitId,
    });
  }

  // Step 6: Delete empty merged products
  console.log("\nCleaning up empty products...");
  // Re-fetch data to see current state
  const refreshed = await client.query(api.kits.getKitFull, { kitId: kit.kitId });
  for (const product of refreshed.products) {
    const hasSamples = refreshed.samples.some((s) => s.kitProductId === product.kitProductId);
    const hasFinal = refreshed.finalProducts.some((f) => f.kitProductId === product.kitProductId);

    if (!hasSamples && !hasFinal) {
      console.log(`  Deleting empty: ${product.name}`);
      await client.mutation(api.kits.deleteKitProduct, { kitProductId: product.kitProductId });
    }
  }

  // Final report
  const final1 = await client.query(api.kits.getKitFull, { kitId: kit.kitId });
  const final2 = await client.query(api.kits.getKitFull, { kitId: shampooKitId });

  console.log("\n=== Final State ===");
  console.log(`\n${final1.kit.name}:`);
  for (const p of final1.products) {
    const count = final1.samples.filter((s) => s.kitProductId === p.kitProductId).length;
    const fpCount = final1.finalProducts.filter((f) => f.kitProductId === p.kitProductId).length;
    console.log(`  ${p.name}: ${count} samples, ${fpCount} final`);
  }

  console.log(`\n${final2.kit.name}:`);
  for (const p of final2.products) {
    const count = final2.samples.filter((s) => s.kitProductId === p.kitProductId).length;
    console.log(`  ${p.name}: ${count} samples`);
  }

  console.log("\nDone!");
}

main().catch(console.error);
