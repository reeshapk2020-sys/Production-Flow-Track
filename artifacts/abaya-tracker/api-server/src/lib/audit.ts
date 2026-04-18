import { Request } from "express";
import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db/schema";

export async function logAudit(
  req: Request,
  action: string,
  tableName: string,
  recordId?: string,
  details?: string
) {
  try {
    const user = (req as any).user;
    await db.insert(auditLogsTable).values({
      userId: user?.id || "system",
      username: user?.username || "system",
      action,
      tableName,
      recordId,
      details,
    });
  } catch (e) {
    // Non-critical, don't throw
    console.error("Audit log failed:", e);
  }
}
