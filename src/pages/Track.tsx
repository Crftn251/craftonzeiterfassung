import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Pause, Play, Square, RefreshCw, Building2, Briefcase, WifiOff } from "lucide-react";
import OnboardingWizard from "./track/OnboardingWizard";
import BranchManager from "./track/BranchManager";
import ActivityManager from "./track/ActivityManager";
import AssignmentManager from "./track/AssignmentManager";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
const BRANCHES = ["SPZ", "SPW", "SPR", "J&C", "BÜRO", "TAL"] as const;
const ACTIVITIES = ["Ordnung", "Verkauf", "OLS", "Social Media", "Meeting", "Ware"] as const;

function formatTime(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [branchOptions, setBranchOptions] = useState<string[]>([...BRANCHES] as unknown as string[]);
  const [activityOptions, setActivityOptions] = useState<string[]>([...ACTIVITIES] as unknown as string[]);
  const [branchActivities, setBranchActivities] = useState<Record<string, string[]>>({});
  const branchIdByName = useRef<Record<string, string>>({});
  const activityIdByName = useRef<Record<string, string>>({});
  const [todayAbsence, setTodayAbsence] = useState<string | null>(null);

  const elapsed = useMemo(() => {
    if (!session) return 0;
    const now = Date.now();
    const end = session.end ?? now;
    const total = Math.max(0, Math.floor((end - session.start) / 1000) - session.pausedSeconds);
    return total;
  }, [session, tick]);

  // Get activities for current branch - only show mapped activities, no fallback
  const currentActivities = useMemo(() => {
    if (!branch) return [];
    return branchActivities[branch] || [];
  }, [branch, branchActivities]);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  useEffect(() => {
    if (session && session.status === 'running') {
      tickRef.current = window.setInterval(() => {
        setTick((t) => t + 1);
      }, 1000);
    }
    return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
  }, [session?.status]);

  useEffect(() => {
    let sub: any;
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);
      
      // Check if user is admin
      if (data.user) {
        const { data: isAdminResult } = await supabase
          .rpc('is_admin', { uid: data.user.id });
        setIsAdmin(!!isAdminResult);
      }
      
      sub = supabase.auth.onAuthStateChange(async (_e, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          const { data: isAdminResult } = await supabase
            .rpc('is_admin', { uid: session.user.id });
          setIsAdmin(!!isAdminResult);
        } else {
          setIsAdmin(false);
        }
      });
    })();
    return () => sub?.data?.subscription?.unsubscribe?.();
  }, []);

  const refreshData = async () => {
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

    // Load branch-specific activities
    const { data: branchActivitiesData } = await supabase
      .from('branch_activities')
      .select(`
        branches!inner(name),
        activities!inner(name)
      `);
    
    if (branchActivitiesData) {
      const branchActivityMap: Record<string, string[]> = {};
      branchActivitiesData.forEach((item: any) => {
        const branchName = item.branches.name;
        const activityName = item.activities.name;
        
        if (!branchActivityMap[branchName]) {
          branchActivityMap[branchName] = [];
        }
        branchActivityMap[branchName].push(activityName);
      });
      setBranchActivities(branchActivityMap);
    }
    
    // Check if current branch still exists, if not clear it
    if (branch && b && !b.some(br => br.name === branch)) {
      setBranch('');
      setActivity('');
    }
    
    // Check if current activity still exists for current branch
    if (activity && branch && branchActivitiesData) {
      const branchActivityMap: Record<string, string[]> = {};
      branchActivitiesData.forEach((item: any) => {
        const branchName = item.branches.name;
        const activityName = item.activities.name;
        
        if (!branchActivityMap[branchName]) {
          branchActivityMap[branchName] = [];
        }
        branchActivityMap[branchName].push(activityName);
      });
      
      if (!branchActivityMap[branch]?.includes(activity)) {
        setActivity('');
      }
    }
  };

  useEffect(() => {
    (async () => {
      await refreshData();
      
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

  const start = () => {
    if (!user) {
      toast({ title: 'Nicht angemeldet', description: 'Bitte melden Sie sich an, um die Zeiterfassung zu nutzen.', variant: 'destructive' });
      return;
    }
    
    if (!branch || !activity) {
      toast({ title: 'Auswahl erforderlich', description: 'Bitte Filiale und Tätigkeit wählen.' });
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
      status: 'running',
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
      setSession({ ...session, pausedSeconds: session.pausedSeconds + add, status: 'running' });
    } else {
      // pause
      localStorage.setItem('ct_paused_since', String(Date.now()));
      setSession({ ...session, status: 'paused' });
    }
  };

  // Persist a finished session only in Supabase
  const persistFinished = async (finished: SessionRecord) => {
    if (!user) {
      toast({ title: 'Nicht angemeldet', description: 'Bitte melden Sie sich an, um Zeiten zu speichern.', variant: 'destructive' });
      return;
    }

    const payload: any = {
      user_id: user.id,
      started_at: new Date(finished.start).toISOString(),
      ended_at: finished.end ? new Date(finished.end).toISOString() : null,
      paused_seconds: finished.pausedSeconds,
    };
    const bid = branchIdByName.current[finished.branch];
    const aid = activityIdByName.current[finished.activity];
    if (bid) payload.branch_id = bid;
    if (aid) payload.activity_id = aid;
    
    const { error } = await supabase.from('time_entries').insert(payload);
    if (error) {
      toast({ title: 'Speichern fehlgeschlagen', description: error.message, variant: 'destructive' });
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
    const finished: SessionRecord = { ...session, end: now, status: 'stopped', pausedSeconds: session.pausedSeconds + pausedExtra };
    await persistFinished(finished);
    setSession(null);
    toast({ title: 'Session beendet', description: 'Abschnitt gespeichert.' });
  };

  const handleChangeBranch = async (nextBranch: string) => {
    if (session && (session.status === 'running' || session.status === 'paused')) {
      const now = Date.now();
      let pausedExtra = 0;
      if (session.status === 'paused') {
        const pausedMarker = Number(localStorage.getItem('ct_paused_since')) || now;
        pausedExtra = Math.max(0, Math.floor((now - pausedMarker) / 1000));
      }
      const finished: SessionRecord = { ...session, end: now, status: 'stopped', pausedSeconds: session.pausedSeconds + pausedExtra };
      // Clear any previous pause marker since we finalize this segment now
      localStorage.removeItem('ct_paused_since');
      await persistFinished(finished);

      setBranch(nextBranch);
      
      // Clear activity if it's not available for the new branch
      const newBranchActivities = branchActivities[nextBranch] || [];
      if (!newBranchActivities.includes(activity)) {
        setActivity('');
      }
      
      const newSession: SessionRecord = {
        id: crypto.randomUUID(),
        start: now,
        pausedSeconds: 0,
        branch: nextBranch,
        activity: newBranchActivities.includes(activity) ? activity : '',
        status: session.status,
      };
      setSession(newSession);
      if (session.status === 'paused') {
        localStorage.setItem('ct_paused_since', String(now));
      }
      toast({ title: 'Filiale gewechselt', description: 'Abschnitt gespeichert, neuer gestartet.' });
    } else {
      setBranch(nextBranch);
      
      // Clear activity if it's not available for the new branch
      const newBranchActivities = branchActivities[nextBranch] || [];
      if (!newBranchActivities.includes(activity)) {
        setActivity('');
      }
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
      const finished: SessionRecord = { ...session, end: now, status: 'stopped', pausedSeconds: session.pausedSeconds + pausedExtra };
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
        status: session.status,
      };
      setSession(newSession);
      if (session.status === 'paused') {
        localStorage.setItem('ct_paused_since', String(now));
      }
      toast({ title: 'Tätigkeit gewechselt', description: 'Abschnitt gespeichert, neuer gestartet.' });
    } else {
      setActivity(nextActivity);
    }
  };

  useEffect(() => {
    document.title = 'Tracken – Crafton Time';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Arbeitszeit start/stop/pause – schnelle Erfassung und sichere Speicherung.');
  }, []);

  const status: { label: string; variant: "default" | "secondary" | "destructive" } = !session
    ? { label: 'Bereit', variant: 'secondary' }
    : session.status === 'paused'
      ? { label: 'Pausiert', variant: 'secondary' }
      : { label: 'Läuft', variant: 'default' };

  const showWizard = (!branch || !activity) && !session;

  return (
    <section className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-[1fr,420px]">
      {offline && (
        <div className="md:col-span-2 rounded-xl border p-3 text-sm bg-secondary">
          <div className="flex items-center gap-2"><WifiOff className="h-4 w-4" /> Offline – Timer läuft serverseitig weiter (geplant).</div>
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
            activities={currentActivities as unknown as readonly string[]}
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
              <div className="font-bold font-mono tabular-nums tracking-tight text-[clamp(2.75rem,12vw,6rem)] sm:text-[clamp(3.5rem,10vw,7rem)] md:text-[clamp(4rem,8vw,8rem)]" role="status" aria-live="polite">
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
                <Button size="lg" variant="secondary" onClick={pause} className="w-full sm:w-auto min-w-[140px]">
                  {session.status === 'paused' ? (<><RefreshCw className="mr-2 h-4 w-4" /> Weiter</>) : (<><Pause className="mr-2 h-4 w-4" /> Pause</>)}
                </Button>
              )}
              {session && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="lg" variant="destructive" className="w-full sm:w-auto min-w-[140px]">
                      <Square className="mr-2 h-4 w-4" /> Stop
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Session beenden?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Deine Netto-Arbeitszeit und Pausen werden gespeichert. Dies kann nicht rückgängig gemacht werden.
                      </AlertDialogDescription>
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
                  {(branchOptions.length > 0 ? branchOptions : BRANCHES).map((b) => (
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
                  {currentActivities.map((a) => (
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
              
              {/* Admin Management Tools */}
              {isAdmin && (
                <div className="space-y-2 pt-4 border-t">
                  <h4 className="text-sm font-medium text-muted-foreground">Admin-Bereich</h4>
                  <div className="flex flex-col gap-2">
                    <BranchManager 
                      branches={branchOptions}
                      onRefresh={refreshData}
                    />
                    <ActivityManager 
                      activities={activityOptions}
                      onRefresh={refreshData}
                    />
                    {branch && (
                      <AssignmentManager 
                        currentBranch={branch}
                        branchActivities={branchActivities}
                        allActivities={activityOptions}
                        onRefresh={refreshData}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </section>
  );
}
