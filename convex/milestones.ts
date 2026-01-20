import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { generateId } from "./helpers";

// Milestone Types
export const getMilestoneTypes = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("milestoneTypes").collect();
  },
});

export const getMilestoneTypesByLevel = query({
  args: { level: v.union(v.literal("product"), v.literal("order")) },
  handler: async (ctx, { level }) => {
    return await ctx.db
      .query("milestoneTypes")
      .withIndex("by_level", (q) => q.eq("level", level))
      .collect();
  },
});

export const addMilestoneType = mutation({
  args: {
    name: v.string(),
    level: v.union(v.literal("product"), v.literal("order")),
    defaultOrder: v.number(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const typeId = generateId("ms_type");

    await ctx.db.insert("milestoneTypes", {
      typeId,
      name: args.name,
      level: args.level,
      defaultOrder: args.defaultOrder,
      color: args.color,
    });

    return typeId;
  },
});

export const seedMilestoneType = mutation({
  args: {
    typeId: v.string(),
    name: v.string(),
    level: v.union(v.literal("product"), v.literal("order")),
    defaultOrder: v.number(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if type already exists
    const existing = await ctx.db
      .query("milestoneTypes")
      .withIndex("by_typeId", (q) => q.eq("typeId", args.typeId))
      .first();

    if (existing) return args.typeId;

    await ctx.db.insert("milestoneTypes", {
      typeId: args.typeId,
      name: args.name,
      level: args.level,
      defaultOrder: args.defaultOrder,
      color: args.color,
    });

    return args.typeId;
  },
});

export const updateMilestoneType = mutation({
  args: {
    typeId: v.string(),
    name: v.optional(v.string()),
    defaultOrder: v.optional(v.number()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const milestoneType = await ctx.db
      .query("milestoneTypes")
      .withIndex("by_typeId", (q) => q.eq("typeId", args.typeId))
      .first();

    if (!milestoneType) return false;

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.defaultOrder !== undefined) updates.defaultOrder = args.defaultOrder;
    if (args.color !== undefined) updates.color = args.color;

    await ctx.db.patch(milestoneType._id, updates);
    return true;
  },
});

export const deleteMilestoneType = mutation({
  args: { typeId: v.string() },
  handler: async (ctx, { typeId }) => {
    const milestoneType = await ctx.db
      .query("milestoneTypes")
      .withIndex("by_typeId", (q) => q.eq("typeId", typeId))
      .first();

    if (!milestoneType) return false;

    await ctx.db.delete(milestoneType._id);
    return true;
  },
});

// Order Milestones
export const getOrderMilestones = query({
  args: { orderId: v.string() },
  handler: async (ctx, { orderId }) => {
    return await ctx.db
      .query("orderMilestones")
      .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
      .collect();
  },
});

export const addOrderMilestone = mutation({
  args: {
    orderId: v.string(),
    milestoneTypeId: v.string(),
    targetDate: v.optional(v.string()),
    actualDate: v.optional(v.string()),
    status: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const milestoneId = generateId("OMS");

    await ctx.db.insert("orderMilestones", {
      milestoneId,
      orderId: args.orderId,
      milestoneTypeId: args.milestoneTypeId,
      targetDate: args.targetDate,
      actualDate: args.actualDate,
      status: args.status,
      notes: args.notes,
    });

    return milestoneId;
  },
});

export const updateOrderMilestone = mutation({
  args: {
    milestoneId: v.string(),
    milestoneTypeId: v.optional(v.string()),
    targetDate: v.optional(v.string()),
    actualDate: v.optional(v.string()),
    status: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const milestone = await ctx.db
      .query("orderMilestones")
      .withIndex("by_milestoneId", (q) => q.eq("milestoneId", args.milestoneId))
      .first();

    if (!milestone) return false;

    const updates: Record<string, unknown> = {};
    if (args.milestoneTypeId !== undefined) updates.milestoneTypeId = args.milestoneTypeId;
    if (args.targetDate !== undefined) updates.targetDate = args.targetDate;
    if (args.actualDate !== undefined) updates.actualDate = args.actualDate;
    if (args.status !== undefined) updates.status = args.status;
    if (args.notes !== undefined) updates.notes = args.notes;

    await ctx.db.patch(milestone._id, updates);
    return true;
  },
});

export const deleteOrderMilestone = mutation({
  args: { milestoneId: v.string() },
  handler: async (ctx, { milestoneId }) => {
    const milestone = await ctx.db
      .query("orderMilestones")
      .withIndex("by_milestoneId", (q) => q.eq("milestoneId", milestoneId))
      .first();

    if (!milestone) return false;

    await ctx.db.delete(milestone._id);
    return true;
  },
});

// Product Milestones
export const getProductMilestones = query({
  args: { productId: v.string() },
  handler: async (ctx, { productId }) => {
    return await ctx.db
      .query("productMilestones")
      .withIndex("by_productId", (q) => q.eq("productId", productId))
      .collect();
  },
});

export const addProductMilestone = mutation({
  args: {
    productId: v.string(),
    milestoneTypeId: v.string(),
    targetDate: v.optional(v.string()),
    actualDate: v.optional(v.string()),
    status: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const milestoneId = generateId("PMS");

    await ctx.db.insert("productMilestones", {
      milestoneId,
      productId: args.productId,
      milestoneTypeId: args.milestoneTypeId,
      targetDate: args.targetDate,
      actualDate: args.actualDate,
      status: args.status,
      notes: args.notes,
    });

    return milestoneId;
  },
});

export const updateProductMilestone = mutation({
  args: {
    milestoneId: v.string(),
    milestoneTypeId: v.optional(v.string()),
    targetDate: v.optional(v.string()),
    actualDate: v.optional(v.string()),
    status: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const milestone = await ctx.db
      .query("productMilestones")
      .withIndex("by_milestoneId", (q) => q.eq("milestoneId", args.milestoneId))
      .first();

    if (!milestone) return false;

    const updates: Record<string, unknown> = {};
    if (args.milestoneTypeId !== undefined) updates.milestoneTypeId = args.milestoneTypeId;
    if (args.targetDate !== undefined) updates.targetDate = args.targetDate;
    if (args.actualDate !== undefined) updates.actualDate = args.actualDate;
    if (args.status !== undefined) updates.status = args.status;
    if (args.notes !== undefined) updates.notes = args.notes;

    await ctx.db.patch(milestone._id, updates);
    return true;
  },
});

export const deleteProductMilestone = mutation({
  args: { milestoneId: v.string() },
  handler: async (ctx, { milestoneId }) => {
    const milestone = await ctx.db
      .query("productMilestones")
      .withIndex("by_milestoneId", (q) => q.eq("milestoneId", milestoneId))
      .first();

    if (!milestone) return false;

    await ctx.db.delete(milestone._id);
    return true;
  },
});

// Legacy milestone support for migration
export const addLegacyMilestone = mutation({
  args: {
    orderId: v.string(),
    productId: v.optional(v.string()),
    description: v.string(),
    targetDate: v.optional(v.string()),
    actualDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // For legacy milestones, create as order or product milestone based on productId
    if (args.productId) {
      const milestoneId = generateId("PMS");
      await ctx.db.insert("productMilestones", {
        milestoneId,
        productId: args.productId,
        milestoneTypeId: "legacy",
        targetDate: args.targetDate,
        actualDate: args.actualDate,
        status: args.description,
        notes: args.notes,
      });
      return milestoneId;
    } else {
      const milestoneId = generateId("OMS");
      await ctx.db.insert("orderMilestones", {
        milestoneId,
        orderId: args.orderId,
        milestoneTypeId: "legacy",
        targetDate: args.targetDate,
        actualDate: args.actualDate,
        status: args.description,
        notes: args.notes,
      });
      return milestoneId;
    }
  },
});
