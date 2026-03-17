import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  categoriesTable,
  sizesTable,
  colorsTable,
  fabricsTable,
  productsTable,
  teamsTable,
  stitchersTable,
  appUsersTable,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { logAudit } from "../lib/audit.js";

const router: IRouter = Router();

// CATEGORIES
router.get("/master/categories", async (_req, res) => {
  const rows = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
  res.json(rows);
});

router.post("/master/categories", async (req, res) => {
  const { name, description } = req.body;
  const [row] = await db.insert(categoriesTable).values({ name, description }).returning();
  await logAudit(req, "CREATE", "categories", String(row.id), `Created category: ${name}`);
  res.status(201).json(row);
});

router.put("/master/categories/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description } = req.body;
  const [row] = await db
    .update(categoriesTable)
    .set({ name, description })
    .where(eq(categoriesTable.id, id))
    .returning();
  res.json(row);
});

router.delete("/master/categories/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
  res.json({ success: true, message: "Deleted" });
});

// SIZES
router.get("/master/sizes", async (_req, res) => {
  const rows = await db.select().from(sizesTable).orderBy(sizesTable.sortOrder, sizesTable.name);
  res.json(rows);
});

router.post("/master/sizes", async (req, res) => {
  const { name, sortOrder } = req.body;
  const [row] = await db.insert(sizesTable).values({ name, sortOrder }).returning();
  await logAudit(req, "CREATE", "sizes", String(row.id), `Created size: ${name}`);
  res.status(201).json(row);
});

// COLORS
router.get("/master/colors", async (_req, res) => {
  const rows = await db.select().from(colorsTable).orderBy(colorsTable.name);
  res.json(rows);
});

router.post("/master/colors", async (req, res) => {
  const { name, code } = req.body;
  const [row] = await db.insert(colorsTable).values({ name, code }).returning();
  await logAudit(req, "CREATE", "colors", String(row.id), `Created color: ${name}`);
  res.status(201).json(row);
});

// FABRICS
router.get("/master/fabrics", async (_req, res) => {
  const rows = await db.select().from(fabricsTable).orderBy(fabricsTable.name);
  res.json(rows);
});

router.post("/master/fabrics", async (req, res) => {
  const { name, description, unit } = req.body;
  const [row] = await db.insert(fabricsTable).values({ name, description, unit }).returning();
  await logAudit(req, "CREATE", "fabrics", String(row.id), `Created fabric: ${name}`);
  res.status(201).json(row);
});

// PRODUCTS
router.get("/master/products", async (_req, res) => {
  const rows = await db
    .select({
      id: productsTable.id,
      code: productsTable.code,
      name: productsTable.name,
      categoryId: productsTable.categoryId,
      categoryName: categoriesTable.name,
      description: productsTable.description,
      isActive: productsTable.isActive,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .orderBy(productsTable.name);
  res.json(rows);
});

router.post("/master/products", async (req, res) => {
  const { code, name, categoryId, description } = req.body;
  const [row] = await db
    .insert(productsTable)
    .values({ code, name, categoryId, description })
    .returning();
  await logAudit(req, "CREATE", "products", String(row.id), `Created product: ${name}`);
  res.status(201).json(row);
});

// TEAMS
router.get("/master/teams", async (_req, res) => {
  const rows = await db.select().from(teamsTable).orderBy(teamsTable.name);
  res.json(rows);
});

router.post("/master/teams", async (req, res) => {
  const { name, supervisorName } = req.body;
  const [row] = await db.insert(teamsTable).values({ name, supervisorName }).returning();
  await logAudit(req, "CREATE", "teams", String(row.id), `Created team: ${name}`);
  res.status(201).json(row);
});

// STITCHERS
router.get("/master/stitchers", async (_req, res) => {
  const rows = await db
    .select({
      id: stitchersTable.id,
      name: stitchersTable.name,
      phone: stitchersTable.phone,
      teamId: stitchersTable.teamId,
      teamName: teamsTable.name,
      isActive: stitchersTable.isActive,
    })
    .from(stitchersTable)
    .leftJoin(teamsTable, eq(stitchersTable.teamId, teamsTable.id))
    .orderBy(stitchersTable.name);

  const result = rows.map((r) => ({
    ...r,
    totalIssued: 0,
    totalReceived: 0,
    pendingQuantity: 0,
  }));
  res.json(result);
});

router.post("/master/stitchers", async (req, res) => {
  const { name, phone, teamId } = req.body;
  const [row] = await db.insert(stitchersTable).values({ name, phone, teamId }).returning();
  await logAudit(req, "CREATE", "stitchers", String(row.id), `Created stitcher: ${name}`);
  res.status(201).json({ ...row, totalIssued: 0, totalReceived: 0, pendingQuantity: 0 });
});

// USERS
router.get("/master/users", async (_req, res) => {
  const rows = await db.select().from(appUsersTable).orderBy(appUsersTable.username);
  res.json(rows);
});

router.post("/master/users", async (req, res) => {
  const { replitUserId, username, displayName, role } = req.body;
  const [row] = await db
    .insert(appUsersTable)
    .values({ replitUserId, username, displayName, role })
    .returning();
  res.status(201).json(row);
});

router.put("/master/users/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { role, isActive } = req.body;
  const [row] = await db
    .update(appUsersTable)
    .set({ role, isActive })
    .where(eq(appUsersTable.id, id))
    .returning();
  await logAudit(req, "UPDATE", "app_users", String(id), `Updated user role to ${role}`);
  res.json(row);
});

export default router;
