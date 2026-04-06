import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, Send, Info, Pencil, AlertTriangle, Users, User, Undo2, Clock } from "lucide-react";
import { SearchableSelect } from "@/components/searchable-select";
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
import { fmtCode, fmtUTC, calcExpectedCompletion, calcWorkingMinutesBetween, formatMinutes, getMinutesPerPoint, computeTimingValues } from "@/lib/utils";
import { useAppAuth } from "@/lib/auth-context";
import { FilterBar } from "@/components/filter-bar";

type BatchStatus = string;

function StatusBadge({ status }: { status: BatchStatus }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:                    { label: "Pending",                    cls: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
    completed:                  { label: "Completed",                  cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
    partially_received:         { label: "Partially Received",         cls: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20" },
    pending_in_outsource:       { label: "Pending / In Outsource",     cls: "bg-orange-500/10 text-orange-700 border-orange-500/20" },
    pending_returned_outsource: { label: "Pending / Returned from Outsource", cls: "bg-purple-500/10 text-purple-700 border-purple-500/20" },
    returned:                   { label: "Returned",                       cls: "bg-red-500/10 text-red-700 border-red-500/20" },
  };
  const { label, cls } = map[status] || { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{label}</span>;
}

export default function AllocationPage() {
  const [filters, setFilters] = useState<Record<string, string>>({
    startDate: "", endDate: "", productId: "", colorId: "", sizeId: "", stitcherId: "", teamId: "", batchNumber: "", status: ""
  });

  const filterParams: Record<string, any> = {};
  if (filters.startDate) filterParams.startDate = filters.startDate;
  if (filters.endDate) filterParams.endDate = filters.endDate;
  if (filters.productId) filterParams.productId = Number(filters.productId);
  if (filters.colorId) filterParams.colorId = Number(filters.colorId);
  if (filters.sizeId) filterParams.sizeId = Number(filters.sizeId);
  if (filters.stitcherId) filterParams.stitcherId = Number(filters.stitcherId);
  if (filters.batchNumber) filterParams.batchNumber = filters.batchNumber;
  if (filters.teamId) filterParams.teamId = Number(filters.teamId);
  if (filters.status) filterParams.status = filters.status;

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
  const [workType, setWorkType] = useState<"simple_stitch" | "outsource_required">("simple_stitch");
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnTarget, setReturnTarget] = useState<any>(null);
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<any>(null);
  const [formQty, setFormQty] = useState(0);
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formTime, setFormTime] = useState(new Date().toTimeString().slice(0, 5));
  const [formProductOverride, setFormProductOverride] = useState<number | null>(null);

  const { mutate, isPending } = useCreateAllocation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAllocationsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListCuttingBatchesQueryKey() });
        setOpen(false);
        setSelectedBatch(null);
        setAllocType("individual");
        setFormQty(0);
        setFormProductOverride(null);
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

  const formProductId = selectedBatch?.productId || formProductOverride;
  const formProduct = formProductId ? products?.find((p: any) => p.id === formProductId) : null;
  const formPPP = formProduct ? Number(formProduct.pointsPerPiece) || 0 : 0;
  const formTotalPoints = formPPP * formQty;
  const formTotalMinutes = formTotalPoints * getMinutesPerPoint();
  const formStartDt = formDate ? new Date(`${formDate}T${formTime || "08:00"}:00Z`) : null;
  const formExpectedEnd = formStartDt && formTotalMinutes > 0 ? calcExpectedCompletion(formStartDt, formTotalMinutes) : null;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedBatch) { toast({ title: "Please select a cutting batch", variant: "destructive" }); return; }
    const fd = new FormData(e.currentTarget);
    const dateVal = fd.get("issueDate") as string;
    const timeVal = fd.get("issueTime") as string;
    const payload: any = {
      cuttingBatchId: selectedBatch.id,
      allocationType: allocType,
      quantityIssued: Number(fd.get("quantityIssued")),
      issueDate: timeVal ? `${dateVal}T${timeVal}` : dateVal,
      remarks: fd.get("remarks") as string,
      workType,
      outsourceCategory: workType === "outsource_required" ? (fd.get("outsourceCategory") as string) : undefined,
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
    const locked = !!(editTarget as any).isLocked;
    const editDateVal = fd.get("issueDate") as string;
    const editTimeVal = fd.get("issueTime") as string;
    const payload: Record<string, any> = {
      issueDate: editTimeVal ? `${editDateVal}T${editTimeVal}` : editDateVal,
      remarks: fd.get("remarks") as string || undefined,
    };
    const stId = fd.get("stitcherId");
    const tmId = fd.get("teamId");
    if (stId !== null) payload.stitcherId = stId ? Number(stId) : null;
    if (tmId !== null) payload.teamId = tmId ? Number(tmId) : null;
    if (!locked) {
      const qi = fd.get("quantityIssued");
      if (qi) payload.quantityIssued = Number(qi);
    }
    updateAllocation({ id: editTarget.id, data: payload });
  };

  const onReturnSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!returnTarget) return;
    const fd = new FormData(e.currentTarget);
    const qty = Number(fd.get("quantityReturned"));
    if (!qty || qty <= 0) { toast({ title: "Quantity must be a positive number", variant: "destructive" }); return; }
    setReturnSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/allocation/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          allocationId: returnTarget.id,
          quantityReturned: qty,
          returnDate: fd.get("returnDate") as string,
          remarks: fd.get("remarks") as string || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Error", description: data.error || "Return failed", variant: "destructive" }); return; }
      queryClient.invalidateQueries({ queryKey: getListAllocationsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListCuttingBatchesQueryKey() });
      setReturnOpen(false);
      setReturnTarget(null);
      toast({ title: `Returned ${qty} pieces successfully` });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setReturnSubmitting(false);
    }
  };

  const availableBatches = batches?.filter(b => (b.availableForAllocation || 0) > 0) || [];
  const activeTeams = teams?.filter((t: any) => t.isActive) || [];

  const allocationStatusOptions = [
    { value: "pending", label: "Pending" },
    { value: "completed", label: "Completed" },
    { value: "partially_received", label: "Partially Received" },
    { value: "pending_in_outsource", label: "Pending / In Outsource" },
    { value: "pending_returned_outsource", label: "Pending / Returned from Outsource" },
    { value: "returned", label: "Returned" },
  ];

  const filterFields = [
    { name: "batchNumber", label: "Batch Number", type: "text" as const, placeholder: "Search batch..." },
    { name: "status", label: "Status", type: "select" as const, options: allocationStatusOptions },
    { name: "startDate", label: "From Date", type: "date" as const },
    { name: "endDate", label: "To Date", type: "date" as const },
    { name: "productId", label: "Product", type: "select" as const, options: products?.filter((p: any) => p.isActive).map((p: any) => ({ value: p.id, label: `${p.code} - ${p.name}` })) || [] },
    { name: "colorId", label: "Color", type: "select" as const, options: colors?.filter((c: any) => c.isActive).map((c: any) => ({ value: c.id, label: `${c.code} - ${c.name}` })) || [] },
    { name: "stitcherId", label: "Stitcher", type: "select" as const, options: stitchers?.filter((s: any) => s.isActive).map((s: any) => ({ value: s.id, label: s.name })) || [] },
    { name: "teamId", label: "Team", type: "select" as const, options: activeTeams.map((t: any) => ({ value: t.id, label: t.name })) },
  ];

  const filteredAllocTotals = data ? {
    totalAllocations: data.length,
    totalIssued: data.reduce((sum: number, a: any) => sum + (a.quantityIssued || 0), 0),
    totalPending: data.reduce((sum: number, a: any) => sum + (a.quantityPending ?? (a.quantityIssued - (a.quantityReceived || 0) - (a.quantityRejected || 0))), 0),
  } : null;

  return (
    <AppLayout title="Allocation to Stitchers / Teams">
      <FilterBar fields={filterFields} values={filters} onChange={setFilters} />
      {filteredAllocTotals && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-card border border-border rounded-xl px-4 py-3">
            <div className="text-xs text-muted-foreground font-medium">Allocations</div>
            <div className="text-lg font-bold text-foreground">{filteredAllocTotals.totalAllocations}</div>
          </div>
          <div className="bg-card border border-border rounded-xl px-4 py-3">
            <div className="text-xs text-muted-foreground font-medium">Total Issued</div>
            <div className="text-lg font-bold text-foreground">{filteredAllocTotals.totalIssued.toLocaleString()}</div>
          </div>
          <div className="bg-card border border-border rounded-xl px-4 py-3">
            <div className="text-xs text-muted-foreground font-medium">Total Pending</div>
            <div className="text-lg font-bold text-amber-700">{filteredAllocTotals.totalPending.toLocaleString()}</div>
          </div>
        </div>
      )}

      <Card className="shadow-lg border-border rounded-2xl overflow-hidden">
        <CardHeader className="bg-card border-b border-border flex flex-col sm:flex-row sm:items-center justify-between py-5 px-6 gap-4">
          <div>
            <CardTitle className="text-xl font-display text-foreground flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Allocations
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Issue cut pieces to individual stitchers or teams.</p>
          </div>
          {canCreate && <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSelectedBatch(null); setAllocType("individual"); setWorkType("simple_stitch"); setFormQty(0); setFormProductOverride(null); } }}>
            <DialogTrigger asChild>
              <Button className="rounded-xl shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5">
                <Plus className="h-4 w-4 mr-2" /> Issue Batch
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px] rounded-2xl p-6 border-0 shadow-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl font-display">Allocate Pieces</DialogTitle>
              </DialogHeader>
              <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 pt-4">

                <div>
                  <label className="text-sm font-medium block mb-1.5">Select Cutting Batch</label>
                  <SearchableSelect
                    name="cuttingBatchId"
                    required
                    placeholder="Select Batch..."
                    value={selectedBatch?.id ?? ""}
                    options={availableBatches.map(b => ({
                      value: b.id,
                      label: `${b.batchNumber} — ${fmtCode(b.productCode, b.productName)} (${b.availableForAllocation} pcs)`,
                      searchText: `${b.batchNumber} ${b.productCode} ${b.productName} ${b.itemCode || ""}`,
                    }))}
                    onChange={(val) => {
                      const b = availableBatches.find(x => x.id === Number(val));
                      setSelectedBatch(b || null);
                    }}
                  />
                  {selectedBatch && (
                    <>
                      <div className="mt-2 bg-primary/10 border border-primary/20 rounded-xl px-3 py-2 flex items-start gap-2">
                        <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <div className="text-xs text-primary space-y-0.5">
                          <div><strong>Total Cut:</strong> {selectedBatch.totalCutQuantity} pcs &nbsp;|&nbsp; <strong>Available:</strong> {selectedBatch.availableForAllocation} pcs</div>
                          {selectedBatch.sizeName && <div><strong>Size:</strong> {selectedBatch.sizeName} &nbsp;|&nbsp; <strong>Color:</strong> {fmtCode(selectedBatch.colorCode, selectedBatch.colorName)}</div>}
                          {selectedBatch.itemCode && (
                            <div><strong>Item Code:</strong> <span className="font-mono bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded">{selectedBatch.itemCode}</span></div>
                          )}
                        </div>
                      </div>
                      {batchNeedsCompletion && (
                        <div className="mt-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-3 space-y-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                            <p className="text-xs text-amber-800 font-medium">This batch is missing required fields. Please complete them below before allocating.</p>
                          </div>
                          <div className="grid grid-cols-1 gap-3">
                            {batchNeedsProduct && (
                              <div>
                                <label className="text-sm font-medium block mb-1">Product / Design <span className="text-red-500">*</span></label>
                                <select name="batchProductId" className="form-input-styled bg-card" required onChange={e => setFormProductOverride(Number(e.target.value) || null)}>
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
                                <select name="batchMaterialId" className="form-input-styled bg-card" required>
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
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${allocType === "individual" ? "bg-primary text-white border-primary shadow-sm" : "bg-card text-muted-foreground border-border hover:border-primary/50"}`}
                      onClick={() => setAllocType("individual")}
                    >
                      <User className="h-4 w-4" /> Individual
                    </button>
                    <button
                      type="button"
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${allocType === "team" ? "bg-primary text-white border-primary shadow-sm" : "bg-card text-muted-foreground border-border hover:border-primary/50"}`}
                      onClick={() => setAllocType("team")}
                    >
                      <Users className="h-4 w-4" /> Team
                    </button>
                  </div>

                  {allocType === "individual" ? (
                    <select name="stitcherId" className="form-input-styled bg-card" required>
                      <option value="">Select Stitcher...</option>
                      {stitchers?.filter((s: any) => s.isActive).map((s: any) => (
                        <option key={s.id} value={s.id}>{fmtCode(s.code, s.name)}{s.teamName ? ` (${s.teamName})` : ''}</option>
                      ))}
                    </select>
                  ) : (
                    <select name="teamId" className="form-input-styled bg-card" required>
                      <option value="">Select Team...</option>
                      {activeTeams.map((t: any) => (
                        <option key={t.id} value={t.id}>{fmtCode(t.code, t.name)}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium block mb-2">Work Type</label>
                  <div className="flex gap-2 mb-3">
                    <button
                      type="button"
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${workType === "simple_stitch" ? "bg-primary text-white border-primary shadow-sm" : "bg-card text-muted-foreground border-border hover:border-primary/50"}`}
                      onClick={() => setWorkType("simple_stitch")}
                    >
                      Simple Stitch
                    </button>
                    <button
                      type="button"
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${workType === "outsource_required" ? "bg-violet-600 text-white border-violet-600 shadow-sm" : "bg-card text-muted-foreground border-border hover:border-violet-400"}`}
                      onClick={() => setWorkType("outsource_required")}
                    >
                      Outsource Required
                    </button>
                  </div>
                  {workType === "outsource_required" && (
                    <select name="outsourceCategory" className="form-input-styled bg-violet-50 border-violet-200" required>
                      <option value="">Select Outsource Type...</option>
                      <option value="heat_stone">Heat Stone</option>
                      <option value="embroidery">Embroidery</option>
                      <option value="hand_stones">Hand Stones</option>
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium block mb-1.5">Quantity Issued</label>
                    <input
                      type="number"
                      name="quantityIssued"
                      className="form-input-styled border-amber-500/30 bg-amber-500/10"
                      required
                      min={1}
                      max={selectedBatch?.availableForAllocation}
                      placeholder="0"
                      onChange={e => setFormQty(Number(e.target.value) || 0)}
                    />
                    {selectedBatch && (
                      <p className="text-xs text-muted-foreground mt-1">Max: {selectedBatch.availableForAllocation}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5">Issue Date & Time</label>
                    <div className="flex gap-2">
                      <input type="date" name="issueDate" className="form-input-styled flex-1" required value={formDate} onChange={e => setFormDate(e.target.value)} />
                      <input type="time" name="issueTime" className="form-input-styled w-28" value={formTime} onChange={e => setFormTime(e.target.value)} />
                    </div>
                  </div>
                </div>

                {selectedBatch && formQty > 0 && formPPP === 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center gap-2 text-xs text-amber-600">
                    <Clock className="h-4 w-4 shrink-0" />
                    No points configured for this product. Set points in Product Master to see expected completion time.
                  </div>
                )}
                {formQty > 0 && formPPP > 0 && (
                  <div className="bg-card border border-border rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                      <Clock className="h-4 w-4 text-primary" /> Expected Completion
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">Points / Piece</div>
                      <div className="font-semibold text-right">{formPPP}</div>
                      <div className="text-muted-foreground">Total Points</div>
                      <div className="font-semibold text-right text-primary">{formTotalPoints}</div>
                      <div className="text-muted-foreground">Expected Time</div>
                      <div className="font-semibold text-right text-primary">{formatMinutes(formTotalMinutes)}</div>
                      <div className="text-muted-foreground">Completion</div>
                      <div className="font-semibold text-right text-emerald-600">{formExpectedEnd ? fmtUTC(formExpectedEnd) : "—"}</div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Working slots: 8:00–1:20 PM, 2:30–8:00 PM (4h30m effective), 8:30–11:00 PM · 1 point = 20 min
                    </div>
                  </div>
                )}

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

        <CardContent className="p-0 bg-card">
          <Table>
            <TableHeader className="bg-background border-b border-border">
              <TableRow>
                <TableHead className="py-4">Alloc. #</TableHead>
                <TableHead>Batch / Product</TableHead>
                <TableHead>Item Code</TableHead>
                <TableHead>Work Type</TableHead>
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
                <TableRow><TableCell colSpan={canEdit ? 11 : 10} className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : (
                data?.map(alloc => {
                  const pending = alloc.quantityPending ?? (alloc.quantityIssued - (alloc.quantityReceived || 0) - (alloc.quantityRejected || 0));
                  const isTeam = alloc.allocationType === "team";
                  return (
                    <TableRow key={alloc.id} className="group hover:bg-background/50">
                      <TableCell className="font-mono text-xs text-muted-foreground font-medium">{alloc.allocationNumber}</TableCell>
                      <TableCell>
                        <div className="font-semibold text-primary text-sm">{alloc.batchNumber}</div>
                        <div className="text-xs text-muted-foreground">{fmtCode(alloc.productCode, alloc.productName)}</div>
                        {(() => {
                          const pf = (alloc as any).productionFor || "reesha_stock";
                          if (pf === "purchase_order") return <span className="inline-flex items-center mt-0.5 px-1.5 py-0 rounded text-[10px] font-medium bg-violet-50 text-violet-600 border border-violet-200">PO: {(alloc as any).poNumber || "?"}</span>;
                          if (pf === "order") return <span className="inline-flex items-center mt-0.5 px-1.5 py-0 rounded text-[10px] font-medium bg-orange-500/10 text-orange-600 border border-orange-500/20">Order: {(alloc as any).orderNumber || "?"}</span>;
                          return null;
                        })()}
                      </TableCell>
                      <TableCell>
                        {(alloc as any).itemCode
                          ? <span className="font-mono text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">{(alloc as any).itemCode}</span>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {(alloc as any).workType === "outsource_required" ? (
                          <div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-violet-50 text-violet-700 border-violet-200">Outsource</span>
                            {(alloc as any).outsourceCategory && (
                              <div className="text-xs text-violet-500 mt-0.5 capitalize">{(alloc as any).outsourceCategory?.replace(/_/g, ' ')}</div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-background text-muted-foreground border-border">Simple Stitch</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {isTeam ? <Users className="h-3.5 w-3.5 text-violet-500" /> : <User className="h-3.5 w-3.5 text-muted-foreground" />}
                          <div>
                            <div className="font-semibold text-foreground text-sm">{alloc.assigneeName || alloc.stitcherName || alloc.teamName || '—'}</div>
                            {isTeam && <span className="text-xs text-violet-500 font-medium">Team</span>}
                            {!isTeam && alloc.stitcherTeamName && <div className="text-xs text-muted-foreground">{alloc.stitcherTeamName}</div>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold text-foreground">{alloc.quantityIssued}</span>
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
                        <StatusBadge status={(alloc as any).computedStatus || "pending"} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {alloc.issueDate ? fmtUTC(alloc.issueDate) : '-'}
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => { setDetailTarget(alloc); setDetailOpen(true); }}
                              title="Points / Time"
                            >
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => { setEditTarget(alloc); setEditOpen(true); }}
                            >
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            {pending > 0 && canCreate && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Return pieces"
                                onClick={() => { setReturnTarget({ ...alloc, activePending: pending }); setReturnOpen(true); }}
                              >
                                <Undo2 className="h-3.5 w-3.5 text-amber-600" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
              {!isLoading && data?.length === 0 && (
                <TableRow><TableCell colSpan={canEdit ? 11 : 10} className="text-center py-12 text-muted-foreground">No allocations found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl p-6 border-0 shadow-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Edit Allocation</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <form onSubmit={onEditSubmit} className="grid grid-cols-1 gap-4 pt-4">
              <div className="bg-background rounded-xl p-3 text-sm text-muted-foreground">
                <div className="font-semibold text-foreground">{editTarget.batchNumber}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{editTarget.assigneeName || editTarget.stitcherName} · {editTarget.quantityIssued} pcs issued</div>
              </div>
              {(editTarget as any).isLocked && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2 text-xs text-amber-700 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Receiving or outsource records exist. Quantity issued cannot be changed.
                </div>
              )}
              {editTarget.allocationType === "individual" && (
                <div>
                  <label className="text-sm font-medium block mb-1.5">Stitcher</label>
                  <select name="stitcherId" className="form-input-styled" defaultValue={editTarget.stitcherId || ""}>
                    <option value="">— Select —</option>
                    {stitchers?.filter((s: any) => s.isActive).map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {editTarget.allocationType === "team" && (
                <div>
                  <label className="text-sm font-medium block mb-1.5">Team</label>
                  <select name="teamId" className="form-input-styled" defaultValue={editTarget.teamId || ""}>
                    <option value="">— Select —</option>
                    {teams?.filter((t: any) => t.isActive).map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-sm font-medium block mb-1.5">Quantity Issued</label>
                <input type="number" name="quantityIssued" className="form-input-styled" min="1" defaultValue={editTarget.quantityIssued || ""} disabled={!!(editTarget as any).isLocked} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Issue Date & Time</label>
                <div className="flex gap-2">
                  <input type="date" name="issueDate" className="form-input-styled flex-1" required defaultValue={editTarget.issueDate ? editTarget.issueDate.slice(0, 10) : ""} />
                  <input type="time" name="issueTime" className="form-input-styled w-28" defaultValue={editTarget.issueDate ? editTarget.issueDate.slice(11, 16) : ""} />
                </div>
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

      <Dialog open={detailOpen} onOpenChange={(v) => { setDetailOpen(v); if (!v) setDetailTarget(null); }}>
        <DialogContent className="sm:max-w-[440px] rounded-2xl p-6 border-0 shadow-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-display flex items-center gap-2"><Clock className="h-5 w-5" /> Points / Time</DialogTitle>
          </DialogHeader>
          {detailTarget && (() => {
            const t = computeTimingValues({
              issueDate: detailTarget.issueDate,
              pointsPerPiece: Number(detailTarget.pointsPerPiece) || 0,
              quantityIssued: detailTarget.quantityIssued || 0,
              outsourceSendDate: detailTarget.outsourceSendDate,
              outsourceReturnDate: detailTarget.outsourceReturnDate,
              outsourceSent: detailTarget.outsourceSent || 0,
              outsourceReturned: detailTarget.outsourceReturned || 0,
              outsourceDamaged: detailTarget.outsourceDamaged || 0,
              priorityPauses: detailTarget.priorityPauses,
              manualPauses: (detailTarget as any).manualPauses,
              actualCompletionDate: (detailTarget as any).lastReceiveDate,
            });
            const { totalPoints, totalMinutes, startDt, oSendDate, oReturnDate, oSent, oReturned, oDamaged,
              hasOutsource, isInOutsource, outsourceFullyReturned, outsourcePending, preOutsourceUsed,
              remainingMinutes, expectedEnd, actualCompletionDt, actualMinutes,
              isPausedByOrder, hasPriorityPause, priorityPauses } = t;
            const ppp = Number(detailTarget.pointsPerPiece) || 0;
            const qty = detailTarget.quantityIssued || 0;

            const received = detailTarget.quantityReceived || 0;
            const rejected = detailTarget.quantityRejected || 0;
            const pending = qty - received - rejected;
            const wt = (detailTarget as any).workType;
            const osCat = (detailTarget as any).outsourceCategory;
            const prodFor = (detailTarget as any).productionFor || "reesha_stock";
            const prodRef = prodFor === "purchase_order" ? `PO: ${(detailTarget as any).poNumber || "?"}` : prodFor === "order" ? `Order: ${(detailTarget as any).orderNumber || "?"}` : null;
            const itemCode = (detailTarget as any).itemCode;
            const remarks = (detailTarget as any).remarks;
            const status = (detailTarget as any).computedStatus || "pending";

            return (
              <div className="grid grid-cols-1 gap-3 pt-4">
                <div className="bg-background rounded-xl p-3 text-sm text-muted-foreground">
                  <div className="font-semibold text-foreground">{detailTarget.batchNumber} — {detailTarget.allocationNumber}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{fmtCode(detailTarget.productCode, detailTarget.productName)} · {detailTarget.assigneeName || detailTarget.stitcherName}</div>
                  {itemCode && <div className="text-xs font-mono text-teal-700 mt-0.5">{itemCode}</div>}
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={status} />
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border bg-background text-muted-foreground border-border">
                      {wt === "outsource_required" ? "Outsource" : "Simple Stitch"}
                      {osCat ? ` · ${osCat.replace(/_/g, " ")}` : ""}
                    </span>
                    {prodRef && <span className="text-[10px] font-medium text-violet-600">{prodRef}</span>}
                  </div>
                </div>

                {ppp === 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2 text-xs text-amber-700 flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    No points configured for this product. Update the Product Master to set points per piece.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-card border border-border rounded-xl p-3">
                    <div className="text-xs text-muted-foreground mb-1">Points / Piece</div>
                    <div className="text-lg font-bold text-foreground">{ppp}</div>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-3">
                    <div className="text-xs text-muted-foreground mb-1">Qty Issued</div>
                    <div className="text-lg font-bold text-foreground">{qty}</div>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-3">
                    <div className="text-xs text-muted-foreground mb-1">Total Points</div>
                    <div className="text-lg font-bold text-primary">{totalPoints}</div>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-3">
                    <div className="text-xs text-muted-foreground mb-1">Expected Time</div>
                    <div className="text-lg font-bold text-primary">{formatMinutes(totalMinutes)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-card border border-border rounded-lg p-2 text-center">
                    <div className="text-sm font-bold text-emerald-600">{received}</div>
                    <div className="text-[10px] text-muted-foreground">Received</div>
                  </div>
                  <div className="bg-card border border-border rounded-lg p-2 text-center">
                    <div className="text-sm font-bold text-red-500">{rejected}</div>
                    <div className="text-[10px] text-muted-foreground">Rejected</div>
                  </div>
                  <div className="bg-card border border-border rounded-lg p-2 text-center">
                    <div className={`text-sm font-bold ${pending > 0 ? "text-amber-700" : "text-emerald-600"}`}>{pending}</div>
                    <div className="text-[10px] text-muted-foreground">Pending</div>
                  </div>
                </div>

                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Allocation Start</span>
                    <span className="font-medium text-foreground">{startDt ? fmtUTC(startDt) : "—"}</span>
                  </div>
                  {hasOutsource && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Outsource Sent</span>
                        <span className="font-medium text-orange-500">{oSendDate ? fmtUTC(oSendDate) : "—"}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Outsource Qty</span>
                        <span className="font-medium text-foreground">{oSent} sent · {oReturned} returned{oDamaged > 0 ? ` · ${oDamaged} damaged` : ""}</span>
                      </div>
                      {oReturnDate && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Outsource Returned</span>
                          <span className="font-medium text-teal-600">{fmtUTC(oReturnDate)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Outsource Time Taken</span>
                        <span className={`font-medium ${isInOutsource ? "text-orange-500" : "text-foreground"}`}>
                          {isInOutsource ? "In Progress" : oSendDate && oReturnDate ? formatMinutes(Math.round((oReturnDate.getTime() - oSendDate.getTime()) / 60000)) : "—"}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Time Before Outsource</span>
                        <span className="font-medium text-foreground">{formatMinutes(preOutsourceUsed)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Remaining Time</span>
                        <span className="font-medium text-primary">{formatMinutes(remainingMinutes)}</span>
                      </div>
                    </>
                  )}
                  {isInOutsource && (
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-2 text-xs text-orange-600 flex items-center gap-2 mt-1">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Timing paused — batch is currently in outsource
                    </div>
                  )}
                  {hasPriorityPause && (
                    <>
                      {priorityPauses.map((p: any, idx: number) => (
                        <div key={idx} className="bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-2 text-xs space-y-1 mt-1">
                          <div className="font-semibold text-violet-700 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            Priority Order Pause{priorityPauses.length > 1 ? ` #${idx + 1}` : ""}
                          </div>
                          <div className="text-muted-foreground">
                            Order: {p.orderBatchNumber || p.orderAllocationNumber || "—"}
                            {p.phaseLabel && <span className="ml-1 text-violet-500">({p.phaseLabel})</span>}
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Pause Start</span>
                            <span className="font-medium text-violet-600">{p.pauseStart ? fmtUTC(p.pauseStart) : "—"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Resume</span>
                            <span className={`font-medium ${p.pauseEnd ? "text-teal-600" : "text-violet-600"}`}>
                              {p.pauseEnd ? fmtUTC(p.pauseEnd) : "Pending"}
                            </span>
                          </div>
                          {p.pauseStart && p.pauseEnd && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Paused Duration</span>
                              <span className="font-medium text-foreground">{formatMinutes(calcWorkingMinutesBetween(new Date(p.pauseStart), new Date(p.pauseEnd)))}</span>
                            </div>
                          )}
                        </div>
                      ))}
                      {isPausedByOrder && (
                        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-2 text-xs text-violet-700 flex items-center gap-2 mt-1">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          Timing paused — priority Order batch in progress
                        </div>
                      )}
                    </>
                  )}
                  {!hasOutsource && hasPriorityPause && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Remaining Time</span>
                      <span className="font-medium text-primary">{formatMinutes(remainingMinutes)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Expected Completion</span>
                    <span className={`font-medium ${(isInOutsource || isPausedByOrder) ? "text-violet-600" : "text-emerald-600"}`}>
                      {expectedEnd ? fmtUTC(expectedEnd) : "—"}{(isInOutsource || isPausedByOrder) && expectedEnd ? " (paused)" : ""}
                    </span>
                  </div>
                  {actualCompletionDt && startDt && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Actual Completion</span>
                        <span className="font-medium text-foreground">{fmtUTC(actualCompletionDt)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Actual Time Taken</span>
                        <span className="font-bold text-foreground">{actualMinutes > 0 ? formatMinutes(actualMinutes) : "—"}</span>
                      </div>
                    </>
                  )}
                </div>

                {remarks && (
                  <div className="border-t border-border pt-2">
                    <div className="text-xs text-muted-foreground mb-0.5">Remarks</div>
                    <div className="text-sm text-foreground">{remarks}</div>
                  </div>
                )}

                <div className="text-xs text-muted-foreground mt-1">
                  Working slots: 8:00–1:20 PM, 2:30–8:00 PM (4h30m effective), 8:30–11:00 PM · 1 point = 20 min
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={returnOpen} onOpenChange={(v) => { setReturnOpen(v); if (!v) setReturnTarget(null); }}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl p-6 border-0 shadow-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Return Allocated Pieces</DialogTitle>
          </DialogHeader>
          {returnTarget && (
            <form onSubmit={onReturnSubmit} className="grid grid-cols-1 gap-4 pt-4">
              <div className="bg-background rounded-xl p-3 text-sm text-muted-foreground">
                <div className="font-semibold text-foreground">{returnTarget.batchNumber} — {returnTarget.allocationNumber}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {returnTarget.assigneeName || returnTarget.stitcherName} · {returnTarget.quantityIssued} issued · {returnTarget.activePending} pending
                </div>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2 text-xs text-amber-700 flex items-center gap-2">
                <Undo2 className="h-3.5 w-3.5 shrink-0" />
                Returned pieces will be added back to the cutting batch&apos;s available quantity.
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Quantity to Return</label>
                <input type="number" name="quantityReturned" className="form-input-styled" min="1" max={returnTarget.activePending} required placeholder={`Max: ${returnTarget.activePending}`} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Return Date</label>
                <input type="date" name="returnDate" className="form-input-styled" required defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Remarks</label>
                <input name="remarks" className="form-input-styled" placeholder="Reason for return..." />
              </div>
              <div className="mt-2">
                <Button type="submit" disabled={returnSubmitting} className="w-full h-11 rounded-xl">
                  {returnSubmitting ? "Returning..." : "Return Pieces"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
