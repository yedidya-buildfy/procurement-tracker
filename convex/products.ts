import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { generateId } from "./helpers";

export const getProductsByOrderId = query({
  args: { orderId: v.string() },
  handler: async (ctx, { orderId }) => {
    return await ctx.db
      .query("products")
      .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
      .collect();
  },
});

export const getProductById = query({
  args: { productId: v.string() },
  handler: async (ctx, { productId }) => {
    return await ctx.db
      .query("products")
      .withIndex("by_productId", (q) => q.eq("productId", productId))
      .first();
  },
});

export const addProduct = mutation({
  args: {
    orderId: v.string(),
    name: v.string(),
    supplier: v.optional(v.string()),
    quantity: v.number(),
    pricePerUnit: v.number(),
    priceTotal: v.number(),
    currency: v.string(),
    cbmPerUnit: v.number(),
    cbmTotal: v.number(),
    kgPerUnit: v.number(),
    kgTotal: v.number(),
    orderDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const productId = generateId("PROD");

    await ctx.db.insert("products", {
      productId,
      orderId: args.orderId,
      name: args.name,
      supplier: args.supplier,
      quantity: args.quantity,
      pricePerUnit: args.pricePerUnit,
      priceTotal: args.priceTotal,
      currency: args.currency,
      cbmPerUnit: args.cbmPerUnit,
      cbmTotal: args.cbmTotal,
      kgPerUnit: args.kgPerUnit,
      kgTotal: args.kgTotal,
      orderDate: args.orderDate,
      notes: args.notes,
    });

    // Auto-create pending payment for this product
    const paymentCurrency = ["USD", "CNY", "ILS"].includes(args.currency)
      ? (args.currency as "USD" | "CNY" | "ILS")
      : "USD";

    const paymentId = generateId("PAY");
    await ctx.db.insert("payments", {
      paymentId,
      orderId: args.orderId,
      date: args.orderDate || new Date().toISOString().split("T")[0],
      amount: args.priceTotal,
      currency: paymentCurrency,
      payee: args.supplier || "",
      description: `תשלום עבור ${args.name}`,
      status: "pending",
    });

    // Link the payment to the product
    await ctx.db.insert("paymentProductLinks", { paymentId, productId });

    return productId;
  },
});

export const updateProduct = mutation({
  args: {
    productId: v.string(),
    name: v.optional(v.string()),
    supplier: v.optional(v.string()),
    quantity: v.optional(v.number()),
    pricePerUnit: v.optional(v.number()),
    priceTotal: v.optional(v.number()),
    currency: v.optional(v.string()),
    cbmPerUnit: v.optional(v.number()),
    cbmTotal: v.optional(v.number()),
    kgPerUnit: v.optional(v.number()),
    kgTotal: v.optional(v.number()),
    orderDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_productId", (q) => q.eq("productId", args.productId))
      .first();

    if (!product) return false;

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.supplier !== undefined) updates.supplier = args.supplier;
    if (args.quantity !== undefined) updates.quantity = args.quantity;
    if (args.pricePerUnit !== undefined) updates.pricePerUnit = args.pricePerUnit;
    if (args.priceTotal !== undefined) updates.priceTotal = args.priceTotal;
    if (args.currency !== undefined) updates.currency = args.currency;
    if (args.cbmPerUnit !== undefined) updates.cbmPerUnit = args.cbmPerUnit;
    if (args.cbmTotal !== undefined) updates.cbmTotal = args.cbmTotal;
    if (args.kgPerUnit !== undefined) updates.kgPerUnit = args.kgPerUnit;
    if (args.kgTotal !== undefined) updates.kgTotal = args.kgTotal;
    if (args.orderDate !== undefined) updates.orderDate = args.orderDate;
    if (args.notes !== undefined) updates.notes = args.notes;

    await ctx.db.patch(product._id, updates);
    return true;
  },
});

export const getAllSuppliers = query({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db.query("products").collect();
    const suppliers = products
      .map((p) => p.supplier)
      .filter((s): s is string => !!s && s.trim() !== '');
    return [...new Set(suppliers)];
  },
});

export const deleteProduct = mutation({
  args: { productId: v.string() },
  handler: async (ctx, { productId }) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_productId", (q) => q.eq("productId", productId))
      .first();

    if (!product) return false;

    // Delete related cost-product links
    const costLinks = await ctx.db
      .query("costProductLinks")
      .withIndex("by_productId", (q) => q.eq("productId", productId))
      .collect();

    for (const link of costLinks) {
      await ctx.db.delete(link._id);
    }

    // Delete related product milestones
    const milestones = await ctx.db
      .query("productMilestones")
      .withIndex("by_productId", (q) => q.eq("productId", productId))
      .collect();

    for (const milestone of milestones) {
      await ctx.db.delete(milestone._id);
    }

    // Delete related payment-product links and pending payments
    const paymentLinks = await ctx.db
      .query("paymentProductLinks")
      .withIndex("by_productId", (q) => q.eq("productId", productId))
      .collect();

    for (const link of paymentLinks) {
      // Check if the linked payment is pending - if so, delete it
      const payment = await ctx.db
        .query("payments")
        .withIndex("by_paymentId", (q) => q.eq("paymentId", link.paymentId))
        .first();

      if (payment && payment.status === "pending") {
        // Delete all links for this payment first
        const allProductLinks = await ctx.db
          .query("paymentProductLinks")
          .withIndex("by_paymentId", (q) => q.eq("paymentId", link.paymentId))
          .collect();
        for (const pLink of allProductLinks) {
          await ctx.db.delete(pLink._id);
        }

        const allCostLinks = await ctx.db
          .query("paymentCostLinks")
          .withIndex("by_paymentId", (q) => q.eq("paymentId", link.paymentId))
          .collect();
        for (const cLink of allCostLinks) {
          await ctx.db.delete(cLink._id);
        }

        // Delete the pending payment
        await ctx.db.delete(payment._id);
      } else {
        // Just delete the link, keep the approved payment
        await ctx.db.delete(link._id);
      }
    }

    // Delete the product
    await ctx.db.delete(product._id);

    return true;
  },
});
