import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, Send } from "lucide-react";
import { 
  useListAllocations, useCreateAllocation, getListAllocationsQueryKey,
  useListCuttingBatches, useListStitchers
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function AllocationPage() {
  const { data, isLoading } = useListAllocations();
  const { data: batches } = useListCuttingBatches();
  const { data: stitchers } = useListStitchers();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { mutate, isPending } = useCreateAllocation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAllocationsQueryKey() });
        setOpen(false);
        toast({ title: "Successfully allocated to stitcher" });
      }
    }
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    
    mutate({ data: { 
      cuttingBatchId: Number(fd.get("cuttingBatchId")),
      stitcherId: Number(fd.get("stitcherId")),
      quantityIssued: Number(fd.get("quantityIssued")),
      issueDate: fd.get("issueDate") as string,
      remarks: fd.get("remarks") as string
    } });
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
            <p className="text-sm text-slate-500 mt-1">Issue cut pieces to stitchers or teams.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5">
                <Plus className="h-4 w-4 mr-2" /> Issue Batch
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-2xl p-6 border-0 shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-display">Allocate Pieces</DialogTitle>
              </DialogHeader>
              <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 pt-4">
                
                <div>
                  <label className="text-sm font-medium block mb-1.5">Select Cutting Batch</label>
                  <select name="cuttingBatchId" className="form-input-styled bg-white" required>
                    <option value="">Select Batch (Available Qty)</option>
                    {availableBatches.map(b => (
                      <option key={b.id} value={b.id}>{b.batchNumber} - {b.productName} ({b.availableForAllocation} left)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1.5">Assign to Stitcher</label>
                  <select name="stitcherId" className="form-input-styled bg-white" required>
                    <option value="">Select Stitcher...</option>
                    {stitchers?.filter(s=>s.isActive).map(s => (
                      <option key={s.id} value={s.id}>{s.name} {s.teamName ? `(${s.teamName})` : ''}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium block mb-1.5">Quantity Issued</label>
                    <input type="number" name="quantityIssued" className="form-input-styled border-amber-300 bg-amber-50" required placeholder="0" />
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
                
                <div className="mt-4">
                  <Button type="submit" disabled={isPending} className="w-full h-12 rounded-xl text-base shadow-lg shadow-primary/20">
                    {isPending ? "Allocating..." : "Confirm Allocation"}
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
                <TableHead>Batch</TableHead>
                <TableHead>Stitcher</TableHead>
                <TableHead className="text-right">Issued</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead>Issue Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-300" /></TableCell></TableRow> :
                data?.map(alloc => (
                  <TableRow key={alloc.id} className="group hover:bg-slate-50/50">
                    <TableCell className="font-mono text-xs text-slate-500 font-medium">{alloc.allocationNumber}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-primary">{alloc.batchNumber}</div>
                      <div className="text-xs text-slate-500">{alloc.productName}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{alloc.stitcherName}</div>
                      <div className="text-xs text-slate-500">{alloc.teamName}</div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-slate-800">{alloc.quantityIssued}</TableCell>
                    <TableCell className="text-right">
                      {alloc.quantityPending! > 0 ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">{alloc.quantityPending} pending</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Completed</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm">
                      {alloc.issueDate ? format(new Date(alloc.issueDate), 'MMM d, yyyy') : '-'}
                    </TableCell>
                  </TableRow>
                ))
              }
              {data?.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500">No allocations found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
