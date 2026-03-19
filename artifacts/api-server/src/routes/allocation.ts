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
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { logAudit } from "../lib/audit.js";
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
  sizeName: sizesTable.name,
  colorCode: colorsTable.code,
  colorName: colorsTable.name,
  stitcherId: allocationsTable.stitcherId,
  stitcherName: stitchersTable.name,
  teamName: teamsTable.name,
  quantityIssued: allocationsTable.quantityIssued,
  quantityReceived: allocationsTable.quantityReceived,
  quantityRejected: allocationsTable.quantityRejected,
  issueDate: allocationsTable.issueDate,
  remarks: allocationsTable.remarks,
  status: allocationsTable.status,
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
    .leftJoin(teamsTable, eq(stitchersTable.teamId, teamsTable.id));
}

function withItemCode(r: any) {
  return {
    ...r,
    quantityPending: r.quantityIssued - r.quantityReceived - r.quantityRejected,
    itemCode: computeItemCode(r.productCode, r.colorCode, r.materialCode, r.material2Code),
  };
}

router.get("/allocation", async (_req, res) => {
  const rows = await allocJoins(
    db.select(allocSelect).from(allocationsTable)
  ).orderBy(sql`${allocationsTable.createdAt} desc`);
  res.json(rows.map(withItemCode));
});

router.post("/allocation", async (req, res) => {
  const { cuttingBatchId, stitcherId, quantityIssued, issueDate, remarks } = req.body;

  const [batch] = await db
    .select({ availableForAllocation: cuttingBatchesTable.availableForAllocation })
    .from(cuttingBatchesTable)
    .where(eq(cuttingBatchesTable.id, cuttingBatchId));

  if (!batch) return res.status(404).json({ error: "Cutting batch not found" });
  if (batch.availableForAllocation < quantityIssued) {
    return res
      .status(400)
      .json({ error: `Only ${batch.availableForAllocation} pieces available for allocation` });
  }

  const allocationNumber = generateAllocationNumber();

  const [allocation] = await db
    .insert(allocationsTable)
    .values({
      allocationNumber,
      cuttingBatchId,
      stitcherId,
      quantityIssued,
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

  await logAudit(
    req,
    "CREATE",
    "allocations",
    String(allocation.id),
    `Allocated ${quantityIssued} pieces, number: ${allocationNumber}`
  );

  res.status(201).json({ ...allocation, quantityPending: quantityIssued });
});

router.get("/allocation/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [row] = await allocJoins(
    db.select(allocSelect).from(allocationsTable)
  ).where(eq(allocationsTable.id, id));
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(withItemCode(row));
});

router.put("/allocation/:id", requireAdmin, async (req, res) => {
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
