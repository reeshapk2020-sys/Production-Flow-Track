import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  finishingRecordsTable,
  cuttingBatchesTable,
  allocationsTable,
  receivingsTable,
  productsTable,
  sizesTable,
  colorsTable,
} from "@workspace/db/schema";
import { eq, sql, inArray } from "drizzle-orm";
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
router.get("/finishing", async (_req, res) => {
  const rows = await db
    .select({
      id: finishingRecordsTable.id,
      cuttingBatchId: finishingRecordsTable.cuttingBatchId,
      batchNumber: cuttingBatchesTable.batchNumber,
      stage: finishingRecordsTable.stage,
      productCode: productsTable.code,
      productName: productsTable.name,
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
    .leftJoin(sizesTable, eq(cuttingBatchesTable.sizeId, sizesTable.id))
    .leftJoin(colorsTable, eq(cuttingBatchesTable.colorId, colorsTable.id))
    .orderBy(sql`${finishingRecordsTable.createdAt} desc`);

  res.json(
    rows.map((r) => ({
      ...r,
      pendingQuantity: r.inputQuantity - r.outputQuantity - r.defectiveQuantity,
    }))
  );
});

/** GET /finishing/batch-info/:batchId – availability for a batch */
router.get("/finishing/batch-info/:batchId", async (req, res) => {
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
router.post("/finishing", async (req, res) => {
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
  if (input <= 0) return res.status(400).json({ error: "Input quantity must be greater than zero." });
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

router.put("/finishing/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { operator, processDate, remarks } = req.body;
  const [row] = await db
    .update(finishingRecordsTable)
    .set({
      operator: operator !== undefined ? operator : undefined,
      processDate: processDate ? new Date(processDate) : undefined,
      remarks: remarks !== undefined ? remarks : undefined,
    })
    .where(eq(finishingRecordsTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Finishing record not found." });
  await logAudit(req, "UPDATE", "finishing_records", String(id), `Updated finishing record #${id}`);
  res.json(row);
});

export default router;
