import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Info, Plus, Loader2, Package, Pencil } from "lucide-react";
import { 
  useListFinishedGoods, useCreateFinishedGoodsEntry, getListFinishedGoodsQueryKey,
  useGetFinishedGoodsStock, useListCuttingBatches,
  useGetFinishedGoodsBatchInfo, useUpdateFinishedGoodsEntry,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fmtCode } from "@/lib/utils";
import { useAppAuth } from "@/lib/auth-context";
import { FilterBar } from "@/components/filter-bar";
import { useListProducts, useListColors } from "@workspace/api-client-react";

export default function FinishedGoodsPage() {
  return (
    <AppLayout title="Finished Goods Store">
      <Tabs defaultValue="stock" className="w-full">
        <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 mb-6 inline-block overflow-x-auto">
          <TabsList className="bg-transparent h-auto p-0 flex space-x-1">
            <TabsTrigger value="stock" className="rounded-lg px-6 py-2.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md">Current Stock</TabsTrigger>
            <TabsTrigger value="entries" className="rounded-lg px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md">Entry Log</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="stock" className="mt-0 outline-none"><StockSummaryTab /></TabsContent>
        <TabsContent value="entries" className="mt-0 outline-none"><EntryLogTab /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function StockSummaryTab() {
  const { data, isLoading } = useGetFinishedGoodsStock();

  return (
    <Card className="shadow-lg border-slate-200 rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
      <CardHeader className="bg-emerald-50/50 border-b border-emerald-100 py-5 px-6">
        <CardTitle className="text-xl font-display text-emerald-900 flex items-center gap-2">
          <Package className="h-5 w-5 text-emerald-600" />
          Live Stock Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 bg-white">
        <Table>
          <TableHeader className="bg-slate-50 border-b border-slate-100">
            <TableRow>
              <TableHead className="py-4">Product / Design</TableHead>
              <TableHead>Item Code</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Color</TableHead>
              <TableHead className="text-right text-amber-600">Opening Qty</TableHead>
              <TableHead className="text-right text-blue-600">Produced Qty</TableHead>
              <TableHead className="text-right text-slate-500">Total</TableHead>
              <TableHead className="text-right text-red-500">Dispatched</TableHead>
              <TableHead className="text-right text-emerald-700 font-bold">Available</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={9} className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-300" /></TableCell></TableRow> :
              data?.map((item: any, i: number) => (
                <TableRow key={i} className="hover:bg-slate-50/50">
                  <TableCell className="font-semibold text-slate-900">{fmtCode(item.productCode, item.productName)}</TableCell>
                  <TableCell>
                    {item.itemCode
                      ? <span className="font-mono text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">{item.itemCode}</span>
                      : <span className="text-xs text-slate-400">—</span>}
                  </TableCell>
                  <TableCell>{item.sizeName || 'Any'}</TableCell>
                  <TableCell>{fmtCode(item.colorCode, item.colorName) || 'Any'}</TableCell>
                  <TableCell className="text-right text-sm text-amber-600 font-medium">{item.openingQty || 0}</TableCell>
                  <TableCell className="text-right text-sm text-blue-600 font-medium">{item.producedQty || 0}</TableCell>
                  <TableCell className="text-right text-sm text-slate-500">{item.totalQuantity}</TableCell>
                  <TableCell className="text-right text-sm text-red-500 font-medium">{item.dispatchedQty || 0}</TableCell>
                  <TableCell className="text-right font-display text-2xl font-bold text-emerald-600">{item.availableQty ?? item.totalQuantity}</TableCell>
                </TableRow>
              ))
            }
            {data?.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center py-12 text-slate-500">Store is empty.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function EntryLogTab() {
  const [filters, setFilters] = useState<Record<string, string>>({ startDate: "", endDate: "", productId: "", colorId: "", batchNumber: "" });

  const filterParams: Record<string, any> = {};
  if (filters.startDate) filterParams.startDate = filters.startDate;
  if (filters.endDate) filterParams.endDate = filters.endDate;
  if (filters.productId) filterParams.productId = Number(filters.productId);
  if (filters.colorId) filterParams.colorId = Number(filters.colorId);
  if (filters.batchNumber) filterParams.batchNumber = filters.batchNumber;

  const { data, isLoading } = useListFinishedGoods(filterParams);
  const { data: batches } = useListCuttingBatches();
  const { data: products } = useListProducts();
  const { data: colors } = useListColors();

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, can } = useAppAuth();
  const canCreate = can("finished-goods", "create");
  const canEdit = can("finished-goods", "edit");

  const [open, setOpen] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [qty, setQty] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);

  const { data: batchInfo, isLoading: loadingInfo } = useGetFinishedGoodsBatchInfo(
    selectedBatchId!,
    { query: { enabled: !!selectedBatchId } }
  );

  const enteredQty = Number(qty) || 0;
  const available = batchInfo?.availableForStore ?? 0;
  const qtyError: string | null =
    !selectedBatchId
      ? null
      : enteredQty > 0 && available === 0
      ? `No pieces available for this batch from Finishing (${batchInfo?.totalFinishingOutput ?? 0} finished, ${batchInfo?.totalStoredQty ?? 0} already stored).`
      : enteredQty > 0 && enteredQty > available
      ? `Quantity (${enteredQty}) exceeds available pieces from Finishing (${available} available).`
      : null;

  const resetForm = () => {
    setSelectedBatchId(null);
    setQty("");
  };

  const { mutate, isPending } = useCreateFinishedGoodsEntry({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFinishedGoodsQueryKey() });
        setOpen(false);
        resetForm();
        toast({ title: "Stock entry saved" });
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error || "Failed to save entry.";
        toast({ title: "Validation Error", description: msg, variant: "destructive" });
      },
    },
  });

  const { mutate: updateEntry, isPending: isUpdating } = useUpdateFinishedGoodsEntry({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFinishedGoodsQueryKey() });
        setEditOpen(false);
        setEditTarget(null);
        toast({ title: "Entry updated" });
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
        quantity: enteredQty,
        entryDate: fd.get("entryDate") as string,
        remarks: fd.get("remarks") as string,
      },
    });
  };

  const onEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editTarget) return;
    const fd = new FormData(e.currentTarget);
    updateEntry({
      id: editTarget.id,
      data: {
        entryDate: fd.get("entryDate") as string,
        remarks: fd.get("remarks") as string || undefined,
      }
    });
  };

  const fgFilterFields = [
    { name: "batchNumber", label: "Batch Number", type: "text" as const, placeholder: "Search batch..." },
    { name: "startDate", label: "From Date", type: "date" as const },
    { name: "endDate", label: "To Date", type: "date" as const },
    { name: "productId", label: "Product", type: "select" as const, options: products?.filter((p: any) => p.isActive).map((p: any) => ({ value: p.id, label: `${p.code} - ${p.name}` })) || [] },
    { name: "colorId", label: "Color", type: "select" as const, options: colors?.filter((c: any) => c.isActive).map((c: any) => ({ value: c.id, label: `${c.code} - ${c.name}` })) || [] },
  ];

  return (
    <>
    <FilterBar fields={fgFilterFields} values={filters} onChange={setFilters} />
    <Card className="shadow-lg border-slate-200 rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
      <CardHeader className="bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between py-5 px-6 gap-4">
        <div>
          <CardTitle className="text-xl font-display text-slate-800">Store Entry Log</CardTitle>
        </div>
        {canCreate && <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="rounded-xl shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5">
              <Plus className="h-4 w-4 mr-2" /> Receive into Store
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[450px] rounded-2xl p-6 border-0 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-display">Add Finished Goods</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 pt-4">

              <div>
                <label className="text-sm font-medium block mb-1.5">Source Batch</label>
                <select
                  name="cuttingBatchId"
                  className="form-input-styled bg-white"
                  required
                  value={selectedBatchId ?? ""}
                  onChange={(e) => {
                    setSelectedBatchId(e.target.value ? Number(e.target.value) : null);
                    setQty("");
                  }}
                >
                  <option value="">Select Batch...</option>
                  {batches?.map((b) => (
                    <option key={b.id} value={b.id}>{b.batchNumber} — {fmtCode(b.productCode, b.productName)}</option>
                  ))}
                </select>
              </div>

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
                        <div className="font-medium text-slate-700">Availability from Finishing</div>
                        <div className="text-slate-600">
                          Finishing Output: <strong>{batchInfo?.totalFinishingOutput ?? 0}</strong> pcs &nbsp;|&nbsp;
                          Already Stored: <strong>{batchInfo?.totalStoredQty ?? 0}</strong> pcs &nbsp;|&nbsp;
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
                    Quantity to Store
                    {available > 0 && <span className="text-xs text-slate-400 ml-1">(max {available})</span>}
                  </label>
                  <input
                    type="number" name="quantity" min="1" max={available || undefined}
                    required placeholder="0"
                    className={`form-input-styled ${qtyError ? "border-red-400 bg-red-50" : "border-emerald-300 bg-emerald-50"}`}
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Entry Date</label>
                  <input type="date" name="entryDate" className="form-input-styled" required defaultValue={new Date().toISOString().split("T")[0]} />
                </div>
              </div>

              {qtyError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {qtyError}
                </div>
              )}

              <div>
                <label className="text-sm font-medium block mb-1.5">Remarks / Location</label>
                <input name="remarks" className="form-input-styled" placeholder="Shelf A1..." />
              </div>
              <div className="mt-2">
                <Button
                  type="submit"
                  disabled={isPending || !!qtyError || !selectedBatchId}
                  className="w-full h-12 rounded-xl text-base shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? "Adding..." : "Add to Inventory"}
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
              <TableHead className="text-right">Quantity Entered</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Added By</TableHead>
              {canEdit && <TableHead className="w-16"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={canEdit ? 7 : 6} className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-300" /></TableCell></TableRow> :
              data?.map(entry => (
                <TableRow key={entry.id} className="group hover:bg-slate-50/50">
                  <TableCell className="font-mono text-primary font-medium">{entry.batchNumber}</TableCell>
                  <TableCell>
                    <div className="font-semibold text-slate-900">{fmtCode(entry.productCode, entry.productName)}</div>
                    <div className="text-xs text-slate-500">{entry.sizeName} | {fmtCode(entry.colorCode, entry.colorName)}</div>
                  </TableCell>
                  <TableCell>
                    {(entry as any).itemCode
                      ? <span className="font-mono text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">{(entry as any).itemCode}</span>
                      : <span className="text-xs text-slate-400">—</span>}
                  </TableCell>
                  <TableCell className="text-right font-bold text-emerald-600 text-lg">+{entry.quantity}</TableCell>
                  <TableCell className="text-slate-600 text-sm">{entry.entryDate ? format(new Date(entry.entryDate), 'MMM d, yyyy') : '-'}</TableCell>
                  <TableCell className="text-slate-500 text-sm">{entry.enteredBy}</TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => { setEditTarget(entry); setEditOpen(true); }}
                      >
                        <Pencil className="h-3.5 w-3.5 text-slate-500" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl p-6 border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Edit Store Entry</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <form onSubmit={onEditSubmit} className="grid grid-cols-1 gap-4 pt-4">
              <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-600">
                <div className="font-semibold text-slate-800">{editTarget.batchNumber}</div>
                <div className="text-xs text-slate-500 mt-0.5">{fmtCode(editTarget.productCode, editTarget.productName)} · {editTarget.quantity} pcs</div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Entry Date</label>
                <input type="date" name="entryDate" className="form-input-styled" required defaultValue={editTarget.entryDate?.split('T')[0] || ""} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Remarks / Location</label>
                <input name="remarks" className="form-input-styled" defaultValue={editTarget.remarks || ""} placeholder="Shelf A1..." />
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
    </Card>
    </>
  );
}
