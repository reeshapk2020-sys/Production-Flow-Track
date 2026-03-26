import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertCircle, Plus, Loader2, Scissors, Pencil, Upload } from "lucide-react";
import { ImportDialog } from "@/components/import-dialog";
import { 
  useListCuttingBatches, useCreateCuttingBatch, getListCuttingBatchesQueryKey,
  useListProducts, useListSizes, useListColors, useListFabricRolls,
  useListMaterials,
  useUpdateCuttingBatch,
  useListPurchaseOrders,
  useListOrders,
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
    returned:           { label: "Returned",       cls: "bg-orange-500/10 text-orange-700 border-orange-500/20" },
    partially_received: { label: "Partial Recv",   cls: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20" },
    stitching:          { label: "Partial Recv",   cls: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20" },
    fully_received:     { label: "Fully Received", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
    in_finishing:       { label: "In Finishing",   cls: "bg-purple-500/10 text-purple-700 border-purple-500/20" },
    finishing:          { label: "In Finishing",   cls: "bg-purple-500/10 text-purple-700 border-purple-500/20" },
    finished:           { label: "Finished",       cls: "bg-muted text-muted-foreground border-border" },
    partial:            { label: "Partial Recv",   cls: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20" },
    completed:          { label: "Completed",      cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  };
  const { label, cls } = map[status] || { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{label}</span>;
}

export default function CuttingPage() {
  const [filters, setFilters] = useState<Record<string, string>>({
    startDate: "", endDate: "", productId: "", colorId: "", sizeId: "", batchNumber: ""
  });

  const filterParams: Record<string, any> = {};
  if (filters.startDate) filterParams.startDate = filters.startDate;
  if (filters.endDate) filterParams.endDate = filters.endDate;
  if (filters.productId) filterParams.productId = Number(filters.productId);
  if (filters.colorId) filterParams.colorId = Number(filters.colorId);
  if (filters.sizeId) filterParams.sizeId = Number(filters.sizeId);
  if (filters.batchNumber) filterParams.batchNumber = filters.batchNumber;

  const { data, isLoading } = useListCuttingBatches(filterParams);
  const { data: products } = useListProducts();
  const { data: sizes } = useListSizes();
  const { data: colors } = useListColors();
  const { data: rolls } = useListFabricRolls();
  const { data: materials } = useListMaterials();
  const { data: purchaseOrders } = useListPurchaseOrders();
  const { data: orders } = useListOrders();

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, can } = useAppAuth();
  const canCreate = can("cutting", "create");
  const canEdit = can("cutting", "edit");
  const canImport = can("cutting", "import");

  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [batchNumber, setBatchNumber] = useState("");
  const [productionFor, setProductionFor] = useState("reesha_stock");
  const [selectedPoId, setSelectedPoId] = useState<number | undefined>();
  const [selectedOrderId, setSelectedOrderId] = useState<number | undefined>();
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
        setProductionFor("reesha_stock");
        setSelectedPoId(undefined);
        setSelectedOrderId(undefined);
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
      productionFor,
      poId: productionFor === "purchase_order" ? selectedPoId : undefined,
      orderId: productionFor === "order" ? selectedOrderId : undefined,
    };

    const productId = Number(fd.get("productId"));
    if (productId) {
      data.productId = productId;
    }

    mutate({ data });
  };

  const [editProductionFor, setEditProductionFor] = useState("reesha_stock");

  const onEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editTarget) return;
    const fd = new FormData(e.currentTarget);
    const locked = !!(editTarget as any).isLocked;
    const payload: Record<string, any> = {
      cutter: fd.get("cutter") as string || undefined,
      cuttingDate: fd.get("cuttingDate") as string,
      remarks: fd.get("remarks") as string || undefined,
    };
    if (!locked) {
      const pid = fd.get("productId");
      const cid = fd.get("colorId");
      const sid = fd.get("sizeId");
      const mid = fd.get("materialId");
      const m2id = fd.get("material2Id");
      const qc = fd.get("quantityCut");
      if (pid) payload.productId = Number(pid);
      if (cid) payload.colorId = Number(cid);
      if (sid) payload.sizeId = Number(sid);
      if (mid) payload.materialId = Number(mid);
      if (m2id) payload.material2Id = Number(m2id) || null;
      if (qc) payload.quantityCut = Number(qc);
    }
    payload.productionFor = fd.get("productionFor") as string || "reesha_stock";
    const epf = payload.productionFor;
    if (epf === "purchase_order") {
      const poVal = fd.get("poId");
      if (poVal) payload.poId = Number(poVal);
    } else if (epf === "order") {
      const ordVal = fd.get("orderId");
      if (ordVal) payload.orderId = Number(ordVal);
    }
    updateBatch({ id: editTarget.id, data: payload });
  };

  const availableRolls = rolls?.filter((r) => r.availableQuantity > 0) || [];
  const TOLERANCE = 0.5;
  const selectedRoll = availableRolls.find(r => r.id === selectedRollId);
  const qtyUsedNum = parseFloat(quantityUsed) || 0;
  const exceedsTolerance = selectedRoll && qtyUsedNum > Number(selectedRoll.availableQuantity) + TOLERANCE;
  const withinTolerance = selectedRoll && qtyUsedNum > Number(selectedRoll.availableQuantity) && qtyUsedNum <= Number(selectedRoll.availableQuantity) + TOLERANCE;

  const filterFields = [
    { name: "batchNumber", label: "Batch Number", type: "text" as const, placeholder: "Search batch..." },
    { name: "startDate", label: "From Date", type: "date" as const },
    { name: "endDate", label: "To Date", type: "date" as const },
    { name: "productId", label: "Product", type: "select" as const, options: products?.filter((p: any) => p.isActive).map((p: any) => ({ value: p.id, label: `${p.code} - ${p.name}` })) || [] },
    { name: "colorId", label: "Color", type: "select" as const, options: colors?.filter((c: any) => c.isActive).map((c: any) => ({ value: c.id, label: `${c.code} - ${c.name}` })) || [] },
    { name: "sizeId", label: "Size", type: "select" as const, options: sizes?.filter((s: any) => s.isActive).map((s: any) => ({ value: s.id, label: s.name })) || [] },
  ];

  return (
    <AppLayout title="Cutting Department">
      <FilterBar fields={filterFields} values={filters} onChange={setFilters} />
      <Card className="shadow-lg border-border rounded-2xl overflow-hidden">
        <CardHeader className="bg-card border-b border-border flex flex-col sm:flex-row sm:items-center justify-between py-5 px-6 gap-4">
          <div>
            <CardTitle className="text-xl font-display text-foreground flex items-center gap-2">
              <Scissors className="h-5 w-5 text-primary" />
              Cutting Batches (WIP)
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Manage fabric cutting and batch creation.</p>
          </div>
          <div className="flex gap-2">
          {canImport && (
            <Button variant="outline" className="rounded-xl gap-1.5" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" /> Import
            </Button>
          )}
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
                    className={`form-input-styled font-mono ${isDuplicate ? "border-red-500/40 bg-red-500/10" : ""}`}
                    placeholder="e.g. BT-001 or any unique identifier..."
                    required
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    autoComplete="off"
                  />
                  {isDuplicate && (
                    <div className="flex items-center gap-2 mt-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-700">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      Batch number <strong>"{batchNumber.trim()}"</strong> already exists. Please enter a unique batch number.
                    </div>
                  )}
                </div>

                <div className="col-span-2 bg-violet-50/50 p-4 rounded-xl border border-violet-100 space-y-4">
                  <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">Production Source</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: "reesha_stock", label: "Reesha Stock" },
                      { value: "purchase_order", label: "Purchase Order" },
                      { value: "order", label: "Order" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { setProductionFor(opt.value); setSelectedPoId(undefined); setSelectedOrderId(undefined); }}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                          productionFor === opt.value
                            ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                            : "bg-card text-muted-foreground border-border hover:bg-background"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {productionFor === "purchase_order" && (
                    <div>
                      <label className="text-sm font-medium block mb-1.5">Purchase Order <span className="text-red-500">*</span></label>
                      <select
                        className="form-input-styled bg-card"
                        required
                        value={selectedPoId ?? ""}
                        onChange={(e) => setSelectedPoId(Number(e.target.value) || undefined)}
                      >
                        <option value="">Select PO...</option>
                        {purchaseOrders?.filter(p => p.status !== "cancelled").map(p => (
                          <option key={p.id} value={p.id}>{p.poNumber} — {p.supplierName}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {productionFor === "order" && (
                    <div>
                      <label className="text-sm font-medium block mb-1.5">Order <span className="text-red-500">*</span></label>
                      <select
                        className="form-input-styled bg-card"
                        required
                        value={selectedOrderId ?? ""}
                        onChange={(e) => setSelectedOrderId(Number(e.target.value) || undefined)}
                      >
                        <option value="">Select Order...</option>
                        {orders?.filter(o => o.status !== "cancelled").map(o => (
                          <option key={o.id} value={o.id}>{o.orderNumber} — {o.customerName}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="col-span-2 bg-background p-4 rounded-xl border border-border space-y-4">
                  <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">Product Selection</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-sm font-medium block mb-1.5">Design / Product <span className="text-xs text-muted-foreground font-normal">(optional at cutting)</span></label>
                      <select name="productId" className="form-input-styled bg-card">
                        <option value="">— None —</option>
                        {products?.filter(p=>p.isActive).map(p => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-1">
                      <label className="text-sm font-medium block mb-1.5">Size <span className="text-red-500">*</span></label>
                      <select name="sizeId" className="form-input-styled bg-card" required>
                        <option value="">Select Size...</option>
                        {sizes?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-1">
                      <label className="text-sm font-medium block mb-1.5">Color <span className="text-red-500">*</span></label>
                      <select name="colorId" className="form-input-styled bg-card" required>
                        <option value="">Select Color...</option>
                        {colors?.map(c => <option key={c.id} value={c.id}>{c.code ? `${c.code} — ${c.name}` : c.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="col-span-2 bg-teal-50/50 p-4 rounded-xl border border-teal-100 space-y-4">
                  <div>
                    <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">Materials (for Item Code)</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Item Code = Product Code – Color Code – Material 1 – Material 2</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium block mb-1.5">Material 1</label>
                      <select name="materialId" className="form-input-styled bg-card">
                        <option value="">— None —</option>
                        {materials?.filter((m: any) => m.isActive).map((m: any) => (
                          <option key={m.id} value={m.id}>{fmtCode(m.code, m.name)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-1.5">Material 2</label>
                      <select name="material2Id" className="form-input-styled bg-card">
                        <option value="">— None —</option>
                        {materials?.filter((m: any) => m.isActive).map((m: any) => (
                          <option key={m.id} value={m.id}>{fmtCode(m.code, m.name)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="col-span-2 bg-primary/10 p-4 rounded-xl border border-primary/20 space-y-4">
                  <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">Fabric Consumption</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="text-sm font-medium block mb-1.5">Select Fabric Roll</label>
                      <select
                        name="fabricRollId"
                        className="form-input-styled bg-card"
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
                        className={`form-input-styled ${exceedsTolerance ? "border-red-500/40 bg-red-500/10" : withinTolerance ? "border-amber-500/40 bg-amber-500/10" : ""}`}
                        required
                        placeholder="0.0"
                        value={quantityUsed}
                        onChange={e => setQuantityUsed(e.target.value)}
                      />
                    </div>
                  </div>
                  {selectedRoll && (
                    <div className="text-sm text-muted-foreground bg-card rounded-lg px-3 py-2 border border-border">
                      Available: <strong>{selectedRoll.availableQuantity} {selectedRoll.unit}</strong>
                      <span className="text-muted-foreground ml-2">(tolerance: +{TOLERANCE})</span>
                    </div>
                  )}
                  {withinTolerance && (
                    <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      Quantity exceeds available stock but is within the {TOLERANCE} tolerance. This will be allowed.
                    </div>
                  )}
                  {exceedsTolerance && (
                    <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-700">
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
          </div>
        </CardHeader>
        <CardContent className="p-0 bg-card">
          <Table>
            <TableHeader className="bg-background border-b border-border">
              <TableRow>
                <TableHead className="py-4">Batch Number</TableHead>
                <TableHead>Product / Specs</TableHead>
                <TableHead>Item Code</TableHead>
                <TableHead className="text-right">Qty Cut</TableHead>
                <TableHead className="text-right">Available for Alloc.</TableHead>
                <TableHead>Date & Cutter</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead className="w-16"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={canEdit ? 9 : 8} className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow> :
                data?.map(batch => (
                  <TableRow key={batch.id} className="group">
                    <TableCell className="font-mono text-primary font-bold">{batch.batchNumber}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-foreground">{fmtCode(batch.productCode, batch.productName)}</div>
                      <div className="text-xs text-muted-foreground flex gap-2 mt-0.5">
                        {batch.sizeName && <span className="bg-muted px-1.5 rounded">{batch.sizeName}</span>}
                        {(batch.colorCode || batch.colorName) && <span className="bg-muted px-1.5 rounded">{batch.colorCode || batch.colorName}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {batch.itemCode
                        ? <span className="font-mono text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">{batch.itemCode}</span>
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-lg">{batch.quantityCut}</TableCell>
                    <TableCell className="text-right">
                      <span className={`font-bold ${batch.availableForAllocation! > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                        {batch.availableForAllocation}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-foreground">{batch.cuttingDate ? format(new Date(batch.cuttingDate), 'MMM d, yyyy') : '-'}</div>
                      <div className="text-xs text-muted-foreground">{batch.cutter || '-'}</div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const pf = (batch as any).productionFor || "reesha_stock";
                        if (pf === "purchase_order") return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-violet-50 text-violet-700 border-violet-200">PO: {(batch as any).poNumber || "?"}</span>;
                        if (pf === "order") return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-orange-500/10 text-orange-700 border-orange-500/20">Order: {(batch as any).orderNumber || "?"}</span>;
                        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-background text-muted-foreground border-border">Reesha Stock</span>;
                      })()}
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
                          onClick={() => { setEditTarget(batch); setEditProductionFor(batch.productionFor || "reesha_stock"); setEditOpen(true); }}
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              }
              {data?.length === 0 && (
                <TableRow><TableCell colSpan={canEdit ? 8 : 7} className="text-center py-12 text-muted-foreground">No cutting batches found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-[520px] rounded-2xl p-6 border-0 shadow-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Edit Cutting Batch</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <form onSubmit={onEditSubmit} className="grid grid-cols-2 gap-4 pt-4">
              {(editTarget as any).isLocked && (
                <div className="col-span-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2 text-xs text-amber-700 flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Allocations exist for this batch. Product, color, size, and quantity cannot be changed.
                </div>
              )}
              <div className="col-span-2 sm:col-span-1">
                <label className="text-sm font-medium block mb-1.5">Product</label>
                <select name="productId" className="form-input-styled" defaultValue={editTarget.productId || ""} disabled={!!(editTarget as any).isLocked}>
                  <option value="">— Select —</option>
                  {products?.filter((p: any) => p.isActive).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-sm font-medium block mb-1.5">Color</label>
                <select name="colorId" className="form-input-styled" defaultValue={editTarget.colorId || ""} disabled={!!(editTarget as any).isLocked}>
                  <option value="">— Select —</option>
                  {colors?.filter((c: any) => c.isActive).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-sm font-medium block mb-1.5">Size</label>
                <select name="sizeId" className="form-input-styled" defaultValue={editTarget.sizeId || ""} disabled={!!(editTarget as any).isLocked}>
                  <option value="">— Select —</option>
                  {sizes?.filter((s: any) => s.isActive).map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-sm font-medium block mb-1.5">Quantity Cut</label>
                <input type="number" name="quantityCut" className="form-input-styled" min="1" defaultValue={editTarget.quantityCut || ""} />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-sm font-medium block mb-1.5">Material 1</label>
                <select name="materialId" className="form-input-styled" defaultValue={editTarget.materialId || ""} disabled={!!(editTarget as any).isLocked}>
                  <option value="">— Select —</option>
                  {materials?.filter((m: any) => m.isActive).map((m: any) => (
                    <option key={m.id} value={m.id}>{m.code} - {m.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-sm font-medium block mb-1.5">Material 2</label>
                <select name="material2Id" className="form-input-styled" defaultValue={editTarget.material2Id || ""} disabled={!!(editTarget as any).isLocked}>
                  <option value="">None</option>
                  {materials?.filter((m: any) => m.isActive).map((m: any) => (
                    <option key={m.id} value={m.id}>{m.code} - {m.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-sm font-medium block mb-1.5">Cutter Name</label>
                <input name="cutter" className="form-input-styled" defaultValue={editTarget.cutter || ""} placeholder="Name..." />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-sm font-medium block mb-1.5">Cutting Date</label>
                <input type="date" name="cuttingDate" className="form-input-styled" required defaultValue={editTarget.cuttingDate?.split('T')[0] || ""} />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium block mb-1.5">Production For</label>
                <select name="productionFor" className="form-input-styled" defaultValue={editTarget.productionFor || "reesha_stock"} onChange={(e) => setEditProductionFor(e.target.value)}>
                  <option value="reesha_stock">Reesha Stock</option>
                  <option value="purchase_order">Purchase Order</option>
                  <option value="order">Customer Order</option>
                </select>
              </div>
              {editProductionFor === "purchase_order" && (
                <div className="col-span-2">
                  <label className="text-sm font-medium block mb-1.5">Purchase Order</label>
                  <select name="poId" className="form-input-styled" defaultValue={editTarget.poId || ""}>
                    <option value="">— Select —</option>
                    {purchaseOrders?.map((po: any) => (
                      <option key={po.id} value={po.id}>{po.poNumber}</option>
                    ))}
                  </select>
                </div>
              )}
              {editProductionFor === "order" && (
                <div className="col-span-2">
                  <label className="text-sm font-medium block mb-1.5">Customer Order</label>
                  <select name="orderId" className="form-input-styled" defaultValue={editTarget.orderId || ""}>
                    <option value="">— Select —</option>
                    {orders?.map((o: any) => (
                      <option key={o.id} value={o.id}>{o.orderNumber}</option>
                    ))}
                  </select>
                </div>
              )}
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

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        moduleName="Cutting Batches"
        moduleKey="cutting-batches"
        onSuccess={() => queryClient.invalidateQueries({ queryKey: getListCuttingBatchesQueryKey() })}
      />
    </AppLayout>
  );
}
