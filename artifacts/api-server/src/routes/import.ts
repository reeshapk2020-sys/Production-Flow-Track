import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  productsTable,
  colorsTable,
  sizesTable,
  materialsTable,
  stitchersTable,
  teamsTable,
  fabricRollsTable,
  fabricsTable,
  categoriesTable,
} from "@workspace/db/schema";
import { eq, ilike } from "drizzle-orm";
import { logAudit } from "../lib/audit.js";
import multer from "multer";
import * as XLSX from "xlsx";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const router: IRouter = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || req.user?.role !== "admin") {
    res.status(403).json({ error: "Admin access required." });
    return;
  }
  next();
}

function parseFile(buffer: Buffer, mimetype: string): Record<string, any>[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
  return rows as Record<string, any>[];
}

function normalizeHeaders(rows: Record<string, any>[]): Record<string, string>[] {
  return rows.map((row) => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[key.trim().toLowerCase().replace(/\s+/g, "")] = String(value ?? "").trim();
    }
    return normalized;
  });
}

interface ImportResult {
  total: number;
  inserted: number;
  failed: number;
  errors: { row: number; reason: string }[];
}

// ========== PRODUCTS ==========
router.post("/import/products", requireAdmin, upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded." });
  const result: ImportResult = { total: 0, inserted: 0, failed: 0, errors: [] };

  try {
    const rawRows = parseFile(req.file.buffer, req.file.mimetype);
    const rows = normalizeHeaders(rawRows);
    result.total = rows.length;

    const existingProducts = await db.select({ code: productsTable.code }).from(productsTable);
    const existingCodes = new Set(existingProducts.map((p) => p.code?.toUpperCase()).filter(Boolean));

    const categories = await db.select({ id: categoriesTable.id, name: categoriesTable.name }).from(categoriesTable);
    const catMap = new Map(categories.map((c) => [c.name.toUpperCase(), c.id]));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const code = row.code || row.designcode || row.productcode || "";
      const name = row.name || row.productname || row.designname || row.design || "";
      const category = row.category || row.categoryname || "";
      const description = row.description || "";

      if (!code) { result.failed++; result.errors.push({ row: i + 2, reason: "Missing code" }); continue; }
      if (!name) { result.failed++; result.errors.push({ row: i + 2, reason: "Missing name" }); continue; }
      if (existingCodes.has(code.toUpperCase())) { result.failed++; result.errors.push({ row: i + 2, reason: `Duplicate code "${code}"` }); continue; }

      const categoryId = category ? catMap.get(category.toUpperCase()) || null : null;

      try {
        await db.insert(productsTable).values({ code: code.toUpperCase(), name, categoryId, description: description || null });
        existingCodes.add(code.toUpperCase());
        result.inserted++;
      } catch (e: any) {
        result.failed++;
        result.errors.push({ row: i + 2, reason: e.message?.includes("unique") ? `Duplicate code "${code}"` : "Database error" });
      }
    }
    await logAudit(req, "IMPORT", "products", "", `Imported ${result.inserted}/${result.total} products`);
  } catch (e: any) {
    return res.status(400).json({ error: `Failed to parse file: ${e.message}` });
  }
  res.json(result);
});

// ========== COLORS ==========
router.post("/import/colors", requireAdmin, upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded." });
  const result: ImportResult = { total: 0, inserted: 0, failed: 0, errors: [] };

  try {
    const rawRows = parseFile(req.file.buffer, req.file.mimetype);
    const rows = normalizeHeaders(rawRows);
    result.total = rows.length;

    const existing = await db.select({ code: colorsTable.code }).from(colorsTable);
    const existingCodes = new Set(existing.map((c) => c.code?.toUpperCase()).filter(Boolean));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const code = row.code || row.colorcode || "";
      const name = row.name || row.colorname || "";

      if (!code) { result.failed++; result.errors.push({ row: i + 2, reason: "Missing code" }); continue; }
      if (!name) { result.failed++; result.errors.push({ row: i + 2, reason: "Missing name" }); continue; }
      if (existingCodes.has(code.toUpperCase())) { result.failed++; result.errors.push({ row: i + 2, reason: `Duplicate code "${code}"` }); continue; }

      try {
        await db.insert(colorsTable).values({ code: code.toUpperCase(), name });
        existingCodes.add(code.toUpperCase());
        result.inserted++;
      } catch (e: any) {
        result.failed++;
        result.errors.push({ row: i + 2, reason: e.message?.includes("unique") ? `Duplicate code "${code}"` : "Database error" });
      }
    }
    await logAudit(req, "IMPORT", "colors", "", `Imported ${result.inserted}/${result.total} colors`);
  } catch (e: any) {
    return res.status(400).json({ error: `Failed to parse file: ${e.message}` });
  }
  res.json(result);
});

