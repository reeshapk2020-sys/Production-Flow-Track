import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, Send, Info, Pencil, AlertTriangle, Users, User } from "lucide-react";
import {
  useListAllocations, useCreateAllocation, getListAllocationsQueryKey,
  useListCuttingBatches, useListStitchers, useUpdateAllocation,
  useListProducts, useListMaterials, getListCuttingBatchesQueryKey,
  useListTeams, useListColors, useListSizes
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fmtCode } from "@/lib/utils";
import { useAppAuth } from "@/lib/auth-context";
import { FilterBar } from "@/components/filter-bar";

type BatchStatus = string;

function StatusBadge({ status }: { status: BatchStatus }) {
  const map: Record<string, { label: string; cls: string }> = {
    cutting:            { label: "Cutting",           cls: "bg-blue-50 text-blue-700 border-blue-200" },
    allocated:          { label: "Allocated",         cls: "bg-amber-50 text-amber-700 border-amber-200" },
    allocation:         { label: "Allocated",         cls: "bg-amber-50 text-amber-700 border-amber-200" },
    partially_received: { label: "Partial Recv",      cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    stitching:          { label: "Partial Recv",      cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    fully_received:     { label: "Fully Received",    cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    in_finishing:       { label: "In Finishing",      cls: "bg-purple-50 text-purple-700 border-purple-200" },
    finishing:          { label: "In Finishing",      cls: "bg-purple-50 text-purple-700 border-purple-200" },
    finished:           { label: "Finished",          cls: "bg-slate-100 text-slate-600 border-slate-200" },
    pending:            { label: "Pending",           cls: "bg-amber-50 text-amber-700 border-amber-200" },
    partial:            { label: "Partial Recv",      cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    completed:          { label: "Completed",         cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  };
  const { label, cls } = map[status] || { label: status, cls: "bg-slate-100 text-slate-500 border-slate-200" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{label}</span>;
}

export default function AllocationPage() {
  const [filters, setFilters] = useState<Record<string, string>>({
    startDate: "", endDate: "", productId: "", colorId: "", sizeId: "", stitcherId: "", teamId: ""
  });

  const filterParams: Record<string, any> = {};
  if (filters.startDate) filterParams.startDate = filters.startDate;
  if (filters.endDate) filterParams.endDate = filters.endDate;
  if (filters.productId) filterParams.productId = Number(filters.productId);
  if (filters.colorId) filterParams.colorId = Number(filters.colorId);
  if (filters.sizeId) filterParams.sizeId = Number(filters.sizeId);
  if (filters.stitcherId) filterParams.stitcherId = Number(filters.stitcherId);
  if (filters.teamId) filterParams.teamId = Number(filters.teamId);

  const { data, isLoading } = useListAllocations(filterParams);
  const { data: batches } = useListCuttingBatches();
  const { data: stitchers } = useListStitchers();
  const { data: teams } = useListTeams();
  const { data: products } = useListProducts();
  const { data: materials } = useListMaterials();
  const { data: colors } = useListColors();
  const { data: sizes } = useListSizes();

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, can } = useAppAuth();
  const canCreate = can("allocation", "create");
  const canEdit = can("allocation", "edit");

  const [open, setOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [allocType, setAllocType] = useState<"individual" | "team">("individual");
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);

  const { mutate, isPending } = useCreateAllocation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAllocationsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListCuttingBatchesQueryKey() });
        setOpen(false);
        setSelectedBatch(null);
        setAllocType("individual");
        toast({ title: "Allocation created successfully" });
      },
      onError: (e: any) => {
        const msg = e?.response?.data?.error || e.message || "Failed to allocate";
        toast({ title: "Error", description: msg, variant: "destructive" });
      }
    }
  });

  const { mutate: updateAllocation, isPending: isUpdating } = useUpdateAllocation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAllocationsQueryKey() });
        setEditOpen(false);
        setEditTarget(null);
        toast({ title: "Allocation updated" });
      },
      onError: (e: any) => {
        toast({ title: "Error", description: e?.response?.data?.error || "Update failed", variant: "destructive" });
      }
    }
  });

  const batchNeedsProduct = selectedBatch && !selectedBatch.productId;
  const batchNeedsMaterial = selectedBatch && !selectedBatch.materialId;
  const batchNeedsCompletion = batchNeedsProduct || batchNeedsMaterial;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: any = {
      cuttingBatchId: Number(fd.get("cuttingBatchId")),
      allocationType: allocType,
      quantityIssued: Number(fd.get("quantityIssued")),
      issueDate: fd.get("issueDate") as string,
      remarks: fd.get("remarks") as string,
    };
    if (allocType === "individual") {
      payload.stitcherId = Number(fd.get("stitcherId"));
      if (!payload.stitcherId) { toast({ title: "Please select a stitcher", variant: "destructive" }); return; }
    } else {
      payload.teamId = Number(fd.get("teamId"));
      if (!payload.teamId) { toast({ title: "Please select a team", variant: "destructive" }); return; }
    }
    if (batchNeedsProduct) {
      const pid = Number(fd.get("batchProductId"));
      if (!pid) { toast({ title: "Product/Design is required for allocation", variant: "destructive" }); return; }
      payload.batchProductId = pid;
    }
    if (batchNeedsMaterial) {
      const mid = Number(fd.get("batchMaterialId"));
      if (!mid) { toast({ title: "Material 1 is required for allocation", variant: "destructive" }); return; }
      payload.batchMaterialId = mid;
    }
    mutate({ data: payload });
  };

  const onEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editTarget) return;
    const fd = new FormData(e.currentTarget);
    updateAllocation({
      id: editTarget.id,
      data: {
        issueDate: fd.get("issueDate") as string,
        remarks: fd.get("remarks") as string || undefined,
      }
    });
  };

  const availableBatches = batches?.filter(b => (b.availableForAllocation || 0) > 0) || [];
  const activeTeams = teams?.filter((t: any) => t.isActive) || [];

  const filterFields = [
    { name: "startDate", label: "From Date", type: "date" as const },
    { name: "endDate", label: "To Date", type: "date" as const },
    { name: "productId", label: "Product", type: "select" as const, options: products?.filter((p: any) => p.isActive).map((p: any) => ({ value: p.id, label: `${p.code} - ${p.name}` })) || [] },
    { name: "colorId", label: "Color", type: "select" as const, options: colors?.filter((c: any) => c.isActive).map((c: any) => ({ value: c.id, label: `${c.code} - ${c.name}` })) || [] },
    { name: "stitcherId", label: "Stitcher", type: "select" as const, options: stitchers?.filter((s: any) => s.isActive).map((s: any) => ({ value: s.id, label: s.name })) || [] },
    { name: "teamId", label: "Team", type: "select" as const, options: activeTeams.map((t: any) => ({ value: t.id, label: t.name })) },
  ];

  return (
    <AppLayout title="Allocation to Stitchers / Teams">
      <FilterBar fields={filterFields} values={filters} onChange={setFilters} />

      <Card className="shadow-lg border-slate-200 rounded-2xl overflow-hidden">
        <CardHeader className="bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between py-5 px-6 gap-4">
          <div>
            <CardTitle className="text-xl font-display text-slate-800 flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Allocations
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">Issue cut pieces to individual stitchers or teams.</p>
          </div>
          {canCreate && <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSelectedBatch(null); setAllocType("individual"); } }}>
            <DialogTrigger asChild>
              <Button className="rounded-xl shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5">
                <Plus className="h-4 w-4 mr-2" /> Issue Batch
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px] rounded-2xl p-6 border-0 shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-display">Allocate Pieces</DialogTitle>
              </DialogHeader>
              <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 pt-4">

                <div>
                  <label className="text-sm font-medium block mb-1.5">Select Cutting Batch</label>
                  <select
                    name="cuttingBatchId"
                    className="form-input-styled bg-white"
                    required
                    onChange={e => {
                      const b = availableBatches.find(x => x.id === Number(e.target.value));
                      setSelectedBatch(b || null);
                    }}
                  >
                    <option value="">Select Batch...</option>
                    {availableBatches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.batchNumber} — {fmtCode(b.productCode, b.productName)} ({b.availableForAllocation} pcs available)
                      </option>
                    ))}
                  </select>
                  {selectedBatch && (
                    <>
                      <div className="mt-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 flex items-start gap-2">
                        <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                        <div className="text-xs text-blue-700 space-y-0.5">
                          <div><strong>Total Cut:</strong> {selectedBatch.totalCutQuantity} pcs &nbsp;|&nbsp; <strong>Available:</strong> {selectedBatch.availableForAllocation} pcs</div>
                          {selectedBatch.sizeName && <div><strong>Size:</strong> {selectedBatch.sizeName} &nbsp;|&nbsp; <strong>Color:</strong> {fmtCode(selectedBatch.colorCode, selectedBatch.colorName)}</div>}
                          {selectedBatch.itemCode && (
                            <div><strong>Item Code:</strong> <span className="font-mono bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded">{selectedBatch.itemCode}</span></div>
                          )}
                        </div>
                      </div>
                      {batchNeedsCompletion && (
                        <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-3 space-y-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                            <p className="text-xs text-amber-800 font-medium">This batch is missing required fields. Please complete them below before allocating.</p>
                          </div>
                          <div className="grid grid-cols-1 gap-3">
                            {batchNeedsProduct && (
                              <div>
                                <label className="text-sm font-medium block mb-1">Product / Design <span className="text-red-500">*</span></label>
                                <select name="batchProductId" className="form-input-styled bg-white" required>
                                  <option value="">Select Product...</option>
                                  {products?.filter((p: any) => p.isActive).map((p: any) => (
                                    <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                            {batchNeedsMaterial && (
                              <div>
                                <label className="text-sm font-medium block mb-1">Material 1 <span className="text-red-500">*</span></label>
                                <select name="batchMaterialId" className="form-input-styled bg-white" required>
                                  <option value="">Select Material...</option>
                                  {materials?.filter((m: any) => m.isActive).map((m: any) => (
                                    <option key={m.id} value={m.id}>{fmtCode(m.code, m.name)}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium block mb-2">Assign To</label>
                  <div className="flex gap-2 mb-3">
                    <button
                      type="button"
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${allocType === "individual" ? "bg-primary text-white border-primary shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:border-primary/50"}`}
                      onClick={() => setAllocType("individual")}
                    >
                      <User className="h-4 w-4" /> Individual
                    </button>
                    <button
                      type="button"
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${allocType === "team" ? "bg-primary text-white border-primary shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:border-primary/50"}`}
                      onClick={() => setAllocType("team")}
                    >
                      <Users className="h-4 w-4" /> Team
                    </button>
                  </div>

                  {allocType === "individual" ? (
                    <select name="stitcherId" className="form-input-styled bg-white" required>
                      <option value="">Select Stitcher...</option>
                      {stitchers?.filter((s: any) => s.isActive).map((s: any) => (
                        <option key={s.id} value={s.id}>{fmtCode(s.code, s.name)}{s.teamName ? ` (${s.teamName})` : ''}</option>
                      ))}
                    </select>
                  ) : (
                    <select name="teamId" className="form-input-styled bg-white" required>
                      <option value="">Select Team...</option>
                      {activeTeams.map((t: any) => (
                        <option key={t.id} value={t.id}>{fmtCode(t.code, t.name)}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium block mb-1.5">Quantity Issued</label>
                    <input
                      type="number"
                      name="quantityIssued"
                      className="form-input-styled border-amber-300 bg-amber-50"
                      required
                      min={1}
                      max={selectedBatch?.availableForAllocation}
                      placeholder="0"
                    />
                    {selectedBatch && (
                      <p className="text-xs text-slate-400 mt-1">Max: {selectedBatch.availableForAllocation}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5">Issue Date</label>
                    <input type="date" name="issueDate" className="form-input-styled" required defaultValue={new Date().toISOString().split('T')[0]} />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1.5">Remarks / Instructions</label>
                  <input name="remarks" className="form-input-styled" placeholder="Special instructions..." />
                </div>

                <div className="mt-2">
                  <Button type="submit" disabled={isPending} className="w-full h-12 rounded-xl text-base shadow-lg shadow-primary/20">
                    {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Allocating...</> : "Confirm Allocation"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>}
        </CardHeader>

        <CardContent className="p-0 bg-white">
          <Table>
            <TableHeader className="bg-slate-50 border-b border-slate-100">
              <TableRow>
                <TableHead className="py-4">Alloc. #</TableHead>
                <TableHead>Batch / Product</TableHead>
                <TableHead>Item Code</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead className="text-right">Issued</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issue Date</TableHead>
                {canEdit && <TableHead className="w-16"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={canEdit ? 10 : 9} className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-300" /></TableCell></TableRow>
              ) : (
                data?.map(alloc => {
                  const pending = alloc.quantityPending ?? (alloc.quantityIssued - (alloc.quantityReceived || 0) - (alloc.quantityRejected || 0));
                  const isTeam = alloc.allocationType === "team";
                  return (
                    <TableRow key={alloc.id} className="group hover:bg-slate-50/50">
                      <TableCell className="font-mono text-xs text-slate-500 font-medium">{alloc.allocationNumber}</TableCell>
                      <TableCell>
                        <div className="font-semibold text-primary text-sm">{alloc.batchNumber}</div>
                        <div className="text-xs text-slate-500">{fmtCode(alloc.productCode, alloc.productName)}</div>
                      </TableCell>
                      <TableCell>
                        {(alloc as any).itemCode
                          ? <span className="font-mono text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">{(alloc as any).itemCode}</span>
                          : <span className="text-xs text-slate-400">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {isTeam ? <Users className="h-3.5 w-3.5 text-violet-500" /> : <User className="h-3.5 w-3.5 text-slate-400" />}
                          <div>
                            <div className="font-semibold text-slate-900 text-sm">{alloc.assigneeName || alloc.stitcherName || alloc.teamName || '—'}</div>
                            {isTeam && <span className="text-xs text-violet-500 font-medium">Team</span>}
                            {!isTeam && alloc.stitcherTeamName && <div className="text-xs text-slate-500">{alloc.stitcherTeamName}</div>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold text-slate-800">{alloc.quantityIssued}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-emerald-600">{alloc.quantityReceived || 0}</span>
                        {(alloc.quantityRejected || 0) > 0 && (
                          <div className="text-xs text-red-500">+{alloc.quantityRejected} rej.</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {pending > 0 ? (
                          <span className="font-bold text-amber-700">{pending}</span>
                        ) : (
                          <span className="text-emerald-600 font-semibold">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={alloc.status || "pending"} />
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        {alloc.issueDate ? format(new Date(alloc.issueDate), 'MMM d, yyyy') : '-'}
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => { setEditTarget(alloc); setEditOpen(true); }}
                          >
                            <Pencil className="h-3.5 w-3.5 text-slate-500" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
              {!isLoading && data?.length === 0 && (
                <TableRow><TableCell colSpan={canEdit ? 10 : 9} className="text-center py-12 text-slate-500">No allocations found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl p-6 border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Edit Allocation</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <form onSubmit={onEditSubmit} className="grid grid-cols-1 gap-4 pt-4">
              <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-600">
                <div className="font-semibold text-slate-800">{editTarget.batchNumber}</div>
                <div className="text-xs text-slate-500 mt-0.5">{editTarget.assigneeName || editTarget.stitcherName} · {editTarget.quantityIssued} pcs issued</div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Issue Date</label>
                <input type="date" name="issueDate" className="form-input-styled" required defaultValue={editTarget.issueDate?.split('T')[0] || ""} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Remarks</label>
                <input name="remarks" className="form-input-styled" defaultValue={editTarget.remarks || ""} placeholder="Instructions..." />
              </div>
              <div className="mt-2">
                <Button type="submit" disabled={isUpdating} className="w-full h-11 rounded-xl">
                  {isUpdating ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
