import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppAuth, getRoleLabel } from "@/lib/auth-context";
import { Loader2, Plus, Pencil, KeyRound, UserX, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL;

interface User {
  id: number;
  username: string;
  fullName: string | null;
  displayName: string | null;
  role: string;
  isActive: boolean;
  replitUserId: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

function roleBadgeColor(role: string) {
  const map: Record<string, string> = {
    admin: "bg-purple-100 text-purple-800",
    cutting: "bg-blue-100 text-blue-800",
    allocation: "bg-amber-100 text-amber-800",
    stitching: "bg-indigo-100 text-indigo-800",
    finishing: "bg-green-100 text-green-800",
    store: "bg-orange-100 text-orange-800",
    reporting: "bg-slate-100 text-slate-700",
    data_entry: "bg-teal-100 text-teal-800",
    supervisor: "bg-rose-100 text-rose-800",
  };
  return map[role] || "bg-cyan-100 text-cyan-800";
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}api${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function UsersPage() {
  const { user: currentUser } = useAppAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: () => apiFetch("/users"),
  });

  const { data: rolesData } = useQuery<{ roles: string[] }>({
    queryKey: ["roles"],
    queryFn: () => fetch(`${BASE}api/permissions/roles`, { credentials: "include" }).then(r => r.json()),
  });
  const availableRoles = rolesData?.roles || ["admin", "cutting", "allocation", "stitching", "finishing", "store", "reporting", "data_entry", "supervisor"];

  const createMutation = useMutation({
    mutationFn: (data: { username: string; fullName: string; password: string; role: string }) =>
      apiFetch("/users", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); setShowCreate(false); toast({ title: "User created" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<User> }) =>
      apiFetch(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); setEditUser(null); toast({ title: "User updated" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetMutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: number; newPassword: string }) =>
      apiFetch(`/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ newPassword }) }),
    onSuccess: () => { setResetUser(null); toast({ title: "Password reset successfully" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiFetch(`/users/${id}`, { method: "PUT", body: JSON.stringify({ isActive }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast({ title: "Status updated" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (currentUser?.role !== "admin") {
    return (
      <AppLayout title="User Management">
        <div className="text-center py-20 text-slate-500">
          <p className="text-lg font-medium">Access Denied</p>
          <p className="mt-2 text-sm">Only administrators can manage users.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="User Management">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Staff Users</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage factory staff accounts and their roles.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="rounded-xl">
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Full Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.fullName || u.displayName || "—"}</TableCell>
                  <TableCell className="text-slate-500 font-mono text-sm">{u.username}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleBadgeColor(u.role)}`}>
                      {getRoleLabel(u.role)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-slate-400">
                      {u.replitUserId ? "Replit" : "Internal"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.isActive ? "default" : "secondary"} className="text-xs">
                      {u.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-400 text-sm">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditUser(u)} className="h-8 w-8 p-0 rounded-lg">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {!u.replitUserId && (
                        <Button size="sm" variant="ghost" onClick={() => setResetUser(u)} className="h-8 w-8 p-0 rounded-lg">
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {currentUser?.appUserId !== u.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleMutation.mutate({ id: u.id, isActive: !u.isActive })}
                          className={`h-8 w-8 p-0 rounded-lg ${u.isActive ? "text-red-500 hover:text-red-700" : "text-green-600 hover:text-green-800"}`}
                        >
                          {u.isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-400 py-10">
                    No users yet. Add your first staff member.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <CreateUserDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={createMutation.mutate}
        loading={createMutation.isPending}
        availableRoles={availableRoles}
      />

      <EditUserDialog
        user={editUser}
        onClose={() => setEditUser(null)}
        onSubmit={(data) => editUser && updateMutation.mutate({ id: editUser.id, data })}
        loading={updateMutation.isPending}
        availableRoles={availableRoles}
      />

      <ResetPasswordDialog
        user={resetUser}
        onClose={() => setResetUser(null)}
        onSubmit={(newPassword) => resetUser && resetMutation.mutate({ id: resetUser.id, newPassword })}
        loading={resetMutation.isPending}
      />
    </AppLayout>
  );
}

function CreateUserDialog({ open, onClose, onSubmit, loading, availableRoles }: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { username: string; fullName: string; password: string; role: string }) => void;
  loading: boolean;
  availableRoles: string[];
}) {
  const [form, setForm] = useState({ username: "", fullName: "", password: "", role: "cutting" });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Mohammed Al-Rashid" required className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Username</Label>
            <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="mohammed_r" required className="rounded-xl font-mono" />
            <p className="text-xs text-slate-400">Letters, numbers and underscores only.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 6 characters" required className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map(r => (
                  <SelectItem key={r} value={r}>{getRoleLabel(r)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
            <Button type="submit" disabled={loading} className="rounded-xl">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, onClose, onSubmit, loading, availableRoles }: {
  user: User | null;
  onClose: () => void;
  onSubmit: (data: Partial<User>) => void;
  loading: boolean;
  availableRoles: string[];
}) {
  const [form, setForm] = useState({ fullName: "", role: "cutting" });

  if (user && form.fullName === "" && user.fullName) {
    setForm({ fullName: user.fullName, role: user.role });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <Dialog open={!!user} onOpenChange={onClose}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User — {user?.username}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} required className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map(r => (
                  <SelectItem key={r} value={r}>{getRoleLabel(r)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
            <Button type="submit" disabled={loading} className="rounded-xl">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ user, onClose, onSubmit, loading }: {
  user: User | null;
  onClose: () => void;
  onSubmit: (newPassword: string) => void;
  loading: boolean;
}) {
  const [newPassword, setNewPassword] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(newPassword);
    setNewPassword("");
  }

  return (
    <Dialog open={!!user} onOpenChange={onClose}>
      <DialogContent className="rounded-2xl max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset Password — {user?.username}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              minLength={6}
              required
              className="rounded-xl"
            />
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
            <Button type="submit" disabled={loading} className="rounded-xl">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset Password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
