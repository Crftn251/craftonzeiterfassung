import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { getSupabase } from "@/lib/supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const supabase = getSupabase();

  useEffect(() => {
    document.title = "Login – Crafton Time";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Anmelden per Magic Link. Sichere Authentifizierung mit Supabase.");
  }, []);

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      toast({ title: "Konfiguration erforderlich", description: "Bitte Supabase URL & Anon Key unter Einstellungen speichern.", variant: "destructive" as any });
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    if (error) {
      toast({ title: "Login fehlgeschlagen", description: error.message, variant: "destructive" as any });
    } else {
      toast({ title: "E-Mail gesendet", description: "Prüfe dein Postfach für den Magic Link." });
      setEmail("");
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    toast({ title: "Abgemeldet" });
  };

  return (
    <>
      <h1 className="sr-only">Login – Crafton Time</h1>
      <section className="max-w-xl rounded-2xl border bg-card p-6">
        <h2 className="mb-4 text-xl font-semibold">Anmeldung</h2>
        {!supabase ? (
          <div className="text-sm text-muted-foreground">
            Supabase ist nicht konfiguriert. Bitte trage in den Einstellungen die URL und den Anon Key ein.
          </div>
        ) : (
          <form onSubmit={sendMagicLink} className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm text-muted-foreground">E-Mail</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="du@example.com" />
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit">Magic Link senden</Button>
              <Button type="button" variant="secondary" onClick={signOut}>Abmelden</Button>
            </div>
          </form>
        )}
      </section>
    </>
  );
}
