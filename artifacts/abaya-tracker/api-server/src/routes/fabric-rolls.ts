import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  fabricRollsTable,
  fabricsTable,
  colorsTable,
  cuttingFabricUsageTable,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { logAudit } from "../lib/audit.js";
import { checkPermission } from "./permissions.js";

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || req.user?.role !== "admin") {
    res.status(403).json({ error: "Admin access required." });
    return;
  }
  next();
}

const router: IRouter = Router();

router.get("/fabric-rolls", checkPermission("fabric-rolls", "view"), async (_req, res) => {
  const rows = await db
    .select({
      id: fabricRollsTable.id,
      rollNumber: fabricRollsTable.rollNumber,
      fabricId: fabricRollsTable.fabricId,
      fabricName: fabricsTable.name,
      colorId: fabricRollsTable.colorId,
      colorCode: colorsTable.code,
      colorName: colorsTable.name,
      supplier: fabricRollsTable.supplier,
      totalQuantity: fabricRollsTable.totalQuantity,
      availableQuantity: fabricRollsTable.availableQuantity,
      unit: fabricRollsTable.unit,
      costPerUnit: fabricRollsTable.costPerUnit,
      receivedDate: fabricRollsTable.receivedDate,
      remarks: fabricRollsTable.remarks,
      status: fabricRollsTable.status,
      isLocked: sql<boolean>`EXISTS(SELECT 1 FROM ${cuttingFabricUsageTable} WHERE ${cuttingFabricUsageTable.fabricRollId} = ${fabricRollsTable.id})`.as("isLocked"),
    })
    .from(fabricRollsTable)
    .leftJoin(fabricsTable, eq(fabricRollsTable.fabricId, fabricsTable.id))
    .leftJoin(colorsTable, eq(fabricRollsTable.colorId, colorsTable.id))
    .orderBy(fabricRollsTable.createdAt);
  res.json(rows);
});

router.post("/fabric-rolls", checkPermission("fabric-rolls", "create"), async (req, res) => {
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

router.get("/fabric-rolls/:id", checkPermission("fabric-rolls", "view"), async (req, res) => {
  const id = parseInt(req.params.id);
  const [row] = await db
    .select({
      id: fabricRollsTable.id,
      rollNumber: fabricRollsTable.rollNumber,
      fabricId: fabricRollsTable.fabricId,
      fabricName: fabricsTable.name,
      colorId: fabricRollsTable.colorId,
      colorCode: colorsTable.code,
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

router.put("/fabric-rolls/:id", checkPermission("fabric-rolls", "edit"), async (req, res) => {
  const id = parseInt(req.params.id);
  const { rollNumber, colorId, supplier, receivedDate, remarks } = req.body;

  const [usedInCutting] = await db.select({ id: cuttingFabricUsageTable.id }).from(cuttingFabricUsageTable).where(eq(cuttingFabricUsageTable.fabricRollId, id)).limit(1);
  const isLocked = !!usedInCutting;

  if (isLocked && colorId !== undefined) {
    return res.status(400).json({ error: "Cannot change color: this roll is already used in cutting batches." });
  }

  const updates: Record<string, any> = {};
  if (rollNumber) updates.rollNumber = String(rollNumber).trim();
  if (colorId !== undefined && !isLocked) updates.colorId = colorId;
  if (supplier !== undefined) updates.supplier = supplier;
  if (receivedDate) updates.receivedDate = new Date(receivedDate);
  if (remarks !== undefined) updates.remarks = remarks;

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No fields to update." });

  const [row] = await db
    .update(fabricRollsTable)
    .set(updates)
    .where(eq(fabricRollsTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Fabric roll not found." });
  await logAudit(req, "UPDATE", "fabric_rolls", String(id), `Updated fabric roll: ${rollNumber}`);
  res.json({ ...row, isLocked });
});

export default router;
