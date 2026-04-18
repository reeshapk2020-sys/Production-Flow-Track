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
  materialsTable,
} from "@workspace/db/schema";
import { eq, sql, ilike, ne, and } from "drizzle-orm";
import { logAudit } from "../lib/audit.js";
import { checkPermission } from "./permissions.js";

const router: IRouter = Router();

// CATEGORIES
router.get("/master/categories", checkPermission("master-data", "view"), async (_req, res) => {
  const rows = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
  res.json(rows);
});

router.post("/master/categories", checkPermission("master-data", "create"), async (req, res) => {
  const { name, description } = req.body;
  const [row] = await db.insert(categoriesTable).values({ name, description }).returning();
  await logAudit(req, "CREATE", "categories", String(row.id), `Created category: ${name}`);
  res.status(201).json(row);
});

router.put("/master/categories/:id", checkPermission("master-data", "edit"), async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description } = req.body;
  const [row] = await db
    .update(categoriesTable)
    .set({ name, description })
    .where(eq(categoriesTable.id, id))
    .returning();
  res.json(row);
});

router.delete("/master/categories/:id", checkPermission("master-data", "edit"), async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
  res.json({ success: true, message: "Deleted" });
});

// SIZES
router.get("/master/sizes", checkPermission("master-data", "view"), async (_req, res) => {
  const rows = await db.select().from(sizesTable).orderBy(sizesTable.sortOrder, sizesTable.name);
  res.json(rows);
});

router.post("/master/sizes", checkPermission("master-data", "create"), async (req, res) => {
  const { name, sortOrder } = req.body;
  const [row] = await db.insert(sizesTable).values({ name, sortOrder }).returning();
  await logAudit(req, "CREATE", "sizes", String(row.id), `Created size: ${name}`);
  res.status(201).json(row);
});

// COLORS
router.get("/master/colors", checkPermission("master-data", "view"), async (_req, res) => {
  const rows = await db.select().from(colorsTable).orderBy(colorsTable.name);
  res.json(rows);
});

