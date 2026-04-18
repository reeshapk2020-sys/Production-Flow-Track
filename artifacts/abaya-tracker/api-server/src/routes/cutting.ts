import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  cuttingBatchesTable,
  cuttingFabricUsageTable,
  fabricRollsTable,
  fabricsTable,
  materialsTable,
  productsTable,
  sizesTable,
  colorsTable,
  allocationsTable,
  purchaseOrdersTable,
  ordersTable,
} from "@workspace/db/schema";
import { eq, sql, ilike, and, gte, lte } from "drizzle-orm";
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

router.get("/cutting/batches", checkPermission("cutting", "view"), async (req, res) => {
  const { startDate, endDate, productId, colorId, sizeId, batchNumber, status } = req.query;
  const conditions: any[] = [];
  if (startDate) conditions.push(gte(cuttingBatchesTable.cuttingDate, new Date(startDate as string)));
  if (endDate) { const ed = new Date(endDate as string); ed.setDate(ed.getDate() + 1); conditions.push(lte(cuttingBatchesTable.cuttingDate, ed)); }
  if (productId) conditions.push(eq(cuttingBatchesTable.productId, Number(productId)));
  if (colorId) conditions.push(eq(cuttingBatchesTable.colorId, Number(colorId)));
  if (sizeId) conditions.push(eq(cuttingBatchesTable.sizeId, Number(sizeId)));
  if (batchNumber) conditions.push(ilike(cuttingBatchesTable.batchNumber, `%${batchNumber}%`));
  if (status) conditions.push(eq(cuttingBatchesTable.status, status as string));

  let q = db
    .select({
      id: cuttingBatchesTable.id,
      batchNumber: cuttingBatchesTable.batchNumber,
      productId: cuttingBatchesTable.productId,
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
      quantityCut: cuttingBatchesTable.quantityCut,
      availableForAllocation: cuttingBatchesTable.availableForAllocation,
      cutter: cuttingBatchesTable.cutter,
      cuttingDate: cuttingBatchesTable.cuttingDate,
      remarks: cuttingBatchesTable.remarks,
      status: cuttingBatchesTable.status,
      productionFor: cuttingBatchesTable.productionFor,
      poId: cuttingBatchesTable.poId,
      orderId: cuttingBatchesTable.orderId,
      poNumber: purchaseOrdersTable.poNumber,
      orderNumber: ordersTable.orderNumber,
      createdAt: cuttingBatchesTable.createdAt,
    })
    .from(cuttingBatchesTable)
    .leftJoin(productsTable, eq(cuttingBatchesTable.productId, productsTable.id))
    .leftJoin(fabricsTable, eq(cuttingBatchesTable.fabricId, fabricsTable.id))
    .leftJoin(mat1, eq(cuttingBatchesTable.materialId, mat1.id))
    .leftJoin(mat2, eq(cuttingBatchesTable.material2Id, mat2.id))
    .leftJoin(sizesTable, eq(cuttingBatchesTable.sizeId, sizesTable.id))
    .leftJoin(colorsTable, eq(cuttingBatchesTable.colorId, colorsTable.id))
    .leftJoin(purchaseOrdersTable, eq(cuttingBatchesTable.poId, purchaseOrdersTable.id))
    .leftJoin(ordersTable, eq(cuttingBatchesTable.orderId, ordersTable.id))
    .$dynamic();

  if (conditions.length > 0) q = q.where(and(...conditions));
  const rows = await q.orderBy(sql`${cuttingBatchesTable.createdAt} desc`);

  const batchIds = rows.map((r: any) => r.id);
  const allocCounts = batchIds.length > 0 ? await db
    .select({ batchId: allocationsTable.cuttingBatchId, cnt: sql<number>`count(*)`.as("cnt") })
    .from(allocationsTable)
    .where(sql`${allocationsTable.cuttingBatchId} IN (${sql.join(batchIds.map((id: number) => sql`${id}`), sql`, `)})`)
    .groupBy(allocationsTable.cuttingBatchId) : [];
  const lockedSet = new Set(allocCounts.map((a: any) => a.batchId));

  const result = rows.map((r: any) => ({
    ...r,
    totalAllocated: r.quantityCut - r.availableForAllocation,
    itemCode: computeItemCode(r.productCode, r.colorCode, r.materialCode, r.material2Code),
    isLocked: lockedSet.has(r.id),
  }));
  res.json(result);
});

