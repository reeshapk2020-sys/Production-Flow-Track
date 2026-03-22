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
]);

export const batchStatusEnum = pgEnum("batch_status", [
  "cutting",
  "allocated",
  "partially_received",
  "fully_received",
  "in_finishing",
  "finished",
  // legacy values kept for backward compatibility
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
  role: userRoleEnum("role").notNull().default("reporting"),
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
  name: text("name").notNull().unique(),
  code: text("code"),
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
  stitcherId: integer("stitcher_id")
    .notNull()
    .references(() => stitchersTable.id),
  quantityIssued: integer("quantity_issued").notNull(),
  quantityReceived: integer("quantity_received").notNull().default(0),
  quantityRejected: integer("quantity_rejected").notNull().default(0),
  issueDate: timestamp("issue_date").notNull(),
  remarks: text("remarks"),
  status: text("status").notNull().default("pending"),
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

export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogsTable.$inferSelect;
