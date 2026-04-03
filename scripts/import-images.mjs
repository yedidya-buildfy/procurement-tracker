import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { readFileSync, existsSync } from "fs";

const envContent = readFileSync(".env.local", "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

// Mapping: supplier name (lowercase) -> image file path
const imageMap = [
  { supplier: "fannie huang", file: "image19.png" },
  { supplier: "kaylee wang", file: "image1.jpg" },
  { supplier: "alliy chu", file: "image17.jpg" },
  { supplier: "wu ya nan", file: "image15.jpg" },
  { supplier: "john wayne", file: "image9.jpg" },
  { supplier: "amanda deng", file: "image11.png" },
  { supplier: "angela li", file: "image5.png" },
  { supplier: "amanda grasi", file: "image6.jpg" },
  { supplier: "rantiz technology", file: "image8.png" },
  { supplier: "rachel lin", file: "image7.png" },
  { supplier: "grace liu", file: "image13.png" },  // row 25 = ציפוי sample
  { supplier: "wendy", file: "image18.jpg" },
  { supplier: "kaylee wang ייצרן שמפו", file: "image2.jpg" },
  { supplier: "luffy wang", file: "image12.png" },
  { supplier: "cailun huang", file: "image4.jpg" },
  { supplier: "alan wei", file: "image10.png" },
];

const MEDIA_DIR = "/tmp/xlsx-extract/sample_tracking/xl/media/";

const mimeTypes = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
};

async function main() {
  console.log("Importing images into samples...\n");

  // Get all kits and their data
  const kits = await client.query(api.kits.getAllKits);

  // Get all suppliers
  const allSuppliers = await client.query(api.suppliers.getAllSuppliers);
  const supplierByName = new Map();
  for (const s of allSuppliers) {
    supplierByName.set(s.name.toLowerCase().trim(), s.supplierId);
  }

  // Get all kit data to find samples
  const allSamples = [];
  for (const kit of kits) {
    const data = await client.query(api.kits.getKitFull, { kitId: kit.kitId });
    for (const sample of data.samples) {
      allSamples.push(sample);
    }
  }

  console.log(`Found ${allSamples.length} total samples across ${kits.length} kits\n`);

  let uploaded = 0;
  let skipped = 0;

  for (const mapping of imageMap) {
    const filePath = MEDIA_DIR + mapping.file;
    if (!existsSync(filePath)) {
      console.log(`  SKIP: ${mapping.supplier} - file not found: ${mapping.file}`);
      skipped++;
      continue;
    }

    const supplierId = supplierByName.get(mapping.supplier);
    if (!supplierId) {
      console.log(`  SKIP: ${mapping.supplier} - supplier not found in DB`);
      skipped++;
      continue;
    }

    // Find sample(s) for this supplier
    const matchingSamples = allSamples.filter(
      (s) => s.supplierId === supplierId
    );

    if (matchingSamples.length === 0) {
      console.log(`  SKIP: ${mapping.supplier} - no samples found`);
      skipped++;
      continue;
    }

    // For Grace Liu who has 2 samples, the image at row 25 is the ציפוי one (second sample)
    // We'll attach to all matching samples for simplicity, unless there's ambiguity
    const sample = matchingSamples.length === 1
      ? matchingSamples[0]
      : mapping.supplier === "grace liu"
        ? matchingSamples[matchingSamples.length - 1]  // last one (ציפוי row 25)
        : matchingSamples[0];

    // Read the file
    const fileData = readFileSync(filePath);
    const ext = mapping.file.split(".").pop().toLowerCase();
    const contentType = mimeTypes[ext] || "image/jpeg";

    // Upload to Convex
    const uploadUrl = await client.mutation(api.kits.generateUploadUrl);
    const uploadResult = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: fileData,
    });
    const { storageId } = await uploadResult.json();

    // Link to sample
    await client.mutation(api.kits.addSampleImage, {
      sampleId: sample.sampleId,
      storageId,
    });

    console.log(`  OK: ${mapping.supplier} -> ${sample.sampleId} (${mapping.file})`);
    uploaded++;
  }

  console.log(`\nDone! Uploaded: ${uploaded}, Skipped: ${skipped}`);
}

main().catch(console.error);
