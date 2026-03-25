import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertCircle, Pencil, Plus, Loader2, Users, Shield, Upload } from "lucide-react";
import { ImportDialog } from "@/components/import-dialog";
import { useState } from "react";
import {
  useListCategories, useCreateCategory, getListCategoriesQueryKey,
  useListColors, useCreateColor, useUpdateColor, getListColorsQueryKey,
  useListSizes, useCreateSize, getListSizesQueryKey,
  useListFabrics, useCreateFabric, useUpdateFabric, getListFabricsQueryKey,
  useListProducts, useCreateProduct, useUpdateProduct, getListProductsQueryKey,
  useListTeams, useCreateTeam, useUpdateTeam, getListTeamsQueryKey,
  useListStitchers, useCreateStitcher, useUpdateStitcher, getListStitchersQueryKey,
  useListMaterials, useCreateMaterial, useUpdateMaterial, getListMaterialsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAppAuth } from "@/lib/auth-context";
import { fmtCode } from "@/lib/utils";

export default function MasterDataPage() {
  const { user, can } = useAppAuth();
  const isAdmin = user?.role === "admin";
  const canCreate = isAdmin || can("master-data", "create");
  const canEdit = isAdmin || can("master-data", "edit");
  const canImport = isAdmin || can("master-data", "import");

  return (
    <AppLayout title="Master Data">
      <Tabs defaultValue="categories" className="w-full">
        <div className="bg-card p-1 rounded-xl shadow-sm border border-border mb-6 inline-block overflow-x-auto max-w-full">
          <TabsList className="bg-transparent h-auto p-0 flex space-x-1 flex-wrap gap-y-1">
            <TabsTrigger value="categories" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-muted data-[state=active]:text-primary data-[state=active]:shadow-none">Categories</TabsTrigger>
            <TabsTrigger value="colors" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-muted data-[state=active]:text-primary data-[state=active]:shadow-none">Colors</TabsTrigger>
            <TabsTrigger value="sizes" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-muted data-[state=active]:text-primary data-[state=active]:shadow-none">Sizes</TabsTrigger>
            <TabsTrigger value="fabrics" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-muted data-[state=active]:text-primary data-[state=active]:shadow-none">Fabrics</TabsTrigger>
            <TabsTrigger value="products" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-muted data-[state=active]:text-primary data-[state=active]:shadow-none">Products</TabsTrigger>
            <TabsTrigger value="teams" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-muted data-[state=active]:text-primary data-[state=active]:shadow-none">Teams</TabsTrigger>
            <TabsTrigger value="stitchers" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-muted data-[state=active]:text-primary data-[state=active]:shadow-none">Stitchers</TabsTrigger>
            <TabsTrigger value="materials" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-muted data-[state=active]:text-primary data-[state=active]:shadow-none">Materials</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="categories" className="mt-0 outline-none"><CategoriesTab canCreate={canCreate} canEdit={canEdit} canImport={canImport} /></TabsContent>
        <TabsContent value="colors" className="mt-0 outline-none"><ColorsTab canCreate={canCreate} canEdit={canEdit} canImport={canImport} /></TabsContent>
        <TabsContent value="sizes" className="mt-0 outline-none"><SizesTab canCreate={canCreate} canEdit={canEdit} canImport={canImport} /></TabsContent>
        <TabsContent value="fabrics" className="mt-0 outline-none"><FabricsTab canCreate={canCreate} canEdit={canEdit} canImport={canImport} /></TabsContent>
        <TabsContent value="products" className="mt-0 outline-none"><ProductsTab canCreate={canCreate} canEdit={canEdit} canImport={canImport} /></TabsContent>
        <TabsContent value="teams" className="mt-0 outline-none"><TeamsTab canCreate={canCreate} canEdit={canEdit} canImport={canImport} /></TabsContent>
        <TabsContent value="stitchers" className="mt-0 outline-none"><StitchersTab canCreate={canCreate} canEdit={canEdit} canImport={canImport} /></TabsContent>
        <TabsContent value="materials" className="mt-0 outline-none"><MaterialsTab canCreate={canCreate} canEdit={canEdit} canImport={canImport} /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function AdminOnlyBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-amber-500/10 text-amber-700 border border-amber-500/20 px-2 py-0.5 rounded-full">
      <Shield className="h-3 w-3" /> Admin only
    </span>
  );
}

