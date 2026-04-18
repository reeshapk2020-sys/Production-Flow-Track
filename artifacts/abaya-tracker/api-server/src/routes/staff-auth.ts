import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { appUsersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  createSession,
  clearSession,
  getSessionId,
  SESSION_COOKIE,
  SESSION_TTL,
  type SessionData,
} from "../lib/auth.js";

const router: IRouter = Router();

const LoginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

router.post("/staff/login", async (req: Request, res: Response) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  const { username, password } = parsed.data;

  const [user] = await db
    .select()
    .from(appUsersTable)
    .where(eq(appUsersTable.username, username));

  if (!user || !user.passwordHash) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: "Your account has been deactivated. Contact admin." });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  await db
    .update(appUsersTable)
    .set({ lastLoginAt: new Date() })
    .where(eq(appUsersTable.id, user.id));

  const sessionData: SessionData = {
    loginType: "staff",
    staffUserId: user.id,
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);

  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName || user.displayName || user.username,
      role: user.role,
      loginType: "staff",
    },
  });
});

router.post("/staff/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json({ success: true });
});

export default router;
