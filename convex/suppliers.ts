import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { generateId } from "./helpers";

export const getAllSuppliers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("suppliers").collect();
  },
});

export const getSupplierById = query({
  args: { supplierId: v.string() },
  handler: async (ctx, { supplierId }) => {
    return await ctx.db
      .query("suppliers")
      .withIndex("by_supplierId", (q) => q.eq("supplierId", supplierId))
      .first();
  },
});

export const getSupplierByName = query({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    return await ctx.db
      .query("suppliers")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();
  },
});

export const addSupplier = mutation({
  args: {
    name: v.string(),
    contactName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    country: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const supplierId = generateId("SUP");

    await ctx.db.insert("suppliers", {
      supplierId,
      name: args.name,
      contactName: args.contactName,
      email: args.email,
      phone: args.phone,
      country: args.country,
      notes: args.notes,
      createdDate: new Date().toISOString(),
    });

    return supplierId;
  },
});

export const seedSupplier = mutation({
  args: {
    supplierId: v.string(),
    name: v.string(),
    contactName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    country: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if supplier already exists
    const existing = await ctx.db
      .query("suppliers")
      .withIndex("by_supplierId", (q) => q.eq("supplierId", args.supplierId))
      .first();

    if (existing) return args.supplierId;

    await ctx.db.insert("suppliers", {
      supplierId: args.supplierId,
      name: args.name,
      contactName: args.contactName,
      email: args.email,
      phone: args.phone,
      country: args.country,
      notes: args.notes,
      createdDate: args.createdDate || new Date().toISOString(),
    });

    return args.supplierId;
  },
});

export const updateSupplier = mutation({
  args: {
    supplierId: v.string(),
    name: v.optional(v.string()),
    contactName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    country: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const supplier = await ctx.db
      .query("suppliers")
      .withIndex("by_supplierId", (q) => q.eq("supplierId", args.supplierId))
      .first();

    if (!supplier) return false;

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.contactName !== undefined) updates.contactName = args.contactName;
    if (args.email !== undefined) updates.email = args.email;
    if (args.phone !== undefined) updates.phone = args.phone;
    if (args.country !== undefined) updates.country = args.country;
    if (args.notes !== undefined) updates.notes = args.notes;

    await ctx.db.patch(supplier._id, updates);
    return true;
  },
});

export const deleteSupplier = mutation({
  args: { supplierId: v.string() },
  handler: async (ctx, { supplierId }) => {
    const supplier = await ctx.db
      .query("suppliers")
      .withIndex("by_supplierId", (q) => q.eq("supplierId", supplierId))
      .first();

    if (!supplier) return false;

    await ctx.db.delete(supplier._id);
    return true;
  },
});
