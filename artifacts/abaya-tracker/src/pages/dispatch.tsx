import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Loader2, Truck, Pencil, Trash2, Search, Download, Package,
  CheckCircle2, Clock, Send,
} from "lucide-react";
import {
  useListDispatches,
  useCreateDispatch,
  useUpdateDispatch,
  useDeleteDispatch,
  useGetDispatchAvailableStock,
  useGetDispatchReportSummary,
  useListPurchaseOrders,
  useListOrders,
  getListDispatchesQueryKey,
  getGetDispatchAvailableStockQueryKey,
  getGetDispatchReportSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useAppAuth } from "@/lib/auth-context";
import * as XLSX from "xlsx";

export default function DispatchPage() {
  const [filters, setFilters] = useState<Record<string, string>>({
    dispatchNumber: "", itemCode: "", startDate: "", endDate: "",
    destinationType: "", deliveryStatus: "",
  });
  const filterParams: Record<string, any> = {};
  if (filters.dispatchNumber) filterParams.dispatchNumber = filters.dispatchNumber;
  if (filters.itemCode) filterParams.itemCode = filters.itemCode;
  if (filters.startDate) filterParams.startDate = filters.startDate;
  if (filters.endDate) filterParams.endDate = filters.endDate;
  if (filters.destinationType) filterParams.destinationType = filters.destinationType;
  if (filters.deliveryStatus) filterParams.deliveryStatus = filters.deliveryStatus;

  const { data: dispatches, isLoading } = useListDispatches(filterParams);
  const { data: reportSummary } = useGetDispatchReportSummary();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { can } = useAppAuth();
  const canCreate = can("dispatch", "create");
  const canEdit = can("dispatch", "edit");

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListDispatchesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDispatchAvailableStockQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDispatchReportSummaryQueryKey() });
  };

  const totalQty = dispatches?.reduce((s, r) => s + r.quantity, 0) || 0;

  const exportToExcel = () => {
    if (!dispatches?.length) return;
    const rows = dispatches.map((d) => ({
      "Dispatch #": d.dispatchNumber,
      "Date": d.dispatchDate ? format(new Date(d.dispatchDate), "dd/MM/yyyy") : "",
      "Item Code": d.itemCode,
      "Product": d.productName || "",
      "Size": d.sizeName || "",
      "Color": d.colorName || "",
      "Quantity": d.quantity,
      "Destination": d.destinationType === "purchase_order" ? "PO" : d.destinationType === "order" ? "Order" : "Reesha",
      "PO #": d.poNumber || "",
      "Order #": d.orderNumber || "",
      "Customer": d.customerName || "",
      "Status": d.deliveryStatus,
      "Delivery Date": d.deliveryDate ? format(new Date(d.deliveryDate), "dd/MM/yyyy") : "",
      "Remarks": d.remarks || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dispatches");
    XLSX.writeFile(wb, `dispatches_${format(new Date(), "yyyyMMdd")}.xlsx`);
  };

  const statusBadge = (status: string) => {
    const config: Record<string, { color: string; icon: any; label: string }> = {
      pending: { color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Clock, label: "Pending" },
      dispatched: { color: "bg-blue-100 text-blue-800 border-blue-200", icon: Send, label: "Dispatched" },
      delivered: { color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle2, label: "Delivered" },
    };
    const c = config[status] || config.pending;
    const Icon = c.icon;
    return (
      <Badge variant="outline" className={`${c.color} gap-1`}>
        <Icon className="h-3 w-3" /> {c.label}
      </Badge>
    );
  };

  const destLabel = (dt: string) => {
    if (dt === "purchase_order") return "PO";
    if (dt === "order") return "Order";
    return "Reesha";
  };

  return (
    <AppLayout title="Dispatch & Delivery">
      <div className="space-y-6">
        {reportSummary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="rounded-2xl shadow-md">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-sm text-muted-foreground">Total Dispatched</p>
                <p className="text-2xl font-bold">{reportSummary.totalQuantity}</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-md">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{reportSummary.pending}</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-md">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-sm text-muted-foreground">In Transit</p>
                <p className="text-2xl font-bold text-blue-600">{reportSummary.dispatched}</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-md">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-sm text-muted-foreground">Delivered</p>
                <p className="text-2xl font-bold text-green-600">{reportSummary.delivered}</p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {canCreate && (
            <Button onClick={() => setAddOpen(true)} className="rounded-xl gap-2 shadow-md">
              <Plus className="h-4 w-4" /> New Dispatch
            </Button>
          )}
          <Button variant="outline" className="rounded-xl gap-2" onClick={exportToExcel} disabled={!dispatches?.length}>
            <Download className="h-4 w-4" /> Export Excel
          </Button>
          <div className="ml-auto bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2 flex items-center gap-2">
            <Truck className="h-4 w-4 text-indigo-600" />
            <span className="text-sm font-medium text-indigo-800">Total: <strong className="text-lg">{totalQty}</strong></span>
          </div>
        </div>

        <Card className="rounded-2xl shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4" /> Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <Input placeholder="Dispatch #" value={filters.dispatchNumber}
                onChange={(e) => setFilters({ ...filters, dispatchNumber: e.target.value })} className="rounded-xl" />
              <Input placeholder="Item Code" value={filters.itemCode}
                onChange={(e) => setFilters({ ...filters, itemCode: e.target.value })} className="rounded-xl" />
              <Input type="date" placeholder="From" value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="rounded-xl" />
              <Input type="date" placeholder="To" value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="rounded-xl" />
              <Select value={filters.destinationType} onValueChange={(v) => setFilters({ ...filters, destinationType: v === "all" ? "" : v })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Destination" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Destinations</SelectItem>
                  <SelectItem value="reesha">Reesha</SelectItem>
                  <SelectItem value="purchase_order">PO</SelectItem>
                  <SelectItem value="order">Order</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.deliveryStatus} onValueChange={(v) => setFilters({ ...filters, deliveryStatus: v === "all" ? "" : v })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="dispatched">Dispatched</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-md overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center items-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : !dispatches?.length ? (
              <div className="text-center py-12 text-muted-foreground">No dispatches found</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Dispatch #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Item Code</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Delivery Date</TableHead>
                      {canEdit && <TableHead className="text-center">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dispatches.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-mono text-sm font-medium">{d.dispatchNumber}</TableCell>
                        <TableCell>{d.dispatchDate ? format(new Date(d.dispatchDate), "dd/MM/yyyy") : "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{d.itemCode}</TableCell>
                        <TableCell>{d.productName || "-"}</TableCell>
                        <TableCell>{d.sizeName || "-"}</TableCell>
                        <TableCell>{d.colorName || "-"}</TableCell>
                        <TableCell className="text-right font-medium">{d.quantity}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {destLabel(d.destinationType)}
                            {d.poNumber && ` (${d.poNumber})`}
                            {d.orderNumber && ` (${d.orderNumber})`}
                          </Badge>
                        </TableCell>
                        <TableCell>{d.customerName || "-"}</TableCell>
                        <TableCell>{statusBadge(d.deliveryStatus)}</TableCell>
                        <TableCell>{d.deliveryDate ? format(new Date(d.deliveryDate), "dd/MM/yyyy") : "-"}</TableCell>
                        {canEdit && (
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8"
                                onClick={() => setEditTarget(d)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {addOpen && <AddDispatchDialog onClose={() => setAddOpen(false)} onSuccess={invalidate} />}
      {editTarget && <EditDispatchDialog dispatch={editTarget} onClose={() => setEditTarget(null)} onSuccess={invalidate} canEdit={canEdit} />}
    </AppLayout>
  );
}

function AddDispatchDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const createMutation = useCreateDispatch();
  const { data: availableStock } = useGetDispatchAvailableStock();
  const { data: poList } = useListPurchaseOrders();
  const { data: orderList } = useListOrders();

  const [form, setForm] = useState({
    dispatchDate: format(new Date(), "yyyy-MM-dd"),
    itemCode: "",
    productCode: "",
    productName: "",
    sizeName: "",
    colorName: "",
    quantity: "",
    destinationType: "reesha",
    poId: "",
    orderId: "",
    customerName: "",
    remarks: "",
  });

  const selectedStock = availableStock?.find((s) => s.itemCode.toLowerCase() === form.itemCode.toLowerCase());
  const maxAvailable = selectedStock?.available || 0;

  const handleSubmit = () => {
    if (!form.itemCode || !form.quantity || Number(form.quantity) <= 0) {
      toast({ title: "Error", description: "Item code and quantity are required.", variant: "destructive" });
      return;
    }
    if (Number(form.quantity) > maxAvailable) {
      toast({ title: "Error", description: `Insufficient stock. Available: ${maxAvailable}`, variant: "destructive" });
      return;
    }

    createMutation.mutate(
      {
        data: {
          dispatchDate: form.dispatchDate,
          itemCode: form.itemCode.trim(),
          productCode: form.productCode || undefined,
          productName: form.productName || undefined,
          sizeName: form.sizeName || undefined,
          colorName: form.colorName || undefined,
          quantity: Number(form.quantity),
          destinationType: form.destinationType as any,
          poId: form.poId ? Number(form.poId) : undefined,
          orderId: form.orderId ? Number(form.orderId) : undefined,
          customerName: form.customerName || undefined,
          remarks: form.remarks || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Dispatch created" });
          onSuccess();
          onClose();
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err?.response?.data?.error || "Failed to create dispatch", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> New Dispatch</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Dispatch Date *</Label>
              <Input type="date" value={form.dispatchDate} onChange={(e) => setForm({ ...form, dispatchDate: e.target.value })} className="rounded-xl" />
            </div>
            <div>
              <Label>Item Code *</Label>
              <Select value={form.itemCode} onValueChange={(v) => setForm({ ...form, itemCode: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>
                  {availableStock?.map((s) => (
                    <SelectItem key={s.itemCode} value={s.itemCode}>
                      {s.itemCode} (avail: {s.available})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {selectedStock && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-sm text-blue-800">
              <Package className="h-4 w-4 inline mr-1" /> Available: <strong>{maxAvailable}</strong>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Product Name</Label>
              <Input value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} className="rounded-xl" />
            </div>
            <div>
              <Label>Product Code</Label>
              <Input value={form.productCode} onChange={(e) => setForm({ ...form, productCode: e.target.value })} className="rounded-xl" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Size</Label>
              <Input value={form.sizeName} onChange={(e) => setForm({ ...form, sizeName: e.target.value })} className="rounded-xl" />
            </div>
            <div>
              <Label>Color</Label>
              <Input value={form.colorName} onChange={(e) => setForm({ ...form, colorName: e.target.value })} className="rounded-xl" />
            </div>
          </div>
          <div>
            <Label>Quantity *</Label>
            <Input type="number" min={1} max={maxAvailable} value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="rounded-xl" />
          </div>
          <div>
            <Label>Destination</Label>
            <Select value={form.destinationType} onValueChange={(v) => setForm({ ...form, destinationType: v, poId: "", orderId: "" })}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="reesha">Reesha Stock</SelectItem>
                <SelectItem value="purchase_order">Purchase Order</SelectItem>
                <SelectItem value="order">Customer Order</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.destinationType === "purchase_order" && (
            <div>
              <Label>Select PO *</Label>
              <Select value={form.poId} onValueChange={(v) => setForm({ ...form, poId: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select PO" /></SelectTrigger>
                <SelectContent>
                  {poList?.map((po: any) => (
                    <SelectItem key={po.id} value={String(po.id)}>
                      {po.poNumber} — {po.supplierName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {form.destinationType === "order" && (
            <div>
              <Label>Select Order *</Label>
              <Select value={form.orderId} onValueChange={(v) => setForm({ ...form, orderId: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select Order" /></SelectTrigger>
                <SelectContent>
                  {orderList?.map((o: any) => (
                    <SelectItem key={o.id} value={String(o.id)}>
                      {o.orderNumber} — {o.customerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Customer Name</Label>
            <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} className="rounded-xl" />
          </div>
          <div>
            <Label>Remarks</Label>
            <Textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className="rounded-xl" rows={2} />
          </div>
          <Button className="w-full rounded-xl" onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Truck className="h-4 w-4 mr-2" />}
            Create Dispatch
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditDispatchDialog({ dispatch, onClose, onSuccess, canEdit }: { dispatch: any; onClose: () => void; onSuccess: () => void; canEdit: boolean }) {
  const { toast } = useToast();
  const updateMutation = useUpdateDispatch();
  const deleteMutation = useDeleteDispatch();

  const [form, setForm] = useState({
    deliveryStatus: dispatch.deliveryStatus || "pending",
    deliveryDate: dispatch.deliveryDate ? format(new Date(dispatch.deliveryDate), "yyyy-MM-dd") : "",
    customerName: dispatch.customerName || "",
    remarks: dispatch.remarks || "",
  });

  const handleUpdate = () => {
    updateMutation.mutate(
      {
        id: dispatch.id,
        data: {
          deliveryStatus: form.deliveryStatus as any,
          deliveryDate: form.deliveryDate || undefined,
          customerName: form.customerName || undefined,
          remarks: form.remarks || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Dispatch updated" });
          onSuccess();
          onClose();
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err?.response?.data?.error || "Failed to update", variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = () => {
    if (!confirm("Are you sure you want to delete this dispatch? Stock will be restored.")) return;
    deleteMutation.mutate(
      { id: dispatch.id },
      {
        onSuccess: () => {
          toast({ title: "Dispatch deleted" });
          onSuccess();
          onClose();
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err?.response?.data?.error || "Failed to delete", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5" /> Edit {dispatch.dispatchNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-xl p-3 text-sm space-y-1">
            <p><strong>Item:</strong> {dispatch.itemCode} — {dispatch.productName || "N/A"}</p>
            <p><strong>Qty:</strong> {dispatch.quantity} | <strong>Destination:</strong> {dispatch.destinationType === "purchase_order" ? `PO (${dispatch.poNumber})` : dispatch.destinationType === "order" ? `Order (${dispatch.orderNumber})` : "Reesha"}</p>
          </div>
          <div>
            <Label>Delivery Status</Label>
            <Select value={form.deliveryStatus} onValueChange={(v) => setForm({ ...form, deliveryStatus: v })}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="dispatched">Dispatched</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Delivery Date</Label>
            <Input type="date" value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} className="rounded-xl" />
          </div>
          <div>
            <Label>Customer Name</Label>
            <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} className="rounded-xl" />
          </div>
          <div>
            <Label>Remarks</Label>
            <Textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className="rounded-xl" rows={2} />
          </div>
          <div className="flex gap-2">
            <Button className="flex-1 rounded-xl" onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Update
            </Button>
            {canEdit && (
              <Button variant="destructive" className="rounded-xl" onClick={handleDelete} disabled={deleteMutation.isPending}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
