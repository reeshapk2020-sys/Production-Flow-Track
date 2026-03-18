import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
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
import { eq, sql, ilike, ne, and } from "drizzle-orm";
import { logAudit } from "../lib/audit.js";

const router: IRouter = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || req.user?.role !== "admin") {
    res.status(403).json({ error: "Admin access required." });
    return;
  }
  next();
}

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

router.put("/master/categories/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description } = req.body;
  const [row] = await db
    .update(categoriesTable)
    .set({ name, description })
    .where(eq(categoriesTable.id, id))
    .returning();
  res.json(row);
});

router.delete("/master/categories/:id", requireAdmin, async (req, res) => {
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
  if (!code || !String(code).trim()) {
    return res.status(400).json({ error: "Color code is required." });
  }
  const trimmedCode = String(code).trim().toUpperCase();
  const existing = await db
    .select({ id: colorsTable.id })
    .from(colorsTable)
    .where(ilike(colorsTable.code, trimmedCode));
  if (existing.length > 0) {
    return res.status(409).json({ error: `Color code "${trimmedCode}" already exists.` });
  }
  const [row] = await db
    .insert(colorsTable)
    .values({ name: String(name).trim(), code: trimmedCode })
    .returning();
  await logAudit(req, "CREATE", "colors", String(row.id), `Created color: ${name} (${trimmedCode})`);
  res.status(201).json(row);
});

router.put("/master/colors/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, code } = req.body;
  if (!code || !String(code).trim()) {
    return res.status(400).json({ error: "Color code is required." });
  }
  const trimmedCode = String(code).trim().toUpperCase();
  const existing = await db
    .select({ id: colorsTable.id })
    .from(colorsTable)
    .where(and(ilike(colorsTable.code, trimmedCode), ne(colorsTable.id, id)));
  if (existing.length > 0) {
    return res.status(409).json({ error: `Color code "${trimmedCode}" already exists.` });
  }
  const [row] = await db
    .update(colorsTable)
    .set({ name: String(name).trim(), code: trimmedCode })
    .where(eq(colorsTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Color not found." });
  await logAudit(req, "UPDATE", "colors", String(row.id), `Updated color: ${name} (${trimmedCode})`);
  res.json(row);
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
  const rows = await db
    .select({
      id: teamsTable.id,
      name: teamsTable.name,
      code: teamsTable.code,
      supervisorName: teamsTable.supervisorName,
      isActive: teamsTable.isActive,
    })
    .from(teamsTable)
    .orderBy(teamsTable.name);
  res.json(rows);
});

router.post("/master/teams", async (req, res) => {
  const { name, code, supervisorName } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Team name is required." });
  }
  const [row] = await db
    .insert(teamsTable)
    .values({ name: String(name).trim(), code: code ? String(code).trim().toUpperCase() : null, supervisorName })
    .returning();
  await logAudit(req, "CREATE", "teams", String(row.id), `Created team: ${name}`);
  res.status(201).json(row);
});

router.put("/master/teams/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, code, supervisorName, isActive } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Team name is required." });
  }
  const [row] = await db
    .update(teamsTable)
    .set({
      name: String(name).trim(),
      code: code ? String(code).trim().toUpperCase() : null,
      supervisorName,
      isActive: typeof isActive === "boolean" ? isActive : undefined,
    })
    .where(eq(teamsTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Team not found." });
  await logAudit(req, "UPDATE", "teams", String(id), `Updated team: ${name}`);
  res.json(row);
});

// STITCHERS
router.get("/master/stitchers", async (_req, res) => {
  const rows = await db
    .select({
      id: stitchersTable.id,
      name: stitchersTable.name,
      code: stitchersTable.code,
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
  const { name, code, phone, teamId } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Stitcher name is required." });
  }
  const [row] = await db
    .insert(stitchersTable)
    .values({ name: String(name).trim(), code: code ? String(code).trim().toUpperCase() : null, phone, teamId })
    .returning();
  await logAudit(req, "CREATE", "stitchers", String(row.id), `Created stitcher: ${name}`);
  res.status(201).json({ ...row, totalIssued: 0, totalReceived: 0, pendingQuantity: 0 });
});

router.put("/master/stitchers/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, code, phone, teamId, isActive } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Stitcher name is required." });
  }
  const [row] = await db
    .update(stitchersTable)
    .set({
      name: String(name).trim(),
      code: code ? String(code).trim().toUpperCase() : null,
      phone: phone || null,
      teamId: teamId || null,
      isActive: typeof isActive === "boolean" ? isActive : undefined,
    })
    .where(eq(stitchersTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Stitcher not found." });
  await logAudit(req, "UPDATE", "stitchers", String(id), `Updated stitcher: ${name}`);
  res.json({ ...row, totalIssued: 0, totalReceived: 0, pendingQuantity: 0 });
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

router.put("/master/users/:id", requireAdmin, async (req, res) => {
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
