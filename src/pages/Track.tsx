import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Pause, Play, Square, RefreshCw, Building2, Briefcase, WifiOff, Calendar as CalendarIcon } from "lucide-react";
import OnboardingWizard from "./track/OnboardingWizard";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const BRANCHES = ["SPZ", "J&C", "TAL", "BÜRO", "SPW", "SPR"] as const;
const ACTIVITIES = ["Ordnung", "Verkauf", "Social Media", "OLS", "Ordern", "Meeting"] as const;

const BACKFILL_ACTIVITY_NAMES = [
  "Ordnung",
  "Verkauf", 
  "Social Media",
  "OLS",
  "Ordern",
  "Meeting",
] as const;

function formatTime(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const m = Math.floor(totalSeconds % 3600 / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

type SessionRecord = {
  id: string;
  start: number; // epoch ms
  end?: number;
  pausedSeconds: number;
  branch: string;
  activity: string;
  status: 'running' | 'paused' | 'stopped';
};

export default function Track() {
  const [branch, setBranch] = useState<string>(() => localStorage.getItem('ct_branch') || "");
  const [activity, setActivity] = useState<string>(() => localStorage.getItem('ct_activity') || "");
  const [session, setSession] = useState<SessionRecord | null>(() => {
    const raw = localStorage.getItem('ct_session');
    return raw ? JSON.parse(raw) as SessionRecord : null;
  });
  const [offline, setOffline] = useState<boolean>(() => !navigator.onLine);
  
  // optimized: lightweight tick state (no session rewrite)
  const [tick, setTick] = useState(0);
  const tickRef = useRef<number | null>(null);
  
  const [user, setUser] = useState<any>(null);
  const [branchOptions, setBranchOptions] = useState<string[]>([...BRANCHES] as unknown as string[]);
  const [activityOptions, setActivityOptions] = useState<string[]>([...ACTIVITIES] as unknown as string[]);
  const [branchActivities, setBranchActivities] = useState<Record<string, string[]>>({});
  const branchIdByName = useRef<Record<string, string>>({});
  const activityIdByName = useRef<Record<string, string>>({});
  const [todayAbsence, setTodayAbsence] = useState<string | null>(null);
  
  // Backfill state
  const [backfillDate, setBackfillDate] = useState<Date | undefined>(new Date());
  const [backfillStartTime, setBackfillStartTime] = useState<string>('09:00');
  const [backfillEndTime, setBackfillEndTime] = useState<string>('17:00');
  const [backfillPauseMin, setBackfillPauseMin] = useState<string>('0');
  const [backfillBranchId, setBackfillBranchId] = useState<string>('');
  const [backfillActivityId, setBackfillActivityId] = useState<string>('');
  const [backfillReason, setBackfillReason] = useState<string>('');
  const [backfillSaving, setBackfillSaving] = useState(false);

  const elapsed = useMemo(() => {
    if (!session) return 0;
    const now = Date.now();
    const end = session.end ?? now;
    const total = Math.max(0, Math.floor((end - session.start) / 1000) - session.pausedSeconds);
    return total;
  }, [session, tick]);

  // Filter activities based on selected branch
  const filteredActivities = useMemo(() => {
    if (!branch) return activityOptions;
    return branchActivities[branch] || activityOptions;
  }, [branch, branchActivities, activityOptions]);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (session && session.status === 'running') {
      tickRef.current = window.setInterval(() => {
        setTick(t => t + 1);
      }, 1000);
    }
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [session?.status]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    (async () => {
      const { data: b } = await supabase.from('branches').select('id,name').order('name');
      if (b) {
        setBranchOptions(b.map(x => x.name));
        branchIdByName.current = Object.fromEntries(b.map(x => [x.name, x.id]));
      }

      const { data: a } = await supabase.from('activities').select('id,name').order('name');
      if (a) {
        setActivityOptions(a.map(x => x.name));
        activityIdByName.current = Object.fromEntries(a.map(x => [x.name, x.id]));
      }

      // Load branch-activity assignments
      const { data: assignments } = await supabase
        .from('branch_activities')
        .select(`
          branches!inner(name),
          activities!inner(name)
        `);

      if (assignments) {
        const branchActivityMap: Record<string, string[]> = {};
        assignments.forEach((assignment: any) => {
          const branchName = assignment.branches.name;
          const activityName = assignment.activities.name;
          
          if (!branchActivityMap[branchName]) {
            branchActivityMap[branchName] = [];
          }
          branchActivityMap[branchName].push(activityName);
        });
        setBranchActivities(branchActivityMap);
      }

      // Check if today is marked as absence day
      if (user) {
        const today = format(new Date(), 'yyyy-MM-dd');
        const { data: absence } = await supabase
          .from('absence_days')
          .select('type')
          .eq('user_id', user.id)
          .eq('date', today)
          .maybeSingle();
        setTodayAbsence(absence?.type || null);
      }
    })();
  }, [user]);

  useEffect(() => {
    localStorage.setItem('ct_branch', branch);
  }, [branch]);

  useEffect(() => {
    localStorage.setItem('ct_activity', activity);
  }, [activity]);

  useEffect(() => {
    if (session) localStorage.setItem('ct_session', JSON.stringify(session));
    else localStorage.removeItem('ct_session');
  }, [session]);

  // Reset activity if it's not available for the selected branch
  useEffect(() => {
    if (branch && activity && !filteredActivities.includes(activity)) {
      setActivity("");
    }
  }, [branch, activity, filteredActivities]);

  const start = () => {
    if (!user) {
      toast({
        title: 'Nicht angemeldet',
        description: 'Bitte melden Sie sich an, um die Zeiterfassung zu nutzen.',
        variant: 'destructive'
      });
      return;
    }
    if (!branch || !activity) {
      toast({
        title: 'Auswahl erforderlich',
        description: 'Bitte Filiale und Tätigkeit wählen.'
      });
      return;
    }
    if (todayAbsence) {
      const absenceText = todayAbsence === 'sickness' ? 'Krankheit (K)' : 'Urlaub (U)';
      toast({
        title: 'Zeiterfassung blockiert',
        description: `Heute ist als ${absenceText} markiert. Zeiterfassung nicht möglich.`,
        variant: 'destructive'
      });
      return;
    }
    const s: SessionRecord = {
      id: crypto.randomUUID(),
      start: Date.now(),
      pausedSeconds: 0,
      branch,
      activity,
      status: 'running'
    };
    setSession(s);
  };

  const pause = () => {
    if (!session) return;
    if (session.status === 'paused') {
      // resume
      const now = Date.now();
      const pausedMarker = Number(localStorage.getItem('ct_paused_since')) || now;
      const add = Math.floor((now - pausedMarker) / 1000);
      localStorage.removeItem('ct_paused_since');
      setSession({
        ...session,
        pausedSeconds: session.pausedSeconds + add,
        status: 'running'
      });
    } else {
      // pause
      localStorage.setItem('ct_paused_since', String(Date.now()));
      setSession({
        ...session,
        status: 'paused'
      });
    }
  };

  const persistFinished = async (finished: SessionRecord) => {
    if (!user) {
      toast({
        title: 'Nicht angemeldet',
        description: 'Bitte melden Sie sich an, um Zeiten zu speichern.',
        variant: 'destructive'
      });
      return;
    }
    const payload: any = {
      user_id: user.id,
      started_at: new Date(finished.start).toISOString(),
      ended_at: finished.end ? new Date(finished.end).toISOString() : null,
      paused_seconds: finished.pausedSeconds
    };
    const bid = branchIdByName.current[finished.branch];
    const aid = activityIdByName.current[finished.activity];
    if (bid) payload.branch_id = bid;
    if (aid) payload.activity_id = aid;
    const{ error } = await supabase.from('time_entries').insert(payload);
    if (error) {
      toast({
        title: 'Speichern fehlgeschlagen',
        description: error.message,
        variant: 'destructive'
      });
      return;
    }

    // Trigger storage event to refresh other components
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'time_entries_updated',
      newValue: Date.now().toString()
    }));
  };

  const stop = async () => {
    if (!session) return;
    const now = Date.now();
    let pausedExtra = 0;
    if (session.status === 'paused') {
      const pausedMarker = Number(localStorage.getItem('ct_paused_since')) || now;
      pausedExtra = Math.max(0, Math.floor((now - pausedMarker) / 1000));
      localStorage.removeItem('ct_paused_since');
    }
    const finished: SessionRecord = {
      ...session,
      end: now,
      status: 'stopped',
      pausedSeconds: session.pausedSeconds + pausedExtra
    };
    await persistFinished(finished);
    setSession(null);
    toast({
      title: 'Session beendet',
      description: 'Abschnitt gespeichert.'
    });
  };

  const handleChangeBranch = async (nextBranch: string) => {
    if (session && (session.status === 'running' || session.status === 'paused')) {
      const now = Date.now();
      let pausedExtra = 0;
      if (session.status === 'paused') {
        const pausedMarker = Number(localStorage.getItem('ct_paused_since')) || now;
        pausedExtra = Math.max(0, Math.floor((now - pausedMarker) / 1000));
      }
      const finished: SessionRecord = {
        ...session,
        end: now,
        status: 'stopped',
        pausedSeconds: session.pausedSeconds + pausedExtra
      };
      // Clear any previous pause marker since we finalize this segment now
      localStorage.removeItem('ct_paused_since');
      await persistFinished(finished);
      setBranch(nextBranch);
      const newSession: SessionRecord = {
        id: crypto.randomUUID(),
        start: now,
        pausedSeconds: 0,
        branch: nextBranch,
        activity: activity,
        status: session.status
      };
      setSession(newSession);
      if (session.status === 'paused') {
        localStorage.setItem('ct_paused_since', String(now));
      }
      toast({
        title: 'Filiale gewechselt',
        description: 'Abschnitt gespeichert, neuer gestartet.'
      });
    } else {
      setBranch(nextBranch);
    }
  };

  const handleChangeActivity = async (nextActivity: string) => {
    if (session && (session.status === 'running' || session.status === 'paused')) {
      const now = Date.now();
      let pausedExtra = 0;
      if (session.status === 'paused') {
        const pausedMarker = Number(localStorage.getItem('ct_paused_since')) || now;
        pausedExtra = Math.max(0, Math.floor((now - pausedMarker) / 1000));
      }
      const finished: SessionRecord = {
        ...session,
        end: now,
        status: 'stopped',
        pausedSeconds: session.pausedSeconds + pausedExtra
      };
      // Clear any previous pause marker since we finalize this segment now
      localStorage.removeItem('ct_paused_since');
      await persistFinished(finished);
      setActivity(nextActivity);
      const newSession: SessionRecord = {
        id: crypto.randomUUID(),
        start: now,
        pausedSeconds: 0,
        branch: branch,
        activity: nextActivity,
        status: session.status
      };
      setSession(newSession);
      if (session.status === 'paused') {
        localStorage.setItem('ct_paused_since', String(now));
      }
      toast({
        title: 'Tätigkeit gewechselt',
        description: 'Abschnitt gespeichert, neuer gestartet.'
      });
    } else {
      setActivity(nextActivity);
    }
  };

  // Backfill functionality
  function buildDateTime(d: Date, time: string) {
    const [hh, mm] = time.split(':').map(Number);
    const copy = new Date(d);
    copy.setHours(hh || 0, mm || 0, 0, 0);
    return copy;
  }

  const submitBackfill = async () => {
    if (!backfillDate || !backfillStartTime || !backfillEndTime) {
      toast({ title: 'Angaben unvollständig', description: 'Datum, Start und Ende sind erforderlich.' });
      return;
    }
    const startDt = buildDateTime(backfillDate, backfillStartTime);
    const endDt = buildDateTime(backfillDate, backfillEndTime);
    if (endDt <= startDt) {
      toast({ title: 'Ungültiger Zeitraum', description: 'Ende muss nach Start liegen.', variant: 'destructive' });
      return;
    }
    const pausedSeconds = Math.max(0, Math.floor((Number(backfillPauseMin) || 0) * 60));

    setBackfillSaving(true);
    try {
      if (!user) {
        toast({ title: 'Nicht angemeldet', description: 'Bitte melden Sie sich an, um Zeiten nachzutragen.', variant: 'destructive' });
        return;
      }
      
      const payload: any = {
        user_id: user.id,
        started_at: startDt.toISOString(),
        ended_at: endDt.toISOString(),
        paused_seconds: pausedSeconds,
        notes: backfillReason || null,
        branch_id: backfillBranchId || null,
        activity_id: backfillActivityId || null,
      };
      const { error } = await supabase.from('time_entries').insert(payload);
      if (error) throw error;
      
      // Trigger storage event to refresh other components
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'time_entries_updated',
        newValue: Date.now().toString()
      }));
        
      toast({ title: 'Stunden nachgetragen', description: 'Eintrag in Supabase gespeichert.' });
      
      // Reset form
      setBackfillReason('');
      setBackfillBranchId('');
      setBackfillActivityId('');
      setBackfillPauseMin('0');
    } catch (e: any) {
      toast({ title: 'Fehler beim Speichern', description: e.message || String(e), variant: 'destructive' });
    } finally {
      setBackfillSaving(false);
    }
  };

  useEffect(() => {
    document.title = 'Tracken – Crafton Time';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Arbeitszeit start/stop/pause – schnelle Erfassung und sichere Speicherung.');
  }, []);

  const status: { label: string; variant: "default" | "secondary" | "destructive"; } = !session ? {
    label: 'Bereit',
    variant: 'secondary'
  } : session.status === 'paused' ? {
    label: 'Pausiert',
    variant: 'secondary'
  } : {
    label: 'Läuft',
    variant: 'default'
  };

  const showWizard = (!branch || !activity) && !session;

  return (
    <section className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-[1fr,420px]">
      {offline && (
        <div className="md:col-span-2 rounded-xl border p-3 text-sm bg-secondary">
          <div className="flex items-center gap-2">
            <WifiOff className="h-4 w-4" /> Offline – Timer läuft serverseitig weiter (geplant).
          </div>
        </div>
      )}
      
      {todayAbsence && (
        <div className="md:col-span-2 rounded-xl border p-3 text-sm bg-red-50 border-red-200">
          <div className="flex items-center gap-2 text-red-700">
            <span className="font-semibold">
              {todayAbsence === 'sickness' ? 'K' : 'U'}
            </span>
            Heute ist als {todayAbsence === 'sickness' ? 'Krankheitstag' : 'Urlaubstag'} markiert. Zeiterfassung blockiert.
          </div>
        </div>
      )}

      {showWizard ? (
        <article className="md:col-span-2 rounded-2xl border bg-card p-4 sm:p-6 shadow-sm">
          <header className="mb-4">
            <h1 className="text-2xl font-semibold tracking-tight">Zeit-Tracker Onboarding</h1>
          </header>
          <OnboardingWizard 
            branches={branchOptions as unknown as readonly string[]} 
            activities={filteredActivities as unknown as readonly string[]} 
            branch={branch} 
            activity={activity} 
            onChangeBranch={setBranch} 
            onChangeActivity={setActivity} 
          />
        </article>
      ) : (
        <>
          <article className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm">
            <header className="mb-4 flex items-center justify-between">
              <h1 className="text-2xl font-semibold tracking-tight">Zeit-Tracker</h1>
              <Badge variant={status.variant}>{status.label}</Badge>
            </header>

            {/* Zeit – pur */}
            <div className="my-10 flex items-center justify-center">
              <div 
                className="font-bold font-mono tabular-nums tracking-tight text-[clamp(2.75rem,12vw,6rem)] sm:text-[clamp(3.5rem,10vw,7rem)] md:text-[clamp(4rem,8vw,8rem)]" 
                role="status" 
                aria-live="polite"
              >
                {formatTime(elapsed)}
              </div>
            </div>

            {/* Controls (ohne Hover-Animation) */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {!session && (
                <Button 
                  size="lg" 
                  onClick={start} 
                  className="w-full sm:w-auto min-w-[140px]" 
                  disabled={!!todayAbsence}
                >
                  <Play className="mr-2 h-4 w-4" /> Start
                </Button>
              )}
              {session && (
                <Button 
                  size="lg" 
                  variant="secondary" 
                  onClick={pause} 
                  className="w-full sm:w-auto min-w-[140px]"
                >
                  {session.status === 'paused' ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" /> Weiter
                    </>
                  ) : (
                    <>
                      <Pause className="mr-2 h-4 w-4" /> Pause
                    </>
                  )}
                </Button>
              )}
              {session && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      size="lg" 
                      variant="destructive" 
                      className="w-full sm:w-auto min-w-[140px]"
                    >
                      <Square className="mr-2 h-4 w-4" /> Stop
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Session beenden?</AlertDialogTitle>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction onClick={stop}>Beenden</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </article>

          {/* Side card for selections */}
          <aside className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-medium">Kontext</h2>
            <div className="grid gap-4">
              <div className="grid gap-4">
                <h3 className="text-xl font-medium">Wo arbeitest du?</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(branchOptions.length > 0 ? branchOptions : BRANCHES).map(b => (
                    <Button 
                      key={b} 
                      type="button" 
                      variant={branch === b ? "default" : "outline"} 
                      className="h-auto py-4 px-4 justify-center" 
                      aria-pressed={branch === b} 
                      onClick={() => handleChangeBranch(b)}
                    >
                      {b}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4">
                <h3 className="text-xl font-medium">Was machst du?</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {filteredActivities.map(a => (
                    <Button 
                      key={a} 
                      type="button" 
                      variant={activity === a ? "default" : "outline"} 
                      className="h-auto py-4 px-4 justify-center" 
                      aria-pressed={activity === a} 
                      onClick={() => handleChangeActivity(a)}
                    >
                      {a}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border p-3 text-sm bg-secondary/60">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> <span>{branch || "Keine Filiale"}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Briefcase className="h-4 w-4" /> <span>{activity || "Keine Tätigkeit"}</span>
                </div>
              </div>
            </div>
          </aside>
          
          {/* Backfill section */}
          <section className="md:col-span-2 mt-6">
            <Card>
              <CardHeader><CardTitle>Stunden nachtragen</CardTitle></CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm text-muted-foreground">Datum</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("justify-start font-normal", !backfillDate && "text-muted-foreground")}> 
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {backfillDate ? backfillDate.toLocaleDateString() : <span>Datum wählen</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="z-50 w-auto p-0" align="start">
                        <Calendar 
                          mode="single" 
                          selected={backfillDate}
                          onSelect={setBackfillDate}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm text-muted-foreground">Start</label>
                    <Input type="time" value={backfillStartTime} onChange={(e) => setBackfillStartTime(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm text-muted-foreground">Ende</label>
                    <Input type="time" value={backfillEndTime} onChange={(e) => setBackfillEndTime(e.target.value)} />
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm text-muted-foreground">Filiale</label>
                    <Select value={backfillBranchId} onValueChange={setBackfillBranchId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filiale wählen" />
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-popover text-popover-foreground border rounded-md shadow-md">
                        {Object.entries(branchIdByName.current).map(([name, id]) => (
                          <SelectItem key={id} value={id}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm text-muted-foreground">Tätigkeit</label>
                    <Select value={backfillActivityId} onValueChange={setBackfillActivityId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tätigkeit wählen" />
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-popover text-popover-foreground border rounded-md shadow-md">
                        {Object.entries(activityIdByName.current)
                          .filter(([name]) => BACKFILL_ACTIVITY_NAMES.includes(name as any))
                          .map(([name, id]) => (
                            <SelectItem key={id} value={id}>{name}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm text-muted-foreground">Pause (Minuten)</label>
                    <Input type="number" min={0} value={backfillPauseMin} onChange={(e) => setBackfillPauseMin(e.target.value)} />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm text-muted-foreground">Grund / Notiz</label>
                  <Textarea value={backfillReason} onChange={(e) => setBackfillReason(e.target.value)} placeholder="Warum wird nachgetragen?" />
                </div>

                <div className="flex justify-end">
                  <Button onClick={submitBackfill} disabled={backfillSaving}>
                    {backfillSaving ? 'Speichern…' : 'Nachtrag speichern'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </section>
  );
}
