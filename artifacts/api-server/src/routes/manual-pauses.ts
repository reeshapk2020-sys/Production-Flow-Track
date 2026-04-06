import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { manualPausesTable, allocationsTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logAudit } from "../lib/audit.js";
import { checkPermission } from "./permissions.js";

const router: IRouter = Router();

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
  const { allocationId, pauseStart, pauseEnd, reason, remarks } = req.body;

  if (!allocationId || !pauseStart || !pauseEnd) {
    return res.status(400).json({ error: "allocationId, pauseStart, and pauseEnd are required" });
  }

  const pStart = new Date(pauseStart);
  const pEnd = new Date(pauseEnd);

  if (isNaN(pStart.getTime()) || isNaN(pEnd.getTime())) {
    return res.status(400).json({ error: "Invalid date format" });
  }
  if (pEnd <= pStart) {
    return res.status(400).json({ error: "Pause end must be after pause start" });
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
