import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  allocationsTable,
  allocationReturnsTable,
  cuttingBatchesTable,
  stitchersTable,
  teamsTable,
  productsTable,
  fabricsTable,
  materialsTable,
  sizesTable,
  colorsTable,
  outsourceTransfersTable,
  receivingsTable,
  purchaseOrdersTable,
  ordersTable,
} from "@workspace/db/schema";
import { eq, sql, and, gte, lte, ilike, inArray, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { logAudit } from "../lib/audit.js";
import { checkPermission } from "./permissions.js";
import { computeItemCode } from "../lib/itemCode.js";

const router: IRouter = Router();

const mat1 = alias(materialsTable, "mat1");
const mat2 = alias(materialsTable, "mat2");
const allocTeam = alias(teamsTable, "alloc_team");

function generateAllocationNumber() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `AL-${y}${m}${d}-${rand}`;
}

const allocSelect = {
  id: allocationsTable.id,
  allocationNumber: allocationsTable.allocationNumber,
  cuttingBatchId: allocationsTable.cuttingBatchId,
  batchNumber: cuttingBatchesTable.batchNumber,
  productCode: productsTable.code,
  productName: productsTable.name,
  pointsPerPiece: productsTable.pointsPerPiece,
  fabricId: cuttingBatchesTable.fabricId,
  fabricCode: fabricsTable.code,
  fabricName: fabricsTable.name,
  materialId: cuttingBatchesTable.materialId,
  materialCode: mat1.code,
  materialName: mat1.name,
  material2Id: cuttingBatchesTable.material2Id,
  material2Code: mat2.code,
  material2Name: mat2.name,
  sizeId: cuttingBatchesTable.sizeId,
  sizeName: sizesTable.name,
  colorId: cuttingBatchesTable.colorId,
  colorCode: colorsTable.code,
  colorName: colorsTable.name,
  allocationType: allocationsTable.allocationType,
  stitcherId: allocationsTable.stitcherId,
  stitcherName: stitchersTable.name,
  teamId: allocationsTable.teamId,
  teamName: allocTeam.name,
  stitcherTeamName: teamsTable.name,
  quantityIssued: allocationsTable.quantityIssued,
  quantityReceived: allocationsTable.quantityReceived,
  quantityRejected: allocationsTable.quantityRejected,
  workType: allocationsTable.workType,
  outsourceCategory: allocationsTable.outsourceCategory,
  issueDate: allocationsTable.issueDate,
  remarks: allocationsTable.remarks,
  status: allocationsTable.status,
  productionFor: cuttingBatchesTable.productionFor,
  poNumber: purchaseOrdersTable.poNumber,
  orderNumber: ordersTable.orderNumber,
  createdAt: allocationsTable.createdAt,
  lastReceiveDate: sql<string>`(SELECT to_char(MAX(r.receive_date) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') FROM receivings r WHERE r.allocation_id = ${allocationsTable.id})`,
};

function allocJoins(q: any) {
  return q
    .leftJoin(cuttingBatchesTable, eq(allocationsTable.cuttingBatchId, cuttingBatchesTable.id))
    .leftJoin(productsTable, eq(cuttingBatchesTable.productId, productsTable.id))
    .leftJoin(fabricsTable, eq(cuttingBatchesTable.fabricId, fabricsTable.id))
    .leftJoin(mat1, eq(cuttingBatchesTable.materialId, mat1.id))
    .leftJoin(mat2, eq(cuttingBatchesTable.material2Id, mat2.id))
    .leftJoin(sizesTable, eq(cuttingBatchesTable.sizeId, sizesTable.id))
    .leftJoin(colorsTable, eq(cuttingBatchesTable.colorId, colorsTable.id))
    .leftJoin(stitchersTable, eq(allocationsTable.stitcherId, stitchersTable.id))
    .leftJoin(teamsTable, eq(stitchersTable.teamId, teamsTable.id))
    .leftJoin(allocTeam, eq(allocationsTable.teamId, allocTeam.id))
    .leftJoin(purchaseOrdersTable, eq(cuttingBatchesTable.poId, purchaseOrdersTable.id))
    .leftJoin(ordersTable, eq(cuttingBatchesTable.orderId, ordersTable.id));
}

function withItemCode(r: any) {
  return {
    ...r,
    quantityPending: r.quantityIssued - r.quantityReceived - r.quantityRejected,
    itemCode: computeItemCode(r.productCode, r.colorCode, r.materialCode, r.material2Code),
    assigneeName: r.allocationType === "team" ? r.teamName : r.stitcherName,
    assigneeType: r.allocationType || "individual",
  };
}

