import * as oidc from "openid-client";
import { type Request, type Response } from "express";
import { db } from "@workspace/db";
import { appUsersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  clearSession,
  getOidcConfig,
  getSessionId,
  getSession,
  updateSession,
  type SessionData,
} from "../lib/auth.js";

export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  appUserId?: number;
  role: string;
  fullName?: string | null;
  username?: string | null;
  loginType: "replit" | "staff";
}

declare global {
  namespace Express {
    interface User extends AuthUser {}

    interface Request {
      isAuthenticated(): boolean;
      user?: User | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

async function refreshIfExpired(
  sid: string,
  session: SessionData,
): Promise<SessionData | null> {
  if (session.loginType === "staff") return session;

  const now = Math.floor(Date.now() / 1000);
  if (!session.expires_at || now <= session.expires_at) return session;

  if (!session.refresh_token) return null;

  try {
    const config = await getOidcConfig();
    const tokens = await oidc.refreshTokenGrant(config, session.refresh_token);
    session.access_token = tokens.access_token;
    session.refresh_token = tokens.refresh_token ?? session.refresh_token;
    session.expires_at = tokens.expiresIn()
      ? now + tokens.expiresIn()!
      : session.expires_at;
    await updateSession(sid, session);
    return session;
  } catch {
    return null;
  }
}

export async function authMiddleware(req: any, res: any, next: any): Promise<void> {
  req.isAuthenticated = function () {
    return this.user != null;
  };

  const sid = getSessionId(req as Request);
  if (!sid) {
    next();
    return;
  }

  const session = await getSession(sid);
  if (!session) {
    await clearSession(res as Response, sid);
    next();
    return;
  }

  if (session.loginType === "staff" && session.staffUserId) {
    const [staffUser] = await db
      .select()
      .from(appUsersTable)
      .where(eq(appUsersTable.id, session.staffUserId));

    if (!staffUser || !staffUser.isActive) {
      await clearSession(res as Response, sid);
      next();
      return;
    }

    req.user = {
      id: String(staffUser.id),
      email: null,
      firstName: staffUser.fullName || staffUser.displayName || staffUser.username,
      lastName: null,
      profileImageUrl: null,
      appUserId: staffUser.id,
      role: staffUser.role,
      fullName: staffUser.fullName || staffUser.displayName,
      username: staffUser.username,
      loginType: "staff",
    };
    next();
    return;
  }

  if (session.loginType === "replit" && session.user?.id) {
    const refreshed = await refreshIfExpired(sid, session);
    if (!refreshed) {
      await clearSession(res as Response, sid);
      next();
      return;
    }

    const [appUser] = await db
      .select()
      .from(appUsersTable)
      .where(eq(appUsersTable.replitUserId, session.user.id));

    req.user = {
      ...(refreshed.user!),
      appUserId: appUser?.id,
      role: appUser?.role ?? "reporting",
      fullName: appUser?.fullName || appUser?.displayName || refreshed.user?.firstName,
      username: appUser?.username || refreshed.user?.email,
      loginType: "replit",
    };
    next();
    return;
  }

  await clearSession(res as Response, sid);
  next();
}
