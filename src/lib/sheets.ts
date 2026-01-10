import { google, sheets_v4 } from 'googleapis';

function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SPREADSHEET_ID;
  if (!id) {
    throw new Error('GOOGLE_SPREADSHEET_ID environment variable is not set');
  }
  return id;
}

// Sheet names
export const SHEETS = {
  ORDERS: 'Orders',
  PRODUCTS: 'Products',
  ADDITIONAL_COSTS: 'AdditionalCosts',
  COST_PRODUCT_LINKS: 'CostProductLinks',
  PAYMENTS: 'Payments',
  MILESTONES: 'Milestones',
  SUPPLIERS: 'Suppliers',
} as const;

// Types
export interface Order {
  order_id: string;
  order_name: string;
  supplier?: string;
  usd_rate: number;
  cny_rate: number;
  created_date: string;
  estimated_arrival: string;
  status: string;
  notes: string;
  // Computed
  productCount?: number;
  totalProductsILS?: number;
  totalCostsILS?: number;
  totalOrderILS?: number;
  totalPaidILS?: number;
  balanceILS?: number;
}

export interface Product {
  id: string;
  order_id: string;
  name: string;
  supplier: string;
  quantity: number;
  price_per_unit: number;
  price_total: number;
  currency: 'USD' | 'CNY' | 'ILS';
  cbm_per_unit: number;
  cbm_total: number;
  kg_per_unit: number;
  kg_total: number;
  order_date: string;
  notes: string;
  // Computed
  priceILS?: number;
  additionalCostsILS?: number;
  finalCostILS?: number;
  finalCostPerUnitILS?: number;
}

export interface AdditionalCost {
  id: string;
  order_id: string;
  description: string;
  amount: number;
  currency: 'USD' | 'CNY' | 'ILS';
  allocation_method: 'נפח' | 'משקל' | 'עלות' | 'כמות' | 'שווה';
  notes: string;
  // Computed
  amountILS?: number;
  linkedProductCount?: number;
}

export interface CostProductLink {
  id: string;
  cost_id: string;
  product_id: string;
  is_linked: boolean;
}

export interface Payment {
  id: string;
  order_id: string;
  product_id: string;
  cost_id: string;
  date: string;
  amount: number;
  currency: 'USD' | 'CNY' | 'ILS';
  payee: string;
  description: string;
  reference: string;
  // Computed
  amountILS?: number;
}

export interface Milestone {
  id: string;
  order_id: string;
  product_id: string;
  description: string;
  target_date: string;
  actual_date: string;
  notes: string;
}

export interface Supplier {
  id: string;
  name: string;
}

