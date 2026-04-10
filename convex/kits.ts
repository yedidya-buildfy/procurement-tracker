import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { generateId } from "./helpers";

// Kits
export const getAllKits = query({
  args: {},
  handler: async (ctx) => {
    const kits = await ctx.db.query("kits").collect();

    const kitsWithCounts = await Promise.all(
      kits.map(async (kit) => {
        const products = await ctx.db
          .query("kitProducts")
          .withIndex("by_kitId", (q) => q.eq("kitId", kit.kitId))
          .collect();

        let totalSamples = 0;
        let pendingSamples = 0;

        for (const product of products) {
          const samples = await ctx.db
            .query("samples")
            .withIndex("by_kitProductId", (q) => q.eq("kitProductId", product.kitProductId))
            .collect();
          totalSamples += samples.length;

          for (const sample of samples) {
            const milestones = await ctx.db
              .query("sampleMilestones")
              .withIndex("by_sampleId", (q) => q.eq("sampleId", sample.sampleId))
              .collect();
            const allCompleted = milestones.length > 0 && milestones.every((m) => !!m.actualDate);
            if (!allCompleted) {
              pendingSamples++;
            }
          }
        }

        return {
          ...kit,
          productCount: products.length,
          totalSamples,
          pendingSamples,
        };
      })
    );

    return kitsWithCounts;
  },
});

export const getKitFull = query({
  args: { kitId: v.string() },
  handler: async (ctx, { kitId }) => {
    const kit = await ctx.db
      .query("kits")
      .withIndex("by_kitId", (q) => q.eq("kitId", kitId))
      .first();

    if (!kit) return null;

    const products = await ctx.db
      .query("kitProducts")
      .withIndex("by_kitId", (q) => q.eq("kitId", kitId))
      .collect();

    const allSamples = [];
    const allSampleMilestones = [];
    const allTrackingNumbers = [];
    const allFinalProducts = [];
    const allImages: { _id: string; sampleId: string; url: string | null; caption?: string }[] = [];

    for (const product of products) {
      const samples = await ctx.db
        .query("samples")
        .withIndex("by_kitProductId", (q) => q.eq("kitProductId", product.kitProductId))
        .collect();
      allSamples.push(...samples);

      for (const sample of samples) {
        const milestones = await ctx.db
          .query("sampleMilestones")
          .withIndex("by_sampleId", (q) => q.eq("sampleId", sample.sampleId))
          .collect();
        allSampleMilestones.push(...milestones);

        const tracking = await ctx.db
          .query("sampleTrackingNumbers")
          .withIndex("by_sampleId", (q) => q.eq("sampleId", sample.sampleId))
          .collect();
        allTrackingNumbers.push(...tracking);

        const images = await ctx.db
          .query("sampleImages")
          .withIndex("by_sampleId", (q) => q.eq("sampleId", sample.sampleId))
          .collect();
        for (const img of images) {
          const url = await ctx.storage.getUrl(img.storageId);
          allImages.push({ _id: img._id as string, sampleId: img.sampleId, url, caption: img.caption });
        }
      }

      const finalProducts = await ctx.db
        .query("kitFinalProducts")
        .withIndex("by_kitProductId", (q) => q.eq("kitProductId", product.kitProductId))
        .collect();
      allFinalProducts.push(...finalProducts);
    }

    // Get final product files
    const allFinalProductFiles: { _id: string; kitFinalProductId: string; url: string | null; fileName: string; fileType: string }[] = [];
    for (const fp of allFinalProducts) {
      const files = await ctx.db
        .query("kitFinalProductFiles")
        .withIndex("by_kitFinalProductId", (q) => q.eq("kitFinalProductId", fp.kitFinalProductId))
        .collect();
      for (const f of files) {
        const url = await ctx.storage.getUrl(f.storageId);
        allFinalProductFiles.push({ _id: f._id as string, kitFinalProductId: f.kitFinalProductId, url, fileName: f.fileName, fileType: f.fileType });
      }
    }

    // Get all relevant suppliers
    const supplierIds = new Set([
      ...allSamples.map((s) => s.supplierId),
      ...allFinalProducts.map((f) => f.supplierId).filter((id): id is string => !!id),
    ]);
    const suppliers = [];
    for (const supplierId of supplierIds) {
      const supplier = await ctx.db
        .query("suppliers")
        .withIndex("by_supplierId", (q) => q.eq("supplierId", supplierId))
        .first();
      if (supplier) suppliers.push(supplier);
    }

    // Get additional costs and their files
    const costs = await ctx.db
      .query("kitAdditionalCosts")
      .withIndex("by_kitId", (q) => q.eq("kitId", kitId))
      .collect();

    const allCostFiles: { _id: string; costId: string; url: string | null; fileName: string; fileType: string }[] = [];
    for (const cost of costs) {
      const files = await ctx.db
        .query("kitCostFiles")
        .withIndex("by_costId", (q) => q.eq("costId", cost.costId))
        .collect();
      for (const f of files) {
        const url = await ctx.storage.getUrl(f.storageId);
        allCostFiles.push({ _id: f._id as string, costId: f.costId, url, fileName: f.fileName, fileType: f.fileType });
      }
    }

    return {
      kit,
      products,
      samples: allSamples,
      sampleMilestones: allSampleMilestones,
      trackingNumbers: allTrackingNumbers,
      sampleImages: allImages,
      finalProducts: allFinalProducts,
      finalProductFiles: allFinalProductFiles,
      costs,
      costFiles: allCostFiles,
      suppliers,
    };
  },
});

