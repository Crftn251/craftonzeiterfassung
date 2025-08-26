import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
export default function SettingsPage() {
  const [weekGoal, setWeekGoal] = useState<string>(() => localStorage.getItem('ct_goal_week') || '40');
  const [supabaseUrl, setSupabaseUrl] = useState<string>(() => localStorage.getItem('supabase_url') || '');
  const [supabaseAnon, setSupabaseAnon] = useState<string>(() => localStorage.getItem('supabase_anon') || '');
  useEffect(() => {
    document.title = 'Einstellungen – Crafton Time';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Profil, Ziele, Standards – passe dein Erlebnis an.');
  }, []);

const save = () => {
    localStorage.setItem('ct_goal_week', weekGoal);
    localStorage.setItem('supabase_url', supabaseUrl.trim());
    localStorage.setItem('supabase_anon', supabaseAnon.trim());
    toast({ title: 'Gespeichert', description: 'Einstellungen aktualisiert.' });
  };

  return (
    <>
      <h1 className="sr-only">Einstellungen – Crafton Time</h1>
    </>
  );
}