// Auth
function getAuth() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!credentials) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set');
  }

  const parsedCredentials = JSON.parse(credentials);

  return new google.auth.GoogleAuth({
    credentials: parsedCredentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function getSheets(): Promise<sheets_v4.Sheets> {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
}

// Helper functions
function rowToObject<T>(headers: string[], row: unknown[]): T {
  const obj: Record<string, unknown> = {};
  headers.forEach((header, i) => {
    obj[header] = row[i] ?? '';
  });
  return obj as T;
}

function convertToNumber(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function convertToBoolean(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (val === 'TRUE' || val === 'true' || val === 1 || val === '1') return true;
  return false;
}

function toILS(amount: number, currency: string, usdRate: number, cnyRate: number): number {
  switch (currency) {
    case 'USD': return amount * usdRate;
    case 'CNY': return amount * cnyRate;
    case 'ILS': return amount;
    default: return amount * usdRate;
  }
}

// Data access functions
export async function getAllOrders(): Promise<Order[]> {
  const sheets = await getSheets();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `${SHEETS.ORDERS}!A:I`,
  });

  const rows = response.data.values;
  if (!rows || rows.length <= 1) return [];

  const headers = rows[0] as string[];
  const orders: Order[] = [];

  for (let i = 1; i < rows.length; i++) {
    const order = rowToObject<Order>(headers, rows[i]);
    order.usd_rate = convertToNumber(order.usd_rate);
    order.cny_rate = convertToNumber(order.cny_rate);
    orders.push(order);
  }

  // Get products, costs, and payments to calculate summaries
  const [products, costs, payments, links] = await Promise.all([
    getAllProducts(),
    getAllCosts(),
    getAllPayments(),
    getAllCostProductLinks(),
  ]);

  for (const order of orders) {
    const orderProducts = products.filter(p => p.order_id === order.order_id);
    const orderCosts = costs.filter(c => c.order_id === order.order_id);
    const orderPayments = payments.filter(p => p.order_id === order.order_id);

    order.productCount = orderProducts.length;

    // Calculate product totals in ILS
    let totalProductsILS = 0;
    for (const product of orderProducts) {
      totalProductsILS += toILS(product.price_total, product.currency, order.usd_rate, order.cny_rate);
    }
    order.totalProductsILS = totalProductsILS;

    // Calculate costs totals in ILS
    let totalCostsILS = 0;
    for (const cost of orderCosts) {
      totalCostsILS += toILS(cost.amount, cost.currency, order.usd_rate, order.cny_rate);
    }
    order.totalCostsILS = totalCostsILS;

    order.totalOrderILS = totalProductsILS + totalCostsILS;

    // Calculate payments total in ILS
    let totalPaidILS = 0;
    for (const payment of orderPayments) {
      totalPaidILS += toILS(payment.amount, payment.currency, order.usd_rate, order.cny_rate);
    }
    order.totalPaidILS = totalPaidILS;

    order.balanceILS = order.totalOrderILS - totalPaidILS;
  }

  return orders;
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  const orders = await getAllOrders();
  return orders.find(o => o.order_id === orderId) || null;
}

export async function getAllProducts(): Promise<Product[]> {
  const sheets = await getSheets();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `${SHEETS.PRODUCTS}!A:N`,
  });

  const rows = response.data.values;
  if (!rows || rows.length <= 1) return [];

  const headers = rows[0] as string[];
  const products: Product[] = [];

  for (let i = 1; i < rows.length; i++) {
    const product = rowToObject<Product>(headers, rows[i]);
    product.quantity = convertToNumber(product.quantity);
    product.price_per_unit = convertToNumber(product.price_per_unit);
    product.price_total = convertToNumber(product.price_total);
    product.cbm_per_unit = convertToNumber(product.cbm_per_unit);
    product.cbm_total = convertToNumber(product.cbm_total);
    product.kg_per_unit = convertToNumber(product.kg_per_unit);
    product.kg_total = convertToNumber(product.kg_total);
    products.push(product);
  }

  return products;
}

export async function getProductsByOrderId(orderId: string): Promise<Product[]> {
  const products = await getAllProducts();
  return products.filter(p => p.order_id === orderId);
}

export async function getAllCosts(): Promise<AdditionalCost[]> {
  const sheets = await getSheets();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `${SHEETS.ADDITIONAL_COSTS}!A:G`,
  });

  const rows = response.data.values;
  if (!rows || rows.length <= 1) return [];

  const headers = rows[0] as string[];
  const costs: AdditionalCost[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cost = rowToObject<AdditionalCost>(headers, rows[i]);
    cost.amount = convertToNumber(cost.amount);
    costs.push(cost);
  }

  return costs;
}

export async function getCostsByOrderId(orderId: string): Promise<AdditionalCost[]> {
  const costs = await getAllCosts();
  return costs.filter(c => c.order_id === orderId);
}

export async function getAllCostProductLinks(): Promise<CostProductLink[]> {
  const sheets = await getSheets();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `${SHEETS.COST_PRODUCT_LINKS}!A:D`,
  });

  const rows = response.data.values;
  if (!rows || rows.length <= 1) return [];

  const headers = rows[0] as string[];
  const links: CostProductLink[] = [];

  for (let i = 1; i < rows.length; i++) {
    const link = rowToObject<CostProductLink>(headers, rows[i]);
    link.is_linked = convertToBoolean(link.is_linked);
    links.push(link);
  }

  return links;
}

export async function getAllPayments(): Promise<Payment[]> {
  const sheets = await getSheets();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `${SHEETS.PAYMENTS}!A:J`,
  });

  const rows = response.data.values;
  if (!rows || rows.length <= 1) return [];

  const headers = rows[0] as string[];
  const payments: Payment[] = [];

  for (let i = 1; i < rows.length; i++) {
    const payment = rowToObject<Payment>(headers, rows[i]);
    payment.amount = convertToNumber(payment.amount);
    payments.push(payment);
  }

  return payments;
}

export async function getPaymentsByOrderId(orderId: string): Promise<Payment[]> {
  const payments = await getAllPayments();
  return payments.filter(p => p.order_id === orderId);
}

