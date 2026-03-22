import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  fabricRollsTable,
  cuttingBatchesTable,
  allocationsTable,
  finishingRecordsTable,
  finishedGoodsTable,
} from "@workspace/db/schema";
import { sql, eq } from "drizzle-orm";
import { checkPermission } from "./permissions.js";

const router: IRouter = Router();

router.get("/inventory/summary", checkPermission("inventory", "view"), async (_req, res) => {
  const [rawMaterial] = await db
    .select({
      totalRolls: sql<number>`COUNT(*)::int`,
      totalQuantity: sql<number>`COALESCE(SUM(${fabricRollsTable.availableQuantity}), 0)::numeric`,
    })
    .from(fabricRollsTable)
    .where(sql`${fabricRollsTable.status} != 'exhausted'`);

  const [cuttingWip] = await db
    .select({
      totalBatches: sql<number>`COUNT(*)::int`,
      totalQuantity: sql<number>`COALESCE(SUM(${cuttingBatchesTable.availableForAllocation}), 0)::int`,
    })
    .from(cuttingBatchesTable)
    .where(sql`${cuttingBatchesTable.availableForAllocation} > 0`);

  const [pendingWithStitchers] = await db
    .select({
      totalAllocations: sql<number>`COUNT(*)::int`,
      totalQuantity: sql<number>`COALESCE(SUM(${allocationsTable.quantityIssued} - ${allocationsTable.quantityReceived} - ${allocationsTable.quantityRejected}), 0)::int`,
    })
    .from(allocationsTable)
    .where(sql`${allocationsTable.quantityIssued} - ${allocationsTable.quantityReceived} - ${allocationsTable.quantityRejected} > 0`);

  // Finishing stage quantities (latest record per batch per stage)
  const [pressingQty] = await db
    .select({ qty: sql<number>`COALESCE(SUM(${finishingRecordsTable.inputQuantity} - ${finishingRecordsTable.outputQuantity} - ${finishingRecordsTable.defectiveQuantity}), 0)::int` })
    .from(finishingRecordsTable)
    .where(eq(finishingRecordsTable.stage, "pressing"));

  const [buttonsQty] = await db
    .select({ qty: sql<number>`COALESCE(SUM(${finishingRecordsTable.inputQuantity} - ${finishingRecordsTable.outputQuantity} - ${finishingRecordsTable.defectiveQuantity}), 0)::int` })
    .from(finishingRecordsTable)
    .where(eq(finishingRecordsTable.stage, "buttons"));

  const [hangerQty] = await db
    .select({ qty: sql<number>`COALESCE(SUM(${finishingRecordsTable.inputQuantity} - ${finishingRecordsTable.outputQuantity} - ${finishingRecordsTable.defectiveQuantity}), 0)::int` })
    .from(finishingRecordsTable)
    .where(eq(finishingRecordsTable.stage, "hanger"));

  const [packingQty] = await db
    .select({ qty: sql<number>`COALESCE(SUM(${finishingRecordsTable.inputQuantity} - ${finishingRecordsTable.outputQuantity} - ${finishingRecordsTable.defectiveQuantity}), 0)::int` })
    .from(finishingRecordsTable)
    .where(eq(finishingRecordsTable.stage, "packing"));

  const [finishedGoods] = await db
    .select({ totalQuantity: sql<number>`COALESCE(SUM(${finishedGoodsTable.quantity}), 0)::int` })
    .from(finishedGoodsTable);

  res.json({
    rawMaterial: {
      totalRolls: rawMaterial.totalRolls || 0,
      totalQuantity: Number(rawMaterial.totalQuantity) || 0,
    },
    cuttingWip: {
      totalBatches: cuttingWip.totalBatches || 0,
      totalQuantity: cuttingWip.totalQuantity || 0,
    },
    pendingWithStitchers: {
      totalAllocations: pendingWithStitchers.totalAllocations || 0,
      totalQuantity: pendingWithStitchers.totalQuantity || 0,
    },
    inFinishing: {
      pressing: Math.max(0, pressingQty.qty || 0),
      buttons: Math.max(0, buttonsQty.qty || 0),
      hanger: Math.max(0, hangerQty.qty || 0),
      packing: Math.max(0, packingQty.qty || 0),
    },
    finishedGoods: {
      totalQuantity: finishedGoods.totalQuantity || 0,
    },
  });
});

export default router;
