import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Pause, Play, Square, RefreshCw, Building2, Briefcase, WifiOff } from "lucide-react";
import OnboardingWizard from "./track/OnboardingWizard";

const BRANCHES = ["SPZ", "J&C", "TAL", "BÜRO", "SPW", "SPR"] as const;
const ACTIVITIES = ["Ordnung", "Verkauf", "Social Media", "OLS", "Ordern", "Meeting"] as const;

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

  const elapsed = useMemo(() => {
    if (!session) return 0;
    const now = Date.now();
    const end = session.end ?? now;
    const total = Math.max(0, Math.floor((end - session.start) / 1000) - session.pausedSeconds);
    return total;
  }, [session, tick]);

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
    if (!branch || !activity) {
      toast({ title: 'Auswahl erforderlich', description: 'Bitte Filiale und Tätigkeit wählen.' });
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

  const stop = () => {
    if (!session) return;
    const finished: SessionRecord = { ...session, end: Date.now(), status: 'stopped' };
    const existing = JSON.parse(localStorage.getItem('ct_history') || '[]') as SessionRecord[];
    localStorage.setItem('ct_history', JSON.stringify([finished, ...existing]));
    setSession(null);
    toast({ title: 'Session beendet', description: 'Deine Zeit wurde gespeichert. Export in Historie verfügbar.' });
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

      {showWizard ? (
        <article className="md:col-span-2 rounded-2xl border bg-card p-4 sm:p-6 shadow-sm">
          <header className="mb-4">
            <h1 className="text-2xl font-semibold tracking-tight">Zeit-Tracker Onboarding</h1>
          </header>
          <OnboardingWizard
            branches={BRANCHES as unknown as readonly string[]}
            activities={ACTIVITIES as unknown as readonly string[]}
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
                <Button size="lg" onClick={start} className="w-full sm:w-auto min-w-[140px]">
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
              <div className="grid gap-2">
                <label className="text-sm text-muted-foreground">Filiale</label>
                <Select value={branch} onValueChange={setBranch}>
                  <SelectTrigger className=""><SelectValue placeholder="Filiale wählen" /></SelectTrigger>
                  <SelectContent>
                    {BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm text-muted-foreground">Tätigkeit</label>
                <Select value={activity} onValueChange={setActivity}>
                  <SelectTrigger className=""><SelectValue placeholder="Tätigkeit wählen" /></SelectTrigger>
                  <SelectContent>
                    {ACTIVITIES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg border p-3 text-sm bg-secondary/60">
                <div className="flex items-center gap-2"><Building2 className="h-4 w-4" /> <span>{branch || 'Keine Filiale'}</span></div>
                <div className="flex items-center gap-2 mt-1"><Briefcase className="h-4 w-4" /> <span>{activity || 'Keine Tätigkeit'}</span></div>
              </div>
            </div>
          </aside>
        </>
      )}
    </section>
  );
}
