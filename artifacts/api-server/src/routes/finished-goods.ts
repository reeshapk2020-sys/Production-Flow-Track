import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  finishedGoodsTable,
  cuttingBatchesTable,
  productsTable,
  sizesTable,
  colorsTable,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { logAudit } from "../lib/audit.js";

const router: IRouter = Router();

router.get("/finished-goods", async (_req, res) => {
  const rows = await db
    .select({
      id: finishedGoodsTable.id,
      cuttingBatchId: finishedGoodsTable.cuttingBatchId,
      batchNumber: cuttingBatchesTable.batchNumber,
      productId: productsTable.id,
      productName: productsTable.name,
      sizeId: sizesTable.id,
      sizeName: sizesTable.name,
      colorId: colorsTable.id,
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

router.post("/finished-goods", async (req, res) => {
  const { cuttingBatchId, quantity, entryDate, remarks } = req.body;

  const [entry] = await db
    .insert(finishedGoodsTable)
    .values({
      cuttingBatchId,
      quantity,
      entryDate: new Date(entryDate),
      remarks,
      enteredBy: (req as any).user?.username,
    })
    .returning();

  // Mark batch as finished
  await db
    .update(cuttingBatchesTable)
    .set({ status: "finished" })
    .where(eq(cuttingBatchesTable.id, cuttingBatchId));

  await logAudit(
    req,
    "CREATE",
    "finished_goods",
    String(entry.id),
    `Added ${quantity} pieces to finished goods store`
  );

  res.status(201).json(entry);
});

router.get("/finished-goods/stock", async (_req, res) => {
  const rows = await db
    .select({
      productId: productsTable.id,
      productName: productsTable.name,
      sizeId: sizesTable.id,
      sizeName: sizesTable.name,
      colorId: colorsTable.id,
      colorName: colorsTable.name,
      totalQuantity: sql<number>`SUM(${finishedGoodsTable.quantity})::int`,
    })
    .from(finishedGoodsTable)
    .leftJoin(cuttingBatchesTable, eq(finishedGoodsTable.cuttingBatchId, cuttingBatchesTable.id))
    .leftJoin(productsTable, eq(cuttingBatchesTable.productId, productsTable.id))
    .leftJoin(sizesTable, eq(cuttingBatchesTable.sizeId, sizesTable.id))
    .leftJoin(colorsTable, eq(cuttingBatchesTable.colorId, colorsTable.id))
    .groupBy(productsTable.id, productsTable.name, sizesTable.id, sizesTable.name, colorsTable.id, colorsTable.name)
    .orderBy(productsTable.name);
  res.json(rows);
});

export default router;