// ========== SIZES ==========
router.post("/import/sizes", requireAdmin, upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded." });
  const result: ImportResult = { total: 0, inserted: 0, failed: 0, errors: [] };

  try {
    const rawRows = parseFile(req.file.buffer, req.file.mimetype);
    const rows = normalizeHeaders(rawRows);
    result.total = rows.length;

    const existing = await db.select({ name: sizesTable.name }).from(sizesTable);
    const existingNames = new Set(existing.map((s) => s.name.toUpperCase()));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = row.name || row.sizename || row.size || "";
      const sortOrder = row.sortorder || row.order || "";

      if (!name) { result.failed++; result.errors.push({ row: i + 2, reason: "Missing name" }); continue; }
      if (existingNames.has(name.toUpperCase())) { result.failed++; result.errors.push({ row: i + 2, reason: `Size "${name}" already exists` }); continue; }

      try {
        await db.insert(sizesTable).values({ name, sortOrder: sortOrder ? Number(sortOrder) : 0 });
        existingNames.add(name.toUpperCase());
        result.inserted++;
      } catch (e: any) {
        result.failed++;
        result.errors.push({ row: i + 2, reason: e.message?.includes("unique") ? `Duplicate "${name}"` : "Database error" });
      }
    }
    await logAudit(req, "IMPORT", "sizes", "", `Imported ${result.inserted}/${result.total} sizes`);
  } catch (e: any) {
    return res.status(400).json({ error: `Failed to parse file: ${e.message}` });
  }
  res.json(result);
});

// ========== MATERIALS ==========
router.post("/import/materials", requireAdmin, upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded." });
  const result: ImportResult = { total: 0, inserted: 0, failed: 0, errors: [] };

  try {
    const rawRows = parseFile(req.file.buffer, req.file.mimetype);
    const rows = normalizeHeaders(rawRows);
    result.total = rows.length;

    const existing = await db.select({ code: materialsTable.code }).from(materialsTable);
    const existingCodes = new Set(existing.map((m) => m.code.toUpperCase()));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const code = row.code || row.materialcode || "";
      const name = row.name || row.materialname || "";
      const description = row.description || "";

      if (!code) { result.failed++; result.errors.push({ row: i + 2, reason: "Missing code" }); continue; }
      if (!name) { result.failed++; result.errors.push({ row: i + 2, reason: "Missing name" }); continue; }
      if (existingCodes.has(code.toUpperCase())) { result.failed++; result.errors.push({ row: i + 2, reason: `Duplicate code "${code}"` }); continue; }

      try {
        await db.insert(materialsTable).values({ code: code.toUpperCase(), name, description: description || null });
        existingCodes.add(code.toUpperCase());
        result.inserted++;
      } catch (e: any) {
        result.failed++;
        result.errors.push({ row: i + 2, reason: e.message?.includes("unique") ? `Duplicate code "${code}"` : "Database error" });
      }
    }
    await logAudit(req, "IMPORT", "materials", "", `Imported ${result.inserted}/${result.total} materials`);
  } catch (e: any) {
    return res.status(400).json({ error: `Failed to parse file: ${e.message}` });
  }
  res.json(result);
});

// ========== STITCHERS ==========
router.post("/import/stitchers", requireAdmin, upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded." });
  const result: ImportResult = { total: 0, inserted: 0, failed: 0, errors: [] };

  try {
    const rawRows = parseFile(req.file.buffer, req.file.mimetype);
    const rows = normalizeHeaders(rawRows);
    result.total = rows.length;

    const teams = await db.select({ id: teamsTable.id, name: teamsTable.name }).from(teamsTable);
    const teamMap = new Map(teams.map((t) => [t.name.toUpperCase(), t.id]));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = row.name || row.stitchername || "";
      const code = row.code || row.stitchercode || "";
      const phone = row.phone || "";
      const team = row.team || row.teamname || "";

      if (!name) { result.failed++; result.errors.push({ row: i + 2, reason: "Missing name" }); continue; }

      const teamId = team ? teamMap.get(team.toUpperCase()) || null : null;
      if (team && !teamId) { result.failed++; result.errors.push({ row: i + 2, reason: `Team "${team}" not found` }); continue; }

      try {
        await db.insert(stitchersTable).values({
          name, code: code || null, phone: phone || null, teamId
        });
        result.inserted++;
      } catch (e: any) {
        result.failed++;
        result.errors.push({ row: i + 2, reason: "Database error" });
      }
    }
    await logAudit(req, "IMPORT", "stitchers", "", `Imported ${result.inserted}/${result.total} stitchers`);
  } catch (e: any) {
    return res.status(400).json({ error: `Failed to parse file: ${e.message}` });
  }
  res.json(result);
});

