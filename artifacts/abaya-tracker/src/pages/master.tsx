import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertCircle, Pencil, Plus, Loader2, Users, Shield } from "lucide-react";
import { useState } from "react";
import {
  useListCategories, useCreateCategory, getListCategoriesQueryKey,
  useListColors, useCreateColor, useUpdateColor, getListColorsQueryKey,
  useListSizes, useCreateSize, getListSizesQueryKey,
  useListFabrics, useCreateFabric, getListFabricsQueryKey,
  useListProducts, useCreateProduct, getListProductsQueryKey,
  useListTeams, useCreateTeam, useUpdateTeam, getListTeamsQueryKey,
  useListStitchers, useCreateStitcher, useUpdateStitcher, getListStitchersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAppAuth } from "@/lib/auth-context";
import { fmtCode } from "@/lib/utils";

export default function MasterDataPage() {
  const { user } = useAppAuth();
  const isAdmin = user?.role === "admin";

  return (
    <AppLayout title="Master Data">
      <Tabs defaultValue="categories" className="w-full">
        <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 mb-6 inline-block overflow-x-auto max-w-full">
          <TabsList className="bg-transparent h-auto p-0 flex space-x-1 flex-wrap gap-y-1">
            <TabsTrigger value="categories" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-slate-100 data-[state=active]:text-primary data-[state=active]:shadow-none">Categories</TabsTrigger>
            <TabsTrigger value="colors" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-slate-100 data-[state=active]:text-primary data-[state=active]:shadow-none">Colors</TabsTrigger>
            <TabsTrigger value="sizes" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-slate-100 data-[state=active]:text-primary data-[state=active]:shadow-none">Sizes</TabsTrigger>
            <TabsTrigger value="fabrics" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-slate-100 data-[state=active]:text-primary data-[state=active]:shadow-none">Fabrics</TabsTrigger>
            <TabsTrigger value="products" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-slate-100 data-[state=active]:text-primary data-[state=active]:shadow-none">Products</TabsTrigger>
            <TabsTrigger value="teams" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-slate-100 data-[state=active]:text-primary data-[state=active]:shadow-none">Teams</TabsTrigger>
            <TabsTrigger value="stitchers" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-slate-100 data-[state=active]:text-primary data-[state=active]:shadow-none">Stitchers</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="categories" className="mt-0 outline-none"><CategoriesTab isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="colors" className="mt-0 outline-none"><ColorsTab isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="sizes" className="mt-0 outline-none"><SizesTab isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="fabrics" className="mt-0 outline-none"><FabricsTab isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="products" className="mt-0 outline-none"><ProductsTab isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="teams" className="mt-0 outline-none"><TeamsTab isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="stitchers" className="mt-0 outline-none"><StitchersTab isAdmin={isAdmin} /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function AdminOnlyBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
      <Shield className="h-3 w-3" /> Admin only
    </span>
  );
}

function CategoriesTab({ isAdmin }: { isAdmin: boolean }) {
  const { data, isLoading } = useListCategories();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { mutate, isPending } = useCreateCategory({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
        setOpen(false);
        toast({ title: "Category created" });
      }
    }
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    mutate({ data: { name: fd.get("name") as string, description: fd.get("description") as string } });
  };

  return (
    <MasterCard title="Product Categories" onAdd={() => setOpen(true)} addLabel="Add Category" open={open} onOpenChange={setOpen}>
      <form onSubmit={onSubmit} className="space-y-4 pt-4">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Name</label>
          <input name="name" className="form-input-styled" required placeholder="e.g. Daily Wear" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Description</label>
          <input name="description" className="form-input-styled" placeholder="Optional details..." />
        </div>
        <Button type="submit" disabled={isPending} className="w-full h-11 rounded-xl">
          {isPending ? "Saving..." : "Save Category"}
        </Button>
      </form>

      <div className="mt-6 border rounded-xl overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={3} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" /></TableCell></TableRow> :
              data?.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-slate-500">#{c.id}</TableCell>
                  <TableCell className="font-semibold">{c.name}</TableCell>
                  <TableCell className="text-slate-600">{c.description || "-"}</TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </div>
    </MasterCard>
  );
}

