import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  receivingsTable,
  allocationsTable,
  cuttingBatchesTable,
  stitchersTable,
  productsTable,
  sizesTable,
  colorsTable,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { logAudit } from "../lib/audit.js";

const router: IRouter = Router();

router.get("/receiving", async (_req, res) => {
  const rows = await db
    .select({
      id: receivingsTable.id,
      allocationId: receivingsTable.allocationId,
      allocationNumber: allocationsTable.allocationNumber,
      stitcherName: stitchersTable.name,
      batchNumber: cuttingBatchesTable.batchNumber,
      productName: productsTable.name,
      quantityReceived: receivingsTable.quantityReceived,
      quantityRejected: receivingsTable.quantityRejected,
      quantityDamaged: receivingsTable.quantityDamaged,
      receiveDate: receivingsTable.receiveDate,
      remarks: receivingsTable.remarks,
      receivedBy: receivingsTable.receivedBy,
    })
    .from(receivingsTable)
    .leftJoin(allocationsTable, eq(receivingsTable.allocationId, allocationsTable.id))
    .leftJoin(cuttingBatchesTable, eq(allocationsTable.cuttingBatchId, cuttingBatchesTable.id))
    .leftJoin(productsTable, eq(cuttingBatchesTable.productId, productsTable.id))
    .leftJoin(sizesTable, eq(cuttingBatchesTable.sizeId, sizesTable.id))
    .leftJoin(colorsTable, eq(cuttingBatchesTable.colorId, colorsTable.id))
    .leftJoin(stitchersTable, eq(allocationsTable.stitcherId, stitchersTable.id))
    .orderBy(sql`${receivingsTable.createdAt} desc`);
  res.json(rows);
});

router.post("/receiving", async (req, res) => {
  const { allocationId, quantityReceived, quantityRejected = 0, quantityDamaged = 0, receiveDate, remarks } = req.body;

  // Validate allocation exists and check pending
  const [allocation] = await db
    .select()
    .from(allocationsTable)
    .where(eq(allocationsTable.id, allocationId));

  if (!allocation) return res.status(404).json({ error: "Allocation not found" });

  const currentPending = allocation.quantityIssued - allocation.quantityReceived - allocation.quantityRejected;
  if (quantityReceived + quantityRejected + quantityDamaged > currentPending) {
    return res.status(400).json({ error: `Cannot receive more than pending quantity (${currentPending})` });
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

  // Update allocation totals
  const newReceived = allocation.quantityReceived + quantityReceived;
  const newRejected = allocation.quantityRejected + quantityRejected + quantityDamaged;
  const newPending = allocation.quantityIssued - newReceived - newRejected;
  const newStatus = newPending <= 0 ? "completed" : "partial";

  await db
    .update(allocationsTable)
    .set({
      quantityReceived: newReceived,
      quantityRejected: newRejected,
      status: newStatus,
    })
    .where(eq(allocationsTable.id, allocationId));

  // Update batch status
  await db
    .update(cuttingBatchesTable)
    .set({ status: "stitching" })
    .where(eq(cuttingBatchesTable.id, allocation.cuttingBatchId));

  await logAudit(
    req,
    "CREATE",
    "receivings",
    String(receiving.id),
    `Received ${quantityReceived} from stitcher for allocation ${allocationId}`
  );

  res.status(201).json(receiving);
});

export default router;