export const createKit = mutation({
  args: {
    name: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const kitId = generateId("KIT");

    await ctx.db.insert("kits", {
      kitId,
      name: args.name,
      status: "פעיל",
      notes: args.notes,
      createdDate: new Date().toISOString().split("T")[0],
    });

    return kitId;
  },
});

export const updateKit = mutation({
  args: {
    kitId: v.string(),
    name: v.optional(v.string()),
    status: v.optional(v.string()),
    notes: v.optional(v.string()),
    targetKitCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const kit = await ctx.db
      .query("kits")
      .withIndex("by_kitId", (q) => q.eq("kitId", args.kitId))
      .first();

    if (!kit) return false;

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.status !== undefined) updates.status = args.status;
    if (args.notes !== undefined) updates.notes = args.notes;
    if (args.targetKitCount !== undefined) updates.targetKitCount = args.targetKitCount;

    await ctx.db.patch(kit._id, updates);
    return true;
  },
});

export const deleteKit = mutation({
  args: { kitId: v.string() },
  handler: async (ctx, { kitId }) => {
    const kit = await ctx.db
      .query("kits")
      .withIndex("by_kitId", (q) => q.eq("kitId", kitId))
      .first();

    if (!kit) return false;

    // Cascade delete all related data
    const products = await ctx.db
      .query("kitProducts")
      .withIndex("by_kitId", (q) => q.eq("kitId", kitId))
      .collect();

    for (const product of products) {
      const samples = await ctx.db
        .query("samples")
        .withIndex("by_kitProductId", (q) => q.eq("kitProductId", product.kitProductId))
        .collect();

      for (const sample of samples) {
        const milestones = await ctx.db
          .query("sampleMilestones")
          .withIndex("by_sampleId", (q) => q.eq("sampleId", sample.sampleId))
          .collect();
        for (const m of milestones) await ctx.db.delete(m._id);

        const tracking = await ctx.db
          .query("sampleTrackingNumbers")
          .withIndex("by_sampleId", (q) => q.eq("sampleId", sample.sampleId))
          .collect();
        for (const t of tracking) await ctx.db.delete(t._id);

        await ctx.db.delete(sample._id);
      }

      const finalProducts = await ctx.db
        .query("kitFinalProducts")
        .withIndex("by_kitProductId", (q) => q.eq("kitProductId", product.kitProductId))
        .collect();
      for (const f of finalProducts) await ctx.db.delete(f._id);

      await ctx.db.delete(product._id);
    }

    // Delete additional costs
    const costs = await ctx.db
      .query("kitAdditionalCosts")
      .withIndex("by_kitId", (q) => q.eq("kitId", kitId))
      .collect();
    for (const cost of costs) await ctx.db.delete(cost._id);

    // Delete kit images
    const kitImages = await ctx.db
      .query("kitImages")
      .withIndex("by_kitId", (q) => q.eq("kitId", kitId))
      .collect();
    for (const img of kitImages) {
      await ctx.storage.delete(img.storageId);
      await ctx.db.delete(img._id);
    }

    await ctx.db.delete(kit._id);
    return true;
  },
});

