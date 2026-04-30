import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { generateId } from "./helpers";

const filtersValidator = v.object({
  stages: v.optional(v.array(v.number())),
  hasImage: v.optional(v.boolean()),
});

export const getViewsByKit = query({
  args: { kitId: v.string() },
  handler: async (ctx, { kitId }) => {
    const views = await ctx.db
      .query("kitSampleViews")
      .withIndex("by_kitId", (q) => q.eq("kitId", kitId))
      .collect();
    return views.sort((a, b) => a.order - b.order);
  },
});

export const createView = mutation({
  args: {
    kitId: v.string(),
    name: v.string(),
    filters: filtersValidator,
  },
  handler: async (ctx, { kitId, name, filters }) => {
    const existing = await ctx.db
      .query("kitSampleViews")
      .withIndex("by_kitId", (q) => q.eq("kitId", kitId))
      .collect();
    const maxOrder = existing.reduce((m, v) => Math.max(m, v.order), -1);

    const viewId = generateId("VIEW");
    await ctx.db.insert("kitSampleViews", {
      viewId,
      kitId,
      name,
      order: maxOrder + 1,
      filters,
      createdDate: new Date().toISOString().split("T")[0],
    });
    return viewId;
  },
});

export const updateView = mutation({
  args: {
    viewId: v.string(),
    name: v.optional(v.string()),
    filters: v.optional(filtersValidator),
    order: v.optional(v.number()),
  },
  handler: async (ctx, { viewId, name, filters, order }) => {
    const view = await ctx.db
      .query("kitSampleViews")
      .withIndex("by_viewId", (q) => q.eq("viewId", viewId))
      .first();
    if (!view) return false;

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (filters !== undefined) updates.filters = filters;
    if (order !== undefined) updates.order = order;

    await ctx.db.patch(view._id, updates);
    return true;
  },
});

export const deleteView = mutation({
  args: { viewId: v.string() },
  handler: async (ctx, { viewId }) => {
    const view = await ctx.db
      .query("kitSampleViews")
      .withIndex("by_viewId", (q) => q.eq("viewId", viewId))
      .first();
    if (!view) return false;
    await ctx.db.delete(view._id);
    return true;
  },
});
