import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertCircle, Info, Plus, Loader2, Settings2 } from "lucide-react";
import {
  useListFinishingRecords,
  useCreateFinishingRecord,
  useGetFinishingBatchInfo,
  getListFinishingRecordsQueryKey,
  useListCuttingBatches,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function FinishingPage() {
  return (
    <AppLayout title="Finishing Department">
      <FinishingView />
    </AppLayout>
  );
}

function FinishingView() {
  const { data, isLoading } = useListFinishingRecords();
  const { data: batches } = useListCuttingBatches();

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [inputQty, setInputQty] = useState("");
  const [outputQty, setOutputQty] = useState("");
  const [defectiveQty, setDefectiveQty] = useState("0");

  const { data: batchInfo, isLoading: loadingInfo } = useGetFinishingBatchInfo(
    selectedBatchId!,
    { query: { enabled: !!selectedBatchId } }
  );

  const input = Number(inputQty) || 0;
  const output = Number(outputQty) || 0;
  const defective = Number(defectiveQty) || 0;
  const available = batchInfo?.availableForFinishing ?? 0;

  const qtyError: string | null =
    !selectedBatchId
      ? null
      : input > 0 && available === 0
      ? `No pieces available for this batch (all ${batchInfo?.totalReceived ?? 0} received pieces are already finished).`
      : input > 0 && input > available
      ? `Input (${input}) exceeds available pieces from Receiving (${available} available).`
      : input > 0 && output > input
      ? `Output (${output}) cannot exceed input (${input}).`
      : input > 0 && output + defective > input
      ? `Output (${output}) + Defective (${defective}) = ${output + defective} exceeds input (${input}).`
      : null;

  const resetForm = () => {
    setSelectedBatchId(null);
    setInputQty("");
    setOutputQty("");
    setDefectiveQty("0");
  };

  const { mutate, isPending } = useCreateFinishingRecord({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFinishingRecordsQueryKey() });
        setOpen(false);
        resetForm();
        toast({ title: "Finishing record saved" });
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error || "Failed to save finishing record.";
        toast({ title: "Validation Error", description: msg, variant: "destructive" });
      },
    },
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (qtyError || !selectedBatchId) return;
    const fd = new FormData(e.currentTarget);
    mutate({
      data: {
        cuttingBatchId: selectedBatchId,
        inputQuantity: input,
        outputQuantity: output,
        defectiveQuantity: defective,
        operator: fd.get("operator") as string,
        processDate: fd.get("processDate") as string,
        remarks: fd.get("remarks") as string,
      },
    });
  };

  return (
    <Card className="shadow-lg border-slate-200 rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
      <CardHeader className="bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between py-5 px-6 gap-4">
        <div>
          <CardTitle className="text-xl font-display text-slate-800 flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Finishing Records
          </CardTitle>
          <p className="text-sm text-slate-500 mt-1">Receiving → Finishing → Finished Goods</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="rounded-xl shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5">
              <Plus className="h-4 w-4 mr-2" /> Log Finishing
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px] rounded-2xl p-6 border-0 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-display">Log Finishing Output</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 pt-4">

              {/* Batch Selector */}
              <div>
                <label className="text-sm font-medium block mb-1.5">Batch</label>
                <select
                  name="cuttingBatchId"
                  className="form-input-styled bg-white"
                  required
                  value={selectedBatchId ?? ""}
                  onChange={(e) => {
                    setSelectedBatchId(e.target.value ? Number(e.target.value) : null);
                    setInputQty("");
                    setOutputQty("");
                    setDefectiveQty("0");
                  }}
                >
                  <option value="">Select Batch...</option>
                  {batches?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batchNumber} — {b.productName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Availability Panel */}
              {selectedBatchId && (
                <div className={`rounded-lg border px-4 py-3 text-sm ${
                  loadingInfo
                    ? "border-slate-200 bg-slate-50"
                    : available === 0
                    ? "border-red-200 bg-red-50"
                    : "border-emerald-200 bg-emerald-50"
                }`}>
                  {loadingInfo ? (
                    <div className="flex items-center gap-2 text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading batch info...
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <Info className={`h-4 w-4 mt-0.5 shrink-0 ${available === 0 ? "text-red-500" : "text-emerald-600"}`} />
                      <div className="space-y-0.5">
                        <div className="font-medium text-slate-700">
                          Availability from Receiving
                        </div>
                        <div className="text-slate-600">
                          Total Received: <strong>{batchInfo?.totalReceived ?? 0}</strong> pcs &nbsp;|&nbsp;
                          Already Finished: <strong>{batchInfo?.totalFinishingOutput ?? 0}</strong> pcs &nbsp;|&nbsp;
                          <span className={available === 0 ? "text-red-600 font-bold" : "text-emerald-700 font-bold"}>
                            Available: {available} pcs
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Quantities */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">
                    Input Qty
                    {available > 0 && <span className="text-xs text-slate-400 ml-1">(max {available})</span>}
                  </label>
                  <input
                    type="number" name="inputQuantity" min="1" max={available || undefined}
                    required placeholder="0"
                    className={`form-input-styled ${qtyError && input > available ? "border-red-400 bg-red-50" : ""}`}
                    value={inputQty}
                    onChange={(e) => setInputQty(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Output (Good) Qty</label>
                  <input
                    type="number" name="outputQuantity" min="0" required placeholder="0"
                    className={`form-input-styled ${
                      qtyError && (output > input)
                        ? "border-red-400 bg-red-50"
                        : "border-primary/30 bg-primary/5"
                    }`}
                    value={outputQty}
                    onChange={(e) => setOutputQty(e.target.value)}
                  />
                </div>
              </div>

              {/* Error Banner */}
              {qtyError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {qtyError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5 text-slate-500">Defective Qty</label>
                  <input
                    type="number" name="defectiveQuantity" min="0"
                    className="form-input-styled"
                    value={defectiveQty}
                    onChange={(e) => setDefectiveQty(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Process Date</label>
                  <input
                    type="date" name="processDate" className="form-input-styled" required
                    defaultValue={new Date().toISOString().split("T")[0]}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5">Operator / Team</label>
                <input name="operator" className="form-input-styled" placeholder="Who did this?" required />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5 text-slate-400">Remarks</label>
                <input name="remarks" className="form-input-styled" placeholder="Optional notes..." />
              </div>

              <div className="mt-2">
                <Button
                  type="submit"
                  disabled={isPending || !!qtyError || !selectedBatchId}
                  className="w-full h-12 rounded-xl text-base shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? "Saving..." : "Save Finishing Record"}
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
              <TableHead className="py-4">Batch / Product</TableHead>
              <TableHead className="text-right">Input</TableHead>
              <TableHead className="text-right text-emerald-600 font-semibold">Output</TableHead>
              <TableHead className="text-right text-red-500">Defective</TableHead>
              <TableHead className="text-right text-slate-400">Pending</TableHead>
              <TableHead>Operator</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-300" />
                </TableCell>
              </TableRow>
            ) : (
              data?.map((rec) => (
                <TableRow key={rec.id} className="hover:bg-slate-50/50">
                  <TableCell>
                    <div className="font-semibold text-primary">{rec.batchNumber}</div>
                    <div className="text-xs text-slate-500">{rec.productName}</div>
                  </TableCell>
                  <TableCell className="text-right text-slate-500 font-medium">{rec.inputQuantity}</TableCell>
                  <TableCell className="text-right font-bold text-emerald-600 text-lg">{rec.outputQuantity}</TableCell>
                  <TableCell className="text-right text-red-500 font-medium">{rec.defectiveQuantity || "—"}</TableCell>
                  <TableCell className="text-right text-slate-400 font-medium">
                    {Math.max(0, rec.inputQuantity - rec.outputQuantity - (rec.defectiveQuantity ?? 0))}
                  </TableCell>
                  <TableCell className="text-slate-700">{rec.operator}</TableCell>
                  <TableCell className="text-slate-600 text-sm">
                    {rec.processDate ? format(new Date(rec.processDate), "MMM d, yyyy") : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
            {!isLoading && data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                  No finishing records yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
