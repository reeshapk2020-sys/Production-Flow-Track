import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileText, Users, BarChart3 } from "lucide-react";
import { 
  useGetStitcherPerformanceReport, useGetStagePendingReport, useGetBatchStatusReport,
  useGetTeamPerformanceReport, useGetDailyProductionReport,
  useGetStitcherPointsReport, useGetTeamPointsReport,
  useListTeams, useListOutsourceTransfers, useListProducts
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { fmtCode } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { FilterBar } from "@/components/filter-bar";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

function useProductOptions() {
  const { data: products } = useListProducts();
  return products?.filter((p: any) => p.isActive).map((p: any) => ({ value: p.id, label: `${p.code} - ${p.name}` })) || [];
}

export default function ReportsPage() {
  return (
    <AppLayout title="Analytics & Reports">
      <Tabs defaultValue="stitcher" className="w-full">
        <div className="bg-card p-1 rounded-xl shadow-sm border border-border mb-6 inline-block overflow-x-auto max-w-full">
          <TabsList className="bg-transparent h-auto p-0 flex space-x-1">
            <TabsTrigger value="stitcher" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white">Stitcher Performance</TabsTrigger>
            <TabsTrigger value="team" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Team Performance</TabsTrigger>
            <TabsTrigger value="daily" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white">Daily Production</TabsTrigger>
            <TabsTrigger value="outsource" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-violet-600 data-[state=active]:text-white">Outsource Summary</TabsTrigger>
            <TabsTrigger value="stitcher-points" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-amber-600 data-[state=active]:text-white">Stitcher Points</TabsTrigger>
            <TabsTrigger value="team-points" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-amber-600 data-[state=active]:text-white">Team Points</TabsTrigger>
            <TabsTrigger value="pending" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white">Stage Pending</TabsTrigger>
            <TabsTrigger value="batch" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white">Batch Status</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="stitcher" className="mt-0 outline-none"><StitcherReport /></TabsContent>
        <TabsContent value="team" className="mt-0 outline-none"><TeamReport /></TabsContent>
        <TabsContent value="stitcher-points" className="mt-0 outline-none"><StitcherPointsReport /></TabsContent>
        <TabsContent value="team-points" className="mt-0 outline-none"><TeamPointsReport /></TabsContent>
        <TabsContent value="daily" className="mt-0 outline-none"><DailyProductionReport /></TabsContent>
        <TabsContent value="outsource" className="mt-0 outline-none"><OutsourceSummaryReport /></TabsContent>
        <TabsContent value="pending" className="mt-0 outline-none"><PendingReport /></TabsContent>
        <TabsContent value="batch" className="mt-0 outline-none"><BatchReport /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function StitcherReport() {
  const [filters, setFilters] = useState<Record<string, string>>({ startDate: "", endDate: "", productId: "" });
  const productOptions = useProductOptions();

  const filterParams: Record<string, any> = {};
  if (filters.startDate) filterParams.startDate = filters.startDate;
  if (filters.endDate) filterParams.endDate = filters.endDate;
  if (filters.productId) filterParams.productId = Number(filters.productId);

  const { data, isLoading } = useGetStitcherPerformanceReport(filterParams);

  const filterFields = [
    { name: "startDate", label: "From Date", type: "date" as const },
    { name: "endDate", label: "To Date", type: "date" as const },
    { name: "productId", label: "Product", type: "select" as const, options: productOptions },
  ];

  return (
    <>
      <FilterBar fields={filterFields} values={filters} onChange={setFilters} />
      <ReportCard title="Stitcher Performance & Efficiency">
        <Table>
          <TableHeader className="bg-background">
            <TableRow>
              <TableHead>Stitcher Name</TableHead>
              <TableHead className="text-right">Total Issued</TableHead>
              <TableHead className="text-right">Total Received</TableHead>
              <TableHead className="text-right">Pending Qty</TableHead>
              <TableHead className="text-right">Rejected</TableHead>
              <TableHead className="text-right">Efficiency %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow> :
              !data?.length ? <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No data for selected period</TableCell></TableRow> :
              data?.map((row: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-semibold">{row.stitcherName}</TableCell>
                  <TableCell className="text-right">{row.totalIssued}</TableCell>
                  <TableCell className="text-right text-emerald-600 font-bold">{row.totalReceived}</TableCell>
                  <TableCell className="text-right">{row.totalPending}</TableCell>
                  <TableCell className="text-right text-red-500">{row.totalRejected}</TableCell>
                  <TableCell className="text-right">
                    <span className={`px-2 py-1 rounded text-sm font-bold ${row.efficiencyPct! > 90 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {row.efficiencyPct}%
                    </span>
                  </TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </ReportCard>
    </>
  );
}

function TeamReport() {
  const [filters, setFilters] = useState<Record<string, string>>({ startDate: "", endDate: "", teamId: "", productId: "" });
  const { data: teams } = useListTeams();
  const productOptions = useProductOptions();

  const filterParams: Record<string, any> = {};
  if (filters.startDate) filterParams.startDate = filters.startDate;
  if (filters.endDate) filterParams.endDate = filters.endDate;
  if (filters.teamId) filterParams.teamId = Number(filters.teamId);
  if (filters.productId) filterParams.productId = Number(filters.productId);

  const { data, isLoading } = useGetTeamPerformanceReport(filterParams);

  const filterFields = [
    { name: "startDate", label: "From Date", type: "date" as const },
    { name: "endDate", label: "To Date", type: "date" as const },
    { name: "productId", label: "Product", type: "select" as const, options: productOptions },
    { name: "teamId", label: "Team", type: "select" as const, options: teams?.filter((t: any) => t.isActive).map((t: any) => ({ value: t.id, label: `${t.code} - ${t.name}` })) || [] },
  ];

  return (
    <>
      <FilterBar fields={filterFields} values={filters} onChange={setFilters} />
      <ReportCard title="Team Performance & Efficiency">
        <Table>
          <TableHeader className="bg-background">
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead className="text-right">Members</TableHead>
              <TableHead className="text-right">Total Issued</TableHead>
              <TableHead className="text-right">Total Received</TableHead>
              <TableHead className="text-right">Pending Qty</TableHead>
              <TableHead className="text-right">Rejected</TableHead>
              <TableHead className="text-right">Efficiency %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={7} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow> :
              !data?.length ? <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No team allocation data found</TableCell></TableRow> :
              data?.map((row: any, i: number) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="font-semibold">{row.teamName}</div>
                    {row.teamCode && <div className="text-xs text-muted-foreground">{row.teamCode}</div>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="font-mono">{row.memberCount ?? '-'}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{row.totalIssued}</TableCell>
                  <TableCell className="text-right text-emerald-600 font-bold">{row.totalReceived}</TableCell>
                  <TableCell className="text-right">{row.totalPending}</TableCell>
                  <TableCell className="text-right text-red-500">{row.totalRejected}</TableCell>
                  <TableCell className="text-right">
                    <span className={`px-2 py-1 rounded text-sm font-bold ${(row.efficiencyPct ?? 0) > 90 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {row.efficiencyPct ?? 0}%
                    </span>
                  </TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </ReportCard>
    </>
  );
}

function DailyProductionReport() {
  const [filters, setFilters] = useState<Record<string, string>>({ startDate: "", endDate: "", productId: "" });
  const [targets, setTargets] = useState<Record<string, string>>({
    cutting: "", allocated: "", received: "", finishing: "", finished: "",
    outsource_sent: "", outsource_returned: "", finishing_input: "",
  });
  const [showTargets, setShowTargets] = useState(false);
  const productOptions = useProductOptions();

  const filterParams: Record<string, any> = {};
  if (filters.startDate) filterParams.startDate = filters.startDate;
  if (filters.endDate) filterParams.endDate = filters.endDate;
  if (filters.productId) filterParams.productId = Number(filters.productId);

  const { data, isLoading } = useGetDailyProductionReport(filterParams);

  const [detailData, setDetailData] = useState<{ teams: any[]; stitchers: any[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!filters.startDate) return;
    setDetailLoading(true);
    const params = new URLSearchParams();
    params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);
    if (filters.productId) params.set("productId", filters.productId);
    fetch(`${import.meta.env.BASE_URL}api/reports/daily-production-detail?${params}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setDetailData(d); })
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }, [filters.startDate, filters.endDate, filters.productId]);

  const filterFields = [
    { name: "startDate", label: "From Date", type: "date" as const },
    { name: "endDate", label: "To Date", type: "date" as const },
    { name: "productId", label: "Product", type: "select" as const, options: productOptions },
  ];

  const rows = Array.isArray(data) ? data : data ? [data] : [];

  const totals = useMemo(() => rows.reduce((acc: any, r: any) => ({
    cutting: acc.cutting + (Number(r.cutting) || 0),
    allocated: acc.allocated + (Number(r.allocated) || 0),
    received: acc.received + (Number(r.received) || 0),
    finishing: acc.finishing + (Number(r.finishing) || 0),
    finished: acc.finished + (Number(r.finished) || 0),
    outsource_sent: acc.outsource_sent + (Number(r.outsource_sent) || 0),
    outsource_returned: acc.outsource_returned + (Number(r.outsource_returned) || 0),
    finishing_input: acc.finishing_input + (Number(r.finishing_input) || 0),
  }), { cutting: 0, allocated: 0, received: 0, finishing: 0, finished: 0, outsource_sent: 0, outsource_returned: 0, finishing_input: 0 }), [rows]);

  const metricCards = [
    { key: "cutting", label: "Total Cut", color: "bg-primary/10 text-primary border-primary/20" },
    { key: "allocated", label: "Allocated", color: "bg-violet-50 text-violet-700 border-violet-200" },
    { key: "received", label: "Received", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
    { key: "outsource_sent", label: "Outsource Sent", color: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20" },
    { key: "outsource_returned", label: "Outsource Returned", color: "bg-cyan-500/10 text-cyan-700 border-cyan-500/20" },
    { key: "finishing_input", label: "Finishing Input", color: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
    { key: "finishing", label: "Finishing Output", color: "bg-orange-500/10 text-orange-700 border-orange-500/20" },
    { key: "finished", label: "Stored", color: "bg-teal-50 text-teal-700 border-teal-200" },
  ];

  return (
    <>
      <FilterBar fields={filterFields} values={filters} onChange={setFilters} />

      <div className="flex items-center gap-2 mb-4">
        <button
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${showTargets ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/50"}`}
          onClick={() => setShowTargets(!showTargets)}
        >
          {showTargets ? "Hide Targets" : "Set Targets"}
        </button>
      </div>

      {showTargets && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {metricCards.map(mc => (
            <div key={mc.key}>
              <label className="text-xs text-muted-foreground block mb-1">{mc.label} Target</label>
              <input
                type="number" min="0" placeholder="Optional"
                className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 bg-card focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none"
                value={targets[mc.key] || ""}
                onChange={e => setTargets(prev => ({ ...prev, [mc.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {metricCards.map(mc => {
            const actual = (totals as any)[mc.key] || 0;
            const target = Number(targets[mc.key]) || 0;
            return (
              <Card key={mc.key} className={`${mc.color} border rounded-xl`}>
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-display font-bold">{actual}</div>
                  <div className="text-xs font-medium mt-0.5">{mc.label}</div>
                  {target > 0 && (
                    <div className={`text-xs mt-1 font-semibold ${actual >= target ? "text-emerald-600" : "text-red-500"}`}>
                      Target: {target} ({actual >= target ? "Achieved" : `${target - actual} short`})
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {detailData && (detailData.teams.length > 0 || detailData.stitchers.length > 0) && (
        <>
          {detailData.teams.length > 0 && (
            <>
              <div className="bg-card border border-border rounded-xl p-4 mb-4">
                <h3 className="text-sm font-semibold mb-3 text-foreground">Team-wise Allocated vs Received</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={detailData.teams} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="teamName" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Legend />
                    <Bar dataKey="totalAllocated" name="Allocated" fill="hsl(262, 83%, 58%)" radius={[4,4,0,0]} />
                    <Bar dataKey="totalReceived" name="Received" fill="hsl(160, 84%, 39%)" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ReportCard title="Team-wise Breakdown">
                <Table>
                  <TableHeader className="bg-background">
                    <TableRow>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-right">Allocated</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailData.teams.map((t: any) => (
                      <TableRow key={t.teamId}>
                        <TableCell className="font-semibold">{t.teamName}</TableCell>
                        <TableCell className="text-right">{t.totalAllocated}</TableCell>
                        <TableCell className="text-right text-emerald-600 font-bold">{t.totalReceived}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ReportCard>
            </>
          )}

          {detailData.stitchers.length > 0 && (
            <>
              <div className="bg-card border border-border rounded-xl p-4 mb-4 mt-4">
                <h3 className="text-sm font-semibold mb-3 text-foreground">Stitcher-wise Allocated vs Received</h3>
                <ResponsiveContainer width="100%" height={Math.max(250, detailData.stitchers.length * 30)}>
                  <BarChart data={detailData.stitchers} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis type="category" dataKey="stitcherName" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={75} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Legend />
                    <Bar dataKey="totalAllocated" name="Allocated" fill="hsl(262, 83%, 58%)" radius={[0,4,4,0]} />
                    <Bar dataKey="totalReceived" name="Received" fill="hsl(160, 84%, 39%)" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ReportCard title="Stitcher-wise Breakdown">
                <Table>
                  <TableHeader className="bg-background">
                    <TableRow>
                      <TableHead>Stitcher</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-right">Allocated</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailData.stitchers.map((s: any) => (
                      <TableRow key={s.stitcherId}>
                        <TableCell className="font-semibold">{s.stitcherName}</TableCell>
                        <TableCell className="text-muted-foreground">{s.teamName || "—"}</TableCell>
                        <TableCell className="text-right">{s.totalAllocated}</TableCell>
                        <TableCell className="text-right text-emerald-600 font-bold">{s.totalReceived}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ReportCard>
            </>
          )}
        </>
      )}
      {detailLoading && <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>}

      <ReportCard title="Date-wise Production Summary">
        <Table>
          <TableHeader className="bg-background">
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Cut</TableHead>
              <TableHead className="text-right">Allocated</TableHead>
              <TableHead className="text-right">Received</TableHead>
              <TableHead className="text-right">OS Sent</TableHead>
              <TableHead className="text-right">OS Returned</TableHead>
              <TableHead className="text-right">Fin. Input</TableHead>
              <TableHead className="text-right">Fin. Output</TableHead>
              <TableHead className="text-right">Stored</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={9} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow> :
              !rows.length ? <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">Select a date range to view production data</TableCell></TableRow> :
              rows.map((row: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-semibold">{row.date || `${row.startDate} – ${row.endDate}`}</TableCell>
                  <TableCell className="text-right">{row.cutting}</TableCell>
                  <TableCell className="text-right">{row.allocated}</TableCell>
                  <TableCell className="text-right text-emerald-600 font-bold">{row.received}</TableCell>
                  <TableCell className="text-right">{row.outsource_sent || 0}</TableCell>
                  <TableCell className="text-right">{row.outsource_returned || 0}</TableCell>
                  <TableCell className="text-right">{row.finishing_input || 0}</TableCell>
                  <TableCell className="text-right">{row.finishing ?? '-'}</TableCell>
                  <TableCell className="text-right">{row.finished}</TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </ReportCard>
    </>
  );
}

function PendingReport() {
  const { data, isLoading } = useGetStagePendingReport();
  return (
    <ReportCard title="Bottleneck / Stage Pending Analysis">
      <Table>
        <TableHeader className="bg-background">
          <TableRow>
            <TableHead>Production Stage</TableHead>
            <TableHead className="text-right">Batches Stuck</TableHead>
            <TableHead className="text-right">Total Pieces Pending</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? <TableRow><TableCell colSpan={3} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow> :
            data?.map((row: any, i: number) => (
              <TableRow key={i}>
                <TableCell className="font-semibold capitalize text-lg">{row.stage}</TableCell>
                <TableCell className="text-right text-muted-foreground">{row.batchCount}</TableCell>
                <TableCell className="text-right font-display text-2xl font-bold text-amber-600">{row.pendingQuantity}</TableCell>
              </TableRow>
            ))
          }
        </TableBody>
      </Table>
    </ReportCard>
  );
}

function BatchReport() {
  const [filters, setFilters] = useState<Record<string, string>>({ batchNumber: "", productId: "" });
  const productOptions = useProductOptions();
  const filterParams: Record<string, any> = {};
  if (filters.batchNumber) filterParams.batchNumber = filters.batchNumber;
  if (filters.productId) filterParams.productId = Number(filters.productId);
  const { data, isLoading } = useGetBatchStatusReport(filterParams);

  const batchFilterFields = [
    { name: "batchNumber", label: "Batch Number", type: "text" as const, placeholder: "Search batch..." },
    { name: "productId", label: "Product", type: "select" as const, options: productOptions },
  ];

  return (
    <>
    <FilterBar fields={batchFilterFields} values={filters} onChange={setFilters} />
    <ReportCard title="All Batches Overview">
      <Table>
        <TableHeader className="bg-background">
          <TableRow>
            <TableHead>Batch</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Cut</TableHead>
            <TableHead>Allocated</TableHead>
            <TableHead>Received</TableHead>
            <TableHead>Finished</TableHead>
            <TableHead>Current Stage</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? <TableRow><TableCell colSpan={7} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow> :
            data?.map((row: any, i: number) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-primary font-medium">{row.batchNumber}</TableCell>
                <TableCell>{fmtCode(row.productCode, row.productName)}</TableCell>
                <TableCell>{row.quantityCut}</TableCell>
                <TableCell>{row.quantityAllocated}</TableCell>
                <TableCell>{row.quantityReceived}</TableCell>
                <TableCell>{row.quantityFinished}</TableCell>
                <TableCell>
                  <Badge className="bg-primary/15 text-primary hover:bg-primary/15 border-none capitalize">{row.currentStage}</Badge>
                </TableCell>
              </TableRow>
            ))
          }
        </TableBody>
      </Table>
    </ReportCard>
    </>
  );
}

function OutsourceSummaryReport() {
  const [filters, setFilters] = useState<Record<string, string>>({ startDate: "", endDate: "", outsourceCategory: "" });
  const filterParams: Record<string, any> = {};
  if (filters.startDate) filterParams.startDate = filters.startDate;
  if (filters.endDate) filterParams.endDate = filters.endDate;
  if (filters.outsourceCategory) filterParams.outsourceCategory = filters.outsourceCategory;

  const { data, isLoading } = useListOutsourceTransfers(filterParams);

  const filterFields = [
    { name: "startDate", label: "From Date", type: "date" as const },
    { name: "endDate", label: "To Date", type: "date" as const },
    { name: "outsourceCategory", label: "Category", type: "select" as const, options: [
      { value: "heat_stone", label: "Heat Stone" },
      { value: "embroidery", label: "Embroidery" },
      { value: "hand_stones", label: "Hand Stones" },
    ]},
  ];

  const totalSent = data?.reduce((s, t) => s + (t.quantitySent || 0), 0) || 0;
  const totalReturned = data?.reduce((s, t) => s + (t.quantityReturned || 0), 0) || 0;
  const totalDamaged = data?.reduce((s, t) => s + (t.quantityDamaged || 0), 0) || 0;
  const totalPending = totalSent - totalReturned - totalDamaged;

  const byCat: Record<string, { sent: number; returned: number; damaged: number }> = {};
  const byDate: Record<string, { sent: number; returned: number; damaged: number }> = {};
  const byVendor: Record<string, { sent: number; returned: number; damaged: number }> = {};
  data?.forEach(t => {
    const cat = t.outsourceCategory || "unknown";
    if (!byCat[cat]) byCat[cat] = { sent: 0, returned: 0, damaged: 0 };
    byCat[cat].sent += t.quantitySent || 0;
    byCat[cat].returned += t.quantityReturned || 0;
    byCat[cat].damaged += t.quantityDamaged || 0;

    const dateKey = t.sendDate ? format(new Date(t.sendDate), "yyyy-MM-dd") : "unknown";
    if (!byDate[dateKey]) byDate[dateKey] = { sent: 0, returned: 0, damaged: 0 };
    byDate[dateKey].sent += t.quantitySent || 0;
    byDate[dateKey].returned += t.quantityReturned || 0;
    byDate[dateKey].damaged += t.quantityDamaged || 0;

    const vendor = t.vendorName || "Unknown";
    if (!byVendor[vendor]) byVendor[vendor] = { sent: 0, returned: 0, damaged: 0 };
    byVendor[vendor].sent += t.quantitySent || 0;
    byVendor[vendor].returned += t.quantityReturned || 0;
    byVendor[vendor].damaged += t.quantityDamaged || 0;
  });

  return (
    <>
    <FilterBar fields={filterFields} values={filters} onChange={setFilters} />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-violet-50 rounded-xl p-4 border border-violet-200">
        <div className="text-xs text-violet-600 font-medium">Total Sent</div>
        <div className="text-2xl font-bold text-violet-800">{totalSent}</div>
      </div>
      <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
        <div className="text-xs text-emerald-600 font-medium">Total Returned</div>
        <div className="text-2xl font-bold text-emerald-800">{totalReturned}</div>
      </div>
      <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20">
        <div className="text-xs text-red-600 font-medium">Total Damaged</div>
        <div className="text-2xl font-bold text-red-800">{totalDamaged}</div>
      </div>
      <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20">
        <div className="text-xs text-amber-600 font-medium">Still Pending</div>
        <div className="text-2xl font-bold text-amber-800">{totalPending}</div>
      </div>
    </div>

    <ReportCard title="By Category">
      <Table>
        <TableHeader className="bg-background">
          <TableRow>
            <TableHead className="py-3">Category</TableHead>
            <TableHead className="text-right">Sent</TableHead>
            <TableHead className="text-right">Returned</TableHead>
            <TableHead className="text-right">Damaged</TableHead>
            <TableHead className="text-right">Pending</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(byCat).map(([cat, v]) => (
            <TableRow key={cat}>
              <TableCell className="capitalize font-medium">{cat.replace(/_/g, " ")}</TableCell>
              <TableCell className="text-right font-bold text-violet-600">{v.sent}</TableCell>
              <TableCell className="text-right font-semibold text-emerald-600">{v.returned}</TableCell>
              <TableCell className="text-right font-semibold text-red-500">{v.damaged}</TableCell>
              <TableCell className="text-right font-bold text-amber-700">{v.sent - v.returned - v.damaged}</TableCell>
            </TableRow>
          ))}
          {Object.keys(byCat).length === 0 && !isLoading && (
            <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No outsource data for the selected period.</TableCell></TableRow>
          )}
          {isLoading && (
            <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </ReportCard>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
    <ReportCard title="By Date">
      <Table>
        <TableHeader className="bg-background">
          <TableRow>
            <TableHead className="py-3">Date</TableHead>
            <TableHead className="text-right">Sent</TableHead>
            <TableHead className="text-right">Returned</TableHead>
            <TableHead className="text-right">Damaged</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(byDate).sort(([a], [b]) => b.localeCompare(a)).map(([d, v]) => (
            <TableRow key={d}>
              <TableCell className="font-medium text-sm">{d !== "unknown" ? format(new Date(d), "MMM d, yyyy") : "Unknown"}</TableCell>
              <TableCell className="text-right font-bold text-violet-600">{v.sent}</TableCell>
              <TableCell className="text-right font-semibold text-emerald-600">{v.returned}</TableCell>
              <TableCell className="text-right font-semibold text-red-500">{v.damaged}</TableCell>
            </TableRow>
          ))}
          {Object.keys(byDate).length === 0 && !isLoading && (
            <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No data.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </ReportCard>

    <ReportCard title="By Vendor">
      <Table>
        <TableHeader className="bg-background">
          <TableRow>
            <TableHead className="py-3">Vendor</TableHead>
            <TableHead className="text-right">Sent</TableHead>
            <TableHead className="text-right">Returned</TableHead>
            <TableHead className="text-right">Damaged</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(byVendor).sort(([,a], [,b]) => b.sent - a.sent).map(([vendor, v]) => (
            <TableRow key={vendor}>
              <TableCell className="font-medium text-sm">{vendor}</TableCell>
              <TableCell className="text-right font-bold text-violet-600">{v.sent}</TableCell>
              <TableCell className="text-right font-semibold text-emerald-600">{v.returned}</TableCell>
              <TableCell className="text-right font-semibold text-red-500">{v.damaged}</TableCell>
            </TableRow>
          ))}
          {Object.keys(byVendor).length === 0 && !isLoading && (
            <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No data.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </ReportCard>
    </div>

    <ReportCard title="Transfer Details">
      <Table>
        <TableHeader className="bg-background">
          <TableRow>
            <TableHead className="py-3">Batch</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead className="text-right">Sent</TableHead>
            <TableHead className="text-right">Returned</TableHead>
            <TableHead className="text-right">Damaged</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Send Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
          )}
          {data?.map((t) => (
            <TableRow key={t.id}>
              <TableCell>
                <div className="font-semibold text-sm">{t.batchNumber}</div>
                <div className="text-xs text-muted-foreground">{t.productName}</div>
              </TableCell>
              <TableCell className="capitalize text-sm">{t.outsourceCategory?.replace(/_/g, " ")}</TableCell>
              <TableCell className="text-sm">{t.vendorName || "-"}</TableCell>
              <TableCell className="text-right font-bold text-violet-600">{t.quantitySent}</TableCell>
              <TableCell className="text-right font-semibold text-emerald-600">{t.quantityReturned || 0}</TableCell>
              <TableCell className="text-right font-semibold text-red-500">{t.quantityDamaged || 0}</TableCell>
              <TableCell>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                  t.status === "returned" ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" :
                  t.status === "partial_return" ? "bg-primary/10 text-primary border-primary/20" :
                  "bg-amber-500/10 text-amber-700 border-amber-500/20"
                }`}>{t.status?.replace(/_/g, " ")}</span>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{t.sendDate ? format(new Date(t.sendDate), "MMM d, yyyy") : "-"}</TableCell>
            </TableRow>
          ))}
          {!isLoading && (!data || data.length === 0) && (
            <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No outsource transfers found.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </ReportCard>
    </>
  );
}

function StitcherPointsReport() {
  const [filters, setFilters] = useState<Record<string, string>>({ startDate: "", endDate: "" });
  const filterParams: Record<string, any> = {};
  if (filters.startDate) filterParams.startDate = filters.startDate;
  if (filters.endDate) filterParams.endDate = filters.endDate;

  const { data, isLoading } = useGetStitcherPointsReport(filterParams);
  const rows = (data || []) as any[];
  const grandTotal = rows.reduce((s: number, r: any) => s + (r.totalPoints || 0), 0);

  const stitcherSummary = new Map<string, { name: string; teamName: string; totalQty: number; totalPts: number }>();
  for (const r of rows) {
    const key = r.stitcherName || "Unknown";
    const ex = stitcherSummary.get(key) || { name: key, teamName: r.teamName || "", totalQty: 0, totalPts: 0 };
    ex.totalQty += r.completedQty || 0;
    ex.totalPts += r.totalPoints || 0;
    stitcherSummary.set(key, ex);
  }

  return (
    <>
      <FilterBar fields={[
        { name: "startDate", label: "From Date", type: "date" as const },
        { name: "endDate", label: "To Date", type: "date" as const },
      ]} values={filters} onChange={setFilters} />
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Card className="p-4 text-center"><div className="text-xs text-muted-foreground">Total Points (Period)</div><div className="text-2xl font-bold text-amber-600">{Math.round(grandTotal * 100) / 100}</div></Card>
        <Card className="p-4 text-center"><div className="text-xs text-muted-foreground">Stitchers with Points</div><div className="text-2xl font-bold">{stitcherSummary.size}</div></Card>
      </div>
      <ReportCard title="Stitcher Points — Product Breakdown">
        <Table>
          <TableHeader className="bg-background">
            <TableRow>
              <TableHead>Stitcher</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Product Code</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead className="text-right">Completed Qty</TableHead>
              <TableHead className="text-right">Points/Pc</TableHead>
              <TableHead className="text-right">Total Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={7} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow> :
              !rows.length ? <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No data for selected period</TableCell></TableRow> :
              rows.map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-semibold">{r.stitcherName}</TableCell>
                  <TableCell className="text-muted-foreground">{r.teamName || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.productCode}</TableCell>
                  <TableCell>{r.productName}</TableCell>
                  <TableCell className="text-right">{r.completedQty}</TableCell>
                  <TableCell className="text-right font-mono">{r.pointsPerPiece || 0}</TableCell>
                  <TableCell className="text-right font-bold text-amber-600">{r.totalPoints}</TableCell>
                </TableRow>
              ))
            }
            {rows.length > 0 && (
              <TableRow className="bg-amber-500/10 font-bold border-t-2">
                <TableCell colSpan={6} className="text-right">Grand Total</TableCell>
                <TableCell className="text-right text-amber-700 text-lg">{Math.round(grandTotal * 100) / 100}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ReportCard>

      {stitcherSummary.size > 0 && (
        <ReportCard title="Stitcher Points — Summary">
          <Table>
            <TableHeader className="bg-background">
              <TableRow>
                <TableHead>Stitcher</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Total Completed</TableHead>
                <TableHead className="text-right">Total Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(stitcherSummary.values()).sort((a, b) => b.totalPts - a.totalPts).map((s, i) => (
                <TableRow key={i}>
                  <TableCell className="font-semibold">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.teamName || "—"}</TableCell>
                  <TableCell className="text-right">{s.totalQty}</TableCell>
                  <TableCell className="text-right font-bold text-amber-600">{Math.round(s.totalPts * 100) / 100}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ReportCard>
      )}
    </>
  );
}

function TeamPointsReport() {
  const [filters, setFilters] = useState<Record<string, string>>({ startDate: "", endDate: "", teamId: "" });
  const { data: teams } = useListTeams();
  const filterParams: Record<string, any> = {};
  if (filters.startDate) filterParams.startDate = filters.startDate;
  if (filters.endDate) filterParams.endDate = filters.endDate;
  if (filters.teamId) filterParams.teamId = Number(filters.teamId);

  const { data, isLoading } = useGetTeamPointsReport(filterParams);
  const rows = (data || []) as any[];
  const grandTotal = rows.reduce((s: number, r: any) => s + (r.totalPoints || 0), 0);

  const teamSummary = new Map<string, { name: string; code: string; totalQty: number; totalPts: number }>();
  for (const r of rows) {
    const key = r.teamName || "Unknown";
    const ex = teamSummary.get(key) || { name: key, code: r.teamCode || "", totalQty: 0, totalPts: 0 };
    ex.totalQty += r.completedQty || 0;
    ex.totalPts += r.totalPoints || 0;
    teamSummary.set(key, ex);
  }

  return (
    <>
      <FilterBar fields={[
        { name: "startDate", label: "From Date", type: "date" as const },
        { name: "endDate", label: "To Date", type: "date" as const },
        { name: "teamId", label: "Team", type: "select" as const, options: teams?.filter((t: any) => t.isActive).map((t: any) => ({ value: t.id, label: `${t.code || ""} - ${t.name}` })) || [] },
      ]} values={filters} onChange={setFilters} />
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Card className="p-4 text-center"><div className="text-xs text-muted-foreground">Total Points (Period)</div><div className="text-2xl font-bold text-amber-600">{Math.round(grandTotal * 100) / 100}</div></Card>
        <Card className="p-4 text-center"><div className="text-xs text-muted-foreground">Teams with Points</div><div className="text-2xl font-bold">{teamSummary.size}</div></Card>
      </div>
      <ReportCard title="Team Points — Product Breakdown">
        <Table>
          <TableHeader className="bg-background">
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead>Product Code</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead className="text-right">Completed Qty</TableHead>
              <TableHead className="text-right">Points/Pc</TableHead>
              <TableHead className="text-right">Total Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow> :
              !rows.length ? <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No team points data found</TableCell></TableRow> :
              rows.map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="font-semibold">{r.teamName}</div>
                    {r.teamCode && <div className="text-xs text-muted-foreground">{r.teamCode}</div>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.productCode}</TableCell>
                  <TableCell>{r.productName}</TableCell>
                  <TableCell className="text-right">{r.completedQty}</TableCell>
                  <TableCell className="text-right font-mono">{r.pointsPerPiece || 0}</TableCell>
                  <TableCell className="text-right font-bold text-amber-600">{r.totalPoints}</TableCell>
                </TableRow>
              ))
            }
            {rows.length > 0 && (
              <TableRow className="bg-amber-500/10 font-bold border-t-2">
                <TableCell colSpan={5} className="text-right">Grand Total</TableCell>
                <TableCell className="text-right text-amber-700 text-lg">{Math.round(grandTotal * 100) / 100}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ReportCard>

      {teamSummary.size > 0 && (
        <ReportCard title="Team Points — Summary">
          <Table>
            <TableHeader className="bg-background">
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Total Completed</TableHead>
                <TableHead className="text-right">Total Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(teamSummary.values()).sort((a, b) => b.totalPts - a.totalPts).map((s, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="font-semibold">{s.name}</div>
                    {s.code && <div className="text-xs text-muted-foreground">{s.code}</div>}
                  </TableCell>
                  <TableCell className="text-right">{s.totalQty}</TableCell>
                  <TableCell className="text-right font-bold text-amber-600">{Math.round(s.totalPts * 100) / 100}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ReportCard>
      )}
    </>
  );
}

function ReportCard({ title, children }: any) {
  return (
    <Card className="shadow-lg border-border rounded-2xl overflow-hidden animate-in fade-in duration-500">
      <CardHeader className="bg-card border-b border-border py-5 px-6 flex flex-row items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <CardTitle className="text-xl font-display text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 bg-card">
        {children}
      </CardContent>
    </Card>
  );
}
