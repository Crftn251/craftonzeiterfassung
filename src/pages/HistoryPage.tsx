import { useEffect, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

  return (
    <>
      <h1 className="sr-only">Historie – Crafton Time</h1>
      <section className="rounded-2xl border bg-card p-4">
        <div className="mb-3 text-lg font-medium">Historie</div>
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
              {history.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell>{new Date(s.start).toLocaleDateString()}</TableCell>
                  <TableCell>{s.branch}</TableCell>
                  <TableCell>{s.activity}</TableCell>
                  <TableCell>{fmt(s.start)}</TableCell>
                  <TableCell>{s.end ? fmt(s.end) : '—'}</TableCell>
                  <TableCell>{Math.floor((s.pausedSeconds || 0) / 60)} min</TableCell>
                  <TableCell className="font-medium tabular-nums">{dur(s)}</TableCell>
                </TableRow>
              ))}
              {history.length === 0 && (
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
