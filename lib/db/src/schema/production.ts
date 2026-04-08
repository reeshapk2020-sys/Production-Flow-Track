import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Enums
export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "cutting",
  "allocation",
  "stitching",
  "finishing",
  "store",
  "reporting",
  "data_entry",
  "supervisor",
]);

export const batchStatusEnum = pgEnum("batch_status", [
  "cutting",
  "allocated",
  "returned",
  "partially_received",
  "fully_received",
  "in_finishing",
  "finished",
  "allocation",
  "stitching",
  "partial",
  "completed",
]);

export const finishingStageEnum = pgEnum("finishing_stage", [
  "pressing",
  "buttons",
  "hanger",
  "packing",
  "finishing",
]);

export const rollStatusEnum = pgEnum("roll_status", [
  "available",
  "partial",
  "exhausted",
]);

// ===== MASTER TABLES =====

export const appUsersTable = pgTable("app_users", {
  id: serial("id").primaryKey(),
  replitUserId: text("replit_user_id").unique(),
  username: text("username").notNull().unique(),
  fullName: text("full_name"),
  displayName: text("display_name"),
  passwordHash: text("password_hash"),
  role: text("role").notNull().default("reporting"),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const categoriesTable = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sizesTable = pgTable("sizes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").default(0),
});

export const colorsTable = pgTable("colors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").unique(),
});

