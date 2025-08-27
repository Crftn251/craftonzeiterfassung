import { useState, useEffect, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useStopwatch } from 'react-timer-hook';
import { supabase } from "@/integrations/supabase/client";
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Calendar } from "@/components/ui/calendar"
import { CalendarIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import BranchManager from "./BranchManager";
import ActivityManager from "./ActivityManager";
import AssignmentManager from "./AssignmentManager";

interface TimeEntry {
  id: string;
  branch_id: string | null;
  activity_id: string | null;
  start_time: string;
  end_time: string | null;
  paused_seconds: number;
  note: string | null;
}

export default function Track() {
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [allActivities, setAllActivities] = useState<string[]>([]);
  const [branchActivities, setBranchActivities] = useState<Record<string, string[]>>({});
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [note, setNote] = useState<string>("");
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [timeEntryId, setTimeEntryId] = useState<string | null>(null);
  const [pausedSeconds, setPausedSeconds] = useState<number>(0);
  const [pauseStart, setPauseStart] = useState<Date | null>(null);
  const [date, setDate] = useState<Date | undefined>(new Date());

  const stopwatch = useStopwatch({ autoStart: false });

  const loadData = useCallback(async () => {
    console.log("Loading branches and activities...");
    
    const [branchesRes, activitiesRes, branchActivitiesRes] = await Promise.all([
      supabase.from('branches').select('name').order('name'),
      supabase.from('activities').select('name').order('name'),
      supabase.from('branch_activities').select(`
        branches!inner(name),
        activities!inner(name)
      `)
    ]);

    if (branchesRes.data) {
      const branchNames = branchesRes.data.map(b => b.name);
      setBranches(branchNames);
      console.log("Loaded branches:", branchNames);
    }

    if (activitiesRes.data) {
      const activityNames = activitiesRes.data.map(a => a.name);
      setAllActivities(activityNames);
      console.log("Loaded all activities:", activityNames);
    }

    if (branchActivitiesRes.data) {
      const mappings: Record<string, string[]> = {};
      branchActivitiesRes.data.forEach(item => {
        const branchName = item.branches.name;
        const activityName = item.activities.name;
        if (!mappings[branchName]) {
          mappings[branchName] = [];
        }
        mappings[branchName].push(activityName);
      });
      setBranchActivities(mappings);
      console.log("Loaded branch-activity mappings:", mappings);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const loadRunningEntry = async () => {
      const today = date ? format(date, 'yyyy-MM-dd', { locale: de }) : format(new Date(), 'yyyy-MM-dd', { locale: de });
      const startOfDay = `${today}T00:00:00+00:00`;
      const endOfDay = `${today}T23:59:59+00:00`;

      const { data: timeEntries, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', supabase.auth.currentUser?.uid)
        .is('end_time', null)
        .gte('start_time', startOfDay)
        .lte('start_time', endOfDay)
        .order('start_time', { ascending: false })
        .limit(1);

      if (error) {
        toast({ title: 'Fehler', description: 'Konnte laufenden Eintrag nicht laden', variant: 'destructive' });
        return;
      }

      if (timeEntries && timeEntries.length > 0) {
        const runningEntry = timeEntries[0];
        setTimeEntryId(runningEntry.id);
        setSelectedBranch(
          branches.find((branch) => branch === runningEntry.branch_id) || null
        );
        setSelectedActivity(
          allActivities.find((activity) => activity === runningEntry.activity_id) || null
        );
        setNote(runningEntry.note || "");
        setStartTime(new Date(runningEntry.start_time));
        setPausedSeconds(runningEntry.paused_seconds);

        const diff = new Date().getTime() - new Date(runningEntry.start_time).getTime();
        stopwatch.setTime(diff - (runningEntry.paused_seconds * 1000));
        
        setIsRunning(true);
        stopwatch.start();
      }
    };

    loadRunningEntry();
  }, [date, branches, allActivities, stopwatch]);

  const handleBranchChange = (branch: string) => {
    setSelectedBranch(branch);
  };

  const handleActivityChange = (activity: string) => {
    setSelectedActivity(activity);
  };

  const handleStart = async () => {
    if (!selectedBranch || !selectedActivity) {
      toast({ title: 'Hinweis', description: 'Bitte Branch und Tätigkeit auswählen', variant: 'warning' });
      return;
    }

    setIsRunning(true);
    setStartTime(new Date());
    stopwatch.start();

    const { data: branchData } = await supabase
      .from('branches')
      .select('id')
      .eq('name', selectedBranch)
      .single();

    const { data: activityData } = await supabase
      .from('activities')
      .select('id')
      .eq('name', selectedActivity)
      .single();

    if (!branchData || !activityData) {
      toast({ title: 'Fehler', description: 'Branch oder Tätigkeit nicht gefunden', variant: 'destructive' });
      return;
    }

    const { data: timeEntry, error } = await supabase
      .from('time_entries')
      .insert({
        branch_id: branchData.id,
        activity_id: activityData.id,
        start_time: new Date().toISOString(),
        note: note,
        paused_seconds: 0,
        user_id: supabase.auth.currentUser?.uid
      })
      .select()
      .single();

    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      setIsRunning(false);
      stopwatch.reset();
      return;
    }

    setTimeEntryId(timeEntry.id);
  };

  const handleStop = async () => {
    setIsRunning(false);
    stopwatch.pause();

    const { error } = await supabase
      .from('time_entries')
      .update({
        end_time: new Date().toISOString()
      })
      .eq('id', timeEntryId);

    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      setIsRunning(true);
      stopwatch.resume();
      return;
    }

    setTimeEntryId(null);
    setStartTime(null);
    setPausedSeconds(0);
    setPauseStart(null);
    stopwatch.reset();
  };

  const handlePause = async () => {
    setIsRunning(false);
    stopwatch.pause();
    setPauseStart(new Date());
  };

  const handleResume = async () => {
    setIsRunning(true);
    stopwatch.resume();

    const pauseDuration = Math.floor((new Date().getTime() - new Date(pauseStart!).getTime()) / 1000);
    setPausedSeconds(pausedSeconds + pauseDuration);
    setPauseStart(null);

    const { error } = await supabase
      .from('time_entries')
      .update({
        paused_seconds: pausedSeconds + pauseDuration
      })
      .eq('id', timeEntryId);

    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      setIsRunning(false);
      stopwatch.pause();
      return;
    }
  };

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNote(e.target.value);

    if (timeEntryId) {
      supabase
        .from('time_entries')
        .update({
          note: e.target.value
        })
        .eq('id', timeEntryId)
        .then(() => console.log('Note updated in DB'))
        .catch(error => toast({ title: 'Fehler', description: error.message, variant: 'destructive' }));
    }
  };

  const getAvailableActivities = () => {
    return branchActivities[selectedBranch || ''] || [];
  };

  const handleRefreshData = () => {
    loadData();
  };

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Zeiterfassung</CardTitle>
          <CardDescription>Erfasse deine Arbeitszeit schnell und einfach.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date">Datum</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP", { locale: de }) : (
                      <span>Datum wählen</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center" side="bottom">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(date) =>
                      date > new Date()
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label htmlFor="branch">Branch</Label>
              <Select onValueChange={handleBranchChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Branch wählen" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="activity">Tätigkeit</Label>
              <Select onValueChange={handleActivityChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Tätigkeit wählen" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableActivities().map((activity) => (
                    <SelectItem key={activity} value={activity}>{activity}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Aktuelle Zeit</Label>
              <div className="text-2xl font-bold">{format(new Date(), 'HH:mm:ss')}</div>
            </div>
          </div>

          <div>
            <Label htmlFor="note">Notiz</Label>
            <Textarea
              id="note"
              placeholder="Notiz hinzufügen..."
              value={note}
              onChange={handleNoteChange}
            />
          </div>

          <div className="flex items-center space-x-2">
            {!isRunning ? (
              <Button onClick={handleStart} disabled={!selectedBranch || !selectedActivity}>Start</Button>
            ) : (
              <>
                {pauseStart ? (
                  <Button onClick={handleResume}>Fortsetzen</Button>
                ) : (
                  <Button onClick={handlePause}>Pause</Button>
                )}
                <Button variant="destructive" onClick={handleStop}>Stop</Button>
              </>
            )}
            <div className="text-lg font-semibold">
              {isRunning ? stopwatch.formatTime() : '00:00:00'}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <BranchManager branches={branches} onRefresh={handleRefreshData} />
        <ActivityManager activities={allActivities} onRefresh={handleRefreshData} />
        <AssignmentManager 
          currentBranch={selectedBranch || ""}
          branchActivities={branchActivities}
          allActivities={allActivities}
          onRefresh={handleRefreshData}
        />
      </div>
    </div>
  );
}
