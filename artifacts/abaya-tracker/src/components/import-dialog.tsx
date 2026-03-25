import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface ImportResult {
  total: number;
  inserted: number;
  failed: number;
  errors: { row: number; reason: string }[];
}

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  moduleName: string;
  moduleKey: string;
  onSuccess?: () => void;
}

export function ImportDialog({ open, onOpenChange, moduleName, moduleKey, onSuccess }: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const resp = await fetch(`${API_BASE}/import/${moduleKey}`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || "Import failed");
      } else {
        setResult(data);
        if (data.inserted > 0 && onSuccess) onSuccess();
      }
    } catch (e: any) {
      setError(e.message || "Network error");
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    window.open(`${API_BASE}/import/template/${moduleKey}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] rounded-2xl p-6 border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-display flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Import {moduleName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg text-xs gap-1.5"
              onClick={downloadTemplate}
            >
              <Download className="h-3.5 w-3.5" />
              Download Template
            </Button>
            <span className="text-xs text-muted-foreground">Excel (.xlsx) with sample data</span>
          </div>

          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
              file ? "border-primary/40 bg-primary/5" : "border-border hover:border-border"
            }`}
            onClick={() => inputRef.current?.click()}
            style={{ cursor: "pointer" }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setFile(f); setResult(null); setError(null); }
              }}
            />
            {file ? (
              <div className="flex items-center justify-center gap-2 text-sm text-primary font-medium">
                <FileSpreadsheet className="h-5 w-5" />
                {file.name}
              </div>
            ) : (
              <div className="space-y-1">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Click to select CSV or Excel file</p>
                <p className="text-xs text-muted-foreground">Supports .csv, .xlsx, .xls</p>
              </div>
            )}
          </div>

          {!result && (
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full h-11 rounded-xl disabled:opacity-50"
            >
              {uploading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" /> Import Data</>
              )}
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
              <div className={`rounded-xl px-4 py-3 flex items-start gap-2 ${
                result.failed === 0 ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-amber-500/10 border border-amber-500/20"
              }`}>
                {result.failed === 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                )}
                <div className="text-sm space-y-0.5">
                  <p className="font-medium">{result.inserted} of {result.total} rows imported successfully</p>
                  {result.failed > 0 && <p className="text-amber-700">{result.failed} rows failed</p>}
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-background border-b border-border">
                    <p className="text-xs font-medium text-muted-foreground">Errors ({result.errors.length})</p>
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-border">
                    {result.errors.map((err, i) => (
                      <div key={i} className="px-3 py-1.5 text-xs flex gap-2">
                        <span className="font-mono text-muted-foreground shrink-0">Row {err.row}:</span>
                        <span className="text-red-600">{err.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full rounded-xl"
                onClick={reset}
              >
                Import Another File
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