router.post("/cutting/batches", checkPermission("cutting", "create"), async (req, res) => {
  const {
    batchNumber,
    productId,
    fabricId,
    materialId,
    material2Id,
    sizeId,
    colorId,
    quantityCut,
    cutter,
    cuttingDate,
    remarks,
    fabricUsages,
    productionFor,
    poId,
    orderId,
  } = req.body;

  if (!batchNumber || !String(batchNumber).trim()) {
    return res.status(400).json({ error: "Batch number is required." });
  }
  if (!sizeId) {
    return res.status(400).json({ error: "Size is required." });
  }
  if (!colorId) {
    return res.status(400).json({ error: "Color is required." });
  }

  const validProductionFor = ["reesha_stock", "purchase_order", "order"];
  const pf = productionFor || "reesha_stock";
  if (!validProductionFor.includes(pf)) {
    return res.status(400).json({ error: "Invalid productionFor value." });
  }
  if (pf === "purchase_order" && !poId) {
    return res.status(400).json({ error: "Purchase order is required when productionFor is 'purchase_order'." });
  }
  if (pf === "order" && !orderId) {
    return res.status(400).json({ error: "Order is required when productionFor is 'order'." });
  }
  if (pf === "reesha_stock" && (poId || orderId)) {
    return res.status(400).json({ error: "Cannot set PO or Order when productionFor is 'reesha_stock'." });
  }

  const existing = await db
    .select({ id: cuttingBatchesTable.id })
    .from(cuttingBatchesTable)
    .where(ilike(cuttingBatchesTable.batchNumber, String(batchNumber).trim()));

  if (existing.length > 0) {
    return res.status(409).json({ error: `Batch number "${batchNumber}" already exists. Please enter a unique batch number.` });
  }

  const TOLERANCE = 0.5;
  if (fabricUsages && Array.isArray(fabricUsages)) {
    for (const usage of fabricUsages) {
      const [roll] = await db
        .select({ availableQuantity: fabricRollsTable.availableQuantity, rollNumber: fabricRollsTable.rollNumber })
        .from(fabricRollsTable)
        .where(eq(fabricRollsTable.id, usage.fabricRollId));

      if (!roll) {
        return res.status(400).json({ error: `Fabric roll #${usage.fabricRollId} not found.` });
      }

      const available = Number(roll.availableQuantity);
      const used = Number(usage.quantityUsed);
      if (!used || used <= 0) {
        return res.status(400).json({ error: `Quantity used must be a positive number for roll "${roll.rollNumber}".` });
      }
      if (used > available + TOLERANCE) {
        return res.status(400).json({
          error: `Quantity used (${used}) exceeds available quantity (${available}) for roll "${roll.rollNumber}" by more than the allowed tolerance of ${TOLERANCE}.`,
        });
      }
    }
  }

  const [batch] = await db
    .insert(cuttingBatchesTable)
    .values({
      batchNumber: String(batchNumber).trim(),
      productId: productId || null,
      fabricId: fabricId || null,
      materialId: materialId || null,
      material2Id: material2Id || null,
      sizeId,
      colorId,
      quantityCut,
      availableForAllocation: quantityCut,
      cutter,
      cuttingDate: new Date(cuttingDate),
      remarks,
      productionFor: productionFor || "reesha_stock",
      poId: poId || null,
      orderId: orderId || null,
      createdBy: (req as any).user?.username,
    })
    .returning();

  if (fabricUsages && Array.isArray(fabricUsages)) {
    for (const usage of fabricUsages) {
      await db.insert(cuttingFabricUsageTable).values({
        cuttingBatchId: batch.id,
        fabricRollId: usage.fabricRollId,
        quantityUsed: String(usage.quantityUsed),
      });
      await db
        .update(fabricRollsTable)
        .set({
          availableQuantity: sql`${fabricRollsTable.availableQuantity} - ${String(usage.quantityUsed)}`,
          status: sql`CASE 
            WHEN ${fabricRollsTable.availableQuantity} - ${String(usage.quantityUsed)} <= 0 THEN 'exhausted'::"roll_status"
            WHEN ${fabricRollsTable.availableQuantity} - ${String(usage.quantityUsed)} < ${fabricRollsTable.totalQuantity} THEN 'partial'::"roll_status"
            ELSE ${fabricRollsTable.status}
          END`,
        })
        .where(eq(fabricRollsTable.id, usage.fabricRollId));
    }
  }

  await logAudit(
    req,
    "CREATE",
    "cutting_batches",
    String(batch.id),
    `Created cutting batch: ${batchNumber}, qty: ${quantityCut}`
  );
  res.status(201).json({ ...batch, totalAllocated: 0 });
});

