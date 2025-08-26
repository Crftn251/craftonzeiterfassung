import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Calendar as CalendarIcon, Heart, Plane } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const BACKFILL_ACTIVITY_NAMES = [
  "Ordnung",
  "Verkauf",
  "Social Media",
  "OLS",
  "Ordern",
  "Meeting",
] as const;

export default function ProfileAnalytics() {
  useEffect(() => {
    document.title = 'Profil & Auswertungen – Crafton Time';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Heute, Woche, Monat – Summen, Ziele und Fortschritt.');
  }, []);

  const history = useMemo(() => {
    return JSON.parse(localStorage.getItem('ct_history') || '[]') as any[];
  }, []);

  const [userId, setUserId] = useState<string | null>(null);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [activities, setActivities] = useState<{ id: string; name: string }[]>([]);
  
  // Absence tracking state
  const [absenceDates, setAbsenceDates] = useState<{ [key: string]: 'sickness' | 'vacation' }>({});
  const [selectedAbsenceDates, setSelectedAbsenceDates] = useState<Date[]>([]);
  const [absenceType, setAbsenceType] = useState<'sickness' | 'vacation'>('sickness');
  const [showAbsenceCalendar, setShowAbsenceCalendar] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      if (!mounted) return;
      setUserId(uid);
      if (uid) {
        const [{ data: b }, { data: a }, { data: absences }] = await Promise.all([
          supabase.from('branches').select('id,name').order('name'),
          supabase.from('activities').select('id,name').order('name'),
          supabase.from('absence_days').select('date,type').eq('user_id', uid),
        ]);
        if (!mounted) return;
        setBranches(b || []);
        setActivities(a || []);
        
        // Load existing absence days
        const absenceMap: { [key: string]: 'sickness' | 'vacation' } = {};
        absences?.forEach(absence => {
          absenceMap[absence.date] = absence.type as 'sickness' | 'vacation';
        });
        setAbsenceDates(absenceMap);
      } else {
        // Offline/unauthenticated: provide static activities so user can backfill locally
        setBranches([]);
        setActivities(BACKFILL_ACTIVITY_NAMES.map((n) => ({ id: n, name: n })));
      }
    });
    return () => { mounted = false; };
  }, []);

  const totalSeconds = history.reduce((acc, s) => acc + Math.max(0, Math.floor(((s.end ?? Date.now()) - s.start) / 1000) - (s.pausedSeconds || 0)), 0);
  const goal = 40 * 3600; // 40h Wochenziel default
  const progress = Math.min(100, Math.round((totalSeconds / goal) * 100));

  // Nachtragen Formular
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('17:00');
  const [pauseMin, setPauseMin] = useState<string>('0');
  const [branchId, setBranchId] = useState<string>('');
  const [activityId, setActivityId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [saving, setSaving] = useState(false);

  function buildDateTime(d: Date, time: string) {
    const [hh, mm] = time.split(':').map(Number);
    const copy = new Date(d);
    copy.setHours(hh || 0, mm || 0, 0, 0);
    return copy;
  }

  const submitBackfill = async () => {
    if (!date || !startTime || !endTime) {
      toast({ title: 'Angaben unvollständig', description: 'Datum, Start und Ende sind erforderlich.' });
      return;
    }
    const startDt = buildDateTime(date, startTime);
    const endDt = buildDateTime(date, endTime);
    if (endDt <= startDt) {
      toast({ title: 'Ungültiger Zeitraum', description: 'Ende muss nach Start liegen.', variant: 'destructive' as any });
      return;
    }
    const pausedSeconds = Math.max(0, Math.floor((Number(pauseMin) || 0) * 60));

    setSaving(true);
    try {
      if (userId) {
        const payload: any = {
          user_id: userId,
          started_at: startDt.toISOString(),
          ended_at: endDt.toISOString(),
          paused_seconds: pausedSeconds,
          notes: reason || null,
          branch_id: branchId || null,
          activity_id: activityId || null,
        };
        const { error } = await supabase.from('time_entries').insert(payload);
        if (error) throw error;
        toast({ title: 'Stunden nachgetragen', description: 'Eintrag in Supabase gespeichert.' });
      } else {
        // Lokal speichern, wenn nicht eingeloggt
        const local = {
          id: crypto.randomUUID(),
          start: buildDateTime(date, startTime).getTime(),
          end: buildDateTime(date, endTime).getTime(),
          pausedSeconds,
          branch: branches.find(b => b.id === branchId)?.name || '',
          activity: activities.find(a => a.id === activityId)?.name || '',
          status: 'stopped',
        };
        const existing = JSON.parse(localStorage.getItem('ct_history') || '[]');
        localStorage.setItem('ct_history', JSON.stringify([local, ...existing]));
        toast({ title: 'Lokal gespeichert', description: 'Eintrag offline abgelegt (ohne Cloud-Sync).' });
      }
      // Reset
      setReason('');
    } catch (e: any) {
      toast({ title: 'Fehler beim Speichern', description: e.message || String(e), variant: 'destructive' as any });
    } finally {
      setSaving(false);
    }
  };

  const handleAbsenceSelection = async (type: 'sickness' | 'vacation') => {
    if (!userId) {
      toast({ title: 'Anmeldung erforderlich', description: 'Bitte melde dich an, um Abwesenheiten zu verwalten.' });
      return;
    }
    
    setAbsenceType(type);
    setSelectedAbsenceDates([]);
    setShowAbsenceCalendar(true);
  };

  const saveAbsenceDays = async () => {
    if (!userId || selectedAbsenceDates.length === 0) return;

    try {
      // Delete existing entries for selected dates
      const datesToSave = selectedAbsenceDates.map(date => format(date, 'yyyy-MM-dd'));
      
      await supabase
        .from('absence_days')
        .delete()
        .eq('user_id', userId)
        .in('date', datesToSave);

      // Insert new entries
      const newEntries = datesToSave.map(date => ({
        user_id: userId,
        date,
        type: absenceType
      }));

      const { error } = await supabase
        .from('absence_days')
        .insert(newEntries);

      if (error) throw error;

      // Update local state
      const newAbsenceMap = { ...absenceDates };
      datesToSave.forEach(date => {
        newAbsenceMap[date] = absenceType;
      });
      setAbsenceDates(newAbsenceMap);

      toast({ 
        title: 'Abwesenheiten gespeichert', 
        description: `${selectedAbsenceDates.length} Tage als ${absenceType === 'sickness' ? 'Krankheit' : 'Urlaub'} markiert.` 
      });
      
      setShowAbsenceCalendar(false);
      setSelectedAbsenceDates([]);
    } catch (error: any) {
      toast({ 
        title: 'Fehler beim Speichern', 
        description: error.message, 
        variant: 'destructive' 
      });
    }
  };

  return (
    <>
      <h1 className="sr-only">Profil & Auswertungen – Crafton Time</h1>
      <section className="grid gap-6 md:grid-cols-3">
        <Card className="col-span-1">
          <CardHeader><CardTitle>Woche – Fortschritt</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tabular-nums">{Math.floor(totalSeconds / 3600)}h</div>
            <div className="text-sm text-muted-foreground mb-2">Ziel 40h</div>
            <Progress value={progress} />
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader><CardTitle>Monat – Sessions</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{history.length}</div>
            <div className="text-sm text-muted-foreground">Gespeicherte Einträge</div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader><CardTitle>Top‑Tätigkeit</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">–</div>
            <div className="text-sm text-muted-foreground">Bald mit Verteilung</div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-6">
        <Card>
          <CardHeader><CardTitle>Abwesenheiten verwalten</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                onClick={() => handleAbsenceSelection('sickness')}
                className="h-auto py-4 flex flex-col items-center gap-2"
              >
                <Heart className="h-6 w-6 text-red-500" />
                <span>Krankheit</span>
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleAbsenceSelection('vacation')}
                className="h-auto py-4 flex flex-col items-center gap-2"
              >
                <Plane className="h-6 w-6 text-blue-500" />
                <span>Urlaub</span>
              </Button>
            </div>
            
            {showAbsenceCalendar && (
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">
                    {absenceType === 'sickness' ? 'Krankheitstage' : 'Urlaubstage'} auswählen
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowAbsenceCalendar(false)}>
                    Abbrechen
                  </Button>
                </div>
                
                <Calendar
                  mode="multiple"
                  selected={selectedAbsenceDates}
                  onSelect={(dates) => setSelectedAbsenceDates(dates || [])}
                  className={cn("p-3 pointer-events-auto")}
                  modifiers={{
                    sickness: (date) => absenceDates[format(date, 'yyyy-MM-dd')] === 'sickness',
                    vacation: (date) => absenceDates[format(date, 'yyyy-MM-dd')] === 'vacation',
                  }}
                  modifiersStyles={{
                    sickness: { backgroundColor: '#fef2f2', color: '#dc2626' },
                    vacation: { backgroundColor: '#eff6ff', color: '#2563eb' },
                  }}
                />
                
                {selectedAbsenceDates.length > 0 && (
                  <div className="mt-4 flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      {selectedAbsenceDates.length} Tag(e) ausgewählt
                    </span>
                    <Button onClick={saveAbsenceDays}>
                      Speichern
                    </Button>
                  </div>
                )}
              </div>
            )}
            
            <div className="text-sm text-muted-foreground">
              <p><span className="inline-block w-3 h-3 bg-red-100 border border-red-300 rounded mr-2"></span>Krankheitstage</p>
              <p><span className="inline-block w-3 h-3 bg-blue-100 border border-blue-300 rounded mr-2"></span>Urlaubstage</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-6">
        <Card>
          <CardHeader><CardTitle>Stunden nachtragen</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-sm text-muted-foreground">Datum</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("justify-start font-normal", !date && "text-muted-foreground")}> 
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? date.toLocaleDateString() : <span>Datum wählen</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="z-50 w-auto p-0" align="start">
                    <Calendar 
                      mode="single" 
                      selected={date}
                      onSelect={setDate as any}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm text-muted-foreground">Start</label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm text-muted-foreground">Ende</label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-sm text-muted-foreground">Filiale</label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filiale wählen" />
                  </SelectTrigger>
                  <SelectContent className="z-50 bg-popover text-popover-foreground border rounded-md shadow-md">
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm text-muted-foreground">Tätigkeit</label>
                <Select value={activityId} onValueChange={setActivityId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tätigkeit wählen" />
                  </SelectTrigger>
                  <SelectContent className="z-50 bg-popover text-popover-foreground border rounded-md shadow-md">
                    {activities
                      .filter((a) => BACKFILL_ACTIVITY_NAMES.includes(a.name as any))
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm text-muted-foreground">Pause (Minuten)</label>
                <Input type="number" min={0} value={pauseMin} onChange={(e) => setPauseMin(e.target.value)} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm text-muted-foreground">Grund / Notiz</label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Warum wird nachgetragen?" />
            </div>

            <div className="flex justify-end">
              <Button onClick={submitBackfill} disabled={saving}>
                {saving ? 'Speichern…' : 'Nachtrag speichern'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}

