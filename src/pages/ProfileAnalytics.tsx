import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Heart, Plane } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const BACKFILL_ACTIVITY_NAMES = [
  "Ordnung",
  "Verkauf",
  "Social Media",
  "OLS",
  "Ordern",
  "Meeting",
] as const;

export default function ProfileAnalytics() {
  useEffect(() => {
    document.title = 'Profil & Auswertungen – Crafton Time';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Wöchentliche Fortschritte und Abwesenheiten verwalten.');
  }, []);

  const [userId, setUserId] = useState<string | null>(null);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [activities, setActivities] = useState<{ id: string; name: string }[]>([]);
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [weeklyGoalHours, setWeeklyGoalHours] = useState<number>(40);
  
  // Absence tracking state
  const [absenceDates, setAbsenceDates] = useState<{ [key: string]: 'sickness' | 'vacation' }>({});
  const [selectedAbsenceDates, setSelectedAbsenceDates] = useState<Date[]>([]);
  const [absenceType, setAbsenceType] = useState<'sickness' | 'vacation'>('sickness');
  const [showAbsenceCalendar, setShowAbsenceCalendar] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      if (!mounted) return;
      setUserId(uid);
      if (uid) {
        const [{ data: b }, { data: a }, { data: absences }, { data: profile }] = await Promise.all([
          supabase.from('branches').select('id,name').order('name'),
          supabase.from('activities').select('id,name').order('name'),
          supabase.from('absence_days').select('date,type').eq('user_id', uid),
          supabase.from('profiles').select('weekly_goal_hours').eq('id', uid).single(),
        ]);
        if (!mounted) return;
        setBranches(b || []);
        setActivities(a || []);
        
        // Set weekly goal from profile
        if (profile?.weekly_goal_hours) {
          setWeeklyGoalHours(profile.weekly_goal_hours);
        }
        
        // Load existing absence days
        const absenceMap: { [key: string]: 'sickness' | 'vacation' } = {};
        absences?.forEach(absence => {
          absenceMap[absence.date] = absence.type as 'sickness' | 'vacation';
        });
        setAbsenceDates(absenceMap);
        
        // Load time entries for analytics
        if (uid) {
          const { data: timeData } = await supabase
            .from('time_entries')
            .select('id,started_at,ended_at,paused_seconds')
            .eq('user_id', uid)
            .order('started_at', { ascending: false });
          
          if (timeData) {
            const mapped = timeData.map((r: any) => ({
              id: r.id,
              start: new Date(r.started_at).getTime(),
              end: r.ended_at ? new Date(r.ended_at).getTime() : undefined,
              pausedSeconds: r.paused_seconds || 0,
            }));
            setTimeEntries(mapped);
          }
        }
      } else {
        // Offline/unauthenticated: provide static activities so user can backfill locally
        setBranches([]);
        setActivities(BACKFILL_ACTIVITY_NAMES.map((n) => ({ id: n, name: n })));
      }
    });
    return () => { mounted = false; };
  }, []);

  const totalSeconds = timeEntries.reduce((acc, s) => acc + Math.max(0, Math.floor(((s.end ?? Date.now()) - s.start) / 1000) - (s.pausedSeconds || 0)), 0);
  const goal = weeklyGoalHours * 3600; // Dynamic goal from profile
  const progress = Math.min(100, Math.round((totalSeconds / goal) * 100));


  const handleAbsenceSelection = async (type: 'sickness' | 'vacation') => {
    if (!userId) {
      toast({ title: 'Anmeldung erforderlich', description: 'Bitte melde dich an, um Abwesenheiten zu verwalten.' });
      return;
    }
    
    setAbsenceType(type);
    setSelectedAbsenceDates([]);
    setShowAbsenceCalendar(true);
  };

  const saveAbsenceDays = async () => {
    if (!userId || selectedAbsenceDates.length === 0) return;

    try {
      // Delete existing entries for selected dates
      const datesToSave = selectedAbsenceDates.map(date => format(date, 'yyyy-MM-dd'));
      
      await supabase
        .from('absence_days')
        .delete()
        .eq('user_id', userId)
        .in('date', datesToSave);

      // Insert new entries
      const newEntries = datesToSave.map(date => ({
        user_id: userId,
        date,
        type: absenceType
      }));

      const { error } = await supabase
        .from('absence_days')
        .insert(newEntries);

      if (error) throw error;

      // Update local state
      const newAbsenceMap = { ...absenceDates };
      datesToSave.forEach(date => {
        newAbsenceMap[date] = absenceType;
      });
      setAbsenceDates(newAbsenceMap);

      toast({ 
        title: 'Abwesenheiten gespeichert', 
        description: `${selectedAbsenceDates.length} Tage als ${absenceType === 'sickness' ? 'Krankheit' : 'Urlaub'} markiert.` 
      });
      
      // Trigger a storage event to notify other components (like HistoryPage)
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'absence_days_updated',
        newValue: Date.now().toString()
      }));
      
      setShowAbsenceCalendar(false);
      setSelectedAbsenceDates([]);
    } catch (error: any) {
      toast({ 
        title: 'Fehler beim Speichern', 
        description: error.message, 
        variant: 'destructive' 
      });
    }
  };

  return (
    <>
      <h1 className="sr-only">Profil & Auswertungen – Crafton Time</h1>
      <section className="grid gap-6 md:grid-cols-1">
        <Card className="col-span-1">
          <CardHeader><CardTitle>Woche – Fortschritt</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tabular-nums">{Math.floor(totalSeconds / 3600)}h</div>
            <div className="text-sm text-muted-foreground mb-2">Ziel {weeklyGoalHours}h</div>
            <Progress value={progress} />
          </CardContent>
        </Card>
      </section>

      <section className="mt-6">
        <Card>
          <CardHeader><CardTitle>Abwesenheiten verwalten</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                onClick={() => handleAbsenceSelection('sickness')}
                className="h-auto py-4 flex flex-col items-center gap-2"
              >
                <Heart className="h-6 w-6 text-red-500" />
                <span>Krankheit</span>
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleAbsenceSelection('vacation')}
                className="h-auto py-4 flex flex-col items-center gap-2"
              >
                <Plane className="h-6 w-6 text-blue-500" />
                <span>Urlaub</span>
              </Button>
            </div>
            
            {showAbsenceCalendar && (
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">
                    {absenceType === 'sickness' ? 'Krankheitstage' : 'Urlaubstage'} auswählen
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowAbsenceCalendar(false)}>
                    Abbrechen
                  </Button>
                </div>
                
                <Calendar
                  mode="multiple"
                  selected={selectedAbsenceDates}
                  onSelect={(dates) => setSelectedAbsenceDates(dates || [])}
                  className={cn("p-3 pointer-events-auto w-full flex justify-center")}
                />
                
                {selectedAbsenceDates.length > 0 && (
                  <div className="mt-4 flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      {selectedAbsenceDates.length} Tag(e) ausgewählt
                    </span>
                    <Button onClick={saveAbsenceDays}>
                      Speichern
                    </Button>
                  </div>
                )}
              </div>
            )}
            
            <div className="text-sm text-muted-foreground">
              <p><span className="inline-block w-3 h-3 bg-red-100 border border-red-300 rounded mr-2"></span>Krankheitstage</p>
              <p><span className="inline-block w-3 h-3 bg-blue-100 border border-blue-300 rounded mr-2"></span>Urlaubstage</p>
            </div>
          </CardContent>
        </Card>
      </section>

    </>
  );
}

