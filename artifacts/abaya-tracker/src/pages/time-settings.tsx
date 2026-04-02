import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { setTimeSettings, type WorkSlot } from "@/lib/utils";
import { Save, Clock, RotateCcw } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

interface FormState {
  slot1Start: string;
  slot1End: string;
  slot2Start: string;
  slot2End: string;
  slot2Effective: string;
  slot3Start: string;
  slot3End: string;
  minutesPerPoint: string;
}

const DEFAULTS: FormState = {
  slot1Start: "08:00",
  slot1End: "13:20",
  slot2Start: "14:30",
  slot2End: "20:00",
  slot2Effective: "270",
  slot3Start: "20:30",
  slot3End: "23:00",
  minutesPerPoint: "20",
};

export default function TimeSettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(DEFAULTS);

  const { data, isLoading } = useQuery({
    queryKey: ["time-settings"],
    queryFn: () => fetch(`${API}/time-settings`, { credentials: "include" }).then((r) => r.json()),
  });

  useEffect(() => {
    if (data && data.slot1Start !== undefined) {
      setForm({
        slot1Start: minutesToTime(data.slot1Start),
        slot1End: minutesToTime(data.slot1End),
        slot2Start: minutesToTime(data.slot2Start),
        slot2End: minutesToTime(data.slot2End),
        slot2Effective: data.slot2Effective != null ? String(data.slot2Effective) : "",
        slot3Start: minutesToTime(data.slot3Start),
        slot3End: minutesToTime(data.slot3End),
        minutesPerPoint: String(data.minutesPerPoint),
      });
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${API}/time-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (s) => {
      const slots: WorkSlot[] = [
        { start: s.slot1Start, end: s.slot1End },
        { start: s.slot2Start, end: s.slot2End, effective: s.slot2Effective || undefined },
        { start: s.slot3Start, end: s.slot3End },
      ];
      setTimeSettings(slots, s.minutesPerPoint || 20);
      qc.invalidateQueries({ queryKey: ["time-settings"] });
      toast({ title: "Saved", description: "Time settings updated successfully." });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  function handleSave() {
    saveMut.mutate({
      slot1Start: timeToMinutes(form.slot1Start),
      slot1End: timeToMinutes(form.slot1End),
      slot2Start: timeToMinutes(form.slot2Start),
      slot2End: timeToMinutes(form.slot2End),
      slot2Effective: form.slot2Effective ? Number(form.slot2Effective) : null,
      slot3Start: timeToMinutes(form.slot3Start),
      slot3End: timeToMinutes(form.slot3End),
      minutesPerPoint: Number(form.minutesPerPoint) || 20,
    });
  }

  function handleReset() {
    setForm(DEFAULTS);
  }

  function slotDuration(start: string, end: string): number {
    return timeToMinutes(end) - timeToMinutes(start);
  }

  const totalDaily =
    slotDuration(form.slot1Start, form.slot1End) +
    (form.slot2Effective ? Number(form.slot2Effective) : slotDuration(form.slot2Start, form.slot2End)) +
    slotDuration(form.slot3Start, form.slot3End);

  const mpp = Number(form.minutesPerPoint) || 20;
  const pointsPerDay = Math.floor(totalDaily / mpp);

  return (
    <AppLayout title="Time Settings">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Working Hours & Point Conversion
            </CardTitle>
            <CardDescription>
              Configure daily working time slots and how minutes convert to production points.
              All times are in UTC.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (
              <>
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Slot 1 — Morning</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Start Time (UTC)</Label>
                      <Input
                        type="time"
                        value={form.slot1Start}
                        onChange={(e) => setForm({ ...form, slot1Start: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>End Time (UTC)</Label>
                      <Input
                        type="time"
                        value={form.slot1End}
                        onChange={(e) => setForm({ ...form, slot1End: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Duration: {slotDuration(form.slot1Start, form.slot1End)} minutes
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Slot 2 — Afternoon</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Start Time (UTC)</Label>
                      <Input
                        type="time"
                        value={form.slot2Start}
                        onChange={(e) => setForm({ ...form, slot2Start: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>End Time (UTC)</Label>
                      <Input
                        type="time"
                        value={form.slot2End}
                        onChange={(e) => setForm({ ...form, slot2End: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Effective Minutes (optional override)</Label>
                    <Input
                      type="number"
                      placeholder="Leave empty to use full duration"
                      value={form.slot2Effective}
                      onChange={(e) => setForm({ ...form, slot2Effective: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      If set, this slot counts as this many productive minutes instead of its full clock duration.
                      Full duration: {slotDuration(form.slot2Start, form.slot2End)} min.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Slot 3 — Evening</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Start Time (UTC)</Label>
                      <Input
                        type="time"
                        value={form.slot3Start}
                        onChange={(e) => setForm({ ...form, slot3Start: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>End Time (UTC)</Label>
                      <Input
                        type="time"
                        value={form.slot3End}
                        onChange={(e) => setForm({ ...form, slot3End: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Duration: {slotDuration(form.slot3Start, form.slot3End)} minutes
                  </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <h3 className="font-semibold text-sm">Point Conversion</h3>
                  <div>
                    <Label>Minutes Per Point</Label>
                    <Input
                      type="number"
                      min="1"
                      value={form.minutesPerPoint}
                      onChange={(e) => setForm({ ...form, minutesPerPoint: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      How many productive minutes equal 1 production point.
                    </p>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 space-y-1">
                  <div className="text-sm font-medium">Summary</div>
                  <div className="text-sm text-muted-foreground">
                    Total effective working minutes per day: <span className="font-semibold text-foreground">{totalDaily}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Points capacity per day: <span className="font-semibold text-foreground">{pointsPerDay}</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button onClick={handleSave} disabled={saveMut.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    {saveMut.isPending ? "Saving..." : "Save Settings"}
                  </Button>
                  <Button variant="outline" onClick={handleReset}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset to Defaults
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
