import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  dispatchesTable,
  finishedGoodsTable,
  openingFinishedGoodsTable,
  cuttingBatchesTable,
  productsTable,
  materialsTable,
  sizesTable,
  colorsTable,
  purchaseOrdersTable,
  ordersTable,
} from "@workspace/db/schema";
import { eq, sql, and, gte, lte, ilike } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { logAudit } from "../lib/audit.js";
import { checkPermission } from "./permissions.js";
import { computeItemCode } from "../lib/itemCode.js";

const mat1 = alias(materialsTable, "mat1");
const mat2 = alias(materialsTable, "mat2");

const router: IRouter = Router();

async function generateDispatchNumber(): Promise<string> {
  const [last] = await db
    .select({ dispatchNumber: dispatchesTable.dispatchNumber })
    .from(dispatchesTable)
    .orderBy(sql`${dispatchesTable.id} desc`)
    .limit(1);
  if (!last) return "DSP-0001";
  const match = last.dispatchNumber.match(/DSP-(\d+)/);
  const next = match ? parseInt(match[1]) + 1 : 1;
  return `DSP-${String(next).padStart(4, "0")}`;
}

async function getAvailableStockByItemCode(): Promise<Map<string, number>> {
  const normalize = (s: string | null | undefined) => (s || "").trim().toLowerCase();

  const producedRows = await db
    .select({
      productCode: productsTable.code,
      colorCode: colorsTable.code,
      materialCode: mat1.code,
      material2Code: mat2.code,
      qty: sql<number>`SUM(${finishedGoodsTable.quantity})::int`,
    })
    .from(finishedGoodsTable)
    .leftJoin(cuttingBatchesTable, eq(finishedGoodsTable.cuttingBatchId, cuttingBatchesTable.id))
    .leftJoin(productsTable, eq(cuttingBatchesTable.productId, productsTable.id))
    .leftJoin(sizesTable, eq(cuttingBatchesTable.sizeId, sizesTable.id))
    .leftJoin(colorsTable, eq(cuttingBatchesTable.colorId, colorsTable.id))
    .leftJoin(mat1, eq(cuttingBatchesTable.materialId, mat1.id))
    .leftJoin(mat2, eq(cuttingBatchesTable.material2Id, mat2.id))
    .groupBy(productsTable.code, colorsTable.code, mat1.code, mat2.code);

  const openingRows = await db
    .select({
      itemCode: openingFinishedGoodsTable.itemCode,
      productCode: openingFinishedGoodsTable.productCode,
      colorName: openingFinishedGoodsTable.colorName,
      sizeName: openingFinishedGoodsTable.sizeName,
      qty: sql<number>`SUM(${openingFinishedGoodsTable.quantity})::int`,
    })
    .from(openingFinishedGoodsTable)
    .where(sql`${openingFinishedGoodsTable.stockStage} = 'finished_goods'`)
    .groupBy(
      openingFinishedGoodsTable.itemCode,
      openingFinishedGoodsTable.productCode,
      openingFinishedGoodsTable.colorName,
      openingFinishedGoodsTable.sizeName
    );

  const dispatchedRows = await db
    .select({
      itemCode: dispatchesTable.itemCode,
      qty: sql<number>`SUM(${dispatchesTable.quantity})::int`,
    })
    .from(dispatchesTable)
    .groupBy(dispatchesTable.itemCode);

  const stockMap = new Map<string, number>();

  for (const r of producedRows) {
    const itemCode = computeItemCode(r.productCode, r.colorCode, r.materialCode, r.material2Code);
    const key = normalize(itemCode);
    stockMap.set(key, (stockMap.get(key) || 0) + r.qty);
  }

  for (const r of openingRows) {
    const key = normalize(r.itemCode);
    stockMap.set(key, (stockMap.get(key) || 0) + r.qty);
  }

  for (const r of dispatchedRows) {
    const key = normalize(r.itemCode);
    const current = stockMap.get(key) || 0;
    stockMap.set(key, current - r.qty);
  }

  return stockMap;
}

