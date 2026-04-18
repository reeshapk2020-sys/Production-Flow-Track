import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { offDaysTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logAudit } from "../lib/audit.js";

const router: IRouter = Router();

router.get("/off-days", async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: "Authentication required" });
  const rows = await db.select().from(offDaysTable).orderBy(offDaysTable.type, offDaysTable.dayOfWeek, offDaysTable.date);
  res.json(rows);
});

router.post("/off-days", async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }

  const { type, dayOfWeek, date, label } = req.body;

  if (type === "weekly") {
    if (dayOfWeek === undefined || dayOfWeek === null || !Number.isInteger(Number(dayOfWeek)) || Number(dayOfWeek) < 0 || Number(dayOfWeek) > 6) {
      return res.status(400).json({ error: "dayOfWeek must be 0-6 (Sunday=0)" });
    }
    const [row] = await db.insert(offDaysTable).values({
      type: "weekly",
      dayOfWeek: Number(dayOfWeek),
      label: label || null,
    }).returning();
    await logAudit(req, "CREATE", "off_days", String(row.id), `Added weekly off day: ${dayOfWeek}`);
    return res.json(row);
  }

  if (type === "holiday") {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "date must be YYYY-MM-DD format" });
    }
    const [row] = await db.insert(offDaysTable).values({
      type: "holiday",
      date,
      label: label || null,
    }).returning();
    await logAudit(req, "CREATE", "off_days", String(row.id), `Added holiday: ${date}`);
    return res.json(row);
  }

  return res.status(400).json({ error: "type must be 'weekly' or 'holiday'" });
});

router.delete("/off-days/:id", async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }

  const id = Number(req.params.id);
  await db.delete(offDaysTable).where(eq(offDaysTable.id, id));
  await logAudit(req, "DELETE", "off_days", String(id), "Removed off day entry");
  res.json({ success: true });
});

export default router;
