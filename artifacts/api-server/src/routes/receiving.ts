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
  outsourceTransfersTable,
  purchaseOrdersTable,
  ordersTable,
  manualPausesTable,
} from "@workspace/db/schema";
import { eq, sql, and, gte, lte, ilike, inArray } from "drizzle-orm";
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

/**
 * Recalculate allocation totals from the receivings table (source of truth).
 * Updates allocation.quantityReceived, quantityRejected, status.
 */
async function recalculateAllocationTotals(allocationId: number) {
  const [alloc] = await db
    .select({
      quantityIssued: allocationsTable.quantityIssued,
      cuttingBatchId: allocationsTable.cuttingBatchId,
      workType: allocationsTable.workType,
    })
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

  let effectiveCeiling = alloc.quantityIssued;
  if (alloc.workType === "outsource_required") {
    const [outsourceSums] = await db
      .select({
        totalReturned: sql<number>`COALESCE(SUM(${outsourceTransfersTable.quantityReturned}), 0)::int`,
      })
      .from(outsourceTransfersTable)
      .where(and(eq(outsourceTransfersTable.allocationId, allocationId), eq(outsourceTransfersTable.sourceStage, "allocation")));
    effectiveCeiling = Number(outsourceSums?.totalReturned ?? 0);
  }

  const pending = effectiveCeiling - totalReceived - totalRejected;
  const allocStatus = pending <= 0 && effectiveCeiling > 0 ? "completed" : "pending";

  await db
    .update(allocationsTable)
    .set({ quantityReceived: totalReceived, quantityRejected: totalRejected, status: allocStatus })
    .where(eq(allocationsTable.id, allocationId));

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

router.get("/receiving", checkPermission("receiving", "view"), async (req, res) => {
  const { startDate, endDate, stitcherId, batchNumber } = req.query;
  const conditions: any[] = [];
  if (startDate) conditions.push(gte(receivingsTable.receiveDate, new Date(startDate as string)));
  if (endDate) { const ed = new Date(endDate as string); ed.setDate(ed.getDate() + 1); conditions.push(lte(receivingsTable.receiveDate, ed)); }
  if (stitcherId) conditions.push(eq(allocationsTable.stitcherId, Number(stitcherId)));
  if (batchNumber) conditions.push(ilike(cuttingBatchesTable.batchNumber, `%${batchNumber}%`));

  let q = db
    .select({
      id: receivingsTable.id,
      allocationId: receivingsTable.allocationId,
      allocationNumber: allocationsTable.allocationNumber,
      stitcherId: allocationsTable.stitcherId,
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
      issueDate: allocationsTable.issueDate,
      workType: allocationsTable.workType,
      outsourceCategory: allocationsTable.outsourceCategory,
      productPointsPerPiece: productsTable.pointsPerPiece,
      snapshotPointsPerPiece: allocationsTable.pointsPerPiece,
      manualPointsPerPiece: allocationsTable.manualPointsPerPiece,
      allocationStatus: allocationsTable.status,
      quantityReceived: receivingsTable.quantityReceived,
      quantityRejected: receivingsTable.quantityRejected,
      quantityDamaged: receivingsTable.quantityDamaged,
      receiveDate: receivingsTable.receiveDate,
      remarks: receivingsTable.remarks,
      allocationRemarks: allocationsTable.remarks,
      receivedBy: receivingsTable.receivedBy,
      hasStain: receivingsTable.hasStain,
      hasDamage: receivingsTable.hasDamage,
      needsWash: receivingsTable.needsWash,
      needsRework: receivingsTable.needsRework,
      productionFor: cuttingBatchesTable.productionFor,
      poNumber: purchaseOrdersTable.poNumber,
      orderNumber: ordersTable.orderNumber,
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
    .leftJoin(purchaseOrdersTable, eq(cuttingBatchesTable.poId, purchaseOrdersTable.id))
    .leftJoin(ordersTable, eq(cuttingBatchesTable.orderId, ordersTable.id))
    .$dynamic();

  if (conditions.length > 0) q = q.where(and(...conditions));
  const rows = await q.orderBy(sql`${receivingsTable.createdAt} desc`);

  const recvBatchIds = [...new Set(rows.map((r: any) => r.allocationId).filter(Boolean))];
  const batchIdMap = new Map<number, number>();
  if (recvBatchIds.length > 0) {
    const allocBatches = await db
      .select({ id: allocationsTable.id, cuttingBatchId: allocationsTable.cuttingBatchId })
      .from(allocationsTable)
      .where(sql`${allocationsTable.id} IN (${sql.join(recvBatchIds.map((id: any) => sql`${id}`), sql`, `)})`);
    allocBatches.forEach((a: any) => batchIdMap.set(a.id, a.cuttingBatchId));
  }
  const uniqueBatchIds = [...new Set(batchIdMap.values())];
  const finSet = new Set(uniqueBatchIds.length > 0 ? (await db
    .select({ cuttingBatchId: finishingRecordsTable.cuttingBatchId })
    .from(finishingRecordsTable)
    .where(sql`${finishingRecordsTable.cuttingBatchId} IN (${sql.join(uniqueBatchIds.map((id) => sql`${id}`), sql`, `)})`)
    .groupBy(finishingRecordsTable.cuttingBatchId)
  ).map((r: any) => r.cuttingBatchId) : []);

  const outsourceAllocIds = [...new Set(rows.filter((r: any) => r.workType === "outsource_required").map((r: any) => r.allocationId).filter(Boolean))];
  const outsourceMap = new Map<number, any>();
  if (outsourceAllocIds.length > 0) {
    const oSums = await db
      .select({
        allocationId: outsourceTransfersTable.allocationId,
        totalSent: sql<number>`COALESCE(SUM(${outsourceTransfersTable.quantitySent}), 0)::int`,
        totalReturned: sql<number>`COALESCE(SUM(${outsourceTransfersTable.quantityReturned}), 0)::int`,
        totalDamaged: sql<number>`COALESCE(SUM(${outsourceTransfersTable.quantityDamaged}), 0)::int`,
        earliestSendDate: sql<string>`MIN(${outsourceTransfersTable.sendDate})`,
        latestReturnDate: sql<string>`MAX(${outsourceTransfersTable.returnDate})`,
      })
      .from(outsourceTransfersTable)
      .where(and(inArray(outsourceTransfersTable.allocationId, outsourceAllocIds), eq(outsourceTransfersTable.sourceStage, "allocation")))
      .groupBy(outsourceTransfersTable.allocationId);
    oSums.forEach(o => outsourceMap.set(o.allocationId, o));
  }

  const stitcherIds = [...new Set(rows.map((r: any) => r.stitcherId).filter(Boolean))];
  const priorityPauseMap = new Map<number, any[]>();
  if (stitcherIds.length > 0) {
    const orderAllocs = await db
      .select({
        id: allocationsTable.id,
        allocationNumber: allocationsTable.allocationNumber,
        stitcherId: allocationsTable.stitcherId,
        issueDate: allocationsTable.issueDate,
        quantityIssued: allocationsTable.quantityIssued,
        quantityReceived: allocationsTable.quantityReceived,
        quantityRejected: allocationsTable.quantityRejected,
        batchNumber: cuttingBatchesTable.batchNumber,
      })
      .from(allocationsTable)
      .leftJoin(cuttingBatchesTable, eq(allocationsTable.cuttingBatchId, cuttingBatchesTable.id))
      .where(and(
        inArray(allocationsTable.stitcherId, stitcherIds),
        eq(cuttingBatchesTable.productionFor, "order"),
      ));
    const orderAllocIdSet = orderAllocs.map(o => o.id);
    const orderRcvMap = new Map<number, string | null>();
    if (orderAllocIdSet.length > 0) {
      const rcvDates = await db
        .select({
          allocationId: receivingsTable.allocationId,
          latestReceiveDate: sql<string>`MAX(${receivingsTable.receiveDate})`,
        })
        .from(receivingsTable)
        .where(inArray(receivingsTable.allocationId, orderAllocIdSet))
        .groupBy(receivingsTable.allocationId);
      for (const r of rcvDates) orderRcvMap.set(r.allocationId, r.latestReceiveDate);
    }
    const orderOutsourceMap = new Map<number, { sendDate: string | null; returnDate: string | null; sent: number; returned: number; damaged: number }>();
    if (orderAllocIdSet.length > 0) {
      const orderOsData = await db
        .select({
          allocationId: outsourceTransfersTable.allocationId,
          totalSent: sql<number>`COALESCE(SUM(${outsourceTransfersTable.quantitySent}), 0)::int`,
          totalReturned: sql<number>`COALESCE(SUM(${outsourceTransfersTable.quantityReturned}), 0)::int`,
          totalDamaged: sql<number>`COALESCE(SUM(${outsourceTransfersTable.quantityDamaged}), 0)::int`,
          earliestSendDate: sql<string>`MIN(${outsourceTransfersTable.sendDate})`,
          latestReturnDate: sql<string>`MAX(${outsourceTransfersTable.returnDate})`,
        })
        .from(outsourceTransfersTable)
        .where(and(inArray(outsourceTransfersTable.allocationId, orderAllocIdSet), eq(outsourceTransfersTable.sourceStage, "allocation")))
        .groupBy(outsourceTransfersTable.allocationId);
      for (const o of orderOsData) {
        orderOutsourceMap.set(o.allocationId, {
          sendDate: o.earliestSendDate ? new Date(o.earliestSendDate).toISOString() : null,
          returnDate: o.latestReturnDate ? new Date(o.latestReturnDate).toISOString() : null,
          sent: o.totalSent, returned: o.totalReturned, damaged: o.totalDamaged,
        });
      }
    }
    for (const row of rows) {
      if (!row.stitcherId || !row.issueDate) continue;
      const rowIssueTime = new Date(row.issueDate).getTime();
      const pauses: any[] = [];
      for (const oa of orderAllocs) {
        if (oa.stitcherId !== row.stitcherId) continue;
        if (oa.id === row.allocationId) continue;
        const oaIssueTime = oa.issueDate ? new Date(oa.issueDate).getTime() : 0;
        if (!oaIssueTime || oaIssueTime <= rowIssueTime) continue;
        const oaCompleted = (oa.quantityReceived + oa.quantityRejected) >= oa.quantityIssued && oa.quantityIssued > 0;
        const rcvDate = orderRcvMap.get(oa.id) || null;
        const oaStart = oa.issueDate instanceof Date ? oa.issueDate.toISOString() : oa.issueDate;
        const oaEnd = oaCompleted && rcvDate ? new Date(rcvDate).toISOString() : null;
        const oo = orderOutsourceMap.get(oa.id);
        const oaHasOs = oo && oo.sent > 0 && oo.sendDate;
        if (oaHasOs) {
          const osPending = oo.sent - oo.returned - oo.damaged;
          const osReturned = osPending <= 0;
          pauses.push({
            orderAllocationId: oa.id, orderAllocationNumber: oa.allocationNumber,
            orderBatchNumber: oa.batchNumber, orderCompleted: false,
            pauseStart: oaStart, pauseEnd: oo.sendDate,
            phaseLabel: "In-house before outsource",
          });
          if (osReturned && oo.returnDate) {
            pauses.push({
              orderAllocationId: oa.id, orderAllocationNumber: oa.allocationNumber,
              orderBatchNumber: oa.batchNumber, orderCompleted: oaCompleted,
              pauseStart: oo.returnDate, pauseEnd: oaEnd,
              phaseLabel: "In-house after outsource",
            });
          }
        } else {
          pauses.push({
            orderAllocationId: oa.id, orderAllocationNumber: oa.allocationNumber,
            orderBatchNumber: oa.batchNumber, orderCompleted: oaCompleted,
            pauseStart: oaStart, pauseEnd: oaEnd,
          });
        }
      }
      if (pauses.length > 0) {
        priorityPauseMap.set(row.allocationId, pauses);
      }
    }
  }

  const allAllocIds = [...new Set(rows.map((r: any) => r.allocationId))];
  const manualPauseMap = new Map<number, any[]>();
  if (allAllocIds.length > 0) {
    const mpRows = await db
      .select()
      .from(manualPausesTable)
      .where(sql`${manualPausesTable.allocationId} IN (${sql.join(allAllocIds.map(id => sql`${id}`), sql`, `)})`)
      .orderBy(manualPausesTable.pauseStart);
    for (const mp of mpRows) {
      const arr = manualPauseMap.get(mp.allocationId) || [];
      arr.push({
        id: mp.id,
        pauseStart: mp.pauseStart instanceof Date ? mp.pauseStart.toISOString() : mp.pauseStart,
        pauseEnd: mp.pauseEnd instanceof Date ? mp.pauseEnd.toISOString() : mp.pauseEnd,
        reason: mp.reason,
        remarks: mp.remarks,
      });
      manualPauseMap.set(mp.allocationId, arr);
    }
  }

  res.json(rows.map((r: any) => {
    const o = outsourceMap.get(r.allocationId);
    return {
      ...r,
      pointsPerPiece: (() => {
        if (r.manualPointsPerPiece != null) return Number(r.manualPointsPerPiece);
        const isCompleted = r.allocationStatus === "completed" || r.allocationStatus === "received";
        const eff = isCompleted && r.snapshotPointsPerPiece != null
          ? r.snapshotPointsPerPiece
          : (r.productPointsPerPiece ?? r.snapshotPointsPerPiece);
        return eff ? Number(eff) : null;
      })(),
      itemCode: computeItemCode(r.productCode, r.colorCode, r.materialCode, r.material2Code),
      isLocked: finSet.has(batchIdMap.get(r.allocationId)),
      outsourceSendDate: o?.earliestSendDate ? new Date(o.earliestSendDate).toISOString() : null,
      outsourceReturnDate: o?.latestReturnDate ? new Date(o.latestReturnDate).toISOString() : null,
      outsourceSent: o?.totalSent || 0,
      outsourceReturned: o?.totalReturned || 0,
      outsourceDamaged: o?.totalDamaged || 0,
      priorityPauses: priorityPauseMap.get(r.allocationId) || null,
      manualPauses: manualPauseMap.get(r.allocationId) || [],
    };
  }));
});

router.post("/receiving", checkPermission("receiving", "create"), async (req, res) => {
  const {
    allocationId,
    quantityReceived,
    quantityRejected = 0,
    quantityDamaged = 0,
    receiveDate,
    remarks,
    hasStain = false,
    hasDamage = false,
    needsWash = false,
    needsRework = false,
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
  const thisEntry = quantityReceived + quantityRejected + quantityDamaged;

  if (thisEntry <= 0) {
    return res.status(400).json({ error: "At least one quantity must be greater than zero" });
  }

  // For outsource allocations, receiving limit = returned-from-outsource quantity (not total issued)
  // For simple stitch, receiving limit = total issued quantity
  let maxReceivable: number;
  if (allocation.workType === "outsource_required") {
    const [outsourceTotals] = await db
      .select({
        totalReturned: sql<number>`COALESCE(SUM(${outsourceTransfersTable.quantityReturned}), 0)::int`,
      })
      .from(outsourceTransfersTable)
      .where(and(eq(outsourceTransfersTable.allocationId, allocationId), eq(outsourceTransfersTable.sourceStage, "allocation")));

    const returnedFromOutsource = Number(outsourceTotals?.totalReturned ?? 0);
    maxReceivable = returnedFromOutsource;
  } else {
    maxReceivable = allocation.quantityIssued;
  }

  const remainingPending = maxReceivable - alreadyAccountedFor;

  if (thisEntry > remainingPending) {
    if (allocation.workType === "outsource_required") {
      return res
        .status(400)
        .json({ error: `Cannot receive more than returned-from-outsource quantity. Only ${Math.max(0, remainingPending)} pieces available for receiving.` });
    }
    return res
      .status(400)
      .json({ error: `Cannot receive more than pending quantity (${Math.max(0, remainingPending)})` });
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
      hasStain: !!hasStain,
      hasDamage: !!hasDamage,
      needsWash: !!needsWash,
      needsRework: !!needsRework,
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
router.put("/receiving/:id", checkPermission("receiving", "edit"), async (req, res) => {
  const id = parseInt(req.params.id);
  const { receiveDate, remarks, hasStain, hasDamage, needsWash, needsRework } = req.body;

  const [existing] = await db.select({ allocationId: receivingsTable.allocationId }).from(receivingsTable).where(eq(receivingsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Receiving record not found." });

  const [hasFinishing] = await db.select({ id: finishingRecordsTable.id }).from(finishingRecordsTable)
    .innerJoin(allocationsTable, eq(allocationsTable.cuttingBatchId, finishingRecordsTable.cuttingBatchId))
    .where(eq(allocationsTable.id, existing.allocationId))
    .limit(1);

  const isLocked = !!hasFinishing;

  const updates: Record<string, any> = {};
  if (receiveDate) updates.receiveDate = new Date(receiveDate);
  if (remarks !== undefined) updates.remarks = remarks;
  if (hasStain !== undefined) updates.hasStain = !!hasStain;
  if (hasDamage !== undefined) updates.hasDamage = !!hasDamage;
  if (needsWash !== undefined) updates.needsWash = !!needsWash;
  if (needsRework !== undefined) updates.needsRework = !!needsRework;

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No fields to update." });

  const [row] = await db
    .update(receivingsTable)
    .set(updates)
    .where(eq(receivingsTable.id, id))
    .returning();
  await logAudit(req, "UPDATE", "receivings", String(id), `Updated receiving record #${id}`);
  res.json({ ...row, isLocked });
});

router.patch("/receiving/batch-points/:allocationId", checkPermission("receiving", "edit"), async (req, res) => {
  const allocationId = Number(req.params.allocationId);
  const { manualPointsPerPiece } = req.body;

  if (manualPointsPerPiece === undefined || manualPointsPerPiece === null) {
    return res.status(400).json({ error: "manualPointsPerPiece is required." });
  }

  const ppp = Number(manualPointsPerPiece);
  if (isNaN(ppp) || ppp < 0) {
    return res.status(400).json({ error: "manualPointsPerPiece must be a non-negative number." });
  }

  const [allocation] = await db
    .select({ id: allocationsTable.id })
    .from(allocationsTable)
    .where(eq(allocationsTable.id, allocationId));

  if (!allocation) return res.status(404).json({ error: "Allocation not found." });

  const [updated] = await db
    .update(allocationsTable)
    .set({ manualPointsPerPiece: String(ppp) })
    .where(eq(allocationsTable.id, allocationId))
    .returning({ id: allocationsTable.id, manualPointsPerPiece: allocationsTable.manualPointsPerPiece });

  await logAudit(req, "UPDATE", "allocations", String(allocationId), `Manually set points per piece to ${ppp} for allocation #${allocationId}`);
  res.json(updated);
});

export default router;
