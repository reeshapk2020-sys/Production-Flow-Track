import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  ordersTable,
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
  dispatchesTable,
} from "@workspace/db/schema";
import { eq, sql, ilike } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { logAudit } from "../lib/audit.js";
import { checkPermission } from "./permissions.js";
import { computeItemCode } from "../lib/itemCode.js";

const router: IRouter = Router();
const mat1 = alias(materialsTable, "mat1");
const mat2 = alias(materialsTable, "mat2");

router.get("/orders", checkPermission("orders", "view"), async (_req, res) => {
  const rows = await db
    .select()
    .from(ordersTable)
    .orderBy(sql`${ordersTable.createdAt} desc`);

  const result = [];
  for (const order of rows) {
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
      .where(eq(cuttingBatchesTable.orderId, order.id));

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

    const [dispSums] = await db
      .select({
        totalDispatched: sql<number>`COALESCE(SUM(${dispatchesTable.quantity}), 0)::int`,
        totalDelivered: sql<number>`COALESCE(SUM(CASE WHEN ${dispatchesTable.deliveryStatus} = 'delivered' THEN ${dispatchesTable.quantity} ELSE 0 END), 0)::int`,
      })
      .from(dispatchesTable)
      .where(eq(dispatchesTable.orderId, order.id));

    const totalBatches = batchDetails.length;
    const totalQuantity = batchDetails.reduce((s, b) => s + b.quantityCut, 0);
    const totalCompleted = batchDetails.reduce((s, b) => s + b.totalFinished, 0);
    const totalPending = batchDetails.reduce((s, b) => s + b.pendingQuantity, 0);
    const inProgress = batchDetails.filter(b => b.status !== "finished" && b.status !== "cutting").length;

    result.push({
      ...order,
      batches: batchDetails,
      summary: {
        totalBatches, totalQuantity, totalCompleted, totalPending, inProgress,
        totalDispatched: Number(dispSums?.totalDispatched ?? 0),
        totalDelivered: Number(dispSums?.totalDelivered ?? 0),
      },
    });
  }

  res.json(result);
});

router.get("/orders/:id", checkPermission("orders", "view"), async (req, res) => {
  const id = parseInt(req.params.id);
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) return res.status(404).json({ error: "Order not found." });

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
    .where(eq(cuttingBatchesTable.orderId, order.id));

  const summary: Record<string, number> = { totalAllocated: 0, totalReceived: 0, totalFinished: 0, totalOutsourced: 0 };
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

  const [dispSums] = await db
    .select({
      totalDispatched: sql<number>`COALESCE(SUM(${dispatchesTable.quantity}), 0)::int`,
      totalDelivered: sql<number>`COALESCE(SUM(CASE WHEN ${dispatchesTable.deliveryStatus} = 'delivered' THEN ${dispatchesTable.quantity} ELSE 0 END), 0)::int`,
    })
    .from(dispatchesTable)
    .where(eq(dispatchesTable.orderId, order.id));
  summary.totalDispatched = Number(dispSums?.totalDispatched ?? 0);
  summary.totalDelivered = Number(dispSums?.totalDelivered ?? 0);

  res.json({ ...order, batches, summary });
});

router.post("/orders", checkPermission("orders", "create"), async (req, res) => {
  const { orderNumber, customerName, date, remarks, status } = req.body;

  if (!orderNumber || !String(orderNumber).trim()) {
    return res.status(400).json({ error: "Order number is required." });
  }
  if (!customerName || !String(customerName).trim()) {
    return res.status(400).json({ error: "Customer name is required." });
  }

  const existing = await db
    .select({ id: ordersTable.id })
    .from(ordersTable)
    .where(ilike(ordersTable.orderNumber, String(orderNumber).trim()));

  if (existing.length > 0) {
    return res.status(409).json({ error: `Order number "${orderNumber}" already exists.` });
  }

  const [order] = await db
    .insert(ordersTable)
    .values({
      orderNumber: String(orderNumber).trim(),
      customerName: String(customerName).trim(),
      date: new Date(date || new Date()),
      remarks: remarks || null,
      status: status || "open",
      createdBy: (req as any).user?.username,
    })
    .returning();

  await logAudit(req, "CREATE", "orders", String(order.id), `Created Order: ${orderNumber}`);
  res.status(201).json(order);
});

router.put("/orders/:id", checkPermission("orders", "edit"), async (req, res) => {
  const id = parseInt(req.params.id);
  const { orderNumber, customerName, date, remarks, status } = req.body;
  const updates: Record<string, any> = {};
  if (orderNumber !== undefined) updates.orderNumber = String(orderNumber).trim();
  if (customerName !== undefined) updates.customerName = String(customerName).trim();
  if (date !== undefined) updates.date = new Date(date);
  if (remarks !== undefined) updates.remarks = remarks || null;
  if (status !== undefined) updates.status = status;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No fields to update." });
  }

  const [row] = await db
    .update(ordersTable)
    .set(updates)
    .where(eq(ordersTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Order not found." });
  await logAudit(req, "UPDATE", "orders", String(id), `Updated Order #${id}`);
  res.json(row);
});

export default router;
