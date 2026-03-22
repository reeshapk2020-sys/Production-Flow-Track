import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { rolePermissionsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || req.user?.role !== "admin") {
    res.status(403).json({ error: "Admin access required." });
    return;
  }
  next();
}

const MODULES = [
  "products", "colors", "sizes", "materials", "teams", "stitchers",
  "fabric-rolls", "cutting", "allocation", "receiving", "finishing",
  "finished-goods", "reports", "inventory",
];

const ROLES = ["admin", "cutting", "allocation", "stitching", "finishing", "store", "reporting"];

router.get("/permissions", requireAdmin, async (_req: Request, res: Response) => {
  const rows = await db.select().from(rolePermissionsTable);
  const grouped: Record<string, Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canImport: boolean }>> = {};
  for (const role of ROLES) {
    grouped[role] = {};
    for (const mod of MODULES) {
      grouped[role][mod] = { canView: false, canCreate: false, canEdit: false, canImport: false };
    }
  }
  for (const r of rows) {
    if (grouped[r.role]) {
      grouped[r.role][r.module] = {
        canView: r.canView,
        canCreate: r.canCreate,
        canEdit: r.canEdit,
        canImport: r.canImport,
      };
    }
  }
  for (const mod of MODULES) {
    grouped["admin"][mod] = { canView: true, canCreate: true, canEdit: true, canImport: true };
  }
  res.json({ roles: ROLES, modules: MODULES, permissions: grouped });
});

router.put("/permissions", requireAdmin, async (req: Request, res: Response) => {
  const { permissions } = req.body as {
    permissions: Record<string, Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canImport: boolean }>>;
  };

  if (!permissions) {
    res.status(400).json({ error: "Missing permissions payload." });
    return;
  }

  for (const role of Object.keys(permissions)) {
    if (role === "admin") continue;
    if (!ROLES.includes(role)) continue;
    for (const mod of Object.keys(permissions[role])) {
      if (!MODULES.includes(mod)) continue;
      const p = permissions[role][mod];
      const existing = await db.select().from(rolePermissionsTable)
        .where(and(eq(rolePermissionsTable.role, role as any), eq(rolePermissionsTable.module, mod)));

      if (existing.length > 0) {
        await db.update(rolePermissionsTable)
          .set({ canView: p.canView, canCreate: p.canCreate, canEdit: p.canEdit, canImport: p.canImport })
          .where(and(eq(rolePermissionsTable.role, role as any), eq(rolePermissionsTable.module, mod)));
      } else {
        await db.insert(rolePermissionsTable).values({
          role: role as any,
          module: mod,
          canView: p.canView,
          canCreate: p.canCreate,
          canEdit: p.canEdit,
          canImport: p.canImport,
        });
      }
    }
  }
  res.json({ success: true });
});

router.get("/permissions/my", requireAuth, async (req: Request, res: Response) => {
  const role = req.user!.role;
  if (role === "admin") {
    const perms: Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canImport: boolean }> = {};
    for (const mod of MODULES) {
      perms[mod] = { canView: true, canCreate: true, canEdit: true, canImport: true };
    }
    res.json({ permissions: perms });
    return;
  }

  const rows = await db.select().from(rolePermissionsTable).where(eq(rolePermissionsTable.role, role as any));
  const perms: Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canImport: boolean }> = {};
  for (const mod of MODULES) {
    perms[mod] = { canView: false, canCreate: false, canEdit: false, canImport: false };
  }
  for (const r of rows) {
    perms[r.module] = { canView: r.canView, canCreate: r.canCreate, canEdit: r.canEdit, canImport: r.canImport };
  }
  res.json({ permissions: perms });
});

export function checkPermission(module: string, action: "view" | "create" | "edit" | "import") {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    if (req.user!.role === "admin") {
      next();
      return;
    }

    const [perm] = await db.select().from(rolePermissionsTable)
      .where(and(eq(rolePermissionsTable.role, req.user!.role as any), eq(rolePermissionsTable.module, module)));

    if (!perm) {
      res.status(403).json({ error: `No permission for ${module} ${action}.` });
      return;
    }

    const fieldMap = { view: "canView", create: "canCreate", edit: "canEdit", import: "canImport" } as const;
    if (!perm[fieldMap[action]]) {
      res.status(403).json({ error: `No permission for ${module} ${action}.` });
      return;
    }

    next();
  };
}

export default router;
