import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Play, Pause, Square, Plus, Calendar, MapPin, Briefcase } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import AssignmentManager from "./track/AssignmentManager";
import { useTimer } from "@/contexts/TimerContext";

interface Branch {
  id: string;
  name: string;
}

interface Activity {
  id: string;
  name: string;
}

interface TimeEntry {
  id: string;
  started_at: string;
  ended_at?: string;
  paused_seconds: number;
  branch_id?: string;
  activity_id?: string;
  notes?: string;
}

export default function Track() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedActivity, setSelectedActivity] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [branchActivities, setBranchActivities] = useState<Record<string, string[]>>({});
  const [allActivities, setAllActivities] = useState<string[]>([]);
  const [userActivities, setUserActivities] = useState<string[]>([]);
  const [pendingEntry, setPendingEntry] = useState<TimeEntry | null>(null);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  
  // Timer context
  const { 
    isTracking, 
    isPaused, 
    currentEntry, 
    stopwatch, 
    startTimer: contextStartTimer,
    pauseTimer: contextPauseTimer,
    resumeTimer: contextResumeTimer,
    stopTimer: contextStopTimer,
    resumeExistingEntry: contextResumeExistingEntry,
    discardExistingEntry: contextDiscardExistingEntry
  } = useTimer();

  // Backfill state
  const [showBackfill, setShowBackfill] = useState(false);
  const [backfillDate, setBackfillDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [backfillStartTime, setBackfillStartTime] = useState('09:00');
  const [backfillEndTime, setBackfillEndTime] = useState('17:00');
  const [backfillBranch, setBackfillBranch] = useState<string>('');
  const [backfillActivity, setBackfillActivity] = useState<string>('');
  const [backfillNotes, setBackfillNotes] = useState<string>('');
  const [isSubmittingBackfill, setIsSubmittingBackfill] = useState(false);

  const isMobile = useIsMobile();

  useEffect(() => {
    document.title = 'Zeiterfassung – Crafton Time';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Erfassen Sie Ihre Arbeitszeiten mit Start/Stopp-Timer oder tragen Sie Zeiten nachträglich ein.');
    
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user?.id) return;

      // Load branches
      const { data: branchData } = await supabase
        .from('branches')
        .select('id, name')
        .order('name');

      setBranches(branchData || []);

      // Load all activities
      const { data: activityData } = await supabase
        .from('activities')
        .select('id, name')
        .order('name');

      setActivities(activityData || []);

      // Load user's allowed activities
      const { data: userActivityData } = await supabase
        .from('profile_activities')
        .select('activity_id')
        .eq('profile_id', user.user.id);

      const userActivityIds = userActivityData?.map(pa => pa.activity_id) || [];
      setUserActivities(userActivityIds);

      // Load branch-activity assignments
      await loadBranchActivities();

      // Check for active time entry - only if timer context doesn't have one
      if (!currentEntry) {
        const { data: activeEntry } = await supabase
          .from('time_entries')
          .select('*')
          .eq('user_id', user.user.id)
          .is('ended_at', null)
          .order('started_at', { ascending: false })
          .limit(1)
          .single();

        if (activeEntry) {
          setPendingEntry(activeEntry);
          setShowResumeDialog(true);
        }
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const loadBranchActivities = async () => {
    try {
      const { data: branchActivityData } = await supabase
        .from('branch_activities')
        .select(`
          branch_id,
          activity_id,
          branches!inner(name),
          activities!inner(name)
        `);

      const activityMap: Record<string, string[]> = {};
      const allActivitiesSet = new Set<string>();

      branchActivityData?.forEach((ba: any) => {
        const branchName = ba.branches.name;
        const activityName = ba.activities.name;
        
        if (!activityMap[branchName]) {
          activityMap[branchName] = [];
        }
        activityMap[branchName].push(activityName);
        allActivitiesSet.add(activityName);
      });

      setBranchActivities(activityMap);
      setAllActivities(Array.from(allActivitiesSet));
    } catch (error) {
      console.error('Error loading branch activities:', error);
    }
  };

  // Filter activities to show ONLY user-assigned activities
  const getFilteredActivities = (branchName?: string) => {
    // Start with user's assigned activities only - nothing else
    let availableActivities = activities.filter(a => userActivities.includes(a.id));
    
    // Further filter by branch activities if branch is selected
    if (branchName && branchActivities[branchName]) {
      const branchActivityNames = branchActivities[branchName];
      availableActivities = availableActivities.filter(a => branchActivityNames.includes(a.name));
    }

    return availableActivities;
  };

  // Get activities for current selection
  const currentAvailableActivities = getFilteredActivities(
    selectedBranch ? branches.find(b => b.id === selectedBranch)?.name : undefined
  );

  // Reset activity selection if current activity is no longer available
  useEffect(() => {
    if (selectedActivity && !currentAvailableActivities.some(a => a.id === selectedActivity)) {
      setSelectedActivity('');
    }
  }, [selectedActivity, currentAvailableActivities]);

  // Get activities for backfill selection
  const backfillAvailableActivities = getFilteredActivities(
    backfillBranch ? branches.find(b => b.id === backfillBranch)?.name : undefined
  );

  // Reset backfill activity selection if current activity is no longer available
  useEffect(() => {
    if (backfillActivity && !backfillAvailableActivities.some(a => a.id === backfillActivity)) {
      setBackfillActivity('');
    }
  }, [backfillActivity, backfillAvailableActivities]);

  const startTimer = async () => {
    if (!selectedBranch || !selectedActivity) {
      toast({
        title: "Unvollständige Auswahl",
        description: "Bitte wählen Sie eine Filiale und Tätigkeit aus.",
        variant: "destructive"
      });
      return;
    }

    await contextStartTimer(selectedBranch, selectedActivity, notes);
  };

  const pauseTimer = async () => {
    await contextPauseTimer();
  };

  const resumeTimer = async () => {
    await contextResumeTimer();
  };

  const stopTimer = async () => {
    await contextStopTimer();
    // Reset form after stopping
    setNotes('');
  };

  const resumeExistingEntry = async () => {
    if (!pendingEntry) return;

    await contextResumeExistingEntry(pendingEntry);
    setSelectedBranch(pendingEntry.branch_id || '');
    setSelectedActivity(pendingEntry.activity_id || '');
    setNotes(pendingEntry.notes || '');
    setShowResumeDialog(false);
    setPendingEntry(null);
  };

  const discardExistingEntry = async () => {
    if (!pendingEntry) return;

    await contextDiscardExistingEntry(pendingEntry);
    setShowResumeDialog(false);
    setPendingEntry(null);
  };

  const validateBackfillTimes = () => {
    if (!backfillDate || !backfillStartTime || !backfillEndTime || !backfillBranch || !backfillActivity) {
      toast({
        title: "Unvollständige Eingabe",
        description: "Bitte füllen Sie alle Felder aus.",
        variant: "destructive"
      });
      return false;
    }

    const start = new Date(`${backfillDate}T${backfillStartTime}`);
    const end = new Date(`${backfillDate}T${backfillEndTime}`);

    if (end <= start) {
      toast({
        title: "Ungültige Zeiten",
        description: "Die Endzeit muss nach der Startzeit liegen.",
        variant: "destructive"
      });
      return false;
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    if (start > today) {
      toast({
        title: "Ungültiges Datum",
        description: "Sie können keine Zeiten in der Zukunft eintragen.",
        variant: "destructive"
      });
      return false;
    }

    const maxPastDate = new Date();
    maxPastDate.setDate(maxPastDate.getDate() - 90);
    
    if (start < maxPastDate) {
      toast({
        title: "Zu weit in der Vergangenheit",
        description: "Sie können nur Zeiten der letzten 90 Tage nachtragen.",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const submitBackfill = async () => {
    if (!validateBackfillTimes()) return;

    setIsSubmittingBackfill(true);

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user?.id) return;

      const startDateTime = new Date(`${backfillDate}T${backfillStartTime}`);
      const endDateTime = new Date(`${backfillDate}T${backfillEndTime}`);

      const { error } = await supabase
        .from('time_entries')
        .insert({
          user_id: user.user.id,
          branch_id: backfillBranch,
          activity_id: backfillActivity,
          started_at: startDateTime.toISOString(),
          ended_at: endDateTime.toISOString(),
          paused_seconds: 0,
          notes: backfillNotes || null
        });

      if (error) throw error;

      toast({
        title: "Zeit eingetragen",
        description: "Die Zeit wurde erfolgreich nachgetragen."
      });

      setShowBackfill(false);
      setBackfillDate(format(new Date(), 'yyyy-MM-dd'));
      setBackfillStartTime('09:00');
      setBackfillEndTime('17:00');
      setBackfillBranch('');
      setBackfillActivity('');
      setBackfillNotes('');
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Zeit konnte nicht eingetragen werden.",
        variant: "destructive"
      });
    } finally {
      setIsSubmittingBackfill(false);
    }
  };

  const formatTime = (totalSeconds: number): string => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <h1 className="sr-only">Zeiterfassung – Crafton Time</h1>
      
      <section className="grid gap-6">
        {/* Timer Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Zeiterfassung
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Timer Display */}
            <div className="text-center">
              <div className="text-4xl md:text-6xl font-mono font-bold mb-4">
                {formatTime(stopwatch.totalSeconds)}
              </div>
              <div className="flex justify-center gap-2 mb-6">
                {!isTracking ? (
                  <Button onClick={startTimer} size="lg" className="min-w-32 min-touch">
                    <Play className="h-4 w-4 mr-2" />
                    Start
                  </Button>
                ) : (
                  <>
                    {!isPaused ? (
                      <Button onClick={pauseTimer} size="lg" variant="outline" className="min-w-32 min-touch">
                        <Pause className="h-4 w-4 mr-2" />
                        Pause
                      </Button>
                    ) : (
                      <Button onClick={resumeTimer} size="lg" className="min-w-32 min-touch">
                        <Play className="h-4 w-4 mr-2" />
                        Fortsetzen
                      </Button>
                    )}
                    <Button onClick={stopTimer} size="lg" variant="destructive" className="min-w-32 min-touch">
                      <Square className="h-4 w-4 mr-2" />
                      Stop
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Selection Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="branch-select" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Filiale
                </Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={isTracking}>
                  <SelectTrigger id="branch-select">
                    <SelectValue placeholder="Filiale wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="activity-select" className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Tätigkeit
                </Label>
                <Select value={selectedActivity} onValueChange={setSelectedActivity} disabled={isTracking}>
                  <SelectTrigger id="activity-select">
                    <SelectValue placeholder="Tätigkeit wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {currentAvailableActivities.map((activity) => (
                      <SelectItem key={activity.id} value={activity.id}>
                        {activity.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notizen (optional)</Label>
              <Textarea 
                id="notes"
                value={notes} 
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notizen zu dieser Zeiterfassung..."
                disabled={isTracking && !isPaused}
              />
            </div>
            
          </CardContent>
        </Card>

        {/* Manual Entry Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Zeiten nachtragen
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-8">
            {isMobile ? (
              <Drawer open={showBackfill} onOpenChange={setShowBackfill}>
                <DrawerTrigger asChild>
                  <Button variant="outline" className="w-full min-touch">
                    <Plus className="h-4 w-4 mr-2" />
                    Zeit nachtragen
                  </Button>
                </DrawerTrigger>
                <DrawerContent className="px-4 pb-4">
                  <DrawerHeader>
                    <DrawerTitle>Zeit nachtragen</DrawerTitle>
                  </DrawerHeader>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="backfill-date">Datum</Label>
                      <Input
                        id="backfill-date"
                        type="date"
                        value={backfillDate}
                        onChange={(e) => setBackfillDate(e.target.value)}
                        max={format(new Date(), 'yyyy-MM-dd')}
                        className="min-touch"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="backfill-start">Startzeit</Label>
                        <Input
                          id="backfill-start"
                          type="time"
                          value={backfillStartTime}
                          onChange={(e) => setBackfillStartTime(e.target.value)}
                          className="min-touch"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="backfill-end">Endzeit</Label>
                        <Input
                          id="backfill-end"
                          type="time"
                          value={backfillEndTime}
                          onChange={(e) => setBackfillEndTime(e.target.value)}
                          className="min-touch"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="backfill-branch">Filiale</Label>
                      <Select value={backfillBranch} onValueChange={setBackfillBranch}>
                        <SelectTrigger id="backfill-branch" className="min-touch">
                          <SelectValue placeholder="Filiale wählen" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          {branches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="backfill-activity">Tätigkeit</Label>
                      <Select value={backfillActivity} onValueChange={setBackfillActivity}>
                        <SelectTrigger id="backfill-activity" className="min-touch">
                          <SelectValue placeholder="Tätigkeit wählen" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          {backfillAvailableActivities.map((activity) => (
                            <SelectItem key={activity.id} value={activity.id}>
                              {activity.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="backfill-notes">Notizen (optional)</Label>
                      <Textarea
                        id="backfill-notes"
                        value={backfillNotes}
                        onChange={(e) => setBackfillNotes(e.target.value)}
                        placeholder="Notizen zu dieser Zeiterfassung..."
                        className="min-touch"
                      />
                    </div>
                    
                    <div className="flex gap-2 pt-4">
                      <Button 
                        onClick={submitBackfill} 
                        disabled={isSubmittingBackfill}
                        className="flex-1 min-touch"
                      >
                        {isSubmittingBackfill ? 'Speichern...' : 'Zeit eintragen'}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setShowBackfill(false)}
                        disabled={isSubmittingBackfill}
                        className="min-touch"
                      >
                        Abbrechen
                      </Button>
                    </div>
                  </div>
                </DrawerContent>
              </Drawer>
            ) : (
              <Dialog open={showBackfill} onOpenChange={setShowBackfill}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Zeit nachtragen
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Zeit nachtragen</DialogTitle>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="backfill-date">Datum</Label>
                      <Input
                        id="backfill-date"
                        type="date"
                        value={backfillDate}
                        onChange={(e) => setBackfillDate(e.target.value)}
                        max={format(new Date(), 'yyyy-MM-dd')}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="backfill-start">Startzeit</Label>
                        <Input
                          id="backfill-start"
                          type="time"
                          value={backfillStartTime}
                          onChange={(e) => setBackfillStartTime(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="backfill-end">Endzeit</Label>
                        <Input
                          id="backfill-end"
                          type="time"
                          value={backfillEndTime}
                          onChange={(e) => setBackfillEndTime(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="backfill-branch">Filiale</Label>
                      <Select value={backfillBranch} onValueChange={setBackfillBranch}>
                        <SelectTrigger id="backfill-branch">
                          <SelectValue placeholder="Filiale wählen" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          {branches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="backfill-activity">Tätigkeit</Label>
                      <Select value={backfillActivity} onValueChange={setBackfillActivity}>
                        <SelectTrigger id="backfill-activity">
                          <SelectValue placeholder="Tätigkeit wählen" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          {backfillAvailableActivities.map((activity) => (
                            <SelectItem key={activity.id} value={activity.id}>
                              {activity.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="backfill-notes">Notizen (optional)</Label>
                      <Textarea
                        id="backfill-notes"
                        value={backfillNotes}
                        onChange={(e) => setBackfillNotes(e.target.value)}
                        placeholder="Notizen zu dieser Zeiterfassung..."
                      />
                    </div>
                    
                    <div className="flex gap-2 pt-4">
                      <Button 
                        onClick={submitBackfill} 
                        disabled={isSubmittingBackfill}
                        className="flex-1"
                      >
                        {isSubmittingBackfill ? 'Speichern...' : 'Zeit eintragen'}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setShowBackfill(false)}
                        disabled={isSubmittingBackfill}
                      >
                        Abbrechen
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </Card>

        {/* Assignment Manager for Admins */}
        <AssignmentManager
          currentBranch={selectedBranch ? branches.find(b => b.id === selectedBranch)?.name || '' : ''}
          branchActivities={branchActivities}
          allActivities={allActivities}
          onRefresh={loadBranchActivities}
        />
      </section>

      {/* Resume Dialog */}
      {isMobile ? (
        <Drawer open={showResumeDialog} onOpenChange={() => {}}>
          <DrawerContent className="px-4 pb-4">
            <DrawerHeader>
              <DrawerTitle>Laufende Zeiterfassung gefunden</DrawerTitle>
            </DrawerHeader>
            
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Du hast eine laufende Zeiterfassung. Möchtest du sie fortsetzen oder eine neue starten?
              </p>
              
              <div className="flex gap-2">
                <Button 
                  onClick={resumeExistingEntry}
                  className="flex-1 min-touch"
                >
                  Fortsetzen
                </Button>
                <Button 
                  variant="outline" 
                  onClick={discardExistingEntry}
                  className="flex-1 min-touch"
                >
                  Neue starten
                </Button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={showResumeDialog} onOpenChange={() => {}}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Laufende Zeiterfassung gefunden</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Du hast eine laufende Zeiterfassung. Möchtest du sie fortsetzen oder eine neue starten?
              </p>
              
              <div className="flex gap-2">
                <Button 
                  onClick={resumeExistingEntry}
                  className="flex-1"
                >
                  Fortsetzen
                </Button>
                <Button 
                  variant="outline" 
                  onClick={discardExistingEntry}
                  className="flex-1"
                >
                  Neue starten
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}