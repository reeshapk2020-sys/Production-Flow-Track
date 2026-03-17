import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, Inbox } from "lucide-react";
import { 
  useListReceivings, useCreateReceiving, getListReceivingsQueryKey,
  useListAllocations
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function ReceivingPage() {
  const { data, isLoading } = useListReceivings();
  const { data: allocations } = useListAllocations();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { mutate, isPending } = useCreateReceiving({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListReceivingsQueryKey() });
        setOpen(false);
        toast({ title: "Received successfully" });
      }
    }
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    
    mutate({ data: { 
      allocationId: Number(fd.get("allocationId")),
      quantityReceived: Number(fd.get("quantityReceived")),
      quantityRejected: Number(fd.get("quantityRejected")) || 0,
      quantityDamaged: Number(fd.get("quantityDamaged")) || 0,
      receiveDate: fd.get("receiveDate") as string,
      remarks: fd.get("remarks") as string
    } });
  };

  const pendingAllocations = allocations?.filter(a => (a.quantityPending || 0) > 0) || [];

  return (
    <AppLayout title="Receiving from Stitchers">
      <Card className="shadow-lg border-slate-200 rounded-2xl overflow-hidden">
        <CardHeader className="bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between py-5 px-6 gap-4">
          <div>
            <CardTitle className="text-xl font-display text-slate-800 flex items-center gap-2">
              <Inbox className="h-5 w-5 text-primary" />
              Receive Stitching
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">Log completed pieces received back from stitchers.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5">
                <Plus className="h-4 w-4 mr-2" /> Receive Items
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-2xl p-6 border-0 shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-display">Receive from Stitcher</DialogTitle>
              </DialogHeader>
              <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 pt-4">
                
                <div>
                  <label className="text-sm font-medium block mb-1.5">Pending Allocation</label>
                  <select name="allocationId" className="form-input-styled bg-white" required>
                    <option value="">Select Stitcher / Batch...</option>
                    {pendingAllocations.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.stitcherName} - Batch {a.batchNumber} ({a.quantityPending} pending)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-sm font-medium block mb-1.5">Good Qty Received</label>
                    <input type="number" name="quantityReceived" className="form-input-styled border-emerald-300 bg-emerald-50" required placeholder="0" />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-sm font-medium block mb-1.5">Receive Date</label>
                    <input type="date" name="receiveDate" className="form-input-styled" required defaultValue={new Date().toISOString().split('T')[0]} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="text-sm font-medium block mb-1.5 text-slate-500">Rejected (Fixable)</label>
                    <input type="number" name="quantityRejected" className="form-input-styled" defaultValue="0" />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5 text-slate-500">Damaged (Loss)</label>
                    <input type="number" name="quantityDamaged" className="form-input-styled" defaultValue="0" />
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium block mb-1.5">Remarks</label>
                  <input name="remarks" className="form-input-styled" placeholder="Notes on quality..." />
                </div>
                
                <div className="mt-4">
                  <Button type="submit" disabled={isPending} className="w-full h-12 rounded-xl text-base shadow-lg shadow-primary/20">
                    {isPending ? "Saving..." : "Log Receipt"}
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
                <TableHead className="py-4">Receipt # / Batch</TableHead>
                <TableHead>Stitcher</TableHead>
                <TableHead className="text-right">Good Qty</TableHead>
                <TableHead className="text-right">Issues</TableHead>
                <TableHead>Receive Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-300" /></TableCell></TableRow> :
                data?.map(rec => (
                  <TableRow key={rec.id} className="group hover:bg-slate-50/50">
                    <TableCell>
                      <div className="font-semibold text-primary">{rec.batchNumber}</div>
                      <div className="text-xs text-slate-500 font-mono">Alloc: {rec.allocationNumber}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{rec.stitcherName}</div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-600 text-lg">{rec.quantityReceived}</TableCell>
                    <TableCell className="text-right">
                      {((rec.quantityDamaged || 0) + (rec.quantityRejected || 0)) > 0 ? (
                        <div className="flex flex-col items-end gap-1">
                          {rec.quantityRejected! > 0 && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 rounded">R: {rec.quantityRejected}</span>}
                          {rec.quantityDamaged! > 0 && <span className="text-xs bg-red-100 text-red-700 px-1.5 rounded">D: {rec.quantityDamaged}</span>}
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm">
                      {rec.receiveDate ? format(new Date(rec.receiveDate), 'MMM d, yyyy') : '-'}
                    </TableCell>
                  </TableRow>
                ))
              }
              {data?.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-slate-500">No receivings logged yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
