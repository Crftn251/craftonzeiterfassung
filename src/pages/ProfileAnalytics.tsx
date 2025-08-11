import { useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function ProfileAnalytics() {
  useEffect(() => {
    document.title = 'Profil & Auswertungen – Crafton Time';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Heute, Woche, Monat – Summen, Ziele und Fortschritt.');
  }, []);

  const history = useMemo(() => {
    return JSON.parse(localStorage.getItem('ct_history') || '[]') as any[];
  }, []);

  const totalSeconds = history.reduce((acc, s) => acc + Math.max(0, Math.floor(((s.end ?? Date.now()) - s.start) / 1000) - (s.pausedSeconds || 0)), 0);
  const goal = 40 * 3600; // 40h Wochenziel default
  const progress = Math.min(100, Math.round((totalSeconds / goal) * 100));

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
    </>
  );
}
