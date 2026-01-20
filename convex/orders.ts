import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  toILS,
  calculateProductCosts,
  calculateOrderSummary,
  generateId,
  type CostWithILS,
  type PaymentWithILS,
} from "./helpers";

export const getAllOrders = query({
  args: {},
  handler: async (ctx) => {
    const orders = await ctx.db.query("orders").collect();

    const ordersWithSummary = await Promise.all(
      orders.map(async (order) => {
        const products = await ctx.db
          .query("products")
          .withIndex("by_orderId", (q) => q.eq("orderId", order.orderId))
          .collect();

        const costs = await ctx.db
          .query("additionalCosts")
          .withIndex("by_orderId", (q) => q.eq("orderId", order.orderId))
          .collect();

        const payments = await ctx.db
          .query("payments")
          .withIndex("by_orderId", (q) => q.eq("orderId", order.orderId))
          .collect();

        const totalProductsILS = products.reduce(
          (sum, p) => sum + toILS(p.priceTotal, p.currency, order.usdRate, order.cnyRate),
          0
        );

        const totalCostsILS = costs.reduce(
          (sum, c) => sum + toILS(c.amount, c.currency, order.usdRate, order.cnyRate),
          0
        );

        // Only count approved payments toward total paid
        const approvedPayments = payments.filter(p => p.status === "approved");
        const totalPaidILS = approvedPayments.reduce(
          (sum, p) => sum + toILS(p.amount, p.currency, order.usdRate, order.cnyRate),
          0
        );

        const totalOrderILS = totalProductsILS + totalCostsILS;

        return {
          ...order,
          productCount: products.length,
          totalProductsILS,
          totalCostsILS,
          totalOrderILS,
          totalPaidILS,
          balanceILS: totalOrderILS - totalPaidILS,
        };
      })
    );

    return ordersWithSummary;
  },
});

export const getOrderById = query({
  args: { orderId: v.string() },
  handler: async (ctx, { orderId }) => {
    return await ctx.db
      .query("orders")
      .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
      .first();
  },
});

export const getOrderFull = query({
  args: { orderId: v.string() },
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
      .first();

    if (!order) return null;

    const [products, costs, payments, allLinks, orderMilestones, milestoneTypes, allPaymentProductLinks, allPaymentCostLinks] =
      await Promise.all([
        ctx.db
          .query("products")
          .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
          .collect(),
        ctx.db
          .query("additionalCosts")
          .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
          .collect(),
        ctx.db
          .query("payments")
          .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
          .collect(),
        ctx.db.query("costProductLinks").collect(),
        ctx.db
          .query("orderMilestones")
          .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
          .collect(),
        ctx.db.query("milestoneTypes").collect(),
        ctx.db.query("paymentProductLinks").collect(),
        ctx.db.query("paymentCostLinks").collect(),
      ]);

    // Filter links to only those relevant to this order's costs
    const costIds = costs.map((c) => c.costId);
    const links = allLinks.filter((l) => costIds.includes(l.costId));

    // Get product milestones for all products in this order
    const productIds = products.map((p) => p.productId);

    // Filter payment links to only those relevant to this order's payments
    const paymentIds = payments.map((p) => p.paymentId);
    const paymentProductLinks = allPaymentProductLinks.filter((l) => paymentIds.includes(l.paymentId));
    const paymentCostLinks = allPaymentCostLinks.filter((l) => paymentIds.includes(l.paymentId));
    const allProductMilestones = await ctx.db.query("productMilestones").collect();
    const productMilestones = allProductMilestones.filter((m) =>
      productIds.includes(m.productId)
    );

    // Calculate costs with ILS
    const costsWithILS: CostWithILS[] = costs.map((cost) => ({
      ...cost,
      amountILS: toILS(cost.amount, cost.currency, order.usdRate, order.cnyRate),
      linkedProductCount: links.filter(
        (l) => l.costId === cost.costId && l.isLinked
      ).length,
    }));

    // Calculate payments with ILS
    const paymentsWithILS: PaymentWithILS[] = payments.map((payment) => ({
      ...payment,
      amountILS: toILS(payment.amount, payment.currency, order.usdRate, order.cnyRate),
    }));

    // Calculate product costs with allocation
    const productsWithCosts = calculateProductCosts(
      products,
      costs,
      links,
      order.usdRate,
      order.cnyRate
    );

    // Calculate order summary
    const summary = calculateOrderSummary(
      productsWithCosts,
      costsWithILS,
      paymentsWithILS
    );

    return {
      order,
      products: productsWithCosts,
      costs: costsWithILS,
      payments: paymentsWithILS,
      links,
      paymentProductLinks,
      paymentCostLinks,
      orderMilestones,
      productMilestones,
      milestoneTypes,
      summary,
    };
  },
});

