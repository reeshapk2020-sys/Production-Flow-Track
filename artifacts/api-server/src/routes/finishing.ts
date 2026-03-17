import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  finishingRecordsTable,
  cuttingBatchesTable,
  productsTable,
  sizesTable,
  colorsTable,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { logAudit } from "../lib/audit.js";

const router: IRouter = Router();

router.get("/finishing", async (req, res) => {
  const { stage } = req.query;

  let query = db
    .select({
      id: finishingRecordsTable.id,
      cuttingBatchId: finishingRecordsTable.cuttingBatchId,
      batchNumber: cuttingBatchesTable.batchNumber,
      stage: finishingRecordsTable.stage,
      productName: productsTable.name,
      sizeName: sizesTable.name,
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
    .$dynamic();

  if (stage) {
    query = query.where(eq(finishingRecordsTable.stage, stage as any));
  }

  const rows = await query.orderBy(sql`${finishingRecordsTable.createdAt} desc`);
  const result = rows.map((r) => ({
    ...r,
    pendingQuantity: r.inputQuantity - r.outputQuantity - r.defectiveQuantity,
  }));
  res.json(result);
});

router.post("/finishing", async (req, res) => {
  const {
    cuttingBatchId,
    stage,
    inputQuantity,
    outputQuantity,
    defectiveQuantity = 0,
    operator,
    processDate,
    remarks,
  } = req.body;

  const [record] = await db
    .insert(finishingRecordsTable)
    .values({
      cuttingBatchId,
      stage,
      inputQuantity,
      outputQuantity,
      defectiveQuantity,
      operator,
      processDate: new Date(processDate),
      remarks,
      createdBy: (req as any).user?.username,
    })
    .returning();

  // Update batch status to finishing
  await db
    .update(cuttingBatchesTable)
    .set({ status: "finishing" })
    .where(eq(cuttingBatchesTable.id, cuttingBatchId));

  await logAudit(
    req,
    "CREATE",
    "finishing_records",
    String(record.id),
    `Recorded ${stage} finishing for batch ${cuttingBatchId}: in=${inputQuantity}, out=${outputQuantity}`
  );

  res.status(201).json({
    ...record,
    pendingQuantity: inputQuantity - outputQuantity - defectiveQuantity,
  });
});

export default router;
