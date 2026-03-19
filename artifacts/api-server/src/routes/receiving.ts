import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  receivingsTable,
  allocationsTable,
  cuttingBatchesTable,
  stitchersTable,
  productsTable,
  fabricsTable,
  materialsTable,
  sizesTable,
  colorsTable,
  finishingRecordsTable,
  finishedGoodsTable,
} from "@workspace/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { logAudit } from "../lib/audit.js";
import { computeItemCode } from "../lib/itemCode.js";

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || req.user?.role !== "admin") {
    res.status(403).json({ error: "Admin access required." });
    return;
  }
  next();
}

const router: IRouter = Router();
const mat1 = alias(materialsTable, "mat1");
const mat2 = alias(materialsTable, "mat2");

/**
 * Recalculate allocation totals from the receivings table (source of truth).
 * Updates allocation.quantityReceived, quantityRejected, status.
 */
async function recalculateAllocationTotals(allocationId: number) {
  const [alloc] = await db
    .select({ quantityIssued: allocationsTable.quantityIssued, cuttingBatchId: allocationsTable.cuttingBatchId })
    .from(allocationsTable)
    .where(eq(allocationsTable.id, allocationId));

  if (!alloc) return;

  const [sums] = await db
    .select({
      totalReceived: sql<number>`COALESCE(SUM(${receivingsTable.quantityReceived}), 0)`,
      totalRejected: sql<number>`COALESCE(SUM(${receivingsTable.quantityRejected} + ${receivingsTable.quantityDamaged}), 0)`,
    })
    .from(receivingsTable)
    .where(eq(receivingsTable.allocationId, allocationId));

  const totalReceived = Number(sums?.totalReceived ?? 0);
  const totalRejected = Number(sums?.totalRejected ?? 0);
  const pending = alloc.quantityIssued - totalReceived - totalRejected;
  const allocStatus = pending <= 0 ? "completed" : totalReceived > 0 ? "partial" : "pending";

  await db
    .update(allocationsTable)
    .set({ quantityReceived: totalReceived, quantityRejected: totalRejected, status: allocStatus })
    .where(eq(allocationsTable.id, allocationId));

  // Now update the cutting batch status
  await updateBatchStatus(alloc.cuttingBatchId);
}

/**
 * Determine and update the batch status based on all its allocations, receivings, finishing, and finished goods.
 */
async function updateBatchStatus(batchId: number) {
  // Check finished goods
  const [fg] = await db
    .select({ id: finishedGoodsTable.id })
    .from(finishedGoodsTable)
    .where(eq(finishedGoodsTable.cuttingBatchId, batchId))
    .limit(1);
  if (fg) {
    await db.update(cuttingBatchesTable).set({ status: "finished" }).where(eq(cuttingBatchesTable.id, batchId));
    return;
  }

  // Check finishing records
  const [fr] = await db
    .select({ id: finishingRecordsTable.id })
    .from(finishingRecordsTable)
    .where(eq(finishingRecordsTable.cuttingBatchId, batchId))
    .limit(1);
  if (fr) {
    await db.update(cuttingBatchesTable).set({ status: "in_finishing" }).where(eq(cuttingBatchesTable.id, batchId));
    return;
  }

  // Aggregate allocations
  const allocations = await db
    .select({
      quantityIssued: allocationsTable.quantityIssued,
      quantityReceived: allocationsTable.quantityReceived,
      quantityRejected: allocationsTable.quantityRejected,
    })
    .from(allocationsTable)
    .where(eq(allocationsTable.cuttingBatchId, batchId));

  if (allocations.length === 0) {
    await db.update(cuttingBatchesTable).set({ status: "cutting" }).where(eq(cuttingBatchesTable.id, batchId));
    return;
  }

  const totalIssued = allocations.reduce((s, a) => s + a.quantityIssued, 0);
  const totalReceived = allocations.reduce((s, a) => s + (Number(a.quantityReceived) || 0), 0);
  const totalRejected = allocations.reduce((s, a) => s + (Number(a.quantityRejected) || 0), 0);
  const totalAccountedFor = totalReceived + totalRejected;

  let newStatus: string;
  if (totalAccountedFor >= totalIssued) {
    newStatus = "fully_received";
  } else if (totalReceived > 0 || totalRejected > 0) {
    newStatus = "partially_received";
  } else {
    newStatus = "allocated";
  }

  await db
    .update(cuttingBatchesTable)
    .set({ status: newStatus as any })
    .where(eq(cuttingBatchesTable.id, batchId));
}

function denyAllocationRole(req: any, res: any, next: any) {
  const role = req.user?.role;
  if (role === "allocation") {
    return res.status(403).json({ error: "Allocation users cannot access receiving endpoints" });
  }
  next();
}