router.post("/master/colors", checkPermission("master-data", "create"), async (req, res) => {
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

router.put("/master/colors/:id", checkPermission("master-data", "edit"), async (req, res) => {
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
router.get("/master/fabrics", checkPermission("master-data", "view"), async (_req, res) => {
  const rows = await db.select().from(fabricsTable).orderBy(fabricsTable.name);
  res.json(rows);
});

router.post("/master/fabrics", checkPermission("master-data", "create"), async (req, res) => {
  const { code, name, description, unit } = req.body;
  const trimmedCode = code ? String(code).trim().toUpperCase() : null;
  const [row] = await db.insert(fabricsTable).values({ code: trimmedCode, name, description, unit }).returning();
  await logAudit(req, "CREATE", "fabrics", String(row.id), `Created fabric: ${name}`);
  res.status(201).json(row);
});

router.put("/master/fabrics/:id", checkPermission("master-data", "edit"), async (req, res) => {
  const id = Number(req.params.id);
  const { code, name, description, unit, isActive } = req.body;
  const trimmedCode = code ? String(code).trim().toUpperCase() : null;
  const [row] = await db
    .update(fabricsTable)
    .set({ code: trimmedCode, name, description, unit, ...(isActive !== undefined ? { isActive } : {}) })
    .where(eq(fabricsTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  await logAudit(req, "UPDATE", "fabrics", String(id), `Updated fabric: ${name}`);
  res.json(row);
});

// PRODUCTS
router.get("/master/products", checkPermission("master-data", "view"), async (_req, res) => {
  const rows = await db
    .select({
      id: productsTable.id,
      code: productsTable.code,
      name: productsTable.name,
      categoryId: productsTable.categoryId,
      categoryName: categoriesTable.name,
      description: productsTable.description,
      pointsPerPiece: productsTable.pointsPerPiece,
      isActive: productsTable.isActive,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .orderBy(productsTable.name);
  res.json(rows.map(r => ({ ...r, pointsPerPiece: r.pointsPerPiece ? Number(r.pointsPerPiece) : null })));
});

router.post("/master/products", checkPermission("master-data", "create"), async (req, res) => {
  const { code, name, categoryId, description, pointsPerPiece } = req.body;
  const trimmedCode = code ? String(code).trim() : "";
  if (trimmedCode) {
    const [dup] = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(ilike(productsTable.code, trimmedCode));
    if (dup) {
      return res.status(409).json({ error: `Product code "${trimmedCode}" already exists.` });
    }
  }
  const [row] = await db
    .insert(productsTable)
    .values({
      code: trimmedCode || null,
      name,
      categoryId,
      description,
      pointsPerPiece: pointsPerPiece != null ? String(pointsPerPiece) : null,
    })
    .returning();
  await logAudit(req, "CREATE", "products", String(row.id), `Created product: ${name} (${trimmedCode})`);
  res.status(201).json({ ...row, pointsPerPiece: row.pointsPerPiece ? Number(row.pointsPerPiece) : null });
});

router.put("/master/products/:id", checkPermission("master-data", "edit"), async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, code, categoryId, description, pointsPerPiece, isActive } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Product name is required." });
  }
  const trimmedCode = code ? String(code).trim().toUpperCase() : "";
  if (trimmedCode) {
    const [dup] = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(and(ilike(productsTable.code, trimmedCode), ne(productsTable.id, id)));
    if (dup) {
      return res.status(409).json({ error: `Product code "${trimmedCode}" already exists.` });
    }
  }
  const [row] = await db
    .update(productsTable)
    .set({
      name: String(name).trim(),
      code: trimmedCode || null,
      categoryId,
      description,
      pointsPerPiece: pointsPerPiece != null ? String(pointsPerPiece) : null,
      isActive: isActive !== undefined ? isActive : undefined,
    })
    .where(eq(productsTable.id, id))
    .returning();
  await logAudit(req, "UPDATE", "products", String(row.id), `Updated product: ${row.name}`);
  res.json({ ...row, pointsPerPiece: row.pointsPerPiece ? Number(row.pointsPerPiece) : null });
});

// TEAMS
router.get("/master/teams", checkPermission("master-data", "view"), async (_req, res) => {
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

router.post("/master/teams", checkPermission("master-data", "create"), async (req, res) => {
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

router.put("/master/teams/:id", checkPermission("master-data", "edit"), async (req, res) => {
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
router.get("/master/stitchers", checkPermission("master-data", "view"), async (_req, res) => {
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

router.post("/master/stitchers", checkPermission("master-data", "create"), async (req, res) => {
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

router.put("/master/stitchers/:id", checkPermission("master-data", "edit"), async (req, res) => {
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

// MATERIALS
router.get("/master/materials", checkPermission("master-data", "view"), async (_req, res) => {
  const rows = await db.select().from(materialsTable).orderBy(materialsTable.code);
  res.json(rows);
});

router.post("/master/materials", checkPermission("master-data", "create"), async (req, res) => {
  const { code, name, description } = req.body;
  if (!code || !String(code).trim()) {
    return res.status(400).json({ error: "Material code is required." });
  }
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Material name is required." });
  }
  const trimmedCode = String(code).trim().toUpperCase();
  const existing = await db
    .select({ id: materialsTable.id })
    .from(materialsTable)
    .where(ilike(materialsTable.code, trimmedCode));
  if (existing.length > 0) {
    return res.status(409).json({ error: `Material code "${trimmedCode}" already exists.` });
  }
  const [row] = await db
    .insert(materialsTable)
    .values({ code: trimmedCode, name: String(name).trim(), description: description || null })
    .returning();
  await logAudit(req, "CREATE", "materials", String(row.id), `Created material: ${name} (${trimmedCode})`);
  res.status(201).json(row);
});

router.put("/master/materials/:id", checkPermission("master-data", "edit"), async (req, res) => {
  const id = parseInt(req.params.id);
  const { code, name, description, isActive } = req.body;
  if (!code || !String(code).trim()) {
    return res.status(400).json({ error: "Material code is required." });
  }
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Material name is required." });
  }
  const trimmedCode = String(code).trim().toUpperCase();
  const existing = await db
    .select({ id: materialsTable.id })
    .from(materialsTable)
    .where(and(ilike(materialsTable.code, trimmedCode), ne(materialsTable.id, id)));
  if (existing.length > 0) {
    return res.status(409).json({ error: `Material code "${trimmedCode}" already exists.` });
  }
  const [row] = await db
    .update(materialsTable)
    .set({
      code: trimmedCode,
      name: String(name).trim(),
      description: description || null,
      isActive: typeof isActive === "boolean" ? isActive : undefined,
    })
    .where(eq(materialsTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Material not found." });
  await logAudit(req, "UPDATE", "materials", String(id), `Updated material: ${name} (${trimmedCode})`);
  res.json(row);
});

// USERS
router.get("/master/users", checkPermission("master-data", "view"), async (_req, res) => {
  const rows = await db.select().from(appUsersTable).orderBy(appUsersTable.username);
  res.json(rows);
});

router.post("/master/users", checkPermission("master-data", "create"), async (req, res) => {
  const { replitUserId, username, displayName, role } = req.body;
  const [row] = await db
    .insert(appUsersTable)
    .values({ replitUserId, username, displayName, role })
    .returning();
  res.status(201).json(row);
});

router.put("/master/users/:id", checkPermission("master-data", "edit"), async (req, res) => {
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
