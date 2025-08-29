import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  email: string;
  display_name: string;
  weekly_goal_hours: number;
  role: string;
}

export default function AdminPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [weeklyGoal, setWeeklyGoal] = useState<string>('40');
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

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
        <Card>
          <CardHeader>
            <CardTitle>Wochenstunden-Ziele verwalten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-muted-foreground">Benutzer auswählen</label>
              <Select value={selectedUserId} onValueChange={handleUserSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Benutzer wählen" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.display_name || profile.email} ({profile.weekly_goal_hours}h/Woche)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-sm text-muted-foreground">Wochenstunden-Ziel</label>
              <Input 
                type="number" 
                min="1" 
                max="80" 
                value={weeklyGoal} 
                onChange={(e) => setWeeklyGoal(e.target.value)}
                placeholder="40"
              />
              <p className="text-xs text-muted-foreground">
                Zwischen 1 und 80 Stunden pro Woche
              </p>
            </div>
            
            <Button onClick={saveWeeklyGoal} disabled={saving || !selectedUserId}>
              {saving ? 'Speichern...' : 'Ziel speichern'}
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Benutzerübersicht</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {profiles.map((profile) => (
                <div key={profile.id} className="flex justify-between items-center p-2 border rounded">
                  <div>
                    <span className="font-medium">{profile.display_name || profile.email}</span>
                    <span className="text-sm text-muted-foreground ml-2">({profile.role})</span>
                  </div>
                  <span className="text-sm">{profile.weekly_goal_hours}h/Woche</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
