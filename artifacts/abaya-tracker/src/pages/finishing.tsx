import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2, Settings2 } from "lucide-react";
import { 
  useListFinishingRecords, useCreateFinishingRecord, getListFinishingRecordsQueryKey,
  useListCuttingBatches
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const STAGES = ["pressing", "buttons", "hanger", "packing"] as const;

export default function FinishingPage() {
  return (
    <AppLayout title="Finishing Department">
      <Tabs defaultValue="pressing" className="w-full">
        <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 mb-6 inline-block overflow-x-auto max-w-full">
          <TabsList className="bg-transparent h-auto p-0 flex space-x-1">
            {STAGES.map(stage => (
              <TabsTrigger key={stage} value={stage} className="rounded-lg px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md capitalize">
                {stage}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {STAGES.map(stage => (
          <TabsContent key={stage} value={stage} className="mt-0 outline-none">
            <FinishingStageView stage={stage} />
          </TabsContent>
        ))}
      </Tabs>
    </AppLayout>
  );
}

function FinishingStageView({ stage }: { stage: "pressing" | "buttons" | "hanger" | "packing" }) {
  const { data, isLoading } = useListFinishingRecords({ stage });
  const { data: batches } = useListCuttingBatches();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { mutate, isPending } = useCreateFinishingRecord({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFinishingRecordsQueryKey({ stage }) });
        setOpen(false);
        toast({ title: "Finishing record saved" });
      }
    }
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    
    mutate({ data: { 
      cuttingBatchId: Number(fd.get("cuttingBatchId")),
      stage,
      inputQuantity: Number(fd.get("inputQuantity")),
      outputQuantity: Number(fd.get("outputQuantity")),
      defectiveQuantity: Number(fd.get("defectiveQuantity")) || 0,
      operator: fd.get("operator") as string,
      processDate: fd.get("processDate") as string,
      remarks: fd.get("remarks") as string
    } });
  };

  return (
    <Card className="shadow-lg border-slate-200 rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
      <CardHeader className="bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between py-5 px-6 gap-4">
        <div>
          <CardTitle className="text-xl font-display text-slate-800 flex items-center gap-2 capitalize">
            <Settings2 className="h-5 w-5 text-primary" />
            {stage} Stage
          </CardTitle>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5">
              <Plus className="h-4 w-4 mr-2" /> Log {stage}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] rounded-2xl p-6 border-0 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-display capitalize">Log {stage} Output</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 pt-4">
              
              <div>
                <label className="text-sm font-medium block mb-1.5">Batch</label>
                <select name="cuttingBatchId" className="form-input-styled bg-white" required>
                  <option value="">Select Batch...</option>
                  {batches?.map(b => (
                    <option key={b.id} value={b.id}>{b.batchNumber} - {b.productName}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">Input Qty</label>
                  <input type="number" name="inputQuantity" className="form-input-styled" required placeholder="0" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Output (Good) Qty</label>
                  <input type="number" name="outputQuantity" className="form-input-styled border-primary/30 bg-primary/5" required placeholder="0" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5 text-slate-500">Defective Qty</label>
                  <input type="number" name="defectiveQuantity" className="form-input-styled" defaultValue="0" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Process Date</label>
                  <input type="date" name="processDate" className="form-input-styled" required defaultValue={new Date().toISOString().split('T')[0]} />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium block mb-1.5">Operator / Team</label>
                <input name="operator" className="form-input-styled" placeholder="Who did this?" required />
              </div>
              
              <div className="mt-4">
                <Button type="submit" disabled={isPending} className="w-full h-12 rounded-xl text-base shadow-lg shadow-primary/20">
                  {isPending ? "Saving..." : "Save Record"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0 bg-white">
        <Table>
          <TableHeader className="bg-slate-50 border-b border-slate-100">
            <TableRow>
              <TableHead className="py-4">Batch / Product</TableHead>
              <TableHead className="text-right">Input</TableHead>
              <TableHead className="text-right text-emerald-600">Output</TableHead>
              <TableHead className="text-right text-red-500">Defective</TableHead>
              <TableHead>Operator</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-300" /></TableCell></TableRow> :
              data?.map(rec => (
                <TableRow key={rec.id} className="hover:bg-slate-50/50">
                  <TableCell>
                    <div className="font-semibold text-primary">{rec.batchNumber}</div>
                    <div className="text-xs text-slate-500">{rec.productName}</div>
                  </TableCell>
                  <TableCell className="text-right text-slate-500 font-medium">{rec.inputQuantity}</TableCell>
                  <TableCell className="text-right font-bold text-emerald-600 text-lg">{rec.outputQuantity}</TableCell>
                  <TableCell className="text-right text-red-500 font-medium">{rec.defectiveQuantity || '-'}</TableCell>
                  <TableCell className="text-slate-700">{rec.operator}</TableCell>
                  <TableCell className="text-slate-600 text-sm">
                    {rec.processDate ? format(new Date(rec.processDate), 'MMM d, yyyy') : '-'}
                  </TableCell>
                </TableRow>
              ))
            }
            {data?.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500">No {stage} records found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