router.get("/dispatch", checkPermission("dispatch", "view"), async (req: Request, res: Response) => {
  const { dispatchNumber, itemCode, startDate, endDate, destinationType, poId, orderId, deliveryStatus } = req.query;
  const conditions: any[] = [];
  if (dispatchNumber) conditions.push(ilike(dispatchesTable.dispatchNumber, `%${dispatchNumber}%`));
  if (itemCode) conditions.push(ilike(dispatchesTable.itemCode, `%${itemCode}%`));
  if (startDate) conditions.push(gte(dispatchesTable.dispatchDate, new Date(startDate as string)));
  if (endDate) { const ed = new Date(endDate as string); ed.setDate(ed.getDate() + 1); conditions.push(lte(dispatchesTable.dispatchDate, ed)); }
  if (destinationType) conditions.push(eq(dispatchesTable.destinationType, destinationType as any));
  if (poId) conditions.push(eq(dispatchesTable.poId, Number(poId)));
  if (orderId) conditions.push(eq(dispatchesTable.orderId, Number(orderId)));
  if (deliveryStatus) conditions.push(eq(dispatchesTable.deliveryStatus, deliveryStatus as any));

  let q = db
    .select({
      id: dispatchesTable.id,
      dispatchNumber: dispatchesTable.dispatchNumber,
      dispatchDate: dispatchesTable.dispatchDate,
      itemCode: dispatchesTable.itemCode,
      productCode: dispatchesTable.productCode,
      productName: dispatchesTable.productName,
      sizeName: dispatchesTable.sizeName,
      colorName: dispatchesTable.colorName,
      quantity: dispatchesTable.quantity,
      destinationType: dispatchesTable.destinationType,
      poId: dispatchesTable.poId,
      orderId: dispatchesTable.orderId,
      poNumber: purchaseOrdersTable.poNumber,
      orderNumber: ordersTable.orderNumber,
      customerName: dispatchesTable.customerName,
      deliveryStatus: dispatchesTable.deliveryStatus,
      deliveryDate: dispatchesTable.deliveryDate,
      remarks: dispatchesTable.remarks,
      createdBy: dispatchesTable.createdBy,
      createdAt: dispatchesTable.createdAt,
    })
    .from(dispatchesTable)
    .leftJoin(purchaseOrdersTable, eq(dispatchesTable.poId, purchaseOrdersTable.id))
    .leftJoin(ordersTable, eq(dispatchesTable.orderId, ordersTable.id))
    .$dynamic();

  if (conditions.length > 0) q = q.where(and(...conditions));
  const rows = await q.orderBy(sql`${dispatchesTable.createdAt} desc`);
  res.json(rows);
});

router.get("/dispatch/available-stock", checkPermission("dispatch", "view"), async (_req: Request, res: Response) => {
  const stockMap = await getAvailableStockByItemCode();
  const result: Array<{ itemCode: string; available: number }> = [];
  for (const [itemCode, available] of stockMap.entries()) {
    if (available > 0) result.push({ itemCode, available });
  }
  result.sort((a, b) => a.itemCode.localeCompare(b.itemCode));
  res.json(result);
});

router.post("/dispatch", checkPermission("dispatch", "create"), async (req: Request, res: Response) => {
  const {
    dispatchDate, itemCode, productCode, productName, sizeName, colorName,
    quantity, destinationType, poId, orderId, customerName, remarks,
  } = req.body;

  if (!itemCode || !quantity || quantity <= 0) {
    return res.status(400).json({ error: "itemCode and a positive quantity are required." });
  }
  if (!dispatchDate) {
    return res.status(400).json({ error: "dispatchDate is required." });
  }

  const validDest = ["reesha", "purchase_order", "order"];
  const dest = destinationType || "reesha";
  if (!validDest.includes(dest)) {
    return res.status(400).json({ error: "Invalid destination type." });
  }
  if (dest === "purchase_order" && !poId) {
    return res.status(400).json({ error: "PO is required for purchase_order destination." });
  }
  if (dest === "order" && !orderId) {
    return res.status(400).json({ error: "Order is required for order destination." });
  }

  const stockMap = await getAvailableStockByItemCode();
  const normalizedCode = (itemCode as string).trim().toLowerCase();
  const available = stockMap.get(normalizedCode) || 0;
  if (quantity > available) {
    return res.status(400).json({
      error: `Insufficient stock. Available: ${available}, Requested: ${quantity}`,
    });
  }

  const dispatchNumber = await generateDispatchNumber();

  const [row] = await db.insert(dispatchesTable).values({
    dispatchNumber,
    dispatchDate: new Date(dispatchDate),
    itemCode: (itemCode as string).trim(),
    productCode: productCode ? String(productCode).trim() : null,
    productName: productName ? String(productName).trim() : null,
    sizeName: sizeName ? String(sizeName).trim() : null,
    colorName: colorName ? String(colorName).trim() : null,
    quantity: Number(quantity),
    destinationType: dest as any,
    poId: poId ? Number(poId) : null,
    orderId: orderId ? Number(orderId) : null,
    customerName: customerName ? String(customerName).trim() : null,
    deliveryStatus: "pending",
    remarks: remarks || null,
    createdBy: (req as any).user?.username || null,
  }).returning();

  await logAudit(req, "CREATE", "dispatches", String(row.id), `Dispatch ${dispatchNumber}: ${itemCode} x${quantity}`);
  res.status(201).json(row);
});

