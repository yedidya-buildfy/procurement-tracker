import ExcelJS from 'exceljs';

export interface SampleExportRow {
  productName: string;
  supplierName: string;
  costUSD: number | null;
  stage: string;
  trackingNumbers: string;
  rating: number | null;
  ratingNotes: string;
  notes: string;
  archived: boolean;
  imageUrls: string[];
  createdDate: string;
}

const STAGE_NAMES_EN: Record<number, string> = {
  0: 'Ordered',
  1: 'Shipped to Agent',
  2: 'Arrived at Agent',
  3: 'Shipped to Us',
  4: 'Arrived',
};

export function stageToEnglish(stageId: number | null | undefined): string {
  if (stageId == null) return 'Not Ordered';
  return STAGE_NAMES_EN[stageId] ?? 'Unknown';
}

const TRACKING_LEG_EN: Record<string, string> = {
  'ספק לסוכן': 'Supplier to Agent',
  'סוכן אלינו': 'Agent to Us',
  'אחר': 'Other',
};

export function trackingLegToEnglish(leg: string): string {
  return TRACKING_LEG_EN[leg] ?? leg;
}

const HEADERS = [
  'Supplier',
  'Where is the sample',
  'Tracking',
  'Image',
  'More images',
  'Created',
];

// Image cell sizing (pixels); row height in points. ExcelJS uses points for row height (1pt ≈ 1.333px).
const IMAGE_PX = 96;
const IMAGE_ROW_HEIGHT_PT = 78;
const IMAGE_COL_WIDTH_CHARS = 16;
const IMAGE_COL_INDEX_0BASED = 3; // Image column = D = index 3 (0-based)

type FetchedImage = {
  buffer: ArrayBuffer;
  extension: 'png' | 'jpeg' | 'gif';
};

async function fetchImage(url: string): Promise<FetchedImage | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    let extension: 'png' | 'jpeg' | 'gif' = 'png';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = 'jpeg';
    else if (contentType.includes('gif')) extension = 'gif';
    else if (contentType.includes('png')) extension = 'png';
    else {
      // Sniff from URL extension as a fallback
      const lower = url.toLowerCase();
      if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) extension = 'jpeg';
      else if (lower.endsWith('.gif')) extension = 'gif';
    }
    return { buffer, extension };
  } catch {
    return null;
  }
}

export async function exportSamplesToXLSX(rows: SampleExportRow[], filename: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Samples');

  ws.columns = [
    { header: HEADERS[0], width: 22 }, // Supplier
    { header: HEADERS[1], width: 20 }, // Where is the sample
    { header: HEADERS[2], width: 30 }, // Tracking
    { header: HEADERS[3], width: IMAGE_COL_WIDTH_CHARS }, // Image
    { header: HEADERS[4], width: 60 }, // More images
    { header: HEADERS[5], width: 12 }, // Created
  ];

  // Style header row
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { vertical: 'middle' };

  // Pre-fetch all primary images in parallel (only the first image of each sample is embedded;
  // any additional images go into the "More images" column as URLs).
  const primaryFetches = await Promise.all(
    rows.map((row) => (row.imageUrls[0] ? fetchImage(row.imageUrls[0]) : Promise.resolve(null)))
  );

  rows.forEach((row, i) => {
    const excelRow = ws.addRow([
      row.supplierName,
      row.stage,
      row.trackingNumbers,
      '', // Image cell — populated via addImage below
      row.imageUrls.slice(1).join(', '),
      row.createdDate,
    ]);
    excelRow.alignment = { vertical: 'middle', wrapText: true };

    // Embed primary image
    const fetched = primaryFetches[i];
    if (fetched) {
      const imageId = workbook.addImage({
        buffer: fetched.buffer,
        extension: fetched.extension,
      });
      // Anchor to the Image column (D, 0-based index 3). Data rows start at sheet-row 2 → 0-based row = i + 1.
      ws.addImage(imageId, {
        tl: { col: IMAGE_COL_INDEX_0BASED, row: i + 1 },
        ext: { width: IMAGE_PX, height: IMAGE_PX },
        editAs: 'oneCell',
      });
      excelRow.height = IMAGE_ROW_HEIGHT_PT;
    }
  });

  const buf = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