router.get("/receiving", denyAllocationRole, async (_req, res) => {
  const rows = await db
    .select({
      id: receivingsTable.id,
      allocationId: receivingsTable.allocationId,
      allocationNumber: allocationsTable.allocationNumber,
      stitcherName: stitchersTable.name,
      batchNumber: cuttingBatchesTable.batchNumber,
      productCode: productsTable.code,
      productName: productsTable.name,
      fabricCode: fabricsTable.code,
      fabricName: fabricsTable.name,
      materialCode: mat1.code,
      materialName: mat1.name,
      material2Code: mat2.code,
      material2Name: mat2.name,
      sizeName: sizesTable.name,
      colorCode: colorsTable.code,
      colorName: colorsTable.name,
      quantityIssued: allocationsTable.quantityIssued,
      quantityReceived: receivingsTable.quantityReceived,
      quantityRejected: receivingsTable.quantityRejected,
      quantityDamaged: receivingsTable.quantityDamaged,
      receiveDate: receivingsTable.receiveDate,
      remarks: receivingsTable.remarks,
      receivedBy: receivingsTable.receivedBy,
      createdAt: receivingsTable.createdAt,
    })
    .from(receivingsTable)
    .leftJoin(allocationsTable, eq(receivingsTable.allocationId, allocationsTable.id))
    .leftJoin(cuttingBatchesTable, eq(allocationsTable.cuttingBatchId, cuttingBatchesTable.id))
    .leftJoin(productsTable, eq(cuttingBatchesTable.productId, productsTable.id))
    .leftJoin(fabricsTable, eq(cuttingBatchesTable.fabricId, fabricsTable.id))
    .leftJoin(mat1, eq(cuttingBatchesTable.materialId, mat1.id))
    .leftJoin(mat2, eq(cuttingBatchesTable.material2Id, mat2.id))
    .leftJoin(sizesTable, eq(cuttingBatchesTable.sizeId, sizesTable.id))
    .leftJoin(colorsTable, eq(cuttingBatchesTable.colorId, colorsTable.id))
    .leftJoin(stitchersTable, eq(allocationsTable.stitcherId, stitchersTable.id))
    .orderBy(sql`${receivingsTable.createdAt} desc`);
  res.json(rows.map(r => ({
    ...r,
    itemCode: computeItemCode(r.productCode, r.fabricCode, r.materialCode, r.material2Code),
  })));
});

router.post("/receiving", denyAllocationRole, async (req, res) => {
  const {
    allocationId,
    quantityReceived,
    quantityRejected = 0,
    quantityDamaged = 0,
    receiveDate,
    remarks,
  } = req.body;

  if (!allocationId || quantityReceived < 0 || quantityRejected < 0 || quantityDamaged < 0) {
    return res.status(400).json({ error: "Invalid quantities" });
  }

  const [allocation] = await db
    .select()
    .from(allocationsTable)
    .where(eq(allocationsTable.id, allocationId));

  if (!allocation) return res.status(404).json({ error: "Allocation not found" });

  // Calculate current totals from the receivings table (not from allocation cache)
  const [currentTotals] = await db
    .select({
      totalReceived: sql<number>`COALESCE(SUM(${receivingsTable.quantityReceived}), 0)`,
      totalRejected: sql<number>`COALESCE(SUM(${receivingsTable.quantityRejected} + ${receivingsTable.quantityDamaged}), 0)`,
    })
    .from(receivingsTable)
    .where(eq(receivingsTable.allocationId, allocationId));

  const alreadyAccountedFor =
    Number(currentTotals?.totalReceived ?? 0) + Number(currentTotals?.totalRejected ?? 0);
  const remainingPending = allocation.quantityIssued - alreadyAccountedFor;
  const thisEntry = quantityReceived + quantityRejected + quantityDamaged;

  if (thisEntry <= 0) {
    return res.status(400).json({ error: "At least one quantity must be greater than zero" });
  }
  if (thisEntry > remainingPending) {
    return res
      .status(400)
      .json({ error: `Cannot receive more than pending quantity (${remainingPending})` });
  }

  const [receiving] = await db
    .insert(receivingsTable)
    .values({
      allocationId,
      quantityReceived,
      quantityRejected,
      quantityDamaged,
      receiveDate: new Date(receiveDate),
      remarks,
      receivedBy: (req as any).user?.username,
    })
    .returning();

  // Recalculate allocation totals from all receivings (source of truth)
  await recalculateAllocationTotals(allocationId);

  await logAudit(
    req,
    "CREATE",
    "receivings",
    String(receiving.id),
    `Received ${quantityReceived} (rejected: ${quantityRejected}, damaged: ${quantityDamaged}) for allocation ${allocationId}`,
  );

  res.status(201).json(receiving);
});

// Export helper for use by other routes
export { updateBatchStatus };
router.put("/receiving/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { receiveDate, remarks } = req.body;
  const [row] = await db
    .update(receivingsTable)
    .set({
      receiveDate: receiveDate ? new Date(receiveDate) : undefined,
      remarks: remarks !== undefined ? remarks : undefined,
    })
    .where(eq(receivingsTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Receiving record not found." });
  await logAudit(req, "UPDATE", "receivings", String(id), `Updated receiving record #${id}`);
  res.json(row);
});

export default router;