router.get("/cutting/batches/:id", checkPermission("cutting", "view"), async (req, res) => {
  const id = parseInt(req.params.id);

  const [batch] = await db
    .select({
      id: cuttingBatchesTable.id,
      batchNumber: cuttingBatchesTable.batchNumber,
      productId: cuttingBatchesTable.productId,
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
      quantityCut: cuttingBatchesTable.quantityCut,
      availableForAllocation: cuttingBatchesTable.availableForAllocation,
      cutter: cuttingBatchesTable.cutter,
      cuttingDate: cuttingBatchesTable.cuttingDate,
      remarks: cuttingBatchesTable.remarks,
      status: cuttingBatchesTable.status,
      productionFor: cuttingBatchesTable.productionFor,
      poId: cuttingBatchesTable.poId,
      orderId: cuttingBatchesTable.orderId,
      poNumber: purchaseOrdersTable.poNumber,
      orderNumber: ordersTable.orderNumber,
      createdAt: cuttingBatchesTable.createdAt,
    })
    .from(cuttingBatchesTable)
    .leftJoin(productsTable, eq(cuttingBatchesTable.productId, productsTable.id))
    .leftJoin(fabricsTable, eq(cuttingBatchesTable.fabricId, fabricsTable.id))
    .leftJoin(mat1, eq(cuttingBatchesTable.materialId, mat1.id))
    .leftJoin(mat2, eq(cuttingBatchesTable.material2Id, mat2.id))
    .leftJoin(sizesTable, eq(cuttingBatchesTable.sizeId, sizesTable.id))
    .leftJoin(colorsTable, eq(cuttingBatchesTable.colorId, colorsTable.id))
    .leftJoin(purchaseOrdersTable, eq(cuttingBatchesTable.poId, purchaseOrdersTable.id))
    .leftJoin(ordersTable, eq(cuttingBatchesTable.orderId, ordersTable.id))
    .where(eq(cuttingBatchesTable.id, id));

  if (!batch) return res.status(404).json({ error: "Not found" });

  const fabricRolls = await db
    .select({
      rollNumber: fabricRollsTable.rollNumber,
      quantityUsed: cuttingFabricUsageTable.quantityUsed,
      unit: fabricRollsTable.unit,
    })
    .from(cuttingFabricUsageTable)
    .leftJoin(fabricRollsTable, eq(cuttingFabricUsageTable.fabricRollId, fabricRollsTable.id))
    .where(eq(cuttingFabricUsageTable.cuttingBatchId, id));

  const allocations = await db
    .select()
    .from(allocationsTable)
    .where(eq(allocationsTable.cuttingBatchId, id));

  const batchWithCode = {
    ...batch,
    totalAllocated: batch.quantityCut - batch.availableForAllocation,
    itemCode: computeItemCode(batch.productCode, batch.colorCode, batch.materialCode, batch.material2Code),
  };

  res.json({ batch: batchWithCode, fabricRolls, allocations });
});

