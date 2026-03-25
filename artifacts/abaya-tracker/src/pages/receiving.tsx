import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, Inbox, AlertCircle, CheckCircle2, Pencil } from "lucide-react";
import { SearchableSelect } from "@/components/searchable-select";
import {
  useListReceivings, useCreateReceiving, getListReceivingsQueryKey,
  useListAllocations, getListAllocationsQueryKey, useUpdateReceiving,
  useListStitchers
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fmtCode } from "@/lib/utils";
import { useAppAuth } from "@/lib/auth-context";
import { FilterBar } from "@/components/filter-bar";

function BatchStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    cutting:            { label: "Cutting",        cls: "bg-primary/10 text-primary border-primary/20" },
    allocated:          { label: "Allocated",      cls: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
    allocation:         { label: "Allocated",      cls: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
    partially_received: { label: "Partial",        cls: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20" },
    stitching:          { label: "Partial",        cls: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20" },
    fully_received:     { label: "Fully Rcvd",     cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
    in_finishing:       { label: "In Finishing",   cls: "bg-purple-500/10 text-purple-700 border-purple-500/20" },
    finished:           { label: "Finished",       cls: "bg-muted text-muted-foreground border-border" },
    pending:            { label: "Pending",        cls: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
    partial:            { label: "Partial",        cls: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20" },
    completed:          { label: "Completed",      cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  };
  const { label, cls } = map[status] || { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{label}</span>;
}

export default function ReceivingPage() {
  const [filters, setFilters] = useState<Record<string, string>>({ startDate: "", endDate: "", stitcherId: "", batchNumber: "" });

  const filterParams: Record<string, any> = {};
  if (filters.startDate) filterParams.startDate = filters.startDate;
  if (filters.endDate) filterParams.endDate = filters.endDate;
  if (filters.stitcherId) filterParams.stitcherId = Number(filters.stitcherId);
  if (filters.batchNumber) filterParams.batchNumber = filters.batchNumber;

  const { data, isLoading } = useListReceivings(filterParams);
  const { data: allocations } = useListAllocations();
  const { data: stitchers } = useListStitchers();

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, can } = useAppAuth();
  const canCreate = can("receiving", "create");
  const canEdit = can("receiving", "edit");

  const [open, setOpen] = useState(false);
  const [selectedAllocationId, setSelectedAllocationId] = useState<number | null>(null);
  const [qtyReceived, setQtyReceived] = useState(0);
  const [qtyRejected, setQtyRejected] = useState(0);
  const [qtyDamaged, setQtyDamaged] = useState(0);
  const [formError, setFormError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);

  const { mutate, isPending } = useCreateReceiving({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListReceivingsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAllocationsQueryKey() });
        setOpen(false);
        resetForm();
        toast({ title: "Receipt logged successfully" });
      },
      onError: (e: any) => {
        toast({ title: "Error", description: e.message || "Failed to save receipt", variant: "destructive" });
      }
    }
  });

  const { mutate: updateReceiving, isPending: isUpdating } = useUpdateReceiving({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListReceivingsQueryKey() });
        setEditOpen(false);
        setEditTarget(null);
        toast({ title: "Receipt updated" });
      },
      onError: (e: any) => {
        toast({ title: "Error", description: e?.response?.data?.error || "Update failed", variant: "destructive" });
      }
    }
  });

  function resetForm() {
    setSelectedAllocationId(null);
    setQtyReceived(0);
    setQtyRejected(0);
    setQtyDamaged(0);
    setFormError("");
  }

  const selectedAlloc = allocations?.find(a => a.id === selectedAllocationId) ?? null;
  const isOutsource = selectedAlloc?.workType === "outsource_required";
  const outsourceReturned = isOutsource ? (selectedAlloc?.outsourceReturned || 0) : 0;
  const alreadyAccounted = (selectedAlloc?.quantityReceived || 0) + (selectedAlloc?.quantityRejected || 0);
  const maxReceivable = isOutsource ? outsourceReturned : (selectedAlloc?.quantityIssued || 0);
  const pendingQty = selectedAlloc ? Math.max(0, maxReceivable - alreadyAccounted) : 0;
  const thisEntryTotal = qtyReceived + qtyRejected + qtyDamaged;

  useEffect(() => {
    if (!selectedAlloc) { setFormError(""); return; }
    if (thisEntryTotal <= 0) { setFormError(""); return; }
    if (thisEntryTotal > pendingQty) {
      setFormError(`Total of this entry (${thisEntryTotal}) exceeds pending quantity (${pendingQty}).`);
    } else {
      setFormError("");
    }
  }, [qtyReceived, qtyRejected, qtyDamaged, pendingQty, selectedAlloc, thisEntryTotal]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (formError || !selectedAllocationId) return;
    const fd = new FormData(e.currentTarget);
    mutate({
      data: {
        allocationId: selectedAllocationId,
        quantityReceived: Number(fd.get("quantityReceived")),
        quantityRejected: Number(fd.get("quantityRejected")) || 0,
        quantityDamaged: Number(fd.get("quantityDamaged")) || 0,
        receiveDate: fd.get("receiveDate") as string,
        remarks: fd.get("remarks") as string,
        hasStain: !!fd.get("hasStain"),
        hasDamage: !!fd.get("hasDamage"),
        needsWash: !!fd.get("needsWash"),
        needsRework: !!fd.get("needsRework"),
      }
    });
  };

  const onEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editTarget) return;
    const fd = new FormData(e.currentTarget);
    updateReceiving({
      id: editTarget.id,
      data: {
        receiveDate: fd.get("receiveDate") as string,
        remarks: fd.get("remarks") as string || undefined,
        hasStain: !!fd.get("hasStain"),
        hasDamage: !!fd.get("hasDamage"),
        needsWash: !!fd.get("needsWash"),
        needsRework: !!fd.get("needsRework"),
      }
    });
  };

  const pendingAllocations = allocations?.filter(a => {
    const accounted = (a.quantityReceived || 0) + (a.quantityRejected || 0);
    const max = a.workType === "outsource_required" ? (a.outsourceReturned || 0) : a.quantityIssued;
    return (max - accounted) > 0;
  }) || [];

  const receivingFilterFields = [
    { name: "batchNumber", label: "Batch Number", type: "text" as const, placeholder: "Search batch..." },
    { name: "startDate", label: "From Date", type: "date" as const },
    { name: "endDate", label: "To Date", type: "date" as const },
    { name: "stitcherId", label: "Stitcher", type: "select" as const, options: stitchers?.filter((s: any) => s.isActive).map((s: any) => ({ value: s.id, label: s.name })) || [] },
  ];

  return (
    <AppLayout title="Receiving from Stitchers">
      <FilterBar fields={receivingFilterFields} values={filters} onChange={setFilters} />
      <Card className="shadow-lg border-border rounded-2xl overflow-hidden">
        <CardHeader className="bg-card border-b border-border flex flex-col sm:flex-row sm:items-center justify-between py-5 px-6 gap-4">
          <div>
            <CardTitle className="text-xl font-display text-foreground flex items-center gap-2">
              <Inbox className="h-5 w-5 text-primary" />
              Receive from Stitchers
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Log pieces received back. Supports partial receiving — enter as many receipts as needed.</p>
          </div>
          {canCreate && <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="rounded-xl shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5">
                <Plus className="h-4 w-4 mr-2" /> Log Receipt
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px] rounded-2xl p-6 border-0 shadow-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl font-display">Receive from Stitcher</DialogTitle>
              </DialogHeader>
              <form onSubmit={onSubmit} className="space-y-4 pt-4">

                <div>
                  <label className="text-sm font-medium block mb-1.5">Select Allocation (Pending)</label>
                  <SearchableSelect
                    name="allocationId"
                    required
                    placeholder="Choose stitcher / batch..."
                    value={selectedAllocationId ?? ""}
                    options={pendingAllocations.map(a => {
                      const accounted = (a.quantityReceived || 0) + (a.quantityRejected || 0);
                      const max = a.workType === "outsource_required" ? (a.outsourceReturned || 0) : a.quantityIssued;
                      const pending = Math.max(0, max - accounted);
                      return {
                        value: a.id,
                        label: `${a.stitcherName} — Batch ${a.batchNumber} (${pending} pending)${a.workType === "outsource_required" ? " ⬡" : ""}`,
                        searchText: `${a.stitcherName} ${a.batchNumber} ${a.allocationNumber || ""}`,
                      };
                    })}
                    onChange={(val) => {
                      setSelectedAllocationId(Number(val) || null);
                      setQtyReceived(0); setQtyRejected(0); setQtyDamaged(0);
                    }}
                  />
                  {pendingAllocations.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      All allocations are fully received.
                    </p>
                  )}
                </div>

                {selectedAlloc && (
                  <div className="space-y-2">
                    {isOutsource && (
                      <div className="bg-violet-50 rounded-xl border border-violet-200 px-4 py-2 flex items-center gap-2 text-xs text-violet-700">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>Outsource allocation ({selectedAlloc.outsourceCategory?.replace(/_/g, " ")}). Only returned-from-outsource pieces ({outsourceReturned}) can be received.</span>
                      </div>
                    )}
                    <div className={`rounded-xl border px-4 py-3 grid gap-2 text-center ${isOutsource ? "grid-cols-4 bg-violet-50/40 border-violet-100" : "grid-cols-3 bg-background border-border"}`}>
                      <div>
                        <div className="text-lg font-bold text-foreground">{selectedAlloc.quantityIssued}</div>
                        <div className="text-xs text-muted-foreground">Issued</div>
                      </div>
                      {isOutsource && (
                        <div>
                          <div className="text-lg font-bold text-violet-600">{outsourceReturned}</div>
                          <div className="text-xs text-violet-500">From Outsource</div>
                        </div>
                      )}
                      <div>
                        <div className="text-lg font-bold text-emerald-600">{selectedAlloc.quantityReceived || 0}</div>
                        <div className="text-xs text-muted-foreground">Received</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-amber-600">{pendingQty}</div>
                        <div className="text-xs text-muted-foreground">Can Receive</div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-sm font-medium block mb-1.5">Good Qty Received</label>
                    <input
                      type="number"
                      name="quantityReceived"
                      className="form-input-styled border-emerald-300 bg-emerald-500/10"
                      required
                      min={0}
                      max={selectedAlloc ? pendingQty : undefined}
                      value={qtyReceived || ""}
                      onChange={e => setQtyReceived(Number(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-sm font-medium block mb-1.5">Receive Date</label>
                    <input type="date" name="receiveDate" className="form-input-styled" required defaultValue={new Date().toISOString().split('T')[0]} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                  <div>
                    <label className="text-sm font-medium block mb-1.5 text-muted-foreground">Rejected (Fixable)</label>
                    <input
                      type="number"
                      name="quantityRejected"
                      className="form-input-styled"
                      defaultValue="0"
                      min={0}
                      value={qtyRejected || ""}
                      onChange={e => setQtyRejected(Number(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5 text-muted-foreground">Damaged (Loss)</label>
                    <input
                      type="number"
                      name="quantityDamaged"
                      className="form-input-styled"
                      defaultValue="0"
                      min={0}
                      value={qtyDamaged || ""}
                      onChange={e => setQtyDamaged(Number(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                </div>

                {selectedAlloc && thisEntryTotal > 0 && (
                  <div className={`rounded-xl px-4 py-2.5 border text-sm flex items-center gap-2 ${formError ? "bg-red-500/10 border-red-500/20 text-red-700" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-700"}`}>
                    {formError ? <AlertCircle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
                    {formError || `This entry accounts for ${thisEntryTotal} of ${pendingQty} pending. ${pendingQty - thisEntryTotal} will remain.`}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                  <label className="col-span-2 text-sm font-medium text-foreground">Quality Checks</label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" name="hasStain" className="rounded border-border text-red-500 focus:ring-red-500" />
                    <span className="text-muted-foreground">Has Stain</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" name="hasDamage" className="rounded border-border text-orange-500 focus:ring-orange-500" />
                    <span className="text-muted-foreground">Has Damage</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" name="needsWash" className="rounded border-border text-primary focus:ring-primary" />
                    <span className="text-muted-foreground">Needs Wash</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" name="needsRework" className="rounded border-border text-amber-500 focus:ring-amber-500" />
                    <span className="text-muted-foreground">Needs Rework</span>
                  </label>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1.5">Remarks / Quality Notes</label>
                  <input name="remarks" className="form-input-styled" placeholder="Notes on quality or stitching issues..." />
                </div>

                <div className="mt-2">
                  <Button
                    type="submit"
                    disabled={isPending || !!formError || thisEntryTotal <= 0}
                    className="w-full h-12 rounded-xl text-base shadow-lg shadow-primary/20"
                  >
                    {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Log Receipt"}
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
                <TableHead className="py-4">Batch / Allocation</TableHead>
                <TableHead>Item Code</TableHead>
                <TableHead>Stitcher</TableHead>
                <TableHead className="text-right">Issued</TableHead>
                <TableHead className="text-right">Good Rcvd</TableHead>
                <TableHead className="text-right">Rej / Dmg</TableHead>
                <TableHead>Quality</TableHead>
                <TableHead>Receive Date</TableHead>
                {canEdit && <TableHead className="w-16"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={canEdit ? 9 : 8} className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : (
                data?.map(rec => (
                  <TableRow key={rec.id} className="group hover:bg-background/50">
                    <TableCell>
                      <div className="font-semibold text-primary text-sm">{rec.batchNumber}</div>
                      <div className="text-xs text-muted-foreground font-mono">{rec.allocationNumber}</div>
                      <div className="text-xs text-muted-foreground">{fmtCode(rec.productCode, rec.productName)}</div>
                      {(() => {
                        const pf = (rec as any).productionFor || "reesha_stock";
                        if (pf === "purchase_order") return <span className="inline-flex items-center mt-0.5 px-1.5 py-0 rounded text-[10px] font-medium bg-violet-50 text-violet-600 border border-violet-200">PO: {(rec as any).poNumber || "?"}</span>;
                        if (pf === "order") return <span className="inline-flex items-center mt-0.5 px-1.5 py-0 rounded text-[10px] font-medium bg-orange-500/10 text-orange-600 border border-orange-500/20">Order: {(rec as any).orderNumber || "?"}</span>;
                        return null;
                      })()}
                    </TableCell>
                    <TableCell>
                      {(rec as any).itemCode
                        ? <span className="font-mono text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">{(rec as any).itemCode}</span>
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-foreground text-sm">{rec.stitcherName}</div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">{rec.quantityIssued ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold text-emerald-600 text-base">{rec.quantityReceived}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      {((rec.quantityDamaged || 0) + (rec.quantityRejected || 0)) > 0 ? (
                        <div className="flex flex-col items-end gap-0.5">
                          {(rec.quantityRejected || 0) > 0 && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">R: {rec.quantityRejected}</span>}
                          {(rec.quantityDamaged || 0) > 0 && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">D: {rec.quantityDamaged}</span>}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(rec as any).hasStain && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-600 border border-red-500/20">Stain</span>}
                        {(rec as any).hasDamage && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-500/10 text-orange-600 border border-orange-500/20">Damage</span>}
                        {(rec as any).needsWash && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">Wash</span>}
                        {(rec as any).needsRework && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20">Rework</span>}
                        {!(rec as any).hasStain && !(rec as any).hasDamage && !(rec as any).needsWash && !(rec as any).needsRework && <span className="text-xs text-muted-foreground">OK</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {rec.receiveDate ? format(new Date(rec.receiveDate), 'MMM d, yyyy') : '-'}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => { setEditTarget(rec); setEditOpen(true); }}
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
              {!isLoading && data?.length === 0 && (
                <TableRow><TableCell colSpan={canEdit ? 9 : 8} className="text-center py-12 text-muted-foreground">No receivings logged yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl p-6 border-0 shadow-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Edit Receipt</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <form onSubmit={onEditSubmit} className="grid grid-cols-1 gap-4 pt-4">
              <div className="bg-background rounded-xl p-3 text-sm text-muted-foreground">
                <div className="font-semibold text-foreground">{editTarget.batchNumber}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{editTarget.stitcherName} · {editTarget.quantityReceived} pcs received</div>
              </div>
              {(editTarget as any).isLocked && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2 text-xs text-amber-700 flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Finishing records exist for this batch. Quantities cannot be changed.
                </div>
              )}
              <div>
                <label className="text-sm font-medium block mb-1.5">Receive Date</label>
                <input type="date" name="receiveDate" className="form-input-styled" required defaultValue={editTarget.receiveDate?.split('T')[0] || ""} />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                <label className="col-span-2 text-sm font-medium text-foreground">Quality Checks</label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" name="hasStain" className="rounded border-border text-red-500 focus:ring-red-500" defaultChecked={!!(editTarget as any).hasStain} />
                  <span className="text-muted-foreground">Has Stain</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" name="hasDamage" className="rounded border-border text-orange-500 focus:ring-orange-500" defaultChecked={!!(editTarget as any).hasDamage} />
                  <span className="text-muted-foreground">Has Damage</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" name="needsWash" className="rounded border-border text-primary focus:ring-primary" defaultChecked={!!(editTarget as any).needsWash} />
                  <span className="text-muted-foreground">Needs Wash</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" name="needsRework" className="rounded border-border text-amber-500 focus:ring-amber-500" defaultChecked={!!(editTarget as any).needsRework} />
                  <span className="text-muted-foreground">Needs Rework</span>
                </label>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Remarks</label>
                <input name="remarks" className="form-input-styled" defaultValue={editTarget.remarks || ""} placeholder="Quality notes..." />
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
