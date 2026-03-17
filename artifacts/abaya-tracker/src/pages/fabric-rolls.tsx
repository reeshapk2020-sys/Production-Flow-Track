import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, Layers } from "lucide-react";
import { 
  useListFabricRolls, useCreateFabricRoll, getListFabricRollsQueryKey,
  useListFabrics, useListColors
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function FabricRollsPage() {
  const { data, isLoading } = useListFabricRolls();
  const { data: fabrics } = useListFabrics();
  const { data: colors } = useListColors();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { mutate, isPending } = useCreateFabricRoll({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFabricRollsQueryKey() });
        setOpen(false);
        toast({ title: "Fabric roll added to inventory" });
      }
    }
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    mutate({ data: { 
      rollNumber: fd.get("rollNumber") as string,
      fabricId: Number(fd.get("fabricId")),
      colorId: Number(fd.get("colorId")),
      totalQuantity: Number(fd.get("totalQuantity")),
      unit: fd.get("unit") as string,
      supplier: fd.get("supplier") as string,
      receivedDate: fd.get("receivedDate") as string,
      remarks: fd.get("remarks") as string
    } });
  };

  return (
    <AppLayout title="Fabric Rolls Inventory">
      <Card className="shadow-lg border-slate-200 rounded-2xl overflow-hidden">
        <CardHeader className="bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between py-5 px-6 gap-4">
          <div>
            <CardTitle className="text-xl font-display text-slate-800 flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Fabric Rolls Directory
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">Manage incoming raw material fabric rolls.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5">
                <Plus className="h-4 w-4 mr-2" /> Add New Roll
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] rounded-2xl p-6 border-0 shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-display">Register Fabric Roll</DialogTitle>
              </DialogHeader>
              <form onSubmit={onSubmit} className="grid grid-cols-2 gap-4 pt-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-sm font-medium block mb-1.5">Roll Number / Barcode</label>
                  <input name="rollNumber" className="form-input-styled" required placeholder="e.g. ROLL-2023-001" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-sm font-medium block mb-1.5">Received Date</label>
                  <input type="date" name="receivedDate" className="form-input-styled" required defaultValue={new Date().toISOString().split('T')[0]} />
                </div>
                
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-sm font-medium block mb-1.5">Fabric Type</label>
                  <select name="fabricId" className="form-input-styled bg-white" required>
                    <option value="">Select Fabric...</option>
                    {fabrics?.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-sm font-medium block mb-1.5">Color</label>
                  <select name="colorId" className="form-input-styled bg-white" required>
                    <option value="">Select Color...</option>
                    {colors?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="text-sm font-medium block mb-1.5">Total Quantity</label>
                  <input type="number" step="0.01" name="totalQuantity" className="form-input-styled" required placeholder="0.00" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-sm font-medium block mb-1.5">Unit</label>
                  <select name="unit" className="form-input-styled bg-white" required>
                    <option value="Meters">Meters</option>
                    <option value="Yards">Yards</option>
                    <option value="Kg">Kg</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="text-sm font-medium block mb-1.5">Supplier</label>
                  <input name="supplier" className="form-input-styled" placeholder="Supplier Name" />
                </div>
                
                <div className="col-span-2">
                  <label className="text-sm font-medium block mb-1.5">Remarks</label>
                  <input name="remarks" className="form-input-styled" placeholder="Any defects, notes..." />
                </div>
                
                <div className="col-span-2 mt-2">
                  <Button type="submit" disabled={isPending} className="w-full h-12 rounded-xl text-base">
                    {isPending ? "Registering..." : "Complete Registration"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0 bg-white">
          <Table>
            <TableHeader className="bg-slate-50 border-b border-slate-100">
              <TableRow className="hover:bg-slate-50">
                <TableHead className="py-4">Roll Number</TableHead>
                <TableHead>Fabric Details</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Available Qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-300" /></TableCell></TableRow> :
                data?.map(roll => {
                  const usagePct = ((roll.totalQuantity - roll.availableQuantity) / roll.totalQuantity) * 100;
                  return (
                    <TableRow key={roll.id} className="group">
                      <TableCell className="font-mono text-slate-700 font-medium">{roll.rollNumber}</TableCell>
                      <TableCell>
                        <div className="font-semibold text-slate-900">{roll.fabricName}</div>
                        <div className="text-xs text-slate-500">{roll.colorName}</div>
                      </TableCell>
                      <TableCell className="text-slate-600">{roll.supplier || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="font-bold text-slate-900">{roll.availableQuantity} {roll.unit}</div>
                        <div className="text-xs text-slate-400">of {roll.totalQuantity}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={roll.availableQuantity === 0 ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}>
                          {roll.availableQuantity === 0 ? "Consumed" : "Available"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {roll.receivedDate ? format(new Date(roll.receivedDate), 'MMM d, yyyy') : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })
              }
              {data?.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500">No fabric rolls found. Add one to start.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