router.put("/cutting/batches/:id", checkPermission("cutting", "edit"), async (req, res) => {
  const id = parseInt(req.params.id);
  const { cutter, cuttingDate, remarks, productId, materialId, material2Id, productionFor, poId, orderId, colorId, sizeId, quantityCut } = req.body;

  const [hasAlloc] = await db.select({ id: allocationsTable.id }).from(allocationsTable).where(eq(allocationsTable.cuttingBatchId, id)).limit(1);
  const isLocked = !!hasAlloc;

  if (isLocked) {
    if (colorId !== undefined) return res.status(400).json({ error: "Cannot change color: allocations exist for this batch." });
    if (sizeId !== undefined) return res.status(400).json({ error: "Cannot change size: allocations exist for this batch." });
  }

  const [currentBatch] = await db.select({
    quantityCut: cuttingBatchesTable.quantityCut,
    availableForAllocation: cuttingBatchesTable.availableForAllocation,
  }).from(cuttingBatchesTable).where(eq(cuttingBatchesTable.id, id));
  if (!currentBatch) return res.status(404).json({ error: "Cutting batch not found." });

  const updates: Record<string, any> = {};
  if (!isLocked && colorId !== undefined) updates.colorId = colorId;
  if (!isLocked && sizeId !== undefined) updates.sizeId = sizeId;
  if (quantityCut !== undefined) {
    const newQty = Number(quantityCut);
    const totalAllocated = currentBatch.quantityCut - currentBatch.availableForAllocation;
    if (newQty < totalAllocated) {
      return res.status(400).json({ error: `Cannot reduce quantity below already allocated amount (${totalAllocated}).` });
    }
    updates.quantityCut = newQty;
    updates.availableForAllocation = newQty - totalAllocated;
  }
  if (cutter !== undefined) updates.cutter = cutter;
  if (cuttingDate) updates.cuttingDate = new Date(cuttingDate);
  if (remarks !== undefined) updates.remarks = remarks;
  if (productId !== undefined) updates.productId = productId || null;
  if (materialId !== undefined) updates.materialId = materialId || null;
  if (material2Id !== undefined) updates.material2Id = material2Id || null;
  if (productionFor !== undefined) updates.productionFor = productionFor || "reesha_stock";
  if (poId !== undefined) updates.poId = poId || null;
  if (orderId !== undefined) updates.orderId = orderId || null;

  const finalPf = updates.productionFor;
  if (finalPf !== undefined) {
    const validPf = ["reesha_stock", "purchase_order", "order"];
    if (!validPf.includes(finalPf)) return res.status(400).json({ error: "Invalid productionFor value." });
    if (finalPf === "purchase_order" && updates.poId === null && poId === undefined) {
      return res.status(400).json({ error: "Purchase order is required when productionFor is 'purchase_order'." });
    }
    if (finalPf === "order" && updates.orderId === null && orderId === undefined) {
      return res.status(400).json({ error: "Order is required when productionFor is 'order'." });
    }
    if (finalPf === "reesha_stock") {
      updates.poId = null;
      updates.orderId = null;
    }
    if (finalPf === "purchase_order") {
      updates.orderId = null;
    }
    if (finalPf === "order") {
      updates.poId = null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No fields to update." });
  }

  const [row] = await db
    .update(cuttingBatchesTable)
    .set(updates)
    .where(eq(cuttingBatchesTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Cutting batch not found." });
  await logAudit(req, "UPDATE", "cutting_batches", String(id), `Updated cutting batch #${id}`);
  res.json({ ...row, isLocked });
});

export default router;