router.put("/dispatch/:id", checkPermission("dispatch", "edit"), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const { deliveryStatus, deliveryDate, remarks, customerName } = req.body;
  const updates: Record<string, any> = {};

  if (deliveryStatus !== undefined) {
    const validStatuses = ["pending", "dispatched", "delivered"];
    if (!validStatuses.includes(deliveryStatus)) {
      return res.status(400).json({ error: "Invalid delivery status." });
    }
    updates.deliveryStatus = deliveryStatus;
  }
  if (deliveryDate !== undefined) updates.deliveryDate = deliveryDate ? new Date(deliveryDate) : null;
  if (remarks !== undefined) updates.remarks = remarks || null;
  if (customerName !== undefined) updates.customerName = customerName || null;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No fields to update." });
  }

  const [row] = await db.update(dispatchesTable).set(updates).where(eq(dispatchesTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Dispatch not found." });
  await logAudit(req, "UPDATE", "dispatches", String(id), `Updated dispatch #${id}`);
  res.json(row);
});

router.post("/dispatch/import", checkPermission("dispatch", "create"), async (req: Request, res: Response) => {
  const { rows: importRows } = req.body;
  if (!Array.isArray(importRows) || importRows.length === 0) {
    return res.status(400).json({ error: "No rows provided." });
  }
  if (importRows.length > 500) {
    return res.status(400).json({ error: "Maximum 500 rows per import." });
  }

  const stockMap = await getAvailableStockByItemCode();
  const normalize = (s: string | null | undefined) => (s || "").trim().toLowerCase();
  const validDest = ["reesha", "purchase_order", "order"];
  const errors: Array<{ row: number; error: string }> = [];
  const validRows: any[] = [];
  const tempStock = new Map(stockMap);

  const knownItemCodes = new Set(stockMap.keys());

  for (let i = 0; i < importRows.length; i++) {
    const r = importRows[i];
    const rowNum = i + 2;

    const rawItemCode = r.itemCode ? String(r.itemCode).trim() : "";
    const rawQty = r.quantity ? Number(r.quantity) : 0;

    if (!rawItemCode) { errors.push({ row: rowNum, error: "itemCode is required" }); continue; }
    if (!rawQty || rawQty <= 0) { errors.push({ row: rowNum, error: "quantity must be a positive number" }); continue; }
    if (!r.dispatchDate) { errors.push({ row: rowNum, error: "dispatchDate is required" }); continue; }

    const dest = r.destinationType ? String(r.destinationType).trim() : "reesha";
    if (!validDest.includes(dest)) { errors.push({ row: rowNum, error: `Invalid destinationType "${dest}". Must be: reesha, purchase_order, or order` }); continue; }

    const itemKey = normalize(rawItemCode);

    if (!knownItemCodes.has(itemKey)) {
      errors.push({ row: rowNum, error: `Item code "${rawItemCode}" not found in system. Check spelling or format (e.g. PROD-COLOR-MAT1-MAT2)` });
      continue;
    }

    const available = tempStock.get(itemKey) || 0;

    if (rawQty > available) {
      errors.push({ row: rowNum, error: `Insufficient stock for "${rawItemCode}". Available: ${Math.max(0, available)}, Requested: ${rawQty}` });
      continue;
    }

    tempStock.set(itemKey, available - rawQty);
    validRows.push({ ...r, itemCode: rawItemCode, quantity: rawQty, destinationType: dest });
  }

  if (validRows.length === 0 && errors.length > 0) {
    return res.status(400).json({ error: "All rows failed validation", errors, validCount: 0, errorCount: errors.length });
  }

  const created: any[] = [];
  for (const r of validRows) {
    const dispatchNumber = await generateDispatchNumber();
    const [row] = await db.insert(dispatchesTable).values({
      dispatchNumber,
      dispatchDate: new Date(r.dispatchDate),
      itemCode: r.itemCode,
      productCode: r.productCode ? String(r.productCode).trim() : null,
      productName: r.productName ? String(r.productName).trim() : null,
      sizeName: r.sizeName ? String(r.sizeName).trim() : null,
      colorName: r.colorName ? String(r.colorName).trim() : null,
      quantity: r.quantity,
      destinationType: r.destinationType as any,
      poId: r.poId ? Number(r.poId) : null,
      orderId: r.orderId ? Number(r.orderId) : null,
      customerName: r.customerName ? String(r.customerName).trim() : null,
      deliveryStatus: "pending",
      remarks: r.remarks || null,
      createdBy: (req as any).user?.username || null,
    }).returning();
    created.push(row);
  }

  await logAudit(req, "CREATE", "dispatches", "bulk", `Imported ${created.length} dispatch records${errors.length > 0 ? `, ${errors.length} rows skipped` : ""}`);
  res.status(errors.length > 0 ? 207 : 201).json({
    imported: created.length,
    skipped: errors.length,
    errors: errors.length > 0 ? errors : undefined,
    records: created,
  });
});

