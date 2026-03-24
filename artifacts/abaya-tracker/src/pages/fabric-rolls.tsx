import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, Layers, Pencil, Upload, AlertCircle } from "lucide-react";
import { ImportDialog } from "@/components/import-dialog";
import { 
  useListFabricRolls, useCreateFabricRoll, getListFabricRollsQueryKey,
  useListFabrics, useListColors, useUpdateFabricRoll
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useAppAuth } from "@/lib/auth-context";

export default function FabricRollsPage() {
  const { data, isLoading } = useListFabricRolls();
  const { data: fabrics } = useListFabrics();
  const { data: colors } = useListColors();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, can } = useAppAuth();
  const canCreate = can("fabric-rolls", "create");
  const canEdit = can("fabric-rolls", "edit");
  const canImport = can("fabric-rolls", "import");

  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);

  const { mutate, isPending } = useCreateFabricRoll({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFabricRollsQueryKey() });
        setOpen(false);
        toast({ title: "Fabric roll added to inventory" });
      }
    }
  });

  const { mutate: updateRoll, isPending: isUpdating } = useUpdateFabricRoll({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFabricRollsQueryKey() });
        setEditOpen(false);
        setEditTarget(null);
        toast({ title: "Fabric roll updated" });
      },
      onError: (e: any) => {
        toast({ title: "Error", description: e?.response?.data?.error || "Update failed", variant: "destructive" });
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

  const onEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editTarget) return;
    const fd = new FormData(e.currentTarget);
    updateRoll({
      id: editTarget.id,
      data: {
        rollNumber: fd.get("rollNumber") as string,
        supplier: fd.get("supplier") as string || undefined,
        receivedDate: fd.get("receivedDate") as string,
        remarks: fd.get("remarks") as string || undefined,
      }
    });
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
          <div className="flex items-center gap-2">
            {canImport && <Button variant="outline" className="rounded-xl gap-1.5" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" /> Import</Button>}
            {canCreate && <Dialog open={open} onOpenChange={setOpen}>
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
                    {colors?.map(c => <option key={c.id} value={c.id}>{c.code ? `${c.code} — ${c.name}` : c.name}</option>)}
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
          </Dialog>}
          </div>
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
                {canEdit && <TableHead className="w-16"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={canEdit ? 7 : 6} className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-300" /></TableCell></TableRow> :
                data?.map(roll => {
                  return (
                    <TableRow key={roll.id} className="group">
                      <TableCell className="font-mono text-slate-700 font-medium">{roll.rollNumber}</TableCell>
                      <TableCell>
                        <div className="font-semibold text-slate-900">{roll.fabricName}</div>
                        <div className="text-xs text-slate-500">{roll.colorCode || roll.colorName}</div>
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
                      {canEdit && (
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => { setEditTarget(roll); setEditOpen(true); }}
                          >
                            <Pencil className="h-3.5 w-3.5 text-slate-500" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              }
              {data?.length === 0 && (
                <TableRow><TableCell colSpan={canEdit ? 7 : 6} className="text-center py-12 text-slate-500">No fabric rolls found. Add one to start.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-[460px] rounded-2xl p-6 border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Edit Fabric Roll</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <form onSubmit={onEditSubmit} className="grid grid-cols-2 gap-4 pt-4">
              {(editTarget as any).isLocked && (
                <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-xs text-amber-700 flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  This roll is used in cutting batches. Color cannot be changed via API.
                </div>
              )}
              <div className="col-span-2">
                <label className="text-sm font-medium block mb-1.5">Roll Number</label>
                <input name="rollNumber" className="form-input-styled font-mono" required defaultValue={editTarget.rollNumber} />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-sm font-medium block mb-1.5">Supplier</label>
                <input name="supplier" className="form-input-styled" defaultValue={editTarget.supplier || ""} placeholder="Supplier Name" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-sm font-medium block mb-1.5">Received Date</label>
                <input type="date" name="receivedDate" className="form-input-styled" required defaultValue={editTarget.receivedDate?.split('T')[0] || ""} />
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
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} moduleName="Fabric Rolls" moduleKey="fabric-rolls" onSuccess={() => queryClient.invalidateQueries({ queryKey: getListFabricRollsQueryKey() })} />
    </AppLayout>
  );
}
