import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Trash2, PauseCircle, AlertCircle } from "lucide-react";
import { useListStitchers } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { fmtUTC, calcWorkingMinutesBetween, formatMinutes } from "@/lib/utils";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

type PauseRow = {
  id: number;
  allocationId: number;
  pauseStart: string;
  pauseEnd: string;
  reason: string | null;
  remarks: string | null;
  stitcherId: number | null;
  stitcherName: string | null;
  allocationNumber: string | null;
};

export default function ManualPausePage() {
  const { toast } = useToast();
  const { data: stitchers } = useListStitchers();
  const [rows, setRows] = useState<PauseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stitcherId, setStitcherId] = useState("");
  const [pStart, setPStart] = useState("");
  const [pEnd, setPEnd] = useState("");
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filterStitcher, setFilterStitcher] = useState("");

  async function loadList() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/manual-pauses`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      setRows(await res.json());
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadList(); }, []);

  async function addPause() {
    setError("");
    if (!stitcherId) { setError("Please select a stitcher"); return; }
    if (!pStart || !pEnd) { setError("Both start and end are required"); return; }
    const startDt = new Date(pStart + ":00Z");
    const endDt = new Date(pEnd + ":00Z");
    if (endDt <= startDt) { setError("End must be after start"); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/manual-pauses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          stitcherId: Number(stitcherId),
          pauseStart: startDt.toISOString(),
          pauseEnd: endDt.toISOString(),
          reason: reason || null,
          remarks: remarks || null,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      setStitcherId(""); setPStart(""); setPEnd(""); setReason(""); setRemarks("");
      toast({ title: "Manual pause added" });
      await loadList();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function deletePause(id: number) {
    if (!confirm("Delete this manual pause entry?")) return;
    try {
      const res = await fetch(`${API}/manual-pauses/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Manual pause removed" });
      await loadList();
    } catch {
      toast({ title: "Error", description: "Failed to delete pause", variant: "destructive" });
    }
  }

  const filtered = useMemo(
    () => filterStitcher ? rows.filter(r => String(r.stitcherId) === filterStitcher) : rows,
    [rows, filterStitcher]
  );

  const activeStitchers = (stitchers || []).filter((s: any) => s.isActive);

  return (
    <AppLayout title="Manual Pause">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PauseCircle className="h-5 w-5 text-orange-600" />
              Add Manual Pause
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Stitcher *</label>
                <select
                  value={stitcherId}
                  onChange={e => setStitcherId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">Select stitcher…</option>
                  {activeStitchers.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Start (UTC) *</label>
                <input
                  type="datetime-local"
                  value={pStart}
                  onChange={e => setPStart(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">End (UTC) *</label>
                <input
                  type="datetime-local"
                  value={pEnd}
                  onChange={e => setPEnd(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground block mb-1">Reason</label>
                <input
                  type="text"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="e.g. Machine repair, Other batch work"
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Remarks (optional)</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Any additional notes"
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                />
              </div>
            </div>

            {error && (
              <div className="mt-3 flex items-center gap-2 text-xs text-red-600">
                <AlertCircle className="h-4 w-4" /> {error}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <Button onClick={addPause} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Save Manual Pause
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle>Manual Pause Entries</CardTitle>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Filter by stitcher:</label>
                <select
                  value={filterStitcher}
                  onChange={e => setFilterStitcher(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="">All</option>
                  {activeStitchers.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No manual pause entries.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stitcher</TableHead>
                      <TableHead>Start Time</TableHead>
                      <TableHead>End Time</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.stitcherName || "—"}</TableCell>
                        <TableCell className="text-orange-600">{fmtUTC(r.pauseStart)}</TableCell>
                        <TableCell className="text-teal-600">{fmtUTC(r.pauseEnd)}</TableCell>
                        <TableCell>
                          {formatMinutes(calcWorkingMinutesBetween(new Date(r.pauseStart), new Date(r.pauseEnd)))}
                        </TableCell>
                        <TableCell>{r.reason || "—"}</TableCell>
                        <TableCell className="text-muted-foreground italic">{r.remarks || "—"}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                            onClick={() => deletePause(r.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
