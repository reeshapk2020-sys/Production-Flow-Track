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
  cuttingBatchesTable,
  purchaseOrdersTable,
  ordersTable,
} from "@workspace/db/schema";
import { eq, ilike } from "drizzle-orm";
import { logAudit } from "../lib/audit.js";
import { checkPermission } from "./permissions.js";
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
router.post("/import/products", checkPermission("products", "import"), upload.single("file"), async (req: Request, res: Response) => {
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
router.post("/import/colors", checkPermission("colors", "import"), upload.single("file"), async (req: Request, res: Response) => {
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
router.post("/import/sizes", checkPermission("sizes", "import"), upload.single("file"), async (req: Request, res: Response) => {
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
router.post("/import/materials", checkPermission("materials", "import"), upload.single("file"), async (req: Request, res: Response) => {
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
router.post("/import/stitchers", checkPermission("stitchers", "import"), upload.single("file"), async (req: Request, res: Response) => {
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
router.post("/import/teams", checkPermission("teams", "import"), upload.single("file"), async (req: Request, res: Response) => {
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
router.post("/import/fabric-rolls", checkPermission("fabric-rolls", "import"), upload.single("file"), async (req: Request, res: Response) => {
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

// ========== CUTTING BATCHES ==========
router.post("/import/cutting-batches", checkPermission("cutting", "import"), upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded." });
  const result: ImportResult = { total: 0, inserted: 0, failed: 0, errors: [] };

  try {
    const rawRows = parseFile(req.file.buffer, req.file.mimetype);
    const rows = normalizeHeaders(rawRows);
    result.total = rows.length;

    const existingBatches = await db.select({ batchNumber: cuttingBatchesTable.batchNumber }).from(cuttingBatchesTable);
    const existingBatchNumbers = new Set(existingBatches.map((b) => b.batchNumber.toUpperCase()));

    const products = await db.select({ id: productsTable.id, code: productsTable.code, name: productsTable.name }).from(productsTable);
    const productByCode = new Map(products.map((p) => [p.code.toUpperCase(), p]));
    const productByName = new Map(products.map((p) => [p.name.toUpperCase(), p]));

    const colors = await db.select({ id: colorsTable.id, name: colorsTable.name, code: colorsTable.code }).from(colorsTable);
    const colorByName = new Map(colors.map((c) => [c.name.toUpperCase(), c.id]));
    const colorByCode = new Map(colors.filter((c) => c.code).map((c) => [c.code!.toUpperCase(), c.id]));

    const sizes = await db.select({ id: sizesTable.id, name: sizesTable.name }).from(sizesTable);
    const sizeByName = new Map(sizes.map((s) => [s.name.toUpperCase(), s.id]));

    const mats = await db.select({ id: materialsTable.id, code: materialsTable.code, name: materialsTable.name }).from(materialsTable);
    const matByCode = new Map(mats.map((m) => [m.code.toUpperCase(), m.id]));
    const matByName = new Map(mats.map((m) => [m.name.toUpperCase(), m.id]));

    const pos = await db.select({ id: purchaseOrdersTable.id, poNumber: purchaseOrdersTable.poNumber }).from(purchaseOrdersTable);
    const poByNumber = new Map(pos.map((p) => [p.poNumber.toUpperCase(), p.id]));

    const ords = await db.select({ id: ordersTable.id, orderNumber: ordersTable.orderNumber }).from(ordersTable);
    const orderByNumber = new Map(ords.map((o) => [o.orderNumber.toUpperCase(), o.id]));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const batchNumber = row.batchnumber || row.batch || row.batchno || "";
      const itemCode = row.itemcode || row.item_code || row.code || "";
      const productName = row.productname || row.product || "";
      const color = row.color || row.colorname || row.colorcode || "";
      const size = row.size || row.sizename || "";
      const quantity = row.quantity || row.qty || row.quantitycut || "";
      const cutter = row.cutter || row.cuttername || "";
      const dateStr = row.date || row.cuttingdate || "";
      const remarks = row.remarks || row.remark || "";
      const productionForRaw = row.productionfor || row.production || row.prodfor || "";
      const poNumber = row.ponumber || row.po || "";
      const orderNumber = row.ordernumber || row.order || "";

      if (!batchNumber) { result.failed++; result.errors.push({ row: i + 2, reason: "Missing batch number" }); continue; }
      if (!quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) { result.failed++; result.errors.push({ row: i + 2, reason: "Missing or invalid quantity (must be positive)" }); continue; }
      if (!size) { result.failed++; result.errors.push({ row: i + 2, reason: "Missing size" }); continue; }

      if (existingBatchNumbers.has(batchNumber.toUpperCase())) {
        result.failed++; result.errors.push({ row: i + 2, reason: `Duplicate batch number "${batchNumber}"` }); continue;
      }

      let productId: number | null = null;
      let materialId: number | null = null;
      let material2Id: number | null = null;

      let resolvedColor = color;

      if (itemCode) {
        const parts = itemCode.split("-");
        if (parts.length >= 1 && parts[0]) {
          const p = productByCode.get(parts[0].toUpperCase());
          if (p) productId = p.id;
          else { result.failed++; result.errors.push({ row: i + 2, reason: `Product code "${parts[0]}" from itemCode not found` }); continue; }
        }
        if (parts.length >= 2 && parts[1]) {
          if (!resolvedColor) {
            resolvedColor = parts[1];
          }
        }
        if (parts.length >= 3 && parts[2]) {
          materialId = matByCode.get(parts[2].toUpperCase()) || null;
        }
        if (parts.length >= 4 && parts[3]) {
          material2Id = matByCode.get(parts[3].toUpperCase()) || null;
        }
      } else if (productName) {
        const p = productByName.get(productName.toUpperCase()) || productByCode.get(productName.toUpperCase());
        if (p) productId = p.id;
      }

      if (!resolvedColor) { result.failed++; result.errors.push({ row: i + 2, reason: "Missing color (provide in color column or itemCode)" }); continue; }
      const colorId = colorByCode.get(resolvedColor.toUpperCase()) || colorByName.get(resolvedColor.toUpperCase());
      if (!colorId) { result.failed++; result.errors.push({ row: i + 2, reason: `Color "${resolvedColor}" not found` }); continue; }

      const sizeId = sizeByName.get(size.toUpperCase());
      if (!sizeId) { result.failed++; result.errors.push({ row: i + 2, reason: `Size "${size}" not found` }); continue; }

      let productionFor = "reesha_stock";
      let poId: number | null = null;
      let orderId: number | null = null;

      const pfLower = productionForRaw.toLowerCase().replace(/\s+/g, "_");
      if (pfLower === "po" || pfLower === "purchase_order" || pfLower === "purchaseorder") {
        productionFor = "purchase_order";
      } else if (pfLower === "order" || pfLower === "customer_order" || pfLower === "customerorder") {
        productionFor = "order";
      } else if (pfLower === "reesha" || pfLower === "reesha_stock" || pfLower === "stock" || pfLower === "") {
        productionFor = "reesha_stock";
      } else {
        result.failed++; result.errors.push({ row: i + 2, reason: `Invalid productionFor "${productionForRaw}". Use Reesha, PO, or Order.` }); continue;
      }

      if (productionFor === "purchase_order") {
        if (!poNumber) { result.failed++; result.errors.push({ row: i + 2, reason: "PO number required when productionFor is PO" }); continue; }
        poId = poByNumber.get(poNumber.toUpperCase()) || null;
        if (!poId) { result.failed++; result.errors.push({ row: i + 2, reason: `Purchase order "${poNumber}" not found` }); continue; }
      }
      if (productionFor === "order") {
        if (!orderNumber) { result.failed++; result.errors.push({ row: i + 2, reason: "Order number required when productionFor is Order" }); continue; }
        orderId = orderByNumber.get(orderNumber.toUpperCase()) || null;
        if (!orderId) { result.failed++; result.errors.push({ row: i + 2, reason: `Order "${orderNumber}" not found` }); continue; }
      }
      if (productionFor === "reesha_stock" && (poNumber || orderNumber)) {
        result.failed++; result.errors.push({ row: i + 2, reason: "PO/Order number should be empty when productionFor is Reesha" }); continue;
      }

      let parsedDate: Date;
      if (dateStr) {
        parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime())) { result.failed++; result.errors.push({ row: i + 2, reason: `Invalid date "${dateStr}"` }); continue; }
      } else {
        parsedDate = new Date();
      }

      try {
        await db.insert(cuttingBatchesTable).values({
          batchNumber: batchNumber.trim(),
          productId,
          fabricId: null,
          materialId,
          material2Id,
          sizeId,
          colorId,
          quantityCut: Number(quantity),
          availableForAllocation: Number(quantity),
          cutter: cutter || null,
          cuttingDate: parsedDate,
          remarks: remarks || null,
          productionFor,
          poId,
          orderId,
          createdBy: (req as any).user?.username,
        });
        existingBatchNumbers.add(batchNumber.toUpperCase());
        result.inserted++;
      } catch (e: any) {
        result.failed++;
        result.errors.push({ row: i + 2, reason: e.message?.includes("unique") ? `Duplicate batch "${batchNumber}"` : "Database error" });
      }
    }
    await logAudit(req, "IMPORT", "cutting_batches", "", `Imported ${result.inserted}/${result.total} cutting batches`);
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
  "cutting-batches": {
    columns: ["batchNumber", "itemCode", "productName", "color", "size", "quantity", "productionFor", "poNumber", "orderNumber", "cutter", "date", "remarks"],
    sample: [
      { batchNumber: "CB-001", itemCode: "101-BLK-LC01", productName: "", color: "Black", size: "52", quantity: "20", productionFor: "Reesha", poNumber: "", orderNumber: "", cutter: "Ahmed", date: "2026-03-15", remarks: "" },
      { batchNumber: "CB-002", itemCode: "", productName: "Classic Abaya", color: "Navy Blue", size: "54", quantity: "15", productionFor: "PO", poNumber: "PO-001", orderNumber: "", cutter: "", date: "2026-03-16", remarks: "For customer order" },
      { batchNumber: "CB-003", itemCode: "102-NVY", productName: "", color: "", size: "56", quantity: "10", productionFor: "Order", poNumber: "", orderNumber: "ORD-001", cutter: "Khalid", date: "", remarks: "Color from itemCode" },
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
