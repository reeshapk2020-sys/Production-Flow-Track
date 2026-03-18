import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  cuttingBatchesTable,
  cuttingFabricUsageTable,
  fabricRollsTable,
  productsTable,
  sizesTable,
  colorsTable,
  allocationsTable,
} from "@workspace/db/schema";
import { eq, sql, ilike } from "drizzle-orm";
import { logAudit } from "../lib/audit.js";

const router: IRouter = Router();

router.get("/cutting/batches", async (_req, res) => {
  const rows = await db
    .select({
      id: cuttingBatchesTable.id,
      batchNumber: cuttingBatchesTable.batchNumber,
      productId: cuttingBatchesTable.productId,
      productName: productsTable.name,
      sizeId: cuttingBatchesTable.sizeId,
      sizeName: sizesTable.name,
      colorId: cuttingBatchesTable.colorId,
      colorName: colorsTable.name,
      quantityCut: cuttingBatchesTable.quantityCut,
      availableForAllocation: cuttingBatchesTable.availableForAllocation,
      cutter: cuttingBatchesTable.cutter,
      cuttingDate: cuttingBatchesTable.cuttingDate,
      remarks: cuttingBatchesTable.remarks,
      status: cuttingBatchesTable.status,
      createdAt: cuttingBatchesTable.createdAt,
    })
    .from(cuttingBatchesTable)
    .leftJoin(productsTable, eq(cuttingBatchesTable.productId, productsTable.id))
    .leftJoin(sizesTable, eq(cuttingBatchesTable.sizeId, sizesTable.id))
    .leftJoin(colorsTable, eq(cuttingBatchesTable.colorId, colorsTable.id))
    .orderBy(sql`${cuttingBatchesTable.createdAt} desc`);

  const result = rows.map((r) => ({
    ...r,
    totalAllocated: r.quantityCut - r.availableForAllocation,
  }));
  res.json(result);
});

router.post("/cutting/batches", async (req, res) => {
  const {
    batchNumber,
    productId,
    sizeId,
    colorId,
    quantityCut,
    cutter,
    cuttingDate,
    remarks,
    fabricUsages,
  } = req.body;

  if (!batchNumber || !String(batchNumber).trim()) {
    return res.status(400).json({ error: "Batch number is required." });
  }

  // Uniqueness check (case-insensitive)
  const existing = await db
    .select({ id: cuttingBatchesTable.id })
    .from(cuttingBatchesTable)
    .where(ilike(cuttingBatchesTable.batchNumber, String(batchNumber).trim()));

  if (existing.length > 0) {
    return res.status(409).json({ error: `Batch number "${batchNumber}" already exists. Please enter a unique batch number.` });
  }

  const [batch] = await db
    .insert(cuttingBatchesTable)
    .values({
      batchNumber: String(batchNumber).trim(),
      productId,
      sizeId,
      colorId,
      quantityCut,
      availableForAllocation: quantityCut,
      cutter,
      cuttingDate: new Date(cuttingDate),
      remarks,
      createdBy: (req as any).user?.username,
    })
    .returning();

  // Record fabric usages and deduct from rolls
  if (fabricUsages && Array.isArray(fabricUsages)) {
    for (const usage of fabricUsages) {
      await db.insert(cuttingFabricUsageTable).values({
        cuttingBatchId: batch.id,
        fabricRollId: usage.fabricRollId,
        quantityUsed: String(usage.quantityUsed),
      });
      // Deduct from fabric roll
      await db
        .update(fabricRollsTable)
        .set({
          availableQuantity: sql`${fabricRollsTable.availableQuantity} - ${String(usage.quantityUsed)}`,
          status: sql`CASE 
            WHEN ${fabricRollsTable.availableQuantity} - ${String(usage.quantityUsed)} <= 0 THEN 'exhausted'::"roll_status"
            WHEN ${fabricRollsTable.availableQuantity} - ${String(usage.quantityUsed)} < ${fabricRollsTable.totalQuantity} THEN 'partial'::"roll_status"
            ELSE ${fabricRollsTable.status}
          END`,
        })
        .where(eq(fabricRollsTable.id, usage.fabricRollId));
    }
  }

  await logAudit(
    req,
    "CREATE",
    "cutting_batches",
    String(batch.id),
    `Created cutting batch: ${batchNumber}, qty: ${quantityCut}`
  );
  res.status(201).json({ ...batch, totalAllocated: 0 });
});

router.get("/cutting/batches/:id", async (req, res) => {
  const id = parseInt(req.params.id);

  const [batch] = await db
    .select({
      id: cuttingBatchesTable.id,
      batchNumber: cuttingBatchesTable.batchNumber,
      productId: cuttingBatchesTable.productId,
      productName: productsTable.name,
      sizeId: cuttingBatchesTable.sizeId,
      sizeName: sizesTable.name,
      colorId: cuttingBatchesTable.colorId,
      colorName: colorsTable.name,
      quantityCut: cuttingBatchesTable.quantityCut,
      availableForAllocation: cuttingBatchesTable.availableForAllocation,
      cutter: cuttingBatchesTable.cutter,
      cuttingDate: cuttingBatchesTable.cuttingDate,
      remarks: cuttingBatchesTable.remarks,
      status: cuttingBatchesTable.status,
      createdAt: cuttingBatchesTable.createdAt,
    })
    .from(cuttingBatchesTable)
    .leftJoin(productsTable, eq(cuttingBatchesTable.productId, productsTable.id))
    .leftJoin(sizesTable, eq(cuttingBatchesTable.sizeId, sizesTable.id))
    .leftJoin(colorsTable, eq(cuttingBatchesTable.colorId, colorsTable.id))
    .where(eq(cuttingBatchesTable.id, id));

  if (!batch) return res.status(404).json({ error: "Not found" });

  const fabricRolls = await db
    .select({
      rollNumber: fabricRollsTable.rollNumber,
      quantityUsed: cuttingFabricUsageTable.quantityUsed,
      unit: fabricRollsTable.unit,
    })
    .from(cuttingFabricUsageTable)
    .leftJoin(fabricRollsTable, eq(cuttingFabricUsageTable.fabricRollId, fabricRollsTable.id))
    .where(eq(cuttingFabricUsageTable.cuttingBatchId, id));

  const allocations = await db
    .select()
    .from(allocationsTable)
    .where(eq(allocationsTable.cuttingBatchId, id));

  res.json({ batch: { ...batch, totalAllocated: batch.quantityCut - batch.availableForAllocation }, fabricRolls, allocations });
});

export default router;
