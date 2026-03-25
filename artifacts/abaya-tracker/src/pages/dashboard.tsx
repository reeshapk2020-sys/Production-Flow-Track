import { useGetDashboard } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scissors, Send, Inbox, Package, Loader2, ArrowRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  const { data, isLoading } = useGetDashboard();

  if (isLoading || !data) {
    return (
      <AppLayout title="Dashboard">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const chartData = [
    { name: "Cutting", value: data.todayCuttingQty },
    { name: "Allocated", value: data.todayAllocationQty },
    { name: "Received", value: data.todayReceivedQty },
    { name: "Finished", value: data.todayFinishedQty },
  ];

  return (
    <AppLayout title="Production Dashboard">
      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Today's Cutting" value={data.todayCuttingQty} icon={Scissors} trend="WIP" color="text-primary" bg="bg-primary/15" />
        <StatCard title="Today's Allocation" value={data.todayAllocationQty} icon={Send} trend="In Progress" color="text-amber-600" bg="bg-amber-100" />
        <StatCard title="Today's Receiving" value={data.todayReceivedQty} icon={Inbox} trend="Quality Check" color="text-indigo-600" bg="bg-indigo-100" />
        <StatCard title="Today's Finished" value={data.todayFinishedQty} icon={Package} trend="Store Ready" color="text-emerald-600" bg="bg-emerald-100" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Chart */}
        <Card className="lg:col-span-2 shadow-md border-border rounded-2xl overflow-hidden">
          <CardHeader className="bg-background/50 border-b border-border">
            <CardTitle className="text-lg font-display text-foreground">Today's Pipeline Volume</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))'}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))'}} />
                  <Tooltip 
                    cursor={{fill: 'hsl(var(--muted))'}}
                    contentStyle={{borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))'}}
                  />
                  <Bar dataKey="value" fill="var(--color-primary)" radius={[6, 6, 0, 0]} maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Secondary Stats */}
        <div className="space-y-6">
          <Card className="shadow-md border-border rounded-2xl">
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pending with Stitchers</h3>
              <p className="text-4xl font-display font-bold text-foreground">{data.pendingWithStitchers}</p>
              <div className="mt-4 pt-4 border-t border-border">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pending in Finishing</h3>
                <p className="text-4xl font-display font-bold text-foreground">{data.pendingInFinishing}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-md border-border rounded-2xl bg-gradient-to-br from-primary to-blue-700 text-white border-none">
            <CardContent className="p-6 relative overflow-hidden">
              <Package className="absolute right-0 bottom-0 h-32 w-32 text-white opacity-10 translate-x-8 translate-y-8" />
              <h3 className="text-sm font-semibold text-primary-foreground uppercase tracking-wider mb-2">Finished Stock Total</h3>
              <p className="text-4xl font-display font-bold text-white relative z-10">{data.finishedStockQty}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="shadow-md border-border rounded-2xl">
          <CardHeader className="bg-background/50 border-b border-border flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-display text-foreground">Recent Batches</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-background/50 hover:bg-background/50">
                  <TableHead>Batch</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentBatches?.slice(0, 5).map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="font-medium">{batch.batchNumber}</TableCell>
                    <TableCell>{batch.productName}</TableCell>
                    <TableCell>{batch.quantityCut}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-muted">{batch.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {!data.recentBatches?.length && (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No recent batches</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-md border-border rounded-2xl">
          <CardHeader className="bg-background/50 border-b border-border">
            <CardTitle className="text-lg font-display text-foreground">Top Performing Stitchers</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-background/50 hover:bg-background/50">
                  <TableHead>Stitcher</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Efficiency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topStitchers?.slice(0, 5).map((s, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{s.stitcherName}</TableCell>
                    <TableCell>{s.totalIssued}</TableCell>
                    <TableCell className="text-emerald-600 font-semibold">{s.totalReceived}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <span className="mr-2 text-sm">{s.efficiencyPct}%</span>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="bg-emerald-500/100 h-2 rounded-full" style={{ width: `${Math.min(s.efficiencyPct || 0, 100)}%` }} />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!data.topStitchers?.length && (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No stitcher data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function StatCard({ title, value, icon: Icon, trend, color, bg }: any) {
  return (
    <Card className="shadow-md border-border rounded-2xl overflow-hidden group hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
            <h3 className="text-3xl font-display font-bold text-foreground group-hover:text-primary transition-colors">{value}</h3>
          </div>
          <div className={`p-3 rounded-xl ${bg} ${color}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
        <div className="mt-4 flex items-center text-sm text-muted-foreground">
          <ArrowRight className="h-4 w-4 mr-1 inline" />
          {trend}
        </div>
      </CardContent>
    </Card>
  );
}
