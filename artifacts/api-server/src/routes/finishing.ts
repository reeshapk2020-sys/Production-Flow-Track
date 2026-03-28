import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  finishingRecordsTable,
  finishedGoodsTable,
  cuttingBatchesTable,
  allocationsTable,
  receivingsTable,
  productsTable,
  fabricsTable,
  materialsTable,
  sizesTable,
  colorsTable,
} from "@workspace/db/schema";
import { eq, sql, inArray, and, gte, lte, ilike } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { logAudit } from "../lib/audit.js";
import { checkPermission } from "./permissions.js";
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

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Total pieces received from stitchers for a given cutting batch */
async function getTotalReceived(batchId: number): Promise<number> {
  const allocs = await db
    .select({ id: allocationsTable.id })
    .from(allocationsTable)
    .where(eq(allocationsTable.cuttingBatchId, batchId));

  if (allocs.length === 0) return 0;

  const allocIds = allocs.map((a) => a.id);
  const [result] = await db
    .select({ total: sql<number>`COALESCE(SUM(${receivingsTable.quantityReceived}), 0)::int` })
    .from(receivingsTable)
    .where(inArray(receivingsTable.allocationId, allocIds));

  return result?.total ?? 0;
}

/** Total pieces already output in finishing for a given cutting batch */
async function getTotalFinishingOutput(batchId: number): Promise<number> {
  const [result] = await db
    .select({ total: sql<number>`COALESCE(SUM(${finishingRecordsTable.outputQuantity}), 0)::int` })
    .from(finishingRecordsTable)
    .where(eq(finishingRecordsTable.cuttingBatchId, batchId));

  return result?.total ?? 0;
}

// ─── Routes ─────────────────────────────────────────────────────────────────

/** GET /finishing – all finishing records (all historical stages merged) */
router.get("/finishing", checkPermission("finishing", "view"), async (req, res) => {
  const { startDate, endDate, productId, colorId, batchNumber } = req.query;
  const conditions: any[] = [];
  if (startDate) conditions.push(gte(finishingRecordsTable.processDate, new Date(startDate as string)));
  if (endDate) { const ed = new Date(endDate as string); ed.setDate(ed.getDate() + 1); conditions.push(lte(finishingRecordsTable.processDate, ed)); }
  if (productId) conditions.push(eq(cuttingBatchesTable.productId, Number(productId)));
  if (colorId) conditions.push(eq(cuttingBatchesTable.colorId, Number(colorId)));
  if (batchNumber) conditions.push(ilike(cuttingBatchesTable.batchNumber, `%${batchNumber}%`));

  let q = db
    .select({
      id: finishingRecordsTable.id,
      cuttingBatchId: finishingRecordsTable.cuttingBatchId,
      batchNumber: cuttingBatchesTable.batchNumber,
      stage: finishingRecordsTable.stage,
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
      inputQuantity: finishingRecordsTable.inputQuantity,
      outputQuantity: finishingRecordsTable.outputQuantity,
      defectiveQuantity: finishingRecordsTable.defectiveQuantity,
      operator: finishingRecordsTable.operator,
      processDate: finishingRecordsTable.processDate,
      remarks: finishingRecordsTable.remarks,
    })
    .from(finishingRecordsTable)
    .leftJoin(cuttingBatchesTable, eq(finishingRecordsTable.cuttingBatchId, cuttingBatchesTable.id))
    .leftJoin(productsTable, eq(cuttingBatchesTable.productId, productsTable.id))
    .leftJoin(fabricsTable, eq(cuttingBatchesTable.fabricId, fabricsTable.id))
    .leftJoin(mat1, eq(cuttingBatchesTable.materialId, mat1.id))
    .leftJoin(mat2, eq(cuttingBatchesTable.material2Id, mat2.id))
    .leftJoin(sizesTable, eq(cuttingBatchesTable.sizeId, sizesTable.id))
    .leftJoin(colorsTable, eq(cuttingBatchesTable.colorId, colorsTable.id))
    .$dynamic();

  if (conditions.length > 0) q = q.where(and(...conditions));
  const rows = await q.orderBy(sql`${finishingRecordsTable.createdAt} desc`);

  const batchIds = [...new Set(rows.map((r) => r.cuttingBatchId))];
  const fgSet = new Set(batchIds.length > 0 ? (await db
    .select({ cuttingBatchId: finishedGoodsTable.cuttingBatchId })
    .from(finishedGoodsTable)
    .where(sql`${finishedGoodsTable.cuttingBatchId} IN (${sql.join(batchIds.map((id) => sql`${id}`), sql`, `)})`)
    .groupBy(finishedGoodsTable.cuttingBatchId)
  ).map((r) => r.cuttingBatchId) : []);

  res.json(
    rows.map((r) => ({
      ...r,
      pendingQuantity: r.inputQuantity - r.outputQuantity - r.defectiveQuantity,
      itemCode: computeItemCode(r.productCode, r.colorCode, r.materialCode, r.material2Code),
      isLocked: fgSet.has(r.cuttingBatchId),
    }))
  );
});