// ========== TEAMS ==========
router.post("/import/teams", requireAdmin, upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded." });
  const result: ImportResult = { total: 0, inserted: 0, failed: 0, errors: [] };

  try {
    const rawRows = parseFile(req.file.buffer, req.file.mimetype);
    const rows = normalizeHeaders(rawRows);
    result.total = rows.length;

    const existing = await db.select({ name: teamsTable.name }).from(teamsTable);
    const existingNames = new Set(existing.map((t) => t.name.toUpperCase()));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = row.name || row.teamname || "";
      const code = row.code || row.teamcode || "";
      const supervisorName = row.supervisor || row.supervisorname || "";

      if (!name) { result.failed++; result.errors.push({ row: i + 2, reason: "Missing name" }); continue; }
      if (existingNames.has(name.toUpperCase())) { result.failed++; result.errors.push({ row: i + 2, reason: `Team "${name}" already exists` }); continue; }

      try {
        await db.insert(teamsTable).values({
          name, code: code ? code.toUpperCase() : null, supervisorName: supervisorName || null
        });
        existingNames.add(name.toUpperCase());
        result.inserted++;
      } catch (e: any) {
        result.failed++;
        result.errors.push({ row: i + 2, reason: e.message?.includes("unique") ? `Duplicate "${name}"` : "Database error" });
      }
    }
    await logAudit(req, "IMPORT", "teams", "", `Imported ${result.inserted}/${result.total} teams`);
  } catch (e: any) {
    return res.status(400).json({ error: `Failed to parse file: ${e.message}` });
  }
  res.json(result);
});

// ========== FABRIC ROLLS ==========
router.post("/import/fabric-rolls", requireAdmin, upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded." });
  const result: ImportResult = { total: 0, inserted: 0, failed: 0, errors: [] };

  try {
    const rawRows = parseFile(req.file.buffer, req.file.mimetype);
    const rows = normalizeHeaders(rawRows);
    result.total = rows.length;

    const existingRolls = await db.select({ rollNumber: fabricRollsTable.rollNumber }).from(fabricRollsTable);
    const existingRollNumbers = new Set(existingRolls.map((r) => r.rollNumber.toUpperCase()));

    const fabrics = await db.select({ id: fabricsTable.id, name: fabricsTable.name }).from(fabricsTable);
    const fabricMap = new Map(fabrics.map((f) => [f.name.toUpperCase(), f.id]));

    const colors = await db.select({ id: colorsTable.id, name: colorsTable.name, code: colorsTable.code }).from(colorsTable);
    const colorByName = new Map(colors.map((c) => [c.name.toUpperCase(), c.id]));
    const colorByCode = new Map(colors.filter((c) => c.code).map((c) => [c.code!.toUpperCase(), c.id]));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rollNumber = row.rollnumber || row.roll || "";
      const fabric = row.fabric || row.fabricname || row.fabrictype || "";
      const color = row.color || row.colorname || row.colorcode || "";
      const quantity = row.quantity || row.totalquantity || row.qty || "";
      const unit = row.unit || "meters";
      const supplier = row.supplier || "";
      const costPerUnit = row.costperunit || row.cost || "";
      const receivedDate = row.receiveddate || row.date || "";
      const remarks = row.remarks || "";

      if (!rollNumber) { result.failed++; result.errors.push({ row: i + 2, reason: "Missing roll number" }); continue; }
      if (!fabric) { result.failed++; result.errors.push({ row: i + 2, reason: "Missing fabric" }); continue; }
      if (!color) { result.failed++; result.errors.push({ row: i + 2, reason: "Missing color" }); continue; }
      if (!quantity || isNaN(Number(quantity))) { result.failed++; result.errors.push({ row: i + 2, reason: "Missing or invalid quantity" }); continue; }
      if (existingRollNumbers.has(rollNumber.toUpperCase())) { result.failed++; result.errors.push({ row: i + 2, reason: `Duplicate roll number "${rollNumber}"` }); continue; }

      const fabricId = fabricMap.get(fabric.toUpperCase());
      if (!fabricId) { result.failed++; result.errors.push({ row: i + 2, reason: `Fabric "${fabric}" not found` }); continue; }

      const colorId = colorByCode.get(color.toUpperCase()) || colorByName.get(color.toUpperCase());
      if (!colorId) { result.failed++; result.errors.push({ row: i + 2, reason: `Color "${color}" not found` }); continue; }

      let parsedDate: Date;
      if (receivedDate) {
        parsedDate = new Date(receivedDate);
        if (isNaN(parsedDate.getTime())) { result.failed++; result.errors.push({ row: i + 2, reason: `Invalid date "${receivedDate}"` }); continue; }
      } else {
        parsedDate = new Date();
      }

      try {
        await db.insert(fabricRollsTable).values({
          rollNumber,
          fabricId,
          colorId,
          supplier: supplier || null,
          totalQuantity: String(quantity),
          availableQuantity: String(quantity),
          unit: unit || "meters",
          costPerUnit: costPerUnit ? String(costPerUnit) : null,
          receivedDate: parsedDate,
          remarks: remarks || null,
          createdBy: (req as any).user?.username,
        });
        existingRollNumbers.add(rollNumber.toUpperCase());
        result.inserted++;
      } catch (e: any) {
        result.failed++;
        result.errors.push({ row: i + 2, reason: e.message?.includes("unique") ? `Duplicate roll "${rollNumber}"` : "Database error" });
      }
    }
    await logAudit(req, "IMPORT", "fabric_rolls", "", `Imported ${result.inserted}/${result.total} fabric rolls`);
  } catch (e: any) {
    return res.status(400).json({ error: `Failed to parse file: ${e.message}` });
  }
  res.json(result);
});

