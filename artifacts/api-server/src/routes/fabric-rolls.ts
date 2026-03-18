import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  fabricRollsTable,
  fabricsTable,
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

router.get("/fabric-rolls", async (_req, res) => {
  const rows = await db
    .select({
      id: fabricRollsTable.id,
      rollNumber: fabricRollsTable.rollNumber,
      fabricId: fabricRollsTable.fabricId,
      fabricName: fabricsTable.name,
      colorId: fabricRollsTable.colorId,
      colorName: colorsTable.name,
      supplier: fabricRollsTable.supplier,
      totalQuantity: fabricRollsTable.totalQuantity,
      availableQuantity: fabricRollsTable.availableQuantity,
      unit: fabricRollsTable.unit,
      costPerUnit: fabricRollsTable.costPerUnit,
      receivedDate: fabricRollsTable.receivedDate,
      remarks: fabricRollsTable.remarks,
      status: fabricRollsTable.status,
    })
    .from(fabricRollsTable)
    .leftJoin(fabricsTable, eq(fabricRollsTable.fabricId, fabricsTable.id))
    .leftJoin(colorsTable, eq(fabricRollsTable.colorId, colorsTable.id))
    .orderBy(fabricRollsTable.createdAt);
  res.json(rows);
});

router.post("/fabric-rolls", async (req, res) => {
  const {
    rollNumber,
    fabricId,
    colorId,
    supplier,
    totalQuantity,
    unit,
    costPerUnit,
    receivedDate,
    remarks,
  } = req.body;

  const [row] = await db
    .insert(fabricRollsTable)
    .values({
      rollNumber,
      fabricId,
      colorId,
      supplier,
      totalQuantity: String(totalQuantity),
      availableQuantity: String(totalQuantity),
      unit,
      costPerUnit: costPerUnit ? String(costPerUnit) : null,
      receivedDate: new Date(receivedDate),
      remarks,
      createdBy: (req as any).user?.username,
    })
    .returning();

  await logAudit(req, "CREATE", "fabric_rolls", String(row.id), `Added fabric roll: ${rollNumber}`);
  res.status(201).json(row);
});

router.get("/fabric-rolls/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [row] = await db
    .select({
      id: fabricRollsTable.id,
      rollNumber: fabricRollsTable.rollNumber,
      fabricId: fabricRollsTable.fabricId,
      fabricName: fabricsTable.name,
      colorId: fabricRollsTable.colorId,
      colorName: colorsTable.name,
      supplier: fabricRollsTable.supplier,
      totalQuantity: fabricRollsTable.totalQuantity,
      availableQuantity: fabricRollsTable.availableQuantity,
      unit: fabricRollsTable.unit,
      costPerUnit: fabricRollsTable.costPerUnit,
      receivedDate: fabricRollsTable.receivedDate,
      remarks: fabricRollsTable.remarks,
      status: fabricRollsTable.status,
    })
    .from(fabricRollsTable)
    .leftJoin(fabricsTable, eq(fabricRollsTable.fabricId, fabricsTable.id))
    .leftJoin(colorsTable, eq(fabricRollsTable.colorId, colorsTable.id))
    .where(eq(fabricRollsTable.id, id));

  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

router.put("/fabric-rolls/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { rollNumber, supplier, receivedDate, remarks } = req.body;
  const [row] = await db
    .update(fabricRollsTable)
    .set({
      rollNumber: rollNumber ? String(rollNumber).trim() : undefined,
      supplier: supplier !== undefined ? supplier : undefined,
      receivedDate: receivedDate ? new Date(receivedDate) : undefined,
      remarks: remarks !== undefined ? remarks : undefined,
    })
    .where(eq(fabricRollsTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Fabric roll not found." });
  await logAudit(req, "UPDATE", "fabric_rolls", String(id), `Updated fabric roll: ${rollNumber}`);
  res.json(row);
});

export default router;
