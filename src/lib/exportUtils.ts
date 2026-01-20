import * as XLSX from 'xlsx';

export interface ProductCostRow {
  productName: string;
  supplier: string;
  quantity: number;
  unitPrice: string;
  productCostILS: number;
  unitPriceILS: number;
  additionalCostsILS: number;
  totalCostILS: number;
  landedUnitCostILS: number;
  percentOfOrder: number;
}

interface ExportHeaders {
  productName: string;
  supplier: string;
  quantity: string;
  unitPrice: string;
  productCostILS: string;
  unitPriceILS: string;
  additionalCostsILS: string;
  totalCostILS: string;
  landedUnitCostILS: string;
  percentOfOrder: string;
}

const HEBREW_HEADERS: ExportHeaders = {
  productName: 'שם מוצר',
  supplier: 'ספק',
  quantity: 'כמות',
  unitPrice: 'מחיר יחידה',
  productCostILS: 'עלות מוצר ₪',
  unitPriceILS: 'מחיר יחידה ₪',
  additionalCostsILS: 'עלויות נוספות ₪',
  totalCostILS: 'עלות כוללת ₪',
  landedUnitCostILS: 'עלות ליחידה ₪',
  percentOfOrder: '% מההזמנה',
};

function formatNumber(value: number, decimals: number = 2): string {
  return value.toFixed(decimals);
}

function rowToArray(row: ProductCostRow): (string | number)[] {
  return [
    row.productName,
    row.supplier,
    row.quantity,
    row.unitPrice,
    formatNumber(row.productCostILS),
    formatNumber(row.unitPriceILS),
    formatNumber(row.additionalCostsILS),
    formatNumber(row.totalCostILS),
    formatNumber(row.landedUnitCostILS),
    formatNumber(row.percentOfOrder, 1) + '%',
  ];
}

function createTotalsRow(data: ProductCostRow[]): (string | number)[] {
  const totals = data.reduce(
    (acc, row) => ({
      quantity: acc.quantity + row.quantity,
      productCostILS: acc.productCostILS + row.productCostILS,
      additionalCostsILS: acc.additionalCostsILS + row.additionalCostsILS,
      totalCostILS: acc.totalCostILS + row.totalCostILS,
    }),
    { quantity: 0, productCostILS: 0, additionalCostsILS: 0, totalCostILS: 0 }
  );

  return [
    'סה"כ',
    '',
    totals.quantity,
    '',
    formatNumber(totals.productCostILS),
    '',
    formatNumber(totals.additionalCostsILS),
    formatNumber(totals.totalCostILS),
    '',
    '100%',
  ];
}

export function exportToCSV(data: ProductCostRow[], filename: string): void {
  // Create headers row
  const headers = Object.values(HEBREW_HEADERS);

  // Create data rows
  const rows = data.map(rowToArray);

  // Add totals row
  const totalsRow = createTotalsRow(data);

  // Combine all rows
  const csvContent = [headers, ...rows, totalsRow]
    .map((row) => row.map((cell) => `"${cell}"`).join(','))
    .join('\n');

  // Add UTF-8 BOM for Hebrew support
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  // Trigger download
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export function exportToXLSX(data: ProductCostRow[], filename: string): void {
  // Create headers row
  const headers = Object.values(HEBREW_HEADERS);

  // Create data rows with numeric values for Excel
  const rows = data.map((row) => [
    row.productName,
    row.supplier,
    row.quantity,
    row.unitPrice,
    row.productCostILS,
    row.unitPriceILS,
    row.additionalCostsILS,
    row.totalCostILS,
    row.landedUnitCostILS,
    row.percentOfOrder / 100, // For percentage formatting
  ]);

  // Calculate totals
  const totals = data.reduce(
    (acc, row) => ({
      quantity: acc.quantity + row.quantity,
      productCostILS: acc.productCostILS + row.productCostILS,
      additionalCostsILS: acc.additionalCostsILS + row.additionalCostsILS,
      totalCostILS: acc.totalCostILS + row.totalCostILS,
    }),
    { quantity: 0, productCostILS: 0, additionalCostsILS: 0, totalCostILS: 0 }
  );

  const totalsRow = [
    'סה"כ',
    '',
    totals.quantity,
    '',
    totals.productCostILS,
    '',
    totals.additionalCostsILS,
    totals.totalCostILS,
    '',
    1, // 100%
  ];

  // Combine all data
  const wsData = [headers, ...rows, totalsRow];

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [
    { wch: 20 }, // Product Name
    { wch: 15 }, // Supplier
    { wch: 8 },  // Quantity
    { wch: 12 }, // Unit Price
    { wch: 14 }, // Product Cost ILS
    { wch: 14 }, // Unit Price ILS
    { wch: 16 }, // Additional Costs ILS
    { wch: 14 }, // Total Cost ILS
    { wch: 14 }, // Landed Unit Cost ILS
    { wch: 12 }, // % of Order
  ];

  // Apply number formatting for currency columns (columns E-I, 1-indexed as 4-8)
  const currencyFormat = '#,##0.00';
  const percentFormat = '0.0%';

  for (let r = 1; r <= rows.length + 1; r++) {
    // Skip header row (0)
    // Currency columns: E (4), F (5), G (6), H (7), I (8)
    ['E', 'F', 'G', 'H', 'I'].forEach((col) => {
      const cellRef = `${col}${r + 1}`;
      if (ws[cellRef] && typeof ws[cellRef].v === 'number') {
        ws[cellRef].z = currencyFormat;
      }
    });

    // Percentage column: J (9)
    const percentRef = `J${r + 1}`;
    if (ws[percentRef] && typeof ws[percentRef].v === 'number') {
      ws[percentRef].z = percentFormat;
    }
  }

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'פירוט עלויות');

  // Write and download
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
