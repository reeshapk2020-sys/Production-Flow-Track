import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { appUsersTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

function requireAdmin(req: Request, res: Response): boolean {
  const user = req.user as any;
  if (!req.isAuthenticated() || user?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

const CreateUserBody = z.object({
  username: z.string().min(2).max(50).regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers and underscores"),
  fullName: z.string().min(2).max(100),
  password: z.string().min(6),
  role: z.string().min(2),
  isActive: z.boolean().optional().default(true),
});

const UpdateUserBody = z.object({
  fullName: z.string().min(2).max(100).optional(),
  role: z.string().min(2).optional(),
  isActive: z.boolean().optional(),
});

const ResetPasswordBody = z.object({
  newPassword: z.string().min(6),
});

router.get("/users", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const users = await db
    .select({
      id: appUsersTable.id,
      username: appUsersTable.username,
      fullName: appUsersTable.fullName,
      displayName: appUsersTable.displayName,
      role: appUsersTable.role,
      isActive: appUsersTable.isActive,
      replitUserId: appUsersTable.replitUserId,
      lastLoginAt: appUsersTable.lastLoginAt,
      createdAt: appUsersTable.createdAt,
    })
    .from(appUsersTable)
    .orderBy(desc(appUsersTable.createdAt));

  res.json(users);
});

router.post("/users", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
    return;
  }

  const { username, fullName, password, role, isActive } = parsed.data;

  const existing = await db
    .select({ id: appUsersTable.id })
    .from(appUsersTable)
    .where(eq(appUsersTable.username, username));

  if (existing.length > 0) {
    res.status(409).json({ error: "Username already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [user] = await db
    .insert(appUsersTable)
    .values({
      username,
      fullName,
      displayName: fullName,
      passwordHash,
      role,
      isActive: isActive ?? true,
    })
    .returning({
      id: appUsersTable.id,
      username: appUsersTable.username,
      fullName: appUsersTable.fullName,
      role: appUsersTable.role,
      isActive: appUsersTable.isActive,
      createdAt: appUsersTable.createdAt,
    });

  res.status(201).json(user);
});

router.put("/users/:id", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
    return;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.fullName !== undefined) {
    updates.fullName = parsed.data.fullName;
    updates.displayName = parsed.data.fullName;
  }
  if (parsed.data.role !== undefined) updates.role = parsed.data.role;
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

  const [user] = await db
    .update(appUsersTable)
    .set(updates)
    .where(eq(appUsersTable.id, id))
    .returning({
      id: appUsersTable.id,
      username: appUsersTable.username,
      fullName: appUsersTable.fullName,
      role: appUsersTable.role,
      isActive: appUsersTable.isActive,
    });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(user);
});

router.post("/users/:id/reset-password", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);

  const [user] = await db
    .update(appUsersTable)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(appUsersTable.id, id))
    .returning({ id: appUsersTable.id });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ success: true });
});

router.delete("/users/:id", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const id = parseInt(req.params.id as string);
  const currentUser = req.user as any;

  if (currentUser?.appUserId === id) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }

  await db.delete(appUsersTable).where(eq(appUsersTable.id, id));
  res.json({ success: true });
});

export default router;
