import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  email: string;
  display_name: string;
  weekly_goal_hours: number;
  role: string;
}

interface Activity {
  id: string;
  name: string;
}

export default function AdminPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [weeklyGoal, setWeeklyGoal] = useState<string>('40');
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Activity management state
  const [selectedUserIdForActivities, setSelectedUserIdForActivities] = useState<string>('');
  const [userActivities, setUserActivities] = useState<string[]>([]);
  const [savingActivities, setSavingActivities] = useState(false);

  useEffect(() => {
    document.title = 'Admin – Crafton Time';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Verwaltung von Nutzern, Filialen, Tätigkeiten. Korrekturen & Freigaben.');
    
    const loadData = async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user?.id) return;
      
      // Check if user is admin
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.user.id)
        .single();
      
      const adminStatus = currentProfile?.role === 'admin';
      setIsAdmin(adminStatus);
      
      if (adminStatus) {
        // Load all profiles if user is admin
        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('id, email, display_name, weekly_goal_hours, role')
          .order('email');
        
        setProfiles(allProfiles || []);

        // Load all activities
        const { data: allActivities } = await supabase
          .from('activities')
          .select('id, name')
          .order('name');
        
        setActivities(allActivities || []);
      }
    };
    
    loadData();
  }, []);

  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId);
    const user = profiles.find(p => p.id === userId);
    if (user) {
      setWeeklyGoal(user.weekly_goal_hours.toString());
    }
  };

  const handleUserSelectForActivities = async (userId: string) => {
    setSelectedUserIdForActivities(userId);
    
    // Load current activities for this user
    const { data: profileActivities } = await supabase
      .from('profile_activities')
      .select('activity_id')
      .eq('profile_id', userId);
    
    const currentActivityIds = profileActivities?.map(pa => pa.activity_id) || [];
    setUserActivities(currentActivityIds);
  };

  const handleActivityToggle = (activityId: string, checked: boolean) => {
    if (checked) {
      setUserActivities(prev => [...prev, activityId]);
    } else {
      setUserActivities(prev => prev.filter(id => id !== activityId));
    }
  };

  const saveWeeklyGoal = async () => {
    if (!selectedUserId || !weeklyGoal) {
      toast({ title: 'Unvollständig', description: 'Bitte wählen Sie einen Benutzer und geben Sie ein Ziel ein.' });
      return;
    }
    
    const goalNumber = parseInt(weeklyGoal);
    if (goalNumber < 1 || goalNumber > 80) {
      toast({ title: 'Ungültiges Ziel', description: 'Das Ziel muss zwischen 1 und 80 Stunden liegen.', variant: 'destructive' });
      return;
    }
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ weekly_goal_hours: goalNumber })
        .eq('id', selectedUserId);
      
      if (error) throw error;
      
      // Update local state
      setProfiles(profiles.map(p => 
        p.id === selectedUserId ? { ...p, weekly_goal_hours: goalNumber } : p
      ));
      
      toast({ title: 'Gespeichert', description: 'Wochenstunden-Ziel wurde aktualisiert.' });
    } catch (error: any) {
      toast({ 
        title: 'Fehler beim Speichern', 
        description: error.message || 'Unbekannter Fehler',
        variant: 'destructive' 
      });
    } finally {
      setSaving(false);
    }
  };

  const saveUserActivities = async () => {
    if (!selectedUserIdForActivities) {
      toast({ title: 'Kein Benutzer gewählt', description: 'Bitte wählen Sie einen Benutzer aus.' });
      return;
    }

    setSavingActivities(true);
    try {
      // First, delete existing assignments for this user
      await supabase
        .from('profile_activities')
        .delete()
        .eq('profile_id', selectedUserIdForActivities);

      // Then insert new assignments
      if (userActivities.length > 0) {
        const assignments = userActivities.map(activityId => ({
          profile_id: selectedUserIdForActivities,
          activity_id: activityId
        }));

        const { error } = await supabase
          .from('profile_activities')
          .insert(assignments);

        if (error) throw error;
      }

      toast({ title: 'Gespeichert', description: 'Benutzer-Tätigkeiten wurden aktualisiert.' });
    } catch (error: any) {
      toast({ 
        title: 'Fehler beim Speichern', 
        description: error.message || 'Unbekannter Fehler',
        variant: 'destructive' 
      });
    } finally {
      setSavingActivities(false);
    }
  };

  if (!isAdmin) {
    return (
      <>
        <h1 className="sr-only">Admin – Crafton Time</h1>
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="text-xl font-semibold mb-2">Zugriff verweigert</h2>
          <p className="text-muted-foreground">Sie haben keine Administratorberechtigung.</p>
        </section>
      </>
    );
  }

  return (
    <>
      <h1 className="sr-only">Admin – Crafton Time</h1>
      
      <section className="grid gap-6">
        {/* Weekly Goals Management */}
        <Card>
          <CardHeader>
            <CardTitle>Wochenstunden-Ziele verwalten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-muted-foreground">Benutzer auswählen</label>
              <Select value={selectedUserId} onValueChange={handleUserSelect}>
                <SelectTrigger className="min-touch">
                  <SelectValue placeholder="Benutzer wählen" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.display_name || profile.email} ({profile.weekly_goal_hours}h/Woche)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <label className="text-sm font-medium text-muted-foreground">Wochenstunden-Ziel</label>
              <Input 
                type="number" 
                min="1" 
                max="80" 
                value={weeklyGoal} 
                onChange={(e) => setWeeklyGoal(e.target.value)}
                placeholder="40"
                className="min-touch"
              />
              <p className="text-xs text-muted-foreground">
                Zwischen 1 und 80 Stunden pro Woche
              </p>
            </div>
            
            <div className="flex justify-start">
              <Button 
                onClick={saveWeeklyGoal} 
                disabled={saving || !selectedUserId}
                className="min-touch"
              >
                {saving ? 'Speichern...' : 'Ziel speichern'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Activity Management */}
        <Card>
          <CardHeader>
            <CardTitle>Tätigkeiten pro Benutzer verwalten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-muted-foreground">Benutzer auswählen</label>
              <Select value={selectedUserIdForActivities} onValueChange={handleUserSelectForActivities}>
                <SelectTrigger className="min-touch">
                  <SelectValue placeholder="Benutzer wählen" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.display_name || profile.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedUserIdForActivities && (
              <>
                <div className="grid gap-3">
                  <label className="text-sm font-medium text-muted-foreground">Erlaubte Tätigkeiten</label>
                  <p className="text-xs text-muted-foreground">
                    Wählen Sie die Tätigkeiten aus, die dieser Benutzer verwenden darf. Ohne Auswahl sind alle Tätigkeiten erlaubt.
                  </p>
                  <div className="border rounded-lg p-4 max-h-60 overflow-y-auto bg-muted/20">
                    <div className="grid gap-3">
                      {activities.map((activity) => (
                        <div key={activity.id} className="flex items-center space-x-3">
                          <Checkbox
                            id={activity.id}
                            checked={userActivities.includes(activity.id)}
                            onCheckedChange={(checked) => handleActivityToggle(activity.id, !!checked)}
                            className="min-touch"
                          />
                          <label 
                            htmlFor={activity.id} 
                            className="text-sm font-medium leading-none cursor-pointer flex-1 py-2"
                          >
                            {activity.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-start">
                  <Button 
                    onClick={saveUserActivities} 
                    disabled={savingActivities}
                    className="min-touch"
                  >
                    {savingActivities ? 'Speichern...' : 'Tätigkeiten speichern'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* User Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Benutzerübersicht</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {profiles.map((profile) => (
                <div key={profile.id} className="flex justify-between items-center p-4 border rounded-lg bg-muted/10">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-sm">{profile.display_name || profile.email}</span>
                    <span className="text-xs text-muted-foreground">Rolle: {profile.role}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium">{profile.weekly_goal_hours}h</span>
                    <div className="text-xs text-muted-foreground">pro Woche</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}