export async function getAllMilestones(): Promise<Milestone[]> {
  const sheets = await getSheets();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `${SHEETS.MILESTONES}!A:G`,
  });

  const rows = response.data.values;
  if (!rows || rows.length <= 1) return [];

  const headers = rows[0] as string[];
  const milestones: Milestone[] = [];

  for (let i = 1; i < rows.length; i++) {
    const milestone = rowToObject<Milestone>(headers, rows[i]);
    milestones.push(milestone);
  }

  return milestones;
}

export async function getMilestonesByOrderId(orderId: string): Promise<Milestone[]> {
  const milestones = await getAllMilestones();
  return milestones.filter(m => m.order_id === orderId && !m.product_id);
}

export async function getMilestonesByProductId(productId: string): Promise<Milestone[]> {
  const milestones = await getAllMilestones();
  return milestones.filter(m => m.product_id === productId);
}

export async function getAllSuppliers(): Promise<Supplier[]> {
  const sheets = await getSheets();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `${SHEETS.SUPPLIERS}!A:B`,
  });

  const rows = response.data.values;
  if (!rows || rows.length <= 1) return [];

  const headers = rows[0] as string[];
  const suppliers: Supplier[] = [];

  for (let i = 1; i < rows.length; i++) {
    const supplier = rowToObject<Supplier>(headers, rows[i]);
    suppliers.push(supplier);
  }

  return suppliers;
}

// Write functions
async function findRowByValue(sheetName: string, column: string, value: string): Promise<number> {
  const sheets = await getSheets();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `${sheetName}!A:Z`,
  });

  const rows = response.data.values;
  if (!rows || rows.length <= 1) return -1;

  const headers = rows[0] as string[];
  const colIndex = headers.indexOf(column);
  if (colIndex === -1) return -1;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][colIndex] === value) {
      return i + 1; // 1-indexed for Sheets
    }
  }

  return -1;
}

export async function createOrder(data: Partial<Order>): Promise<string> {
  const sheets = await getSheets();

  // Get last row to generate ID
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `${SHEETS.ORDERS}!A:A`,
  });

  const rows = response.data.values || [];
  const year = new Date().getFullYear();
  const orderId = `PO-${year}-${String(rows.length).padStart(3, '0')}`;

  await sheets.spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range: `${SHEETS.ORDERS}!A:I`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        orderId,
        data.order_name || '',
        data.supplier || '',
        data.usd_rate || 3.76,
        data.cny_rate || 0.52,
        new Date().toISOString(),
        data.status || 'חדש',
        data.notes || '',
        data.estimated_arrival || '',
      ]],
    },
  });

  return orderId;
}

export async function updateOrder(orderId: string, updates: Partial<Order>): Promise<boolean> {
  const sheets = await getSheets();

  const rowNum = await findRowByValue(SHEETS.ORDERS, 'order_id', orderId);
  if (rowNum === -1) return false;

  // Get headers
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `${SHEETS.ORDERS}!1:1`,
  });

  const headers = headerResponse.data.values?.[0] as string[];

  for (const [key, value] of Object.entries(updates)) {
    const colIndex = headers.indexOf(key);
    if (colIndex !== -1) {
      const colLetter = String.fromCharCode(65 + colIndex);
      await sheets.spreadsheets.values.update({
        spreadsheetId: getSpreadsheetId(),
        range: `${SHEETS.ORDERS}!${colLetter}${rowNum}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[value]],
        },
      });
    }
  }

  return true;
}

export async function deleteOrder(orderId: string): Promise<boolean> {
  const sheets = await getSheets();

  const rowNum = await findRowByValue(SHEETS.ORDERS, 'order_id', orderId);
  if (rowNum === -1) return false;

  // Get sheet ID
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: getSpreadsheetId(),
  });

  const ordersSheet = spreadsheet.data.sheets?.find(s => s.properties?.title === SHEETS.ORDERS);
  if (!ordersSheet?.properties?.sheetId) return false;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: getSpreadsheetId(),
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: ordersSheet.properties.sheetId,
            dimension: 'ROWS',
            startIndex: rowNum - 1,
            endIndex: rowNum,
          },
        },
      }],
    },
  });

  return true;
}

export async function addProduct(orderId: string, data: Partial<Product>): Promise<string> {
  const sheets = await getSheets();

  const id = `PROD-${Date.now()}`;

  await sheets.spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range: `${SHEETS.PRODUCTS}!A:N`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        id,
        orderId,
        data.name || '',
        data.supplier || '',
        data.quantity || 0,
        data.price_per_unit || 0,
        data.price_total || 0,
        data.currency || 'USD',
        data.cbm_per_unit || 0,
        data.cbm_total || 0,
        data.kg_per_unit || 0,
        data.kg_total || 0,
        data.order_date || '',
        data.notes || '',
      ]],
    },
  });

  return id;
}

export async function updateProduct(productId: string, updates: Partial<Product>): Promise<boolean> {
  const sheets = await getSheets();

  const rowNum = await findRowByValue(SHEETS.PRODUCTS, 'id', productId);
  if (rowNum === -1) return false;

  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `${SHEETS.PRODUCTS}!1:1`,
  });

  const headers = headerResponse.data.values?.[0] as string[];

  for (const [key, value] of Object.entries(updates)) {
    const colIndex = headers.indexOf(key);
    if (colIndex !== -1) {
      const colLetter = String.fromCharCode(65 + colIndex);
      await sheets.spreadsheets.values.update({
        spreadsheetId: getSpreadsheetId(),
        range: `${SHEETS.PRODUCTS}!${colLetter}${rowNum}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[value]],
        },
      });
    }
  }

  return true;
}

