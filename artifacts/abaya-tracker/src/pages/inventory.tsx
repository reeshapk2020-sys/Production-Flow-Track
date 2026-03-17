import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowRight, Layers, Scissors, Send, Settings2, Package } from "lucide-react";
import { useGetInventorySummary } from "@workspace/api-client-react";

export default function InventoryPage() {
  const { data, isLoading } = useGetInventorySummary();

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
        
        <InventoryStageCard 
          title="Raw Materials" 
          icon={Layers} 
          metrics={[
            { label: "Total Rolls", value: data.rawMaterial.totalRolls },
            { label: "Fabric Quantity", value: `${data.rawMaterial.totalQuantity.toLocaleString()} units` }
          ]} 
          color="bg-slate-800 text-white" 
          iconColor="text-slate-400"
        />

        <div className="flex justify-center"><ArrowRight className="h-8 w-8 text-slate-300" /></div>

        <InventoryStageCard 
          title="Cutting (WIP)" 
          icon={Scissors} 
          metrics={[
            { label: "Active Batches", value: data.cuttingWip.totalBatches },
            { label: "Pieces Cut", value: data.cuttingWip.totalQuantity.toLocaleString() }
          ]} 
          color="bg-blue-600 text-white" 
          iconColor="text-blue-300"
        />

        <div className="flex justify-center"><ArrowRight className="h-8 w-8 text-slate-300" /></div>

        <InventoryStageCard 
          title="With Stitchers" 
          icon={Send} 
          metrics={[
            { label: "Active Allocations", value: data.pendingWithStitchers.totalAllocations },
            { label: "Pending Pieces", value: data.pendingWithStitchers.totalQuantity.toLocaleString() }
          ]} 
          color="bg-amber-500 text-white" 
          iconColor="text-amber-200"
        />

        <div className="flex justify-center"><ArrowRight className="h-8 w-8 text-slate-300" /></div>

        <InventoryStageCard 
          title="Finishing Pipeline" 
          icon={Settings2} 
          metrics={[
            { label: "Pressing", value: data.inFinishing.pressing },
            { label: "Buttons", value: data.inFinishing.buttons },
            { label: "Hanger", value: data.inFinishing.hanger },
            { label: "Packing", value: data.inFinishing.packing }
          ]} 
          color="bg-indigo-500 text-white" 
          iconColor="text-indigo-200"
          gridCols={4}
        />

        <div className="flex justify-center"><ArrowRight className="h-8 w-8 text-slate-300" /></div>

        <InventoryStageCard 
          title="Finished Goods Store" 
          icon={Package} 
          metrics={[
            { label: "Total Sellable Pieces", value: data.finishedGoods.totalQuantity.toLocaleString() }
          ]} 
          color="bg-emerald-600 text-white shadow-xl shadow-emerald-600/20 scale-105" 
          iconColor="text-emerald-300"
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
