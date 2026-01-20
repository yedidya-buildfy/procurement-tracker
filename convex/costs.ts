import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { generateId } from "./helpers";

export const getCostsByOrderId = query({
  args: { orderId: v.string() },
  handler: async (ctx, { orderId }) => {
    return await ctx.db
      .query("additionalCosts")
      .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
      .collect();
  },
});

export const getCostById = query({
  args: { costId: v.string() },
  handler: async (ctx, { costId }) => {
    return await ctx.db
      .query("additionalCosts")
      .withIndex("by_costId", (q) => q.eq("costId", costId))
      .first();
  },
});

export const getCostProductLinks = query({
  args: { costId: v.string() },
  handler: async (ctx, { costId }) => {
    return await ctx.db
      .query("costProductLinks")
      .withIndex("by_costId", (q) => q.eq("costId", costId))
      .collect();
  },
});

export const getAllCostProductLinks = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("costProductLinks").collect();
  },
});

export const addCost = mutation({
  args: {
    orderId: v.string(),
    description: v.string(),
    amount: v.number(),
    currency: v.union(v.literal("USD"), v.literal("CNY"), v.literal("ILS")),
    allocationMethod: v.union(
      v.literal("שווה"),
      v.literal("נפח"),
      v.literal("משקל"),
      v.literal("עלות"),
      v.literal("כמות")
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const costId = generateId("COST");

    await ctx.db.insert("additionalCosts", {
      costId,
      orderId: args.orderId,
      description: args.description,
      amount: args.amount,
      currency: args.currency,
      allocationMethod: args.allocationMethod,
      notes: args.notes,
    });

    // Auto-create pending payment for this cost
    const paymentId = generateId("PAY");
    await ctx.db.insert("payments", {
      paymentId,
      orderId: args.orderId,
      date: new Date().toISOString().split("T")[0],
      amount: args.amount,
      currency: args.currency,
      payee: "",
      description: `תשלום עבור ${args.description}`,
      status: "pending",
    });

    // Link the payment to the cost
    await ctx.db.insert("paymentCostLinks", { paymentId, costId });

    return costId;
  },
});

export const updateCost = mutation({
  args: {
    costId: v.string(),
    description: v.optional(v.string()),
    amount: v.optional(v.number()),
    currency: v.optional(v.union(v.literal("USD"), v.literal("CNY"), v.literal("ILS"))),
    allocationMethod: v.optional(
      v.union(
        v.literal("שווה"),
        v.literal("נפח"),
        v.literal("משקל"),
        v.literal("עלות"),
        v.literal("כמות")
      )
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cost = await ctx.db
      .query("additionalCosts")
      .withIndex("by_costId", (q) => q.eq("costId", args.costId))
      .first();

    if (!cost) return false;

    const updates: Record<string, unknown> = {};
    if (args.description !== undefined) updates.description = args.description;
    if (args.amount !== undefined) updates.amount = args.amount;
    if (args.currency !== undefined) updates.currency = args.currency;
    if (args.allocationMethod !== undefined) updates.allocationMethod = args.allocationMethod;
    if (args.notes !== undefined) updates.notes = args.notes;

    await ctx.db.patch(cost._id, updates);
    return true;
  },
});

export const deleteCost = mutation({
  args: { costId: v.string() },
  handler: async (ctx, { costId }) => {
    const cost = await ctx.db
      .query("additionalCosts")
      .withIndex("by_costId", (q) => q.eq("costId", costId))
      .first();

    if (!cost) return false;

    // Delete related cost-product links
    const costProductLinks = await ctx.db
      .query("costProductLinks")
      .withIndex("by_costId", (q) => q.eq("costId", costId))
      .collect();

    for (const link of costProductLinks) {
      await ctx.db.delete(link._id);
    }

    // Delete related payment-cost links and pending payments
    const paymentLinks = await ctx.db
      .query("paymentCostLinks")
      .withIndex("by_costId", (q) => q.eq("costId", costId))
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

    // Delete the cost
    await ctx.db.delete(cost._id);

    return true;
  },
});

export const updateCostProductLinks = mutation({
  args: {
    costId: v.string(),
    linkedProductIds: v.array(v.string()),
  },
  handler: async (ctx, { costId, linkedProductIds }) => {
    // Delete existing links for this cost
    const existingLinks = await ctx.db
      .query("costProductLinks")
      .withIndex("by_costId", (q) => q.eq("costId", costId))
      .collect();

    for (const link of existingLinks) {
      await ctx.db.delete(link._id);
    }

    // Create new links
    for (const productId of linkedProductIds) {
      await ctx.db.insert("costProductLinks", {
        costId,
        productId,
        isLinked: true,
      });
    }

    return true;
  },
});
