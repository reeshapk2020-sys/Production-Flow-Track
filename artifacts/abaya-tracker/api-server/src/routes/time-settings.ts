import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { timeSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logAudit } from "../lib/audit.js";

const router: IRouter = Router();

const SINGLETON_ID = 1;

async function ensureSettings() {
  const [existing] = await db.select().from(timeSettingsTable).where(eq(timeSettingsTable.id, SINGLETON_ID));
  if (existing) return existing;
  const [row] = await db.insert(timeSettingsTable).values({
    id: SINGLETON_ID,
    slot1Start: 480,
    slot1End: 800,
    slot2Start: 870,
    slot2End: 1200,
    slot2Effective: 270,
    slot3Start: 1230,
    slot3End: 1380,
    minutesPerPoint: 20,
  }).onConflictDoNothing().returning();
  if (row) return row;
  const [fallback] = await db.select().from(timeSettingsTable).where(eq(timeSettingsTable.id, SINGLETON_ID));
  return fallback;
}

function validateMinute(v: any): number | null {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 1439) return null;
  return n;
}

router.get("/time-settings", async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: "Authentication required" });
  const settings = await ensureSettings();
  res.json(settings);
});

router.put("/time-settings", async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }

  const body = req.body;
  const errors: string[] = [];

  const s1s = validateMinute(body.slot1Start);
  const s1e = validateMinute(body.slot1End);
  const s2s = validateMinute(body.slot2Start);
  const s2e = validateMinute(body.slot2End);
  const s3s = validateMinute(body.slot3Start);
  const s3e = validateMinute(body.slot3End);

  if (s1s === null || s1e === null) errors.push("Slot 1 times must be integers 0-1439");
  if (s2s === null || s2e === null) errors.push("Slot 2 times must be integers 0-1439");
  if (s3s === null || s3e === null) errors.push("Slot 3 times must be integers 0-1439");

  if (s1s !== null && s1e !== null && s1s >= s1e) errors.push("Slot 1 start must be before end");
  if (s2s !== null && s2e !== null && s2s >= s2e) errors.push("Slot 2 start must be before end");
  if (s3s !== null && s3e !== null && s3s >= s3e) errors.push("Slot 3 start must be before end");

  if (s1e !== null && s2s !== null && s1e > s2s) errors.push("Slot 1 end must not overlap Slot 2 start");
  if (s2e !== null && s3s !== null && s2e > s3s) errors.push("Slot 2 end must not overlap Slot 3 start");

  const mpp = Number(body.minutesPerPoint);
  if (!Number.isInteger(mpp) || mpp < 1 || mpp > 1440) errors.push("minutesPerPoint must be 1-1440");

  let s2eff: number | null = null;
  if (body.slot2Effective !== null && body.slot2Effective !== undefined && body.slot2Effective !== "") {
    s2eff = Number(body.slot2Effective);
    if (!Number.isInteger(s2eff) || s2eff < 0) {
      errors.push("slot2Effective must be a non-negative integer or null");
      s2eff = null;
    } else if (s2s !== null && s2e !== null && s2eff > (s2e - s2s)) {
      errors.push("slot2Effective cannot exceed slot 2 duration");
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join("; ") });
  }

  const existing = await ensureSettings();

  const [row] = await db.update(timeSettingsTable).set({
    slot1Start: s1s!,
    slot1End: s1e!,
    slot2Start: s2s!,
    slot2End: s2e!,
    slot2Effective: s2eff,
    slot3Start: s3s!,
    slot3End: s3e!,
    minutesPerPoint: mpp,
    updatedAt: new Date(),
  }).where(eq(timeSettingsTable.id, existing.id)).returning();

  await logAudit(req, "UPDATE", "time_settings", String(existing.id), "Updated time settings");
  res.json(row);
});

export default router;
