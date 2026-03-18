import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  allocationsTable,
  cuttingBatchesTable,
  stitchersTable,
  teamsTable,
  productsTable,
  sizesTable,
  colorsTable,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { logAudit } from "../lib/audit.js";

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || req.user?.role !== "admin") {
    res.status(403).json({ error: "Admin access required." });
    return;
  }
  next();
}

const router: IRouter = Router();

function generateAllocationNumber() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `AL-${y}${m}${d}-${rand}`;
}

router.get("/allocation", async (_req, res) => {
  const rows = await db
    .select({
      id: allocationsTable.id,
      allocationNumber: allocationsTable.allocationNumber,
      cuttingBatchId: allocationsTable.cuttingBatchId,
      batchNumber: cuttingBatchesTable.batchNumber,
      productCode: productsTable.code,
      productName: productsTable.name,
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
    })
    .from(allocationsTable)
    .leftJoin(cuttingBatchesTable, eq(allocationsTable.cuttingBatchId, cuttingBatchesTable.id))
    .leftJoin(productsTable, eq(cuttingBatchesTable.productId, productsTable.id))
    .leftJoin(sizesTable, eq(cuttingBatchesTable.sizeId, sizesTable.id))
    .leftJoin(colorsTable, eq(cuttingBatchesTable.colorId, colorsTable.id))
    .leftJoin(stitchersTable, eq(allocationsTable.stitcherId, stitchersTable.id))
    .leftJoin(teamsTable, eq(stitchersTable.teamId, teamsTable.id))
    .orderBy(sql`${allocationsTable.createdAt} desc`);

  const result = rows.map((r) => ({
    ...r,
    quantityPending: r.quantityIssued - r.quantityReceived - r.quantityRejected,
  }));
  res.json(result);
});

router.post("/allocation", async (req, res) => {
  const { cuttingBatchId, stitcherId, quantityIssued, issueDate, remarks } = req.body;

  // Validate available quantity
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

  // Deduct from cutting batch available quantity and mark as allocated
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
  const [row] = await db
    .select({
      id: allocationsTable.id,
      allocationNumber: allocationsTable.allocationNumber,
      cuttingBatchId: allocationsTable.cuttingBatchId,
      batchNumber: cuttingBatchesTable.batchNumber,
      productCode: productsTable.code,
      productName: productsTable.name,
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
    })
    .from(allocationsTable)
    .leftJoin(cuttingBatchesTable, eq(allocationsTable.cuttingBatchId, cuttingBatchesTable.id))
    .leftJoin(productsTable, eq(cuttingBatchesTable.productId, productsTable.id))
    .leftJoin(sizesTable, eq(cuttingBatchesTable.sizeId, sizesTable.id))
    .leftJoin(colorsTable, eq(cuttingBatchesTable.colorId, colorsTable.id))
    .leftJoin(stitchersTable, eq(allocationsTable.stitcherId, stitchersTable.id))
    .leftJoin(teamsTable, eq(stitchersTable.teamId, teamsTable.id))
    .where(eq(allocationsTable.id, id));

  if (!row) return res.status(404).json({ error: "Not found" });
  res.json({ ...row, quantityPending: row.quantityIssued - row.quantityReceived - row.quantityRejected });
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
