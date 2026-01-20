import { Doc } from "./_generated/dataModel";

export type AllocationMethod = "שווה" | "נפח" | "משקל" | "עלות" | "כמות";

export function toILS(
  amount: number,
  currency: string,
  usdRate: number,
  cnyRate: number
): number {
  switch (currency) {
    case "USD":
      return amount * usdRate;
    case "CNY":
      return amount * cnyRate;
    case "ILS":
      return amount;
    default:
      // For other currencies, assume USD rate as fallback
      return amount * usdRate;
  }
}

export interface ProductWithCosts extends Doc<"products"> {
  priceILS: number;
  additionalCostsILS: number;
  finalCostILS: number;
  finalCostPerUnitILS: number;
}

export interface CostWithILS extends Doc<"additionalCosts"> {
  amountILS: number;
  linkedProductCount: number;
}

export interface PaymentWithILS extends Doc<"payments"> {
  amountILS: number;
  status: "pending" | "approved";
}

export interface OrderSummary {
  productCount: number;
  totalProductsILS: number;
  totalCostsILS: number;
  totalOrderILS: number;
  totalPaidILS: number;
  balanceILS: number;
  totalCBM: number;
  totalKG: number;
}

export function calculateProductCosts(
  products: Doc<"products">[],
  costs: Doc<"additionalCosts">[],
  links: Doc<"costProductLinks">[],
  usdRate: number,
  cnyRate: number
): ProductWithCosts[] {
  return products.map((product) => {
    const priceILS = toILS(
      product.priceTotal,
      product.currency,
      usdRate,
      cnyRate
    );

    let allocatedCosts = 0;

    for (const cost of costs) {
      const costILS = toILS(cost.amount, cost.currency, usdRate, cnyRate);

      const linkedProductIds = links
        .filter((l) => l.costId === cost.costId && l.isLinked)
        .map((l) => l.productId);

      // If no specific links, cost applies to all products
      const isLinkedToThisProduct =
        linkedProductIds.length === 0 ||
        linkedProductIds.includes(product.productId);

      if (!isLinkedToThisProduct) continue;

      // Get products this cost applies to
      const linkedProducts = products.filter(
        (p) =>
          linkedProductIds.length === 0 ||
          linkedProductIds.includes(p.productId)
      );

      if (linkedProducts.length === 0) continue;

      let share = 0;

      switch (cost.allocationMethod) {
        case "נפח": {
          const totalCBM = linkedProducts.reduce(
            (sum, p) => sum + p.cbmTotal,
            0
          );
          share =
            totalCBM > 0 ? (product.cbmTotal / totalCBM) * costILS : 0;
          break;
        }
        case "משקל": {
          const totalKG = linkedProducts.reduce(
            (sum, p) => sum + p.kgTotal,
            0
          );
          share = totalKG > 0 ? (product.kgTotal / totalKG) * costILS : 0;
          break;
        }
        case "עלות": {
          const totalCost = linkedProducts.reduce(
            (sum, p) => sum + toILS(p.priceTotal, p.currency, usdRate, cnyRate),
            0
          );
          share = totalCost > 0 ? (priceILS / totalCost) * costILS : 0;
          break;
        }
        case "כמות": {
          const totalQty = linkedProducts.reduce(
            (sum, p) => sum + p.quantity,
            0
          );
          share =
            totalQty > 0 ? (product.quantity / totalQty) * costILS : 0;
          break;
        }
        case "שווה":
        default:
          share = costILS / linkedProducts.length;
          break;
      }

      allocatedCosts += share;
    }

    const finalCostILS = priceILS + allocatedCosts;
    const finalCostPerUnitILS =
      product.quantity > 0 ? finalCostILS / product.quantity : 0;

    return {
      ...product,
      priceILS,
      additionalCostsILS: allocatedCosts,
      finalCostILS,
      finalCostPerUnitILS,
    };
  });
}

export function calculateOrderSummary(
  productsWithCosts: ProductWithCosts[],
  costsWithILS: CostWithILS[],
  paymentsWithILS: PaymentWithILS[]
): OrderSummary {
  const totalProductsILS = productsWithCosts.reduce(
    (sum, p) => sum + p.priceILS,
    0
  );
  const totalCostsILS = costsWithILS.reduce((sum, c) => sum + c.amountILS, 0);
  const totalOrderILS = totalProductsILS + totalCostsILS;
  // Only count approved payments toward total paid
  const approvedPayments = paymentsWithILS.filter(p => p.status === "approved");
  const totalPaidILS = approvedPayments.reduce((sum, p) => sum + p.amountILS, 0);
  const totalCBM = productsWithCosts.reduce((sum, p) => sum + p.cbmTotal, 0);
  const totalKG = productsWithCosts.reduce((sum, p) => sum + p.kgTotal, 0);

  return {
    productCount: productsWithCosts.length,
    totalProductsILS,
    totalCostsILS,
    totalOrderILS,
    totalPaidILS,
    balanceILS: totalOrderILS - totalPaidILS,
    totalCBM,
    totalKG,
  };
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
