import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, Inbox, AlertCircle, CheckCircle2, Pencil } from "lucide-react";
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
    cutting:            { label: "Cutting",        cls: "bg-blue-50 text-blue-700 border-blue-200" },
    allocated:          { label: "Allocated",      cls: "bg-amber-50 text-amber-700 border-amber-200" },
    allocation:         { label: "Allocated",      cls: "bg-amber-50 text-amber-700 border-amber-200" },
    partially_received: { label: "Partial",        cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    stitching:          { label: "Partial",        cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    fully_received:     { label: "Fully Rcvd",     cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    in_finishing:       { label: "In Finishing",   cls: "bg-purple-50 text-purple-700 border-purple-200" },
    finished:           { label: "Finished",       cls: "bg-slate-100 text-slate-600 border-slate-200" },
    pending:            { label: "Pending",        cls: "bg-amber-50 text-amber-700 border-amber-200" },
    partial:            { label: "Partial",        cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    completed:          { label: "Completed",      cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  };
  const { label, cls } = map[status] || { label: status, cls: "bg-slate-100 text-slate-500 border-slate-200" };
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
    if (formError) return;
    const fd = new FormData(e.currentTarget);
    mutate({
      data: {
        allocationId: Number(fd.get("allocationId")),
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
      <Card className="shadow-lg border-slate-200 rounded-2xl overflow-hidden">
        <CardHeader className="bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between py-5 px-6 gap-4">
          <div>
            <CardTitle className="text-xl font-display text-slate-800 flex items-center gap-2">
              <Inbox className="h-5 w-5 text-primary" />
              Receive from Stitchers
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">Log pieces received back. Supports partial receiving — enter as many receipts as needed.</p>
          </div>
          {canCreate && <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="rounded-xl shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5">
                <Plus className="h-4 w-4 mr-2" /> Log Receipt
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px] rounded-2xl p-6 border-0 shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-display">Receive from Stitcher</DialogTitle>
              </DialogHeader>
              <form onSubmit={onSubmit} className="space-y-4 pt-4">

                <div>
                  <label className="text-sm font-medium block mb-1.5">Select Allocation (Pending)</label>
                  <select
                    name="allocationId"
                    className="form-input-styled bg-white"
                    required
                    onChange={e => {
                      setSelectedAllocationId(Number(e.target.value) || null);
                      setQtyReceived(0); setQtyRejected(0); setQtyDamaged(0);
                    }}
                  >
                    <option value="">Choose stitcher / batch...</option>
                    {pendingAllocations.map(a => {
                      const accounted = (a.quantityReceived || 0) + (a.quantityRejected || 0);
                      const max = a.workType === "outsource_required" ? (a.outsourceReturned || 0) : a.quantityIssued;
                      const pending = Math.max(0, max - accounted);
                      return (
                        <option key={a.id} value={a.id}>
                          {a.stitcherName} — Batch {a.batchNumber} ({pending} pending){a.workType === "outsource_required" ? " ⬡" : ""}
                        </option>
                      );
                    })}
                  </select>
                  {pendingAllocations.length === 0 && (
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
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
                    <div className={`rounded-xl border px-4 py-3 grid gap-2 text-center ${isOutsource ? "grid-cols-4 bg-violet-50/40 border-violet-100" : "grid-cols-3 bg-slate-50 border-slate-100"}`}>
                      <div>
                        <div className="text-lg font-bold text-slate-800">{selectedAlloc.quantityIssued}</div>
                        <div className="text-xs text-slate-500">Issued</div>
                      </div>
                      {isOutsource && (
                        <div>
                          <div className="text-lg font-bold text-violet-600">{outsourceReturned}</div>
                          <div className="text-xs text-violet-500">From Outsource</div>
                        </div>
                      )}
                      <div>
                        <div className="text-lg font-bold text-emerald-600">{selectedAlloc.quantityReceived || 0}</div>
                        <div className="text-xs text-slate-500">Received</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-amber-600">{pendingQty}</div>
                        <div className="text-xs text-slate-500">Can Receive</div>
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
                      className="form-input-styled border-emerald-300 bg-emerald-50"
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

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="text-sm font-medium block mb-1.5 text-slate-500">Rejected (Fixable)</label>
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
                    <label className="text-sm font-medium block mb-1.5 text-slate-500">Damaged (Loss)</label>
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
                  <div className={`rounded-xl px-4 py-2.5 border text-sm flex items-center gap-2 ${formError ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
                    {formError ? <AlertCircle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
                    {formError || `This entry accounts for ${thisEntryTotal} of ${pendingQty} pending. ${pendingQty - thisEntryTotal} will remain.`}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <label className="col-span-2 text-sm font-medium text-slate-700">Quality Checks</label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" name="hasStain" className="rounded border-slate-300 text-red-500 focus:ring-red-500" />
                    <span className="text-slate-600">Has Stain</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" name="hasDamage" className="rounded border-slate-300 text-orange-500 focus:ring-orange-500" />
                    <span className="text-slate-600">Has Damage</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" name="needsWash" className="rounded border-slate-300 text-blue-500 focus:ring-blue-500" />
                    <span className="text-slate-600">Needs Wash</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" name="needsRework" className="rounded border-slate-300 text-amber-500 focus:ring-amber-500" />
                    <span className="text-slate-600">Needs Rework</span>
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

        <CardContent className="p-0 bg-white">
          <Table>
            <TableHeader className="bg-slate-50 border-b border-slate-100">
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
                <TableRow><TableCell colSpan={canEdit ? 9 : 8} className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-300" /></TableCell></TableRow>
              ) : (
                data?.map(rec => (
                  <TableRow key={rec.id} className="group hover:bg-slate-50/50">
                    <TableCell>
                      <div className="font-semibold text-primary text-sm">{rec.batchNumber}</div>
                      <div className="text-xs text-slate-400 font-mono">{rec.allocationNumber}</div>
                      <div className="text-xs text-slate-500">{fmtCode(rec.productCode, rec.productName)}</div>
                      {(() => {
                        const pf = (rec as any).productionFor || "reesha_stock";
                        if (pf === "purchase_order") return <span className="inline-flex items-center mt-0.5 px-1.5 py-0 rounded text-[10px] font-medium bg-violet-50 text-violet-600 border border-violet-200">PO: {(rec as any).poNumber || "?"}</span>;
                        if (pf === "order") return <span className="inline-flex items-center mt-0.5 px-1.5 py-0 rounded text-[10px] font-medium bg-orange-50 text-orange-600 border border-orange-200">Order: {(rec as any).orderNumber || "?"}</span>;
                        return null;
                      })()}
                    </TableCell>
                    <TableCell>
                      {(rec as any).itemCode
                        ? <span className="font-mono text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">{(rec as any).itemCode}</span>
                        : <span className="text-xs text-slate-400">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900 text-sm">{rec.stitcherName}</div>
                    </TableCell>
                    <TableCell className="text-right text-slate-600 text-sm">{rec.quantityIssued ?? "—"}</TableCell>
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
                        <span className="text-slate-300 text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(rec as any).hasStain && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-600 border border-red-200">Stain</span>}
                        {(rec as any).hasDamage && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-50 text-orange-600 border border-orange-200">Damage</span>}
                        {(rec as any).needsWash && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-200">Wash</span>}
                        {(rec as any).needsRework && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-200">Rework</span>}
                        {!(rec as any).hasStain && !(rec as any).hasDamage && !(rec as any).needsWash && !(rec as any).needsRework && <span className="text-xs text-slate-300">OK</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm">
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
                          <Pencil className="h-3.5 w-3.5 text-slate-500" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
              {!isLoading && data?.length === 0 && (
                <TableRow><TableCell colSpan={canEdit ? 9 : 8} className="text-center py-12 text-slate-500">No receivings logged yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl p-6 border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Edit Receipt</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <form onSubmit={onEditSubmit} className="grid grid-cols-1 gap-4 pt-4">
              <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-600">
                <div className="font-semibold text-slate-800">{editTarget.batchNumber}</div>
                <div className="text-xs text-slate-500 mt-0.5">{editTarget.stitcherName} · {editTarget.quantityReceived} pcs received</div>
              </div>
              {(editTarget as any).isLocked && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-xs text-amber-700 flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Finishing records exist for this batch. Quantities cannot be changed.
                </div>
              )}
              <div>
                <label className="text-sm font-medium block mb-1.5">Receive Date</label>
                <input type="date" name="receiveDate" className="form-input-styled" required defaultValue={editTarget.receiveDate?.split('T')[0] || ""} />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <label className="col-span-2 text-sm font-medium text-slate-700">Quality Checks</label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" name="hasStain" className="rounded border-slate-300 text-red-500 focus:ring-red-500" defaultChecked={!!(editTarget as any).hasStain} />
                  <span className="text-slate-600">Has Stain</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" name="hasDamage" className="rounded border-slate-300 text-orange-500 focus:ring-orange-500" defaultChecked={!!(editTarget as any).hasDamage} />
                  <span className="text-slate-600">Has Damage</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" name="needsWash" className="rounded border-slate-300 text-blue-500 focus:ring-blue-500" defaultChecked={!!(editTarget as any).needsWash} />
                  <span className="text-slate-600">Needs Wash</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" name="needsRework" className="rounded border-slate-300 text-amber-500 focus:ring-amber-500" defaultChecked={!!(editTarget as any).needsRework} />
                  <span className="text-slate-600">Needs Rework</span>
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
