import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2, Package } from "lucide-react";
import { 
  useListFinishedGoods, useCreateFinishedGoodsEntry, getListFinishedGoodsQueryKey,
  useGetFinishedGoodsStock, useListCuttingBatches
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

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
              <TableHead>Size</TableHead>
              <TableHead>Color</TableHead>
              <TableHead className="text-right text-emerald-700 font-bold">Total Available Qty</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={4} className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-300" /></TableCell></TableRow> :
              data?.map((item, i) => (
                <TableRow key={i} className="hover:bg-slate-50/50">
                  <TableCell className="font-semibold text-slate-900">{item.productName}</TableCell>
                  <TableCell>{item.sizeName || 'Any'}</TableCell>
                  <TableCell>{item.colorName || 'Any'}</TableCell>
                  <TableCell className="text-right font-display text-2xl font-bold text-emerald-600">{item.totalQuantity}</TableCell>
                </TableRow>
              ))
            }
            {data?.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center py-12 text-slate-500">Store is empty.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function EntryLogTab() {
  const { data, isLoading } = useListFinishedGoods();
  const { data: batches } = useListCuttingBatches();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { mutate, isPending } = useCreateFinishedGoodsEntry({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFinishedGoodsQueryKey() });
        setOpen(false);
        toast({ title: "Stock entry saved" });
      }
    }
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    mutate({ data: { 
      cuttingBatchId: Number(fd.get("cuttingBatchId")),
      quantity: Number(fd.get("quantity")),
      entryDate: fd.get("entryDate") as string,
      remarks: fd.get("remarks") as string
    } });
  };

  return (
    <Card className="shadow-lg border-slate-200 rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
      <CardHeader className="bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between py-5 px-6 gap-4">
        <div>
          <CardTitle className="text-xl font-display text-slate-800">Store Entry Log</CardTitle>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
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
                <select name="cuttingBatchId" className="form-input-styled bg-white" required>
                  <option value="">Select Completed Batch...</option>
                  {batches?.map(b => (
                    <option key={b.id} value={b.id}>{b.batchNumber} - {b.productName}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">Quantity to Store</label>
                  <input type="number" name="quantity" className="form-input-styled border-emerald-300 bg-emerald-50" required placeholder="0" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Entry Date</label>
                  <input type="date" name="entryDate" className="form-input-styled" required defaultValue={new Date().toISOString().split('T')[0]} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Remarks / Location</label>
                <input name="remarks" className="form-input-styled" placeholder="Shelf A1..." />
              </div>
              <div className="mt-4">
                <Button type="submit" disabled={isPending} className="w-full h-12 rounded-xl text-base shadow-lg shadow-primary/20">
                  {isPending ? "Adding..." : "Add to Inventory"}
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
              <TableHead className="text-right">Quantity Entered</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Added By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-300" /></TableCell></TableRow> :
              data?.map(entry => (
                <TableRow key={entry.id} className="hover:bg-slate-50/50">
                  <TableCell className="font-mono text-primary font-medium">{entry.batchNumber}</TableCell>
                  <TableCell>
                    <div className="font-semibold text-slate-900">{entry.productName}</div>
                    <div className="text-xs text-slate-500">{entry.sizeName} | {entry.colorName}</div>
                  </TableCell>
                  <TableCell className="text-right font-bold text-emerald-600 text-lg">+{entry.quantity}</TableCell>
                  <TableCell className="text-slate-600 text-sm">{entry.entryDate ? format(new Date(entry.entryDate), 'MMM d, yyyy') : '-'}</TableCell>
                  <TableCell className="text-slate-500 text-sm">{entry.enteredBy}</TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