// Kit Products
export const addKitProduct = mutation({
  args: {
    kitId: v.string(),
    name: v.string(),
    category: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const kitProductId = generateId("KP");

    await ctx.db.insert("kitProducts", {
      kitProductId,
      kitId: args.kitId,
      name: args.name,
      category: args.category,
      notes: args.notes,
    });

    return kitProductId;
  },
});

export const updateKitProduct = mutation({
  args: {
    kitProductId: v.string(),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("kitProducts")
      .withIndex("by_kitProductId", (q) => q.eq("kitProductId", args.kitProductId))
      .first();

    if (!product) return false;

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.category !== undefined) updates.category = args.category;
    if (args.notes !== undefined) updates.notes = args.notes;

    await ctx.db.patch(product._id, updates);
    return true;
  },
});

export const deleteKitProduct = mutation({
  args: { kitProductId: v.string() },
  handler: async (ctx, { kitProductId }) => {
    const product = await ctx.db
      .query("kitProducts")
      .withIndex("by_kitProductId", (q) => q.eq("kitProductId", kitProductId))
      .first();

    if (!product) return false;

    // Cascade delete samples and their data
    const samples = await ctx.db
      .query("samples")
      .withIndex("by_kitProductId", (q) => q.eq("kitProductId", kitProductId))
      .collect();

    for (const sample of samples) {
      const milestones = await ctx.db
        .query("sampleMilestones")
        .withIndex("by_sampleId", (q) => q.eq("sampleId", sample.sampleId))
        .collect();
      for (const m of milestones) await ctx.db.delete(m._id);

      const tracking = await ctx.db
        .query("sampleTrackingNumbers")
        .withIndex("by_sampleId", (q) => q.eq("sampleId", sample.sampleId))
        .collect();
      for (const t of tracking) await ctx.db.delete(t._id);

      await ctx.db.delete(sample._id);
    }

    const finalProducts = await ctx.db
      .query("kitFinalProducts")
      .withIndex("by_kitProductId", (q) => q.eq("kitProductId", kitProductId))
      .collect();
    for (const f of finalProducts) await ctx.db.delete(f._id);

    await ctx.db.delete(product._id);
    return true;
  },
});

// Samples
export const addSample = mutation({
  args: {
    kitProductId: v.string(),
    supplierId: v.string(),
    sampleCost: v.optional(v.number()),
    paid: v.boolean(),
    shippingMethod: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sampleId = generateId("SMP");

    await ctx.db.insert("samples", {
      sampleId,
      kitProductId: args.kitProductId,
      supplierId: args.supplierId,
      sampleCost: args.sampleCost,
      paid: args.paid,
      shippingMethod: args.shippingMethod,
      notes: args.notes,
      createdDate: new Date().toISOString().split("T")[0],
    });

    return sampleId;
  },
});