router.delete("/dispatch/:id", checkPermission("dispatch", "edit"), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const [row] = await db.delete(dispatchesTable).where(eq(dispatchesTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Dispatch not found." });
  await logAudit(req, "DELETE", "dispatches", String(id), `Deleted dispatch ${row.dispatchNumber}`);
  res.json({ success: true });
});

router.get("/dispatch/reports/summary", checkPermission("dispatch", "view"), async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  const conditions: any[] = [];
  if (startDate) conditions.push(gte(dispatchesTable.dispatchDate, new Date(startDate as string)));
  if (endDate) { const ed = new Date(endDate as string); ed.setDate(ed.getDate() + 1); conditions.push(lte(dispatchesTable.dispatchDate, ed)); }

  let q = db
    .select({
      destinationType: dispatchesTable.destinationType,
      deliveryStatus: dispatchesTable.deliveryStatus,
      totalQuantity: sql<number>`SUM(${dispatchesTable.quantity})::int`,
      totalRecords: sql<number>`COUNT(*)::int`,
    })
    .from(dispatchesTable)
    .$dynamic();

  if (conditions.length > 0) q = q.where(and(...conditions));
  const rows = await q.groupBy(dispatchesTable.destinationType, dispatchesTable.deliveryStatus);

  let totalDispatched = 0, totalPending = 0, totalDelivered = 0;
  const byDestination: Record<string, number> = {};

  for (const r of rows) {
    const qty = r.totalQuantity || 0;
    if (r.deliveryStatus === "delivered") totalDelivered += qty;
    else if (r.deliveryStatus === "dispatched") totalDispatched += qty;
    else totalPending += qty;
    byDestination[r.destinationType] = (byDestination[r.destinationType] || 0) + qty;
  }

  res.json({
    totalQuantity: totalPending + totalDispatched + totalDelivered,
    pending: totalPending,
    dispatched: totalDispatched,
    delivered: totalDelivered,
    byDestination,
  });
});

router.get("/dispatch/reports/by-item", checkPermission("dispatch", "view"), async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  const conditions: any[] = [];
  if (startDate) conditions.push(gte(dispatchesTable.dispatchDate, new Date(startDate as string)));
  if (endDate) { const ed = new Date(endDate as string); ed.setDate(ed.getDate() + 1); conditions.push(lte(dispatchesTable.dispatchDate, ed)); }

  let q = db
    .select({
      itemCode: dispatchesTable.itemCode,
      productName: dispatchesTable.productName,
      totalQuantity: sql<number>`SUM(${dispatchesTable.quantity})::int`,
      totalRecords: sql<number>`COUNT(*)::int`,
    })
    .from(dispatchesTable)
    .$dynamic();

  if (conditions.length > 0) q = q.where(and(...conditions));
  const rows = await q.groupBy(dispatchesTable.itemCode, dispatchesTable.productName).orderBy(dispatchesTable.itemCode);
  res.json(rows);
});

router.get("/dispatch/by-po/:poId", checkPermission("dispatch", "view"), async (req: Request, res: Response) => {
  const poId = parseInt(req.params.poId);
  const rows = await db.select().from(dispatchesTable).where(eq(dispatchesTable.poId, poId)).orderBy(sql`${dispatchesTable.createdAt} desc`);
  const summary = {
    totalDispatched: 0,
    totalDelivered: 0,
    totalPending: 0,
  };
  for (const r of rows) {
    if (r.deliveryStatus === "delivered") summary.totalDelivered += r.quantity;
    else if (r.deliveryStatus === "dispatched") summary.totalDispatched += r.quantity;
    else summary.totalPending += r.quantity;
  }
  res.json({ dispatches: rows, summary });
});

router.get("/dispatch/by-order/:orderId", checkPermission("dispatch", "view"), async (req: Request, res: Response) => {
  const orderId = parseInt(req.params.orderId);
  const rows = await db.select().from(dispatchesTable).where(eq(dispatchesTable.orderId, orderId)).orderBy(sql`${dispatchesTable.createdAt} desc`);
  const summary = {
    totalDispatched: 0,
    totalDelivered: 0,
    totalPending: 0,
  };
  for (const r of rows) {
    if (r.deliveryStatus === "delivered") summary.totalDelivered += r.quantity;
    else if (r.deliveryStatus === "dispatched") summary.totalDispatched += r.quantity;
    else summary.totalPending += r.quantity;
  }
  res.json({ dispatches: rows, summary });
});

export default router;