router.get("/allocation", checkPermission("allocation", "view"), async (req, res) => {
  const { startDate, endDate, productId, colorId, sizeId, stitcherId, teamId, batchNumber, status } = req.query;
  const conditions: any[] = [];
  if (startDate) conditions.push(gte(allocationsTable.issueDate, new Date(startDate as string)));
  if (endDate) { const ed = new Date(endDate as string); ed.setDate(ed.getDate() + 1); conditions.push(lte(allocationsTable.issueDate, ed)); }
  if (productId) conditions.push(eq(cuttingBatchesTable.productId, Number(productId)));
  if (colorId) conditions.push(eq(cuttingBatchesTable.colorId, Number(colorId)));
  if (sizeId) conditions.push(eq(cuttingBatchesTable.sizeId, Number(sizeId)));
  if (stitcherId) conditions.push(eq(allocationsTable.stitcherId, Number(stitcherId)));
  if (teamId) conditions.push(eq(allocationsTable.teamId, Number(teamId)));
  if (batchNumber) conditions.push(ilike(cuttingBatchesTable.batchNumber, `%${batchNumber}%`));
  let q = allocJoins(db.select(allocSelect).from(allocationsTable));
  if (conditions.length > 0) q = q.where(and(...conditions));
  const rows = await q.orderBy(sql`${allocationsTable.createdAt} desc`);
  const mapped = rows.map(withItemCode);

  const outsourceAllocIds = rows.filter(r => r.workType === "outsource_required").map(r => r.id);
  if (outsourceAllocIds.length > 0) {
    const outsourceSums = await db
      .select({
        allocationId: outsourceTransfersTable.allocationId,
        totalSent: sql<number>`COALESCE(SUM(${outsourceTransfersTable.quantitySent}), 0)::int`,
        totalReturned: sql<number>`COALESCE(SUM(${outsourceTransfersTable.quantityReturned}), 0)::int`,
        totalDamaged: sql<number>`COALESCE(SUM(${outsourceTransfersTable.quantityDamaged}), 0)::int`,
        earliestSendDate: sql<string>`MIN(${outsourceTransfersTable.sendDate})`,
        latestReturnDate: sql<string>`MAX(${outsourceTransfersTable.returnDate})`,
      })
      .from(outsourceTransfersTable)
      .where(inArray(outsourceTransfersTable.allocationId, outsourceAllocIds))
      .groupBy(outsourceTransfersTable.allocationId);

    const outsourceMap = new Map(outsourceSums.map(o => [o.allocationId, o]));
    for (const row of mapped) {
      if (row.workType === "outsource_required") {
        const o = outsourceMap.get(row.id) || { totalSent: 0, totalReturned: 0, totalDamaged: 0, earliestSendDate: null, latestReturnDate: null };
        (row as any).outsourceSent = o.totalSent;
        (row as any).outsourceReturned = o.totalReturned;
        (row as any).outsourceDamaged = o.totalDamaged;
        (row as any).outsourceSendDate = o.earliestSendDate ? new Date(o.earliestSendDate).toISOString() : null;
        (row as any).outsourceReturnDate = o.latestReturnDate ? new Date(o.latestReturnDate).toISOString() : null;
      }
    }
  }

  const allAllocIds = mapped.map((r: any) => r.id);
  const returnedSet = new Set<number>();
  if (allAllocIds.length > 0) {
    const returnSums = await db
      .select({ allocationId: allocationReturnsTable.allocationId })
      .from(allocationReturnsTable)
      .where(sql`${allocationReturnsTable.allocationId} IN (${sql.join(allAllocIds.map((id: number) => sql`${id}`), sql`, `)})`)
      .groupBy(allocationReturnsTable.allocationId);
    for (const r of returnSums) returnedSet.add(r.allocationId);
  }

  for (const row of mapped) {
    const received = row.quantityReceived + row.quantityRejected;
    const issued = row.quantityIssued;
    const oSent = (row as any).outsourceSent || 0;
    const oReturned = (row as any).outsourceReturned || 0;
    let computedStatus = "pending";
    if (returnedSet.has(row.id) && issued === 0 && received === 0) {
      computedStatus = "returned";
    } else if (received >= issued && issued > 0) {
      computedStatus = "completed";
    } else if (received > 0 && received < issued) {
      computedStatus = "partially_received";
    } else if (row.workType === "outsource_required" && oSent > 0 && oReturned < oSent) {
      computedStatus = "pending_in_outsource";
    } else if (row.workType === "outsource_required" && oSent > 0 && oReturned >= oSent && received < issued) {
      computedStatus = "pending_returned_outsource";
    }
    (row as any).computedStatus = computedStatus;
  }

  const statusFilter = status as string | undefined;
  const finalRows = statusFilter ? mapped.filter((r: any) => r.computedStatus === statusFilter) : mapped;

  const allocIds = finalRows.map((r: any) => r.id);
  if (allocIds.length > 0) {
    const recvSet = new Set((await db
      .select({ allocationId: receivingsTable.allocationId })
      .from(receivingsTable)
      .where(sql`${receivingsTable.allocationId} IN (${sql.join(allocIds.map((id: number) => sql`${id}`), sql`, `)})`)
      .groupBy(receivingsTable.allocationId)
    ).map((r: any) => r.allocationId));
    const outSet = new Set((await db
      .select({ allocationId: outsourceTransfersTable.allocationId })
      .from(outsourceTransfersTable)
      .where(sql`${outsourceTransfersTable.allocationId} IN (${sql.join(allocIds.map((id: number) => sql`${id}`), sql`, `)})`)
      .groupBy(outsourceTransfersTable.allocationId)
    ).map((r: any) => r.allocationId));
    for (const row of finalRows) {
      (row as any).isLocked = recvSet.has(row.id) || outSet.has(row.id);
    }
  }

  const relevantStitcherIds = [...new Set(finalRows.filter(r => r.stitcherId).map(r => r.stitcherId!))];
  if (relevantStitcherIds.length > 0) {
    const allOrderAllocs = await db
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
        inArray(allocationsTable.stitcherId, relevantStitcherIds),
        eq(cuttingBatchesTable.productionFor, "order"),
      ));

    const orderRcvMap = new Map<number, string | null>();
    const orderIds = allOrderAllocs.map(o => o.id);
    if (orderIds.length > 0) {
      const rcvDates = await db
        .select({
          allocationId: receivingsTable.allocationId,
          latestReceiveDate: sql<string>`MAX(${receivingsTable.receiveDate})`,
        })
        .from(receivingsTable)
        .where(inArray(receivingsTable.allocationId, orderIds))
        .groupBy(receivingsTable.allocationId);
      for (const r of rcvDates) orderRcvMap.set(r.allocationId, r.latestReceiveDate);
    }

    for (const row of finalRows) {
      if (!row.stitcherId || !row.issueDate) continue;
      if (row.productionFor === "order") continue;
      const received = row.quantityReceived + row.quantityRejected;
      if (received >= row.quantityIssued && row.quantityIssued > 0) continue;
      const rowIssueTime = new Date(row.issueDate).getTime();
      const rawPauses: any[] = [];
      for (const oa of allOrderAllocs) {
        if (oa.stitcherId !== row.stitcherId) continue;
        if (oa.id === row.id) continue;
        const oaIssueTime = oa.issueDate ? new Date(oa.issueDate).getTime() : 0;
        if (!oaIssueTime || oaIssueTime <= rowIssueTime) continue;
        const oaCompleted = (oa.quantityReceived + oa.quantityRejected) >= oa.quantityIssued && oa.quantityIssued > 0;
        const rcvDate = orderRcvMap.get(oa.id) || null;
        rawPauses.push({
          orderAllocationId: oa.id,
          orderAllocationNumber: oa.allocationNumber,
          orderBatchNumber: oa.batchNumber,
          pauseStart: oa.issueDate,
          pauseEnd: oaCompleted && rcvDate ? rcvDate : null,
          orderCompleted: oaCompleted,
        });
      }
      if (rawPauses.length > 0) {
        (row as any).priorityPauses = rawPauses;
      }
    }
  }

  res.json(finalRows);
});

