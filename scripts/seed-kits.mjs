import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import XLSX from "xlsx";
import { readFileSync } from "fs";

// Parse .env.local manually
const envContent = readFileSync(".env.local", "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  console.error("Missing NEXT_PUBLIC_CONVEX_URL in .env.local");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

function excelDateToISO(val) {
  if (!val || val === "?" || val === "free" || val === "חינם") return null;
  if (typeof val === "number" && val > 40000) {
    const d = new Date((val - 25569) * 86400000);
    return d.toISOString().split("T")[0];
  }
  if (typeof val === "string") {
    const parts = val.trim().split(/[\s/.-]+/);
    if (parts.length === 2) {
      const m = parseInt(parts[0]);
      const d = parseInt(parts[1]);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `2025-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      }
    }
    if (parts.length === 3) {
      let [a, b, c] = parts.map(Number);
      if (c < 100) c += 2000;
      return `${c}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
    }
  }
  return null;
}

function parseCost(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return val;
  const s = String(val).replace(/[$\s]/g, "");
  if (s === "free" || s === "חינם" || s === "") return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

async function main() {
  console.log("Starting seed...\n");

  // Read both Excel files
  const wb1 = XLSX.readFile("/Users/yedidya/Downloads/מעקב דוגמיות ורכש q4.xlsx");
  const rows = XLSX.utils.sheet_to_json(wb1.Sheets["מעקב דוגמיות ורכש"], { header: 1, raw: true });

  const wb2 = XLSX.readFile("/Users/yedidya/Downloads/קנייה סופית ערכה חדשה.xlsx");
  const fpRows = XLSX.utils.sheet_to_json(wb2.Sheets["גיליון1"], { header: 1, raw: true });

  // Get existing suppliers
  const existingSuppliers = await client.query(api.suppliers.getAllSuppliers);
  const supplierMap = new Map();
  for (const s of existingSuppliers) {
    supplierMap.set(s.name.toLowerCase().trim(), s.supplierId);
  }

  // Parse sample rows
  const sampleData = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0] || !String(row[0]).trim()) continue;
    const supplierName = String(row[0]).trim();

    if (!supplierMap.has(supplierName.toLowerCase())) {
      console.log(`  + Supplier: ${supplierName}`);
      const id = await client.mutation(api.suppliers.addSupplier, { name: supplierName, country: "סין" });
      supplierMap.set(supplierName.toLowerCase(), id);
    }

    sampleData.push({
      supplierName,
      supplierId: supplierMap.get(supplierName.toLowerCase()),
      product: row[1] ? String(row[1]).trim() : null,
      store: row[2] ? String(row[2]).trim() : null,
      orderDate: excelDateToISO(row[3]),
      cost: parseCost(row[5]),
      paid: row[6] === "כן",
      shippingMethod: row[7] ? String(row[7]).trim() : null,
      expectedDate: excelDateToISO(row[8]),
      status: row[9] ? String(row[9]).trim() : null,
      tracking: row[10] ? String(row[10]).trim() : null,
      arrived: row[11] ? String(row[11]).trim() : null,
      notes: row[12] ? String(row[12]).trim() : null,
      satisfied: row[13] ? String(row[13]).trim() : null,
      interesting: row[14] ? String(row[14]).trim() : null,
    });
  }

  console.log(`\nFound ${sampleData.length} samples\n`);

  // Create kit
  const kitId = await client.mutation(api.kits.createKit, {
    name: "ערכה חדשה - דרייב באדי",
    notes: "ערכת ניקוי וציפוי למקלחת - Q4 2025",
  });
  console.log(`Created kit: ${kitId}\n`);

  // Create unique products
  const productCategories = new Set();
  for (const s of sampleData) {
    productCategories.add(s.product || "לא מוגדר");
  }

  const kitProductMap = new Map();
  for (const name of productCategories) {
    const id = await client.mutation(api.kits.addKitProduct, { kitId, name });
    kitProductMap.set(name, id);
    console.log(`  + Product: ${name}`);
  }

  // Create samples with milestones and tracking
  console.log("\nCreating samples...");
  for (const s of sampleData) {
    const productName = s.product || "לא מוגדר";
    const kitProductId = kitProductMap.get(productName);

    const noteParts = [];
    if (s.notes) noteParts.push(s.notes);
    if (s.arrived) noteParts.push(`הגיע: ${s.arrived}`);
    if (s.interesting) noteParts.push(`מעניין: ${s.interesting}`);
    if (s.store) noteParts.push(`חנות: ${s.store}`);

    const sampleId = await client.mutation(api.kits.addSample, {
      kitProductId,
      supplierId: s.supplierId,
      sampleCost: s.cost || undefined,
      paid: s.paid,
      shippingMethod: s.shippingMethod || undefined,
      notes: noteParts.join(" | ") || undefined,
    });

    // Rating from satisfaction
    let rating, ratingNotes, isRelevant;
    if (s.satisfied) {
      ratingNotes = s.satisfied;
      if (s.satisfied === "זבל") { rating = 1; isRelevant = false; }
      else if (s.satisfied === "יחסית") { rating = 3; }
      else { rating = 2; }
    }

    if (rating !== undefined || isRelevant !== undefined) {
      await client.mutation(api.kits.updateSample, {
        sampleId,
        ...(rating !== undefined && { rating }),
        ...(ratingNotes !== undefined && { ratingNotes }),
        ...(isRelevant !== undefined && { isRelevant }),
      });
    }

    // Tracking number
    if (s.tracking && s.tracking !== "null" && s.tracking !== "undefined") {
      await client.mutation(api.kits.addTrackingNumber, {
        sampleId,
        leg: "ספק לסוכן",
        trackingNumber: s.tracking,
      });
    }

    // Milestone: ordered
    if (s.orderDate) {
      const msId = await client.mutation(api.kits.addSampleMilestone, {
        sampleId,
        name: "הוזמן",
        targetDate: s.orderDate,
      });
      await client.mutation(api.kits.updateSampleMilestone, {
        milestoneId: msId,
        actualDate: s.orderDate,
      });
    }

    // Milestone: shipping status
    if (s.status) {
      const statusMap = {
        "הגיע": { name: "הגיע", done: true },
        "לא הגיע": { name: "לא הגיע", done: false },
        "בדרך לאדם": { name: "בדרך לסוכן", done: false },
        "לאדם": { name: "נשלח לסוכן", done: false },
        "הגיע לאדם": { name: "הגיע לסוכן", done: true },
      };
      const ms = statusMap[s.status];
      if (ms) {
        const msId = await client.mutation(api.kits.addSampleMilestone, {
          sampleId,
          name: ms.name,
          targetDate: s.expectedDate || undefined,
        });
        if (ms.done) {
          await client.mutation(api.kits.updateSampleMilestone, {
            milestoneId: msId,
            actualDate: s.expectedDate || s.orderDate || new Date().toISOString().split("T")[0],
          });
        }
      }
    }

    console.log(`  + Sample: ${s.supplierName} -> ${productName}`);
  }

  // Import final purchase
  console.log("\nImporting final purchase...");
  for (let i = 1; i < fpRows.length; i++) {
    const row = fpRows[i];
    if (!row || !row[0] || String(row[0]).trim() === "טוטאל" || !String(row[0]).trim()) break;

    const itemName = String(row[0]).trim();
    const pricePerUnit = typeof row[1] === "number" ? row[1] : undefined;
    const weight = typeof row[3] === "number" ? row[3] : undefined;
    const moq = typeof row[4] === "number" ? row[4] : undefined;
    const supplierName = row[6] ? String(row[6]).trim() : null;
    const totalCost = typeof row[7] === "number" ? row[7] : undefined;

    // Find or create kit product
    let kitProductId = kitProductMap.get(itemName);
    if (!kitProductId) {
      kitProductId = await client.mutation(api.kits.addKitProduct, { kitId, name: itemName });
      kitProductMap.set(itemName, kitProductId);
      console.log(`  + Product: ${itemName}`);
    }

    if (!supplierName) {
      console.log(`  - Skipping ${itemName} (no supplier)`);
      continue;
    }

    // Ensure supplier exists
    if (!supplierMap.has(supplierName.toLowerCase())) {
      const id = await client.mutation(api.suppliers.addSupplier, { name: supplierName, country: "סין" });
      supplierMap.set(supplierName.toLowerCase(), id);
      console.log(`  + Supplier: ${supplierName}`);
    }

    const supplierId = supplierMap.get(supplierName.toLowerCase());

    await client.mutation(api.kits.addKitFinalProduct, {
      kitProductId,
      supplierId,
      pricePerUnit,
      weight,
      moq,
      totalCost,
    });
    console.log(`  + Final: ${itemName} from ${supplierName} ($${totalCost || 0})`);
  }

  console.log("\nSeed completed!");
}

main().catch(console.error);
