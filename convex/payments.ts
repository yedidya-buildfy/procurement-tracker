import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { generateId } from "./helpers";

export const getPaymentsByOrderId = query({
  args: { orderId: v.string() },
  handler: async (ctx, { orderId }) => {
    return await ctx.db
      .query("payments")
      .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
      .collect();
  },
});

export const getPaymentById = query({
  args: { paymentId: v.string() },
  handler: async (ctx, { paymentId }) => {
    const payments = await ctx.db.query("payments").collect();
    return payments.find((p) => p.paymentId === paymentId) || null;
  },
});

export const getPaymentProductLinks = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("paymentProductLinks").collect();
  },
});

export const getPaymentCostLinks = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("paymentCostLinks").collect();
  },
});

export const addPayment = mutation({
  args: {
    orderId: v.string(),
    date: v.string(),
    amount: v.number(),
    currency: v.union(v.literal("USD"), v.literal("CNY"), v.literal("ILS")),
    payee: v.optional(v.string()),
    description: v.optional(v.string()),
    reference: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("approved")),
    linkedProductIds: v.optional(v.array(v.string())),
    linkedCostIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const paymentId = generateId("PAY");

    await ctx.db.insert("payments", {
      paymentId,
      orderId: args.orderId,
      date: args.date,
      amount: args.amount,
      currency: args.currency,
      payee: args.payee,
      description: args.description,
      reference: args.reference,
      status: args.status,
    });

    // Create product links
    if (args.linkedProductIds) {
      for (const productId of args.linkedProductIds) {
        await ctx.db.insert("paymentProductLinks", { paymentId, productId });
      }
    }

    // Create cost links
    if (args.linkedCostIds) {
      for (const costId of args.linkedCostIds) {
        await ctx.db.insert("paymentCostLinks", { paymentId, costId });
      }
    }

    return paymentId;
  },
});

export const updatePayment = mutation({
  args: {
    paymentId: v.string(),
    date: v.optional(v.string()),
    amount: v.optional(v.number()),
    currency: v.optional(v.union(v.literal("USD"), v.literal("CNY"), v.literal("ILS"))),
    payee: v.optional(v.string()),
    description: v.optional(v.string()),
    reference: v.optional(v.string()),
    status: v.optional(v.union(v.literal("pending"), v.literal("approved"))),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", args.paymentId))
      .first();

    if (!payment) return false;

    const updates: Record<string, unknown> = {};
    if (args.date !== undefined) updates.date = args.date;
    if (args.amount !== undefined) updates.amount = args.amount;
    if (args.currency !== undefined) updates.currency = args.currency;
    if (args.payee !== undefined) updates.payee = args.payee;
    if (args.description !== undefined) updates.description = args.description;
    if (args.reference !== undefined) updates.reference = args.reference;
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(payment._id, updates);
    return true;
  },
});

export const updatePaymentLinks = mutation({
  args: {
    paymentId: v.string(),
    linkedProductIds: v.array(v.string()),
    linkedCostIds: v.array(v.string()),
  },
  handler: async (ctx, { paymentId, linkedProductIds, linkedCostIds }) => {
    // Delete existing product links
    const existingProductLinks = await ctx.db
      .query("paymentProductLinks")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", paymentId))
      .collect();

    for (const link of existingProductLinks) {
      await ctx.db.delete(link._id);
    }

    // Delete existing cost links
    const existingCostLinks = await ctx.db
      .query("paymentCostLinks")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", paymentId))
      .collect();

    for (const link of existingCostLinks) {
      await ctx.db.delete(link._id);
    }

    // Create new product links
    for (const productId of linkedProductIds) {
      await ctx.db.insert("paymentProductLinks", { paymentId, productId });
    }

    // Create new cost links
    for (const costId of linkedCostIds) {
      await ctx.db.insert("paymentCostLinks", { paymentId, costId });
    }

    return true;
  },
});

export const approvePayment = mutation({
  args: { paymentId: v.string() },
  handler: async (ctx, { paymentId }) => {
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", paymentId))
      .first();

    if (!payment) return false;

    await ctx.db.patch(payment._id, { status: "approved" });
    return true;
  },
});

export const dismissPayment = mutation({
  args: { paymentId: v.string() },
  handler: async (ctx, { paymentId }) => {
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", paymentId))
      .first();

    if (!payment) return false;

    // Delete product links
    const productLinks = await ctx.db
      .query("paymentProductLinks")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", paymentId))
      .collect();

    for (const link of productLinks) {
      await ctx.db.delete(link._id);
    }

    // Delete cost links
    const costLinks = await ctx.db
      .query("paymentCostLinks")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", paymentId))
      .collect();

    for (const link of costLinks) {
      await ctx.db.delete(link._id);
    }

    // Delete the payment
    await ctx.db.delete(payment._id);
    return true;
  },
});

export const deletePayment = mutation({
  args: { paymentId: v.string() },
  handler: async (ctx, { paymentId }) => {
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", paymentId))
      .first();

    if (!payment) return false;

    // Delete product links
    const productLinks = await ctx.db
      .query("paymentProductLinks")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", paymentId))
      .collect();

    for (const link of productLinks) {
      await ctx.db.delete(link._id);
    }

    // Delete cost links
    const costLinks = await ctx.db
      .query("paymentCostLinks")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", paymentId))
      .collect();

    for (const link of costLinks) {
      await ctx.db.delete(link._id);
    }

    // Delete the payment
    await ctx.db.delete(payment._id);
    return true;
  },
});