export async function deleteProduct(productId: string): Promise<boolean> {
  const sheets = await getSheets();

  const rowNum = await findRowByValue(SHEETS.PRODUCTS, 'id', productId);
  if (rowNum === -1) return false;

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: getSpreadsheetId(),
  });

  const productsSheet = spreadsheet.data.sheets?.find(s => s.properties?.title === SHEETS.PRODUCTS);
  if (!productsSheet?.properties?.sheetId) return false;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: getSpreadsheetId(),
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: productsSheet.properties.sheetId,
            dimension: 'ROWS',
            startIndex: rowNum - 1,
            endIndex: rowNum,
          },
        },
      }],
    },
  });

  return true;
}

export async function addCost(orderId: string, data: Partial<AdditionalCost>): Promise<string> {
  const sheets = await getSheets();

  const id = `COST-${Date.now()}`;

  await sheets.spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range: `${SHEETS.ADDITIONAL_COSTS}!A:G`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        id,
        orderId,
        data.description || '',
        data.amount || 0,
        data.currency || 'USD',
        data.allocation_method || 'שווה',
        data.notes || '',
      ]],
    },
  });

  return id;
}

export async function updateCost(costId: string, updates: Partial<AdditionalCost>): Promise<boolean> {
  const sheets = await getSheets();

  const rowNum = await findRowByValue(SHEETS.ADDITIONAL_COSTS, 'id', costId);
  if (rowNum === -1) return false;

  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `${SHEETS.ADDITIONAL_COSTS}!1:1`,
  });

  const headers = headerResponse.data.values?.[0] as string[];

  for (const [key, value] of Object.entries(updates)) {
    const colIndex = headers.indexOf(key);
    if (colIndex !== -1) {
      const colLetter = String.fromCharCode(65 + colIndex);
      await sheets.spreadsheets.values.update({
        spreadsheetId: getSpreadsheetId(),
        range: `${SHEETS.ADDITIONAL_COSTS}!${colLetter}${rowNum}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[value]],
        },
      });
    }
  }

  return true;
}

export async function deleteCost(costId: string): Promise<boolean> {
  const sheets = await getSheets();

  const rowNum = await findRowByValue(SHEETS.ADDITIONAL_COSTS, 'id', costId);
  if (rowNum === -1) return false;

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: getSpreadsheetId(),
  });

  const costsSheet = spreadsheet.data.sheets?.find(s => s.properties?.title === SHEETS.ADDITIONAL_COSTS);
  if (!costsSheet?.properties?.sheetId) return false;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: getSpreadsheetId(),
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: costsSheet.properties.sheetId,
            dimension: 'ROWS',
            startIndex: rowNum - 1,
            endIndex: rowNum,
          },
        },
      }],
    },
  });

  return true;
}

export async function addPayment(orderId: string, data: Partial<Payment>): Promise<string> {
  const sheets = await getSheets();

  const id = `PAY-${Date.now()}`;

  await sheets.spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range: `${SHEETS.PAYMENTS}!A:J`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        id,
        orderId,
        data.product_id || '',
        data.cost_id || '',
        data.date || '',
        data.amount || 0,
        data.currency || 'USD',
        data.payee || '',
        data.description || '',
        data.reference || '',
      ]],
    },
  });

  return id;
}

export async function updatePayment(paymentId: string, updates: Partial<Payment>): Promise<boolean> {
  const sheets = await getSheets();

  const rowNum = await findRowByValue(SHEETS.PAYMENTS, 'id', paymentId);
  if (rowNum === -1) return false;

  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `${SHEETS.PAYMENTS}!1:1`,
  });

  const headers = headerResponse.data.values?.[0] as string[];

  for (const [key, value] of Object.entries(updates)) {
    const colIndex = headers.indexOf(key);
    if (colIndex !== -1) {
      const colLetter = String.fromCharCode(65 + colIndex);
      await sheets.spreadsheets.values.update({
        spreadsheetId: getSpreadsheetId(),
        range: `${SHEETS.PAYMENTS}!${colLetter}${rowNum}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[value]],
        },
      });
    }
  }

  return true;
}

