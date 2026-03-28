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

  const teamWhereConditions: any[] = [eq(teamsTable.isActive, true)];
  if (productId) teamWhereConditions.push(eq(cuttingBatchesTable.productId, productId));

  const teamRows = await db
    .select({
      teamId: teamsTable.id,
      teamName: teamsTable.name,
      totalAllocated: sql<number>`COALESCE(SUM(${allocationsTable.quantityIssued}), 0)::int`,
      totalReceived: sql<number>`COALESCE(SUM(${allocationsTable.quantityReceived}), 0)::int`,
    })
    .from(teamsTable)
    .leftJoin(allocationsTable, and(
      eq(allocationsTable.teamId, teamsTable.id),
      eq(allocationsTable.allocationType, "team"),
      ...dateConditions
    ))
    .leftJoin(cuttingBatchesTable, eq(allocationsTable.cuttingBatchId, cuttingBatchesTable.id))
    .where(and(...teamWhereConditions))
    .groupBy(teamsTable.id, teamsTable.name)
    .orderBy(sql`COALESCE(SUM(${allocationsTable.quantityIssued}), 0) desc`);

  const stitcherDateConditions: any[] = [
    gte(allocationsTable.issueDate, new Date(startStr)),
    lte(allocationsTable.issueDate, ed),
  ];

  const stitcherWhereConditions: any[] = [eq(stitchersTable.isActive, true)];
  if (productId) stitcherWhereConditions.push(eq(cuttingBatchesTable.productId, productId));

  const stitcherRows = await db
    .select({
      stitcherId: stitchersTable.id,
      stitcherName: stitchersTable.name,
      teamName: teamsTable.name,
      totalAllocated: sql<number>`COALESCE(SUM(${allocationsTable.quantityIssued}), 0)::int`,
      totalReceived: sql<number>`COALESCE(SUM(${allocationsTable.quantityReceived}), 0)::int`,
    })
    .from(stitchersTable)
    .leftJoin(teamsTable, eq(stitchersTable.teamId, teamsTable.id))
    .leftJoin(allocationsTable, and(
      eq(allocationsTable.stitcherId, stitchersTable.id),
      eq(allocationsTable.allocationType, "individual"),
      ...stitcherDateConditions
    ))
    .leftJoin(cuttingBatchesTable, eq(allocationsTable.cuttingBatchId, cuttingBatchesTable.id))
    .where(and(...stitcherWhereConditions))
    .groupBy(stitchersTable.id, stitchersTable.name, teamsTable.name)
    .orderBy(sql`COALESCE(SUM(${allocationsTable.quantityIssued}), 0) desc`);

  res.json({
    teams: teamRows.filter(t => t.totalAllocated > 0 || t.totalReceived > 0),
    stitchers: stitcherRows.filter(s => s.totalAllocated > 0 || s.totalReceived > 0),
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
      pointsPerPiece: productsTable.pointsPerPiece,
      completedQty: sql<number>`COALESCE(SUM(${receivingsTable.quantityReceived}), 0)::int`,
    })
    .from(receivingsTable)
    .innerJoin(allocationsTable, eq(receivingsTable.allocationId, allocationsTable.id))
    .innerJoin(cuttingBatchesTable, eq(allocationsTable.cuttingBatchId, cuttingBatchesTable.id))
    .innerJoin(productsTable, eq(cuttingBatchesTable.productId, productsTable.id))
    .innerJoin(stitchersTable, eq(allocationsTable.stitcherId, stitchersTable.id))
    .leftJoin(teamsTable, eq(stitchersTable.teamId, teamsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(stitchersTable.id, stitchersTable.name, teamsTable.name, productsTable.id, productsTable.code, productsTable.name, productsTable.pointsPerPiece)
    .orderBy(stitchersTable.name, productsTable.code);

  const result = rows.map(r => {
    const pts = r.pointsPerPiece ? Number(r.pointsPerPiece) : 0;
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
      pointsPerPiece: productsTable.pointsPerPiece,
      completedQty: sql<number>`COALESCE(SUM(${receivingsTable.quantityReceived}), 0)::int`,
    })
    .from(receivingsTable)
    .innerJoin(allocationsTable, eq(receivingsTable.allocationId, allocationsTable.id))
    .innerJoin(cuttingBatchesTable, eq(allocationsTable.cuttingBatchId, cuttingBatchesTable.id))
    .innerJoin(productsTable, eq(cuttingBatchesTable.productId, productsTable.id))
    .innerJoin(teamsTable, eq(allocationsTable.teamId, teamsTable.id))
    .where(and(...conditions))
    .groupBy(teamsTable.id, teamsTable.name, teamsTable.code, productsTable.id, productsTable.code, productsTable.name, productsTable.pointsPerPiece)
    .orderBy(teamsTable.name, productsTable.code);

  const result = rows.map(r => {
    const pts = r.pointsPerPiece ? Number(r.pointsPerPiece) : 0;
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

export default router;