// ========== TEMPLATE DOWNLOADS ==========
const TEMPLATES: Record<string, { columns: string[]; sample: Record<string, string>[] }> = {
  products: {
    columns: ["code", "name", "category", "description"],
    sample: [
      { code: "101", name: "Classic Abaya", category: "Premium", description: "Premium quality" },
      { code: "102", name: "Modern Cut", category: "Standard", description: "" },
    ],
  },
  colors: {
    columns: ["code", "name"],
    sample: [
      { code: "BLK", name: "Black" },
      { code: "NVY", name: "Navy Blue" },
    ],
  },
  sizes: {
    columns: ["name", "sortOrder"],
    sample: [
      { name: "52", sortOrder: "1" },
      { name: "54", sortOrder: "2" },
      { name: "56", sortOrder: "3" },
    ],
  },
  materials: {
    columns: ["code", "name", "description"],
    sample: [
      { code: "LC01", name: "Lace", description: "Decorative lace" },
      { code: "DR01", name: "Dori", description: "Thread dori" },
    ],
  },
  stitchers: {
    columns: ["name", "code", "phone", "team"],
    sample: [
      { name: "Ahmed Ali", code: "STR01", phone: "0501234567", team: "Team Alpha" },
      { name: "Khalid Omar", code: "STR02", phone: "", team: "" },
    ],
  },
  teams: {
    columns: ["name", "code", "supervisor"],
    sample: [
      { name: "Team Alpha", code: "TMA", supervisor: "Ibrahim" },
      { name: "Team Bravo", code: "TMB", supervisor: "" },
    ],
  },
  "fabric-rolls": {
    columns: ["rollNumber", "fabric", "color", "quantity", "unit", "supplier", "costPerUnit", "receivedDate", "remarks"],
    sample: [
      { rollNumber: "FR-001", fabric: "Nida", color: "Black", quantity: "100", unit: "meters", supplier: "Supplier A", costPerUnit: "15", receivedDate: "2026-01-15", remarks: "" },
      { rollNumber: "FR-002", fabric: "Crepe", color: "Navy Blue", quantity: "50", unit: "yards", supplier: "", costPerUnit: "", receivedDate: "2026-02-01", remarks: "Premium fabric" },
    ],
  },
};

router.get("/import/template/:module", (req: Request, res: Response) => {
  const mod = req.params.module;
  const template = TEMPLATES[mod];
  if (!template) return res.status(404).json({ error: `No template for "${mod}"` });

  const ws = XLSX.utils.json_to_sheet(template.sample, { header: template.columns });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Disposition", `attachment; filename=${mod}_template.xlsx`);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buf);
});

export default router;
