import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, GitBranch, ArrowRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSearchTraceability, useGetBatchTrace } from "@workspace/api-client-react";
import { format } from "date-fns";
import { fmtCode } from "@/lib/utils";

export default function TraceabilityPage() {
  const [search, setSearch] = useState("");
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);

  const { data: searchResults, isLoading: searching } = useSearchTraceability(
    { q: search },
    { query: { enabled: search.length > 2 } }
  );

  return (
    <AppLayout title="Batch Journey Traceability">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Search Panel */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-lg border-border rounded-2xl">
            <CardHeader className="bg-background/50 border-b border-border">
              <CardTitle className="text-lg font-display text-foreground flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" /> Find Batch
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                <Input 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Scan or type batch number..." 
                  className="pl-10 h-12 rounded-xl text-lg bg-background border-border focus-visible:ring-primary/20"
                />
              </div>

              <div className="mt-6 space-y-2">
                {searching && <div className="text-center p-4"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></div>}
                
                {!searching && searchResults?.map((res) => (
                  <button 
                    key={res.id}
                    onClick={() => setSelectedBatch(res.batchNumber!)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${selectedBatch === res.batchNumber ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-border hover:bg-background'}`}
                  >
                    <p className="font-mono text-primary font-bold">{res.batchNumber}</p>
                    <p className="text-sm font-semibold text-foreground mt-1">{res.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{res.subLabel}</p>
                  </button>
                ))}

                {search.length > 2 && searchResults?.length === 0 && !searching && (
                  <div className="text-center p-4 text-muted-foreground">No batches found</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Timeline Panel */}
        <div className="lg:col-span-2">
          {selectedBatch ? (
            <BatchTimeline batchNumber={selectedBatch} />
          ) : (
            <Card className="h-full min-h-[400px] border-dashed border-2 border-border rounded-2xl flex flex-col items-center justify-center text-muted-foreground bg-background/50">
              <GitBranch className="h-16 w-16 mb-4 text-muted-foreground" />
              <p className="text-lg font-medium text-muted-foreground">Select a batch to view its full journey</p>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function BatchTimeline({ batchNumber }: { batchNumber: string }) {
  const { data, isLoading } = useGetBatchTrace(batchNumber);

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!data) return null;

  return (
    <Card className="shadow-lg border-border rounded-2xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="bg-gradient-to-br from-primary to-blue-700 text-white p-8 relative overflow-hidden">
        <GitBranch className="absolute right-0 top-0 h-48 w-48 opacity-5 -translate-y-10 translate-x-10" />
        <div className="relative z-10">
          <Badge className="bg-primary/20 text-primary-foreground hover:bg-primary/20 border-primary/30 mb-4">{data.currentStage}</Badge>
          <h2 className="text-4xl font-mono font-bold tracking-tight mb-2">{data.batchNumber}</h2>
          {(data as any).itemCode && (
            <div className="mb-2">
              <span className="font-mono text-sm font-semibold bg-teal-600/30 text-teal-200 border border-teal-500/40 px-2.5 py-1 rounded">
                {(data as any).itemCode}
              </span>
            </div>
          )}
          <p className="text-lg text-muted-foreground">{fmtCode(data.productCode, data.productName)} • {data.sizeName || 'Any'} • {fmtCode(data.colorCode, data.colorName) || 'Any'}</p>
          {(() => {
            const pf = (data as any).productionFor || "reesha_stock";
            if (pf === "purchase_order") return <Badge className="mt-2 bg-violet-500/20 text-violet-200 border-violet-400/30">PO: {(data as any).poNumber || "?"}</Badge>;
            if (pf === "order") return <Badge className="mt-2 bg-orange-500/20 text-orange-200 border-orange-400/30">Order: {(data as any).orderNumber || "?"}</Badge>;
            return <Badge className="mt-2 bg-muted text-muted-foreground border-border/30">Reesha Stock</Badge>;
          })()}
        </div>
      </div>
      
      <CardContent className="p-8">
        <div className="relative pl-8 space-y-10 before:absolute before:inset-0 before:ml-[31px] before:w-0.5 before:-translate-x-px before:bg-muted">
          {data.timeline.map((event, index) => (
            <div key={index} className="relative">
              <div className="absolute left-[-40px] top-1 h-6 w-6 rounded-full bg-card border-4 border-primary shadow-sm z-10 flex items-center justify-center" />
              
              <div className="bg-card border border-border shadow-sm rounded-xl p-5 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-display font-bold text-lg text-foreground capitalize">{event.stage} - {event.eventType}</h3>
                  <span className="text-sm text-muted-foreground font-medium">
                    {format(new Date(event.date), 'MMM d, yyyy HH:mm')}
                  </span>
                </div>
                
                <div className="flex items-center text-muted-foreground mb-4">
                  <div className="bg-muted px-2 py-1 rounded text-sm font-semibold mr-3">Qty: {event.quantity}</div>
                  <span className="text-sm">By: {event.actor || 'System'}</span>
                </div>
                
                {event.details && (
                  <p className="text-sm text-muted-foreground bg-background p-3 rounded-lg border border-border">
                    {event.details}
                  </p>
                )}
              </div>
            </div>
          ))}
          
          <div className="relative">
            <div className="absolute left-[-40px] top-1 h-6 w-6 rounded-full bg-emerald-500/100 border-4 border-emerald-500/20 shadow-sm z-10 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-white" />
            </div>
            <div className="font-display font-bold text-lg text-emerald-600 py-1">Current Status</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
