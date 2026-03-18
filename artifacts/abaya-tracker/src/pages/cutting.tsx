import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, Scissors } from "lucide-react";
import { 
  useListCuttingBatches, useCreateCuttingBatch, getListCuttingBatchesQueryKey,
  useListProducts, useListSizes, useListColors, useListFabricRolls
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

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
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { mutate, isPending } = useCreateCuttingBatch({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCuttingBatchesQueryKey() });
        setOpen(false);
        toast({ title: "Cutting batch created successfully" });
      }
    }
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    
    // Simple 1-roll mapping for form simplicity
    const fabricRollId = Number(fd.get("fabricRollId"));
    const quantityUsed = Number(fd.get("quantityUsed"));
    
    mutate({ data: { 
      productId: Number(fd.get("productId")),
      sizeId: Number(fd.get("sizeId")) || undefined,
      colorId: Number(fd.get("colorId")) || undefined,
      quantityCut: Number(fd.get("quantityCut")),
      cutter: fd.get("cutter") as string,
      cuttingDate: fd.get("cuttingDate") as string,
      remarks: fd.get("remarks") as string,
      fabricUsages: fabricRollId ? [{ fabricRollId, quantityUsed }] : []
    } });
  };

  const availableRolls = rolls?.filter(r => r.availableQuantity > 0) || [];

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
          <Dialog open={open} onOpenChange={setOpen}>
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
                
                {/* Batch Setup */}
                <div className="col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                  <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wider">Product Selection</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-sm font-medium block mb-1.5">Design / Product</label>
                      <select name="productId" className="form-input-styled bg-white" required>
                        <option value="">Select Design...</option>
                        {products?.filter(p=>p.isActive).map(p => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-1">
                      <label className="text-sm font-medium block mb-1.5">Size</label>
                      <select name="sizeId" className="form-input-styled bg-white">
                        <option value="">Any Size</option>
                        {sizes?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-1">
                      <label className="text-sm font-medium block mb-1.5">Color</label>
                      <select name="colorId" className="form-input-styled bg-white">
                        <option value="">Any Color</option>
                        {colors?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Fabric Usage */}
                <div className="col-span-2 bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-4">
                  <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wider">Fabric Consumption</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="text-sm font-medium block mb-1.5">Select Fabric Roll</label>
                      <select name="fabricRollId" className="form-input-styled bg-white" required>
                        <option value="">Select Roll...</option>
                        {availableRolls.map(r => (
                          <option key={r.id} value={r.id}>{r.rollNumber} ({r.fabricName}) - {r.availableQuantity} {r.unit} left</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-1">
                      <label className="text-sm font-medium block mb-1.5">Qty Used</label>
                      <input type="number" step="0.1" name="quantityUsed" className="form-input-styled" required placeholder="0.0" />
                    </div>
                  </div>
                </div>

                {/* Production Info */}
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
                  <Button type="submit" disabled={isPending} className="w-full h-12 rounded-xl text-base shadow-lg shadow-primary/20">
                    {isPending ? "Generating Batch..." : "Create Cutting Batch"}
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
                <TableHead className="py-4">Batch Number</TableHead>
                <TableHead>Product / Specs</TableHead>
                <TableHead className="text-right">Qty Cut</TableHead>
                <TableHead className="text-right">Available for Alloc.</TableHead>
                <TableHead>Date & Cutter</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-300" /></TableCell></TableRow> :
                data?.map(batch => (
                  <TableRow key={batch.id} className="group">
                    <TableCell className="font-mono text-primary font-bold">{batch.batchNumber}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{batch.productName}</div>
                      <div className="text-xs text-slate-500 flex gap-2 mt-0.5">
                        {batch.sizeName && <span className="bg-slate-100 px-1.5 rounded">{batch.sizeName}</span>}
                        {batch.colorName && <span className="bg-slate-100 px-1.5 rounded">{batch.colorName}</span>}
                      </div>
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
                  </TableRow>
                ))
              }
              {data?.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500">No cutting batches found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
