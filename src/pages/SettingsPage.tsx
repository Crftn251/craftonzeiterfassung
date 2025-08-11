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
      <section className="max-w-xl rounded-2xl border bg-card p-6">
        <h2 className="mb-4 text-xl font-semibold">Einstellungen</h2>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm text-muted-foreground">Wochenziel (Stunden)</label>
            <Input value={weekGoal} onChange={(e) => setWeekGoal(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <label className="text-sm text-muted-foreground">Supabase URL</label>
            <Input placeholder="https://xxx.supabase.co" value={supabaseUrl} onChange={(e) => setSupabaseUrl(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <label className="text-sm text-muted-foreground">Supabase Anon Key</label>
            <Input placeholder="eyJhbGciOiJI..." value={supabaseAnon} onChange={(e) => setSupabaseAnon(e.target.value)} />
          </div>
          <div>
            <Button onClick={save}>Speichern</Button>
          </div>
        </div>
      </section>
    </>
  );
}
