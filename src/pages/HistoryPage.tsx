import { useEffect, useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { getSupabase } from "@/lib/supabaseClient";
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

  const history = useMemo(() => {
    return JSON.parse(localStorage.getItem('ct_history') || '[]') as any[];
  }, []);

  const supabase = getSupabase();
  const [user, setUser] = useState<any>(null);
  const [supData, setSupData] = useState<any[]>([]);
  const [absenceData, setAbsenceData] = useState<any[]>([]);
  
  // Combine time entries and absence days, sort by date
  const data = useMemo(() => {
    const timeEntries = supData.length ? supData : history;
    const allEntries = [...timeEntries, ...absenceData];
    return allEntries.sort((a, b) => (b.start || b.date) - (a.start || a.date));
  }, [supData, history, absenceData]);
  useEffect(() => {
    if (!supabase) return;
    let sub: any;
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);
      sub = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    })();
    return () => sub?.data?.subscription?.unsubscribe?.();
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !user) return;
    (async () => {
      // Fetch time entries
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

      // Fetch absence days
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
    })();
  }, [supabase, user]);

  function toCsvValue(v: any) {
    const s = String(v ?? "");
    if (s.includes(";") || s.includes("\n") || s.includes('"')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  const exportCsv = () => {
    const header = ["Datum","Filiale","Tätigkeit","Start","Ende","Pause(min)","Netto(HH:MM)"];
    const rows = history.map((s: any) => [
      new Date(s.start).toLocaleDateString(),
      s.branch ?? "",
      s.activity ?? "",
      fmt(s.start),
      s.end ? fmt(s.end) : "—",
      Math.floor((s.pausedSeconds || 0) / 60),
      dur(s)
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
                  <TableCell colSpan={7} className="text-center text-muted-foreground">Noch keine Einträge</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </>
  );
}