function ColorCodeInput({
  value,
  onChange,
  existingCodes,
  excludeId,
}: {
  value: string;
  onChange: (v: string) => void;
  existingCodes: Array<{ id: number; code: string | null }>;
  excludeId?: number;
}) {
  const upper = value.trim().toUpperCase();
  const isDup =
    upper.length > 0 &&
    existingCodes.some(
      (c) => c.id !== excludeId && c.code?.trim().toUpperCase() === upper
    );
  return (
    <div>
      <label className="text-sm font-medium block mb-1.5">
        Color Code <span className="text-red-500">*</span>
        <span className="text-xs font-normal text-slate-400 ml-1">(e.g. BLK, NVY, BRN)</span>
      </label>
      <input
        name="code"
        className={`form-input-styled font-mono uppercase ${isDup ? "border-red-400 bg-red-50" : ""}`}
        placeholder="BLK"
        required
        maxLength={10}
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        autoComplete="off"
      />
      {isDup && (
        <div className="flex items-center gap-2 mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Code <strong>"{upper}"</strong> is already in use.
        </div>
      )}
    </div>
  );
}

function ColorsTab({ isAdmin }: { isAdmin: boolean }) {
  const { data, isLoading } = useListColors();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");

  const [editColor, setEditColor] = useState<{ id: number; name: string; code: string } | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");

  const existingCodes = (data ?? []).map((c) => ({ id: c.id, code: c.code ?? null }));

  const createCodeDup =
    newCode.trim().length > 0 &&
    existingCodes.some((c) => c.code?.trim().toUpperCase() === newCode.trim().toUpperCase());

  const editCodeDup =
    editColor !== null &&
    editCode.trim().length > 0 &&
    existingCodes.some(
      (c) => c.id !== editColor.id && c.code?.trim().toUpperCase() === editCode.trim().toUpperCase()
    );

  const onInvalidate = () => queryClient.invalidateQueries({ queryKey: getListColorsQueryKey() });

  const { mutate: createColor, isPending: creating } = useCreateColor({
    mutation: {
      onSuccess: () => {
        onInvalidate();
        setCreateOpen(false);
        setNewCode("");
        setNewName("");
        toast({ title: "Color created" });
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err?.response?.data?.error ?? "Failed to create color.", variant: "destructive" });
      },
    },
  });

  const { mutate: updateColor, isPending: updating } = useUpdateColor({
    mutation: {
      onSuccess: () => {
        onInvalidate();
        setEditColor(null);
        toast({ title: "Color updated" });
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err?.response?.data?.error ?? "Failed to update color.", variant: "destructive" });
      },
    },
  });

  const onCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (createCodeDup) return;
    createColor({ data: { name: newName.trim(), code: newCode.trim().toUpperCase() } });
  };

  const onEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editColor || editCodeDup) return;
    updateColor({ id: editColor.id, data: { name: editName.trim(), code: editCode.trim().toUpperCase() } });
  };

  const openEdit = (c: { id: number; name: string; code: string | null }) => {
    setEditColor({ id: c.id, name: c.name, code: c.code ?? "" });
    setEditCode(c.code ?? "");
    setEditName(c.name);
  };

  return (
    <>
      <MasterCard
        title="Colors"
        onAdd={() => setCreateOpen(true)}
        addLabel="Add Color"
        open={createOpen}
        onOpenChange={(v: boolean) => { setCreateOpen(v); if (!v) { setNewCode(""); setNewName(""); } }}
      >
        <form onSubmit={onCreateSubmit} className="space-y-4 pt-4">
          <ColorCodeInput value={newCode} onChange={setNewCode} existingCodes={existingCodes} />
          <div>
            <label className="text-sm font-medium block mb-1.5">Color Name <span className="text-red-500">*</span></label>
            <input
              name="name" className="form-input-styled" required
              value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Black"
            />
          </div>
          <Button
            type="submit"
            disabled={creating || createCodeDup}
            className="w-full h-11 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? "Saving..." : "Save Color"}
          </Button>
        </form>

        <div className="mt-6 border rounded-xl overflow-hidden bg-white">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-24">Code</TableHead>
                <TableHead>Name</TableHead>
                {isAdmin && <TableHead className="w-16 text-right">Edit</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={isAdmin ? 3 : 2} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : (
                data?.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-mono font-bold border ${c.code ? "bg-primary/10 text-primary border-primary/20" : "bg-amber-50 text-amber-600 border-amber-200"}`}>
                        {c.code || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="font-semibold text-slate-800">{c.name}</TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-primary"
                          onClick={() => openEdit(c)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
              {!isLoading && data?.length === 0 && (
                <TableRow><TableCell colSpan={isAdmin ? 3 : 2} className="text-center py-8 text-slate-500">No colors yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </MasterCard>

      {isAdmin && (
        <Dialog open={!!editColor} onOpenChange={(v) => { if (!v) setEditColor(null); }}>
          <DialogContent className="sm:max-w-[380px] rounded-2xl p-6 border-0 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-display">Edit Color</DialogTitle>
            </DialogHeader>
            <form onSubmit={onEditSubmit} className="space-y-4 pt-2">
              <ColorCodeInput
                value={editCode}
                onChange={setEditCode}
                existingCodes={existingCodes}
                excludeId={editColor?.id}
              />
              <div>
                <label className="text-sm font-medium block mb-1.5">Color Name <span className="text-red-500">*</span></label>
                <input
                  name="name" className="form-input-styled" required
                  value={editName} onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                disabled={updating || editCodeDup}
                className="w-full h-11 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updating ? "Saving..." : "Update Color"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function SizesTab({ isAdmin }: { isAdmin: boolean }) {
  const { data, isLoading } = useListSizes();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { mutate, isPending } = useCreateSize({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListSizesQueryKey() }); setOpen(false); } }
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    mutate({ data: { name: fd.get("name") as string, sortOrder: Number(fd.get("sortOrder")) } });
  };

  return (
    <MasterCard title="Sizes" onAdd={() => setOpen(true)} addLabel="Add Size" open={open} onOpenChange={setOpen}>
      <form onSubmit={onSubmit} className="space-y-4 pt-4">
        <div><label className="text-sm font-medium block mb-1.5">Size Name</label><input name="name" className="form-input-styled" required /></div>
        <div><label className="text-sm font-medium block mb-1.5">Sort Order</label><input type="number" name="sortOrder" className="form-input-styled" defaultValue="0" /></div>
        <Button type="submit" disabled={isPending} className="w-full h-11 rounded-xl">Save</Button>
      </form>
      <div className="mt-6 border rounded-xl overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-slate-50"><TableRow><TableHead>ID</TableHead><TableHead>Size</TableHead><TableHead>Sort Order</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={3} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow> :
              data?.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(s => (
                <TableRow key={s.id}><TableCell>#{s.id}</TableCell><TableCell className="font-semibold">{s.name}</TableCell><TableCell>{s.sortOrder}</TableCell></TableRow>
              ))
            }
          </TableBody>
        </Table>
      </div>
    </MasterCard>
  );
}

function FabricsTab({ isAdmin }: { isAdmin: boolean }) {
  const { data, isLoading } = useListFabrics();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { mutate, isPending } = useCreateFabric({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListFabricsQueryKey() }); setOpen(false); } }
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    mutate({ data: { name: fd.get("name") as string, description: fd.get("description") as string, unit: fd.get("unit") as string } });
  };

  return (
    <MasterCard title="Fabrics" onAdd={() => setOpen(true)} addLabel="Add Fabric" open={open} onOpenChange={setOpen}>
      <form onSubmit={onSubmit} className="space-y-4 pt-4">
        <div><label className="text-sm font-medium block mb-1.5">Fabric Name</label><input name="name" className="form-input-styled" required /></div>
        <div><label className="text-sm font-medium block mb-1.5">Unit (e.g. Meters, Yards)</label><input name="unit" className="form-input-styled" defaultValue="Meters" /></div>
        <div><label className="text-sm font-medium block mb-1.5">Description</label><input name="description" className="form-input-styled" /></div>
        <Button type="submit" disabled={isPending} className="w-full h-11 rounded-xl">Save</Button>
      </form>
      <div className="mt-6 border rounded-xl overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-slate-50"><TableRow><TableHead>ID</TableHead><TableHead>Fabric</TableHead><TableHead>Unit</TableHead><TableHead>Description</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow> :
              data?.map(f => (
                <TableRow key={f.id}><TableCell>#{f.id}</TableCell><TableCell className="font-semibold">{f.name}</TableCell><TableCell>{f.unit}</TableCell><TableCell>{f.description}</TableCell></TableRow>
              ))
            }
          </TableBody>
        </Table>
      </div>
    </MasterCard>
  );
}

function ProductsTab({ isAdmin }: { isAdmin: boolean }) {
  const { data, isLoading } = useListProducts();
  const { data: categories } = useListCategories();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { mutate, isPending } = useCreateProduct({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }); setOpen(false); } }
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    mutate({ data: {
      name: fd.get("name") as string,
      code: fd.get("code") as string,
      categoryId: Number(fd.get("categoryId")),
      description: fd.get("description") as string
    } });
  };

  return (
    <MasterCard title="Products / Designs" onAdd={() => setOpen(true)} addLabel="Add Product" open={open} onOpenChange={setOpen}>
      <form onSubmit={onSubmit} className="space-y-4 pt-4">
        <div><label className="text-sm font-medium block mb-1.5">Product Name/Design</label><input name="name" className="form-input-styled" required /></div>
        <div><label className="text-sm font-medium block mb-1.5">Design Code</label><input name="code" className="form-input-styled" required /></div>
        <div>
          <label className="text-sm font-medium block mb-1.5">Category</label>
          <select name="categoryId" className="form-input-styled bg-white" required>
            <option value="">Select Category...</option>
            {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div><label className="text-sm font-medium block mb-1.5">Description</label><input name="description" className="form-input-styled" /></div>
        <Button type="submit" disabled={isPending} className="w-full h-11 rounded-xl">Save</Button>
      </form>
      <div className="mt-6 border rounded-xl overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-slate-50"><TableRow><TableHead>Code</TableHead><TableHead>Design Name</TableHead><TableHead>Category</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow> :
              data?.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-slate-500 text-xs">{p.code}</TableCell>
                  <TableCell className="font-semibold">{p.name}</TableCell>
                  <TableCell>{p.categoryName}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${p.isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${p.isActive ? "bg-emerald-500" : "bg-red-500"}`} />
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </div>
    </MasterCard>
  );
}

