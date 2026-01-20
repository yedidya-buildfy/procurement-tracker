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