router.post("/allocation", checkPermission("allocation", "create"), async (req, res) => {
  const { cuttingBatchId, allocationType, stitcherId, teamId, quantityIssued, issueDate, remarks,
    batchProductId, batchMaterialId, workType, outsourceCategory } = req.body;

  const type = allocationType || "individual";
  if (type === "individual" && !stitcherId) {
    return res.status(400).json({ error: "Stitcher is required for individual allocation." });
  }
  if (type === "team" && !teamId) {
    return res.status(400).json({ error: "Team is required for team allocation." });
  }

  const [batch] = await db
    .select({
      availableForAllocation: cuttingBatchesTable.availableForAllocation,
      productId: cuttingBatchesTable.productId,
      materialId: cuttingBatchesTable.materialId,
    })
    .from(cuttingBatchesTable)
    .where(eq(cuttingBatchesTable.id, cuttingBatchId));

  if (!batch) return res.status(404).json({ error: "Cutting batch not found" });

  if (batchProductId || batchMaterialId) {
    const batchUpdates: Record<string, any> = {};
    if (batchProductId) batchUpdates.productId = batchProductId;
    if (batchMaterialId) batchUpdates.materialId = batchMaterialId;
    await db.update(cuttingBatchesTable).set(batchUpdates)
      .where(eq(cuttingBatchesTable.id, cuttingBatchId));
    if (batchProductId) batch.productId = batchProductId;
    if (batchMaterialId) batch.materialId = batchMaterialId;
  }

  const missing: string[] = [];
  if (!batch.productId) missing.push("Product/Design");
  if (!batch.materialId) missing.push("Material 1");
  if (missing.length > 0) {
    return res.status(400).json({
      error: `Cannot allocate: the cutting batch is missing required fields: ${missing.join(", ")}. Please complete them before allocation.`,
      missingFields: missing,
    });
  }

  if (batch.availableForAllocation < quantityIssued) {
    return res
      .status(400)
      .json({ error: `Only ${batch.availableForAllocation} pieces available for allocation` });
  }

  const allocationNumber = generateAllocationNumber();

  const validWorkTypes = ["simple_stitch", "outsource_required"];
  const wt = validWorkTypes.includes(workType) ? workType : "simple_stitch";
  const validCategories = ["heat_stone", "embroidery", "hand_stones"];
  const oc = wt === "outsource_required" && validCategories.includes(outsourceCategory) ? outsourceCategory : null;

  const [allocation] = await db
    .insert(allocationsTable)
    .values({
      allocationNumber,
      cuttingBatchId,
      allocationType: type,
      stitcherId: type === "individual" ? stitcherId : null,
      teamId: type === "team" ? teamId : null,
      quantityIssued,
      workType: wt,
      outsourceCategory: oc,
      issueDate: new Date(issueDate),
      remarks,
      createdBy: (req as any).user?.username,
    })
    .returning();

  await db
    .update(cuttingBatchesTable)
    .set({
      availableForAllocation: sql`${cuttingBatchesTable.availableForAllocation} - ${quantityIssued}`,
      status: sql`CASE WHEN ${cuttingBatchesTable.status} IN ('cutting', 'returned') THEN 'allocated'::"batch_status" ELSE ${cuttingBatchesTable.status} END`,
    })
    .where(eq(cuttingBatchesTable.id, cuttingBatchId));

  const assignee = type === "team" ? `Team #${teamId}` : `Stitcher #${stitcherId}`;
  await logAudit(
    req,
    "CREATE",
    "allocations",
    String(allocation.id),
    `Allocated ${quantityIssued} pieces to ${assignee}, number: ${allocationNumber}`
  );

  res.status(201).json({ ...allocation, quantityPending: quantityIssued });
});