function TeamsTab({ isAdmin }: { isAdmin: boolean }) {
  const { data, isLoading } = useListTeams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<any | null>(null);

  const onInvalidate = () => queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });

  const { mutate: createTeam, isPending: creating } = useCreateTeam({
    mutation: {
      onSuccess: () => { onInvalidate(); setCreateOpen(false); toast({ title: "Team created" }); },
      onError: (e: any) => toast({ title: "Error", description: e?.response?.data?.error ?? "Failed", variant: "destructive" }),
    },
  });

  const { mutate: updateTeam, isPending: updating } = useUpdateTeam({
    mutation: {
      onSuccess: () => { onInvalidate(); setEditTeam(null); toast({ title: "Team updated" }); },
      onError: (e: any) => toast({ title: "Error", description: e?.response?.data?.error ?? "Failed", variant: "destructive" }),
    },
  });

  const onCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createTeam({ data: {
      name: fd.get("name") as string,
      code: (fd.get("code") as string) || undefined,
      supervisorName: (fd.get("supervisorName") as string) || undefined,
    }});
  };

  const onEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editTeam) return;
    const fd = new FormData(e.currentTarget);
    updateTeam({ id: editTeam.id, data: {
      name: fd.get("name") as string,
      code: (fd.get("code") as string) || undefined,
      supervisorName: (fd.get("supervisorName") as string) || undefined,
      isActive: fd.get("isActive") === "true",
    }});
  };

  return (
    <>
      <MasterCard title="Teams" onAdd={() => setCreateOpen(true)} addLabel="Add Team" open={createOpen} onOpenChange={setCreateOpen}>
        <form onSubmit={onCreateSubmit} className="space-y-4 pt-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Team Name <span className="text-red-500">*</span></label>
            <input name="name" className="form-input-styled" required placeholder="e.g. Team Alpha" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Team Code <span className="text-slate-400 font-normal text-xs ml-1">(optional)</span></label>
            <input name="code" className="form-input-styled font-mono uppercase" placeholder="e.g. TMA" maxLength={10} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Supervisor Name <span className="text-slate-400 font-normal text-xs ml-1">(optional)</span></label>
            <input name="supervisorName" className="form-input-styled" placeholder="Supervisor name..." />
          </div>
          <Button type="submit" disabled={creating} className="w-full h-11 rounded-xl">
            {creating ? "Saving..." : "Save Team"}
          </Button>
        </form>

        <div className="mt-6 border rounded-xl overflow-hidden bg-white">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-24">Code</TableHead>
                <TableHead>Team Name</TableHead>
                <TableHead>Supervisor</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="w-16 text-right">Edit</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : data?.map(t => (
                <TableRow key={t.id}>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs font-mono font-bold border ${t.code ? "bg-primary/10 text-primary border-primary/20" : "bg-slate-50 text-slate-400 border-slate-200"}`}>
                      {t.code || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="font-semibold text-slate-800">{t.name}</TableCell>
                  <TableCell className="text-slate-600">{t.supervisorName || "—"}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${t.isActive !== false ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${t.isActive !== false ? "bg-emerald-500" : "bg-red-500"}`} />
                      {t.isActive !== false ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-primary" onClick={() => setEditTeam(t)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {!isLoading && data?.length === 0 && (
                <TableRow><TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-8 text-slate-500">No teams yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          {!isAdmin && <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 flex items-center gap-2"><AdminOnlyBadge /><span className="text-xs text-amber-700">Editing requires admin access.</span></div>}
        </div>
      </MasterCard>

      {isAdmin && editTeam && (
        <Dialog open={!!editTeam} onOpenChange={(v) => { if (!v) setEditTeam(null); }}>
          <DialogContent className="sm:max-w-[420px] rounded-2xl p-6 border-0 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-display">Edit Team</DialogTitle>
            </DialogHeader>
            <form onSubmit={onEditSubmit} className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium block mb-1.5">Team Name <span className="text-red-500">*</span></label>
                <input name="name" className="form-input-styled" required defaultValue={editTeam.name} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Team Code</label>
                <input name="code" className="form-input-styled font-mono uppercase" defaultValue={editTeam.code || ""} maxLength={10} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Supervisor Name</label>
                <input name="supervisorName" className="form-input-styled" defaultValue={editTeam.supervisorName || ""} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Status</label>
                <select name="isActive" className="form-input-styled bg-white" defaultValue={editTeam.isActive !== false ? "true" : "false"}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
              <Button type="submit" disabled={updating} className="w-full h-11 rounded-xl">
                {updating ? "Saving..." : "Update Team"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function StitchersTab({ isAdmin }: { isAdmin: boolean }) {
  const { data, isLoading } = useListStitchers();
  const { data: teams } = useListTeams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [editStitcher, setEditStitcher] = useState<any | null>(null);

  const onInvalidate = () => queryClient.invalidateQueries({ queryKey: getListStitchersQueryKey() });

  const { mutate: createStitcher, isPending: creating } = useCreateStitcher({
    mutation: {
      onSuccess: () => { onInvalidate(); setCreateOpen(false); toast({ title: "Stitcher added" }); },
      onError: (e: any) => toast({ title: "Error", description: e?.response?.data?.error ?? "Failed", variant: "destructive" }),
    },
  });

  const { mutate: updateStitcher, isPending: updating } = useUpdateStitcher({
    mutation: {
      onSuccess: () => { onInvalidate(); setEditStitcher(null); toast({ title: "Stitcher updated" }); },
      onError: (e: any) => toast({ title: "Error", description: e?.response?.data?.error ?? "Failed", variant: "destructive" }),
    },
  });

  const activeTeams = teams?.filter(t => t.isActive !== false) ?? [];

  const onCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const teamId = fd.get("teamId");
    createStitcher({ data: {
      name: fd.get("name") as string,
      code: (fd.get("code") as string) || undefined,
      phone: (fd.get("phone") as string) || undefined,
      teamId: teamId ? Number(teamId) : undefined,
    }});
  };

  const onEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editStitcher) return;
    const fd = new FormData(e.currentTarget);
    const teamId = fd.get("teamId");
    updateStitcher({ id: editStitcher.id, data: {
      name: fd.get("name") as string,
      code: (fd.get("code") as string) || undefined,
      phone: (fd.get("phone") as string) || undefined,
      teamId: teamId ? Number(teamId) : undefined,
      isActive: fd.get("isActive") === "true",
    }});
  };

  return (
    <>
      <MasterCard title="Stitchers" onAdd={() => setCreateOpen(true)} addLabel="Add Stitcher" open={createOpen} onOpenChange={setCreateOpen}>
        <form onSubmit={onCreateSubmit} className="space-y-4 pt-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Full Name <span className="text-red-500">*</span></label>
            <input name="name" className="form-input-styled" required placeholder="e.g. Fatima Hassan" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1.5">Code <span className="text-slate-400 font-normal text-xs">(optional)</span></label>
              <input name="code" className="form-input-styled font-mono uppercase" placeholder="e.g. STT01" maxLength={10} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Phone <span className="text-slate-400 font-normal text-xs">(optional)</span></label>
              <input name="phone" className="form-input-styled" placeholder="05xxxxxxxx" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Team <span className="text-slate-400 font-normal text-xs">(optional)</span></label>
            <select name="teamId" className="form-input-styled bg-white">
              <option value="">No Team</option>
              {activeTeams.map(t => (
                <option key={t.id} value={t.id}>{fmtCode(t.code, t.name)}</option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={creating} className="w-full h-11 rounded-xl">
            {creating ? "Saving..." : "Add Stitcher"}
          </Button>
        </form>

        <div className="mt-6 border rounded-xl overflow-hidden bg-white">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-24">Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="w-16 text-right">Edit</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : data?.map(s => (
                <TableRow key={s.id} className={s.isActive === false ? "opacity-60" : ""}>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs font-mono font-bold border ${s.code ? "bg-primary/10 text-primary border-primary/20" : "bg-slate-50 text-slate-400 border-slate-200"}`}>
                      {s.code || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="font-semibold text-slate-800">{s.name}</TableCell>
                  <TableCell className="text-slate-600">{s.teamName ? fmtCode((teams?.find(t => t.id === s.teamId)?.code ?? null), s.teamName) : "—"}</TableCell>
                  <TableCell className="text-slate-500 text-sm">{s.phone || "—"}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${s.isActive !== false ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.isActive !== false ? "bg-emerald-500" : "bg-red-500"}`} />
                      {s.isActive !== false ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-primary" onClick={() => setEditStitcher(s)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {!isLoading && data?.length === 0 && (
                <TableRow><TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-8 text-slate-500">No stitchers yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          {!isAdmin && <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 flex items-center gap-2"><AdminOnlyBadge /><span className="text-xs text-amber-700">Editing requires admin access.</span></div>}
        </div>
      </MasterCard>

      {isAdmin && editStitcher && (
        <Dialog open={!!editStitcher} onOpenChange={(v) => { if (!v) setEditStitcher(null); }}>
          <DialogContent className="sm:max-w-[420px] rounded-2xl p-6 border-0 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-display">Edit Stitcher</DialogTitle>
            </DialogHeader>
            <form onSubmit={onEditSubmit} className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium block mb-1.5">Full Name <span className="text-red-500">*</span></label>
                <input name="name" className="form-input-styled" required defaultValue={editStitcher.name} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-1.5">Code</label>
                  <input name="code" className="form-input-styled font-mono uppercase" defaultValue={editStitcher.code || ""} maxLength={10} />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Phone</label>
                  <input name="phone" className="form-input-styled" defaultValue={editStitcher.phone || ""} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Team</label>
                <select name="teamId" className="form-input-styled bg-white" defaultValue={editStitcher.teamId || ""}>
                  <option value="">No Team</option>
                  {teams?.map(t => (
                    <option key={t.id} value={t.id}>{fmtCode(t.code, t.name)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Status</label>
                <select name="isActive" className="form-input-styled bg-white" defaultValue={editStitcher.isActive !== false ? "true" : "false"}>
                  <option value="true">Active</option>
                  <option value="false">Inactive (Deactivated)</option>
                </select>
              </div>
              <Button type="submit" disabled={updating} className="w-full h-11 rounded-xl">
                {updating ? "Saving..." : "Update Stitcher"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function MasterCard({ title, children, onAdd, addLabel, open, onOpenChange }: any) {
  return (
    <Card className="shadow-lg border-slate-200 rounded-2xl overflow-hidden">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between py-5 px-6">
        <CardTitle className="text-xl font-display text-slate-800">{title}</CardTitle>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogTrigger asChild>
            <Button onClick={onAdd} className="rounded-xl shadow-md shadow-primary/20 bg-primary hover:bg-primary/90 transition-all hover:-translate-y-0.5">
              <Plus className="h-4 w-4 mr-2" /> {addLabel}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] rounded-2xl p-6 border-0 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-display">{addLabel}</DialogTitle>
            </DialogHeader>
            {children[0]}
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-6 bg-white">
        {children[1]}
      </CardContent>
    </Card>
  );
}
