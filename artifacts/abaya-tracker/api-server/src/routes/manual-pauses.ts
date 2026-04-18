import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { manualPausesTable, allocationsTable, stitchersTable } from "@workspace/db/schema";
import { eq, and, sql, desc, inArray, isNull } from "drizzle-orm";
import { logAudit } from "../lib/audit.js";
import { checkPermission } from "./permissions.js";

const router: IRouter = Router();

router.get("/manual-pauses", checkPermission("receiving", "view"), async (_req: Request, res: Response) => {
  const rows = await db
    .select({
      id: manualPausesTable.id,
      allocationId: manualPausesTable.allocationId,
      pauseStart: manualPausesTable.pauseStart,
      pauseEnd: manualPausesTable.pauseEnd,
      reason: manualPausesTable.reason,
      remarks: manualPausesTable.remarks,
      createdAt: manualPausesTable.createdAt,
      stitcherId: allocationsTable.stitcherId,
      stitcherName: stitchersTable.name,
      allocationNumber: allocationsTable.allocationNumber,
    })
    .from(manualPausesTable)
    .leftJoin(allocationsTable, eq(manualPausesTable.allocationId, allocationsTable.id))
    .leftJoin(stitchersTable, eq(allocationsTable.stitcherId, stitchersTable.id))
    .orderBy(desc(manualPausesTable.pauseStart));

  res.json(rows.map(r => ({
    ...r,
    pauseStart: r.pauseStart instanceof Date ? r.pauseStart.toISOString() : r.pauseStart,
    pauseEnd: r.pauseEnd instanceof Date ? r.pauseEnd.toISOString() : r.pauseEnd,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  })));
});

router.get("/manual-pauses/:allocationId", checkPermission("receiving", "view"), async (req: Request, res: Response) => {
  const allocationId = Number(req.params.allocationId);
  if (!allocationId) return res.status(400).json({ error: "Invalid allocationId" });

  const rows = await db
    .select()
    .from(manualPausesTable)
    .where(eq(manualPausesTable.allocationId, allocationId))
    .orderBy(manualPausesTable.pauseStart);

  res.json(rows.map(r => ({
    ...r,
    pauseStart: r.pauseStart instanceof Date ? r.pauseStart.toISOString() : r.pauseStart,
    pauseEnd: r.pauseEnd instanceof Date ? r.pauseEnd.toISOString() : r.pauseEnd,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  })));
});

router.post("/manual-pauses", checkPermission("receiving", "create"), async (req: Request, res: Response) => {
  const { allocationId: rawAllocationId, stitcherId, pauseStart, pauseEnd, reason, remarks } = req.body;

  if ((!rawAllocationId && !stitcherId) || !pauseStart || !pauseEnd) {
    return res.status(400).json({ error: "stitcherId (or allocationId), pauseStart, and pauseEnd are required" });
  }

  const pStart = new Date(pauseStart);
  const pEnd = new Date(pauseEnd);

  if (isNaN(pStart.getTime()) || isNaN(pEnd.getTime())) {
    return res.status(400).json({ error: "Invalid date format" });
  }
  if (pEnd <= pStart) {
    return res.status(400).json({ error: "Pause end must be after pause start" });
  }

  let allocationId = rawAllocationId ? Number(rawAllocationId) : null;
  if (!allocationId && stitcherId) {
    const [activeAlloc] = await db
      .select({ id: allocationsTable.id })
      .from(allocationsTable)
      .where(and(
        eq(allocationsTable.stitcherId, Number(stitcherId)),
        eq(allocationsTable.allocationType, "individual"),
      ))
      .orderBy(desc(allocationsTable.issueDate))
      .limit(1);
    if (!activeAlloc) {
      return res.status(400).json({ error: "Selected stitcher has no allocations to attach the pause to" });
    }
    allocationId = activeAlloc.id;
  }

  const [alloc] = await db
    .select({ id: allocationsTable.id, issueDate: allocationsTable.issueDate })
    .from(allocationsTable)
    .where(eq(allocationsTable.id, Number(allocationId)));

  if (!alloc) return res.status(404).json({ error: "Allocation not found" });

  if (alloc.issueDate && pStart < new Date(alloc.issueDate)) {
    return res.status(400).json({ error: "Pause start cannot be before allocation issue date" });
  }

  const user = (req as any).user;
  const [row] = await db.insert(manualPausesTable).values({
    allocationId: Number(allocationId),
    pauseStart: pStart,
    pauseEnd: pEnd,
    reason: reason || null,
    remarks: remarks || null,
    createdBy: user?.id || null,
  }).returning();

  await logAudit(req, "CREATE", "manual_pauses", String(row.id), `Manual pause for allocation ${allocationId}`);

  res.json({
    ...row,
    pauseStart: row.pauseStart instanceof Date ? row.pauseStart.toISOString() : row.pauseStart,
    pauseEnd: row.pauseEnd instanceof Date ? row.pauseEnd.toISOString() : row.pauseEnd,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  });
});

router.delete("/manual-pauses/:id", checkPermission("receiving", "create"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid id" });

  const [existing] = await db.select().from(manualPausesTable).where(eq(manualPausesTable.id, id));
  if (!existing) return res.status(404).json({ error: "Not found" });

  await db.delete(manualPausesTable).where(eq(manualPausesTable.id, id));
  await logAudit(req, "DELETE", "manual_pauses", String(id), `Deleted manual pause for allocation ${existing.allocationId}`);

  res.json({ success: true });
});

export default router;
