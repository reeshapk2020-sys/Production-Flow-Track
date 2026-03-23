import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  allocationsTable,
  receivingsTable,
  cuttingBatchesTable,
  stitchersTable,
  teamsTable,
  finishingRecordsTable,
  finishedGoodsTable,
  productsTable,
  sizesTable,
  colorsTable,
  auditLogsTable,
} from "@workspace/db/schema";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import { checkPermission } from "./permissions.js";

const router: IRouter = Router();

router.get("/dashboard", checkPermission("reports", "view"), async (_req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [todayCutting] = await db
    .select({ qty: sql<number>`COALESCE(SUM(${cuttingBatchesTable.quantityCut}), 0)::int` })
    .from(cuttingBatchesTable)
    .where(gte(cuttingBatchesTable.cuttingDate, today));

  const [todayAllocation] = await db
    .select({ qty: sql<number>`COALESCE(SUM(${allocationsTable.quantityIssued}), 0)::int` })
    .from(allocationsTable)
    .where(gte(allocationsTable.issueDate, today));

  const [todayReceived] = await db
    .select({ qty: sql<number>`COALESCE(SUM(${receivingsTable.quantityReceived}), 0)::int` })
    .from(receivingsTable)
    .where(gte(receivingsTable.receiveDate, today));

  const [todayFinished] = await db
    .select({ qty: sql<number>`COALESCE(SUM(${finishedGoodsTable.quantity}), 0)::int` })
    .from(finishedGoodsTable)
    .where(gte(finishedGoodsTable.entryDate, today));

  const [pendingStitchers] = await db
    .select({
      qty: sql<number>`COALESCE(SUM(${allocationsTable.quantityIssued} - ${allocationsTable.quantityReceived} - ${allocationsTable.quantityRejected}), 0)::int`,
    })
    .from(allocationsTable)
    .where(
      sql`${allocationsTable.quantityIssued} - ${allocationsTable.quantityReceived} - ${allocationsTable.quantityRejected} > 0`
    );

  const [pendingFinishing] = await db
    .select({
      qty: sql<number>`COALESCE(SUM(${finishingRecordsTable.inputQuantity} - ${finishingRecordsTable.outputQuantity} - ${finishingRecordsTable.defectiveQuantity}), 0)::int`,
    })
    .from(finishingRecordsTable);

  const [finishedStock] = await db
    .select({ qty: sql<number>`COALESCE(SUM(${finishedGoodsTable.quantity}), 0)::int` })
    .from(finishedGoodsTable);

  const [rawRolls] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(cuttingBatchesTable);

  // Top stitchers
  const topStitchers = await db
    .select({
      stitcherId: stitchersTable.id,
      stitcherName: stitchersTable.name,
      teamName: teamsTable.name,
      totalIssued: sql<number>`COALESCE(SUM(${allocationsTable.quantityIssued}), 0)::int`,
      totalReceived: sql<number>`COALESCE(SUM(${allocationsTable.quantityReceived}), 0)::int`,
      totalPending: sql<number>`COALESCE(SUM(${allocationsTable.quantityIssued} - ${allocationsTable.quantityReceived} - ${allocationsTable.quantityRejected}), 0)::int`,
      totalRejected: sql<number>`COALESCE(SUM(${allocationsTable.quantityRejected}), 0)::int`,
    })
    .from(stitchersTable)
    .leftJoin(teamsTable, eq(stitchersTable.teamId, teamsTable.id))
    .leftJoin(allocationsTable, eq(allocationsTable.stitcherId, stitchersTable.id))
    .groupBy(stitchersTable.id, stitchersTable.name, teamsTable.name)
    .orderBy(sql`COALESCE(SUM(${allocationsTable.quantityReceived}), 0) desc`)
    .limit(5);

  const topStitchersResult = topStitchers.map((s) => ({
    ...s,
    efficiencyPct:
      s.totalIssued > 0 ? Math.round((s.totalReceived / s.totalIssued) * 100) : 0,
  }));

  // Recent batches
  const recentBatches = await db
    .select({
      id: cuttingBatchesTable.id,
      batchNumber: cuttingBatchesTable.batchNumber,
      productCode: productsTable.code,
      productName: productsTable.name,
      sizeName: sizesTable.name,
      colorCode: colorsTable.code,
      colorName: colorsTable.name,
      quantityCut: cuttingBatchesTable.quantityCut,
      availableForAllocation: cuttingBatchesTable.availableForAllocation,
      status: cuttingBatchesTable.status,
      cuttingDate: cuttingBatchesTable.cuttingDate,
      createdAt: cuttingBatchesTable.createdAt,
    })
    .from(cuttingBatchesTable)
    .leftJoin(productsTable, eq(cuttingBatchesTable.productId, productsTable.id))
    .leftJoin(sizesTable, eq(cuttingBatchesTable.sizeId, sizesTable.id))
    .leftJoin(colorsTable, eq(cuttingBatchesTable.colorId, colorsTable.id))
    .orderBy(sql`${cuttingBatchesTable.createdAt} desc`)
    .limit(10);

  // Stage-wise pending
  const stageWisePending = [
    { stage: "Cutting (Available)", pendingQuantity: 0, batchCount: 0 },
    { stage: "With Stitchers", pendingQuantity: pendingStitchers.qty || 0, batchCount: 0 },
    { stage: "Finishing", pendingQuantity: Math.max(0, pendingFinishing.qty || 0), batchCount: 0 },
  ];

  res.json({
    todayCuttingQty: todayCutting.qty || 0,
    todayAllocationQty: todayAllocation.qty || 0,
    todayReceivedQty: todayReceived.qty || 0,
    todayFinishedQty: todayFinished.qty || 0,
    totalRawMaterialRolls: rawRolls.count || 0,
    pendingWithStitchers: pendingStitchers.qty || 0,
    pendingInFinishing: Math.max(0, pendingFinishing.qty || 0),
    finishedStockQty: finishedStock.qty || 0,
    topStitchers: topStitchersResult,
    recentBatches: recentBatches.map((b) => ({
      ...b,
      totalAllocated: b.quantityCut - b.availableForAllocation,
    })),
    stageWisePending,
  });
});

