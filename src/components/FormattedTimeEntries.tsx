
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

  const exportCsv = () => {
    if (entries.length === 0) {
      toast({ 
        title: 'Keine Daten', 
        description: 'Es gibt keine Daten zum Exportieren.',
        variant: 'destructive' 
      });
      return;
    }
    
    const header = ["Datum", "Benutzer", "Filiale", "Tätigkeit", "Start", "Ende", "Status", "Pause(min)", "Netto", "Notizen"];
    const rows = entries.map((entry) => [
      new Date(entry.date_local).toLocaleDateString('de-DE'),
      entry.user_display_name || entry.user_email,
      entry.branch_name || '',
      entry.activity_name || '',
      entry.start_local || '',
      entry.end_local || '—',
      entry.status === 'running' ? 'Läuft' : 'Beendet',
      Math.floor(entry.paused_seconds / 60).toString(),
      entry.net_hhmm,
      entry.notes || ''
    ]);
    
    const csv = [header, ...rows]
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
