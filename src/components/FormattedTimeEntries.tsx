
import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CalendarX, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface FormattedTimeEntry {
  id: string;
  user_email: string;
  user_display_name: string;
  branch_name: string;
  activity_name: string;
  date_local: string;
  start_local: string;
  end_local: string | null;
  status: 'running' | 'ended';
  net_hhmm: string;
  paused_seconds: number;
  notes: string | null;
  created_at: string;
  started_at?: string;
  ended_at?: string;
  net_seconds?: number;
}

export default function FormattedTimeEntries() {
  const [entries, setEntries] = useState<FormattedTimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = async () => {
    try {
      const { data, error } = await supabase
        .from('v_time_entries_formatted')
        .select('*')
        .order('started_at', { ascending: false });

      if (error) {
        console.error('Error fetching formatted time entries:', error);
        toast({
          title: 'Fehler',
          description: 'Zeiteinträge konnten nicht geladen werden.',
          variant: 'destructive',
        });
        return;
      }

      // Map the data and ensure status is properly typed
      const mappedData = (data || []).map((entry: any) => ({
        ...entry,
        status: entry.status as 'running' | 'ended'
      }));

      setEntries(mappedData);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Fehler',
        description: 'Ein unerwarteter Fehler ist aufgetreten.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const secondsToHHMM = (seconds: number): string => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const parseHHMM = (hhmm: string): number => {
    const match = hhmm.match(/(\d+):(\d+)/);
    if (!match) return 0;
    return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60;
  };

  const exportCsv = () => {
    if (entries.length === 0) {
      toast({ 
        title: 'Keine Daten', 
        description: 'Es gibt keine Daten zum Exportieren.',
        variant: 'destructive' 
      });
      return;
    }
    
    // Group entries by date
    const groupedByDate = entries.reduce((acc, entry) => {
      const date = entry.date_local;
      if (!acc[date]) acc[date] = [];
      acc[date].push(entry);
      return acc;
    }, {} as Record<string, FormattedTimeEntry[]>);

    const now = new Date();
    const header = ["Datum", "Benutzer", "Filiale", "Tätigkeit", "Start", "Ende", "Status", "Pause(min)", "Brutto(HH:MM)", "Netto(HH:MM)", "Notizen"];
    const allRows: string[][] = [];
    
    let totalPauseSeconds = 0;
    let totalBruttoSeconds = 0;
    let totalNettoSeconds = 0;

    // Sort dates
    const sortedDates = Object.keys(groupedByDate).sort();

    for (const date of sortedDates) {
      const dayEntries = groupedByDate[date];
      let dayPauseSeconds = 0;
      let dayBruttoSeconds = 0;
      let dayNettoSeconds = 0;

      // Add individual entries for this day
      for (const entry of dayEntries) {
        const startTime = new Date(entry.started_at || entry.created_at);
        const endTime = entry.ended_at ? new Date(entry.ended_at) : (entry.status === 'running' ? now : startTime);
        
        const bruttoSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
        const nettoSeconds = entry.net_seconds || parseHHMM(entry.net_hhmm);
        
        dayPauseSeconds += entry.paused_seconds;
        dayBruttoSeconds += bruttoSeconds;
        dayNettoSeconds += nettoSeconds;

        allRows.push([
          new Date(entry.date_local).toLocaleDateString('de-DE'),
          entry.user_display_name || entry.user_email,
          entry.branch_name || '',
          entry.activity_name || '',
          entry.start_local || '',
          entry.end_local || '—',
          entry.status === 'running' ? 'Läuft' : 'Beendet',
          Math.floor(entry.paused_seconds / 60).toString(),
          secondsToHHMM(bruttoSeconds),
          entry.net_hhmm,
          entry.notes || ''
        ]);
      }

      // Add daily summary
      allRows.push([
        `--- Summe ${new Date(date).toLocaleDateString('de-DE')} ---`,
        '', '', '', '', '', '',
        Math.floor(dayPauseSeconds / 60).toString(),
        secondsToHHMM(dayBruttoSeconds),
        secondsToHHMM(dayNettoSeconds),
        ''
      ]);

      totalPauseSeconds += dayPauseSeconds;
      totalBruttoSeconds += dayBruttoSeconds;
      totalNettoSeconds += dayNettoSeconds;
    }

    // Add grand total
    allRows.push([
      '=== GESAMT-SUMME ===',
      '', '', '', '', '', '',
      Math.floor(totalPauseSeconds / 60).toString(),
      secondsToHHMM(totalBruttoSeconds),
      secondsToHHMM(totalNettoSeconds),
      ''
    ]);
    
    const csv = [header, ...allRows]
      .map(row => row.map(cell => {
        const str = String(cell);
        if (str.includes(';') || str.includes('\n') || str.includes('"')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      }).join(';'))
      .join('\n');
    
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zeiteintraege-formatiert-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border bg-card p-4">
        <div className="text-center py-8">Lade Zeiteinträge...</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium">Formatierte Zeiteinträge</h2>
        <Button variant="secondary" onClick={exportCsv} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          CSV Export
        </Button>
      </div>
      
      <div className="w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Datum</TableHead>
              <TableHead>Benutzer</TableHead>
              <TableHead>Filiale</TableHead>
              <TableHead>Tätigkeit</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>Ende</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pause</TableHead>
              <TableHead>Netto</TableHead>
              <TableHead>Notizen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  {new Date(entry.date_local).toLocaleDateString('de-DE')}
                </TableCell>
                <TableCell>
                  {entry.user_display_name || entry.user_email}
                </TableCell>
                <TableCell>{entry.branch_name || '—'}</TableCell>
                <TableCell>{entry.activity_name || '—'}</TableCell>
                <TableCell>{entry.start_local || '—'}</TableCell>
                <TableCell>{entry.end_local || '—'}</TableCell>
                <TableCell>
                  {entry.status === 'running' ? (
                    <Badge variant="default" className="flex items-center gap-1 w-fit">
                      <Clock className="h-3 w-3" />
                      Läuft
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="flex items-center gap-1 w-fit">
                      <CalendarX className="h-3 w-3" />
                      Beendet
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{Math.floor(entry.paused_seconds / 60)} min</TableCell>
                <TableCell className="font-medium tabular-nums">
                  {entry.net_hhmm}
                </TableCell>
                <TableCell className="max-w-xs truncate" title={entry.notes || ''}>
                  {entry.notes || '—'}
                </TableCell>
              </TableRow>
            ))}
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">
                  Keine Zeiteinträge gefunden
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
