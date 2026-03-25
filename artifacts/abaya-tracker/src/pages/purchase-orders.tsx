import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertCircle, Plus, Loader2, FileText, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import {
  useListPurchaseOrders, useCreatePurchaseOrder, getListPurchaseOrdersQueryKey,
  useUpdatePurchaseOrder, useGetPurchaseOrder
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useAppAuth } from "@/lib/auth-context";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    open: { label: "Open", cls: "bg-primary/10 text-primary border-primary/20" },
    in_progress: { label: "In Progress", cls: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
    completed: { label: "Completed", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
    cancelled: { label: "Cancelled", cls: "bg-red-500/10 text-red-700 border-red-500/20" },
  };
  const { label, cls } = map[status] || { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{label}</span>;
}

function PODetailRow({ poId }: { poId: number }) {
  const { data, isLoading } = useGetPurchaseOrder(poId);
  if (isLoading) return <tr><td colSpan={5} className="p-4 text-center"><Loader2 className="h-4 w-4 animate-spin inline" /> Loading...</td></tr>;
  if (!data) return null;

  const detail = data as any;
  const batches = detail.batches || [];
  const summary = detail.summary || {};

  return (
    <tr>
      <td colSpan={5} className="p-0">
        <div className="bg-background p-4 border-t">
          <div className="grid grid-cols-6 gap-4 mb-3">
            <div className="text-center p-2 bg-card rounded border">
              <div className="text-xs text-muted-foreground">Allocated</div>
              <div className="font-semibold">{summary.totalAllocated || 0}</div>
            </div>
            <div className="text-center p-2 bg-card rounded border">
              <div className="text-xs text-muted-foreground">Received</div>
              <div className="font-semibold">{summary.totalReceived || 0}</div>
            </div>
            <div className="text-center p-2 bg-card rounded border">
              <div className="text-xs text-muted-foreground">Finished</div>
              <div className="font-semibold">{summary.totalFinished || 0}</div>
            </div>
            <div className="text-center p-2 bg-card rounded border">
              <div className="text-xs text-muted-foreground">Outsourced</div>
              <div className="font-semibold">{summary.totalOutsourced || 0}</div>
            </div>
            <div className="text-center p-2 bg-card rounded border">
              <div className="text-xs text-muted-foreground">Dispatched</div>
              <div className="font-semibold">{summary.totalDispatched || 0}</div>
            </div>
            <div className="text-center p-2 bg-card rounded border">
              <div className="text-xs text-muted-foreground">Delivered</div>
              <div className="font-semibold">{summary.totalDelivered || 0}</div>
            </div>
          </div>
          {batches.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch #</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Qty Cut</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.batchNumber}</TableCell>
                    <TableCell>{b.sizeName || "-"}</TableCell>
                    <TableCell>{b.colorName || "-"}</TableCell>
                    <TableCell>{b.quantityCut}</TableCell>
                    <TableCell>{b.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">No batches linked to this PO yet.</p>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function PurchaseOrdersPage() {
  const { data, isLoading } = useListPurchaseOrders();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { can } = useAppAuth();
  const canCreate = can("purchase-orders", "create");
  const canEdit = can("purchase-orders", "edit");

  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { mutate: createPO, isPending } = useCreatePurchaseOrder({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
        setOpen(false);
        toast({ title: "Purchase order created" });
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err?.response?.data?.error || "Failed", variant: "destructive" });
      },
    },
  });

  const { mutate: updatePO, isPending: isUpdating } = useUpdatePurchaseOrder({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
        setEditOpen(false);
        setEditTarget(null);
        toast({ title: "Purchase order updated" });
      },
      onError: (e: any) => {
        toast({ title: "Error", description: e?.response?.data?.error || "Update failed", variant: "destructive" });
      },
    },
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createPO({
      data: {
        poNumber: (fd.get("poNumber") as string).trim(),
        supplierName: (fd.get("supplierName") as string).trim(),
        remarks: (fd.get("remarks") as string) || undefined,
        status: (fd.get("status") as string) || "open",
      },
    });
  };

  const onEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editTarget) return;
    const fd = new FormData(e.currentTarget);
    updatePO({
      id: editTarget.id,
      data: {
        poNumber: (fd.get("poNumber") as string).trim(),
        supplierName: (fd.get("supplierName") as string).trim(),
        remarks: (fd.get("remarks") as string) || undefined,
        status: (fd.get("status") as string) || "open",
      },
    });
  };

  return (
    <AppLayout title="Purchase Orders">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">Purchase Orders</h2>
            <p className="text-sm text-muted-foreground mt-1">Manage purchase orders and view linked cutting batches</p>
          </div>
          {canCreate && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="h-4 w-4" /> New PO</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Purchase Order</DialogTitle></DialogHeader>
                <form onSubmit={onSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">PO Number *</label>
                    <input name="poNumber" required className="w-full border rounded-md px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Supplier Name *</label>
                    <input name="supplierName" required className="w-full border rounded-md px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                    <select name="status" defaultValue="open" className="w-full border rounded-md px-3 py-2 text-sm">
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Remarks</label>
                    <textarea name="remarks" rows={2} className="w-full border rounded-md px-3 py-2 text-sm" />
                  </div>
                  <Button type="submit" disabled={isPending} className="w-full">
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Create PO
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg"><FileText className="h-5 w-5" /> Purchase Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : !data?.length ? (
              <div className="text-center py-12 text-muted-foreground"><AlertCircle className="mx-auto h-10 w-10 mb-2 text-muted-foreground" /><p>No purchase orders yet</p></div>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>PO Number</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      {canEdit && <TableHead className="w-16">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((po) => (
                      <>
                        <TableRow key={po.id} className="cursor-pointer" onClick={() => setExpandedId(expandedId === po.id ? null : po.id)}>
                          <TableCell className="w-8">
                            {expandedId === po.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </TableCell>
                          <TableCell className="font-mono text-xs font-semibold">{po.poNumber}</TableCell>
                          <TableCell>{po.supplierName}</TableCell>
                          <TableCell><StatusBadge status={po.status} /></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{po.createdAt ? format(new Date(po.createdAt), "dd MMM yyyy") : "-"}</TableCell>
                          {canEdit && (
                            <TableCell>
                              <Button variant="ghost" size="sm" onClick={(ev) => { ev.stopPropagation(); setEditTarget(po); setEditOpen(true); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                        {expandedId === po.id && <PODetailRow poId={po.id} />}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditTarget(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Purchase Order</DialogTitle></DialogHeader>
            {editTarget && (
              <form onSubmit={onEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">PO Number *</label>
                  <input name="poNumber" required defaultValue={editTarget.poNumber} className="w-full border rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Supplier Name *</label>
                  <input name="supplierName" required defaultValue={editTarget.supplierName} className="w-full border rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                  <select name="status" defaultValue={editTarget.status} className="w-full border rounded-md px-3 py-2 text-sm">
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Remarks</label>
                  <textarea name="remarks" rows={2} defaultValue={editTarget.remarks ?? ""} className="w-full border rounded-md px-3 py-2 text-sm" />
                </div>
                <Button type="submit" disabled={isUpdating} className="w-full">
                  {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Update PO
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
