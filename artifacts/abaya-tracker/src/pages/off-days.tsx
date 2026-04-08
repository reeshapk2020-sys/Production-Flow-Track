import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { setOffDays } from "@/lib/utils";
import { CalendarOff, Plus, Trash2 } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function OffDaysPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newWeeklyDay, setNewWeeklyDay] = useState("");
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayLabel, setNewHolidayLabel] = useState("");

  const { data: offDays = [], isLoading } = useQuery({
    queryKey: ["off-days"],
    queryFn: async () => {
      const r = await fetch(`${API}/off-days`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
    select: (data: any[]) => {
      const wd = data.filter((r: any) => r.type === "weekly").map((r: any) => r.dayOfWeek as number);
      const hd = data.filter((r: any) => r.type === "holiday" && r.date).map((r: any) => r.date as string);
      setOffDays(wd, hd);
      return data;
    },
  });

  const weeklyDays = offDays.filter((d: any) => d.type === "weekly");
  const holidays = offDays.filter((d: any) => d.type === "holiday");

  const addMutation = useMutation({
    mutationFn: async (body: any) => {
      const r = await fetch(`${API}/off-days`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error || "Failed");
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["off-days"] });
      toast({ title: "Off day added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${API}/off-days/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["off-days"] });
      toast({ title: "Off day removed" });
    },
    onError: () => toast({ title: "Error", description: "Failed to remove", variant: "destructive" }),
  });

  function handleAddWeekly() {
    if (newWeeklyDay === "") return;
    const dow = Number(newWeeklyDay);
    if (weeklyDays.some((d: any) => d.dayOfWeek === dow)) {
      toast({ title: "Already exists", variant: "destructive" });
      return;
    }
    addMutation.mutate({ type: "weekly", dayOfWeek: dow });
    setNewWeeklyDay("");
  }

  function handleAddHoliday() {
    if (!newHolidayDate) return;
    if (holidays.some((d: any) => d.date === newHolidayDate)) {
      toast({ title: "Already exists", variant: "destructive" });
      return;
    }
    addMutation.mutate({ type: "holiday", date: newHolidayDate, label: newHolidayLabel || null });
    setNewHolidayDate("");
    setNewHolidayLabel("");
  }

  return (
    <AppLayout title="Off Days & Holidays">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarOff className="h-5 w-5" />
              Weekly Off Days
            </CardTitle>
            <CardDescription>
              Select recurring weekly days when no work is done. These days are excluded from all timing calculations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label>Day of Week</Label>
                  <select
                    className="w-full mt-1 border border-border rounded-md px-3 py-2 bg-background text-foreground"
                    value={newWeeklyDay}
                    onChange={(e) => setNewWeeklyDay(e.target.value)}
                  >
                    <option value="">Select day...</option>
                    {DAY_NAMES.map((name, i) => (
                      <option key={i} value={i}>{name}</option>
                    ))}
                  </select>
                </div>
                <Button onClick={handleAddWeekly} disabled={newWeeklyDay === ""}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
              {weeklyDays.length === 0 ? (
                <p className="text-sm text-muted-foreground">No weekly off days configured. All 7 days are working days.</p>
              ) : (
                <div className="space-y-2">
                  {weeklyDays.map((d: any) => (
                    <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                      <span className="font-medium">{DAY_NAMES[d.dayOfWeek]}</span>
                      <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(d.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarOff className="h-5 w-5" />
              Custom Holidays
            </CardTitle>
            <CardDescription>
              Add specific dates that are holidays. These dates are excluded from all timing calculations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={newHolidayDate}
                    onChange={(e) => setNewHolidayDate(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Label>Label (optional)</Label>
                  <Input
                    placeholder="e.g. Eid al-Fitr"
                    value={newHolidayLabel}
                    onChange={(e) => setNewHolidayLabel(e.target.value)}
                  />
                </div>
                <Button onClick={handleAddHoliday} disabled={!newHolidayDate}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
              {holidays.length === 0 ? (
                <p className="text-sm text-muted-foreground">No custom holidays configured.</p>
              ) : (
                <div className="space-y-2">
                  {holidays.map((d: any) => (
                    <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                      <div>
                        <span className="font-medium">{d.date}</span>
                        {d.label && <span className="ml-2 text-muted-foreground">— {d.label}</span>}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(d.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
