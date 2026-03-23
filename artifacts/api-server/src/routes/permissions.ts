import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { rolePermissionsTable, appUsersTable } from "@workspace/db/schema";
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
  "fabric-rolls", "cutting", "allocation", "outsource", "receiving", "finishing", "purchase-orders", "orders",
  "finished-goods", "reports", "inventory",
];

const SYSTEM_ROLES = ["admin", "cutting", "allocation", "stitching", "finishing", "store", "reporting", "data_entry", "supervisor"];

async function getAllRoles(): Promise<string[]> {
  const rows = await db.selectDistinct({ role: rolePermissionsTable.role }).from(rolePermissionsTable);
  const dbRoles = rows.map(r => r.role);
  const allRoles = new Set([...SYSTEM_ROLES, ...dbRoles]);
  return Array.from(allRoles);
}

router.get("/permissions", requireAdmin, async (_req: Request, res: Response) => {
  const roles = await getAllRoles();
  const rows = await db.select().from(rolePermissionsTable);
  const grouped: Record<string, Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canImport: boolean }>> = {};
  for (const role of roles) {
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
  res.json({ roles, modules: MODULES, permissions: grouped });
});

router.put("/permissions", requireAdmin, async (req: Request, res: Response) => {
  const { permissions } = req.body as {
    permissions: Record<string, Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canImport: boolean }>>;
  };

  if (!permissions) {
    res.status(400).json({ error: "Missing permissions payload." });
    return;
  }

  const roles = await getAllRoles();

  for (const role of Object.keys(permissions)) {
    if (role === "admin") continue;
    if (!roles.includes(role)) continue;
    for (const mod of Object.keys(permissions[role])) {
      if (!MODULES.includes(mod)) continue;
      const p = permissions[role][mod];
      const existing = await db.select().from(rolePermissionsTable)
        .where(and(eq(rolePermissionsTable.role, role), eq(rolePermissionsTable.module, mod)));

      if (existing.length > 0) {
        await db.update(rolePermissionsTable)
          .set({ canView: p.canView, canCreate: p.canCreate, canEdit: p.canEdit, canImport: p.canImport })
          .where(and(eq(rolePermissionsTable.role, role), eq(rolePermissionsTable.module, mod)));
      } else {
        await db.insert(rolePermissionsTable).values({
          role: role,
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

  const rows = await db.select().from(rolePermissionsTable).where(eq(rolePermissionsTable.role, role));
  const perms: Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canImport: boolean }> = {};
  for (const mod of MODULES) {
    perms[mod] = { canView: false, canCreate: false, canEdit: false, canImport: false };
  }
  for (const r of rows) {
    perms[r.module] = { canView: r.canView, canCreate: r.canCreate, canEdit: r.canEdit, canImport: r.canImport };
  }
  res.json({ permissions: perms });
});

router.post("/permissions/roles", requireAdmin, async (req: Request, res: Response) => {
  const { roleName } = req.body;
  if (!roleName || typeof roleName !== "string") {
    res.status(400).json({ error: "Role name is required." });
    return;
  }

  const normalized = roleName.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  if (!normalized || normalized.length < 2) {
    res.status(400).json({ error: "Role name must be at least 2 characters (letters, numbers, underscores)." });
    return;
  }

  if (normalized === "admin") {
    res.status(400).json({ error: "Cannot create a role named 'admin'." });
    return;
  }

  const existing = await db.select().from(rolePermissionsTable).where(eq(rolePermissionsTable.role, normalized));
  if (existing.length > 0) {
    res.status(409).json({ error: `Role '${normalized}' already exists.` });
    return;
  }

  const rows = MODULES.map(mod => ({
    role: normalized,
    module: mod,
    canView: false,
    canCreate: false,
    canEdit: false,
    canImport: false,
  }));
  await db.insert(rolePermissionsTable).values(rows);

  res.status(201).json({ role: normalized });
});

router.delete("/permissions/roles/:role", requireAdmin, async (req: Request, res: Response) => {
  const role = req.params.role;
  if (SYSTEM_ROLES.includes(role)) {
    res.status(400).json({ error: "Cannot delete a system role." });
    return;
  }

  const usersWithRole = await db.select({ id: appUsersTable.id }).from(appUsersTable).where(eq(appUsersTable.role, role));
  if (usersWithRole.length > 0) {
    res.status(400).json({ error: `Cannot delete role "${role}" — ${usersWithRole.length} user(s) still assigned to it. Reassign them first.` });
    return;
  }

  await db.delete(rolePermissionsTable).where(eq(rolePermissionsTable.role, role));
  res.json({ success: true });
});

router.get("/permissions/roles", requireAdmin, async (_req: Request, res: Response) => {
  const roles = await getAllRoles();
  res.json({ roles, systemRoles: SYSTEM_ROLES });
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
      .where(and(eq(rolePermissionsTable.role, req.user!.role), eq(rolePermissionsTable.module, module)));

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