type MasterTabProps = { canCreate: boolean; canEdit: boolean; canImport: boolean };

function CategoriesTab({ canCreate, canEdit }: MasterTabProps) {
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
    <MasterCard title="Product Categories" onAdd={() => setOpen(true)} addLabel="Add Category" open={open} onOpenChange={setOpen} hideAdd={!canCreate}>
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

      <div className="mt-6 border rounded-xl overflow-hidden bg-card">
        <Table>
          <TableHeader className="bg-background">
            <TableRow>
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={3} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow> :
              data?.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-muted-foreground">#{c.id}</TableCell>
                  <TableCell className="font-semibold">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.description || "-"}</TableCell>
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
        <span className="text-xs font-normal text-muted-foreground ml-1">(e.g. BLK, NVY, BRN)</span>
      </label>
      <input
        name="code"
        className={`form-input-styled font-mono uppercase ${isDup ? "border-red-500/40 bg-red-500/10" : ""}`}
        placeholder="BLK"
        required
        maxLength={10}
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        autoComplete="off"
      />
      {isDup && (
        <div className="flex items-center gap-2 mt-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Code <strong>"{upper}"</strong> is already in use.
        </div>
      )}
    </div>
  );
}

function ColorsTab({ canCreate, canEdit, canImport }: MasterTabProps) {
  const { data, isLoading } = useListColors();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
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
        importButton={canImport && <ImportBtn onClick={() => setImportOpen(true)} />}
        hideAdd={!canCreate}
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

        <div className="mt-6 border rounded-xl overflow-hidden bg-card">
          <Table>
            <TableHeader className="bg-background">
              <TableRow>
                <TableHead className="w-24">Code</TableHead>
                <TableHead>Name</TableHead>
                {canEdit && <TableHead className="w-16 text-right">Edit</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={canEdit ? 3 : 2} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : (
                data?.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-mono font-bold border ${c.code ? "bg-primary/10 text-primary border-primary/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"}`}>
                        {c.code || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">{c.name}</TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
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
                <TableRow><TableCell colSpan={canEdit ? 3 : 2} className="text-center py-8 text-muted-foreground">No colors yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </MasterCard>

      {canEdit && (
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
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} moduleName="Colors" moduleKey="colors" onSuccess={() => queryClient.invalidateQueries({ queryKey: getListColorsQueryKey() })} />
    </>
  );
}

function SizesTab({ canCreate, canImport }: MasterTabProps) {
  const { data, isLoading } = useListSizes();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const { mutate, isPending } = useCreateSize({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListSizesQueryKey() }); setOpen(false); } }
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    mutate({ data: { name: fd.get("name") as string, sortOrder: Number(fd.get("sortOrder")) } });
  };

  return (
    <>
    <MasterCard title="Sizes" onAdd={() => setOpen(true)} addLabel="Add Size" open={open} onOpenChange={setOpen} importButton={canImport && <ImportBtn onClick={() => setImportOpen(true)} />} hideAdd={!canCreate}>
      <form onSubmit={onSubmit} className="space-y-4 pt-4">
        <div><label className="text-sm font-medium block mb-1.5">Size Name</label><input name="name" className="form-input-styled" required /></div>
        <div><label className="text-sm font-medium block mb-1.5">Sort Order</label><input type="number" name="sortOrder" className="form-input-styled" defaultValue="0" /></div>
        <Button type="submit" disabled={isPending} className="w-full h-11 rounded-xl">Save</Button>
      </form>
      <div className="mt-6 border rounded-xl overflow-hidden bg-card">
        <Table>
          <TableHeader className="bg-background"><TableRow><TableHead>ID</TableHead><TableHead>Size</TableHead><TableHead>Sort Order</TableHead></TableRow></TableHeader>
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
    <ImportDialog open={importOpen} onOpenChange={setImportOpen} moduleName="Sizes" moduleKey="sizes" onSuccess={() => queryClient.invalidateQueries({ queryKey: getListSizesQueryKey() })} />
    </>
  );
}

function FabricsTab({ canCreate, canEdit }: MasterTabProps) {
  const { data, isLoading } = useListFabrics();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");

  type EditFabric = { id: number; code?: string | null; name: string; description?: string | null; unit?: string | null; isActive?: boolean };
  const [editFabric, setEditFabric] = useState<EditFabric | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editActive, setEditActive] = useState(true);

  const existingCodes = (data ?? []).filter(f => f.code).map(f => ({ id: f.id, code: f.code! }));
  const createCodeDup = newCode.trim().length > 0 && existingCodes.some(f => f.code.toUpperCase() === newCode.trim().toUpperCase());
  const editCodeDup = editFabric !== null && editCode.trim().length > 0 &&
    existingCodes.some(f => f.id !== editFabric.id && f.code.toUpperCase() === editCode.trim().toUpperCase());

  const onInvalidate = () => queryClient.invalidateQueries({ queryKey: getListFabricsQueryKey() });

  const { mutate: createFabric, isPending: creating } = useCreateFabric({
    mutation: {
      onSuccess: () => { onInvalidate(); setCreateOpen(false); setNewCode(""); setNewName(""); toast({ title: "Fabric created" }); },
      onError: (err: any) => { toast({ title: "Error", description: err?.response?.data?.error ?? "Failed to create fabric.", variant: "destructive" }); },
    },
  });

  const { mutate: updateFabric, isPending: updating } = useUpdateFabric({
    mutation: {
      onSuccess: () => { onInvalidate(); setEditFabric(null); toast({ title: "Fabric updated" }); },
      onError: (err: any) => { toast({ title: "Error", description: err?.response?.data?.error ?? "Failed to update fabric.", variant: "destructive" }); },
    },
  });

  const onCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (createCodeDup) return;
    const fd = new FormData(e.currentTarget);
    createFabric({ data: { code: newCode.trim().toUpperCase() || undefined, name: newName.trim(), description: fd.get("description") as string, unit: fd.get("unit") as string } });
  };

  const onEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editFabric || editCodeDup) return;
    updateFabric({ id: editFabric.id, data: { code: editCode.trim().toUpperCase() || undefined, name: editName.trim(), description: editDesc.trim() || undefined, unit: editUnit.trim() || undefined, isActive: editActive } });
  };

  const openEdit = (f: EditFabric) => {
    setEditFabric(f);
    setEditCode(f.code ?? "");
    setEditName(f.name);
    setEditDesc(f.description ?? "");
    setEditUnit(f.unit ?? "Meters");
    setEditActive(f.isActive !== false);
  };

  return (
    <MasterCard title="Fabrics" onAdd={() => setCreateOpen(true)} addLabel="Add Fabric" open={createOpen} onOpenChange={setCreateOpen} hideAdd={!canCreate}>
      <form onSubmit={onCreateSubmit} className="space-y-4 pt-4">
        <div>
          <label className="text-sm font-medium block mb-1.5">Fabric Code</label>
          <input name="code" className={`form-input-styled font-mono uppercase ${createCodeDup ? "border-red-500/40 bg-red-500/10" : ""}`} placeholder="e.g. CTN, SILK" value={newCode} onChange={e => setNewCode(e.target.value)} />
          {createCodeDup && <p className="text-xs text-red-500 mt-1">This code already exists.</p>}
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">Fabric Name</label>
          <input name="name" className="form-input-styled" required value={newName} onChange={e => setNewName(e.target.value)} />
        </div>
        <div><label className="text-sm font-medium block mb-1.5">Unit (e.g. Meters, Yards)</label><input name="unit" className="form-input-styled" defaultValue="Meters" /></div>
        <div><label className="text-sm font-medium block mb-1.5">Description</label><input name="description" className="form-input-styled" /></div>
        <Button type="submit" disabled={creating || createCodeDup} className="w-full h-11 rounded-xl">Save</Button>
      </form>
      <div className="mt-6 border rounded-xl overflow-hidden bg-card">
        <Table>
          <TableHeader className="bg-background">
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Fabric Name</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              {canEdit && <TableHead className="w-12"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={canEdit ? 6 : 5} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow> :
              data?.map(f => (
                <TableRow key={f.id} className="group">
                  <TableCell className="font-mono text-muted-foreground text-xs">{f.code ?? "—"}</TableCell>
                  <TableCell className="font-semibold">{f.name}</TableCell>
                  <TableCell>{f.unit}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{f.description}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${f.isActive !== false ? "bg-emerald-500/10 text-emerald-700" : "bg-red-500/10 text-red-600"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${f.isActive !== false ? "bg-emerald-500/100" : "bg-red-500/100"}`} />
                      {f.isActive !== false ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEdit(f)}>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editFabric} onOpenChange={(v) => { if (!v) setEditFabric(null); }}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl p-6 border-0 shadow-2xl">
          <DialogHeader><DialogTitle className="text-xl font-display">Edit Fabric</DialogTitle></DialogHeader>
          {editFabric && (
            <form onSubmit={onEditSubmit} className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">Fabric Code</label>
                <input className={`form-input-styled font-mono uppercase ${editCodeDup ? "border-red-500/40 bg-red-500/10" : ""}`} value={editCode} onChange={e => setEditCode(e.target.value)} placeholder="e.g. CTN" />
                {editCodeDup && <p className="text-xs text-red-500 mt-1">This code already exists.</p>}
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Fabric Name</label>
                <input className="form-input-styled" required value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Unit</label>
                <input className="form-input-styled" value={editUnit} onChange={e => setEditUnit(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Description</label>
                <input className="form-input-styled" value={editDesc} onChange={e => setEditDesc(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="fabric-active" checked={editActive} onChange={e => setEditActive(e.target.checked)} className="h-4 w-4 rounded" />
                <label htmlFor="fabric-active" className="text-sm font-medium">Active</label>
              </div>
              <Button type="submit" disabled={updating || editCodeDup} className="w-full h-11 rounded-xl">
                {updating ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </MasterCard>
  );
}

function ImportBtn({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" className="rounded-xl gap-1.5" onClick={onClick}>
      <Upload className="h-4 w-4" /> Import
    </Button>
  );
}

function ProductsTab({ canCreate, canEdit, canImport }: MasterTabProps) {
  const { data, isLoading } = useListProducts();
  const { data: categories } = useListCategories();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);

  const existingCodes = (data ?? []).map((p) => ({ id: p.id, code: p.code ?? null }));
  const createCodeDup =
    newCode.trim().length > 0 &&
    existingCodes.some((p) => p.code?.trim().toUpperCase() === newCode.trim().toUpperCase());

  const { mutate, isPending } = useCreateProduct({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }); setOpen(false); setNewCode(""); toast({ title: "Product created" }); },
      onError: (err: any) => { toast({ title: "Error", description: err?.response?.data?.error ?? "Failed to create product.", variant: "destructive" }); },
    }
  });

  const { mutate: updateMutate, isPending: isUpdating } = useUpdateProduct({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }); setEditProduct(null); toast({ title: "Product updated" }); },
      onError: (err: any) => { toast({ title: "Error", description: err?.response?.data?.error ?? "Failed to update product.", variant: "destructive" }); },
    }
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (createCodeDup) return;
    const fd = new FormData(e.currentTarget);
    const ppp = fd.get("pointsPerPiece") as string;
    mutate({ data: {
      name: fd.get("name") as string,
      code: newCode.trim().toUpperCase(),
      categoryId: Number(fd.get("categoryId")),
      description: fd.get("description") as string,
      pointsPerPiece: ppp ? Number(ppp) : null,
    } });
  };

  const onEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editProduct) return;
    const fd = new FormData(e.currentTarget);
    const ppp = fd.get("pointsPerPiece") as string;
    updateMutate({ id: editProduct.id, data: {
      name: fd.get("name") as string,
      code: (fd.get("code") as string || "").trim().toUpperCase(),
      categoryId: Number(fd.get("categoryId")),
      description: fd.get("description") as string,
      pointsPerPiece: ppp ? Number(ppp) : null,
      isActive: editProduct.isActive,
    } });
  };

  return (
    <>
    <MasterCard
      title="Products / Designs"
      onAdd={() => setOpen(true)}
      addLabel="Add Product"
      open={open}
      onOpenChange={(v: boolean) => { setOpen(v); if (!v) setNewCode(""); }}
      importButton={canImport && <ImportBtn onClick={() => setImportOpen(true)} />}
      hideAdd={!canCreate}
    >
      <form onSubmit={onSubmit} className="space-y-4 pt-4">
        <div><label className="text-sm font-medium block mb-1.5">Product Name/Design</label><input name="name" className="form-input-styled" required /></div>
        <div>
          <label className="text-sm font-medium block mb-1.5">Design Code <span className="text-red-500">*</span></label>
          <input
            name="code"
            className={`form-input-styled font-mono uppercase ${createCodeDup ? "border-red-500/40 bg-red-500/10" : ""}`}
            required
            value={newCode}
            onChange={(e) => setNewCode(e.target.value.toUpperCase())}
            placeholder="e.g. 101, 262, 501"
            autoComplete="off"
          />
          {createCodeDup && (
            <div className="flex items-center gap-2 mt-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Code <strong>"{newCode.trim().toUpperCase()}"</strong> is already in use.
            </div>
          )}
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">Category</label>
          <select name="categoryId" className="form-input-styled bg-card" required>
            <option value="">Select Category...</option>
            {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div><label className="text-sm font-medium block mb-1.5">Points Per Piece</label><input name="pointsPerPiece" type="number" step="0.01" min="0" className="form-input-styled" placeholder="e.g. 7" /></div>
        <div><label className="text-sm font-medium block mb-1.5">Description</label><input name="description" className="form-input-styled" /></div>
        <Button type="submit" disabled={isPending || createCodeDup} className="w-full h-11 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed">Save</Button>
      </form>
      <div className="mt-6 border rounded-xl overflow-hidden bg-card">
        <Table>
          <TableHeader className="bg-background"><TableRow><TableHead>Code</TableHead><TableHead>Design Name</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Points/Pc</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow> :
              data?.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-muted-foreground text-xs">{p.code}</TableCell>
                  <TableCell className="font-semibold">{p.name}</TableCell>
                  <TableCell>{p.categoryName}</TableCell>
                  <TableCell className="text-right font-mono">{(p as any).pointsPerPiece ?? "—"}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${p.isActive ? "bg-emerald-500/10 text-emerald-700" : "bg-red-500/10 text-red-600"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${p.isActive ? "bg-emerald-500/100" : "bg-red-500/100"}`} />
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {canEdit && <Button variant="ghost" size="sm" onClick={() => setEditProduct(p)}><Pencil className="h-3.5 w-3.5" /></Button>}
                  </TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </div>
    </MasterCard>
    <ImportDialog open={importOpen} onOpenChange={setImportOpen} moduleName="Products" moduleKey="products" onSuccess={() => queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() })} />

    <Dialog open={!!editProduct} onOpenChange={(v) => { if (!v) setEditProduct(null); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit Product</DialogTitle></DialogHeader>
        {editProduct && (
          <form onSubmit={onEditSubmit} className="space-y-4">
            <div><label className="text-sm font-medium block mb-1.5">Product Name</label><input name="name" className="form-input-styled" required defaultValue={editProduct.name} /></div>
            <div><label className="text-sm font-medium block mb-1.5">Design Code</label><input name="code" className="form-input-styled font-mono uppercase" defaultValue={editProduct.code || ""} /></div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Category</label>
              <select name="categoryId" className="form-input-styled bg-card" required defaultValue={editProduct.categoryId || ""}>
                <option value="">Select Category...</option>
                {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="text-sm font-medium block mb-1.5">Points Per Piece</label><input name="pointsPerPiece" type="number" step="0.01" min="0" className="form-input-styled" defaultValue={(editProduct as any).pointsPerPiece ?? ""} placeholder="e.g. 7" /></div>
            <div><label className="text-sm font-medium block mb-1.5">Description</label><input name="description" className="form-input-styled" defaultValue={editProduct.description || ""} /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="editProductActive" checked={editProduct.isActive} onChange={(e) => setEditProduct({ ...editProduct, isActive: e.target.checked })} />
              <label htmlFor="editProductActive" className="text-sm">Active</label>
            </div>
            <Button type="submit" disabled={isUpdating} className="w-full h-11 rounded-xl">Update</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}

function TeamsTab({ canCreate, canEdit, canImport }: MasterTabProps) {
  const { data, isLoading } = useListTeams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<any | null>(null);
  const [importOpen, setImportOpen] = useState(false);

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
      <MasterCard title="Teams" onAdd={() => setCreateOpen(true)} addLabel="Add Team" open={createOpen} onOpenChange={setCreateOpen} importButton={canImport && <ImportBtn onClick={() => setImportOpen(true)} />} hideAdd={!canCreate}>
        <form onSubmit={onCreateSubmit} className="space-y-4 pt-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Team Name <span className="text-red-500">*</span></label>
            <input name="name" className="form-input-styled" required placeholder="e.g. Team Alpha" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Team Code <span className="text-muted-foreground font-normal text-xs ml-1">(optional)</span></label>
            <input name="code" className="form-input-styled font-mono uppercase" placeholder="e.g. TMA" maxLength={10} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Supervisor Name <span className="text-muted-foreground font-normal text-xs ml-1">(optional)</span></label>
            <input name="supervisorName" className="form-input-styled" placeholder="Supervisor name..." />
          </div>
          <Button type="submit" disabled={creating} className="w-full h-11 rounded-xl">
            {creating ? "Saving..." : "Save Team"}
          </Button>
        </form>

        <div className="mt-6 border rounded-xl overflow-hidden bg-card">
          <Table>
            <TableHeader className="bg-background">
              <TableRow>
                <TableHead className="w-24">Code</TableHead>
                <TableHead>Team Name</TableHead>
                <TableHead>Supervisor</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead className="w-16 text-right">Edit</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={canEdit ? 5 : 4} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : data?.map(t => (
                <TableRow key={t.id}>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs font-mono font-bold border ${t.code ? "bg-primary/10 text-primary border-primary/20" : "bg-background text-muted-foreground border-border"}`}>
                      {t.code || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="font-semibold text-foreground">{t.name}</TableCell>
                  <TableCell className="text-muted-foreground">{t.supervisorName || "—"}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${t.isActive !== false ? "bg-emerald-500/10 text-emerald-700" : "bg-red-500/10 text-red-600"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${t.isActive !== false ? "bg-emerald-500/100" : "bg-red-500/100"}`} />
                      {t.isActive !== false ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary" onClick={() => setEditTeam(t)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {!isLoading && data?.length === 0 && (
                <TableRow><TableCell colSpan={canEdit ? 5 : 4} className="text-center py-8 text-muted-foreground">No teams yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          {!canEdit && <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/20 flex items-center gap-2"><AdminOnlyBadge /><span className="text-xs text-amber-700">Editing requires permission.</span></div>}
        </div>
      </MasterCard>

      {canEdit && editTeam && (
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
                <select name="isActive" className="form-input-styled bg-card" defaultValue={editTeam.isActive !== false ? "true" : "false"}>
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
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} moduleName="Teams" moduleKey="teams" onSuccess={onInvalidate} />
    </>
  );
}

function StitchersTab({ canCreate, canEdit, canImport }: MasterTabProps) {
  const { data, isLoading } = useListStitchers();
  const { data: teams } = useListTeams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
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
      <MasterCard title="Stitchers" onAdd={() => setCreateOpen(true)} addLabel="Add Stitcher" open={createOpen} onOpenChange={setCreateOpen} importButton={canImport && <ImportBtn onClick={() => setImportOpen(true)} />} hideAdd={!canCreate}>
        <form onSubmit={onCreateSubmit} className="space-y-4 pt-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Full Name <span className="text-red-500">*</span></label>
            <input name="name" className="form-input-styled" required placeholder="e.g. Fatima Hassan" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1.5">Code <span className="text-muted-foreground font-normal text-xs">(optional)</span></label>
              <input name="code" className="form-input-styled font-mono uppercase" placeholder="e.g. STT01" maxLength={10} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Phone <span className="text-muted-foreground font-normal text-xs">(optional)</span></label>
              <input name="phone" className="form-input-styled" placeholder="05xxxxxxxx" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Team <span className="text-muted-foreground font-normal text-xs">(optional)</span></label>
            <select name="teamId" className="form-input-styled bg-card">
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

        <div className="mt-6 border rounded-xl overflow-hidden bg-card">
          <Table>
            <TableHeader className="bg-background">
              <TableRow>
                <TableHead className="w-24">Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead className="w-16 text-right">Edit</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={canEdit ? 6 : 5} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : data?.map(s => (
                <TableRow key={s.id} className={s.isActive === false ? "opacity-60" : ""}>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs font-mono font-bold border ${s.code ? "bg-primary/10 text-primary border-primary/20" : "bg-background text-muted-foreground border-border"}`}>
                      {s.code || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="font-semibold text-foreground">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.teamName ? fmtCode((teams?.find(t => t.id === s.teamId)?.code ?? null), s.teamName) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{s.phone || "—"}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${s.isActive !== false ? "bg-emerald-500/10 text-emerald-700" : "bg-red-500/10 text-red-600"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.isActive !== false ? "bg-emerald-500/100" : "bg-red-500/100"}`} />
                      {s.isActive !== false ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary" onClick={() => setEditStitcher(s)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {!isLoading && data?.length === 0 && (
                <TableRow><TableCell colSpan={canEdit ? 6 : 5} className="text-center py-8 text-muted-foreground">No stitchers yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          {!canEdit && <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/20 flex items-center gap-2"><AdminOnlyBadge /><span className="text-xs text-amber-700">Editing requires permission.</span></div>}
        </div>
      </MasterCard>

      {canEdit && editStitcher && (
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
                <select name="teamId" className="form-input-styled bg-card" defaultValue={editStitcher.teamId || ""}>
                  <option value="">No Team</option>
                  {teams?.map(t => (
                    <option key={t.id} value={t.id}>{fmtCode(t.code, t.name)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Status</label>
                <select name="isActive" className="form-input-styled bg-card" defaultValue={editStitcher.isActive !== false ? "true" : "false"}>
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
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} moduleName="Stitchers" moduleKey="stitchers" onSuccess={onInvalidate} />
    </>
  );
}

function MaterialsTab({ canCreate, canEdit, canImport }: MasterTabProps) {
  const { data, isLoading } = useListMaterials();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  type EditMat = { id: number; code: string; name: string; description: string | null; isActive: boolean };
  const [editMat, setEditMat] = useState<EditMat | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editActive, setEditActive] = useState(true);

  const existingCodes = (data ?? []).map((m) => ({ id: m.id, code: m.code }));

  const createCodeDup =
    newCode.trim().length > 0 &&
    existingCodes.some((m) => m.code.trim().toUpperCase() === newCode.trim().toUpperCase());

  const editCodeDup =
    editMat !== null &&
    editCode.trim().length > 0 &&
    existingCodes.some(
      (m) => m.id !== editMat.id && m.code.trim().toUpperCase() === editCode.trim().toUpperCase()
    );

  const onInvalidate = () => queryClient.invalidateQueries({ queryKey: getListMaterialsQueryKey() });

  const { mutate: createMaterial, isPending: creating } = useCreateMaterial({
    mutation: {
      onSuccess: () => {
        onInvalidate();
        setCreateOpen(false);
        setNewCode(""); setNewName(""); setNewDesc("");
        toast({ title: "Material created" });
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err?.response?.data?.error ?? "Failed to create material.", variant: "destructive" });
      },
    },
  });

  const { mutate: updateMaterial, isPending: updating } = useUpdateMaterial({
    mutation: {
      onSuccess: () => {
        onInvalidate();
        setEditMat(null);
        toast({ title: "Material updated" });
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err?.response?.data?.error ?? "Failed to update material.", variant: "destructive" });
      },
    },
  });

  const onCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (createCodeDup) return;
    createMaterial({ data: { code: newCode.trim().toUpperCase(), name: newName.trim(), description: newDesc.trim() || undefined } });
  };

  const onEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editMat || editCodeDup) return;
    updateMaterial({ id: editMat.id, data: { code: editCode.trim().toUpperCase(), name: editName.trim(), description: editDesc.trim() || undefined, isActive: editActive } });
  };

  const openEdit = (m: EditMat) => {
    setEditMat(m);
    setEditCode(m.code);
    setEditName(m.name);
    setEditDesc(m.description ?? "");
    setEditActive(m.isActive);
  };

  return (
    <>
      <MasterCard
        title="Materials (Accessories)"
        onAdd={() => setCreateOpen(true)}
        addLabel="Add Material"
        open={createOpen}
        onOpenChange={(v: boolean) => { setCreateOpen(v); if (!v) { setNewCode(""); setNewName(""); setNewDesc(""); } }}
        importButton={canImport && <ImportBtn onClick={() => setImportOpen(true)} />}
        hideAdd={!canCreate}
      >
        <form onSubmit={onCreateSubmit} className="space-y-4 pt-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Material Code <span className="text-red-500">*</span></label>
            <input
              className={`form-input-styled font-mono uppercase ${createCodeDup ? "border-red-500/40 bg-red-500/10" : ""}`}
              required value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              placeholder="e.g. LC01, DR02, PP03"
              maxLength={12}
            />
            {createCodeDup && <p className="text-xs text-red-500 mt-1">This code already exists.</p>}
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Material Name <span className="text-red-500">*</span></label>
            <input
              className="form-input-styled" required
              value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Lace, Dori, Piping"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Description</label>
            <input
              className="form-input-styled"
              value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Optional description"
            />
          </div>
          <Button
            type="submit"
            disabled={creating || createCodeDup}
            className="w-full h-11 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? "Saving..." : "Save Material"}
          </Button>
        </form>

        <div className="mt-6 border rounded-xl overflow-hidden bg-card">
          <Table>
            <TableHeader className="bg-background">
              <TableRow>
                <TableHead className="w-28">Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Description</TableHead>
                <TableHead className="w-24">Status</TableHead>
                {canEdit && <TableHead className="w-16 text-right">Edit</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 5 : 4} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : (
                data?.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <span className="px-2 py-1 rounded text-xs font-mono font-bold border bg-primary/10 text-primary border-primary/20">
                        {m.code}
                      </span>
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">{m.name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">{m.description ?? "—"}</TableCell>
                    <TableCell>
                      {m.isActive
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Active</span>
                        : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">Inactive</span>
                      }
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                          onClick={() => openEdit(m as EditMat)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
              {!isLoading && data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canEdit ? 5 : 4} className="text-center py-8 text-muted-foreground">No materials yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </MasterCard>

      {canEdit && (
        <Dialog open={!!editMat} onOpenChange={(v) => { if (!v) setEditMat(null); }}>
          <DialogContent className="sm:max-w-[400px] rounded-2xl p-6 border-0 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-display">Edit Material</DialogTitle>
            </DialogHeader>
            <form onSubmit={onEditSubmit} className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium block mb-1.5">Material Code <span className="text-red-500">*</span></label>
                <input
                  className={`form-input-styled font-mono uppercase ${editCodeDup ? "border-red-500/40 bg-red-500/10" : ""}`}
                  required value={editCode} onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                  maxLength={12}
                />
                {editCodeDup && <p className="text-xs text-red-500 mt-1">This code already exists.</p>}
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Material Name <span className="text-red-500">*</span></label>
                <input
                  className="form-input-styled" required
                  value={editName} onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Description</label>
                <input
                  className="form-input-styled"
                  value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Status</label>
                <select
                  className="form-input-styled bg-card"
                  value={editActive ? "true" : "false"}
                  onChange={(e) => setEditActive(e.target.value === "true")}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive (Deactivated)</option>
                </select>
              </div>
              <Button
                type="submit"
                disabled={updating || editCodeDup}
                className="w-full h-11 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updating ? "Saving..." : "Update Material"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} moduleName="Materials" moduleKey="materials" onSuccess={onInvalidate} />
    </>
  );
}

function MasterCard({ title, children, onAdd, addLabel, open, onOpenChange, importButton, hideAdd }: any) {
  return (
    <Card className="shadow-lg border-border rounded-2xl overflow-hidden">
      <CardHeader className="bg-background/50 border-b border-border flex flex-row items-center justify-between py-5 px-6">
        <CardTitle className="text-xl font-display text-foreground">{title}</CardTitle>
        <div className="flex items-center gap-2">
          {importButton}
          {!hideAdd && (
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
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6 bg-card">
        {hideAdd ? (Array.isArray(children) ? children[1] : children) : children[1]}
      </CardContent>
    </Card>
  );
}