export const updateSample = mutation({
  args: {
    sampleId: v.string(),
    supplierId: v.optional(v.string()),
    sampleCost: v.optional(v.number()),
    paid: v.optional(v.boolean()),
    shippingMethod: v.optional(v.string()),
    rating: v.optional(v.number()),
    ratingNotes: v.optional(v.string()),
    isRelevant: v.optional(v.boolean()),
    currentStage: v.optional(v.number()),
    archived: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sample = await ctx.db
      .query("samples")
      .withIndex("by_sampleId", (q) => q.eq("sampleId", args.sampleId))
      .first();

    if (!sample) return false;

    const updates: Record<string, unknown> = {};
    if (args.supplierId !== undefined) updates.supplierId = args.supplierId;
    if (args.sampleCost !== undefined) updates.sampleCost = args.sampleCost;
    if (args.paid !== undefined) updates.paid = args.paid;
    if (args.shippingMethod !== undefined) updates.shippingMethod = args.shippingMethod;
    if (args.rating !== undefined) updates.rating = args.rating;
    if (args.ratingNotes !== undefined) updates.ratingNotes = args.ratingNotes;
    if (args.isRelevant !== undefined) updates.isRelevant = args.isRelevant;
    if (args.currentStage !== undefined) updates.currentStage = args.currentStage;
    if (args.archived !== undefined) updates.archived = args.archived;
    if (args.notes !== undefined) updates.notes = args.notes;

    await ctx.db.patch(sample._id, updates);
    return true;
  },
});

export const deleteSample = mutation({
  args: { sampleId: v.string() },
  handler: async (ctx, { sampleId }) => {
    const sample = await ctx.db
      .query("samples")
      .withIndex("by_sampleId", (q) => q.eq("sampleId", sampleId))
      .first();

    if (!sample) return false;

    const milestones = await ctx.db
      .query("sampleMilestones")
      .withIndex("by_sampleId", (q) => q.eq("sampleId", sampleId))
      .collect();
    for (const m of milestones) await ctx.db.delete(m._id);

    const tracking = await ctx.db
      .query("sampleTrackingNumbers")
      .withIndex("by_sampleId", (q) => q.eq("sampleId", sampleId))
      .collect();
    for (const t of tracking) await ctx.db.delete(t._id);

    await ctx.db.delete(sample._id);
    return true;
  },
});

// Reassign sample to a different product
export const reassignSample = mutation({
  args: {
    sampleId: v.string(),
    newKitProductId: v.string(),
  },
  handler: async (ctx, args) => {
    const sample = await ctx.db
      .query("samples")
      .withIndex("by_sampleId", (q) => q.eq("sampleId", args.sampleId))
      .first();
    if (!sample) return false;
    await ctx.db.patch(sample._id, { kitProductId: args.newKitProductId });
    return true;
  },
});

// Reassign final product to a different kit product
export const reassignFinalProduct = mutation({
  args: {
    kitFinalProductId: v.string(),
    newKitProductId: v.string(),
  },
  handler: async (ctx, args) => {
    const fp = await ctx.db
      .query("kitFinalProducts")
      .withIndex("by_kitFinalProductId", (q) => q.eq("kitFinalProductId", args.kitFinalProductId))
      .first();
    if (!fp) return false;
    await ctx.db.patch(fp._id, { kitProductId: args.newKitProductId });
    return true;
  },
});

// Move a product (with all its samples and final products) to another kit
export const moveProductToKit = mutation({
  args: {
    kitProductId: v.string(),
    newKitId: v.string(),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("kitProducts")
      .withIndex("by_kitProductId", (q) => q.eq("kitProductId", args.kitProductId))
      .first();
    if (!product) return false;
    await ctx.db.patch(product._id, { kitId: args.newKitId });
    return true;
  },
});

// Sample Milestones
export const addSampleMilestone = mutation({
  args: {
    sampleId: v.string(),
    name: v.string(),
    targetDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const milestoneId = generateId("SMS");

    await ctx.db.insert("sampleMilestones", {
      milestoneId,
      sampleId: args.sampleId,
      name: args.name,
      targetDate: args.targetDate,
      notes: args.notes,
    });

    return milestoneId;
  },
});

