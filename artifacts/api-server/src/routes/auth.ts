import * as oidc from "openid-client";
import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { appUsersTable } from "@workspace/db/schema";
import {
  clearSession,
  getOidcConfig,
  getSessionId,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
  ISSUER_URL,
  type SessionData,
} from "../lib/auth.js";
import { eq } from "drizzle-orm";

const OIDC_COOKIE_TTL = 10 * 60 * 1000;

const ExchangeMobileAuthorizationCodeBody = z.object({
  code: z.string().min(1),
  code_verifier: z.string().min(1),
  redirect_uri: z.string().min(1),
  state: z.string().min(1),
  nonce: z.string().min(1).optional(),
});

const router: IRouter = Router();

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host =
    req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function setOidcCookie(res: Response, name: string, value: string) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_COOKIE_TTL,
  });
}

function getSafeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

async function upsertAuthUser(claims: Record<string, unknown>) {
  const replitUserId = claims.sub as string;
  const username = (claims.username as string) || (claims.email as string) || replitUserId;
  const displayName = [claims.first_name, claims.last_name].filter(Boolean).join(" ") || username;

  // Upsert into app_users
  const existing = await db
    .select()
    .from(appUsersTable)
    .where(eq(appUsersTable.replitUserId, replitUserId));

  if (existing.length === 0) {
    const [newUser] = await db
      .insert(appUsersTable)
      .values({
        replitUserId,
        username,
        displayName,
        role: "reporting",
        isActive: true,
      })
      .returning();
    return newUser;
  }
  return existing[0];
}

router.get("/auth/user", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.json({ isAuthenticated: false });
    return;
  }
  const user = req.user as any;
  // Try to fetch role from app_users
  let role = "reporting";
  let appUserId: number | undefined;
  if (user.id) {
    const [appUser] = await db
      .select()
      .from(appUsersTable)
      .where(eq(appUsersTable.replitUserId, user.id));
    if (appUser) {
      role = appUser.role;
      appUserId = appUser.id;
    }
  }
  res.json({
    isAuthenticated: true,
    user: {
      ...user,
      role,
      appUserId,
    },
  });
});

router.get("/login", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const returnTo = getSafeReturnTo(req.query.returnTo);

  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

  const redirectTo = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: "openid email profile offline_access",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "login consent",
    state,
    nonce,
  });

  setOidcCookie(res, "code_verifier", codeVerifier);
  setOidcCookie(res, "nonce", nonce);
  setOidcCookie(res, "state", state);
  setOidcCookie(res, "return_to", returnTo);

  res.redirect(redirectTo.href);
});

router.get("/callback", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const codeVerifier = req.cookies?.code_verifier;
  const nonce = req.cookies?.nonce;
  const expectedState = req.cookies?.state;

  if (!codeVerifier || !expectedState) {
    res.redirect("/api/login");
    return;
  }

  const currentUrl = new URL(
    `${callbackUrl}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`,
  );

  let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
  try {
    tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedNonce: nonce,
      expectedState,
      idTokenExpected: true,
    });
  } catch {
    res.redirect("/api/login");
    return;
  }

  const returnTo = getSafeReturnTo(req.cookies?.return_to);

  res.clearCookie("code_verifier", { path: "/" });
  res.clearCookie("nonce", { path: "/" });
  res.clearCookie("state", { path: "/" });
  res.clearCookie("return_to", { path: "/" });

  const claims = tokens.claims();
  if (!claims) {
    res.redirect("/api/login");
    return;
  }

  await upsertAuthUser(claims as unknown as Record<string, unknown>);

  const now = Math.floor(Date.now() / 1000);
  const sessionData: SessionData = {
    user: {
      id: claims.sub as string,
      email: (claims.email as string) || null,
      firstName: (claims.first_name as string) || null,
      lastName: (claims.last_name as string) || null,
      profileImageUrl: ((claims.profile_image_url || claims.picture) as string) || null,
    },
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : (claims.exp as number),
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.redirect(returnTo);
});

router.get("/logout", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const origin = getOrigin(req);

  const sid = getSessionId(req);
  await clearSession(res, sid);

  const endSessionUrl = oidc.buildEndSessionUrl(config, {
    client_id: process.env.REPL_ID!,
    post_logout_redirect_uri: origin,
  });

  res.redirect(endSessionUrl.href);
});

router.post("/mobile-auth/token-exchange", async (req: Request, res: Response) => {
  const parsed = ExchangeMobileAuthorizationCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required parameters" });
    return;
  }

  const { code, code_verifier, redirect_uri, state, nonce } = parsed.data;

  try {
    const config = await getOidcConfig();

    const callbackUrl = new URL(redirect_uri);
    callbackUrl.searchParams.set("code", code);
    callbackUrl.searchParams.set("state", state);
    callbackUrl.searchParams.set("iss", ISSUER_URL);

    const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
      pkceCodeVerifier: code_verifier,
      expectedNonce: nonce ?? undefined,
      expectedState: state,
      idTokenExpected: true,
    });

    const claims = tokens.claims();
    if (!claims) {
      res.status(401).json({ error: "No claims in ID token" });
      return;
    }

    await upsertAuthUser(claims as unknown as Record<string, unknown>);

    const now = Math.floor(Date.now() / 1000);
    const sessionData: SessionData = {
      user: {
        id: claims.sub as string,
        email: (claims.email as string) || null,
        firstName: (claims.first_name as string) || null,
        lastName: (claims.last_name as string) || null,
        profileImageUrl: ((claims.profile_image_url || claims.picture) as string) || null,
      },
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : (claims.exp as number),
    };

    const sid = await createSession(sessionData);
    res.json({ token: sid });
  } catch (err) {
    console.error("Mobile token exchange error:", err);
    res.status(500).json({ error: "Token exchange failed" });
  }
});

router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) {
    await deleteSession(sid);
  }
  res.json({ success: true });
});

export default router;
