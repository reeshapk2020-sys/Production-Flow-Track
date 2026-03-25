import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowRight, Layers, Scissors, Send, Settings2, Package, ChevronDown, ChevronRight } from "lucide-react";
import { useGetInventorySummary } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";

interface RawMaterialGroup {
  fabricId: number;
  fabricName: string;
  fabricCode: string | null;
  totalRolls: number;
  totalQuantity: number;
  unit: string;
  colors: Array<{
    colorId: number | null;
    colorName: string | null;
    colorCode: string | null;
    totalRolls: number;
    totalQuantity: number;
  }>;
}

export default function InventoryPage() {
  const { data, isLoading } = useGetInventorySummary();
  const { data: rawMaterials } = useQuery<RawMaterialGroup[]>({
    queryKey: ["inventory", "raw-materials"],
    queryFn: () => fetch(`${import.meta.env.BASE_URL}api/inventory/raw-materials`, { credentials: "include" }).then(r => r.json()),
  });

  const [expandedFabrics, setExpandedFabrics] = useState<Set<number>>(new Set());

  function toggleFabric(fabricId: number) {
    setExpandedFabrics(prev => {
      const next = new Set(prev);
      if (next.has(fabricId)) next.delete(fabricId);
      else next.add(fabricId);
      return next;
    });
  }

  if (isLoading || !data) {
    return (
      <AppLayout title="Factory Inventory Overview">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Pipeline & Inventory">
      <div className="max-w-4xl mx-auto space-y-8 py-8">
        
        <Card className="overflow-hidden rounded-2xl border-none transition-all bg-secondary text-white">
          <CardContent className="p-8 relative">
            <Layers className="absolute right-0 top-1/2 -translate-y-1/2 -translate-x-4 h-32 w-32 opacity-10 pointer-events-none text-muted-foreground" />
            <h2 className="text-2xl font-display font-bold mb-6 flex items-center gap-3">
              <Layers className="h-6 w-6" /> Raw Materials
            </h2>
            <div className="grid grid-cols-2 gap-6 relative z-10 mb-6">
              <div>
                <p className="text-sm font-medium opacity-80 uppercase tracking-wider mb-1">Total Rolls</p>
                <p className="text-3xl font-bold font-display">{data.rawMaterial.totalRolls}</p>
              </div>
              <div>
                <p className="text-sm font-medium opacity-80 uppercase tracking-wider mb-1">Fabric Quantity</p>
                <p className="text-3xl font-bold font-display">{data.rawMaterial.totalQuantity.toLocaleString()} units</p>
              </div>
            </div>

            {rawMaterials && rawMaterials.length > 0 && (
              <div className="bg-card/10 rounded-xl overflow-hidden">
                <div className="px-4 py-2 border-b border-white/10">
                  <p className="text-xs font-semibold uppercase tracking-wider opacity-70">Breakdown by Fabric Type & Color</p>
                </div>
                {rawMaterials.map(group => (
                  <div key={group.fabricId} className="border-b border-white/5 last:border-0">
                    <button
                      onClick={() => toggleFabric(group.fabricId)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-card/5 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        {expandedFabrics.has(group.fabricId)
                          ? <ChevronDown className="h-4 w-4 opacity-50" />
                          : <ChevronRight className="h-4 w-4 opacity-50" />
                        }
                        <span className="font-semibold">{group.fabricCode ? `${group.fabricCode} — ` : ""}{group.fabricName}</span>
                      </div>
                      <div className="flex gap-6 text-sm">
                        <span className="opacity-70">{group.totalRolls} rolls</span>
                        <span className="font-bold">{Number(group.totalQuantity).toLocaleString()} {group.unit}</span>
                      </div>
                    </button>
                    {expandedFabrics.has(group.fabricId) && group.colors.length > 0 && (
                      <div className="bg-card/5 px-4 pb-3">
                        {group.colors.map((c, i) => (
                          <div key={i} className="flex items-center justify-between py-1.5 px-6 text-sm border-b border-white/5 last:border-0">
                            <span className="opacity-80">
                              {c.colorCode ? `${c.colorCode} — ` : ""}{c.colorName || "No Color"}
                            </span>
                            <div className="flex gap-6">
                              <span className="opacity-60">{c.totalRolls} rolls</span>
                              <span className="font-medium">{Number(c.totalQuantity).toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-center"><ArrowRight className="h-8 w-8 text-muted-foreground" /></div>

        <InventoryStageCard 
          title="Cutting (WIP)" 
          icon={Scissors} 
          metrics={[
            { label: "Active Batches", value: data.cuttingWip.totalBatches },
            { label: "Pieces Cut", value: data.cuttingWip.totalQuantity.toLocaleString() }
          ]} 
          color="bg-primary text-white" 
          iconColor="text-primary/70"
        />

        <div className="flex justify-center"><ArrowRight className="h-8 w-8 text-muted-foreground" /></div>

        <InventoryStageCard 
          title="With Stitchers" 
          icon={Send} 
          metrics={[
            { label: "Active Allocations", value: data.pendingWithStitchers.totalAllocations },
            { label: "Pending Pieces", value: data.pendingWithStitchers.totalQuantity.toLocaleString() }
          ]} 
          color="bg-amber-500/100 text-white" 
          iconColor="text-amber-200"
        />

        <div className="flex justify-center"><ArrowRight className="h-8 w-8 text-muted-foreground" /></div>

        <InventoryStageCard 
          title="Finishing Pipeline" 
          icon={Settings2} 
          metrics={[
            { label: "Pressing", value: data.inFinishing.pressing },
            { label: "Buttons", value: data.inFinishing.buttons },
            { label: "Hanger", value: data.inFinishing.hanger },
            { label: "Packing", value: data.inFinishing.packing }
          ]} 
          color="bg-indigo-500/100 text-white" 
          iconColor="text-indigo-200"
          gridCols={4}
        />

        <div className="flex justify-center"><ArrowRight className="h-8 w-8 text-muted-foreground" /></div>

        <InventoryStageCard 
          title="Finished Goods Store" 
          icon={Package} 
          metrics={[
            { label: "Produced", value: (data.finishedGoods.producedQuantity ?? data.finishedGoods.totalQuantity).toLocaleString() },
            { label: "Opening Stock", value: (data.finishedGoods.openingQuantity ?? 0).toLocaleString() },
            { label: "Total Sellable", value: data.finishedGoods.totalQuantity.toLocaleString() },
          ]} 
          color="bg-emerald-600 text-white shadow-xl shadow-emerald-600/20 scale-105" 
          iconColor="text-emerald-300"
          gridCols={3}
        />

      </div>
    </AppLayout>
  );
}

function InventoryStageCard({ title, icon: Icon, metrics, color, iconColor, gridCols = 2 }: any) {
  return (
    <Card className={`overflow-hidden rounded-2xl border-none transition-all ${color}`}>
      <CardContent className="p-8 relative">
        <Icon className={`absolute right-0 top-1/2 -translate-y-1/2 -translate-x-4 h-32 w-32 opacity-10 pointer-events-none ${iconColor}`} />
        <h2 className="text-2xl font-display font-bold mb-6 flex items-center gap-3">
          <Icon className="h-6 w-6" /> {title}
        </h2>
        <div className={`grid grid-cols-2 sm:grid-cols-${gridCols} gap-6 relative z-10`}>
          {metrics.map((m: any, i: number) => (
            <div key={i}>
              <p className="text-sm font-medium opacity-80 uppercase tracking-wider mb-1">{m.label}</p>
              <p className="text-3xl font-bold font-display">{m.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
