import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, Inbox, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  useListReceivings, useCreateReceiving, getListReceivingsQueryKey,
  useListAllocations, getListAllocationsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fmtCode } from "@/lib/utils";

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
  const { data, isLoading } = useListReceivings();
  const { data: allocations } = useListAllocations();

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedAllocationId, setSelectedAllocationId] = useState<number | null>(null);
  const [qtyReceived, setQtyReceived] = useState(0);
  const [qtyRejected, setQtyRejected] = useState(0);
  const [qtyDamaged, setQtyDamaged] = useState(0);
  const [formError, setFormError] = useState("");

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

  function resetForm() {
    setSelectedAllocationId(null);
    setQtyReceived(0);
    setQtyRejected(0);
    setQtyDamaged(0);
    setFormError("");
  }

  // The selected allocation's details
  const selectedAlloc = allocations?.find(a => a.id === selectedAllocationId) ?? null;
  const pendingQty = selectedAlloc
    ? (selectedAlloc.quantityPending ?? selectedAlloc.quantityIssued - (selectedAlloc.quantityReceived || 0) - (selectedAlloc.quantityRejected || 0))
    : 0;
  const thisEntryTotal = qtyReceived + qtyRejected + qtyDamaged;

  // Real-time validation feedback
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
      }
    });
  };

  // Show allocations that still have pending quantity
  const pendingAllocations = allocations?.filter(a => {
    const p = a.quantityPending ?? (a.quantityIssued - (a.quantityReceived || 0) - (a.quantityRejected || 0));
    return p > 0;
  }) || [];

  return (
    <AppLayout title="Receiving from Stitchers">
      <Card className="shadow-lg border-slate-200 rounded-2xl overflow-hidden">
        <CardHeader className="bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between py-5 px-6 gap-4">
          <div>
            <CardTitle className="text-xl font-display text-slate-800 flex items-center gap-2">
              <Inbox className="h-5 w-5 text-primary" />
              Receive from Stitchers
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">Log pieces received back. Supports partial receiving — enter as many receipts as needed.</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
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
                      const pending = a.quantityPending ?? (a.quantityIssued - (a.quantityReceived || 0) - (a.quantityRejected || 0));
                      return (
                        <option key={a.id} value={a.id}>
                          {a.stitcherName} — Batch {a.batchNumber} ({pending} pending)
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

                {/* Live pending info when allocation selected */}
                {selectedAlloc && (
                  <div className="bg-slate-50 rounded-xl border border-slate-100 px-4 py-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-lg font-bold text-slate-800">{selectedAlloc.quantityIssued}</div>
                      <div className="text-xs text-slate-500">Issued</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-emerald-600">{selectedAlloc.quantityReceived || 0}</div>
                      <div className="text-xs text-slate-500">Received</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-amber-600">{pendingQty}</div>
                      <div className="text-xs text-slate-500">Still Pending</div>
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

                {/* Live totals row */}
                {selectedAlloc && thisEntryTotal > 0 && (
                  <div className={`rounded-xl px-4 py-2.5 border text-sm flex items-center gap-2 ${formError ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
                    {formError ? <AlertCircle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
                    {formError || `This entry accounts for ${thisEntryTotal} of ${pendingQty} pending. ${pendingQty - thisEntryTotal} will remain.`}
                  </div>
                )}

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
          </Dialog>
        </CardHeader>

        <CardContent className="p-0 bg-white">
          <Table>
            <TableHeader className="bg-slate-50 border-b border-slate-100">
              <TableRow>
                <TableHead className="py-4">Batch / Allocation</TableHead>
                <TableHead>Stitcher</TableHead>
                <TableHead className="text-right">Issued</TableHead>
                <TableHead className="text-right">Good Rcvd</TableHead>
                <TableHead className="text-right">Rej / Dmg</TableHead>
                <TableHead>Receive Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-300" /></TableCell></TableRow>
              ) : (
                data?.map(rec => (
                  <TableRow key={rec.id} className="group hover:bg-slate-50/50">
                    <TableCell>
                      <div className="font-semibold text-primary text-sm">{rec.batchNumber}</div>
                      <div className="text-xs text-slate-400 font-mono">{rec.allocationNumber}</div>
                      <div className="text-xs text-slate-500">{fmtCode(rec.productCode, rec.productName)}</div>
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
                    <TableCell className="text-slate-600 text-sm">
                      {rec.receiveDate ? format(new Date(rec.receiveDate), 'MMM d, yyyy') : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
              {!isLoading && data?.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500">No receivings logged yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
