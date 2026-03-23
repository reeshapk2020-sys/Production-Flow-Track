import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  allocationsTable,
  cuttingBatchesTable,
  stitchersTable,
  teamsTable,
  productsTable,
  fabricsTable,
  materialsTable,
  sizesTable,
  colorsTable,
  outsourceTransfersTable,
  purchaseOrdersTable,
  ordersTable,
} from "@workspace/db/schema";
import { eq, sql, and, gte, lte, ilike, inArray } from "drizzle-orm";
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
  const { startDate, endDate, productId, colorId, sizeId, stitcherId, teamId, batchNumber } = req.query;
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
      })
      .from(outsourceTransfersTable)
      .where(inArray(outsourceTransfersTable.allocationId, outsourceAllocIds))
      .groupBy(outsourceTransfersTable.allocationId);

    const outsourceMap = new Map(outsourceSums.map(o => [o.allocationId, o]));
    for (const row of mapped) {
      if (row.workType === "outsource_required") {
        const o = outsourceMap.get(row.id) || { totalSent: 0, totalReturned: 0, totalDamaged: 0 };
        (row as any).outsourceSent = o.totalSent;
        (row as any).outsourceReturned = o.totalReturned;
        (row as any).outsourceDamaged = o.totalDamaged;
      }
    }
  }

  res.json(mapped);
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
      status: "allocated",
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
  const { issueDate, remarks } = req.body;
  const [row] = await db
    .update(allocationsTable)
    .set({
      issueDate: issueDate ? new Date(issueDate) : undefined,
      remarks: remarks !== undefined ? remarks : undefined,
    })
    .where(eq(allocationsTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Allocation not found." });
  await logAudit(req, "UPDATE", "allocations", String(id), `Updated allocation #${id}`);
  res.json(row);
});

export default router;