export const updateSampleMilestone = mutation({
  args: {
    milestoneId: v.string(),
    name: v.optional(v.string()),
    targetDate: v.optional(v.string()),
    actualDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const milestone = await ctx.db
      .query("sampleMilestones")
      .withIndex("by_milestoneId", (q) => q.eq("milestoneId", args.milestoneId))
      .first();

    if (!milestone) return false;

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.targetDate !== undefined) updates.targetDate = args.targetDate;
    if (args.actualDate !== undefined) updates.actualDate = args.actualDate;
    if (args.notes !== undefined) updates.notes = args.notes;

    await ctx.db.patch(milestone._id, updates);
    return true;
  },
});

export const deleteSampleMilestone = mutation({
  args: { milestoneId: v.string() },
  handler: async (ctx, { milestoneId }) => {
    const milestone = await ctx.db
      .query("sampleMilestones")
      .withIndex("by_milestoneId", (q) => q.eq("milestoneId", milestoneId))
      .first();

    if (!milestone) return false;
    await ctx.db.delete(milestone._id);
    return true;
  },
});

// Tracking Numbers
export const addTrackingNumber = mutation({
  args: {
    sampleId: v.string(),
    leg: v.string(),
    trackingNumber: v.string(),
    carrier: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("sampleTrackingNumbers", {
      sampleId: args.sampleId,
      leg: args.leg,
      trackingNumber: args.trackingNumber,
      carrier: args.carrier,
      notes: args.notes,
    });
  },
});

export const deleteTrackingNumber = mutation({
  args: { id: v.id("sampleTrackingNumbers") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

// Search tracking numbers
export const searchTrackingNumbers = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, { searchTerm }) => {
    const results = await ctx.db
      .query("sampleTrackingNumbers")
      .withSearchIndex("search_trackingNumber", (q) =>
        q.search("trackingNumber", searchTerm)
      )
      .collect();
    return results;
  },
});

// Get all tracking numbers with sample + product + kit info
export const getAllTrackingNumbers = query({
  args: {},
  handler: async (ctx) => {
    const allTracking = await ctx.db.query("sampleTrackingNumbers").collect();

    const results = [];
    for (const t of allTracking) {
      const sample = await ctx.db
        .query("samples")
        .withIndex("by_sampleId", (q) => q.eq("sampleId", t.sampleId))
        .first();
      if (!sample) continue;

      const product = await ctx.db
        .query("kitProducts")
        .withIndex("by_kitProductId", (q) => q.eq("kitProductId", sample.kitProductId))
        .first();

      const kit = product
        ? await ctx.db
            .query("kits")
            .withIndex("by_kitId", (q) => q.eq("kitId", product.kitId))
            .first()
        : null;

      const supplier = await ctx.db
        .query("suppliers")
        .withIndex("by_supplierId", (q) => q.eq("supplierId", sample.supplierId))
        .first();

      const images = await ctx.db
        .query("sampleImages")
        .withIndex("by_sampleId", (q) => q.eq("sampleId", sample.sampleId))
        .collect();
      const imageUrls: string[] = [];
      for (const img of images) {
        const url = await ctx.storage.getUrl(img.storageId);
        if (url) imageUrls.push(url);
      }

      results.push({
        ...t,
        sample,
        productName: product?.name || "",
        kitId: product?.kitId || "",
        kitName: kit?.name || "",
        supplierName: supplier?.name || sample.supplierId,
        imageUrls,
      });
    }

    return results;
  },
});

// Bulk update sample stage
export const bulkUpdateSampleStage = mutation({
  args: {
    sampleIds: v.array(v.string()),
    currentStage: v.number(),
  },
  handler: async (ctx, { sampleIds, currentStage }) => {
    for (const sampleId of sampleIds) {
      const sample = await ctx.db
        .query("samples")
        .withIndex("by_sampleId", (q) => q.eq("sampleId", sampleId))
        .first();
      if (sample) {
        await ctx.db.patch(sample._id, { currentStage });
      }
    }
    return true;
  },
});

