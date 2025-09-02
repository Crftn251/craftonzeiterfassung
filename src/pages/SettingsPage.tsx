import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function SettingsPage() {
  const [weeklyGoal, setWeeklyGoal] = useState<number>(40);
  const [supabaseUrl, setSupabaseUrl] = useState<string>(() => localStorage.getItem('supabase_url') || '');
  const [supabaseAnon, setSupabaseAnon] = useState<string>(() => localStorage.getItem('supabase_anon') || '');
  
  useEffect(() => {
    document.title = 'Einstellungen – Crafton Time';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Profil, Ziele, Standards – passe dein Erlebnis an.');
    
    // Load weekly goal from profile
    const loadProfile = async () => {
      const { data: user } = await supabase.auth.getUser();
      if (user.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('weekly_goal_hours')
          .eq('id', user.user.id)
          .single();
        
        if (profile?.weekly_goal_hours) {
          setWeeklyGoal(profile.weekly_goal_hours);
        }
      }
    };
    
    loadProfile();
  }, []);

  const save = () => {
    localStorage.setItem('supabase_url', supabaseUrl.trim());
    localStorage.setItem('supabase_anon', supabaseAnon.trim());
    toast({ title: 'Gespeichert', description: 'Einstellungen aktualisiert.' });
  };

  return (
    <>
      <h1 className="sr-only">Einstellungen – Crafton Time</h1>
      
      <section className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Arbeitsziel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-muted-foreground">Wochenstunden-Ziel</label>
              <Input 
                type="number" 
                value={weeklyGoal} 
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Das Wochenstunden-Ziel wird von der Verwaltung festgelegt.
              </p>
            </div>
          </CardContent>
        </Card>

      </section>
    </>
  );
}