router.get("/reports/stitcher-performance", checkPermission("reports", "view"), async (req, res) => {
  const { startDate, endDate, stitcherId, teamId } = req.query;
  const conditions: any[] = [eq(allocationsTable.allocationType, "individual")];
  if (startDate) conditions.push(gte(allocationsTable.issueDate, new Date(startDate as string)));
  if (endDate) { const ed = new Date(endDate as string); ed.setDate(ed.getDate() + 1); conditions.push(lte(allocationsTable.issueDate, ed)); }
  if (stitcherId) conditions.push(eq(stitchersTable.id, Number(stitcherId)));
  if (teamId) conditions.push(eq(teamsTable.id, Number(teamId)));

  const rows = await db
    .select({
      stitcherId: stitchersTable.id,
      stitcherName: stitchersTable.name,
      teamName: teamsTable.name,
      totalIssued: sql<number>`COALESCE(SUM(${allocationsTable.quantityIssued}), 0)::int`,
      totalReceived: sql<number>`COALESCE(SUM(${allocationsTable.quantityReceived}), 0)::int`,
      totalPending: sql<number>`COALESCE(SUM(${allocationsTable.quantityIssued} - ${allocationsTable.quantityReceived} - ${allocationsTable.quantityRejected}), 0)::int`,
      totalRejected: sql<number>`COALESCE(SUM(${allocationsTable.quantityRejected}), 0)::int`,
    })
    .from(stitchersTable)
    .leftJoin(teamsTable, eq(stitchersTable.teamId, teamsTable.id))
    .leftJoin(allocationsTable, and(eq(allocationsTable.stitcherId, stitchersTable.id), ...conditions))
    .groupBy(stitchersTable.id, stitchersTable.name, teamsTable.name)
    .orderBy(sql`COALESCE(SUM(${allocationsTable.quantityIssued}), 0) desc`);

  const result = rows.map((r) => ({
    ...r,
    efficiencyPct: r.totalIssued > 0 ? Math.round((r.totalReceived / r.totalIssued) * 100) : 0,
  }));
  res.json(result);
});