router.get("/allocation/returns", checkPermission("allocation", "view"), async (req, res) => {
  const { allocationId } = req.query;
  const conditions: any[] = [];
  if (allocationId) conditions.push(eq(allocationReturnsTable.allocationId, Number(allocationId)));

  let q = db.select({
    id: allocationReturnsTable.id,
    allocationId: allocationReturnsTable.allocationId,
    allocationNumber: allocationsTable.allocationNumber,
    batchNumber: cuttingBatchesTable.batchNumber,
    quantityReturned: allocationReturnsTable.quantityReturned,
    returnDate: allocationReturnsTable.returnDate,
    remarks: allocationReturnsTable.remarks,
    createdBy: allocationReturnsTable.createdBy,
    createdAt: allocationReturnsTable.createdAt,
  })
    .from(allocationReturnsTable)
    .leftJoin(allocationsTable, eq(allocationReturnsTable.allocationId, allocationsTable.id))
    .leftJoin(cuttingBatchesTable, eq(allocationsTable.cuttingBatchId, cuttingBatchesTable.id));

  if (conditions.length > 0) q = q.where(and(...conditions)) as typeof q;

  const rows = await q.orderBy(sql`${allocationReturnsTable.createdAt} desc`);
  res.json(rows);
});

router.get("/allocation/:id", checkPermission("allocation", "view"), async (req, res) => {
  const id = parseInt(req.params.id);
  const [row] = await allocJoins(
    db.select(allocSelect).from(allocationsTable)
  ).where(eq(allocationsTable.id, id));
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(withItemCode(row));
});

