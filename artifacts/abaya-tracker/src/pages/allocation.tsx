import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, Send, Info } from "lucide-react";
import {
  useListAllocations, useCreateAllocation, getListAllocationsQueryKey,
  useListCuttingBatches, useListStitchers
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

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
  const { data, isLoading } = useListAllocations();
  const { data: batches } = useListCuttingBatches();
  const { data: stitchers } = useListStitchers();

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);

  const { mutate, isPending } = useCreateAllocation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAllocationsQueryKey() });
        setOpen(false);
        setSelectedBatch(null);
        toast({ title: "Allocation created successfully" });
      },
      onError: (e: any) => {
        toast({ title: "Error", description: e.message || "Failed to allocate", variant: "destructive" });
      }
    }
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    mutate({
      data: {
        cuttingBatchId: Number(fd.get("cuttingBatchId")),
        stitcherId: Number(fd.get("stitcherId")),
        quantityIssued: Number(fd.get("quantityIssued")),
        issueDate: fd.get("issueDate") as string,
        remarks: fd.get("remarks") as string,
      }
    });
  };

  const availableBatches = batches?.filter(b => (b.availableForAllocation || 0) > 0) || [];

  return (
    <AppLayout title="Allocation to Stitchers">
      <Card className="shadow-lg border-slate-200 rounded-2xl overflow-hidden">
        <CardHeader className="bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between py-5 px-6 gap-4">
          <div>
            <CardTitle className="text-xl font-display text-slate-800 flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Stitcher Allocations
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">Issue cut pieces to stitchers. Receiving is done in the Receiving module.</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSelectedBatch(null); }}>
            <DialogTrigger asChild>
              <Button className="rounded-xl shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5">
                <Plus className="h-4 w-4 mr-2" /> Issue Batch
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-2xl p-6 border-0 shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-display">Allocate Pieces to Stitcher</DialogTitle>
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
                        {b.batchNumber} — {b.productName} ({b.availableForAllocation} pcs available)
                      </option>
                    ))}
                  </select>
                  {selectedBatch && (
                    <div className="mt-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 flex items-start gap-2">
                      <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                      <div className="text-xs text-blue-700 space-y-0.5">
                        <div><strong>Total Cut:</strong> {selectedBatch.totalCutQuantity} pcs &nbsp;|&nbsp; <strong>Available:</strong> {selectedBatch.availableForAllocation} pcs</div>
                        {selectedBatch.sizeName && <div><strong>Size:</strong> {selectedBatch.sizeName} &nbsp;|&nbsp; <strong>Color:</strong> {selectedBatch.colorName}</div>}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1.5">Assign to Stitcher</label>
                  <select name="stitcherId" className="form-input-styled bg-white" required>
                    <option value="">Select Stitcher...</option>
                    {stitchers?.filter(s => s.isActive).map(s => (
                      <option key={s.id} value={s.id}>{s.name}{s.teamName ? ` (${s.teamName})` : ''}</option>
                    ))}
                  </select>
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
                  <input name="remarks" className="form-input-styled" placeholder="Special instructions for stitcher..." />
                </div>

                <div className="mt-2 bg-slate-50 rounded-xl p-3 text-xs text-slate-500 flex items-start gap-2">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-400" />
                  <span>Receiving, rejection, and pending tracking are done in the <strong>Receiving</strong> module after stitching is complete.</span>
                </div>

                <div className="mt-2">
                  <Button type="submit" disabled={isPending} className="w-full h-12 rounded-xl text-base shadow-lg shadow-primary/20">
                    {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Allocating...</> : "Confirm Allocation"}
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
                <TableHead className="py-4">Alloc. #</TableHead>
                <TableHead>Batch / Product</TableHead>
                <TableHead>Stitcher</TableHead>
                <TableHead className="text-right">Issued</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issue Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-300" /></TableCell></TableRow>
              ) : (
                data?.map(alloc => {
                  const pending = alloc.quantityPending ?? (alloc.quantityIssued - (alloc.quantityReceived || 0) - (alloc.quantityRejected || 0));
                  return (
                    <TableRow key={alloc.id} className="group hover:bg-slate-50/50">
                      <TableCell className="font-mono text-xs text-slate-500 font-medium">{alloc.allocationNumber}</TableCell>
                      <TableCell>
                        <div className="font-semibold text-primary text-sm">{alloc.batchNumber}</div>
                        <div className="text-xs text-slate-500">{alloc.productName}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-slate-900 text-sm">{alloc.stitcherName}</div>
                        {alloc.teamName && <div className="text-xs text-slate-500">{alloc.teamName}</div>}
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
                          <span className="text-emerald-600 font-semibold">0 ✓</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={alloc.status || "pending"} />
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        {alloc.issueDate ? format(new Date(alloc.issueDate), 'MMM d, yyyy') : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
              {!isLoading && data?.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-slate-500">No allocations yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