router.get("/reports/team-performance", checkPermission("reports", "view"), async (req, res) => {
  const { startDate, endDate, teamId } = req.query;
  const conditions: any[] = [eq(allocationsTable.allocationType, "team")];
  if (startDate) conditions.push(gte(allocationsTable.issueDate, new Date(startDate as string)));
  if (endDate) { const ed = new Date(endDate as string); ed.setDate(ed.getDate() + 1); conditions.push(lte(allocationsTable.issueDate, ed)); }
  if (teamId) conditions.push(eq(teamsTable.id, Number(teamId)));

  const rows = await db
    .select({
      teamId: teamsTable.id,
      teamName: teamsTable.name,
      teamCode: teamsTable.code,
      memberCount: sql<number>`(SELECT COUNT(*) FROM stitchers WHERE stitchers.team_id = ${teamsTable.id} AND stitchers.is_active = true)::int`,
      totalIssued: sql<number>`COALESCE(SUM(${allocationsTable.quantityIssued}), 0)::int`,
      totalReceived: sql<number>`COALESCE(SUM(${allocationsTable.quantityReceived}), 0)::int`,
      totalPending: sql<number>`COALESCE(SUM(${allocationsTable.quantityIssued} - ${allocationsTable.quantityReceived} - ${allocationsTable.quantityRejected}), 0)::int`,
      totalRejected: sql<number>`COALESCE(SUM(${allocationsTable.quantityRejected}), 0)::int`,
    })
    .from(teamsTable)
    .leftJoin(allocationsTable, and(eq(allocationsTable.teamId, teamsTable.id), ...conditions))
    .where(eq(teamsTable.isActive, true))
    .groupBy(teamsTable.id, teamsTable.name, teamsTable.code)
    .orderBy(sql`COALESCE(SUM(${allocationsTable.quantityIssued}), 0) desc`);

  const result = rows.map((r) => ({
    ...r,
    efficiencyPct: r.totalIssued > 0 ? Math.round((r.totalReceived / r.totalIssued) * 100) : 0,
  }));
  res.json(result);
});

router.get("/reports/daily-production", checkPermission("reports", "view"), async (req, res) => {
  const startStr = (req.query.startDate as string) || (req.query.date as string) || new Date().toISOString().split("T")[0];
  const endStr = (req.query.endDate as string) || startStr;

  const startDate = new Date(startStr);
  const endDate = new Date(endStr);
  endDate.setDate(endDate.getDate() + 1);

  const [cutting] = await db
    .select({ qty: sql<number>`COALESCE(SUM(${cuttingBatchesTable.quantityCut}), 0)::int` })
    .from(cuttingBatchesTable)
    .where(and(gte(cuttingBatchesTable.cuttingDate, startDate), lte(cuttingBatchesTable.cuttingDate, endDate)));

  const [allocated] = await db
    .select({ qty: sql<number>`COALESCE(SUM(${allocationsTable.quantityIssued}), 0)::int` })
    .from(allocationsTable)
    .where(and(gte(allocationsTable.issueDate, startDate), lte(allocationsTable.issueDate, endDate)));

  const [received] = await db
    .select({ qty: sql<number>`COALESCE(SUM(${receivingsTable.quantityReceived}), 0)::int` })
    .from(receivingsTable)
    .where(and(gte(receivingsTable.receiveDate, startDate), lte(receivingsTable.receiveDate, endDate)));

  const [finishing] = await db
    .select({ qty: sql<number>`COALESCE(SUM(${finishingRecordsTable.outputQuantity}), 0)::int` })
    .from(finishingRecordsTable)
    .where(and(gte(finishingRecordsTable.processDate, startDate), lte(finishingRecordsTable.processDate, endDate)));

  const [finished] = await db
    .select({ qty: sql<number>`COALESCE(SUM(${finishedGoodsTable.quantity}), 0)::int` })
    .from(finishedGoodsTable)
    .where(and(gte(finishedGoodsTable.entryDate, startDate), lte(finishedGoodsTable.entryDate, endDate)));

  res.json({
    startDate: startStr,
    endDate: endStr,
    date: startStr,
    cutting: cutting.qty || 0,
    allocated: allocated.qty || 0,
    received: received.qty || 0,
    finishing: finishing.qty || 0,
    finished: finished.qty || 0,
  });
});