/** GET /finishing/batch-info/:batchId – availability for a batch */
router.get("/finishing/batch-info/:batchId", checkPermission("finishing", "view"), async (req, res) => {
  const batchId = Number(req.params.batchId);
  if (!batchId) return res.status(400).json({ error: "Invalid batchId" });

  const [batch] = await db
    .select({ id: cuttingBatchesTable.id, batchNumber: cuttingBatchesTable.batchNumber })
    .from(cuttingBatchesTable)
    .where(eq(cuttingBatchesTable.id, batchId));

  if (!batch) return res.status(404).json({ error: "Batch not found" });

  const totalReceived = await getTotalReceived(batchId);
  const totalFinishingOutput = await getTotalFinishingOutput(batchId);

  res.json({
    batchId,
    batchNumber: batch.batchNumber,
    totalReceived,
    totalFinishingOutput,
    availableForFinishing: Math.max(0, totalReceived - totalFinishingOutput),
  });
});

/** POST /finishing – create a finishing record */
router.post("/finishing", checkPermission("finishing", "create"), async (req, res) => {
  const {
    cuttingBatchId,
    inputQuantity,
    outputQuantity,
    defectiveQuantity = 0,
    operator,
    processDate,
    remarks,
  } = req.body;

  const input = Number(inputQuantity);
  const output = Number(outputQuantity);
  const defective = Number(defectiveQuantity) || 0;

  if (!cuttingBatchId) return res.status(400).json({ error: "Batch is required." });
  if (input < 0) return res.status(400).json({ error: "Input quantity must not be negative." });
  if (output < 0 || defective < 0) return res.status(400).json({ error: "Quantities must be non-negative." });

  if (output > input) {
    return res.status(400).json({
      error: `Output quantity (${output}) cannot exceed input quantity (${input}).`,
    });
  }
  if (output + defective > input) {
    return res.status(400).json({
      error: `Output (${output}) + Defective (${defective}) = ${output + defective} cannot exceed input quantity (${input}).`,
    });
  }

  // Validate against upstream: input cannot exceed what was received from stitchers
  const totalReceived = await getTotalReceived(Number(cuttingBatchId));
  const totalAlreadyOutput = await getTotalFinishingOutput(Number(cuttingBatchId));
  const available = totalReceived - totalAlreadyOutput;

  if (input > available) {
    return res.status(400).json({
      error: `Input quantity (${input}) exceeds available pieces from Receiving (${available} available: ${totalReceived} received − ${totalAlreadyOutput} already finished).`,
    });
  }

  const [record] = await db
    .insert(finishingRecordsTable)
    .values({
      cuttingBatchId: Number(cuttingBatchId),
      stage: "finishing",
      inputQuantity: input,
      outputQuantity: output,
      defectiveQuantity: defective,
      operator,
      processDate: new Date(processDate),
      remarks,
      createdBy: (req as any).user?.username,
    })
    .returning();

  await db
    .update(cuttingBatchesTable)
    .set({ status: "in_finishing" })
    .where(eq(cuttingBatchesTable.id, Number(cuttingBatchId)));

  await logAudit(
    req,
    "CREATE",
    "finishing_records",
    String(record.id),
    `Finishing for batch ${cuttingBatchId}: in=${input}, out=${output}, def=${defective}`
  );

  res.status(201).json({
    ...record,
    pendingQuantity: input - output - defective,
  });
});

router.put("/finishing/:id", checkPermission("finishing", "edit"), async (req, res) => {
  const id = parseInt(req.params.id);
  const { operator, processDate, remarks, outputQuantity, defectiveQuantity } = req.body;

  const [existing] = await db.select({ cuttingBatchId: finishingRecordsTable.cuttingBatchId }).from(finishingRecordsTable).where(eq(finishingRecordsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Finishing record not found." });

  const [hasFG] = await db.select({ id: finishedGoodsTable.id }).from(finishedGoodsTable).where(eq(finishedGoodsTable.cuttingBatchId, existing.cuttingBatchId)).limit(1);
  const isLocked = !!hasFG;

  if (isLocked && (outputQuantity !== undefined || defectiveQuantity !== undefined)) {
    return res.status(400).json({ error: "Cannot change quantities: finished goods already recorded for this batch." });
  }

  const updates: Record<string, any> = {};
  if (operator !== undefined) updates.operator = operator;
  if (processDate) updates.processDate = new Date(processDate);
  if (remarks !== undefined) updates.remarks = remarks;
  if (!isLocked && outputQuantity !== undefined) updates.outputQuantity = outputQuantity;
  if (!isLocked && defectiveQuantity !== undefined) updates.defectiveQuantity = defectiveQuantity;

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No fields to update." });

  const [row] = await db
    .update(finishingRecordsTable)
    .set(updates)
    .where(eq(finishingRecordsTable.id, id))
    .returning();
  await logAudit(req, "UPDATE", "finishing_records", String(id), `Updated finishing record #${id}`);
  res.json({ ...row, isLocked });
});

export default router;