router.put("/allocation/:id", checkPermission("allocation", "edit"), async (req, res) => {
  const id = parseInt(req.params.id);
  const { issueDate, remarks, stitcherId, teamId, quantityIssued } = req.body;

  const [hasDownstream] = await db.select({ id: receivingsTable.id }).from(receivingsTable).where(eq(receivingsTable.allocationId, id)).limit(1);
  const [hasOutsource] = await db.select({ id: outsourceTransfersTable.id }).from(outsourceTransfersTable).where(eq(outsourceTransfersTable.allocationId, id)).limit(1);
  const isLocked = !!(hasDownstream || hasOutsource);

  if (isLocked && quantityIssued !== undefined) {
    return res.status(400).json({ error: "Cannot change quantity: receiving or outsource records exist for this allocation." });
  }

  const updates: Record<string, any> = {};
  if (issueDate) updates.issueDate = new Date(issueDate);
  if (remarks !== undefined) updates.remarks = remarks;
  if (stitcherId !== undefined) updates.stitcherId = stitcherId || null;
  if (teamId !== undefined) updates.teamId = teamId || null;
  if (!isLocked && quantityIssued !== undefined) updates.quantityIssued = quantityIssued;

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No fields to update." });

  const [row] = await db
    .update(allocationsTable)
    .set(updates)
    .where(eq(allocationsTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Allocation not found." });
  await logAudit(req, "UPDATE", "allocations", String(id), `Updated allocation #${id}`);
  res.json({ ...row, isLocked });
});

router.post("/allocation/return", checkPermission("allocation", "create"), async (req, res) => {
  const { allocationId, quantityReturned, returnDate, remarks } = req.body;

  if (!allocationId || !quantityReturned || !returnDate) {
    return res.status(400).json({ error: "allocationId, quantityReturned, and returnDate are required." });
  }

  const qty = Number(quantityReturned);
  if (!Number.isInteger(qty) || qty <= 0) {
    return res.status(400).json({ error: "Quantity must be a positive integer." });
  }

  const [alloc] = await db
    .select({
      id: allocationsTable.id,
      cuttingBatchId: allocationsTable.cuttingBatchId,
      quantityIssued: allocationsTable.quantityIssued,
      quantityReceived: allocationsTable.quantityReceived,
      quantityRejected: allocationsTable.quantityRejected,
    })
    .from(allocationsTable)
    .where(eq(allocationsTable.id, Number(allocationId)));

  if (!alloc) return res.status(404).json({ error: "Allocation not found." });

  const activeAllocated = alloc.quantityIssued - alloc.quantityReceived - alloc.quantityRejected;

  if (qty > activeAllocated) {
    return res.status(400).json({ error: `Cannot return ${qty}. Only ${activeAllocated} pieces are actively allocated (issued: ${alloc.quantityIssued}, received: ${alloc.quantityReceived}, rejected: ${alloc.quantityRejected}).` });
  }

  const [returnRecord] = await db.transaction(async (tx) => {
    const [record] = await tx
      .insert(allocationReturnsTable)
      .values({
        allocationId: alloc.id,
        quantityReturned: qty,
        returnDate: new Date(returnDate),
        remarks: remarks || null,
        createdBy: (req as any).user?.username,
      })
      .returning();

    await tx
      .update(allocationsTable)
      .set({ quantityIssued: sql`${allocationsTable.quantityIssued} - ${qty}` })
      .where(eq(allocationsTable.id, alloc.id));

    const [updatedBatch] = await tx
      .update(cuttingBatchesTable)
      .set({ availableForAllocation: sql`${cuttingBatchesTable.availableForAllocation} + ${qty}` })
      .where(eq(cuttingBatchesTable.id, alloc.cuttingBatchId))
      .returning({ availableForAllocation: cuttingBatchesTable.availableForAllocation, quantityCut: cuttingBatchesTable.quantityCut, status: cuttingBatchesTable.status });

    if (updatedBatch && updatedBatch.availableForAllocation >= updatedBatch.quantityCut
        && !["partially_received", "fully_received", "in_finishing", "finished"].includes(updatedBatch.status)) {
      await tx
        .update(cuttingBatchesTable)
        .set({ status: "returned" })
        .where(eq(cuttingBatchesTable.id, alloc.cuttingBatchId));
    }

    return [record];
  });

  await logAudit(req, "CREATE", "allocation_returns", String(returnRecord.id),
    `Returned ${qty} pieces from allocation #${alloc.id}`);

  res.status(201).json(returnRecord);
});

export default router;