// Bulk delete samples
export const bulkDeleteSamples = mutation({
  args: { sampleIds: v.array(v.string()) },
  handler: async (ctx, { sampleIds }) => {
    for (const sampleId of sampleIds) {
      const sample = await ctx.db
        .query("samples")
        .withIndex("by_sampleId", (q) => q.eq("sampleId", sampleId))
        .first();
      if (!sample) continue;

      const milestones = await ctx.db
        .query("sampleMilestones")
        .withIndex("by_sampleId", (q) => q.eq("sampleId", sampleId))
        .collect();
      for (const m of milestones) await ctx.db.delete(m._id);

      const tracking = await ctx.db
        .query("sampleTrackingNumbers")
        .withIndex("by_sampleId", (q) => q.eq("sampleId", sampleId))
        .collect();
      for (const t of tracking) await ctx.db.delete(t._id);

      const images = await ctx.db
        .query("sampleImages")
        .withIndex("by_sampleId", (q) => q.eq("sampleId", sampleId))
        .collect();
      for (const img of images) {
        await ctx.storage.delete(img.storageId);
        await ctx.db.delete(img._id);
      }

      await ctx.db.delete(sample._id);
    }
    return true;
  },
});

// Final Products
export const addKitFinalProduct = mutation({
  args: {
    kitProductId: v.string(),
    supplierId: v.optional(v.string()),
    quantity: v.optional(v.number()),
    quantityPerKit: v.optional(v.number()),
    pricePerUnit: v.optional(v.number()),
    weight: v.optional(v.number()),
    volume: v.optional(v.number()),
    dimHeight: v.optional(v.number()),
    dimWidth: v.optional(v.number()),
    dimLength: v.optional(v.number()),
    isBox: v.optional(v.boolean()),
    moq: v.optional(v.number()),
    totalCost: v.optional(v.number()),
    productionRound: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const kitFinalProductId = generateId("KFP");

    await ctx.db.insert("kitFinalProducts", {
      kitFinalProductId,
      kitProductId: args.kitProductId,
      supplierId: args.supplierId,
      quantity: args.quantity,
      quantityPerKit: args.quantityPerKit,
      pricePerUnit: args.pricePerUnit,
      weight: args.weight,
      volume: args.volume,
      dimHeight: args.dimHeight,
      dimWidth: args.dimWidth,
      dimLength: args.dimLength,
      isBox: args.isBox,
      moq: args.moq,
      totalCost: args.totalCost,
      productionRound: args.productionRound,
      notes: args.notes,
    });

    return kitFinalProductId;
  },
});

export const updateKitFinalProduct = mutation({
  args: {
    kitFinalProductId: v.string(),
    supplierId: v.optional(v.string()),
    quantity: v.optional(v.number()),
    quantityPerKit: v.optional(v.number()),
    pricePerUnit: v.optional(v.number()),
    weight: v.optional(v.number()),
    volume: v.optional(v.number()),
    dimHeight: v.optional(v.number()),
    dimWidth: v.optional(v.number()),
    dimLength: v.optional(v.number()),
    isBox: v.optional(v.boolean()),
    moq: v.optional(v.number()),
    totalCost: v.optional(v.number()),
    productionRound: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const fp = await ctx.db
      .query("kitFinalProducts")
      .withIndex("by_kitFinalProductId", (q) => q.eq("kitFinalProductId", args.kitFinalProductId))
      .first();

    if (!fp) return false;

    const updates: Record<string, unknown> = {};
    if (args.supplierId !== undefined) updates.supplierId = args.supplierId;
    if (args.quantity !== undefined) updates.quantity = args.quantity;
    if (args.quantityPerKit !== undefined) updates.quantityPerKit = args.quantityPerKit;
    if (args.pricePerUnit !== undefined) updates.pricePerUnit = args.pricePerUnit;
    if (args.weight !== undefined) updates.weight = args.weight;
    if (args.volume !== undefined) updates.volume = args.volume;
    if (args.dimHeight !== undefined) updates.dimHeight = args.dimHeight;
    if (args.dimWidth !== undefined) updates.dimWidth = args.dimWidth;
    if (args.dimLength !== undefined) updates.dimLength = args.dimLength;
    if (args.isBox !== undefined) updates.isBox = args.isBox;
    if (args.moq !== undefined) updates.moq = args.moq;
    if (args.totalCost !== undefined) updates.totalCost = args.totalCost;
    if (args.productionRound !== undefined) updates.productionRound = args.productionRound;
    if (args.notes !== undefined) updates.notes = args.notes;

    await ctx.db.patch(fp._id, updates);
    return true;
  },
});

