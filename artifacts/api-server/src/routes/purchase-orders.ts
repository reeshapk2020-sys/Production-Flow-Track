import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  purchaseOrdersTable,
  cuttingBatchesTable,
  productsTable,
  fabricsTable,
  materialsTable,
  sizesTable,
  colorsTable,
  allocationsTable,
  receivingsTable,
  finishingRecordsTable,
  finishedGoodsTable,
  outsourceTransfersTable,
} from "@workspace/db/schema";
import { eq, sql, ilike } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { logAudit } from "../lib/audit.js";
import { checkPermission } from "./permissions.js";
import { computeItemCode } from "../lib/itemCode.js";

const router: IRouter = Router();
const mat1 = alias(materialsTable, "mat1");
const mat2 = alias(materialsTable, "mat2");

router.get("/purchase-orders", checkPermission("purchase-orders", "view"), async (_req, res) => {
  const rows = await db
    .select()
    .from(purchaseOrdersTable)
    .orderBy(sql`${purchaseOrdersTable.createdAt} desc`);

  const result = [];
  for (const po of rows) {
    const batches = await db
      .select({
        id: cuttingBatchesTable.id,
        batchNumber: cuttingBatchesTable.batchNumber,
        productCode: productsTable.code,
        productName: productsTable.name,
        materialCode: mat1.code,
        material2Code: mat2.code,
        colorCode: colorsTable.code,
        colorName: colorsTable.name,
        sizeName: sizesTable.name,
        quantityCut: cuttingBatchesTable.quantityCut,
        status: cuttingBatchesTable.status,
      })
      .from(cuttingBatchesTable)
      .leftJoin(productsTable, eq(cuttingBatchesTable.productId, productsTable.id))
      .leftJoin(mat1, eq(cuttingBatchesTable.materialId, mat1.id))
      .leftJoin(mat2, eq(cuttingBatchesTable.material2Id, mat2.id))
      .leftJoin(colorsTable, eq(cuttingBatchesTable.colorId, colorsTable.id))
      .leftJoin(sizesTable, eq(cuttingBatchesTable.sizeId, sizesTable.id))
      .where(eq(cuttingBatchesTable.poId, po.id));

    const batchDetails = await Promise.all(batches.map(async (b) => {
      const [allocSums] = await db
        .select({
          totalIssued: sql<number>`COALESCE(SUM(${allocationsTable.quantityIssued}), 0)::int`,
          totalReceived: sql<number>`COALESCE(SUM(${allocationsTable.quantityReceived}), 0)::int`,
        })
        .from(allocationsTable)
        .where(eq(allocationsTable.cuttingBatchId, b.id));

      const [fgSums] = await db
        .select({
          totalFinished: sql<number>`COALESCE(SUM(${finishedGoodsTable.quantity}), 0)::int`,
        })
        .from(finishedGoodsTable)
        .where(eq(finishedGoodsTable.cuttingBatchId, b.id));

      const [outsourceSums] = await db
        .select({
          totalSent: sql<number>`COALESCE(SUM(${outsourceTransfersTable.quantitySent}), 0)::int`,
          totalReturned: sql<number>`COALESCE(SUM(${outsourceTransfersTable.quantityReturned}), 0)::int`,
        })
        .from(outsourceTransfersTable)
        .innerJoin(allocationsTable, eq(outsourceTransfersTable.allocationId, allocationsTable.id))
        .where(eq(allocationsTable.cuttingBatchId, b.id));

      const itemCode = computeItemCode(b.productCode, b.colorCode, b.materialCode, b.material2Code);
      const completed = Number(fgSums?.totalFinished ?? 0);
      const pending = b.quantityCut - completed;

      return {
        ...b,
        itemCode,
        totalAllocated: Number(allocSums?.totalIssued ?? 0),
        totalReceived: Number(allocSums?.totalReceived ?? 0),
        totalFinished: completed,
        pendingQuantity: Math.max(0, pending),
        outsourceSent: Number(outsourceSums?.totalSent ?? 0),
        outsourceReturned: Number(outsourceSums?.totalReturned ?? 0),
      };
    }));

    const totalBatches = batchDetails.length;
    const totalQuantity = batchDetails.reduce((s, b) => s + b.quantityCut, 0);
    const totalCompleted = batchDetails.reduce((s, b) => s + b.totalFinished, 0);
    const totalPending = batchDetails.reduce((s, b) => s + b.pendingQuantity, 0);
    const inProgress = batchDetails.filter(b => b.status !== "finished" && b.status !== "cutting").length;

    result.push({
      ...po,
      supplierName: po.customerName,
      batches: batchDetails,
      summary: { totalBatches, totalQuantity, totalCompleted, totalPending, inProgress },
    });
  }

  res.json(result);
});