export const materialsTable = pgTable("materials", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const fabricsTable = pgTable("fabrics", {
  id: serial("id").primaryKey(),
  code: text("code"),
  name: text("name").notNull().unique(),
  description: text("description"),
  unit: text("unit").notNull().default("meters"),
});

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  code: text("code").unique(),
  name: text("name").notNull(),
  categoryId: integer("category_id").references(() => categoriesTable.id),
  description: text("description"),
  pointsPerPiece: numeric("points_per_piece", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const teamsTable = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  code: text("code"),
  supervisorName: text("supervisor_name"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const stitchersTable = pgTable("stitchers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code"),
  phone: text("phone"),
  teamId: integer("team_id").references(() => teamsTable.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== FABRIC ROLLS =====

export const fabricRollsTable = pgTable("fabric_rolls", {
  id: serial("id").primaryKey(),
  rollNumber: text("roll_number").notNull().unique(),
  fabricId: integer("fabric_id")
    .notNull()
    .references(() => fabricsTable.id),
  colorId: integer("color_id").references(() => colorsTable.id),
  supplier: text("supplier"),
  totalQuantity: numeric("total_quantity", { precision: 10, scale: 2 }).notNull(),
  availableQuantity: numeric("available_quantity", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").notNull().default("meters"),
  costPerUnit: numeric("cost_per_unit", { precision: 10, scale: 2 }),
  receivedDate: timestamp("received_date").notNull(),
  remarks: text("remarks"),
  status: rollStatusEnum("status").notNull().default("available"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== PURCHASE ORDERS =====

export const purchaseOrdersTable = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  poNumber: text("po_number").notNull().unique(),
  customerName: text("customer_name").notNull(),
  date: timestamp("date").notNull(),
  remarks: text("remarks"),
  status: text("status").notNull().default("active"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== ORDERS =====

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  customerName: text("customer_name").notNull(),
  date: timestamp("date").notNull(),
  remarks: text("remarks"),
  status: text("status").notNull().default("active"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== CUTTING =====

export const cuttingBatchesTable = pgTable("cutting_batches", {
  id: serial("id").primaryKey(),
  batchNumber: text("batch_number").notNull().unique(),
  productId: integer("product_id")
    .references(() => productsTable.id),
  fabricId: integer("fabric_id").references(() => fabricsTable.id),
  materialId: integer("material_id").references(() => materialsTable.id),
  material2Id: integer("material2_id").references(() => materialsTable.id),
  sizeId: integer("size_id").references(() => sizesTable.id),
  colorId: integer("color_id").references(() => colorsTable.id),
  quantityCut: integer("quantity_cut").notNull(),
  availableForAllocation: integer("available_for_allocation").notNull(),
  cutter: text("cutter"),
  cuttingDate: timestamp("cutting_date").notNull(),
  remarks: text("remarks"),
  status: batchStatusEnum("status").notNull().default("cutting"),
  productionFor: text("production_for").notNull().default("reesha_stock"),
  poId: integer("po_id").references(() => purchaseOrdersTable.id),
  orderId: integer("order_id").references(() => ordersTable.id),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const cuttingFabricUsageTable = pgTable("cutting_fabric_usage", {
  id: serial("id").primaryKey(),
  cuttingBatchId: integer("cutting_batch_id")
    .notNull()
    .references(() => cuttingBatchesTable.id),
  fabricRollId: integer("fabric_roll_id")
    .notNull()
    .references(() => fabricRollsTable.id),
  quantityUsed: numeric("quantity_used", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== ALLOCATION =====

export const allocationsTable = pgTable("allocations", {
  id: serial("id").primaryKey(),
  allocationNumber: text("allocation_number").notNull().unique(),
  cuttingBatchId: integer("cutting_batch_id")
    .notNull()
    .references(() => cuttingBatchesTable.id),
  allocationType: text("allocation_type").notNull().default("individual"),
  stitcherId: integer("stitcher_id")
    .references(() => stitchersTable.id),
  teamId: integer("team_id")
    .references(() => teamsTable.id),
  quantityIssued: integer("quantity_issued").notNull(),
  quantityReceived: integer("quantity_received").notNull().default(0),
  quantityRejected: integer("quantity_rejected").notNull().default(0),
  workType: text("work_type").notNull().default("simple_stitch"),
  outsourceCategory: text("outsource_category"),
  pointsPerPiece: numeric("points_per_piece", { precision: 10, scale: 2 }),
  issueDate: timestamp("issue_date").notNull(),
  remarks: text("remarks"),
  status: text("status").notNull().default("pending"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== ALLOCATION RETURNS =====

export const allocationReturnsTable = pgTable("allocation_returns", {
  id: serial("id").primaryKey(),
  allocationId: integer("allocation_id")
    .notNull()
    .references(() => allocationsTable.id),
  quantityReturned: integer("quantity_returned").notNull(),
  returnDate: timestamp("return_date").notNull(),
  remarks: text("remarks"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== OUTSOURCE TRANSFERS =====

export const outsourceTransfersTable = pgTable("outsource_transfers", {
  id: serial("id").primaryKey(),
  allocationId: integer("allocation_id")
    .notNull()
    .references(() => allocationsTable.id),
  outsourceCategory: text("outsource_category").notNull(),
  quantitySent: integer("quantity_sent").notNull(),
  quantityReturned: integer("quantity_returned").notNull().default(0),
  quantityDamaged: integer("quantity_damaged").notNull().default(0),
  vendorName: text("vendor_name"),
  sendDate: timestamp("send_date").notNull(),
  returnDate: timestamp("return_date"),
  status: text("status").notNull().default("sent"),
  remarks: text("remarks"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== RECEIVING FROM STITCHERS =====

export const receivingsTable = pgTable("receivings", {
  id: serial("id").primaryKey(),
  allocationId: integer("allocation_id")
    .notNull()
    .references(() => allocationsTable.id),
  quantityReceived: integer("quantity_received").notNull(),
  quantityRejected: integer("quantity_rejected").notNull().default(0),
  quantityDamaged: integer("quantity_damaged").notNull().default(0),
  receiveDate: timestamp("receive_date").notNull(),
  remarks: text("remarks"),
  receivedBy: text("received_by"),
  hasStain: boolean("has_stain").notNull().default(false),
  hasDamage: boolean("has_damage").notNull().default(false),
  needsWash: boolean("needs_wash").notNull().default(false),
  needsRework: boolean("needs_rework").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== FINISHING =====

export const finishingRecordsTable = pgTable("finishing_records", {
  id: serial("id").primaryKey(),
  cuttingBatchId: integer("cutting_batch_id")
    .notNull()
    .references(() => cuttingBatchesTable.id),
  stage: finishingStageEnum("stage").notNull(),
  inputQuantity: integer("input_quantity").notNull(),
  outputQuantity: integer("output_quantity").notNull(),
  defectiveQuantity: integer("defective_quantity").notNull().default(0),
  operator: text("operator"),
  processDate: timestamp("process_date").notNull(),
  remarks: text("remarks"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== FINISHED GOODS =====

export const finishedGoodsTable = pgTable("finished_goods", {
  id: serial("id").primaryKey(),
  cuttingBatchId: integer("cutting_batch_id")
    .notNull()
    .references(() => cuttingBatchesTable.id),
  quantity: integer("quantity").notNull(),
  entryDate: timestamp("entry_date").notNull(),
  remarks: text("remarks"),
  enteredBy: text("entered_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== OPENING FINISHED GOODS (Old / Opening Balance Stock) =====

export const openingFinishedGoodsTable = pgTable("opening_finished_goods", {
  id: serial("id").primaryKey(),
  itemCode: text("item_code").notNull(),
  productCode: text("product_code"),
  productName: text("product_name"),
  sizeName: text("size_name"),
  colorName: text("color_name"),
  quantity: integer("quantity").notNull(),
  stockStage: text("stock_stage").notNull().default("finished_goods"),
  remarks: text("remarks"),
  enteredBy: text("entered_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== DISPATCHES =====

export const dispatchDestinationEnum = pgEnum("dispatch_destination", [
  "reesha",
  "purchase_order",
  "order",
]);

export const deliveryStatusEnum = pgEnum("delivery_status", [
  "pending",
  "dispatched",
  "delivered",
]);

export const dispatchesTable = pgTable("dispatches", {
  id: serial("id").primaryKey(),
  dispatchNumber: text("dispatch_number").notNull().unique(),
  dispatchDate: timestamp("dispatch_date").notNull(),
  itemCode: text("item_code").notNull(),
  productCode: text("product_code"),
  productName: text("product_name"),
  sizeName: text("size_name"),
  colorName: text("color_name"),
  quantity: integer("quantity").notNull(),
  destinationType: dispatchDestinationEnum("destination_type").notNull().default("reesha"),
  poId: integer("po_id").references(() => purchaseOrdersTable.id),
  orderId: integer("order_id").references(() => ordersTable.id),
  customerName: text("customer_name"),
  deliveryStatus: deliveryStatusEnum("delivery_status").notNull().default("pending"),
  deliveryDate: timestamp("delivery_date"),
  remarks: text("remarks"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== AUDIT LOG =====

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  username: text("username"),
  action: text("action").notNull(),
  tableName: text("table_name"),
  recordId: text("record_id"),
  details: text("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const rolePermissionsTable = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(),
  module: text("module").notNull(),
  canView: boolean("can_view").notNull().default(false),
  canCreate: boolean("can_create").notNull().default(false),
  canEdit: boolean("can_edit").notNull().default(false),
  canImport: boolean("can_import").notNull().default(false),
});

// ===== INSERT SCHEMAS =====

export const insertAppUserSchema = createInsertSchema(appUsersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAppUser = z.infer<typeof insertAppUserSchema>;
export type AppUser = typeof appUsersTable.$inferSelect;

export const insertCategorySchema = createInsertSchema(categoriesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categoriesTable.$inferSelect;

export const insertSizeSchema = createInsertSchema(sizesTable).omit({ id: true });
export type InsertSize = z.infer<typeof insertSizeSchema>;
export type Size = typeof sizesTable.$inferSelect;

export const insertColorSchema = createInsertSchema(colorsTable).omit({ id: true });
export type InsertColor = z.infer<typeof insertColorSchema>;
export type Color = typeof colorsTable.$inferSelect;

export const insertMaterialSchema = createInsertSchema(materialsTable).omit({ id: true, createdAt: true });
export type InsertMaterial = z.infer<typeof insertMaterialSchema>;
export type Material = typeof materialsTable.$inferSelect;

export const insertFabricSchema = createInsertSchema(fabricsTable).omit({ id: true });
export type InsertFabric = z.infer<typeof insertFabricSchema>;
export type Fabric = typeof fabricsTable.$inferSelect;

export const insertProductSchema = createInsertSchema(productsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;

export const insertTeamSchema = createInsertSchema(teamsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teamsTable.$inferSelect;

export const insertStitcherSchema = createInsertSchema(stitchersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertStitcher = z.infer<typeof insertStitcherSchema>;
export type Stitcher = typeof stitchersTable.$inferSelect;

export const insertFabricRollSchema = createInsertSchema(fabricRollsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertFabricRoll = z.infer<typeof insertFabricRollSchema>;
export type FabricRoll = typeof fabricRollsTable.$inferSelect;

export const insertCuttingBatchSchema = createInsertSchema(cuttingBatchesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertCuttingBatch = z.infer<typeof insertCuttingBatchSchema>;
export type CuttingBatch = typeof cuttingBatchesTable.$inferSelect;

export const insertAllocationSchema = createInsertSchema(allocationsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAllocation = z.infer<typeof insertAllocationSchema>;
export type Allocation = typeof allocationsTable.$inferSelect;

export const insertOutsourceTransferSchema = createInsertSchema(outsourceTransfersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertOutsourceTransfer = z.infer<typeof insertOutsourceTransferSchema>;
export type OutsourceTransfer = typeof outsourceTransfersTable.$inferSelect;

export const insertReceivingSchema = createInsertSchema(receivingsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertReceiving = z.infer<typeof insertReceivingSchema>;
export type Receiving = typeof receivingsTable.$inferSelect;

export const insertFinishingRecordSchema = createInsertSchema(finishingRecordsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertFinishingRecord = z.infer<typeof insertFinishingRecordSchema>;
export type FinishingRecord = typeof finishingRecordsTable.$inferSelect;

export const insertFinishedGoodsSchema = createInsertSchema(finishedGoodsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertFinishedGoods = z.infer<typeof insertFinishedGoodsSchema>;
export type FinishedGoods = typeof finishedGoodsTable.$inferSelect;

export const insertOpeningFinishedGoodsSchema = createInsertSchema(openingFinishedGoodsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertOpeningFinishedGoods = z.infer<typeof insertOpeningFinishedGoodsSchema>;
export type OpeningFinishedGoods = typeof openingFinishedGoodsTable.$inferSelect;

export const insertDispatchSchema = createInsertSchema(dispatchesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDispatch = z.infer<typeof insertDispatchSchema>;
export type Dispatch = typeof dispatchesTable.$inferSelect;

export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogsTable.$inferSelect;

// ===== MANUAL PAUSES =====

export const manualPausesTable = pgTable("manual_pauses", {
  id: serial("id").primaryKey(),
  allocationId: integer("allocation_id").notNull(),
  pauseStart: timestamp("pause_start").notNull(),
  pauseEnd: timestamp("pause_end").notNull(),
  reason: text("reason"),
  remarks: text("remarks"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertManualPauseSchema = createInsertSchema(manualPausesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertManualPause = z.infer<typeof insertManualPauseSchema>;
export type ManualPause = typeof manualPausesTable.$inferSelect;

// ===== TIME SETTINGS =====

export const timeSettingsTable = pgTable("time_settings", {
  id: serial("id").primaryKey(),
  slot1Start: integer("slot1_start").notNull().default(480),
  slot1End: integer("slot1_end").notNull().default(800),
  slot2Start: integer("slot2_start").notNull().default(870),
  slot2End: integer("slot2_end").notNull().default(1200),
  slot2Effective: integer("slot2_effective"),
  slot3Start: integer("slot3_start").notNull().default(1230),
  slot3End: integer("slot3_end").notNull().default(1380),
  minutesPerPoint: integer("minutes_per_point").notNull().default(20),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type TimeSettings = typeof timeSettingsTable.$inferSelect;

// ===== OFF DAYS / HOLIDAYS =====

export const offDaysTable = pgTable("off_days", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  dayOfWeek: integer("day_of_week"),
  date: text("date"),
  label: text("label"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