export const deleteKitFinalProduct = mutation({
  args: { kitFinalProductId: v.string() },
  handler: async (ctx, { kitFinalProductId }) => {
    const fp = await ctx.db
      .query("kitFinalProducts")
      .withIndex("by_kitFinalProductId", (q) => q.eq("kitFinalProductId", kitFinalProductId))
      .first();

    if (!fp) return false;
    await ctx.db.delete(fp._id);
    return true;
  },
});

// Kit Additional Costs
export const addKitCost = mutation({
  args: {
    kitId: v.string(),
    description: v.string(),
    costType: v.union(v.literal("fixed"), v.literal("percentage")),
    amount: v.number(),
    linkedProductIds: v.optional(v.array(v.string())),
    leadTime: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const costId = generateId("KCOST");
    await ctx.db.insert("kitAdditionalCosts", {
      costId,
      kitId: args.kitId,
      description: args.description,
      costType: args.costType,
      amount: args.amount,
      linkedProductIds: args.linkedProductIds,
      leadTime: args.leadTime,
      notes: args.notes,
    });
    return costId;
  },
});

export const updateKitCost = mutation({
  args: {
    costId: v.string(),
    description: v.optional(v.string()),
    costType: v.optional(v.union(v.literal("fixed"), v.literal("percentage"))),
    amount: v.optional(v.number()),
    linkedProductIds: v.optional(v.array(v.string())),
    leadTime: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cost = await ctx.db
      .query("kitAdditionalCosts")
      .withIndex("by_costId", (q) => q.eq("costId", args.costId))
      .first();
    if (!cost) return false;

    const updates: Record<string, unknown> = {};
    if (args.description !== undefined) updates.description = args.description;
    if (args.costType !== undefined) updates.costType = args.costType;
    if (args.amount !== undefined) updates.amount = args.amount;
    if (args.linkedProductIds !== undefined) updates.linkedProductIds = args.linkedProductIds;
    if (args.leadTime !== undefined) updates.leadTime = args.leadTime;
    if (args.notes !== undefined) updates.notes = args.notes;

    await ctx.db.patch(cost._id, updates);
    return true;
  },
});

export const deleteKitCost = mutation({
  args: { costId: v.string() },
  handler: async (ctx, { costId }) => {
    const cost = await ctx.db
      .query("kitAdditionalCosts")
      .withIndex("by_costId", (q) => q.eq("costId", costId))
      .first();
    if (!cost) return false;
    await ctx.db.delete(cost._id);
    return true;
  },
});

// Kit Cost Files
export const addCostFile = mutation({
  args: {
    costId: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("kitCostFiles", {
      costId: args.costId,
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: args.fileType,
    });
  },
});

export const deleteCostFile = mutation({
  args: { id: v.id("kitCostFiles") },
  handler: async (ctx, { id }) => {
    const file = await ctx.db.get(id);
    if (!file) return;
    await ctx.storage.delete(file.storageId);
    await ctx.db.delete(id);
  },
});

// Kit Images
export const addKitImage = mutation({
  args: { kitId: v.string(), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await ctx.db.insert("kitImages", { kitId: args.kitId, storageId: args.storageId });
  },
});

export const deleteKitImage = mutation({
  args: { id: v.id("kitImages") },
  handler: async (ctx, { id }) => {
    const img = await ctx.db.get(id);
    if (!img) return;
    await ctx.storage.delete(img.storageId);
    await ctx.db.delete(id);
  },
});