export async function deletePayment(paymentId: string): Promise<boolean> {
  const sheets = await getSheets();

  const rowNum = await findRowByValue(SHEETS.PAYMENTS, 'id', paymentId);
  if (rowNum === -1) return false;

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: getSpreadsheetId(),
  });

  const paymentsSheet = spreadsheet.data.sheets?.find(s => s.properties?.title === SHEETS.PAYMENTS);
  if (!paymentsSheet?.properties?.sheetId) return false;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: getSpreadsheetId(),
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: paymentsSheet.properties.sheetId,
            dimension: 'ROWS',
            startIndex: rowNum - 1,
            endIndex: rowNum,
          },
        },
      }],
    },
  });

  return true;
}

export async function addMilestone(data: Partial<Milestone>): Promise<string> {
  const sheets = await getSheets();

  const id = `MS-${Date.now()}`;

  await sheets.spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range: `${SHEETS.MILESTONES}!A:G`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        id,
        data.order_id || '',
        data.product_id || '',
        data.description || '',
        data.target_date || '',
        data.actual_date || '',
        data.notes || '',
      ]],
    },
  });

  return id;
}

export async function updateMilestone(milestoneId: string, updates: Partial<Milestone>): Promise<boolean> {
  const sheets = await getSheets();

  const rowNum = await findRowByValue(SHEETS.MILESTONES, 'id', milestoneId);
  if (rowNum === -1) return false;

  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `${SHEETS.MILESTONES}!1:1`,
  });

  const headers = headerResponse.data.values?.[0] as string[];

  for (const [key, value] of Object.entries(updates)) {
    const colIndex = headers.indexOf(key);
    if (colIndex !== -1) {
      const colLetter = String.fromCharCode(65 + colIndex);
      await sheets.spreadsheets.values.update({
        spreadsheetId: getSpreadsheetId(),
        range: `${SHEETS.MILESTONES}!${colLetter}${rowNum}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[value]],
        },
      });
    }
  }

  return true;
}

export async function deleteMilestone(milestoneId: string): Promise<boolean> {
  const sheets = await getSheets();

  const rowNum = await findRowByValue(SHEETS.MILESTONES, 'id', milestoneId);
  if (rowNum === -1) return false;

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: getSpreadsheetId(),
  });

  const milestonesSheet = spreadsheet.data.sheets?.find(s => s.properties?.title === SHEETS.MILESTONES);
  if (!milestonesSheet?.properties?.sheetId) return false;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: getSpreadsheetId(),
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: milestonesSheet.properties.sheetId,
            dimension: 'ROWS',
            startIndex: rowNum - 1,
            endIndex: rowNum,
          },
        },
      }],
    },
  });

  return true;
}

export async function updateCostProductLinks(costId: string, linkedProductIds: string[]): Promise<boolean> {
  const sheets = await getSheets();

  // Get existing links
  const links = await getAllCostProductLinks();
  const existingLinks = links.filter(l => l.cost_id === costId);

  // Get sheet ID
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: getSpreadsheetId(),
  });

  const linksSheet = spreadsheet.data.sheets?.find(s => s.properties?.title === SHEETS.COST_PRODUCT_LINKS);

  // Delete existing links for this cost
  for (const link of existingLinks) {
    const rowNum = await findRowByValue(SHEETS.COST_PRODUCT_LINKS, 'id', link.id);
    if (rowNum !== -1 && linksSheet?.properties?.sheetId) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: getSpreadsheetId(),
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: linksSheet.properties.sheetId,
                dimension: 'ROWS',
                startIndex: rowNum - 1,
                endIndex: rowNum,
              },
            },
          }],
        },
      });
    }
  }

  // Add new links
  for (const productId of linkedProductIds) {
    const id = `LINK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    await sheets.spreadsheets.values.append({
      spreadsheetId: getSpreadsheetId(),
      range: `${SHEETS.COST_PRODUCT_LINKS}!A:D`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          id,
          costId,
          productId,
          true,
        ]],
      },
    });
  }

  return true;
}

