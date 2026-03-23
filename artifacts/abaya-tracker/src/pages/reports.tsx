import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileText, Users, BarChart3 } from "lucide-react";
import { 
  useGetStitcherPerformanceReport, useGetStagePendingReport, useGetBatchStatusReport,
  useGetTeamPerformanceReport, useGetDailyProductionReport,
  useListTeams, useListOutsourceTransfers
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { fmtCode } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { FilterBar } from "@/components/filter-bar";

export default function ReportsPage() {
  return (
    <AppLayout title="Analytics & Reports">
      <Tabs defaultValue="stitcher" className="w-full">
        <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 mb-6 inline-block overflow-x-auto max-w-full">
          <TabsList className="bg-transparent h-auto p-0 flex space-x-1">
            <TabsTrigger value="stitcher" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white">Stitcher Performance</TabsTrigger>
            <TabsTrigger value="team" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Team Performance</TabsTrigger>
            <TabsTrigger value="daily" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">Daily Production</TabsTrigger>
            <TabsTrigger value="outsource" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-violet-600 data-[state=active]:text-white">Outsource Summary</TabsTrigger>
            <TabsTrigger value="pending" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white">Stage Pending</TabsTrigger>
            <TabsTrigger value="batch" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white">Batch Status</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="stitcher" className="mt-0 outline-none"><StitcherReport /></TabsContent>
        <TabsContent value="team" className="mt-0 outline-none"><TeamReport /></TabsContent>
        <TabsContent value="daily" className="mt-0 outline-none"><DailyProductionReport /></TabsContent>
        <TabsContent value="outsource" className="mt-0 outline-none"><OutsourceSummaryReport /></TabsContent>
        <TabsContent value="pending" className="mt-0 outline-none"><PendingReport /></TabsContent>
        <TabsContent value="batch" className="mt-0 outline-none"><BatchReport /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function StitcherReport() {
  const [filters, setFilters] = useState<Record<string, string>>({ startDate: "", endDate: "" });

  const filterParams: Record<string, any> = {};
  if (filters.startDate) filterParams.startDate = filters.startDate;
  if (filters.endDate) filterParams.endDate = filters.endDate;

  const { data, isLoading } = useGetStitcherPerformanceReport(filterParams);

  const filterFields = [
    { name: "startDate", label: "From Date", type: "date" as const },
    { name: "endDate", label: "To Date", type: "date" as const },
  ];

  return (
    <>
      <FilterBar fields={filterFields} values={filters} onChange={setFilters} />
      <ReportCard title="Stitcher Performance & Efficiency">
        <Table>
          <TableHeader className="bg-slate-50">
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
              !data?.length ? <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-400">No data for selected period</TableCell></TableRow> :
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
  const [filters, setFilters] = useState<Record<string, string>>({ startDate: "", endDate: "", teamId: "" });
  const { data: teams } = useListTeams();

  const filterParams: Record<string, any> = {};
  if (filters.startDate) filterParams.startDate = filters.startDate;
  if (filters.endDate) filterParams.endDate = filters.endDate;
  if (filters.teamId) filterParams.teamId = Number(filters.teamId);

  const { data, isLoading } = useGetTeamPerformanceReport(filterParams);

  const filterFields = [
    { name: "startDate", label: "From Date", type: "date" as const },
    { name: "endDate", label: "To Date", type: "date" as const },
    { name: "teamId", label: "Team", type: "select" as const, options: teams?.filter((t: any) => t.isActive).map((t: any) => ({ value: t.id, label: `${t.code} - ${t.name}` })) || [] },
  ];

  return (
    <>
      <FilterBar fields={filterFields} values={filters} onChange={setFilters} />
      <ReportCard title="Team Performance & Efficiency">
        <Table>
          <TableHeader className="bg-slate-50">
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
              !data?.length ? <TableRow><TableCell colSpan={7} className="text-center py-12 text-slate-400">No team allocation data found</TableCell></TableRow> :
              data?.map((row: any, i: number) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="font-semibold">{row.teamName}</div>
                    {row.teamCode && <div className="text-xs text-slate-400">{row.teamCode}</div>}
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
  const [filters, setFilters] = useState<Record<string, string>>({ startDate: "", endDate: "" });

  const filterParams: Record<string, any> = {};
  if (filters.startDate) filterParams.startDate = filters.startDate;
  if (filters.endDate) filterParams.endDate = filters.endDate;

  const { data, isLoading } = useGetDailyProductionReport(filterParams);

  const filterFields = [
    { name: "startDate", label: "From Date", type: "date" as const },
    { name: "endDate", label: "To Date", type: "date" as const },
  ];

  const rows = Array.isArray(data) ? data : data ? [data] : [];

  return (
    <>
      <FilterBar fields={filterFields} values={filters} onChange={setFilters} />
      {rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-6">
          {(() => {
            const totals = rows.reduce((acc: any, r: any) => ({
              cutting: acc.cutting + (r.cutting || 0),
              allocated: acc.allocated + (r.allocated || 0),
              received: acc.received + (r.received || 0),
              finishing: acc.finishing + (r.finishing || 0),
              finished: acc.finished + (r.finished || 0),
            }), { cutting: 0, allocated: 0, received: 0, finishing: 0, finished: 0 });
            return [
              { label: "Cut", value: totals.cutting, color: "bg-blue-50 text-blue-700 border-blue-200" },
              { label: "Allocated", value: totals.allocated, color: "bg-violet-50 text-violet-700 border-violet-200" },
              { label: "Received", value: totals.received, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
              { label: "Finishing", value: totals.finishing, color: "bg-amber-50 text-amber-700 border-amber-200" },
              { label: "Stored", value: totals.finished, color: "bg-teal-50 text-teal-700 border-teal-200" },
            ].map(card => (
              <Card key={card.label} className={`${card.color} border rounded-xl`}>
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-display font-bold">{card.value}</div>
                  <div className="text-xs font-medium mt-1">{card.label}</div>
                </CardContent>
              </Card>
            ));
          })()}
        </div>
      )}
      <ReportCard title="Date-wise Production Summary">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Cut</TableHead>
              <TableHead className="text-right">Allocated</TableHead>
              <TableHead className="text-right">Received</TableHead>
              <TableHead className="text-right">Finishing</TableHead>
              <TableHead className="text-right">Stored</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow> :
              !rows.length ? <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-400">Select a date range to view production data</TableCell></TableRow> :
              rows.map((row: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-semibold">{row.date || `${row.startDate} – ${row.endDate}`}</TableCell>
                  <TableCell className="text-right">{row.cutting}</TableCell>
                  <TableCell className="text-right">{row.allocated}</TableCell>
                  <TableCell className="text-right text-emerald-600 font-bold">{row.received}</TableCell>
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
        <TableHeader className="bg-slate-50">
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
                <TableCell className="text-right text-slate-500">{row.batchCount}</TableCell>
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
  const [filters, setFilters] = useState<Record<string, string>>({ batchNumber: "" });
  const filterParams: Record<string, any> = {};
  if (filters.batchNumber) filterParams.batchNumber = filters.batchNumber;
  const { data, isLoading } = useGetBatchStatusReport(filterParams);

  const batchFilterFields = [
    { name: "batchNumber", label: "Batch Number", type: "text" as const, placeholder: "Search batch..." },
  ];

  return (
    <>
    <FilterBar fields={batchFilterFields} values={filters} onChange={setFilters} />
    <ReportCard title="All Batches Overview">
      <Table>
        <TableHeader className="bg-slate-50">
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
                  <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none capitalize">{row.currentStage}</Badge>
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
  data?.forEach(t => {
    const cat = t.outsourceCategory || "unknown";
    if (!byCat[cat]) byCat[cat] = { sent: 0, returned: 0, damaged: 0 };
    byCat[cat].sent += t.quantitySent || 0;
    byCat[cat].returned += t.quantityReturned || 0;
    byCat[cat].damaged += t.quantityDamaged || 0;
  });

  return (
    <>
    <FilterBar fields={filterFields} values={filters} onChange={setFilters} />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-violet-50 rounded-xl p-4 border border-violet-200">
        <div className="text-xs text-violet-600 font-medium">Total Sent</div>
        <div className="text-2xl font-bold text-violet-800">{totalSent}</div>
      </div>
      <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
        <div className="text-xs text-emerald-600 font-medium">Total Returned</div>
        <div className="text-2xl font-bold text-emerald-800">{totalReturned}</div>
      </div>
      <div className="bg-red-50 rounded-xl p-4 border border-red-200">
        <div className="text-xs text-red-600 font-medium">Total Damaged</div>
        <div className="text-2xl font-bold text-red-800">{totalDamaged}</div>
      </div>
      <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
        <div className="text-xs text-amber-600 font-medium">Still Pending</div>
        <div className="text-2xl font-bold text-amber-800">{totalPending}</div>
      </div>
    </div>

    <ReportCard title="By Category">
      <Table>
        <TableHeader className="bg-slate-50">
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
            <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">No outsource data for the selected period.</TableCell></TableRow>
          )}
          {isLoading && (
            <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-300" /></TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </ReportCard>

    <ReportCard title="Transfer Details">
      <Table>
        <TableHeader className="bg-slate-50">
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
            <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-300" /></TableCell></TableRow>
          )}
          {data?.map((t) => (
            <TableRow key={t.id}>
              <TableCell>
                <div className="font-semibold text-sm">{t.batchNumber}</div>
                <div className="text-xs text-slate-500">{t.productName}</div>
              </TableCell>
              <TableCell className="capitalize text-sm">{t.outsourceCategory?.replace(/_/g, " ")}</TableCell>
              <TableCell className="text-sm">{t.vendorName || "-"}</TableCell>
              <TableCell className="text-right font-bold text-violet-600">{t.quantitySent}</TableCell>
              <TableCell className="text-right font-semibold text-emerald-600">{t.quantityReturned || 0}</TableCell>
              <TableCell className="text-right font-semibold text-red-500">{t.quantityDamaged || 0}</TableCell>
              <TableCell>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                  t.status === "returned" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                  t.status === "partial_return" ? "bg-blue-50 text-blue-700 border-blue-200" :
                  "bg-amber-50 text-amber-700 border-amber-200"
                }`}>{t.status?.replace(/_/g, " ")}</span>
              </TableCell>
              <TableCell className="text-sm text-slate-600">{t.sendDate ? format(new Date(t.sendDate), "MMM d, yyyy") : "-"}</TableCell>
            </TableRow>
          ))}
          {!isLoading && (!data || data.length === 0) && (
            <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-500">No outsource transfers found.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </ReportCard>
    </>
  );
}

function ReportCard({ title, children }: any) {
  return (
    <Card className="shadow-lg border-slate-200 rounded-2xl overflow-hidden animate-in fade-in duration-500">
      <CardHeader className="bg-white border-b border-slate-100 py-5 px-6 flex flex-row items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <CardTitle className="text-xl font-display text-slate-800">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 bg-white">
        {children}
      </CardContent>
    </Card>
  );
}