export const getKitImages = query({
  args: { kitId: v.string() },
  handler: async (ctx, { kitId }) => {
    const images = await ctx.db
      .query("kitImages")
      .withIndex("by_kitId", (q) => q.eq("kitId", kitId))
      .collect();
    return Promise.all(images.map(async (img) => ({
      _id: img._id,
      url: await ctx.storage.getUrl(img.storageId),
    })));
  },
});

// Final Product Files
export const addFinalProductFile = mutation({
  args: {
    kitFinalProductId: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("kitFinalProductFiles", {
      kitFinalProductId: args.kitFinalProductId,
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: args.fileType,
    });
  },
});

export const deleteFinalProductFile = mutation({
  args: { id: v.id("kitFinalProductFiles") },
  handler: async (ctx, { id }) => {
    const file = await ctx.db.get(id);
    if (!file) return;
    await ctx.storage.delete(file.storageId);
    await ctx.db.delete(id);
  },
});

// Sample Images
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const addSampleImage = mutation({
  args: {
    sampleId: v.string(),
    storageId: v.id("_storage"),
    caption: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("sampleImages", {
      sampleId: args.sampleId,
      storageId: args.storageId,
      caption: args.caption,
    });
  },
});

export const deleteSampleImage = mutation({
  args: { id: v.id("sampleImages") },
  handler: async (ctx, { id }) => {
    const image = await ctx.db.get(id);
    if (!image) return;
    await ctx.storage.delete(image.storageId);
    await ctx.db.delete(id);
  },
});

export const getSampleImageUrls = query({
  args: { sampleIds: v.array(v.string()) },
  handler: async (ctx, { sampleIds }) => {
    const result: Record<string, { _id: string; url: string | null; caption?: string }[]> = {};
    for (const sampleId of sampleIds) {
      const images = await ctx.db
        .query("sampleImages")
        .withIndex("by_sampleId", (q) => q.eq("sampleId", sampleId))
        .collect();
      result[sampleId] = await Promise.all(
        images.map(async (img) => ({
          _id: img._id,
          url: await ctx.storage.getUrl(img.storageId),
          caption: img.caption,
        }))
      );
    }
    return result;
  },
});

export const getAllFinalProductsForAutocomplete = query({
  args: {},
  handler: async (ctx) => {
    const finalProducts = await ctx.db.query("kitFinalProducts").collect();
    const results: {
      kitFinalProductId: string;
      kitId: string;
      name: string;
      supplierName: string;
      quantity?: number;
      pricePerUnit?: number;
      weight?: number;
      volume?: number;
      kitName: string;
    }[] = [];

    for (const fp of finalProducts) {
      // Get the kitProduct to get the name
      const kitProduct = await ctx.db
        .query("kitProducts")
        .withIndex("by_kitProductId", (q) => q.eq("kitProductId", fp.kitProductId))
        .first();
      if (!kitProduct) continue;

      // Get the kit name
      const kit = await ctx.db
        .query("kits")
        .withIndex("by_kitId", (q) => q.eq("kitId", kitProduct.kitId))
        .first();

      // Get supplier name
      let supplierName = "";
      if (fp.supplierId) {
        const suppId = fp.supplierId;
        const supplier = await ctx.db
          .query("suppliers")
          .withIndex("by_supplierId", (q) => q.eq("supplierId", suppId))
          .first();
        if (supplier) supplierName = supplier.name;
      }

      results.push({
        kitFinalProductId: fp.kitFinalProductId,
        kitId: kitProduct.kitId,
        name: kitProduct.name,
        supplierName,
        quantity: fp.quantity ?? undefined,
        pricePerUnit: fp.pricePerUnit ?? undefined,
        weight: fp.weight ?? undefined,
        volume: fp.volume ?? undefined,
        kitName: kit?.name ?? "",
      });
    }

    return results;
  },
});
