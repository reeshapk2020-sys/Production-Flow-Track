import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileText } from "lucide-react";
import { 
  useGetStitcherPerformanceReport, useGetStagePendingReport, useGetBatchStatusReport
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { fmtCode } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default function ReportsPage() {
  return (
    <AppLayout title="Analytics & Reports">
      <Tabs defaultValue="stitcher" className="w-full">
        <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 mb-6 inline-block overflow-x-auto max-w-full">
          <TabsList className="bg-transparent h-auto p-0 flex space-x-1">
            <TabsTrigger value="stitcher" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white">Stitcher Performance</TabsTrigger>
            <TabsTrigger value="pending" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white">Stage Pending</TabsTrigger>
            <TabsTrigger value="batch" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white">Batch Status</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="stitcher" className="mt-0 outline-none"><StitcherReport /></TabsContent>
        <TabsContent value="pending" className="mt-0 outline-none"><PendingReport /></TabsContent>
        <TabsContent value="batch" className="mt-0 outline-none"><BatchReport /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function StitcherReport() {
  const { data, isLoading } = useGetStitcherPerformanceReport();

  return (
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
            data?.map((row, i) => (
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
            data?.map((row, i) => (
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
  const { data, isLoading } = useGetBatchStatusReport();
  return (
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
            data?.map((row, i) => (
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