export const createOrder = mutation({
  args: {
    orderName: v.string(),
    supplier: v.optional(v.string()),
    usdRate: v.number(),
    cnyRate: v.number(),
    status: v.optional(v.string()),
    notes: v.optional(v.string()),
    estimatedArrival: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const year = new Date().getFullYear();
    const existingOrders = await ctx.db.query("orders").collect();
    const orderNum = existingOrders.length + 1;
    const orderId = `PO-${year}-${String(orderNum).padStart(3, "0")}`;

    await ctx.db.insert("orders", {
      orderId,
      orderName: args.orderName,
      supplier: args.supplier,
      usdRate: args.usdRate,
      cnyRate: args.cnyRate,
      createdDate: new Date().toISOString(),
      status: args.status || "חדש",
      notes: args.notes,
      estimatedArrival: args.estimatedArrival,
    });

    return orderId;
  },
});

export const updateOrder = mutation({
  args: {
    orderId: v.string(),
    orderName: v.optional(v.string()),
    supplier: v.optional(v.string()),
    usdRate: v.optional(v.number()),
    cnyRate: v.optional(v.number()),
    status: v.optional(v.string()),
    notes: v.optional(v.string()),
    estimatedArrival: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .first();

    if (!order) return false;

    const updates: Record<string, unknown> = {};
    if (args.orderName !== undefined) updates.orderName = args.orderName;
    if (args.supplier !== undefined) updates.supplier = args.supplier;
    if (args.usdRate !== undefined) updates.usdRate = args.usdRate;
    if (args.cnyRate !== undefined) updates.cnyRate = args.cnyRate;
    if (args.status !== undefined) updates.status = args.status;
    if (args.notes !== undefined) updates.notes = args.notes;
    if (args.estimatedArrival !== undefined)
      updates.estimatedArrival = args.estimatedArrival;

    await ctx.db.patch(order._id, updates);
    return true;
  },
});

export const deleteOrder = mutation({
  args: { orderId: v.string() },
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
      .first();

    if (!order) return false;

    // Delete related products
    const products = await ctx.db
      .query("products")
      .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
      .collect();

    for (const product of products) {
      // Delete product milestones
      const productMilestones = await ctx.db
        .query("productMilestones")
        .withIndex("by_productId", (q) => q.eq("productId", product.productId))
        .collect();
      for (const milestone of productMilestones) {
        await ctx.db.delete(milestone._id);
      }

      // Delete cost-product links
      const links = await ctx.db
        .query("costProductLinks")
        .withIndex("by_productId", (q) => q.eq("productId", product.productId))
        .collect();
      for (const link of links) {
        await ctx.db.delete(link._id);
      }

      await ctx.db.delete(product._id);
    }

    // Delete related costs
    const costs = await ctx.db
      .query("additionalCosts")
      .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
      .collect();

    for (const cost of costs) {
      // Delete cost-product links
      const links = await ctx.db
        .query("costProductLinks")
        .withIndex("by_costId", (q) => q.eq("costId", cost.costId))
        .collect();
      for (const link of links) {
        await ctx.db.delete(link._id);
      }

      await ctx.db.delete(cost._id);
    }

    // Delete related payments and their links
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
      .collect();

    for (const payment of payments) {
      // Delete payment-product links
      const productLinks = await ctx.db
        .query("paymentProductLinks")
        .withIndex("by_paymentId", (q) => q.eq("paymentId", payment.paymentId))
        .collect();
      for (const link of productLinks) {
        await ctx.db.delete(link._id);
      }

      // Delete payment-cost links
      const costLinks = await ctx.db
        .query("paymentCostLinks")
        .withIndex("by_paymentId", (q) => q.eq("paymentId", payment.paymentId))
        .collect();
      for (const link of costLinks) {
        await ctx.db.delete(link._id);
      }

      await ctx.db.delete(payment._id);
    }

    // Delete order milestones
    const orderMilestones = await ctx.db
      .query("orderMilestones")
      .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
      .collect();

    for (const milestone of orderMilestones) {
      await ctx.db.delete(milestone._id);
    }

    // Delete the order itself
    await ctx.db.delete(order._id);

    return true;
  },
});
