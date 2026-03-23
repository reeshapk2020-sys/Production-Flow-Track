import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, ArrowUpRight, ArrowDownLeft, List, SendHorizontal, RotateCcw } from "lucide-react";
import {
  useListOutsourceTransfers, useListOutsourceAllocations,
  useSendToOutsource, useReturnFromOutsource,
  getListOutsourceTransfersQueryKey, getListOutsourceAllocationsQueryKey,
  getListAllocationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useAppAuth } from "@/lib/auth-context";
import { FilterBar } from "@/components/filter-bar";

type TabKey = "send" | "return" | "log";

function TransferStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    sent: { label: "Sent", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    partial_return: { label: "Partial Return", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    returned: { label: "Returned", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  };
  const { label, cls } = map[status] || { label: status, cls: "bg-slate-100 text-slate-500 border-slate-200" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{label}</span>;
}

function CategoryLabel({ cat }: { cat?: string | null }) {
  if (!cat) return <span className="text-xs text-slate-400">-</span>;
  const map: Record<string, { label: string; cls: string }> = {
    heat_stone: { label: "Heat Stone", cls: "bg-orange-50 text-orange-700 border-orange-200" },
    embroidery: { label: "Embroidery", cls: "bg-pink-50 text-pink-700 border-pink-200" },
    hand_stones: { label: "Hand Stones", cls: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  };
  const { label, cls } = map[cat] || { label: cat.replace(/_/g, " "), cls: "bg-slate-50 text-slate-600 border-slate-200" };
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

  const { data: transfers, isLoading: transfersLoading } = useListOutsourceTransfers(filterParams);
  const { data: allocations, isLoading: allocsLoading } = useListOutsourceAllocations();

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { can } = useAppAuth();
  const canCreate = can("outsource", "create");

  const [sendOpen, setSendOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [selectedAlloc, setSelectedAlloc] = useState<any>(null);
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListOutsourceTransfersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListOutsourceAllocationsQueryKey() });
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
        sendDate: fd.get("sendDate") as string,
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
        returnDate: fd.get("returnDate") as string,
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
  const availableAllocations = allocations?.filter((a: any) => (a.availableToSend || 0) > 0) || [];

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
                : "bg-white text-slate-600 border-slate-200 hover:border-violet-300"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "log" && <FilterBar fields={filterFields} values={filters} onChange={setFilters} />}

      {tab === "send" && (
        <Card className="shadow-lg border-slate-200 rounded-2xl overflow-hidden">
          <CardHeader className="bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between py-5 px-6 gap-4">
            <div>
              <CardTitle className="text-xl font-display text-slate-800 flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5 text-violet-600" />
                Send to Outsource
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">Allocations marked as "Outsource Required" with available pieces.</p>
            </div>
            {canCreate && (
              <Dialog open={sendOpen} onOpenChange={(v) => { setSendOpen(v); if (!v) setSelectedAlloc(null); }}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl shadow-md bg-violet-600 hover:bg-violet-700">
                    <SendHorizontal className="h-4 w-4 mr-2" /> Send Pieces
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[480px] rounded-2xl p-6 border-0 shadow-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-display">Send to Outsource Vendor</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={onSendSubmit} className="grid grid-cols-1 gap-4 pt-4">
                    <div>
                      <label className="text-sm font-medium block mb-1.5">Select Allocation</label>
                      <select
                        className="form-input-styled bg-white"
                        required
                        onChange={(e) => {
                          const a = availableAllocations.find((x: any) => x.id === Number(e.target.value));
                          setSelectedAlloc(a || null);
                        }}
                      >
                        <option value="">Select allocation...</option>
                        {availableAllocations.map((a: any) => (
                          <option key={a.id} value={a.id}>
                            {a.allocationNumber} — {a.batchNumber} ({a.availableToSend} pcs available)
                          </option>
                        ))}
                      </select>
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
                      <select name="outsourceCategory" className="form-input-styled bg-white" required defaultValue={selectedAlloc?.outsourceCategory || ""}>
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
                        <label className="text-sm font-medium block mb-1.5">Send Date</label>
                        <input type="date" name="sendDate" className="form-input-styled" required defaultValue={new Date().toISOString().split("T")[0]} />
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
          <CardContent className="p-0 bg-white">
            <Table>
              <TableHeader className="bg-slate-50 border-b border-slate-100">
                <TableRow>
                  <TableHead className="py-4">Alloc. #</TableHead>
                  <TableHead>Batch / Product</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Issued</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Returned</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allocsLoading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-300" /></TableCell></TableRow>
                ) : allocations?.map((a: any) => (
                  <TableRow key={a.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-mono text-xs text-slate-500">{a.allocationNumber}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-primary text-sm">{a.batchNumber}</div>
                      <div className="text-xs text-slate-500">{a.productName}</div>
                    </TableCell>
                    <TableCell className="text-sm">{a.assigneeName}</TableCell>
                    <TableCell><CategoryLabel cat={a.outsourceCategory} /></TableCell>
                    <TableCell className="text-right font-bold text-slate-800">{a.quantityIssued}</TableCell>
                    <TableCell className="text-right font-semibold text-violet-600">{a.totalSentToOutsource || 0}</TableCell>
                    <TableCell className="text-right font-semibold text-emerald-600">{a.totalReturnedFromOutsource || 0}</TableCell>
                    <TableCell className="text-right font-bold text-amber-700">{a.availableToSend || 0}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                        a.status === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}>
                        {a.status || "pending"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {!allocsLoading && (!allocations || allocations.length === 0) && (
                  <TableRow><TableCell colSpan={9} className="text-center py-12 text-slate-500">No outsource-type allocations found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === "return" && (
        <Card className="shadow-lg border-slate-200 rounded-2xl overflow-hidden">
          <CardHeader className="bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between py-5 px-6 gap-4">
            <div>
              <CardTitle className="text-xl font-display text-slate-800 flex items-center gap-2">
                <ArrowDownLeft className="h-5 w-5 text-emerald-600" />
                Return from Outsource
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">Record pieces returned from outsource vendors.</p>
            </div>
            {canCreate && (
              <Dialog open={returnOpen} onOpenChange={(v) => { setReturnOpen(v); if (!v) setSelectedTransfer(null); }}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl shadow-md bg-emerald-600 hover:bg-emerald-700">
                    <RotateCcw className="h-4 w-4 mr-2" /> Record Return
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[480px] rounded-2xl p-6 border-0 shadow-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-display">Record Outsource Return</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={onReturnSubmit} className="grid grid-cols-1 gap-4 pt-4">
                    <div>
                      <label className="text-sm font-medium block mb-1.5">Select Outsource Transfer</label>
                      <select
                        className="form-input-styled bg-white"
                        required
                        onChange={(e) => {
                          const t = pendingTransfers.find((x) => x.id === Number(e.target.value));
                          setSelectedTransfer(t || null);
                        }}
                      >
                        <option value="">Select transfer...</option>
                        {pendingTransfers.map((t) => {
                          const pending = (t.quantitySent || 0) - (t.quantityReturned || 0) - (t.quantityDamaged || 0);
                          return (
                            <option key={t.id} value={t.id}>
                              #{t.id} — {t.batchNumber} / {t.vendorName || "No vendor"} ({pending} pcs pending)
                            </option>
                          );
                        })}
                      </select>
                      {selectedTransfer && (
                        <div className="mt-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 text-xs text-emerald-700 space-y-0.5">
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
                          className="form-input-styled border-emerald-300 bg-emerald-50"
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
                          className="form-input-styled border-red-200 bg-red-50"
                          min={0}
                          defaultValue={0}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-1.5">Return Date</label>
                      <input type="date" name="returnDate" className="form-input-styled" required defaultValue={new Date().toISOString().split("T")[0]} />
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
          <CardContent className="p-0 bg-white">
            <Table>
              <TableHeader className="bg-slate-50 border-b border-slate-100">
                <TableRow>
                  <TableHead className="py-4">ID</TableHead>
                  <TableHead>Batch</TableHead>
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
                  <TableRow><TableCell colSpan={10} className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-300" /></TableCell></TableRow>
                ) : pendingTransfers.map((t) => {
                  const pending = (t.quantitySent || 0) - (t.quantityReturned || 0) - (t.quantityDamaged || 0);
                  return (
                    <TableRow key={t.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-mono text-xs text-slate-500">#{t.id}</TableCell>
                      <TableCell>
                        <div className="font-semibold text-primary text-sm">{t.batchNumber}</div>
                        <div className="text-xs text-slate-500">{t.productName}</div>
                      </TableCell>
                      <TableCell><CategoryLabel cat={t.outsourceCategory} /></TableCell>
                      <TableCell className="text-sm">{t.vendorName || <span className="text-slate-400">-</span>}</TableCell>
                      <TableCell className="text-right font-bold text-violet-600">{t.quantitySent}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">{t.quantityReturned || 0}</TableCell>
                      <TableCell className="text-right font-semibold text-red-500">{t.quantityDamaged || 0}</TableCell>
                      <TableCell className="text-right font-bold text-amber-700">{pending}</TableCell>
                      <TableCell><TransferStatusBadge status={t.status || "sent"} /></TableCell>
                      <TableCell className="text-slate-600 text-sm">{t.sendDate ? format(new Date(t.sendDate), "MMM d, yyyy") : "-"}</TableCell>
                    </TableRow>
                  );
                })}
                {!transfersLoading && pendingTransfers.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center py-12 text-slate-500">No pending outsource transfers.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === "log" && (
        <Card className="shadow-lg border-slate-200 rounded-2xl overflow-hidden">
          <CardHeader className="bg-white border-b border-slate-100 py-5 px-6">
            <CardTitle className="text-xl font-display text-slate-800 flex items-center gap-2">
              <List className="h-5 w-5 text-slate-600" />
              Transfer Log
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">Complete history of all outsource transfers.</p>
          </CardHeader>
          <CardContent className="p-0 bg-white">
            <Table>
              <TableHeader className="bg-slate-50 border-b border-slate-100">
                <TableRow>
                  <TableHead className="py-4">ID</TableHead>
                  <TableHead>Alloc. #</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Returned</TableHead>
                  <TableHead className="text-right">Damaged</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Send Date</TableHead>
                  <TableHead>Return Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfersLoading ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-300" /></TableCell></TableRow>
                ) : transfers?.map((t) => (
                  <TableRow key={t.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-mono text-xs text-slate-500">#{t.id}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{t.allocationNumber}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-primary text-sm">{t.batchNumber}</div>
                      <div className="text-xs text-slate-500">{t.productName}</div>
                    </TableCell>
                    <TableCell><CategoryLabel cat={t.outsourceCategory} /></TableCell>
                    <TableCell className="text-sm">{t.vendorName || <span className="text-slate-400">-</span>}</TableCell>
                    <TableCell className="text-right font-bold text-violet-600">{t.quantitySent}</TableCell>
                    <TableCell className="text-right font-semibold text-emerald-600">{t.quantityReturned || 0}</TableCell>
                    <TableCell className="text-right font-semibold text-red-500">{t.quantityDamaged || 0}</TableCell>
                    <TableCell><TransferStatusBadge status={t.status || "sent"} /></TableCell>
                    <TableCell className="text-slate-600 text-sm">{t.sendDate ? format(new Date(t.sendDate), "MMM d, yyyy") : "-"}</TableCell>
                    <TableCell className="text-slate-600 text-sm">{t.returnDate ? format(new Date(t.returnDate), "MMM d, yyyy") : "-"}</TableCell>
                  </TableRow>
                ))}
                {!transfersLoading && (!transfers || transfers.length === 0) && (
                  <TableRow><TableCell colSpan={11} className="text-center py-12 text-slate-500">No outsource transfers found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
}
