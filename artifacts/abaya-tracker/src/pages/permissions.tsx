import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAppAuth, ROLE_LABELS } from "@/lib/auth-context";
import { Loader2, Shield, Save, Lock } from "lucide-react";

const MODULE_LABELS: Record<string, string> = {
  products: "Products",
  colors: "Colors",
  sizes: "Sizes",
  materials: "Materials",
  teams: "Teams",
  stitchers: "Stitchers",
  "fabric-rolls": "Fabric Rolls",
  cutting: "Cutting",
  allocation: "Allocation",
  receiving: "Receiving",
  finishing: "Finishing",
  "finished-goods": "Finished Goods",
  reports: "Reports",
  inventory: "Inventory",
};

const ACTIONS = ["canView", "canCreate", "canEdit", "canImport"] as const;
const ACTION_LABELS: Record<string, string> = {
  canView: "View",
  canCreate: "Create",
  canEdit: "Edit",
  canImport: "Import",
};

type PermMap = Record<string, Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canImport: boolean }>>;

export default function PermissionsPage() {
  const { user } = useAppAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<PermMap>({});
  const [selectedRole, setSelectedRole] = useState<string>("");

  useEffect(() => {
    fetchPermissions();
  }, []);

  async function fetchPermissions() {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/permissions`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setRoles(data.roles);
      setModules(data.modules);
      setPermissions(data.permissions);
      setSelectedRole(data.roles.find((r: string) => r !== "admin") || data.roles[0]);
    } catch {
      toast({ title: "Failed to load permissions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function toggle(role: string, mod: string, action: typeof ACTIONS[number]) {
    if (role === "admin") return;
    setPermissions((prev) => {
      const updated = { ...prev };
      updated[role] = { ...updated[role] };
      updated[role][mod] = { ...updated[role][mod], [action]: !updated[role][mod][action] };
      return updated;
    });
  }

  function toggleAll(role: string, mod: string, checked: boolean) {
    if (role === "admin") return;
    setPermissions((prev) => {
      const updated = { ...prev };
      updated[role] = { ...updated[role] };
      updated[role][mod] = { canView: checked, canCreate: checked, canEdit: checked, canImport: checked };
      return updated;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ permissions }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast({ title: "Permissions saved successfully" });
    } catch {
      toast({ title: "Failed to save permissions", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (user?.role !== "admin") {
    return (
      <AppLayout title="Role Permissions">
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-500">Access denied. Admin only.</p>
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout title="Role Permissions">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const isAdmin = selectedRole === "admin";
  const rolePerm = permissions[selectedRole] || {};

  return (
    <AppLayout title="Role Permissions">
      <Card className="shadow-lg border-slate-200 rounded-2xl overflow-hidden">
        <CardHeader className="bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between py-5 px-6 gap-4">
          <div>
            <CardTitle className="text-xl font-display text-slate-800 flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Role Permissions
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">Configure what each role can access and do.</p>
          </div>
          <Button onClick={save} disabled={saving} className="rounded-xl shadow-md shadow-primary/20">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-2 mb-6">
            {roles.map((role) => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  selectedRole === role
                    ? "bg-primary text-white shadow-md"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {ROLE_LABELS[role] || role}
              </button>
            ))}
          </div>

          {isAdmin && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center gap-3">
              <Lock className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                Admin always has full permissions on all modules. These cannot be changed.
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 w-48">Module</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">All</th>
                  {ACTIONS.map((a) => (
                    <th key={a} className="text-center py-3 px-4 font-semibold text-slate-700">
                      {ACTION_LABELS[a]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map((mod) => {
                  const p = rolePerm[mod] || { canView: false, canCreate: false, canEdit: false, canImport: false };
                  const allChecked = p.canView && p.canCreate && p.canEdit && p.canImport;
                  return (
                    <tr key={mod} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-medium text-slate-800">{MODULE_LABELS[mod] || mod}</td>
                      <td className="py-3 px-4 text-center">
                        <Checkbox
                          checked={allChecked}
                          onCheckedChange={(v) => toggleAll(selectedRole, mod, !!v)}
                          disabled={isAdmin}
                        />
                      </td>
                      {ACTIONS.map((a) => (
                        <td key={a} className="py-3 px-4 text-center">
                          <Checkbox
                            checked={p[a]}
                            onCheckedChange={() => toggle(selectedRole, mod, a)}
                            disabled={isAdmin}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
