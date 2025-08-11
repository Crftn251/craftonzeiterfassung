import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Pause, Play, Square, RefreshCw, Building2, Briefcase, WifiOff } from "lucide-react";

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

  const tickRef = useRef<number | null>(null);

  const elapsed = useMemo(() => {
    if (!session) return 0;
    const now = Date.now();
    const end = session.end ?? now;
    const total = Math.max(0, Math.floor((end - session.start) / 1000) - session.pausedSeconds);
    return total;
  }, [session]);

  const goal = 8 * 3600; // 8h default
  const progress = Math.min(1, elapsed / goal);

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
        // just trigger a state update by cloning session
        setSession((s) => (s ? { ...s } : s));
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

  return (
    <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-[1fr,420px]">
      {offline && (
        <div className="md:col-span-2 rounded-xl border p-3 text-sm bg-secondary">
          <div className="flex items-center gap-2"><WifiOff className="h-4 w-4" /> Offline – Timer läuft serverseitig weiter (geplant).</div>
        </div>
      )}

      <article className="rounded-2xl border bg-card p-6 shadow-sm">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Zeit-Tracker</h1>
          <Badge variant={status.variant}>{status.label}</Badge>
        </header>

        {/* Progress Ring + Time */}
        <div className="mx-auto my-8 flex flex-col items-center justify-center">
          <div className="relative h-56 w-56">
            <svg className="h-full w-full" viewBox="0 0 120 120" aria-hidden>
              <defs>
                <linearGradient id="ring" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="hsl(195 65% 40%)" />
                  <stop offset="100%" stopColor="hsl(12 82% 61%)" />
                </linearGradient>
              </defs>
              <circle cx="60" cy="60" r="52" stroke="hsl(var(--muted))" strokeWidth="8" fill="none" />
              <circle
                cx="60"
                cy="60"
                r="52"
                stroke="url(#ring)"
                strokeWidth="8"
                strokeLinecap="round"
                fill="none"
                style={{
                  strokeDasharray: 2 * Math.PI * 52,
                  strokeDashoffset: (1 - progress) * 2 * Math.PI * 52,
                  transition: 'stroke-dashoffset 0.2s ease-out',
                }}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-4xl font-semibold tabular-nums">{formatTime(elapsed)}</div>
              <div className="text-xs text-muted-foreground">Tagesziel 8h</div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {!session && (
            <Button size="lg" onClick={start} className="hover-scale">
              <Play className="mr-2 h-4 w-4" /> Start
            </Button>
          )}
          {session && (
            <Button size="lg" variant="secondary" onClick={pause} className="hover-scale">
              {session.status === 'paused' ? (<><RefreshCw className="mr-2 h-4 w-4" /> Weiter</>) : (<><Pause className="mr-2 h-4 w-4" /> Pause</>)}
            </Button>
          )}
          {session && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="lg" variant="destructive" className="hover-scale">
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
      <aside className="rounded-2xl border bg-card p-6 shadow-sm">
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
    </section>
  );
}
