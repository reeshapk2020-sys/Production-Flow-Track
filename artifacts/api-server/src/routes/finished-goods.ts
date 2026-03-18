import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  finishedGoodsTable,
  finishingRecordsTable,
  cuttingBatchesTable,
  productsTable,
  sizesTable,
  colorsTable,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { logAudit } from "../lib/audit.js";

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || req.user?.role !== "admin") {
    res.status(403).json({ error: "Admin access required." });
    return;
  }
  next();
}

const router: IRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Total good pieces output in finishing for a batch */
async function getTotalFinishingOutput(batchId: number): Promise<number> {
  const [result] = await db
    .select({ total: sql<number>`COALESCE(SUM(${finishingRecordsTable.outputQuantity}), 0)::int` })
    .from(finishingRecordsTable)
    .where(eq(finishingRecordsTable.cuttingBatchId, batchId));
  return result?.total ?? 0;
}

/** Total pieces already moved to finished goods store for a batch */
async function getTotalStoredQty(batchId: number): Promise<number> {
  const [result] = await db
    .select({ total: sql<number>`COALESCE(SUM(${finishedGoodsTable.quantity}), 0)::int` })
    .from(finishedGoodsTable)
    .where(eq(finishedGoodsTable.cuttingBatchId, batchId));
  return result?.total ?? 0;
}

// ─── Routes ─────────────────────────────────────────────────────────────────

router.get("/finished-goods", async (_req, res) => {
  const rows = await db
    .select({
      id: finishedGoodsTable.id,
      cuttingBatchId: finishedGoodsTable.cuttingBatchId,
      batchNumber: cuttingBatchesTable.batchNumber,
      productId: productsTable.id,
      productCode: productsTable.code,
      productName: productsTable.name,
      sizeId: sizesTable.id,
      sizeName: sizesTable.name,
      colorId: colorsTable.id,
      colorCode: colorsTable.code,
      colorName: colorsTable.name,
      quantity: finishedGoodsTable.quantity,
      entryDate: finishedGoodsTable.entryDate,
      remarks: finishedGoodsTable.remarks,
      enteredBy: finishedGoodsTable.enteredBy,
    })
    .from(finishedGoodsTable)
    .leftJoin(cuttingBatchesTable, eq(finishedGoodsTable.cuttingBatchId, cuttingBatchesTable.id))
    .leftJoin(productsTable, eq(cuttingBatchesTable.productId, productsTable.id))
    .leftJoin(sizesTable, eq(cuttingBatchesTable.sizeId, sizesTable.id))
    .leftJoin(colorsTable, eq(cuttingBatchesTable.colorId, colorsTable.id))
    .orderBy(sql`${finishedGoodsTable.createdAt} desc`);
  res.json(rows);
});

/** GET /finished-goods/batch-info/:batchId – availability from finishing */
router.get("/finished-goods/batch-info/:batchId", async (req, res) => {
  const batchId = Number(req.params.batchId);
  if (!batchId) return res.status(400).json({ error: "Invalid batchId" });

  const [batch] = await db
    .select({ id: cuttingBatchesTable.id, batchNumber: cuttingBatchesTable.batchNumber })
    .from(cuttingBatchesTable)
    .where(eq(cuttingBatchesTable.id, batchId));

  if (!batch) return res.status(404).json({ error: "Batch not found" });

  const totalFinishingOutput = await getTotalFinishingOutput(batchId);
  const totalStoredQty = await getTotalStoredQty(batchId);

  res.json({
    batchId,
    batchNumber: batch.batchNumber,
    totalFinishingOutput,
    totalStoredQty,
    availableForStore: Math.max(0, totalFinishingOutput - totalStoredQty),
  });
});

router.post("/finished-goods", async (req, res) => {
  const { cuttingBatchId, quantity, entryDate, remarks } = req.body;

  const qty = Number(quantity);
  if (!cuttingBatchId) return res.status(400).json({ error: "Batch is required." });
  if (qty <= 0) return res.status(400).json({ error: "Quantity must be greater than zero." });

  // Validate against upstream: quantity cannot exceed finishing output
  const totalFinishingOutput = await getTotalFinishingOutput(Number(cuttingBatchId));
  const totalAlreadyStored = await getTotalStoredQty(Number(cuttingBatchId));
  const available = totalFinishingOutput - totalAlreadyStored;

  if (qty > available) {
    return res.status(400).json({
      error: `Quantity (${qty}) exceeds available pieces from Finishing (${available} available: ${totalFinishingOutput} finished − ${totalAlreadyStored} already stored).`,
    });
  }

  const [entry] = await db
    .insert(finishedGoodsTable)
    .values({
      cuttingBatchId: Number(cuttingBatchId),
      quantity: qty,
      entryDate: new Date(entryDate),
      remarks,
      enteredBy: (req as any).user?.username,
    })
    .returning();

  await db
    .update(cuttingBatchesTable)
    .set({ status: "finished" })
    .where(eq(cuttingBatchesTable.id, Number(cuttingBatchId)));

  await logAudit(
    req,
    "CREATE",
    "finished_goods",
    String(entry.id),
    `Added ${qty} pieces to finished goods store for batch ${cuttingBatchId}`
  );

  res.status(201).json(entry);
});

router.get("/finished-goods/stock", async (_req, res) => {
  const rows = await db
    .select({
      productId: productsTable.id,
      productCode: productsTable.code,
      productName: productsTable.name,
      sizeId: sizesTable.id,
      sizeName: sizesTable.name,
      colorId: colorsTable.id,
      colorCode: colorsTable.code,
      colorName: colorsTable.name,
      totalQuantity: sql<number>`SUM(${finishedGoodsTable.quantity})::int`,
    })
    .from(finishedGoodsTable)
    .leftJoin(cuttingBatchesTable, eq(finishedGoodsTable.cuttingBatchId, cuttingBatchesTable.id))
    .leftJoin(productsTable, eq(cuttingBatchesTable.productId, productsTable.id))
    .leftJoin(sizesTable, eq(cuttingBatchesTable.sizeId, sizesTable.id))
    .leftJoin(colorsTable, eq(cuttingBatchesTable.colorId, colorsTable.id))
    .groupBy(productsTable.id, productsTable.code, productsTable.name, sizesTable.id, sizesTable.name, colorsTable.id, colorsTable.code, colorsTable.name)
    .orderBy(productsTable.name);
  res.json(rows);
});

router.put("/finished-goods/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { entryDate, remarks } = req.body;
  const [row] = await db
    .update(finishedGoodsTable)
    .set({
      entryDate: entryDate ? new Date(entryDate) : undefined,
      remarks: remarks !== undefined ? remarks : undefined,
    })
    .where(eq(finishedGoodsTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Finished goods entry not found." });
  await logAudit(req, "UPDATE", "finished_goods", String(id), `Updated finished goods entry #${id}`);
  res.json(row);
});

export default router;
