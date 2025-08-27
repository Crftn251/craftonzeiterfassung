import { useEffect, useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Clock, CalendarX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
function fmt(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString();
}

function dur(s: any) {
  const secs = Math.max(0, Math.floor(((s.end ?? Date.now()) - s.start) / 1000) - (s.pausedSeconds || 0));
  const h = Math.floor(secs / 3600).toString().padStart(2, '0');
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export default function HistoryPage() {
  useEffect(() => {
    document.title = 'Historie – Crafton Time';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Alle Sessions als Tabelle – filter- und exportierbar (bald).');
  }, []);

  
  const [user, setUser] = useState<any>(null);
  const [supData, setSupData] = useState<any[]>([]);
  const [absenceData, setAbsenceData] = useState<any[]>([]);
  
  // Only use Supabase data, no localStorage fallback
  const data = useMemo(() => {
    const allEntries = [...supData, ...absenceData];
    return allEntries.sort((a, b) => (b.start || b.date) - (a.start || a.date));
  }, [supData, absenceData]);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    
    // Listen for absence days updates
    const handleStorageUpdate = (e: StorageEvent) => {
      // Force refresh of data when absence days or time entries are updated
      if (user && (e.key === 'absence_days_updated' || e.key === 'time_entries_updated')) {
        if (e.key === 'absence_days_updated') {
          fetchAbsenceData();
        } else if (e.key === 'time_entries_updated') {
          fetchTimeEntries();
        }
      }
    };
    
    window.addEventListener('storage', handleStorageUpdate);
    
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('storage', handleStorageUpdate);
    };
  }, [user]);

  const fetchAbsenceData = async () => {
    if (!user) return;
    
    const { data: absenceDataResult, error: absenceError } = await supabase
      .from('absence_days')
      .select('id,date,type')
      .order('date', { ascending: false });
    
    if (!absenceError && absenceDataResult) {
      const mappedAbsence = absenceDataResult.map((r: any) => ({
        id: r.id,
        date: new Date(r.date).getTime(),
        start: new Date(r.date).getTime(), // For sorting
        branch: r.type === 'sick' ? 'Krankheit' : 'Urlaub',
        activity: r.type === 'sick' ? 'K' : 'U',
        type: 'absence'
      }));
      setAbsenceData(mappedAbsence);
    }
  };

  const fetchTimeEntries = async () => {
    if (!user) return;
    
    const { data: timeData, error: timeError } = await supabase
      .from('time_entries')
      .select('id,started_at,ended_at,paused_seconds, branches(name), activities(name)')
      .order('started_at', { ascending: false });
    
    if (!timeError && timeData) {
      const mapped = timeData.map((r: any) => ({
        id: r.id,
        start: new Date(r.started_at).getTime(),
        end: r.ended_at ? new Date(r.ended_at).getTime() : undefined,
        pausedSeconds: r.paused_seconds || 0,
        branch: r.branches?.name ?? '',
        activity: r.activities?.name ?? '',
        type: 'time_entry'
      }));
      setSupData(mapped);
    }
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      await fetchTimeEntries();
      await fetchAbsenceData();
    })();
  }, [user]);

  // Listen for page visibility changes to refresh data
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user) {
        fetchTimeEntries();
        fetchAbsenceData();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  function toCsvValue(v: any) {
    const s = String(v ?? "");
    if (s.includes(";") || s.includes("\n") || s.includes('"')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  const exportCsv = () => {
    if (data.length === 0) {
      toast({ title: 'Keine Daten', description: 'Es gibt keine Daten zum Exportieren.', variant: 'destructive' });
      return;
    }
    
    const header = ["Datum","Typ","Filiale","Tätigkeit","Start","Ende","Pause(min)","Netto(HH:MM)"];
    const rows = data.map((s: any) => [
      new Date(s.start || s.date).toLocaleDateString(),
      s.type === 'absence' ? `Abwesenheit (${s.branch})` : 'Zeit',
      s.branch ?? "",
      s.activity ?? "",
      s.type === 'absence' ? '—' : fmt(s.start),
      s.type === 'absence' ? '—' : (s.end ? fmt(s.end) : '—'),
      s.type === 'absence' ? '—' : Math.floor((s.pausedSeconds || 0) / 60),
      s.type === 'absence' ? '—' : dur(s)
    ]);
    const csv = [header, ...rows].map(r => r.map(toCsvValue).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crafton-time-historie-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <h1 className="sr-only">Historie – Crafton Time</h1>
      <section className="rounded-2xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-medium">Historie</div>
          <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
        </div>
        <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Filiale</TableHead>
                <TableHead>Tätigkeit</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Ende</TableHead>
                <TableHead>Pause</TableHead>
                <TableHead>Netto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell>{new Date(s.start || s.date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {s.type === 'absence' ? (
                      <Badge variant="outline" className="flex items-center gap-1 w-fit">
                        <CalendarX className="h-3 w-3" />
                        Abwesenheit ({s.branch})
                      </Badge>
                    ) : (
                      <Badge variant="default" className="flex items-center gap-1 w-fit">
                        <Clock className="h-3 w-3" />
                        Zeit
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{s.branch}</TableCell>
                  <TableCell>{s.activity}</TableCell>
                  <TableCell>
                    {s.type === 'absence' ? '—' : fmt(s.start)}
                  </TableCell>
                  <TableCell>
                    {s.type === 'absence' ? '—' : (s.end ? fmt(s.end) : '—')}
                  </TableCell>
                  <TableCell>
                    {s.type === 'absence' ? '—' : `${Math.floor((s.pausedSeconds || 0) / 60)} min`}
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">
                    {s.type === 'absence' ? '—' : dur(s)}
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">Noch keine Einträge</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </>
  );
}