router.get("/purchase-orders/:id", checkPermission("purchase-orders", "view"), async (req, res) => {
  const id = parseInt(req.params.id);
  const [po] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  if (!po) return res.status(404).json({ error: "PO not found." });

  const batches = await db
    .select({
      id: cuttingBatchesTable.id,
      batchNumber: cuttingBatchesTable.batchNumber,
      productCode: productsTable.code,
      productName: productsTable.name,
      materialCode: mat1.code,
      material2Code: mat2.code,
      colorCode: colorsTable.code,
      colorName: colorsTable.name,
      sizeName: sizesTable.name,
      quantityCut: cuttingBatchesTable.quantityCut,
      status: cuttingBatchesTable.status,
    })
    .from(cuttingBatchesTable)
    .leftJoin(productsTable, eq(cuttingBatchesTable.productId, productsTable.id))
    .leftJoin(mat1, eq(cuttingBatchesTable.materialId, mat1.id))
    .leftJoin(mat2, eq(cuttingBatchesTable.material2Id, mat2.id))
    .leftJoin(colorsTable, eq(cuttingBatchesTable.colorId, colorsTable.id))
    .leftJoin(sizesTable, eq(cuttingBatchesTable.sizeId, sizesTable.id))
    .where(eq(cuttingBatchesTable.poId, po.id));

  const summary = { totalAllocated: 0, totalReceived: 0, totalFinished: 0, totalOutsourced: 0 };
  for (const b of batches) {
    const [allocSums] = await db.select({
      issued: sql<number>`COALESCE(SUM(${allocationsTable.quantityIssued}), 0)::int`,
      received: sql<number>`COALESCE(SUM(${allocationsTable.quantityReceived}), 0)::int`,
    }).from(allocationsTable).where(eq(allocationsTable.cuttingBatchId, b.id));
    const [fgSums] = await db.select({
      finished: sql<number>`COALESCE(SUM(${finishedGoodsTable.quantity}), 0)::int`,
    }).from(finishedGoodsTable).where(eq(finishedGoodsTable.cuttingBatchId, b.id));
    const [osSums] = await db.select({
      sent: sql<number>`COALESCE(SUM(${outsourceTransfersTable.quantitySent}), 0)::int`,
    }).from(outsourceTransfersTable)
      .innerJoin(allocationsTable, eq(outsourceTransfersTable.allocationId, allocationsTable.id))
      .where(eq(allocationsTable.cuttingBatchId, b.id));
    summary.totalAllocated += Number(allocSums?.issued ?? 0);
    summary.totalReceived += Number(allocSums?.received ?? 0);
    summary.totalFinished += Number(fgSums?.finished ?? 0);
    summary.totalOutsourced += Number(osSums?.sent ?? 0);
  }

  res.json({ ...po, supplierName: po.customerName, batches, summary });
});

router.post("/purchase-orders", checkPermission("purchase-orders", "create"), async (req, res) => {
  const { poNumber, supplierName, date, remarks, status } = req.body;

  if (!poNumber || !String(poNumber).trim()) {
    return res.status(400).json({ error: "PO number is required." });
  }
  if (!supplierName || !String(supplierName).trim()) {
    return res.status(400).json({ error: "Supplier name is required." });
  }

  const existing = await db
    .select({ id: purchaseOrdersTable.id })
    .from(purchaseOrdersTable)
    .where(ilike(purchaseOrdersTable.poNumber, String(poNumber).trim()));

  if (existing.length > 0) {
    return res.status(409).json({ error: `PO number "${poNumber}" already exists.` });
  }

  const [po] = await db
    .insert(purchaseOrdersTable)
    .values({
      poNumber: String(poNumber).trim(),
      customerName: String(supplierName).trim(),
      date: new Date(date || new Date()),
      remarks: remarks || null,
      status: status || "open",
      createdBy: (req as any).user?.username,
    })
    .returning();

  await logAudit(req, "CREATE", "purchase_orders", String(po.id), `Created PO: ${poNumber}`);
  res.status(201).json({ ...po, supplierName: po.customerName });
});

router.put("/purchase-orders/:id", checkPermission("purchase-orders", "edit"), async (req, res) => {
  const id = parseInt(req.params.id);
  const { poNumber, supplierName, date, remarks, status } = req.body;
  const updates: Record<string, any> = {};
  if (poNumber !== undefined) updates.poNumber = String(poNumber).trim();
  if (supplierName !== undefined) updates.customerName = String(supplierName).trim();
  if (date !== undefined) updates.date = new Date(date);
  if (remarks !== undefined) updates.remarks = remarks || null;
  if (status !== undefined) updates.status = status;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No fields to update." });
  }

  const [row] = await db
    .update(purchaseOrdersTable)
    .set(updates)
    .where(eq(purchaseOrdersTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "PO not found." });
  await logAudit(req, "UPDATE", "purchase_orders", String(id), `Updated PO #${id}`);
  res.json({ ...row, supplierName: row.customerName });
});

export default router;
