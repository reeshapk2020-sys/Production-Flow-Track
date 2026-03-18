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
          <Card className="shadow-lg border-slate-200 rounded-2xl">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-lg font-display text-slate-800 flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" /> Find Batch
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <Input 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Scan or type batch number..." 
                  className="pl-10 h-12 rounded-xl text-lg bg-slate-50 border-slate-200 focus-visible:ring-primary/20"
                />
              </div>

              <div className="mt-6 space-y-2">
                {searching && <div className="text-center p-4"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></div>}
                
                {!searching && searchResults?.map((res) => (
                  <button 
                    key={res.id}
                    onClick={() => setSelectedBatch(res.batchNumber!)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${selectedBatch === res.batchNumber ? 'border-primary bg-primary/5 shadow-sm' : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'}`}
                  >
                    <p className="font-mono text-primary font-bold">{res.batchNumber}</p>
                    <p className="text-sm font-semibold text-slate-800 mt-1">{res.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{res.subLabel}</p>
                  </button>
                ))}

                {search.length > 2 && searchResults?.length === 0 && !searching && (
                  <div className="text-center p-4 text-slate-500">No batches found</div>
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
            <Card className="h-full min-h-[400px] border-dashed border-2 border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
              <GitBranch className="h-16 w-16 mb-4 text-slate-300" />
              <p className="text-lg font-medium text-slate-500">Select a batch to view its full journey</p>
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
    <Card className="shadow-lg border-slate-200 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="bg-slate-900 text-white p-8 relative overflow-hidden">
        <GitBranch className="absolute right-0 top-0 h-48 w-48 opacity-5 -translate-y-10 translate-x-10" />
        <div className="relative z-10">
          <Badge className="bg-primary/20 text-blue-200 hover:bg-primary/20 border-primary/30 mb-4">{data.currentStage}</Badge>
          <h2 className="text-4xl font-mono font-bold tracking-tight mb-2">{data.batchNumber}</h2>
          <p className="text-lg text-slate-300">{fmtCode(data.productCode, data.productName)} • {data.sizeName || 'Any'} • {fmtCode(data.colorCode, data.colorName) || 'Any'}</p>
        </div>
      </div>
      
      <CardContent className="p-8">
        <div className="relative pl-8 space-y-10 before:absolute before:inset-0 before:ml-[31px] before:w-0.5 before:-translate-x-px before:bg-slate-200">
          {data.timeline.map((event, index) => (
            <div key={index} className="relative">
              <div className="absolute left-[-40px] top-1 h-6 w-6 rounded-full bg-white border-4 border-primary shadow-sm z-10 flex items-center justify-center" />
              
              <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-display font-bold text-lg text-slate-800 capitalize">{event.stage} - {event.eventType}</h3>
                  <span className="text-sm text-slate-500 font-medium">
                    {format(new Date(event.date), 'MMM d, yyyy HH:mm')}
                  </span>
                </div>
                
                <div className="flex items-center text-slate-600 mb-4">
                  <div className="bg-slate-100 px-2 py-1 rounded text-sm font-semibold mr-3">Qty: {event.quantity}</div>
                  <span className="text-sm">By: {event.actor || 'System'}</span>
                </div>
                
                {event.details && (
                  <p className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    {event.details}
                  </p>
                )}
              </div>
            </div>
          ))}
          
          <div className="relative">
            <div className="absolute left-[-40px] top-1 h-6 w-6 rounded-full bg-emerald-500 border-4 border-emerald-100 shadow-sm z-10 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-white" />
            </div>
            <div className="font-display font-bold text-lg text-emerald-600 py-1">Current Status</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
