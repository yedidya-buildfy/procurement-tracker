import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { generateId, addDaysToDate, computeCbmFromDims } from "./helpers";
import { PRODUCTS_READY_TYPE_ID } from "./milestones";

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
    dimHeight: v.optional(v.number()),
    dimWidth: v.optional(v.number()),
    dimLength: v.optional(v.number()),
    orderDate: v.optional(v.string()),
    leadTimeDays: v.optional(v.number()),
    notes: v.optional(v.string()),
    sourceKitId: v.optional(v.string()),
    sourceKitFinalProductId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const productId = generateId("PROD");

    // Auto-calc cbmPerUnit from dims if provided
    let cbmPerUnit = args.cbmPerUnit;
    let cbmTotal = args.cbmTotal;
    let dimHeight = args.dimHeight;
    let dimWidth = args.dimWidth;
    let dimLength = args.dimLength;
    const computedCbm = computeCbmFromDims(dimHeight, dimWidth, dimLength);
    if (computedCbm !== null) {
      cbmPerUnit = computedCbm;
      cbmTotal = computedCbm * args.quantity;
    } else if (cbmPerUnit > 0 && !dimHeight && !dimWidth && !dimLength) {
      dimHeight = undefined;
      dimWidth = undefined;
      dimLength = undefined;
    }

    await ctx.db.insert("products", {
      productId,
      orderId: args.orderId,
      name: args.name,
      supplier: args.supplier,
      quantity: args.quantity,
      pricePerUnit: args.pricePerUnit,
      priceTotal: args.priceTotal,
      currency: args.currency,
      cbmPerUnit,
      cbmTotal,
      kgPerUnit: args.kgPerUnit,
      kgTotal: args.kgTotal,
      dimHeight,
      dimWidth,
      dimLength,
      orderDate: args.orderDate,
      leadTimeDays: args.leadTimeDays,
      notes: args.notes,
      sourceKitId: args.sourceKitId,
      sourceKitFinalProductId: args.sourceKitFinalProductId,
    });

    // Auto-create "Products Ready" milestone if both orderDate and leadTimeDays are set
    if (args.orderDate && args.leadTimeDays && args.leadTimeDays > 0) {
      const targetDate = addDaysToDate(args.orderDate, args.leadTimeDays);
      await ctx.db.insert("productMilestones", {
        milestoneId: generateId("PMS"),
        productId,
        milestoneTypeId: PRODUCTS_READY_TYPE_ID,
        targetDate,
        status: "מוצרים מוכנים",
        notes: "נוצר אוטומטית מזמן אספקה",
      });
    }

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

    // Copy files from kit final product if created from kit
    if (args.sourceKitFinalProductId) {
      const kitFiles = await ctx.db
        .query("kitFinalProductFiles")
        .withIndex("by_kitFinalProductId", (q) => q.eq("kitFinalProductId", args.sourceKitFinalProductId!))
        .collect();
      for (const file of kitFiles) {
        await ctx.db.insert("productFiles", {
          productId,
          storageId: file.storageId,
          fileName: file.fileName,
          fileType: file.fileType,
        });
      }
    }

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
    dimHeight: v.optional(v.number()),
    dimWidth: v.optional(v.number()),
    dimLength: v.optional(v.number()),
    orderDate: v.optional(v.string()),
    leadTimeDays: v.optional(v.number()),
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
    if (args.kgPerUnit !== undefined) updates.kgPerUnit = args.kgPerUnit;
    if (args.kgTotal !== undefined) updates.kgTotal = args.kgTotal;
    if (args.dimHeight !== undefined) updates.dimHeight = args.dimHeight;
    if (args.dimWidth !== undefined) updates.dimWidth = args.dimWidth;
    if (args.dimLength !== undefined) updates.dimLength = args.dimLength;
    if (args.orderDate !== undefined) updates.orderDate = args.orderDate;
    if (args.leadTimeDays !== undefined) updates.leadTimeDays = args.leadTimeDays;
    if (args.notes !== undefined) updates.notes = args.notes;

    // Auto-calc CBM from dims (merge args with existing)
    const effectiveH = args.dimHeight ?? product.dimHeight;
    const effectiveW = args.dimWidth ?? product.dimWidth;
    const effectiveL = args.dimLength ?? product.dimLength;
    const anyDimInArgs = args.dimHeight !== undefined || args.dimWidth !== undefined || args.dimLength !== undefined;
    const cbmFromDims = computeCbmFromDims(effectiveH, effectiveW, effectiveL);
    const effectiveQty = args.quantity ?? product.quantity;

    if (cbmFromDims !== null) {
      updates.cbmPerUnit = cbmFromDims;
      updates.cbmTotal = cbmFromDims * effectiveQty;
    } else if (args.cbmPerUnit !== undefined && !anyDimInArgs) {
      // Flat CBM set without dims -> clear dims
      updates.cbmPerUnit = args.cbmPerUnit;
      updates.cbmTotal = args.cbmTotal ?? args.cbmPerUnit * effectiveQty;
      updates.dimHeight = undefined;
      updates.dimWidth = undefined;
      updates.dimLength = undefined;
    } else {
      if (args.cbmPerUnit !== undefined) updates.cbmPerUnit = args.cbmPerUnit;
      if (args.cbmTotal !== undefined) updates.cbmTotal = args.cbmTotal;
    }

    await ctx.db.patch(product._id, updates);

    // Forward sync: if orderDate or leadTimeDays changed, update "Products Ready" milestone
    if (args.orderDate !== undefined || args.leadTimeDays !== undefined) {
      const effectiveOrderDate = args.orderDate !== undefined ? args.orderDate : product.orderDate;
      const effectiveLeadTime = args.leadTimeDays !== undefined ? args.leadTimeDays : product.leadTimeDays;

      if (effectiveOrderDate && effectiveLeadTime && effectiveLeadTime > 0) {
        const targetDate = addDaysToDate(effectiveOrderDate, effectiveLeadTime);
        const milestones = await ctx.db
          .query("productMilestones")
          .withIndex("by_productId", (q) => q.eq("productId", args.productId))
          .collect();
        const readyMilestone = milestones.find((m) => m.milestoneTypeId === PRODUCTS_READY_TYPE_ID);

        if (readyMilestone) {
          await ctx.db.patch(readyMilestone._id, { targetDate });
        } else {
          await ctx.db.insert("productMilestones", {
            milestoneId: generateId("PMS"),
            productId: args.productId,
            milestoneTypeId: PRODUCTS_READY_TYPE_ID,
            targetDate,
            status: "מוצרים מוכנים",
            notes: "נוצר אוטומטית מזמן אספקה",
          });
        }
      }
    }

    // Cascade updates to linked pending payments
    const paymentLinks = await ctx.db
      .query("paymentProductLinks")
      .withIndex("by_productId", (q) => q.eq("productId", args.productId))
      .collect();

    for (const link of paymentLinks) {
      const payment = await ctx.db
        .query("payments")
        .withIndex("by_paymentId", (q) => q.eq("paymentId", link.paymentId))
        .first();

      if (payment) {
        const paymentUpdates: Record<string, unknown> = {};

        // Only sync financial fields to pending payments
        if (payment.status === "pending") {
          if (args.priceTotal !== undefined) {
            paymentUpdates.amount = args.priceTotal;
          }
          if (args.currency !== undefined) {
            const validCurrency = ["USD", "CNY", "ILS"].includes(args.currency)
              ? args.currency
              : undefined;
            if (validCurrency) paymentUpdates.currency = validCurrency;
          }
          if (args.name !== undefined) {
            paymentUpdates.description = `תשלום עבור ${args.name}`;
          }
        }

        // Sync supplier to both pending AND approved payments
        if (args.supplier !== undefined) {
          paymentUpdates.payee = args.supplier;
        }

        if (Object.keys(paymentUpdates).length > 0) {
          await ctx.db.patch(payment._id, paymentUpdates);
        }
      }
    }

    return true;
  },
});

