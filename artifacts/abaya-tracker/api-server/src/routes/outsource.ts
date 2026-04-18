import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  outsourceTransfersTable,
  allocationsTable,
  cuttingBatchesTable,
  stitchersTable,
  teamsTable,
  productsTable,
  colorsTable,
  sizesTable,
  receivingsTable,
  finishingRecordsTable,
} from "@workspace/db/schema";
import { eq, sql, and, gte, lte, ilike, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { logAudit } from "../lib/audit.js";
import { checkPermission } from "./permissions.js";

const router: IRouter = Router();

const allocTeam = alias(teamsTable, "alloc_team");

router.get("/outsource", checkPermission("outsource", "view"), async (req, res) => {
  const { startDate, endDate, outsourceCategory, status, batchNumber, allocationId } = req.query;
  const conditions: any[] = [];
  if (startDate) conditions.push(gte(outsourceTransfersTable.sendDate, new Date(startDate as string)));
  if (endDate) { const ed = new Date(endDate as string); ed.setDate(ed.getDate() + 1); conditions.push(lte(outsourceTransfersTable.sendDate, ed)); }
  if (outsourceCategory) conditions.push(eq(outsourceTransfersTable.outsourceCategory, outsourceCategory as string));
  if (status) conditions.push(eq(outsourceTransfersTable.status, status as string));
  if (batchNumber) conditions.push(ilike(cuttingBatchesTable.batchNumber, `%${batchNumber}%`));
  if (allocationId) conditions.push(eq(outsourceTransfersTable.allocationId, Number(allocationId)));

  let q = db
    .select({
      id: outsourceTransfersTable.id,
      allocationId: outsourceTransfersTable.allocationId,
      allocationNumber: allocationsTable.allocationNumber,
      batchNumber: cuttingBatchesTable.batchNumber,
      productName: productsTable.name,
      productCode: productsTable.code,
      colorName: colorsTable.name,
      colorCode: colorsTable.code,
      sizeName: sizesTable.name,
      outsourceCategory: outsourceTransfersTable.outsourceCategory,
      quantitySent: outsourceTransfersTable.quantitySent,
      quantityReturned: outsourceTransfersTable.quantityReturned,
      quantityDamaged: outsourceTransfersTable.quantityDamaged,
      vendorName: outsourceTransfersTable.vendorName,
      sendDate: outsourceTransfersTable.sendDate,
      returnDate: outsourceTransfersTable.returnDate,
      status: outsourceTransfersTable.status,
      sourceStage: outsourceTransfersTable.sourceStage,
      remarks: outsourceTransfersTable.remarks,
      createdAt: outsourceTransfersTable.createdAt,
      stitcherName: stitchersTable.name,
      teamName: allocTeam.name,
      allocationType: allocationsTable.allocationType,
    })
    .from(outsourceTransfersTable)
    .leftJoin(allocationsTable, eq(outsourceTransfersTable.allocationId, allocationsTable.id))
    .leftJoin(cuttingBatchesTable, eq(allocationsTable.cuttingBatchId, cuttingBatchesTable.id))
    .leftJoin(productsTable, eq(cuttingBatchesTable.productId, productsTable.id))
    .leftJoin(colorsTable, eq(cuttingBatchesTable.colorId, colorsTable.id))
    .leftJoin(sizesTable, eq(cuttingBatchesTable.sizeId, sizesTable.id))
    .leftJoin(stitchersTable, eq(allocationsTable.stitcherId, stitchersTable.id))
    .leftJoin(allocTeam, eq(allocationsTable.teamId, allocTeam.id));

  if (conditions.length > 0) q = q.where(and(...conditions)) as any;
  const rows = await q.orderBy(sql`${outsourceTransfersTable.createdAt} desc`);

  res.json(rows.map((r: any) => ({
    ...r,
    quantityPending: r.quantitySent - r.quantityReturned - r.quantityDamaged,
    assigneeName: r.allocationType === "team" ? r.teamName : r.stitcherName,
    sourceStage: r.sourceStage || "allocation",
  })));
});

router.get("/outsource/allocations", checkPermission("outsource", "view"), async (_req, res) => {
  const rows = await db
    .select({
      id: allocationsTable.id,
      allocationNumber: allocationsTable.allocationNumber,
      batchNumber: cuttingBatchesTable.batchNumber,
      productName: productsTable.name,
      quantityIssued: allocationsTable.quantityIssued,
      quantityReceived: allocationsTable.quantityReceived,
      workType: allocationsTable.workType,
      outsourceCategory: allocationsTable.outsourceCategory,
      stitcherName: stitchersTable.name,
      teamName: allocTeam.name,
      allocationType: allocationsTable.allocationType,
      status: allocationsTable.status,
    })
    .from(allocationsTable)
    .leftJoin(cuttingBatchesTable, eq(allocationsTable.cuttingBatchId, cuttingBatchesTable.id))
    .leftJoin(productsTable, eq(cuttingBatchesTable.productId, productsTable.id))
    .leftJoin(stitchersTable, eq(allocationsTable.stitcherId, stitchersTable.id))
    .leftJoin(allocTeam, eq(allocationsTable.teamId, allocTeam.id))
    .where(eq(allocationsTable.workType, "outsource_required"))
    .orderBy(sql`${allocationsTable.createdAt} desc`);

  const transfers = await db
    .select({
      allocationId: outsourceTransfersTable.allocationId,
      totalSent: sql<number>`COALESCE(SUM(${outsourceTransfersTable.quantitySent}), 0)::int`,
      totalReturned: sql<number>`COALESCE(SUM(${outsourceTransfersTable.quantityReturned}), 0)::int`,
      totalDamaged: sql<number>`COALESCE(SUM(${outsourceTransfersTable.quantityDamaged}), 0)::int`,
    })
    .from(outsourceTransfersTable)
    .where(eq(outsourceTransfersTable.sourceStage, "allocation"))
    .groupBy(outsourceTransfersTable.allocationId);

  const transferMap = new Map(transfers.map(t => [t.allocationId, t]));

  res.json(rows.map((r: any) => {
    const t: any = transferMap.get(r.id) || { totalSent: 0, totalReturned: 0, totalDamaged: 0 };
    return {
      ...r,
      assigneeName: r.allocationType === "team" ? r.teamName : r.stitcherName,
      totalSentToOutsource: t.totalSent,
      totalReturnedFromOutsource: t.totalReturned,
      totalDamagedInOutsource: t.totalDamaged,
      availableToSend: r.quantityIssued - t.totalSent,
    };
  }));
});

router.get("/outsource/receiving-batches", checkPermission("outsource", "view"), async (_req, res) => {
  const rows = await db
    .select({
      id: allocationsTable.id,
      allocationNumber: allocationsTable.allocationNumber,
      cuttingBatchId: allocationsTable.cuttingBatchId,
      batchNumber: cuttingBatchesTable.batchNumber,
      productName: productsTable.name,
      quantityIssued: allocationsTable.quantityIssued,
      quantityReceived: allocationsTable.quantityReceived,
      workType: allocationsTable.workType,
      outsourceCategory: allocationsTable.outsourceCategory,
      stitcherName: stitchersTable.name,
      teamName: allocTeam.name,
      allocationType: allocationsTable.allocationType,
      status: allocationsTable.status,
    })
    .from(allocationsTable)
    .leftJoin(cuttingBatchesTable, eq(allocationsTable.cuttingBatchId, cuttingBatchesTable.id))
    .leftJoin(productsTable, eq(cuttingBatchesTable.productId, productsTable.id))
    .leftJoin(stitchersTable, eq(allocationsTable.stitcherId, stitchersTable.id))
    .leftJoin(allocTeam, eq(allocationsTable.teamId, allocTeam.id))
    .where(sql`${allocationsTable.quantityReceived} > 0`)
    .orderBy(sql`${allocationsTable.createdAt} desc`);

  const transfers = await db
    .select({
      allocationId: outsourceTransfersTable.allocationId,
      totalSent: sql<number>`COALESCE(SUM(${outsourceTransfersTable.quantitySent}), 0)::int`,
      totalReturned: sql<number>`COALESCE(SUM(${outsourceTransfersTable.quantityReturned}), 0)::int`,
      totalDamaged: sql<number>`COALESCE(SUM(${outsourceTransfersTable.quantityDamaged}), 0)::int`,
    })
    .from(outsourceTransfersTable)
    .where(eq(outsourceTransfersTable.sourceStage, "receiving"))
    .groupBy(outsourceTransfersTable.allocationId);

  const transferMap = new Map(transfers.map(t => [t.allocationId, t]));

  const batchIds = [...new Set(rows.map((r: any) => r.cuttingBatchId).filter(Boolean))];
  const finishingMap = new Map<number, number>();
  if (batchIds.length > 0) {
    const finData = await db
      .select({
        cuttingBatchId: finishingRecordsTable.cuttingBatchId,
        total: sql<number>`COALESCE(SUM(${finishingRecordsTable.outputQuantity}), 0)::int`,
      })
      .from(finishingRecordsTable)
      .where(inArray(finishingRecordsTable.cuttingBatchId, batchIds))
      .groupBy(finishingRecordsTable.cuttingBatchId);
    for (const f of finData) {
      finishingMap.set(f.cuttingBatchId, f.total);
    }
  }

  res.json(rows.map((r: any) => {
    const t: any = transferMap.get(r.id) || { totalSent: 0, totalReturned: 0, totalDamaged: 0 };
    const finishingOutput = finishingMap.get(r.cuttingBatchId) || 0;
    return {
      ...r,
      assigneeName: r.allocationType === "team" ? r.teamName : r.stitcherName,
      totalSentToOutsource: t.totalSent,
      totalReturnedFromOutsource: t.totalReturned,
      totalDamagedInOutsource: t.totalDamaged,
      availableToSend: Math.max(0, (r.quantityReceived || 0) - t.totalSent - finishingOutput),
    };
  }));
});

const VALID_OUTSOURCE_CATEGORIES = ["heat_stone", "embroidery", "hand_stones"];

router.post("/outsource/send", checkPermission("outsource", "create"), async (req, res) => {
  const { allocationId, quantitySent, outsourceCategory, vendorName, sendDate, remarks, sourceStage } = req.body;
  const stage = sourceStage === "receiving" ? "receiving" : "allocation";

  if (!allocationId || !quantitySent || quantitySent <= 0) {
    return res.status(400).json({ error: "Allocation and quantity are required." });
  }
  if (outsourceCategory && !VALID_OUTSOURCE_CATEGORIES.includes(outsourceCategory)) {
    return res.status(400).json({ error: `Invalid outsource category. Must be one of: ${VALID_OUTSOURCE_CATEGORIES.join(", ")}` });
  }

  const [allocation] = await db
    .select()
    .from(allocationsTable)
    .where(eq(allocationsTable.id, allocationId));

  if (!allocation) return res.status(404).json({ error: "Allocation not found." });

  if (stage === "allocation") {
    if (allocation.workType !== "outsource_required") {
      return res.status(400).json({ error: "This allocation is not marked for outsource work." });
    }

    const [existing] = await db
      .select({
        totalSent: sql<number>`COALESCE(SUM(${outsourceTransfersTable.quantitySent}), 0)::int`,
      })
      .from(outsourceTransfersTable)
      .where(and(eq(outsourceTransfersTable.allocationId, allocationId), eq(outsourceTransfersTable.sourceStage, "allocation")));

    const alreadySent = existing?.totalSent || 0;
    const availableToSend = allocation.quantityIssued - alreadySent;

    if (quantitySent > availableToSend) {
      return res.status(400).json({ error: `Only ${availableToSend} pieces available to send to outsource.` });
    }
  } else {
    if ((allocation.quantityReceived || 0) <= 0) {
      return res.status(400).json({ error: "No received pieces available for this allocation." });
    }

    const [existing] = await db
      .select({
        totalSent: sql<number>`COALESCE(SUM(${outsourceTransfersTable.quantitySent}), 0)::int`,
      })
      .from(outsourceTransfersTable)
      .where(and(eq(outsourceTransfersTable.allocationId, allocationId), eq(outsourceTransfersTable.sourceStage, "receiving")));

    const alreadySent = existing?.totalSent || 0;

    const batchId = allocation.cuttingBatchId;
    let finishingOutput = 0;
    if (batchId) {
      const [finResult] = await db
        .select({ total: sql<number>`COALESCE(SUM(${finishingRecordsTable.outputQuantity}), 0)::int` })
        .from(finishingRecordsTable)
        .where(eq(finishingRecordsTable.cuttingBatchId, batchId));
      finishingOutput = finResult?.total ?? 0;
    }

    const availableToSend = (allocation.quantityReceived || 0) - alreadySent - finishingOutput;

    if (quantitySent > availableToSend) {
      return res.status(400).json({ error: `Only ${Math.max(0, availableToSend)} received pieces available to send to outsource (${finishingOutput} already in finishing).` });
    }
  }

  const category = outsourceCategory || allocation.outsourceCategory || "heat_stone";

  const [transfer] = await db
    .insert(outsourceTransfersTable)
    .values({
      allocationId,
      outsourceCategory: category,
      quantitySent,
      vendorName: vendorName || null,
      sendDate: new Date(sendDate || new Date()),
      sourceStage: stage,
      remarks,
      createdBy: (req as any).user?.username,
    })
    .returning();

  await logAudit(
    req,
    "CREATE",
    "outsource_transfers",
    String(transfer.id),
    `Sent ${quantitySent} pieces to outsource (${category}) from ${stage} stage for allocation #${allocation.allocationNumber}`
  );

  res.status(201).json(transfer);
});

router.post("/outsource/return", checkPermission("outsource", "create"), async (req, res) => {
  const { outsourceTransferId, quantityReturned = 0, quantityDamaged = 0, returnDate, remarks } = req.body;

  if (!outsourceTransferId) {
    return res.status(400).json({ error: "Transfer ID is required." });
  }
  if (typeof quantityReturned !== "number" || quantityReturned < 0) {
    return res.status(400).json({ error: "Quantity returned must be a non-negative number." });
  }
  if (typeof quantityDamaged !== "number" || quantityDamaged < 0) {
    return res.status(400).json({ error: "Quantity damaged must be a non-negative number." });
  }
  if (quantityReturned + quantityDamaged <= 0) {
    return res.status(400).json({ error: "Total returned + damaged must be greater than zero." });
  }

  const [transfer] = await db
    .select()
    .from(outsourceTransfersTable)
    .where(eq(outsourceTransfersTable.id, outsourceTransferId));

  if (!transfer) return res.status(404).json({ error: "Outsource transfer not found." });

  const pendingInOutsource = transfer.quantitySent - transfer.quantityReturned - transfer.quantityDamaged;
  const totalReturn = quantityReturned + quantityDamaged;

  if (totalReturn > pendingInOutsource) {
    return res.status(400).json({ error: `Only ${pendingInOutsource} pieces pending with outsource.` });
  }

  const newReturned = transfer.quantityReturned + quantityReturned;
  const newDamaged = transfer.quantityDamaged + quantityDamaged;
  const newStatus = (newReturned + newDamaged) >= transfer.quantitySent ? "returned" : "partial_return";

  await db
    .update(outsourceTransfersTable)
    .set({
      quantityReturned: newReturned,
      quantityDamaged: newDamaged,
      returnDate: new Date(returnDate || new Date()),
      status: newStatus,
    })
    .where(eq(outsourceTransfersTable.id, outsourceTransferId));

  await logAudit(
    req,
    "UPDATE",
    "outsource_transfers",
    String(outsourceTransferId),
    `Returned ${quantityReturned} pieces from outsource (${transfer.outsourceCategory}), damaged: ${quantityDamaged}`
  );

  const updated = await db
    .select()
    .from(outsourceTransfersTable)
    .where(eq(outsourceTransfersTable.id, outsourceTransferId));

  res.json(updated[0]);
});

router.put("/outsource/:id", checkPermission("outsource", "edit"), async (req, res) => {
  const id = parseInt(req.params.id);
  const { vendorName, remarks } = req.body;

  const [transfer] = await db.select().from(outsourceTransfersTable).where(eq(outsourceTransfersTable.id, id));
  if (!transfer) return res.status(404).json({ error: "Outsource transfer not found." });

  const isLocked = transfer.quantityReturned > 0 || transfer.quantityDamaged > 0;
  if (isLocked && vendorName !== undefined) {
    return res.status(400).json({ error: "Cannot change vendor: returns already recorded for this transfer." });
  }

  const updates: Record<string, any> = {};
  if (vendorName !== undefined && !isLocked) updates.vendorName = vendorName || null;
  if (remarks !== undefined) updates.remarks = remarks || null;

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No fields to update." });

  const [row] = await db.update(outsourceTransfersTable).set(updates).where(eq(outsourceTransfersTable.id, id)).returning();
  await logAudit(req, "UPDATE", "outsource_transfers", String(id), `Updated outsource transfer #${id}`);
  res.json({ ...row, isLocked });
});

export default router;
