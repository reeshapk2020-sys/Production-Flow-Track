import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertCircle, Info, Plus, Loader2, Settings2, Pencil } from "lucide-react";
import { SearchableSelect } from "@/components/searchable-select";
import {
  useListFinishingRecords,
  useCreateFinishingRecord,
  useGetFinishingBatchInfo,
  getListFinishingRecordsQueryKey,
  useListCuttingBatches,
  useUpdateFinishingRecord,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fmtCode } from "@/lib/utils";
import { useAppAuth } from "@/lib/auth-context";
import { FilterBar } from "@/components/filter-bar";
import { useListProducts, useListColors } from "@workspace/api-client-react";

export default function FinishingPage() {
  return (
    <AppLayout title="Finishing Department">
      <FinishingView />
    </AppLayout>
  );
}

function FinishingView() {
  const [filters, setFilters] = useState<Record<string, string>>({ startDate: "", endDate: "", productId: "", colorId: "", batchNumber: "" });

  const filterParams: Record<string, any> = {};
  if (filters.startDate) filterParams.startDate = filters.startDate;
  if (filters.endDate) filterParams.endDate = filters.endDate;
  if (filters.productId) filterParams.productId = Number(filters.productId);
  if (filters.colorId) filterParams.colorId = Number(filters.colorId);
  if (filters.batchNumber) filterParams.batchNumber = filters.batchNumber;

  const { data, isLoading } = useListFinishingRecords(filterParams);
  const { data: batches } = useListCuttingBatches();
  const { data: products } = useListProducts();
  const { data: colors } = useListColors();

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, can } = useAppAuth();
  const canCreate = can("finishing", "create");
  const canEdit = can("finishing", "edit");

  const [open, setOpen] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [inputQty, setInputQty] = useState("");
  const [outputQty, setOutputQty] = useState("");
  const [defectiveQty, setDefectiveQty] = useState("0");
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);

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

  const { mutate: updateRecord, isPending: isUpdating } = useUpdateFinishingRecord({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFinishingRecordsQueryKey() });
        setEditOpen(false);
        setEditTarget(null);
        toast({ title: "Finishing record updated" });
      },
      onError: (e: any) => {
        toast({ title: "Error", description: e?.response?.data?.error || "Update failed", variant: "destructive" });
      }
    }
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

  const onEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editTarget) return;
    const fd = new FormData(e.currentTarget);
    const locked = !!(editTarget as any).isLocked;
    const payload: Record<string, any> = {
      operator: fd.get("operator") as string || undefined,
      processDate: fd.get("processDate") as string,
      remarks: fd.get("remarks") as string || undefined,
    };
    if (!locked) {
      const oq = fd.get("outputQuantity");
      const dq = fd.get("defectiveQuantity");
      if (oq !== null && oq !== "") payload.outputQuantity = Number(oq);
      if (dq !== null && dq !== "") payload.defectiveQuantity = Number(dq);
    }
    updateRecord({ id: editTarget.id, data: payload });
  };

  const finishingFilterFields = [
    { name: "batchNumber", label: "Batch Number", type: "text" as const, placeholder: "Search batch..." },
    { name: "startDate", label: "From Date", type: "date" as const },
    { name: "endDate", label: "To Date", type: "date" as const },
    { name: "productId", label: "Product", type: "select" as const, options: products?.filter((p: any) => p.isActive).map((p: any) => ({ value: p.id, label: `${p.code} - ${p.name}` })) || [] },
    { name: "colorId", label: "Color", type: "select" as const, options: colors?.filter((c: any) => c.isActive).map((c: any) => ({ value: c.id, label: `${c.code} - ${c.name}` })) || [] },
  ];

  return (
    <>
    <FilterBar fields={finishingFilterFields} values={filters} onChange={setFilters} />
    <Card className="shadow-lg border-border rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
      <CardHeader className="bg-card border-b border-border flex flex-col sm:flex-row sm:items-center justify-between py-5 px-6 gap-4">
        <div>
          <CardTitle className="text-xl font-display text-foreground flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Finishing Records
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Receiving → Finishing → Finished Goods</p>
        </div>
        {canCreate && <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="rounded-xl shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5">
              <Plus className="h-4 w-4 mr-2" /> Log Finishing
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px] rounded-2xl p-6 border-0 shadow-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-display">Log Finishing Output</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 pt-4">

              <div>
                <label className="text-sm font-medium block mb-1.5">Batch</label>
                <SearchableSelect
                  name="cuttingBatchId"
                  required
                  placeholder="Select Batch..."
                  value={selectedBatchId ?? ""}
                  options={(batches || []).map((b: any) => ({
                    value: b.id,
                    label: `${b.batchNumber} — ${fmtCode(b.productCode, b.productName)}`,
                    searchText: `${b.batchNumber} ${b.productCode} ${b.productName} ${b.itemCode || ""}`,
                  }))}
                  onChange={(val) => {
                    setSelectedBatchId(val ? Number(val) : null);
                    setInputQty("");
                    setOutputQty("");
                    setDefectiveQty("0");
                  }}
                />
              </div>

              {selectedBatchId && (
                <div className={`rounded-lg border px-4 py-3 text-sm ${
                  loadingInfo
                    ? "border-border bg-background"
                    : available === 0
                    ? "border-red-500/20 bg-red-500/10"
                    : "border-emerald-500/20 bg-emerald-500/10"
                }`}>
                  {loadingInfo ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading batch info...
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <Info className={`h-4 w-4 mt-0.5 shrink-0 ${available === 0 ? "text-red-500" : "text-emerald-600"}`} />
                      <div className="space-y-0.5">
                        <div className="font-medium text-foreground">Availability from Receiving</div>
                        <div className="text-muted-foreground">
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">
                    Input Qty
                    {available > 0 && <span className="text-xs text-muted-foreground ml-1">(max {available})</span>}
                  </label>
                  <input
                    type="number" name="inputQuantity" min="1" max={available || undefined}
                    required placeholder="0"
                    className={`form-input-styled ${qtyError && input > available ? "border-red-500/40 bg-red-500/10" : ""}`}
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
                        ? "border-red-500/40 bg-red-500/10"
                        : "border-primary/30 bg-primary/5"
                    }`}
                    value={outputQty}
                    onChange={(e) => setOutputQty(e.target.value)}
                  />
                </div>
              </div>

              {qtyError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {qtyError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5 text-muted-foreground">Defective Qty</label>
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
                <label className="text-sm font-medium block mb-1.5 text-muted-foreground">Remarks</label>
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
        </Dialog>}
      </CardHeader>

      <CardContent className="p-0 bg-card">
        <Table>
          <TableHeader className="bg-background border-b border-border">
            <TableRow>
              <TableHead className="py-4">Batch / Product</TableHead>
              <TableHead>Item Code</TableHead>
              <TableHead className="text-right">Input</TableHead>
              <TableHead className="text-right text-emerald-600 font-semibold">Output</TableHead>
              <TableHead className="text-right text-red-500">Defective</TableHead>
              <TableHead className="text-right text-muted-foreground">Pending</TableHead>
              <TableHead>Operator</TableHead>
              <TableHead>Date</TableHead>
              {canEdit && <TableHead className="w-16"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 9 : 8} className="text-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : (
              data?.map((rec) => (
                <TableRow key={rec.id} className="group hover:bg-background/50">
                  <TableCell>
                    <div className="font-semibold text-primary">{rec.batchNumber}</div>
                    <div className="text-xs text-muted-foreground">{fmtCode(rec.productCode, rec.productName)}</div>
                  </TableCell>
                  <TableCell>
                    {(rec as any).itemCode
                      ? <span className="font-mono text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">{(rec as any).itemCode}</span>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground font-medium">{rec.inputQuantity}</TableCell>
                  <TableCell className="text-right font-bold text-emerald-600 text-lg">{rec.outputQuantity}</TableCell>
                  <TableCell className="text-right text-red-500 font-medium">{rec.defectiveQuantity || "—"}</TableCell>
                  <TableCell className="text-right text-muted-foreground font-medium">
                    {Math.max(0, rec.inputQuantity - rec.outputQuantity - (rec.defectiveQuantity ?? 0))}
                  </TableCell>
                  <TableCell className="text-foreground">{rec.operator}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {rec.processDate ? format(new Date(rec.processDate), "MMM d, yyyy") : "—"}
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
              <TableRow>
                <TableCell colSpan={canEdit ? 9 : 8} className="text-center py-12 text-muted-foreground">
                  No finishing records yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl p-6 border-0 shadow-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Edit Finishing Record</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <form onSubmit={onEditSubmit} className="grid grid-cols-2 gap-4 pt-4">
              <div className="col-span-2 bg-background rounded-xl p-3 text-sm text-muted-foreground">
                <div className="font-semibold text-foreground">{editTarget.batchNumber}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Input: {editTarget.inputQuantity} · Output: {editTarget.outputQuantity}</div>
              </div>
              {(editTarget as any).isLocked && (
                <div className="col-span-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2 text-xs text-amber-700 flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Finished goods exist for this batch. Quantities cannot be changed.
                </div>
              )}
              <div className="col-span-2 sm:col-span-1">
                <label className="text-sm font-medium block mb-1.5">Output Quantity</label>
                <input type="number" name="outputQuantity" className="form-input-styled" min="0" defaultValue={editTarget.outputQuantity ?? ""} disabled={!!(editTarget as any).isLocked} />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-sm font-medium block mb-1.5">Defective Quantity</label>
                <input type="number" name="defectiveQuantity" className="form-input-styled" min="0" defaultValue={editTarget.defectiveQuantity ?? ""} disabled={!!(editTarget as any).isLocked} />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-sm font-medium block mb-1.5">Operator / Team</label>
                <input name="operator" className="form-input-styled" defaultValue={editTarget.operator || ""} placeholder="Name..." />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-sm font-medium block mb-1.5">Process Date</label>
                <input type="date" name="processDate" className="form-input-styled" required defaultValue={editTarget.processDate?.split('T')[0] || ""} />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium block mb-1.5">Remarks</label>
                <input name="remarks" className="form-input-styled" defaultValue={editTarget.remarks || ""} placeholder="Notes..." />
              </div>
              <div className="col-span-2 mt-2">
                <Button type="submit" disabled={isUpdating} className="w-full h-11 rounded-xl">
                  {isUpdating ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
    </>
  );
}
