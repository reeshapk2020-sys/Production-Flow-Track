import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  cuttingBatchesTable,
  cuttingFabricUsageTable,
  fabricRollsTable,
  fabricsTable,
  materialsTable,
  allocationsTable,
  receivingsTable,
  finishingRecordsTable,
  finishedGoodsTable,
  productsTable,
  sizesTable,
  colorsTable,
  stitchersTable,
} from "@workspace/db/schema";
import { eq, like, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { computeItemCode } from "../lib/itemCode";

const router: IRouter = Router();

router.get("/traceability/batch/:batchNumber", async (req, res) => {
  const { batchNumber } = req.params;
  const mat1 = alias(materialsTable, "mat1");
  const mat2 = alias(materialsTable, "mat2");

  const [batch] = await db
    .select({
      id: cuttingBatchesTable.id,
      batchNumber: cuttingBatchesTable.batchNumber,
      productCode: productsTable.code,
      productName: productsTable.name,
      sizeName: sizesTable.name,
      colorCode: colorsTable.code,
      colorName: colorsTable.name,
      quantityCut: cuttingBatchesTable.quantityCut,
      cutter: cuttingBatchesTable.cutter,
      cuttingDate: cuttingBatchesTable.cuttingDate,
      status: cuttingBatchesTable.status,
      fabricCode: fabricsTable.code,
      fabricName: fabricsTable.name,
      materialCode: mat1.code,
      materialName: mat1.name,
      material2Code: mat2.code,
      material2Name: mat2.name,
    })
    .from(cuttingBatchesTable)
    .leftJoin(productsTable, eq(cuttingBatchesTable.productId, productsTable.id))
    .leftJoin(sizesTable, eq(cuttingBatchesTable.sizeId, sizesTable.id))
    .leftJoin(colorsTable, eq(cuttingBatchesTable.colorId, colorsTable.id))
    .leftJoin(fabricsTable, eq(cuttingBatchesTable.fabricId, fabricsTable.id))
    .leftJoin(mat1, eq(cuttingBatchesTable.materialId, mat1.id))
    .leftJoin(mat2, eq(cuttingBatchesTable.material2Id, mat2.id))
    .where(eq(cuttingBatchesTable.batchNumber, batchNumber));

  if (!batch) return res.status(404).json({ error: "Batch not found" });

  // Fabric roll usage
  const fabricUsages = await db
    .select({
      rollNumber: fabricRollsTable.rollNumber,
      quantityUsed: cuttingFabricUsageTable.quantityUsed,
    })
    .from(cuttingFabricUsageTable)
    .leftJoin(fabricRollsTable, eq(cuttingFabricUsageTable.fabricRollId, fabricRollsTable.id))
    .where(eq(cuttingFabricUsageTable.cuttingBatchId, batch.id));

  // Allocations
  const allocations = await db
    .select({
      id: allocationsTable.id,
      allocationNumber: allocationsTable.allocationNumber,
      stitcherName: stitchersTable.name,
      quantityIssued: allocationsTable.quantityIssued,
      quantityReceived: allocationsTable.quantityReceived,
      quantityRejected: allocationsTable.quantityRejected,
      issueDate: allocationsTable.issueDate,
      status: allocationsTable.status,
    })
    .from(allocationsTable)
    .leftJoin(stitchersTable, eq(allocationsTable.stitcherId, stitchersTable.id))
    .where(eq(allocationsTable.cuttingBatchId, batch.id));

  // Receivings for all allocations
  const allocationIds = allocations.map((a) => a.id);
  let receivings: any[] = [];
  for (const allocationId of allocationIds) {
    const recs = await db
      .select()
      .from(receivingsTable)
      .where(eq(receivingsTable.allocationId, allocationId));
    receivings = [...receivings, ...recs];
  }

  // Finishing records
  const finishingRecords = await db
    .select()
    .from(finishingRecordsTable)
    .where(eq(finishingRecordsTable.cuttingBatchId, batch.id))
    .orderBy(finishingRecordsTable.processDate);

  // Finished goods
  const finishedGoods = await db
    .select()
    .from(finishedGoodsTable)
    .where(eq(finishedGoodsTable.cuttingBatchId, batch.id));

  // Build timeline
  const timeline: any[] = [];

  // Cutting event
  timeline.push({
    stage: "Cutting",
    eventType: "cutting",
    quantity: batch.quantityCut,
    actor: batch.cutter || "Unknown",
    date: batch.cuttingDate,
    details: `Fabric rolls: ${fabricUsages.map((f) => f.rollNumber).join(", ")}`,
    status: "completed",
  });

  // Allocation events
  for (const alloc of allocations) {
    timeline.push({
      stage: "Allocation",
      eventType: "allocation",
      quantity: alloc.quantityIssued,
      actor: alloc.stitcherName || "Unknown",
      date: alloc.issueDate,
      details: `Allocation #${alloc.allocationNumber} to ${alloc.stitcherName}`,
      status: alloc.status,
    });
  }

  // Receiving events
  for (const rec of receivings) {
    timeline.push({
      stage: "Receiving",
      eventType: "receiving",
      quantity: rec.quantityReceived,
      actor: rec.receivedBy || "Unknown",
      date: rec.receiveDate,
      details: `Received ${rec.quantityReceived}, Rejected: ${rec.quantityRejected}, Damaged: ${rec.quantityDamaged}`,
      status: "completed",
    });
  }

  // Finishing events
  for (const fr of finishingRecords) {
    timeline.push({
      stage: fr.stage.charAt(0).toUpperCase() + fr.stage.slice(1),
      eventType: "finishing",
      quantity: fr.outputQuantity,
      actor: fr.operator || "Unknown",
      date: fr.processDate,
      details: `In: ${fr.inputQuantity}, Out: ${fr.outputQuantity}, Defective: ${fr.defectiveQuantity}`,
      status: "completed",
    });
  }

  // Finished goods events
  for (const fg of finishedGoods) {
    timeline.push({
      stage: "Finished Goods",
      eventType: "finished",
      quantity: fg.quantity,
      actor: fg.enteredBy || "Unknown",
      date: fg.entryDate,
      details: `Added to finished goods store`,
      status: "completed",
    });
  }

  // Sort by date
  timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const itemCode = computeItemCode(batch.productCode, batch.colorCode, batch.materialCode, batch.material2Code);

  res.json({
    batchNumber: batch.batchNumber,
    productCode: batch.productCode || null,
    productName: batch.productName || "Unknown",
    sizeName: batch.sizeName || "-",
    colorCode: batch.colorCode || null,
    colorName: batch.colorName || "-",
    itemCode: itemCode || null,
    fabricCode: batch.fabricCode || null,
    fabricName: batch.fabricName || null,
    materialCode: batch.materialCode || null,
    materialName: batch.materialName || null,
    material2Code: batch.material2Code || null,
    material2Name: batch.material2Name || null,
    currentStage: batch.status || "cutting",
    currentStatus: batch.status,
    timeline,
  });
});

router.get("/traceability/search", async (req, res) => {
  const { q = "", type } = req.query;
  const searchStr = `%${q}%`;
  const results: any[] = [];

  // Search batches
  if (!type || type === "batch") {
    const batches = await db
      .select({
        id: cuttingBatchesTable.id,
        batchNumber: cuttingBatchesTable.batchNumber,
        productName: productsTable.name,
        status: cuttingBatchesTable.status,
      })
      .from(cuttingBatchesTable)
      .leftJoin(productsTable, eq(cuttingBatchesTable.productId, productsTable.id))
      .where(like(cuttingBatchesTable.batchNumber, searchStr))
      .limit(5);

    batches.forEach((b) =>
      results.push({
        type: "batch",
        id: String(b.id),
        label: b.batchNumber,
        subLabel: b.productName || "",
        batchNumber: b.batchNumber,
      })
    );
  }

  // Search stitchers
  if (!type || type === "stitcher") {
    const stitchers = await db
      .select()
      .from(stitchersTable)
      .where(like(stitchersTable.name, searchStr))
      .limit(5);

    stitchers.forEach((s) =>
      results.push({
        type: "stitcher",
        id: String(s.id),
        label: s.name,
        subLabel: "Stitcher",
        batchNumber: "",
      })
    );
  }

  res.json(results);
});

export default router;