export const getAllSuppliers = query({
  args: {},
  handler: async (ctx) => {
    // Collect supplier names from all sources
    const [products, suppliers] = await Promise.all([
      ctx.db.query("products").collect(),
      ctx.db.query("suppliers").collect(),
    ]);

    const productSuppliers = products
      .map((p) => p.supplier)
      .filter((s): s is string => !!s && s.trim() !== '');

    const registeredSuppliers = suppliers
      .map((s) => s.name)
      .filter((s) => s.trim() !== '');

    return [...new Set([...registeredSuppliers, ...productSuppliers])];
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

    // Delete related product files and their storage
    const productFiles = await ctx.db
      .query("productFiles")
      .withIndex("by_productId", (q) => q.eq("productId", productId))
      .collect();

    for (const file of productFiles) {
      await ctx.storage.delete(file.storageId);
      await ctx.db.delete(file._id);
    }

    // Delete the product
    await ctx.db.delete(product._id);

    return true;
  },
});

// Product Files
export const getProductFiles = query({
  args: { productId: v.string() },
  handler: async (ctx, { productId }) => {
    const files = await ctx.db
      .query("productFiles")
      .withIndex("by_productId", (q) => q.eq("productId", productId))
      .collect();

    return Promise.all(
      files.map(async (f) => ({
        _id: f._id,
        productId: f.productId,
        url: await ctx.storage.getUrl(f.storageId),
        fileName: f.fileName,
        fileType: f.fileType,
      }))
    );
  },
});

export const getProductFilesByOrder = query({
  args: { orderId: v.string() },
  handler: async (ctx, { orderId }) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
      .collect();

    const result: Record<string, { _id: string; url: string | null; fileName: string; fileType: string }[]> = {};
    for (const product of products) {
      const files = await ctx.db
        .query("productFiles")
        .withIndex("by_productId", (q) => q.eq("productId", product.productId))
        .collect();

      if (files.length > 0) {
        result[product.productId] = await Promise.all(
          files.map(async (f) => ({
            _id: f._id as string,
            url: await ctx.storage.getUrl(f.storageId),
            fileName: f.fileName,
            fileType: f.fileType,
          }))
        );
      }
    }
    return result;
  },
});

export const addProductFile = mutation({
  args: {
    productId: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("productFiles", {
      productId: args.productId,
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: args.fileType,
    });
  },
});

export const deleteProductFile = mutation({
  args: { id: v.id("productFiles") },
  handler: async (ctx, { id }) => {
    const file = await ctx.db.get(id);
    if (!file) return;
    await ctx.storage.delete(file.storageId);
    await ctx.db.delete(id);
  },
});
