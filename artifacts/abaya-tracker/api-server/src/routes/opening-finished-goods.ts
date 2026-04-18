import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { openingFinishedGoodsTable } from "@workspace/db/schema";
import { eq, sql, and, ilike } from "drizzle-orm";
import { logAudit } from "../lib/audit.js";
import { checkPermission } from "./permissions.js";

const router: IRouter = Router();

router.get("/opening-finished-goods", checkPermission("opening-finished-goods", "view"), async (req: Request, res: Response) => {
  const { itemCode, productCode, sizeName, colorName } = req.query;
  const conditions: any[] = [];
  if (itemCode) conditions.push(ilike(openingFinishedGoodsTable.itemCode, `%${itemCode}%`));
  if (productCode) conditions.push(ilike(openingFinishedGoodsTable.productCode, `%${productCode}%`));
  if (sizeName) conditions.push(ilike(openingFinishedGoodsTable.sizeName, `%${sizeName}%`));
  if (colorName) conditions.push(ilike(openingFinishedGoodsTable.colorName, `%${colorName}%`));

  let q = db.select().from(openingFinishedGoodsTable).$dynamic();
  if (conditions.length > 0) q = q.where(and(...conditions));
  const rows = await q.orderBy(sql`${openingFinishedGoodsTable.createdAt} desc`);
  res.json(rows);
});

router.post("/opening-finished-goods", checkPermission("opening-finished-goods", "create"), async (req: Request, res: Response) => {
  const { itemCode, productCode, productName, sizeName, colorName, quantity, stockStage, remarks } = req.body;
  if (!itemCode || !quantity || quantity <= 0) {
    return res.status(400).json({ error: "itemCode and a positive quantity are required." });
  }
  const validStages = ["finishing", "finished_goods"];
  const stage = validStages.includes(stockStage) ? stockStage : "finished_goods";
  const [row] = await db.insert(openingFinishedGoodsTable).values({
    itemCode: String(itemCode).trim(),
    productCode: productCode ? String(productCode).trim() : null,
    productName: productName ? String(productName).trim() : null,
    sizeName: sizeName ? String(sizeName).trim() : null,
    colorName: colorName ? String(colorName).trim() : null,
    quantity: Number(quantity),
    stockStage: stage,
    remarks: remarks || null,
    enteredBy: (req as any).user?.username || null,
  }).returning();
  await logAudit(req, "CREATE", "opening_finished_goods", String(row.id), `Added opening stock: ${itemCode} x${quantity} [${stage}]`);
  res.status(201).json(row);
});

router.put("/opening-finished-goods/:id", checkPermission("opening-finished-goods", "edit"), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const { itemCode, productCode, productName, sizeName, colorName, quantity, stockStage, remarks } = req.body;
  const updates: Record<string, any> = {};
  if (itemCode !== undefined) updates.itemCode = String(itemCode).trim();
  if (productCode !== undefined) updates.productCode = productCode ? String(productCode).trim() : null;
  if (productName !== undefined) updates.productName = productName ? String(productName).trim() : null;
  if (sizeName !== undefined) updates.sizeName = sizeName ? String(sizeName).trim() : null;
  if (colorName !== undefined) updates.colorName = colorName ? String(colorName).trim() : null;
  if (quantity !== undefined) {
    if (quantity <= 0) return res.status(400).json({ error: "Quantity must be positive." });
    updates.quantity = Number(quantity);
  }
  if (stockStage !== undefined) {
    const validStages = ["finishing", "finished_goods"];
    if (validStages.includes(stockStage)) updates.stockStage = stockStage;
  }
  if (remarks !== undefined) updates.remarks = remarks || null;

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No fields to update." });

  const [row] = await db.update(openingFinishedGoodsTable).set(updates).where(eq(openingFinishedGoodsTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Entry not found." });
  await logAudit(req, "UPDATE", "opening_finished_goods", String(id), `Updated opening stock #${id}`);
  res.json(row);
});

router.delete("/opening-finished-goods/:id", checkPermission("opening-finished-goods", "edit"), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const [row] = await db.delete(openingFinishedGoodsTable).where(eq(openingFinishedGoodsTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Entry not found." });
  await logAudit(req, "DELETE", "opening_finished_goods", String(id), `Deleted opening stock #${id}`);
  res.json({ success: true });
});

router.get("/opening-finished-goods/template", checkPermission("opening-finished-goods", "view"), (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=opening_finished_goods_template.csv");
  res.send("itemCode,productCode,productName,sizeName,colorName,quantity,stockStage,remarks\nABY-BLK-SLK,ABY,Black Abaya,L,Black,10,finished_goods,Old stock\n");
});

router.post("/opening-finished-goods/import", checkPermission("opening-finished-goods", "import"), async (req: Request, res: Response) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: "No rows provided." });
  }

  const errors: Array<{ row: number; message: string }> = [];
  const validRows: Array<any> = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 1;
    if (!r.itemCode || !String(r.itemCode).trim()) {
      errors.push({ row: rowNum, message: "itemCode is required." });
      continue;
    }
    const qty = Number(r.quantity);
    if (!qty || qty <= 0 || !Number.isFinite(qty)) {
      errors.push({ row: rowNum, message: "quantity must be a positive number." });
      continue;
    }
    const validStages = ["finishing", "finished_goods"];
    const stage = validStages.includes(r.stockStage) ? r.stockStage : "finished_goods";
    validRows.push({
      itemCode: String(r.itemCode).trim(),
      productCode: r.productCode ? String(r.productCode).trim() : null,
      productName: r.productName ? String(r.productName).trim() : null,
      sizeName: r.sizeName ? String(r.sizeName).trim() : null,
      colorName: r.colorName ? String(r.colorName).trim() : null,
      quantity: qty,
      stockStage: stage,
      remarks: r.remarks ? String(r.remarks).trim() : null,
      enteredBy: (req as any).user?.username || null,
    });
  }

  let imported = 0;
  if (validRows.length > 0) {
    await db.insert(openingFinishedGoodsTable).values(validRows);
    imported = validRows.length;
    await logAudit(req, "IMPORT", "opening_finished_goods", "-", `Imported ${imported} opening stock entries`);
  }

  res.json({ imported, errors, total: rows.length });
});

router.get("/opening-finished-goods/summary", checkPermission("opening-finished-goods", "view"), async (_req: Request, res: Response) => {
  const rows = await db
    .select({
      itemCode: openingFinishedGoodsTable.itemCode,
      productCode: openingFinishedGoodsTable.productCode,
      productName: openingFinishedGoodsTable.productName,
      sizeName: openingFinishedGoodsTable.sizeName,
      colorName: openingFinishedGoodsTable.colorName,
      stockStage: openingFinishedGoodsTable.stockStage,
      totalQuantity: sql<number>`SUM(${openingFinishedGoodsTable.quantity})::int`,
    })
    .from(openingFinishedGoodsTable)
    .groupBy(
      openingFinishedGoodsTable.itemCode,
      openingFinishedGoodsTable.productCode,
      openingFinishedGoodsTable.productName,
      openingFinishedGoodsTable.sizeName,
      openingFinishedGoodsTable.colorName,
      openingFinishedGoodsTable.stockStage
    )
    .orderBy(openingFinishedGoodsTable.itemCode);
  res.json(rows);
});

export default router;
