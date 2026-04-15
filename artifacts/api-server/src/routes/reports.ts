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
  outsourceTransfersTable,
  manualPausesTable,
  offDaysTable,
  timeSettingsTable,
} from "@workspace/db/schema";
import { eq, sql, and, gte, lte, ilike } from "drizzle-orm";
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
  const { startDate, endDate, stitcherId, teamId, productId } = req.query;
  const joinConditions: any[] = [
    eq(allocationsTable.stitcherId, stitchersTable.id),
    eq(allocationsTable.allocationType, "individual"),
    sql`COALESCE(${allocationsTable.workType}, 'simple_stitch') != 'outsource_required'`,
  ];
  if (startDate) joinConditions.push(gte(allocationsTable.issueDate, new Date(startDate as string)));
  if (endDate) { const ed = new Date(endDate as string); ed.setDate(ed.getDate() + 1); joinConditions.push(lte(allocationsTable.issueDate, ed)); }

  const whereConditions: any[] = [];
  if (stitcherId) whereConditions.push(eq(stitchersTable.id, Number(stitcherId)));
  if (teamId) whereConditions.push(eq(stitchersTable.teamId, Number(teamId)));
  if (productId) whereConditions.push(eq(cuttingBatchesTable.productId, Number(productId)));

  let q = db
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
    .leftJoin(allocationsTable, and(...joinConditions))
    .leftJoin(cuttingBatchesTable, eq(allocationsTable.cuttingBatchId, cuttingBatchesTable.id))
    .$dynamic();
  if (whereConditions.length > 0) q = q.where(and(...whereConditions)) as any;
  const rows = await q
    .groupBy(stitchersTable.id, stitchersTable.name, teamsTable.name)
    .orderBy(sql`COALESCE(SUM(${allocationsTable.quantityIssued}), 0) desc`);

  const result = rows.map((r) => ({
    ...r,
    efficiencyPct: r.totalIssued > 0 ? Math.round((r.totalReceived / r.totalIssued) * 100) : 0,
  }));
  res.json(result);
});

router.get("/reports/team-performance", checkPermission("reports", "view"), async (req, res) => {
  const { startDate, endDate, teamId, productId } = req.query;
  const joinConditions: any[] = [
    eq(allocationsTable.teamId, teamsTable.id),
    eq(allocationsTable.allocationType, "team"),
    sql`COALESCE(${allocationsTable.workType}, 'simple_stitch') != 'outsource_required'`,
  ];
  if (startDate) joinConditions.push(gte(allocationsTable.issueDate, new Date(startDate as string)));
  if (endDate) { const ed = new Date(endDate as string); ed.setDate(ed.getDate() + 1); joinConditions.push(lte(allocationsTable.issueDate, ed)); }

  const whereConditions: any[] = [eq(teamsTable.isActive, true)];
  if (teamId) whereConditions.push(eq(teamsTable.id, Number(teamId)));
  if (productId) whereConditions.push(eq(cuttingBatchesTable.productId, Number(productId)));

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
    .leftJoin(allocationsTable, and(...joinConditions))
    .leftJoin(cuttingBatchesTable, eq(allocationsTable.cuttingBatchId, cuttingBatchesTable.id))
    .where(and(...whereConditions))
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
  const productId = req.query.productId ? Number(req.query.productId) : null;

  const pFilter = productId ? sql`AND cb.product_id = ${productId}` : sql``;
  const pFilterAlloc = productId ? sql`AND cb2.product_id = ${productId}` : sql``;

  const rows = await db.execute(sql`
    WITH date_series AS (
      SELECT d::date AS day
      FROM generate_series(${startStr}::date, ${endStr}::date, '1 day'::interval) d
    )
    SELECT
      ds.day::text AS date,
      COALESCE((SELECT SUM(cb.quantity_cut)::int FROM cutting_batches cb WHERE cb.cutting_date::date = ds.day ${pFilter}), 0) AS cutting,
      COALESCE((SELECT SUM(a.quantity_issued)::int FROM allocations a JOIN cutting_batches cb2 ON a.cutting_batch_id = cb2.id WHERE a.issue_date::date = ds.day ${pFilterAlloc}), 0) AS allocated,
      COALESCE((SELECT SUM(r.quantity_received)::int FROM receivings r JOIN allocations a2 ON r.allocation_id = a2.id JOIN cutting_batches cb3 ON a2.cutting_batch_id = cb3.id WHERE r.receive_date::date = ds.day ${productId ? sql`AND cb3.product_id = ${productId}` : sql``}), 0) AS received,
      COALESCE((SELECT SUM(f.output_quantity)::int FROM finishing_records f JOIN cutting_batches cb4 ON f.cutting_batch_id = cb4.id WHERE f.process_date::date = ds.day ${productId ? sql`AND cb4.product_id = ${productId}` : sql``}), 0) AS finishing,
      COALESCE((SELECT SUM(fg.quantity)::int FROM finished_goods fg JOIN cutting_batches cb5 ON fg.cutting_batch_id = cb5.id WHERE fg.entry_date::date = ds.day ${productId ? sql`AND cb5.product_id = ${productId}` : sql``}), 0) AS finished,
      COALESCE((SELECT SUM(ot.quantity_sent)::int FROM outsource_transfers ot JOIN allocations a3 ON ot.allocation_id = a3.id JOIN cutting_batches cb6 ON a3.cutting_batch_id = cb6.id WHERE ot.send_date::date = ds.day ${productId ? sql`AND cb6.product_id = ${productId}` : sql``}), 0) AS outsource_sent,
      COALESCE((SELECT SUM(ot2.quantity_returned)::int FROM outsource_transfers ot2 JOIN allocations a4 ON ot2.allocation_id = a4.id JOIN cutting_batches cb7 ON a4.cutting_batch_id = cb7.id WHERE ot2.return_date::date = ds.day ${productId ? sql`AND cb7.product_id = ${productId}` : sql``}), 0) AS outsource_returned,
      COALESCE((SELECT SUM(f2.input_quantity)::int FROM finishing_records f2 JOIN cutting_batches cb8 ON f2.cutting_batch_id = cb8.id WHERE f2.process_date::date = ds.day ${productId ? sql`AND cb8.product_id = ${productId}` : sql``}), 0) AS finishing_input
    FROM date_series ds
    ORDER BY ds.day
  `);

  res.json(rows.rows);
});

