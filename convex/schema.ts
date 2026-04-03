import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  orders: defineTable({
    orderId: v.string(),
    orderName: v.string(),
    supplier: v.optional(v.string()),
    usdRate: v.number(),
    cnyRate: v.number(),
    createdDate: v.string(),
    status: v.string(),
    notes: v.optional(v.string()),
    estimatedArrival: v.optional(v.string()),
  })
    .index("by_orderId", ["orderId"])
    .index("by_status", ["status"]),

  products: defineTable({
    productId: v.string(),
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
  })
    .index("by_orderId", ["orderId"])
    .index("by_productId", ["productId"]),

  additionalCosts: defineTable({
    costId: v.string(),
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
  })
    .index("by_orderId", ["orderId"])
    .index("by_costId", ["costId"]),

  costProductLinks: defineTable({
    costId: v.string(),
    productId: v.string(),
    isLinked: v.boolean(),
  })
    .index("by_costId", ["costId"])
    .index("by_productId", ["productId"]),

  payments: defineTable({
    paymentId: v.string(),
    orderId: v.string(),
    date: v.string(),
    amount: v.number(),
    currency: v.union(v.literal("USD"), v.literal("CNY"), v.literal("ILS")),
    payee: v.optional(v.string()),
    description: v.optional(v.string()),
    reference: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("approved")),
  })
    .index("by_orderId", ["orderId"])
    .index("by_paymentId", ["paymentId"]),

  paymentProductLinks: defineTable({
    paymentId: v.string(),
    productId: v.string(),
  })
    .index("by_paymentId", ["paymentId"])
    .index("by_productId", ["productId"]),

  paymentCostLinks: defineTable({
    paymentId: v.string(),
    costId: v.string(),
  })
    .index("by_paymentId", ["paymentId"])
    .index("by_costId", ["costId"]),

  milestoneTypes: defineTable({
    typeId: v.string(),
    name: v.string(),
    level: v.union(v.literal("product"), v.literal("order")),
    defaultOrder: v.number(),
    color: v.string(),
  })
    .index("by_level", ["level"])
    .index("by_typeId", ["typeId"]),

  orderMilestones: defineTable({
    milestoneId: v.string(),
    orderId: v.string(),
    milestoneTypeId: v.string(),
    targetDate: v.optional(v.string()),
    actualDate: v.optional(v.string()),
    status: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_orderId", ["orderId"])
    .index("by_milestoneId", ["milestoneId"]),

  productMilestones: defineTable({
    milestoneId: v.string(),
    productId: v.string(),
    milestoneTypeId: v.string(),
    targetDate: v.optional(v.string()),
    actualDate: v.optional(v.string()),
    status: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_productId", ["productId"])
    .index("by_milestoneId", ["milestoneId"]),

  // Kits & Samples
  kits: defineTable({
    kitId: v.string(),
    name: v.string(),
    status: v.string(),
    notes: v.optional(v.string()),
    createdDate: v.string(),
  })
    .index("by_kitId", ["kitId"]),

  kitProducts: defineTable({
    kitProductId: v.string(),
    kitId: v.string(),
    name: v.string(),
    category: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_kitId", ["kitId"])
    .index("by_kitProductId", ["kitProductId"]),

  samples: defineTable({
    sampleId: v.string(),
    kitProductId: v.string(),
    supplierId: v.string(),
    sampleCost: v.optional(v.number()),
    paid: v.boolean(),
    shippingMethod: v.optional(v.string()),
    rating: v.optional(v.number()),
    ratingNotes: v.optional(v.string()),
    isRelevant: v.optional(v.boolean()),
    currentStage: v.optional(v.number()),
    archived: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    createdDate: v.string(),
  })
    .index("by_kitProductId", ["kitProductId"])
    .index("by_sampleId", ["sampleId"])
    .index("by_supplierId", ["supplierId"]),

  sampleMilestones: defineTable({
    milestoneId: v.string(),
    sampleId: v.string(),
    name: v.string(),
    targetDate: v.optional(v.string()),
    actualDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_sampleId", ["sampleId"])
    .index("by_milestoneId", ["milestoneId"]),

  sampleTrackingNumbers: defineTable({
    sampleId: v.string(),
    leg: v.string(),
    trackingNumber: v.string(),
    carrier: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_sampleId", ["sampleId"]),

  sampleImages: defineTable({
    sampleId: v.string(),
    storageId: v.id("_storage"),
    caption: v.optional(v.string()),
  })
    .index("by_sampleId", ["sampleId"]),

  kitAdditionalCosts: defineTable({
    costId: v.string(),
    kitId: v.string(),
    description: v.string(),
    costType: v.union(v.literal("fixed"), v.literal("percentage")),
    amount: v.number(),
    linkedProductIds: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
  })
    .index("by_kitId", ["kitId"])
    .index("by_costId", ["costId"]),

  kitFinalProducts: defineTable({
    kitFinalProductId: v.string(),
    kitProductId: v.string(),
    supplierId: v.optional(v.string()),
    pricePerUnit: v.optional(v.number()),
    weight: v.optional(v.number()),
    moq: v.optional(v.number()),
    totalCost: v.optional(v.number()),
    productionRound: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_kitProductId", ["kitProductId"])
    .index("by_kitFinalProductId", ["kitFinalProductId"]),

  suppliers: defineTable({
    supplierId: v.string(),
    name: v.string(),
    contactName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    country: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdDate: v.optional(v.string()),
  })
    .index("by_name", ["name"])
    .index("by_supplierId", ["supplierId"]),
});
