import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, ArrowUpRight, ArrowDownLeft, List, SendHorizontal, RotateCcw, Pencil, AlertCircle } from "lucide-react";
import { SearchableSelect } from "@/components/searchable-select";
import {
  useListOutsourceTransfers, useListOutsourceAllocations,
  useListOutsourceReceivingBatches,
  useSendToOutsource, useReturnFromOutsource, useUpdateOutsourceTransfer,
  getListOutsourceTransfersQueryKey, getListOutsourceAllocationsQueryKey,
  getListOutsourceReceivingBatchesQueryKey,
  getListAllocationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fmtUTC } from "@/lib/utils";
import { useAppAuth } from "@/lib/auth-context";
import { FilterBar } from "@/components/filter-bar";

type TabKey = "send" | "return" | "log";

function TransferStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    sent: { label: "Sent", cls: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
    partial_return: { label: "Partial Return", cls: "bg-primary/10 text-primary border-primary/20" },
    returned: { label: "Returned", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  };
  const { label, cls } = map[status] || { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{label}</span>;
}

function CategoryLabel({ cat }: { cat?: string | null }) {
  if (!cat) return <span className="text-xs text-muted-foreground">-</span>;
  const map: Record<string, { label: string; cls: string }> = {
    heat_stone: { label: "Heat Stone", cls: "bg-orange-500/10 text-orange-700 border-orange-500/20" },
    embroidery: { label: "Embroidery", cls: "bg-pink-50 text-pink-700 border-pink-200" },
    hand_stones: { label: "Hand Stones", cls: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  };
  const { label, cls } = map[cat] || { label: cat.replace(/_/g, " "), cls: "bg-background text-muted-foreground border-border" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${cls}`}>{label}</span>;
}

export default function OutsourcePage() {
  const [tab, setTab] = useState<TabKey>("send");
  const [filters, setFilters] = useState<Record<string, string>>({
    startDate: "", endDate: "", outsourceCategory: "", status: "", batchNumber: ""
  });

  const filterParams: Record<string, any> = {};
  if (filters.startDate) filterParams.startDate = filters.startDate;
  if (filters.endDate) filterParams.endDate = filters.endDate;
  if (filters.outsourceCategory) filterParams.outsourceCategory = filters.outsourceCategory;
  if (filters.status) filterParams.status = filters.status;
  if (filters.batchNumber) filterParams.batchNumber = filters.batchNumber;

  const [sendStage, setSendStage] = useState<"allocation" | "receiving">("allocation");

  const { data: transfers, isLoading: transfersLoading } = useListOutsourceTransfers(filterParams);
  const { data: allocations, isLoading: allocsLoading } = useListOutsourceAllocations();
  const { data: receivingBatches, isLoading: recvLoading } = useListOutsourceReceivingBatches();

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { can } = useAppAuth();
  const canCreate = can("outsource", "create");
  const canEdit = can("outsource", "edit");

  const [sendOpen, setSendOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedAlloc, setSelectedAlloc] = useState<any>(null);
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null);
  const [editTarget, setEditTarget] = useState<any>(null);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListOutsourceTransfersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListOutsourceAllocationsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListOutsourceReceivingBatchesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAllocationsQueryKey() });
  };

  const { mutate: sendMutate, isPending: sendPending } = useSendToOutsource({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        setSendOpen(false);
        setSelectedAlloc(null);
        toast({ title: "Sent to outsource successfully" });
      },
      onError: (e: any) => {
        toast({ title: "Error", description: e?.response?.data?.error || "Send failed", variant: "destructive" });
      },
    },
  });

  const { mutate: returnMutate, isPending: returnPending } = useReturnFromOutsource({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        setReturnOpen(false);
        setSelectedTransfer(null);
        toast({ title: "Return recorded successfully" });
      },
      onError: (e: any) => {
        toast({ title: "Error", description: e?.response?.data?.error || "Return failed", variant: "destructive" });
      },
    },
  });

  const { mutate: updateMutate, isPending: updatePending } = useUpdateOutsourceTransfer({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        setEditOpen(false);
        setEditTarget(null);
        toast({ title: "Transfer updated" });
      },
      onError: (e: any) => {
        toast({ title: "Error", description: e?.response?.data?.error || "Update failed", variant: "destructive" });
      },
    },
  });

  const onEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editTarget) return;
    const fd = new FormData(e.currentTarget);
    updateMutate({
      id: editTarget.id,
      data: {
        vendorName: fd.get("vendorName") as string || undefined,
        remarks: fd.get("remarks") as string || undefined,
      },
    });
  };

  const onSendSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedAlloc) return;
    const fd = new FormData(e.currentTarget);
    sendMutate({
      data: {
        allocationId: selectedAlloc.id,
        quantitySent: Number(fd.get("quantitySent")),
        outsourceCategory: (fd.get("outsourceCategory") as string) || selectedAlloc.outsourceCategory || "",
        vendorName: fd.get("vendorName") as string,
        sendDate: (fd.get("sendTime") ? `${fd.get("sendDate")}T${fd.get("sendTime")}` : fd.get("sendDate")) as string,
        sourceStage: sendStage,
        remarks: fd.get("remarks") as string,
      },
    });
  };

  const onReturnSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTransfer) return;
    const fd = new FormData(e.currentTarget);
    returnMutate({
      data: {
        outsourceTransferId: selectedTransfer.id,
        quantityReturned: Number(fd.get("quantityReturned")),
        quantityDamaged: Number(fd.get("quantityDamaged") || 0),
        returnDate: (fd.get("returnTime") ? `${fd.get("returnDate")}T${fd.get("returnTime")}` : fd.get("returnDate")) as string,
        remarks: fd.get("remarks") as string,
      },
    });
  };

  const filterFields = [
    { name: "batchNumber", label: "Batch Number", type: "text" as const, placeholder: "Search batch..." },
    { name: "startDate", label: "From Date", type: "date" as const },
    { name: "endDate", label: "To Date", type: "date" as const },
    {
      name: "outsourceCategory", label: "Category", type: "select" as const,
      options: [
        { value: "heat_stone", label: "Heat Stone" },
        { value: "embroidery", label: "Embroidery" },
        { value: "hand_stones", label: "Hand Stones" },
      ],
    },
    {
      name: "status", label: "Status", type: "select" as const,
      options: [
        { value: "sent", label: "Sent" },
        { value: "partial_return", label: "Partial Return" },
        { value: "returned", label: "Returned" },
      ],
    },
  ];

  const tabs = [
    { key: "send" as const, label: "Send to Outsource", icon: ArrowUpRight },
    { key: "return" as const, label: "Return from Outsource", icon: ArrowDownLeft },
    { key: "log" as const, label: "Transfer Log", icon: List },
  ];

  const pendingTransfers = transfers?.filter((t) => t.status === "sent" || t.status === "partial_return") || [];
  const allocStageList = allocations?.filter((a: any) => (a.availableToSend || 0) > 0) || [];
  const recvStageList = receivingBatches?.filter((a: any) => (a.availableToSend || 0) > 0) || [];
  const availableAllocations = sendStage === "allocation" ? allocStageList : recvStageList;
  const sendListLoading = sendStage === "allocation" ? allocsLoading : recvLoading;

  return (
    <AppLayout title="Outsource Management">
      <div className="flex gap-2 mb-4">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
              tab === key
                ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                : "bg-card text-muted-foreground border-border hover:border-violet-300"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "log" && <FilterBar fields={filterFields} values={filters} onChange={setFilters} />}

      {tab === "send" && (
        <Card className="shadow-lg border-border rounded-2xl overflow-hidden">
          <CardHeader className="bg-card border-b border-border flex flex-col sm:flex-row sm:items-center justify-between py-5 px-6 gap-4">
            <div>
              <CardTitle className="text-xl font-display text-foreground flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5 text-violet-600" />
                Send to Outsource
              </CardTitle>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-muted-foreground font-medium">Source Stage:</span>
                <button
                  onClick={() => { setSendStage("allocation"); setSelectedAlloc(null); }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${sendStage === "allocation" ? "bg-violet-600 text-white border-violet-600" : "bg-card text-muted-foreground border-border hover:border-violet-300"}`}
                >
                  From Allocation
                </button>
                <button
                  onClick={() => { setSendStage("receiving"); setSelectedAlloc(null); }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${sendStage === "receiving" ? "bg-blue-600 text-white border-blue-600" : "bg-card text-muted-foreground border-border hover:border-blue-300"}`}
                >
                  From Receiving
                </button>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {sendStage === "allocation"
                  ? 'Allocations marked as "Outsource Required" with available pieces.'
                  : "Received allocations with pieces available for post-receiving outsource."}
              </p>
            </div>
            {canCreate && (
              <Dialog open={sendOpen} onOpenChange={(v) => { setSendOpen(v); if (!v) setSelectedAlloc(null); }}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl shadow-md bg-violet-600 hover:bg-violet-700">
                    <SendHorizontal className="h-4 w-4 mr-2" /> Send Pieces
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[480px] rounded-2xl p-6 border-0 shadow-2xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-display">Send to Outsource Vendor</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={onSendSubmit} className="grid grid-cols-1 gap-4 pt-4">
                    <div>
                      <label className="text-sm font-medium block mb-1.5">Select Allocation</label>
                      <SearchableSelect
                        required
                        placeholder="Select allocation..."
                        value={selectedAlloc?.id ?? ""}
                        options={availableAllocations.map((a: any) => ({
                          value: a.id,
                          label: `${a.allocationNumber} — ${a.batchNumber} (${a.availableToSend} pcs available)`,
                          searchText: `${a.allocationNumber} ${a.batchNumber} ${a.productName || ""}`,
                        }))}
                        onChange={(val) => {
                          const a = availableAllocations.find((x: any) => x.id === Number(val));
                          setSelectedAlloc(a || null);
                        }}
                      />
                      {selectedAlloc && (
                        <div className="mt-2 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2 text-xs text-violet-700 space-y-0.5">
                          <div><strong>Product:</strong> {selectedAlloc.productName}</div>
                          <div><strong>Assignee:</strong> {selectedAlloc.assigneeName} ({selectedAlloc.allocationType})</div>
                          <div><strong>Category:</strong> {selectedAlloc.outsourceCategory?.replace(/_/g, " ") || "Not set"}</div>
                          <div><strong>Available to send:</strong> {selectedAlloc.availableToSend} pcs</div>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-1.5">Outsource Category</label>
                      <select name="outsourceCategory" className="form-input-styled bg-card" required defaultValue={selectedAlloc?.outsourceCategory || ""}>
                        <option value="">Select type...</option>
                        <option value="heat_stone">Heat Stone</option>
                        <option value="embroidery">Embroidery</option>
                        <option value="hand_stones">Hand Stones</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium block mb-1.5">Quantity to Send</label>
                        <input
                          type="number"
                          name="quantitySent"
                          className="form-input-styled border-violet-300 bg-violet-50"
                          required
                          min={1}
                          max={selectedAlloc?.availableToSend}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium block mb-1.5">Send Date & Time</label>
                        <div className="flex gap-2">
                          <input type="date" name="sendDate" className="form-input-styled flex-1" required defaultValue={new Date().toISOString().split("T")[0]} />
                          <input type="time" name="sendTime" className="form-input-styled w-28" defaultValue={new Date().toTimeString().slice(0,5)} />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-1.5">Vendor Name</label>
                      <input name="vendorName" className="form-input-styled" placeholder="Vendor / workshop name..." />
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-1.5">Remarks</label>
                      <input name="remarks" className="form-input-styled" placeholder="Special instructions..." />
                    </div>
                    <Button type="submit" disabled={sendPending} className="w-full h-12 rounded-xl bg-violet-600 hover:bg-violet-700">
                      {sendPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</> : "Confirm Send"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent className="p-0 bg-card">
            <Table>
              <TableHeader className="bg-background border-b border-border">
                <TableRow>
                  <TableHead className="py-4">Alloc. #</TableHead>
                  <TableHead>Batch / Product</TableHead>
                  <TableHead>Assignee</TableHead>
                  {sendStage === "allocation" && <TableHead>Category</TableHead>}
                  <TableHead className="text-right">{sendStage === "allocation" ? "Issued" : "Received"}</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Returned</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sendListLoading ? (
                  <TableRow><TableCell colSpan={sendStage === "allocation" ? 9 : 8} className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : (sendStage === "allocation" ? allocations : receivingBatches)?.map((a: any) => (
                  <TableRow key={a.id} className="hover:bg-background/50">
                    <TableCell className="font-mono text-xs text-muted-foreground">{a.allocationNumber}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-primary text-sm">{a.batchNumber}</div>
                      <div className="text-xs text-muted-foreground">{a.productName}</div>
                    </TableCell>
                    <TableCell className="text-sm">{a.assigneeName}</TableCell>
                    {sendStage === "allocation" && <TableCell><CategoryLabel cat={a.outsourceCategory} /></TableCell>}
                    <TableCell className="text-right font-bold text-foreground">{sendStage === "allocation" ? a.quantityIssued : a.quantityReceived}</TableCell>
                    <TableCell className="text-right font-semibold text-violet-600">{a.totalSentToOutsource || 0}</TableCell>
                    <TableCell className="text-right font-semibold text-emerald-600">{a.totalReturnedFromOutsource || 0}</TableCell>
                    <TableCell className="text-right font-bold text-amber-700">{a.availableToSend || 0}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                        a.status === "completed" ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" : "bg-amber-500/10 text-amber-700 border-amber-500/20"
                      }`}>
                        {a.status || "pending"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {!sendListLoading && availableAllocations.length === 0 && (sendStage === "allocation" ? allocations : receivingBatches)?.length === 0 && (
                  <TableRow><TableCell colSpan={sendStage === "allocation" ? 9 : 8} className="text-center py-12 text-muted-foreground">
                    {sendStage === "allocation" ? "No outsource-type allocations found." : "No received allocations found."}
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === "return" && (
        <Card className="shadow-lg border-border rounded-2xl overflow-hidden">
          <CardHeader className="bg-card border-b border-border flex flex-col sm:flex-row sm:items-center justify-between py-5 px-6 gap-4">
            <div>
              <CardTitle className="text-xl font-display text-foreground flex items-center gap-2">
                <ArrowDownLeft className="h-5 w-5 text-emerald-600" />
                Return from Outsource
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Record pieces returned from outsource vendors.</p>
            </div>
            {canCreate && (
              <Dialog open={returnOpen} onOpenChange={(v) => { setReturnOpen(v); if (!v) setSelectedTransfer(null); }}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl shadow-md bg-emerald-600 hover:bg-emerald-700">
                    <RotateCcw className="h-4 w-4 mr-2" /> Record Return
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[480px] rounded-2xl p-6 border-0 shadow-2xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-display">Record Outsource Return</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={onReturnSubmit} className="grid grid-cols-1 gap-4 pt-4">
                    <div>
                      <label className="text-sm font-medium block mb-1.5">Select Outsource Transfer</label>
                      <SearchableSelect
                        required
                        placeholder="Select transfer..."
                        value={selectedTransfer?.id ?? ""}
                        options={pendingTransfers.map((t) => {
                          const pending = (t.quantitySent || 0) - (t.quantityReturned || 0) - (t.quantityDamaged || 0);
                          return {
                            value: t.id,
                            label: `#${t.id} — ${t.batchNumber} / ${t.vendorName || "No vendor"} (${pending} pcs pending)`,
                            searchText: `${t.batchNumber} ${t.vendorName || ""} ${t.outsourceCategory || ""}`,
                          };
                        })}
                        onChange={(val) => {
                          const t = pendingTransfers.find((x) => x.id === Number(val));
                          setSelectedTransfer(t || null);
                        }}
                      />
                      {selectedTransfer && (
                        <div className="mt-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 text-xs text-emerald-700 space-y-0.5">
                          <div><strong>Batch:</strong> {selectedTransfer.batchNumber}</div>
                          <div><strong>Category:</strong> {selectedTransfer.outsourceCategory?.replace(/_/g, " ")}</div>
                          <div><strong>Vendor:</strong> {selectedTransfer.vendorName || "N/A"}</div>
                          <div><strong>Sent:</strong> {selectedTransfer.quantitySent} &nbsp;|&nbsp; <strong>Already returned:</strong> {selectedTransfer.quantityReturned || 0}</div>
                          <div><strong>Pending return:</strong> {(selectedTransfer.quantitySent || 0) - (selectedTransfer.quantityReturned || 0) - (selectedTransfer.quantityDamaged || 0)} pcs</div>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium block mb-1.5">Qty Returned (Good)</label>
                        <input
                          type="number"
                          name="quantityReturned"
                          className="form-input-styled border-emerald-300 bg-emerald-500/10"
                          required
                          min={0}
                          max={selectedTransfer ? (selectedTransfer.quantitySent || 0) - (selectedTransfer.quantityReturned || 0) - (selectedTransfer.quantityDamaged || 0) : undefined}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium block mb-1.5">Qty Damaged</label>
                        <input
                          type="number"
                          name="quantityDamaged"
                          className="form-input-styled border-red-500/20 bg-red-500/10"
                          min={0}
                          defaultValue={0}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-1.5">Return Date & Time</label>
                      <div className="flex gap-2">
                        <input type="date" name="returnDate" className="form-input-styled flex-1" required defaultValue={new Date().toISOString().split("T")[0]} />
                        <input type="time" name="returnTime" className="form-input-styled w-28" defaultValue={new Date().toTimeString().slice(0,5)} />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-1.5">Remarks</label>
                      <input name="remarks" className="form-input-styled" placeholder="Notes about the return..." />
                    </div>
                    <Button type="submit" disabled={returnPending} className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700">
                      {returnPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Recording...</> : "Confirm Return"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent className="p-0 bg-card">
            <Table>
              <TableHeader className="bg-background border-b border-border">
                <TableRow>
                  <TableHead className="py-4">ID</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Returned</TableHead>
                  <TableHead className="text-right">Damaged</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Send Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfersLoading ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : pendingTransfers.map((t) => {
                  const pending = (t.quantitySent || 0) - (t.quantityReturned || 0) - (t.quantityDamaged || 0);
                  return (
                    <TableRow key={t.id} className="hover:bg-background/50">
                      <TableCell className="font-mono text-xs text-muted-foreground">#{t.id}</TableCell>
                      <TableCell>
                        <div className="font-semibold text-primary text-sm">{t.batchNumber}</div>
                        <div className="text-xs text-muted-foreground">{t.productName}</div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                          (t as any).sourceStage === "receiving"
                            ? "bg-blue-500/10 text-blue-700 border-blue-500/20"
                            : "bg-violet-500/10 text-violet-700 border-violet-500/20"
                        }`}>
                          {(t as any).sourceStage === "receiving" ? "Receiving" : "Allocation"}
                        </span>
                      </TableCell>
                      <TableCell><CategoryLabel cat={t.outsourceCategory} /></TableCell>
                      <TableCell className="text-sm">{t.vendorName || <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell className="text-right font-bold text-violet-600">{t.quantitySent}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">{t.quantityReturned || 0}</TableCell>
                      <TableCell className="text-right font-semibold text-red-500">{t.quantityDamaged || 0}</TableCell>
                      <TableCell className="text-right font-bold text-amber-700">{pending}</TableCell>
                      <TableCell><TransferStatusBadge status={t.status || "sent"} /></TableCell>
                      <TableCell className="text-muted-foreground text-sm">{t.sendDate ? fmtUTC(t.sendDate) : "-"}</TableCell>
                    </TableRow>
                  );
                })}
                {!transfersLoading && pendingTransfers.length === 0 && (
                  <TableRow><TableCell colSpan={11} className="text-center py-12 text-muted-foreground">No pending outsource transfers.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === "log" && (
        <Card className="shadow-lg border-border rounded-2xl overflow-hidden">
          <CardHeader className="bg-card border-b border-border py-5 px-6">
            <CardTitle className="text-xl font-display text-foreground flex items-center gap-2">
              <List className="h-5 w-5 text-muted-foreground" />
              Transfer Log
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Complete history of all outsource transfers.</p>
          </CardHeader>
          <CardContent className="p-0 bg-card">
            <Table>
              <TableHeader className="bg-background border-b border-border">
                <TableRow>
                  <TableHead className="py-4">ID</TableHead>
                  <TableHead>Alloc. #</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Returned</TableHead>
                  <TableHead className="text-right">Damaged</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Send Date</TableHead>
                  <TableHead>Return Date</TableHead>
                  {canEdit && <TableHead className="w-16"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfersLoading ? (
                  <TableRow><TableCell colSpan={12} className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : transfers?.map((t) => (
                  <TableRow key={t.id} className="hover:bg-background/50">
                    <TableCell className="font-mono text-xs text-muted-foreground">#{t.id}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{t.allocationNumber}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-primary text-sm">{t.batchNumber}</div>
                      <div className="text-xs text-muted-foreground">{t.productName}</div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                        (t as any).sourceStage === "receiving"
                          ? "bg-blue-500/10 text-blue-700 border-blue-500/20"
                          : "bg-violet-500/10 text-violet-700 border-violet-500/20"
                      }`}>
                        {(t as any).sourceStage === "receiving" ? "Receiving" : "Allocation"}
                      </span>
                    </TableCell>
                    <TableCell><CategoryLabel cat={t.outsourceCategory} /></TableCell>
                    <TableCell className="text-sm">{t.vendorName || <span className="text-muted-foreground">-</span>}</TableCell>
                    <TableCell className="text-right font-bold text-violet-600">{t.quantitySent}</TableCell>
                    <TableCell className="text-right font-semibold text-emerald-600">{t.quantityReturned || 0}</TableCell>
                    <TableCell className="text-right font-semibold text-red-500">{t.quantityDamaged || 0}</TableCell>
                    <TableCell><TransferStatusBadge status={t.status || "sent"} /></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{t.sendDate ? fmtUTC(t.sendDate) : "-"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{t.returnDate ? fmtUTC(t.returnDate) : "-"}</TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setEditTarget({ ...t, isLocked: ((t.quantityReturned || 0) > 0 || (t.quantityDamaged || 0) > 0) }); setEditOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {!transfersLoading && (!transfers || transfers.length === 0) && (
                  <TableRow><TableCell colSpan={canEdit ? 13 : 12} className="text-center py-12 text-muted-foreground">No outsource transfers found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl p-6 border-0 shadow-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Edit Outsource Transfer</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <form onSubmit={onEditSubmit} className="grid grid-cols-1 gap-4 pt-4">
              <div className="bg-background rounded-xl p-3 text-sm text-muted-foreground">
                <div className="font-semibold text-foreground">#{editTarget.id} — {editTarget.batchNumber}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{editTarget.quantitySent} pcs sent · {editTarget.outsourceCategory?.replace(/_/g, " ")}</div>
              </div>
              {(editTarget as any).isLocked && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2 text-xs text-amber-700 flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Returns recorded for this transfer. Vendor name cannot be changed.
                </div>
              )}
              <div>
                <label className="text-sm font-medium block mb-1.5">Vendor Name</label>
                <input
                  name="vendorName"
                  className="form-input-styled"
                  defaultValue={editTarget.vendorName || ""}
                  placeholder="Vendor / workshop name..."
                  disabled={!!(editTarget as any).isLocked}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Remarks</label>
                <input name="remarks" className="form-input-styled" defaultValue={editTarget.remarks || ""} placeholder="Notes..." />
              </div>
              <div className="mt-2">
                <Button type="submit" disabled={updatePending} className="w-full h-11 rounded-xl">
                  {updatePending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