router.get("/reports/daily-production-detail", checkPermission("reports", "view"), async (req, res) => {
  const startStr = (req.query.startDate as string) || (req.query.date as string) || new Date().toISOString().split("T")[0];
  const endStr = (req.query.endDate as string) || startStr;
  const productId = req.query.productId ? Number(req.query.productId) : null;

  const dateConditions: any[] = [
    gte(allocationsTable.issueDate, new Date(startStr)),
  ];
  const ed = new Date(endStr); ed.setDate(ed.getDate() + 1);
  dateConditions.push(lte(allocationsTable.issueDate, ed));

  const recvDateStart = new Date(startStr);
  const recvDateEnd = new Date(endStr); recvDateEnd.setDate(recvDateEnd.getDate() + 1);

  const teamAllocConditions: any[] = [eq(teamsTable.isActive, true)];
  if (productId) teamAllocConditions.push(eq(cuttingBatchesTable.productId, productId));

  const teamAllocRows = await db
    .select({
      teamId: teamsTable.id,
      teamName: teamsTable.name,
      totalAllocated: sql<number>`COALESCE(SUM(${allocationsTable.quantityIssued}), 0)::int`,
    })
    .from(teamsTable)
    .leftJoin(allocationsTable, and(
      eq(allocationsTable.teamId, teamsTable.id),
      eq(allocationsTable.allocationType, "team"),
      ...dateConditions
    ))
    .leftJoin(cuttingBatchesTable, eq(allocationsTable.cuttingBatchId, cuttingBatchesTable.id))
    .where(and(...teamAllocConditions))
    .groupBy(teamsTable.id, teamsTable.name);

  const teamRecvProductCond: any[] = [];
  if (productId) teamRecvProductCond.push(eq(cuttingBatchesTable.productId, productId));
  const teamRecvRows = await db
    .select({
      teamId: allocationsTable.teamId,
      totalReceived: sql<number>`COALESCE(SUM(${receivingsTable.quantityReceived}), 0)::int`,
    })
    .from(receivingsTable)
    .innerJoin(allocationsTable, eq(receivingsTable.allocationId, allocationsTable.id))
    .innerJoin(cuttingBatchesTable, eq(allocationsTable.cuttingBatchId, cuttingBatchesTable.id))
    .where(and(
      eq(allocationsTable.allocationType, "team"),
      gte(receivingsTable.receiveDate, recvDateStart),
      lte(receivingsTable.receiveDate, recvDateEnd),
      ...teamRecvProductCond
    ))
    .groupBy(allocationsTable.teamId);

  const teamRecvMap = new Map(teamRecvRows.map(r => [r.teamId, r.totalReceived]));
  const teamRows = teamAllocRows.map(t => ({
    ...t,
    totalReceived: teamRecvMap.get(t.teamId) || 0,
  }));

  const stitcherAllocConditions: any[] = [eq(stitchersTable.isActive, true)];
  if (productId) stitcherAllocConditions.push(eq(cuttingBatchesTable.productId, productId));

  const stitcherAllocRows = await db
    .select({
      stitcherId: stitchersTable.id,
      stitcherName: stitchersTable.name,
      teamName: teamsTable.name,
      totalAllocated: sql<number>`COALESCE(SUM(${allocationsTable.quantityIssued}), 0)::int`,
    })
    .from(stitchersTable)
    .leftJoin(teamsTable, eq(stitchersTable.teamId, teamsTable.id))
    .leftJoin(allocationsTable, and(
      eq(allocationsTable.stitcherId, stitchersTable.id),
      eq(allocationsTable.allocationType, "individual"),
      gte(allocationsTable.issueDate, new Date(startStr)),
      lte(allocationsTable.issueDate, ed),
    ))
    .leftJoin(cuttingBatchesTable, eq(allocationsTable.cuttingBatchId, cuttingBatchesTable.id))
    .where(and(...stitcherAllocConditions))
    .groupBy(stitchersTable.id, stitchersTable.name, teamsTable.name);

  const stitcherRecvProductCond: any[] = [];
  if (productId) stitcherRecvProductCond.push(eq(cuttingBatchesTable.productId, productId));
  const stitcherRecvRows = await db
    .select({
      stitcherId: allocationsTable.stitcherId,
      totalReceived: sql<number>`COALESCE(SUM(${receivingsTable.quantityReceived}), 0)::int`,
    })
    .from(receivingsTable)
    .innerJoin(allocationsTable, eq(receivingsTable.allocationId, allocationsTable.id))
    .innerJoin(cuttingBatchesTable, eq(allocationsTable.cuttingBatchId, cuttingBatchesTable.id))
    .where(and(
      eq(allocationsTable.allocationType, "individual"),
      gte(receivingsTable.receiveDate, recvDateStart),
      lte(receivingsTable.receiveDate, recvDateEnd),
      ...stitcherRecvProductCond
    ))
    .groupBy(allocationsTable.stitcherId);

  const stitcherRecvMap = new Map(stitcherRecvRows.map(r => [r.stitcherId, r.totalReceived]));
  const stitcherRows = stitcherAllocRows.map(s => ({
    ...s,
    totalReceived: stitcherRecvMap.get(s.stitcherId) || 0,
  }));

  res.json({
    teams: teamRows.filter(t => t.totalAllocated > 0 || t.totalReceived > 0),
    stitchers: stitcherRows.filter(s => s.totalAllocated > 0 || s.totalReceived > 0).sort((a, b) => b.totalAllocated - a.totalAllocated),
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
  const { batchNumber, productId } = req.query;
  const conditions: any[] = [];
  if (batchNumber) conditions.push(ilike(cuttingBatchesTable.batchNumber, `%${batchNumber}%`));
  if (productId) conditions.push(eq(cuttingBatchesTable.productId, Number(productId)));

  let q = db
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
    .leftJoin(colorsTable, eq(cuttingBatchesTable.colorId, colorsTable.id));
  if (conditions.length > 0) q = q.where(and(...conditions)) as any;
  const rows = await q.orderBy(sql`${cuttingBatchesTable.createdAt} desc`);

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

router.get("/reports/stitcher-points", checkPermission("reports", "view"), async (req, res) => {
  const { startDate, endDate, stitcherId, productId } = req.query;
  const conditions: any[] = [];
  if (startDate) conditions.push(gte(receivingsTable.receiveDate, new Date(startDate as string)));
  if (endDate) { const ed = new Date(endDate as string); ed.setDate(ed.getDate() + 1); conditions.push(lte(receivingsTable.receiveDate, ed)); }
  if (stitcherId) conditions.push(eq(allocationsTable.stitcherId, Number(stitcherId)));
  if (productId) conditions.push(eq(cuttingBatchesTable.productId, Number(productId)));

  const rows = await db
    .select({
      stitcherId: stitchersTable.id,
      stitcherName: stitchersTable.name,
      teamName: teamsTable.name,
      productCode: productsTable.code,
      productName: productsTable.name,
      productPointsPerPiece: productsTable.pointsPerPiece,
      snapshotPointsPerPiece: allocationsTable.pointsPerPiece,
      manualPointsPerPiece: allocationsTable.manualPointsPerPiece,
      completedQty: sql<number>`COALESCE(SUM(${receivingsTable.quantityReceived}), 0)::int`,
    })
    .from(receivingsTable)
    .innerJoin(allocationsTable, eq(receivingsTable.allocationId, allocationsTable.id))
    .innerJoin(cuttingBatchesTable, eq(allocationsTable.cuttingBatchId, cuttingBatchesTable.id))
    .innerJoin(productsTable, eq(cuttingBatchesTable.productId, productsTable.id))
    .innerJoin(stitchersTable, eq(allocationsTable.stitcherId, stitchersTable.id))
    .leftJoin(teamsTable, eq(stitchersTable.teamId, teamsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(stitchersTable.id, stitchersTable.name, teamsTable.name, productsTable.id, productsTable.code, productsTable.name, productsTable.pointsPerPiece, allocationsTable.pointsPerPiece, allocationsTable.manualPointsPerPiece)
    .orderBy(stitchersTable.name, productsTable.code);

  const result = rows.map(r => {
    const pts = r.manualPointsPerPiece != null ? Number(r.manualPointsPerPiece) : (r.snapshotPointsPerPiece != null ? Number(r.snapshotPointsPerPiece) : (r.productPointsPerPiece ? Number(r.productPointsPerPiece) : 0));
    return {
      stitcherId: r.stitcherId,
      stitcherName: r.stitcherName,
      teamName: r.teamName,
      productCode: r.productCode,
      productName: r.productName,
      pointsPerPiece: pts,
      completedQty: r.completedQty,
      totalPoints: Math.round(r.completedQty * pts * 100) / 100,
    };
  });
  res.json(result);
});

router.get("/reports/team-points", checkPermission("reports", "view"), async (req, res) => {
  const { startDate, endDate, teamId, productId } = req.query;
  const conditions: any[] = [eq(allocationsTable.allocationType, "team")];
  if (startDate) conditions.push(gte(receivingsTable.receiveDate, new Date(startDate as string)));
  if (endDate) { const ed = new Date(endDate as string); ed.setDate(ed.getDate() + 1); conditions.push(lte(receivingsTable.receiveDate, ed)); }
  if (teamId) conditions.push(eq(allocationsTable.teamId, Number(teamId)));
  if (productId) conditions.push(eq(cuttingBatchesTable.productId, Number(productId)));

  const rows = await db
    .select({
      teamId: teamsTable.id,
      teamName: teamsTable.name,
      teamCode: teamsTable.code,
      productCode: productsTable.code,
      productName: productsTable.name,
      productPointsPerPiece: productsTable.pointsPerPiece,
      snapshotPointsPerPiece: allocationsTable.pointsPerPiece,
      manualPointsPerPiece: allocationsTable.manualPointsPerPiece,
      completedQty: sql<number>`COALESCE(SUM(${receivingsTable.quantityReceived}), 0)::int`,
    })
    .from(receivingsTable)
    .innerJoin(allocationsTable, eq(receivingsTable.allocationId, allocationsTable.id))
    .innerJoin(cuttingBatchesTable, eq(allocationsTable.cuttingBatchId, cuttingBatchesTable.id))
    .innerJoin(productsTable, eq(cuttingBatchesTable.productId, productsTable.id))
    .innerJoin(teamsTable, eq(allocationsTable.teamId, teamsTable.id))
    .where(and(...conditions))
    .groupBy(teamsTable.id, teamsTable.name, teamsTable.code, productsTable.id, productsTable.code, productsTable.name, productsTable.pointsPerPiece, allocationsTable.pointsPerPiece, allocationsTable.manualPointsPerPiece)
    .orderBy(teamsTable.name, productsTable.code);

  const result = rows.map(r => {
    const pts = r.manualPointsPerPiece != null ? Number(r.manualPointsPerPiece) : (r.snapshotPointsPerPiece != null ? Number(r.snapshotPointsPerPiece) : (r.productPointsPerPiece ? Number(r.productPointsPerPiece) : 0));
    return {
      teamId: r.teamId,
      teamName: r.teamName,
      teamCode: r.teamCode,
      productCode: r.productCode,
      productName: r.productName,
      pointsPerPiece: pts,
      completedQty: r.completedQty,
      totalPoints: Math.round(r.completedQty * pts * 100) / 100,
    };
  });
  res.json(result);
});

interface ServerOffDayData {
  weeklyOffDays: Set<number>;
  holidayDates: Set<string>;
}

let _serverOffDays: ServerOffDayData | null = null;
let _serverOffDaysCacheTime = 0;

async function getServerOffDays(): Promise<ServerOffDayData> {
  const now = Date.now();
  if (_serverOffDays && now - _serverOffDaysCacheTime < 60000) return _serverOffDays;
  const rows = await db.select().from(offDaysTable);
  const weeklyOffDays = new Set<number>();
  const holidayDates = new Set<string>();
  for (const r of rows) {
    if (r.type === "weekly" && r.dayOfWeek !== null) weeklyOffDays.add(r.dayOfWeek);
    if (r.type === "holiday" && r.date) holidayDates.add(r.date);
  }
  _serverOffDays = { weeklyOffDays, holidayDates };
  _serverOffDaysCacheTime = now;
  return _serverOffDays;
}

function serverIsOffDay(d: Date, offDays: ServerOffDayData): boolean {
  if (offDays.weeklyOffDays.has(d.getUTCDay())) return true;
  const ds = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  return offDays.holidayDates.has(ds);
}

function serverCalcWorkingMinutesBetween(startDt: Date, endDt: Date, offDays: ServerOffDayData): number {
  if (endDt <= startDt) return 0;
  const SLOTS = [
    { start: 8 * 60, end: 13 * 60 + 20 },
    { start: 14 * 60 + 30, end: 20 * 60, effective: 270 },
    { start: 20 * 60 + 30, end: 23 * 60 },
  ];
  let total = 0;
  let current = new Date(startDt);
  const dayStartUTC = (d: Date) => { const r = new Date(d); r.setUTCHours(0, 0, 0, 0); return r; };
  const minuteOfDayUTC = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();
  const endMinuteOfDay = minuteOfDayUTC(endDt);
  const endDayStart = dayStartUTC(endDt).getTime();
  for (let guard = 0; guard < 730; guard++) {
    const todayBase = dayStartUTC(current);
    const isEndDay = todayBase.getTime() === endDayStart;
    if (serverIsOffDay(todayBase, offDays)) {
      if (isEndDay) break;
      current = new Date(todayBase.getTime() + 24 * 60 * 60000);
      current.setUTCHours(0, 0, 0, 0);
      continue;
    }
    const curMinute = minuteOfDayUTC(current);
    for (const slot of SLOTS) {
      const effectiveStart = Math.max(curMinute, slot.start);
      const slotEnd = isEndDay ? Math.min(slot.end, endMinuteOfDay) : slot.end;
      if (effectiveStart >= slotEnd) continue;
      const rawAvail = slotEnd - effectiveStart;
      const slotTotal = slot.end - slot.start;
      const effectiveTotal = (slot as any).effective || slotTotal;
      const ratio = effectiveTotal / slotTotal;
      total += Math.floor(rawAvail * ratio);
    }
    if (isEndDay) break;
    current = new Date(todayBase.getTime() + 24 * 60 * 60000);
    current.setUTCHours(0, 0, 0, 0);
  }
  return total;
}

router.get("/reports/efficiency", checkPermission("reports", "view"), async (req, res) => {
  const { startDate, endDate, productId } = req.query;
  const conditions: any[] = [];
  if (startDate) conditions.push(gte(receivingsTable.receiveDate, new Date(startDate as string)));
  if (endDate) { const ed = new Date(endDate as string); ed.setDate(ed.getDate() + 1); conditions.push(lte(receivingsTable.receiveDate, ed)); }
  if (productId) conditions.push(eq(cuttingBatchesTable.productId, Number(productId)));

  const offDays = await getServerOffDays();

  const [tsRow] = await db.select({ minutesPerPoint: timeSettingsTable.minutesPerPoint }).from(timeSettingsTable).where(eq(timeSettingsTable.id, 1));
  const minutesPerPoint = tsRow?.minutesPerPoint ?? 20;

  const rows = await db
    .select({
      receivingId: receivingsTable.id,
      allocationId: allocationsTable.id,
      stitcherId: allocationsTable.stitcherId,
      stitcherName: stitchersTable.name,
      teamId: stitchersTable.teamId,
      teamName: teamsTable.name,
      allocationType: allocationsTable.allocationType,
      allocTeamId: allocationsTable.teamId,
      allocTeamName: sql<string>`(SELECT name FROM teams WHERE id = ${allocationsTable.teamId})`,
      quantityReceived: receivingsTable.quantityReceived,
      productPointsPerPiece: productsTable.pointsPerPiece,
      snapshotPointsPerPiece: allocationsTable.pointsPerPiece,
      manualPointsPerPiece: allocationsTable.manualPointsPerPiece,
      issueDate: allocationsTable.issueDate,
      receiveDate: receivingsTable.receiveDate,
      workType: allocationsTable.workType,
      batchNumber: cuttingBatchesTable.batchNumber,
      productCode: productsTable.code,
      productName: productsTable.name,
    })
    .from(receivingsTable)
    .innerJoin(allocationsTable, eq(receivingsTable.allocationId, allocationsTable.id))
    .innerJoin(cuttingBatchesTable, eq(allocationsTable.cuttingBatchId, cuttingBatchesTable.id))
    .innerJoin(productsTable, eq(cuttingBatchesTable.productId, productsTable.id))
    .leftJoin(stitchersTable, eq(allocationsTable.stitcherId, stitchersTable.id))
    .leftJoin(teamsTable, eq(stitchersTable.teamId, teamsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const allocIds = [...new Set(rows.map(r => r.allocationId))];
  let outsourceMap: Record<number, { sendDate: Date; returnDate: Date }[]> = {};
  if (allocIds.length > 0) {
    const oRows = await db
      .select({
        allocationId: outsourceTransfersTable.allocationId,
        sendDate: outsourceTransfersTable.sendDate,
        returnDate: outsourceTransfersTable.returnDate,
      })
      .from(outsourceTransfersTable)
      .where(and(
        sql`${outsourceTransfersTable.allocationId} IN (${sql.join(allocIds.map(id => sql`${id}`), sql`, `)})`,
        eq(outsourceTransfersTable.sourceStage, "allocation"),
      ));
    for (const o of oRows) {
      if (!outsourceMap[o.allocationId]) outsourceMap[o.allocationId] = [];
      outsourceMap[o.allocationId].push({
        sendDate: new Date(o.sendDate),
        returnDate: o.returnDate ? new Date(o.returnDate) : new Date(),
      });
    }
  }

  let manualPauseMap: Record<number, number> = {};
  if (allocIds.length > 0) {
    const mpRows = await db
      .select({
        allocationId: manualPausesTable.allocationId,
        pauseStart: manualPausesTable.pauseStart,
        pauseEnd: manualPausesTable.pauseEnd,
      })
      .from(manualPausesTable)
      .where(sql`${manualPausesTable.allocationId} IN (${sql.join(allocIds.map(id => sql`${id}`), sql`, `)})`);
    for (const mp of mpRows) {
      const ps = new Date(mp.pauseStart);
      const pe = new Date(mp.pauseEnd);
      const mpWorkMin = serverCalcWorkingMinutesBetween(ps, pe, offDays);
      manualPauseMap[mp.allocationId] = (manualPauseMap[mp.allocationId] || 0) + mpWorkMin;
    }
  }

  interface AllocRecord {
    allocationId: number;
    stitcherId: number | null;
    stitcherName: string | null;
    teamName: string | null;
    allocationType: string | null;
    allocTeamId: number | null;
    allocTeamName: string | null;
    totalPoints: number;
    expectedMinutes: number;
    issueDate: Date | null;
    firstReceiveDate: Date | null;
    lastReceiveDate: Date | null;
    lastReceiveDateKey: string;
    batchNumber: string | null;
    productCode: string | null;
    productName: string | null;
  }
  const allocMap: Record<number, AllocRecord> = {};

  for (const r of rows) {
    const ppp = r.manualPointsPerPiece != null ? Number(r.manualPointsPerPiece) : (r.snapshotPointsPerPiece != null ? Number(r.snapshotPointsPerPiece) : (Number(r.productPointsPerPiece) || 0));
    const pts = ppp * (r.quantityReceived || 0);
    const expectedMin = pts * minutesPerPoint;
    const dateKey = r.receiveDate ? new Date(r.receiveDate).toISOString().slice(0, 10) : "";

    if (!allocMap[r.allocationId]) {
      allocMap[r.allocationId] = {
        allocationId: r.allocationId,
        stitcherId: r.stitcherId,
        stitcherName: r.stitcherName,
        teamName: r.teamName,
        allocationType: r.allocationType,
        allocTeamId: r.allocTeamId,
        allocTeamName: r.allocTeamName,
        totalPoints: 0,
        expectedMinutes: 0,
        issueDate: r.issueDate,
        firstReceiveDate: r.receiveDate,
        lastReceiveDate: r.receiveDate,
        lastReceiveDateKey: dateKey,
        batchNumber: r.batchNumber,
        productCode: r.productCode,
        productName: r.productName,
      };
    }
    const a = allocMap[r.allocationId];
    a.totalPoints += pts;
    a.expectedMinutes += expectedMin;
    if (r.receiveDate) {
      if (!a.firstReceiveDate || new Date(r.receiveDate) < new Date(a.firstReceiveDate)) {
        a.firstReceiveDate = r.receiveDate;
      }
      if (!a.lastReceiveDate || new Date(r.receiveDate) > new Date(a.lastReceiveDate)) {
        a.lastReceiveDate = r.receiveDate;
        a.lastReceiveDateKey = dateKey;
      }
    }
  }

  interface BatchDetail {
    batchNumber: string;
    product: string;
    points: number;
    expectedMinutes: number;
    effectiveMinutes: number;
    outsourceMinutes: number;
    efficiency: number;
    rating: string;
    status: string;
    actualCompletion: string | null;
  }
  interface AggEntry {
    name: string; code?: string; teamName?: string;
    totalPoints: number; expectedMinutes: number;
    totalElapsedMinutes: number; outsourceMinutes: number;
    onTimeCount: number; lateCount: number;
    allocCount: number;
    batches: BatchDetail[];
  }
  const stitcherAgg: Record<number, AggEntry> = {};
  const teamAgg: Record<number, AggEntry> = {};
  const dailyAgg: Record<string, { date: string; totalExpected: number; totalEffective: number; count: number }> = {};

  for (const a of Object.values(allocMap)) {
    const elapsedMin = a.issueDate && a.firstReceiveDate
      ? serverCalcWorkingMinutesBetween(new Date(a.issueDate), new Date(a.firstReceiveDate), offDays)
      : 0;
    const firstRecvDt = a.firstReceiveDate ? new Date(a.firstReceiveDate) : null;
    let osMin = 0;
    for (const o of (outsourceMap[a.allocationId] || [])) {
      const capEnd = firstRecvDt && o.returnDate > firstRecvDt ? firstRecvDt : o.returnDate;
      const capStart = firstRecvDt && o.sendDate > firstRecvDt ? firstRecvDt : o.sendDate;
      if (capEnd > capStart) osMin += serverCalcWorkingMinutesBetween(capStart, capEnd, offDays);
    }
    const mpMin = manualPauseMap[a.allocationId] || 0;
    const effectiveMin = Math.max(0, elapsedMin - osMin - mpMin);
    const isOnTime = a.expectedMinutes > 0 && effectiveMin > 0 ? effectiveMin <= a.expectedMinutes : true;

    const batchEfficiency = effectiveMin > 0 ? Math.round((a.expectedMinutes / effectiveMin) * 100) : 0;
    const batchRating = batchEfficiency >= 120 ? "A+" : batchEfficiency >= 100 ? "A" : batchEfficiency >= 80 ? "B" : "C";
    const batchDetail: BatchDetail = {
      batchNumber: a.batchNumber || "—",
      product: [a.productCode, a.productName].filter(Boolean).join(" - "),
      points: Math.round(a.totalPoints * 100) / 100,
      expectedMinutes: a.expectedMinutes,
      effectiveMinutes: effectiveMin,
      outsourceMinutes: osMin + mpMin,
      efficiency: batchEfficiency,
      rating: batchRating,
      status: isOnTime ? "On Time" : "Late",
      actualCompletion: a.lastReceiveDate ? new Date(a.lastReceiveDate).toISOString() : null,
    };

    if (a.allocationType === "individual" && a.stitcherId) {
      if (!stitcherAgg[a.stitcherId]) {
        stitcherAgg[a.stitcherId] = {
          name: a.stitcherName || "Unknown", teamName: a.teamName || undefined,
          totalPoints: 0, expectedMinutes: 0, totalElapsedMinutes: 0, outsourceMinutes: 0,
          onTimeCount: 0, lateCount: 0, allocCount: 0, batches: [],
        };
      }
      const s = stitcherAgg[a.stitcherId];
      s.totalPoints += a.totalPoints;
      s.expectedMinutes += a.expectedMinutes;
      s.totalElapsedMinutes += elapsedMin;
      s.outsourceMinutes += osMin + mpMin;
      s.allocCount++;
      s.batches.push(batchDetail);
      if (a.expectedMinutes > 0 && effectiveMin > 0) { isOnTime ? s.onTimeCount++ : s.lateCount++; }
    }

    const tId = a.allocationType === "team" ? a.allocTeamId : null;
    const tName = a.allocationType === "team" ? (a.allocTeamName || "Unknown") : null;
    if (tId && tName) {
      if (!teamAgg[tId]) {
        teamAgg[tId] = {
          name: tName, totalPoints: 0, expectedMinutes: 0,
          totalElapsedMinutes: 0, outsourceMinutes: 0,
          onTimeCount: 0, lateCount: 0, allocCount: 0, batches: [],
        };
      }
      const t = teamAgg[tId];
      t.totalPoints += a.totalPoints;
      t.expectedMinutes += a.expectedMinutes;
      t.totalElapsedMinutes += elapsedMin;
      t.outsourceMinutes += osMin + mpMin;
      t.allocCount++;
      t.batches.push(batchDetail);
      if (a.expectedMinutes > 0 && effectiveMin > 0) { isOnTime ? t.onTimeCount++ : t.lateCount++; }
    }

    if (a.lastReceiveDateKey) {
      const dk = a.lastReceiveDateKey;
      if (!dailyAgg[dk]) dailyAgg[dk] = { date: dk, totalExpected: 0, totalEffective: 0, count: 0 };
      dailyAgg[dk].totalExpected += a.expectedMinutes;
      dailyAgg[dk].totalEffective += effectiveMin;
      dailyAgg[dk].count++;
    }
  }

  function buildResult(agg: Record<number, AggEntry>) {
    return Object.entries(agg)
      .map(([id, v]) => {
        const effectiveMin = Math.max(0, v.totalElapsedMinutes - v.outsourceMinutes);
        const efficiency = effectiveMin > 0 ? Math.round((v.expectedMinutes / effectiveMin) * 100) : 0;
        const rating = efficiency >= 120 ? "A+" : efficiency >= 100 ? "A" : efficiency >= 80 ? "B" : "C";
        return {
          id: Number(id), name: v.name, teamName: v.teamName, code: v.code,
          totalPoints: Math.round(v.totalPoints * 100) / 100,
          expectedMinutes: v.expectedMinutes,
          effectiveMinutes: effectiveMin,
          outsourceMinutes: v.outsourceMinutes,
          totalElapsedMinutes: v.totalElapsedMinutes,
          efficiency, rating,
          onTimeCount: v.onTimeCount, lateCount: v.lateCount,
          completedBatches: v.allocCount,
          batches: v.batches.sort((a, b) => (b.actualCompletion || "").localeCompare(a.actualCompletion || "")),
        };
      })
      .sort((a, b) => b.efficiency - a.efficiency);
  }

  const trend = Object.values(dailyAgg)
    .map(d => ({
      date: d.date,
      efficiency: d.totalEffective > 0 ? Math.round((d.totalExpected / d.totalEffective) * 100) : 0,
      count: d.count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  res.json({
    stitchers: buildResult(stitcherAgg),
    teams: buildResult(teamAgg),
    trend,
  });
});

export default router;
