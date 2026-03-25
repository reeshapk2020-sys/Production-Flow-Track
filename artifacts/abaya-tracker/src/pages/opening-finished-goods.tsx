import { useState, useRef } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Loader2, Package, Pencil, Trash2, Upload, Download, FileSpreadsheet,
  CheckCircle2, XCircle, AlertTriangle, Search,
} from "lucide-react";
import {
  useListOpeningFinishedGoods,
  useCreateOpeningFinishedGoods,
  useUpdateOpeningFinishedGoods,
  useDeleteOpeningFinishedGoods,
  useImportOpeningFinishedGoods,
  getListOpeningFinishedGoodsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useAppAuth } from "@/lib/auth-context";
import { FilterBar } from "@/components/filter-bar";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

export default function OpeningFinishedGoodsPage() {
  const [filters, setFilters] = useState<Record<string, string>>({ itemCode: "", productCode: "", sizeName: "", colorName: "" });
  const filterParams: Record<string, any> = {};
  if (filters.itemCode) filterParams.itemCode = filters.itemCode;
  if (filters.productCode) filterParams.productCode = filters.productCode;
  if (filters.sizeName) filterParams.sizeName = filters.sizeName;
  if (filters.colorName) filterParams.colorName = filters.colorName;

  const { data, isLoading } = useListOpeningFinishedGoods(filterParams);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { can } = useAppAuth();
  const canCreate = can("opening-finished-goods", "create");
  const canEdit = can("opening-finished-goods", "edit");
  const canImport = can("opening-finished-goods", "import");

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [importOpen, setImportOpen] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListOpeningFinishedGoodsQueryKey() });

  const totalQty = data?.reduce((s, r) => s + r.quantity, 0) || 0;

  return (
    <AppLayout title="Opening Finished Goods Inventory">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          {canCreate && (
            <Button onClick={() => setAddOpen(true)} className="rounded-xl gap-2 shadow-md">
              <Plus className="h-4 w-4" /> Add Entry
            </Button>
          )}
          {canImport && (
            <Button variant="outline" onClick={() => setImportOpen(true)} className="rounded-xl gap-2">
              <Upload className="h-4 w-4" /> Import CSV/Excel
            </Button>
          )}
          <Button
            variant="outline"
            className="rounded-xl gap-2"
            onClick={() => window.open(`${API_BASE}/opening-finished-goods/template`, "_blank")}
          >
            <Download className="h-4 w-4" /> Download Template
          </Button>
          <div className="ml-auto bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2 flex items-center gap-2">
            <Package className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-800">Total Opening Stock: <strong className="text-lg">{totalQty}</strong></span>
          </div>
        </div>

        <FilterBar
          filters={[
            { name: "itemCode", label: "Item Code", type: "text" as const, placeholder: "Search item code..." },
            { name: "productCode", label: "Product Code", type: "text" as const, placeholder: "Search product..." },
            { name: "sizeName", label: "Size", type: "text" as const, placeholder: "Search size..." },
            { name: "colorName", label: "Color", type: "text" as const, placeholder: "Search color..." },
          ]}
          values={filters}
          onChange={setFilters}
        />

        <Card className="shadow-lg border-border rounded-2xl overflow-hidden">
          <CardHeader className="bg-amber-500/10 border-b border-amber-500/20 py-5 px-6">
            <CardTitle className="text-xl font-display text-amber-900 flex items-center gap-2">
              <Package className="h-5 w-5 text-amber-600" />
              Opening Stock Entries
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 bg-card">
            <Table>
              <TableHeader className="bg-background border-b border-border">
                <TableRow>
                  <TableHead className="py-4">Item Code</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead>Added</TableHead>
                  {canEdit && <TableHead className="text-center">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={canEdit ? 8 : 7} className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-amber-300" /></TableCell></TableRow>
                ) : data?.length === 0 ? (
                  <TableRow><TableCell colSpan={canEdit ? 8 : 7} className="text-center py-12 text-muted-foreground">No opening stock entries yet.</TableCell></TableRow>
                ) : data?.map(entry => (
                  <TableRow key={entry.id} className="group hover:bg-background/50">
                    <TableCell>
                      <span className="font-mono text-sm font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">{entry.itemCode}</span>
                    </TableCell>
                    <TableCell>
                      {entry.productCode && <span className="font-mono text-xs text-muted-foreground">{entry.productCode}</span>}
                      {entry.productName && <div className="text-sm text-foreground">{entry.productName}</div>}
                      {!entry.productCode && !entry.productName && <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">{entry.sizeName || "—"}</TableCell>
                    <TableCell className="text-sm">{entry.colorName || "—"}</TableCell>
                    <TableCell className="text-right font-display text-lg font-bold text-emerald-600">{entry.quantity}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{entry.remarks || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {entry.createdAt ? format(new Date(entry.createdAt), "dd MMM yyyy") : "—"}
                      {entry.enteredBy && <div className="text-[10px] text-muted-foreground">{entry.enteredBy}</div>}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" onClick={() => setEditTarget(entry)} className="h-7 w-7 p-0"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                          <DeleteButton id={entry.id} onSuccess={invalidate} />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <AddEditDialog open={addOpen} onOpenChange={setAddOpen} onSuccess={invalidate} />
        {editTarget && <AddEditDialog open={true} onOpenChange={() => setEditTarget(null)} entry={editTarget} onSuccess={invalidate} />}
        <ImportOpeningStockDialog open={importOpen} onOpenChange={setImportOpen} onSuccess={invalidate} />
      </div>
    </AppLayout>
  );
}

function AddEditDialog({ open, onOpenChange, entry, onSuccess }: {
  open: boolean; onOpenChange: (v: boolean) => void; entry?: any; onSuccess: () => void;
}) {
  const isEdit = !!entry;
  const [form, setForm] = useState({
    itemCode: entry?.itemCode || "",
    productCode: entry?.productCode || "",
    productName: entry?.productName || "",
    sizeName: entry?.sizeName || "",
    colorName: entry?.colorName || "",
    quantity: entry?.quantity || "",
    remarks: entry?.remarks || "",
  });
  const { toast } = useToast();
  const createMut = useCreateOpeningFinishedGoods();
  const updateMut = useUpdateOpeningFinishedGoods();

  const handleSave = async () => {
    if (!form.itemCode.trim()) { toast({ title: "Item code is required", variant: "destructive" }); return; }
    if (!form.quantity || Number(form.quantity) <= 0) { toast({ title: "Quantity must be positive", variant: "destructive" }); return; }

    const payload = {
      itemCode: form.itemCode.trim(),
      productCode: form.productCode.trim() || undefined,
      productName: form.productName.trim() || undefined,
      sizeName: form.sizeName.trim() || undefined,
      colorName: form.colorName.trim() || undefined,
      quantity: Number(form.quantity),
      remarks: form.remarks.trim() || undefined,
    };

    try {
      if (isEdit) {
        await updateMut.mutateAsync({ id: entry.id, data: payload });
        toast({ title: "Entry updated" });
      } else {
        await createMut.mutateAsync({ data: payload });
        toast({ title: "Entry added" });
      }
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || "Error saving", variant: "destructive" });
    }
  };

  const F = (label: string, name: string, required?: boolean, type?: string) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}{required && <span className="text-red-500"> *</span>}</Label>
      <Input
        value={(form as any)[name]}
        onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
        type={type || "text"}
        className="rounded-lg"
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-2xl p-6 border-0 shadow-2xl">
        <DialogHeader><DialogTitle className="text-xl font-display">{isEdit ? "Edit" : "Add"} Opening Stock Entry</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4 pt-2">
          {F("Item Code", "itemCode", true)}
          {F("Quantity", "quantity", true, "number")}
          {F("Product Code", "productCode")}
          {F("Product / Item Name", "productName")}
          {F("Size", "sizeName")}
          {F("Color", "colorName")}
        </div>
        <div className="space-y-1.5 pt-2">
          <Label className="text-xs font-medium text-muted-foreground">Remarks</Label>
          <Textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} className="rounded-lg" rows={2} />
        </div>
        <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending} className="w-full h-11 rounded-xl mt-3">
          {(createMut.isPending || updateMut.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {isEdit ? "Update Entry" : "Add Entry"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function DeleteButton({ id, onSuccess }: { id: number; onSuccess: () => void }) {
  const deleteMut = useDeleteOpeningFinishedGoods();
  const { toast } = useToast();
  const handleDelete = async () => {
    if (!confirm("Delete this opening stock entry?")) return;
    try {
      await deleteMut.mutateAsync({ id });
      toast({ title: "Entry deleted" });
      onSuccess();
    } catch {
      toast({ title: "Error deleting", variant: "destructive" });
    }
  };
  return (
    <Button variant="ghost" size="sm" onClick={handleDelete} className="h-7 w-7 p-0"><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
  );
}

function parseCsvText(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"/, "").replace(/"$/, ""));
  return lines.slice(1).map(line => {
    const vals = line.split(",").map(v => v.trim().replace(/^"/, "").replace(/"$/, ""));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
    return obj;
  });
}

function ImportOpeningStockDialog({ open, onOpenChange, onSuccess }: {
  open: boolean; onOpenChange: (v: boolean) => void; onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const importMut = useImportOpeningFinishedGoods();
  const { toast } = useToast();

  const reset = () => {
    setFile(null); setParsedRows([]); setResult(null); setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleClose = (v: boolean) => { if (!v) reset(); onOpenChange(v); };

  const handleFileSelect = async (f: File) => {
    setFile(f);
    setResult(null);
    setError(null);
    try {
      const text = await f.text();
      const rows = parseCsvText(text);
      if (rows.length === 0) { setError("No data rows found in file."); return; }
      setParsedRows(rows);
    } catch {
      setError("Could not read file. Please use a CSV file.");
    }
  };

  const handleImport = async () => {
    if (parsedRows.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      const payload = parsedRows.map(r => ({
        itemCode: r.itemCode || "",
        productCode: r.productCode || undefined,
        productName: r.productName || undefined,
        sizeName: r.sizeName || r.size || undefined,
        colorName: r.colorName || r.color || undefined,
        quantity: Number(r.quantity) || 0,
        remarks: r.remarks || undefined,
      }));
      const res = await importMut.mutateAsync({ data: { rows: payload } });
      setResult(res);
      if ((res as any).imported > 0) {
        toast({ title: `${(res as any).imported} entries imported` });
        onSuccess();
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[650px] rounded-2xl p-6 border-0 shadow-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-display flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Import Opening Stock
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm" className="rounded-lg text-xs gap-1.5"
              onClick={() => window.open(`${API_BASE}/opening-finished-goods/template`, "_blank")}
            >
              <Download className="h-3.5 w-3.5" /> Download Template
            </Button>
            <span className="text-xs text-muted-foreground">CSV with sample data</span>
          </div>

          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${file ? "border-primary/40 bg-primary/5" : "border-border hover:border-border"}`}
            onClick={() => inputRef.current?.click()}
          >
            <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
            {file ? (
              <div className="flex items-center justify-center gap-2 text-sm text-primary font-medium">
                <FileSpreadsheet className="h-5 w-5" /> {file.name} — {parsedRows.length} rows
              </div>
            ) : (
              <div className="space-y-1">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Click to select CSV file</p>
                <p className="text-xs text-muted-foreground">Columns: itemCode, productCode, productName, sizeName, colorName, quantity, remarks</p>
              </div>
            )}
          </div>

          {parsedRows.length > 0 && !result && (
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-background border-b border-border">
                <p className="text-xs font-medium text-muted-foreground">Preview ({parsedRows.length} rows)</p>
              </div>
              <div className="max-h-48 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs py-1">#</TableHead>
                      <TableHead className="text-xs py-1">Item Code</TableHead>
                      <TableHead className="text-xs py-1">Product</TableHead>
                      <TableHead className="text-xs py-1">Size</TableHead>
                      <TableHead className="text-xs py-1">Color</TableHead>
                      <TableHead className="text-xs py-1 text-right">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.slice(0, 20).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs py-1 text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="text-xs py-1 font-mono">{r.itemCode}</TableCell>
                        <TableCell className="text-xs py-1">{r.productCode || r.productName || "—"}</TableCell>
                        <TableCell className="text-xs py-1">{r.sizeName || r.size || "—"}</TableCell>
                        <TableCell className="text-xs py-1">{r.colorName || r.color || "—"}</TableCell>
                        <TableCell className="text-xs py-1 text-right">{r.quantity}</TableCell>
                      </TableRow>
                    ))}
                    {parsedRows.length > 20 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-1">...and {parsedRows.length - 20} more</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {!result && parsedRows.length > 0 && (
            <Button onClick={handleImport} disabled={importing} className="w-full h-11 rounded-xl">
              {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</> : <><Upload className="h-4 w-4 mr-2" /> Import {parsedRows.length} Rows</>}
            </Button>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-start gap-2">
              <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className={`rounded-xl px-4 py-3 flex items-start gap-2 ${(result.errors?.length || 0) === 0 ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-amber-500/10 border border-amber-500/20"}`}>
                {(result.errors?.length || 0) === 0 ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5" /> : <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />}
                <div className="text-sm space-y-0.5">
                  <p className="font-medium">{result.imported} of {result.total} rows imported successfully</p>
                  {result.errors?.length > 0 && <p className="text-amber-700">{result.errors.length} rows had errors</p>}
                </div>
              </div>

              {result.errors?.length > 0 && (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-background border-b border-border">
                    <p className="text-xs font-medium text-muted-foreground">Errors ({result.errors.length})</p>
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-border">
                    {result.errors.map((err: any, i: number) => (
                      <div key={i} className="px-3 py-1.5 text-xs flex gap-2">
                        <span className="font-mono text-muted-foreground shrink-0">Row {err.row}:</span>
                        <span className="text-red-600">{err.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button variant="outline" className="w-full rounded-xl" onClick={reset}>Import Another File</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