// Get full order data with all related entities
export async function getOrderFull(orderId: string) {
  const [order, products, costs, payments, links, orderMilestones] = await Promise.all([
    getOrderById(orderId),
    getProductsByOrderId(orderId),
    getCostsByOrderId(orderId),
    getPaymentsByOrderId(orderId),
    getAllCostProductLinks(),
    getMilestonesByOrderId(orderId),
  ]);

  if (!order) {
    throw new Error('Order not found');
  }

  // Get milestones for all products
  const productIds = products.map(p => p.id);
  const allMilestones = await getAllMilestones();
  const productMilestones = allMilestones.filter(m => productIds.includes(m.product_id));

  // Calculate product costs with allocation
  const costLinks = links.filter(l => costs.some(c => c.id === l.cost_id));

  // Calculate costs in ILS
  for (const cost of costs) {
    cost.amountILS = toILS(cost.amount, cost.currency, order.usd_rate, order.cny_rate);
    cost.linkedProductCount = costLinks.filter(l => l.cost_id === cost.id && l.is_linked).length;
  }

  // Calculate product costs
  for (const product of products) {
    product.priceILS = toILS(product.price_total, product.currency, order.usd_rate, order.cny_rate);

    // Calculate allocated costs
    let allocatedCosts = 0;
    for (const cost of costs) {
      const linkedProductIds = costLinks
        .filter(l => l.cost_id === cost.id && l.is_linked)
        .map(l => l.product_id);

      if (linkedProductIds.length === 0 || linkedProductIds.includes(product.id)) {
        const linkedProducts = products.filter(p =>
          linkedProductIds.length === 0 || linkedProductIds.includes(p.id)
        );

        if (linkedProducts.length > 0) {
          const costILS = cost.amountILS || 0;
          let share = 0;

          switch (cost.allocation_method) {
            case 'נפח': {
              const totalCBM = linkedProducts.reduce((sum, p) => sum + p.cbm_total, 0);
              share = totalCBM > 0 ? (product.cbm_total / totalCBM) * costILS : 0;
              break;
            }
            case 'משקל': {
              const totalKG = linkedProducts.reduce((sum, p) => sum + p.kg_total, 0);
              share = totalKG > 0 ? (product.kg_total / totalKG) * costILS : 0;
              break;
            }
            case 'עלות': {
              const totalCost = linkedProducts.reduce((sum, p) =>
                sum + toILS(p.price_total, p.currency, order.usd_rate, order.cny_rate), 0
              );
              const productCost = toILS(product.price_total, product.currency, order.usd_rate, order.cny_rate);
              share = totalCost > 0 ? (productCost / totalCost) * costILS : 0;
              break;
            }
            case 'כמות': {
              const totalQty = linkedProducts.reduce((sum, p) => sum + p.quantity, 0);
              share = totalQty > 0 ? (product.quantity / totalQty) * costILS : 0;
              break;
            }
            case 'שווה':
            default:
              share = costILS / linkedProducts.length;
              break;
          }

          allocatedCosts += share;
        }
      }
    }

    product.additionalCostsILS = allocatedCosts;
    product.finalCostILS = (product.priceILS || 0) + allocatedCosts;
    product.finalCostPerUnitILS = product.quantity > 0
      ? product.finalCostILS / product.quantity
      : 0;
  }

  // Calculate payments in ILS
  for (const payment of payments) {
    payment.amountILS = toILS(payment.amount, payment.currency, order.usd_rate, order.cny_rate);
  }

  // Calculate summary
  const totalProductsILS = products.reduce((sum, p) => sum + (p.priceILS || 0), 0);
  const totalCostsILS = costs.reduce((sum, c) => sum + (c.amountILS || 0), 0);
  const totalOrderILS = totalProductsILS + totalCostsILS;
  const totalPaidILS = payments.reduce((sum, p) => sum + (p.amountILS || 0), 0);
  const totalCBM = products.reduce((sum, p) => sum + p.cbm_total, 0);
  const totalKG = products.reduce((sum, p) => sum + p.kg_total, 0);

  return {
    order,
    products,
    costs,
    payments,
    links: costLinks,
    orderMilestones,
    productMilestones,
    summary: {
      productCount: products.length,
      totalProductsILS,
      totalCostsILS,
      totalOrderILS,
      totalPaidILS,
      balanceILS: totalOrderILS - totalPaidILS,
      totalCBM,
      totalKG,
    },
  };
}