router.get("/reports/stage-pending", checkPermission("reports", "view"), async (_req, res) => {
  const [pendingStitchers] = await db
    .select({
      qty: sql<number>`COALESCE(SUM(${allocationsTable.quantityIssued} - ${allocationsTable.quantityReceived} - ${allocationsTable.quantityRejected}), 0)::int`,
      cnt: sql<number>`COUNT(*)::int`,
    })
    .from(allocationsTable)
    .where(
      sql`${allocationsTable.quantityIssued} - ${allocationsTable.quantityReceived} - ${allocationsTable.quantityRejected} > 0`
    );

  // Aggregate all finishing records (all historical stages + new "finishing") into a single row
  const [finishingPending] = await db
    .select({
      qty: sql<number>`COALESCE(SUM(${finishingRecordsTable.inputQuantity} - ${finishingRecordsTable.outputQuantity} - ${finishingRecordsTable.defectiveQuantity}), 0)::int`,
      cnt: sql<number>`COUNT(DISTINCT ${finishingRecordsTable.cuttingBatchId})::int`,
    })
    .from(finishingRecordsTable);

  res.json([
    { stage: "With Stitchers", pendingQuantity: pendingStitchers.qty || 0, batchCount: pendingStitchers.cnt || 0 },
    { stage: "Finishing", pendingQuantity: Math.max(0, finishingPending.qty || 0), batchCount: finishingPending.cnt || 0 },
  ]);
});

router.get("/reports/batch-status", checkPermission("reports", "view"), async (req, res) => {
  const rows = await db
    .select({
      batchNumber: cuttingBatchesTable.batchNumber,
      productName: productsTable.name,
      sizeName: sizesTable.name,
      colorName: colorsTable.name,
      quantityCut: cuttingBatchesTable.quantityCut,
      quantityAllocated: sql<number>`(${cuttingBatchesTable.quantityCut} - ${cuttingBatchesTable.availableForAllocation})::int`,
      status: cuttingBatchesTable.status,
      cuttingDate: cuttingBatchesTable.cuttingDate,
    })
    .from(cuttingBatchesTable)
    .leftJoin(productsTable, eq(cuttingBatchesTable.productId, productsTable.id))
    .leftJoin(sizesTable, eq(cuttingBatchesTable.sizeId, sizesTable.id))
    .leftJoin(colorsTable, eq(cuttingBatchesTable.colorId, colorsTable.id))
    .orderBy(sql`${cuttingBatchesTable.createdAt} desc`);

  res.json(
    rows.map((r) => ({
      ...r,
      currentStage: r.status || "cutting",
      quantityReceived: 0,
      quantityFinished: 0,
    }))
  );
});

router.get("/reports/wip", checkPermission("reports", "view"), async (_req, res) => {
  const batches = await db
    .select({
      batchNumber: cuttingBatchesTable.batchNumber,
      productCode: productsTable.code,
      productName: productsTable.name,
      status: cuttingBatchesTable.status,
      availableForAllocation: cuttingBatchesTable.availableForAllocation,
      cuttingDate: cuttingBatchesTable.cuttingDate,
    })
    .from(cuttingBatchesTable)
    .leftJoin(productsTable, eq(cuttingBatchesTable.productId, productsTable.id))
    .where(sql`${cuttingBatchesTable.status} != 'finished' AND ${cuttingBatchesTable.status} != 'completed'`)
    .orderBy(sql`${cuttingBatchesTable.cuttingDate} asc`);

  const now = new Date();
  res.json(
    batches.map((b) => {
      const daysSince = b.cuttingDate
        ? Math.floor((now.getTime() - new Date(b.cuttingDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      return {
        batchNumber: b.batchNumber,
        productCode: b.productCode || null,
        productName: b.productName || "Unknown",
        stage: b.status || "cutting",
        quantity: b.availableForAllocation,
        daysSinceLastMovement: daysSince,
        isDelayed: daysSince > 7,
      };
    })
  );
});

router.get("/reports/audit-log", checkPermission("reports", "view"), async (req, res) => {
  const rows = await db
    .select()
    .from(auditLogsTable)
    .orderBy(sql`${auditLogsTable.createdAt} desc`)
    .limit(200);
  res.json(rows);
});

export default router;
