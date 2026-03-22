import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertCircle, Plus, Loader2, Scissors, Pencil } from "lucide-react";
import { 
  useListCuttingBatches, useCreateCuttingBatch, getListCuttingBatchesQueryKey,
  useListProducts, useListSizes, useListColors, useListFabricRolls,
  useListMaterials,
  useUpdateCuttingBatch
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fmtCode } from "@/lib/utils";
import { useAppAuth } from "@/lib/auth-context";

function BatchStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    cutting:            { label: "Cutting",        cls: "bg-blue-50 text-blue-700 border-blue-200" },
    allocated:          { label: "Allocated",      cls: "bg-amber-50 text-amber-700 border-amber-200" },
    allocation:         { label: "Allocated",      cls: "bg-amber-50 text-amber-700 border-amber-200" },
    partially_received: { label: "Partial Recv",   cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    stitching:          { label: "Partial Recv",   cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    fully_received:     { label: "Fully Received", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    in_finishing:       { label: "In Finishing",   cls: "bg-purple-50 text-purple-700 border-purple-200" },
    finishing:          { label: "In Finishing",   cls: "bg-purple-50 text-purple-700 border-purple-200" },
    finished:           { label: "Finished",       cls: "bg-slate-100 text-slate-600 border-slate-200" },
    partial:            { label: "Partial Recv",   cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    completed:          { label: "Completed",      cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  };
  const { label, cls } = map[status] || { label: status, cls: "bg-slate-100 text-slate-500 border-slate-200" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{label}</span>;
}

export default function CuttingPage() {
  const { data, isLoading } = useListCuttingBatches();
  const { data: products } = useListProducts();
  const { data: sizes } = useListSizes();
  const { data: colors } = useListColors();
  const { data: rolls } = useListFabricRolls();
  const { data: materials } = useListMaterials();

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, can } = useAppAuth();
  const canCreate = can("cutting", "create");
  const canEdit = can("cutting", "edit");

  const [open, setOpen] = useState(false);
  const [batchNumber, setBatchNumber] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [selectedRollId, setSelectedRollId] = useState<number | null>(null);
  const [quantityUsed, setQuantityUsed] = useState("");

  const existingNumbers = new Set(
    (data ?? []).map((b) => b.batchNumber?.trim().toLowerCase())
  );
  const isDuplicate =
    batchNumber.trim().length > 0 &&
    existingNumbers.has(batchNumber.trim().toLowerCase());

  const { mutate, isPending } = useCreateCuttingBatch({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCuttingBatchesQueryKey() });
        setOpen(false);
        setBatchNumber("");
        toast({ title: "Cutting batch created successfully" });
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error || "Failed to create batch.";
        toast({ title: "Error", description: msg, variant: "destructive" });
      },
    },
  });

  const { mutate: updateBatch, isPending: isUpdating } = useUpdateCuttingBatch({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCuttingBatchesQueryKey() });
        setEditOpen(false);
        setEditTarget(null);
        toast({ title: "Cutting batch updated" });
      },
      onError: (e: any) => {
        toast({ title: "Error", description: e?.response?.data?.error || "Update failed", variant: "destructive" });
      }
    }
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isDuplicate) return;

    const fd = new FormData(e.currentTarget);
    const fabricRollId = Number(fd.get("fabricRollId"));
    const quantityUsed = Number(fd.get("quantityUsed"));

    const sizeId = Number(fd.get("sizeId"));
    const colorId = Number(fd.get("colorId"));

    if (!sizeId || !colorId) {
      alert("Size and Color are required");
      return;
    }

    const data: any = {
      batchNumber: batchNumber.trim(),
      materialId: Number(fd.get("materialId")) || undefined,
      material2Id: Number(fd.get("material2Id")) || undefined,
      sizeId,
      colorId,
      quantityCut: Number(fd.get("quantityCut")),
      cutter: fd.get("cutter") as string,
      cuttingDate: fd.get("cuttingDate") as string,
      remarks: fd.get("remarks") as string,
      fabricUsages: fabricRollId ? [{ fabricRollId, quantityUsed }] : [],
    };

    const productId = Number(fd.get("productId"));
    if (productId) {
      data.productId = productId;
    }

    mutate({ data });
  };

  const onEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editTarget) return;
    const fd = new FormData(e.currentTarget);
    updateBatch({
      id: editTarget.id,
      data: {
        cutter: fd.get("cutter") as string || undefined,
        cuttingDate: fd.get("cuttingDate") as string,
        remarks: fd.get("remarks") as string || undefined,
      }
    });
  };

  const availableRolls = rolls?.filter((r) => r.availableQuantity > 0) || [];
  const TOLERANCE = 0.5;
  const selectedRoll = availableRolls.find(r => r.id === selectedRollId);
  const qtyUsedNum = parseFloat(quantityUsed) || 0;
  const exceedsTolerance = selectedRoll && qtyUsedNum > Number(selectedRoll.availableQuantity) + TOLERANCE;
  const withinTolerance = selectedRoll && qtyUsedNum > Number(selectedRoll.availableQuantity) && qtyUsedNum <= Number(selectedRoll.availableQuantity) + TOLERANCE;

  return (
    <AppLayout title="Cutting Department">
      <Card className="shadow-lg border-slate-200 rounded-2xl overflow-hidden">
        <CardHeader className="bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between py-5 px-6 gap-4">
          <div>
            <CardTitle className="text-xl font-display text-slate-800 flex items-center gap-2">
              <Scissors className="h-5 w-5 text-primary" />
              Cutting Batches (WIP)
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">Manage fabric cutting and batch creation.</p>
          </div>
          {canCreate && <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setBatchNumber(""); setSelectedRollId(null); setQuantityUsed(""); } }}>
            <DialogTrigger asChild>
              <Button className="rounded-xl shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5">
                <Plus className="h-4 w-4 mr-2" /> Create Batch
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] rounded-2xl p-6 border-0 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
              <DialogHeader>
                <DialogTitle className="text-xl font-display">New Cutting Batch</DialogTitle>
              </DialogHeader>
              <form onSubmit={onSubmit} className="grid grid-cols-2 gap-5 pt-4">
                <div className="col-span-2">
                  <label className="text-sm font-medium block mb-1.5">
                    Batch Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="batchNumber"
                    className={`form-input-styled font-mono ${isDuplicate ? "border-red-400 bg-red-50" : ""}`}
                    placeholder="e.g. BT-001 or any unique identifier..."
                    required
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    autoComplete="off"
                  />
                  {isDuplicate && (
                    <div className="flex items-center gap-2 mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      Batch number <strong>"{batchNumber.trim()}"</strong> already exists. Please enter a unique batch number.
                    </div>
                  )}
                </div>

                <div className="col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                  <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wider">Product Selection</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-sm font-medium block mb-1.5">Design / Product <span className="text-xs text-slate-400 font-normal">(optional at cutting)</span></label>
                      <select name="productId" className="form-input-styled bg-white">
                        <option value="">— None —</option>
                        {products?.filter(p=>p.isActive).map(p => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-1">
                      <label className="text-sm font-medium block mb-1.5">Size <span className="text-red-500">*</span></label>
                      <select name="sizeId" className="form-input-styled bg-white" required>
                        <option value="">Select Size...</option>
                        {sizes?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-1">
                      <label className="text-sm font-medium block mb-1.5">Color <span className="text-red-500">*</span></label>
                      <select name="colorId" className="form-input-styled bg-white" required>
                        <option value="">Select Color...</option>
                        {colors?.map(c => <option key={c.id} value={c.id}>{c.code ? `${c.code} — ${c.name}` : c.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="col-span-2 bg-teal-50/50 p-4 rounded-xl border border-teal-100 space-y-4">
                  <div>
                    <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wider">Materials (for Item Code)</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Item Code = Product Code – Color Code – Material 1 – Material 2</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium block mb-1.5">Material 1</label>
                      <select name="materialId" className="form-input-styled bg-white">
                        <option value="">— None —</option>
                        {materials?.filter((m: any) => m.isActive).map((m: any) => (
                          <option key={m.id} value={m.id}>{fmtCode(m.code, m.name)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-1.5">Material 2</label>
                      <select name="material2Id" className="form-input-styled bg-white">
                        <option value="">— None —</option>
                        {materials?.filter((m: any) => m.isActive).map((m: any) => (
                          <option key={m.id} value={m.id}>{fmtCode(m.code, m.name)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="col-span-2 bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-4">
                  <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wider">Fabric Consumption</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="text-sm font-medium block mb-1.5">Select Fabric Roll</label>
                      <select
                        name="fabricRollId"
                        className="form-input-styled bg-white"
                        required
                        value={selectedRollId ?? ""}
                        onChange={e => setSelectedRollId(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">Select Roll...</option>
                        {availableRolls.map(r => (
                          <option key={r.id} value={r.id}>{r.rollNumber} ({r.fabricName}) - {r.availableQuantity} {r.unit} left</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-1">
                      <label className="text-sm font-medium block mb-1.5">Qty Used</label>
                      <input
                        type="number"
                        step="0.1"
                        name="quantityUsed"
                        className={`form-input-styled ${exceedsTolerance ? "border-red-400 bg-red-50" : withinTolerance ? "border-amber-400 bg-amber-50" : ""}`}
                        required
                        placeholder="0.0"
                        value={quantityUsed}
                        onChange={e => setQuantityUsed(e.target.value)}
                      />
                    </div>
                  </div>
                  {selectedRoll && (
                    <div className="text-sm text-slate-600 bg-white rounded-lg px-3 py-2 border border-slate-200">
                      Available: <strong>{selectedRoll.availableQuantity} {selectedRoll.unit}</strong>
                      <span className="text-slate-400 ml-2">(tolerance: +{TOLERANCE})</span>
                    </div>
                  )}
                  {withinTolerance && (
                    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      Quantity exceeds available stock but is within the {TOLERANCE} tolerance. This will be allowed.
                    </div>
                  )}
                  {exceedsTolerance && (
                    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      Quantity exceeds available stock by more than {TOLERANCE}. Cannot proceed.
                    </div>
                  )}
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="text-sm font-medium block mb-1.5">Pieces Cut (Output)</label>
                  <input type="number" name="quantityCut" className="form-input-styled border-primary/30 bg-primary/5" required placeholder="0" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-sm font-medium block mb-1.5">Cutting Date</label>
                  <input type="date" name="cuttingDate" className="form-input-styled" required defaultValue={new Date().toISOString().split('T')[0]} />
                </div>
                
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-sm font-medium block mb-1.5">Cutter Name / Master</label>
                  <input name="cutter" className="form-input-styled" placeholder="Name..." />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-sm font-medium block mb-1.5">Remarks</label>
                  <input name="remarks" className="form-input-styled" placeholder="Notes..." />
                </div>
                
                <div className="col-span-2 mt-4">
                  <Button
                    type="submit"
                    disabled={isPending || isDuplicate || !!exceedsTolerance}
                    className="w-full h-12 rounded-xl text-base shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPending ? "Creating Batch..." : "Create Cutting Batch"}
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
                <TableHead className="py-4">Batch Number</TableHead>
                <TableHead>Product / Specs</TableHead>
                <TableHead>Item Code</TableHead>
                <TableHead className="text-right">Qty Cut</TableHead>
                <TableHead className="text-right">Available for Alloc.</TableHead>
                <TableHead>Date & Cutter</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead className="w-16"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={canEdit ? 8 : 7} className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-300" /></TableCell></TableRow> :
                data?.map(batch => (
                  <TableRow key={batch.id} className="group">
                    <TableCell className="font-mono text-primary font-bold">{batch.batchNumber}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{fmtCode(batch.productCode, batch.productName)}</div>
                      <div className="text-xs text-slate-500 flex gap-2 mt-0.5">
                        {batch.sizeName && <span className="bg-slate-100 px-1.5 rounded">{batch.sizeName}</span>}
                        {batch.colorName && <span className="bg-slate-100 px-1.5 rounded">{fmtCode(batch.colorCode, batch.colorName)}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {batch.itemCode
                        ? <span className="font-mono text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">{batch.itemCode}</span>
                        : <span className="text-xs text-slate-400">—</span>}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-lg">{batch.quantityCut}</TableCell>
                    <TableCell className="text-right">
                      <span className={`font-bold ${batch.availableForAllocation! > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {batch.availableForAllocation}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-900">{batch.cuttingDate ? format(new Date(batch.cuttingDate), 'MMM d, yyyy') : '-'}</div>
                      <div className="text-xs text-slate-500">{batch.cutter || '-'}</div>
                    </TableCell>
                    <TableCell>
                      <BatchStatusBadge status={batch.status || "cutting"} />
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => { setEditTarget(batch); setEditOpen(true); }}
                        >
                          <Pencil className="h-3.5 w-3.5 text-slate-500" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              }
              {data?.length === 0 && (
                <TableRow><TableCell colSpan={canEdit ? 8 : 7} className="text-center py-12 text-slate-500">No cutting batches found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl p-6 border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Edit Cutting Batch</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <form onSubmit={onEditSubmit} className="grid grid-cols-2 gap-4 pt-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="text-sm font-medium block mb-1.5">Cutter Name</label>
                <input name="cutter" className="form-input-styled" defaultValue={editTarget.cutter || ""} placeholder="Name..." />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-sm font-medium block mb-1.5">Cutting Date</label>
                <input type="date" name="cuttingDate" className="form-input-styled" required defaultValue={editTarget.cuttingDate?.split('T')[0] || ""} />
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
    </AppLayout>
  );
}
