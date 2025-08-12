import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const pageTitle = useMemo(
    () => (mode === "signin" ? "Anmelden – Crafton Time" : "Registrieren – Crafton Time"),
    [mode]
  );

  useEffect(() => {
    // SEO: title, description, canonical
    document.title = pageTitle;
    const desc =
      mode === "signin"
        ? "Mit E-Mail und Passwort anmelden. Schnelle, sichere Anmeldung mit Supabase."
        : "Account mit E-Mail und Passwort erstellen. Schnelle, sichere Registrierung mit Supabase.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", window.location.href);
  }, [pageTitle, mode]);

  useEffect(() => {
    // Redirect authenticated users away from auth page
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        navigate("/", { replace: true });
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) navigate("/", { replace: true });
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (mode === "signup" && password.length < 6) {
      toast({
        title: "Passwort zu kurz",
        description: "Bitte verwende mindestens 6 Zeichen.",
        variant: "destructive" as any,
      });
      return;
    }

    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: "Willkommen zurück" });
        navigate("/", { replace: true });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        toast({
          title: "Bestätigungs-E-Mail gesendet",
          description: "Bitte bestätige deine E-Mail, um dich anzumelden.",
        });
        setMode("signin");
      }
    } catch (err: any) {
      const message = err?.message || "Unbekannter Fehler";
      toast({ title: "Aktion fehlgeschlagen", description: message, variant: "destructive" as any });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-xl">
      <h1 className="sr-only">{mode === "signin" ? "Anmeldung" : "Registrierung"} – Crafton Time</h1>
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <header className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {mode === "signin" ? "Anmeldung" : "Konto erstellen"}
          </h2>
          <nav aria-label="Modus wechseln" className="flex gap-2">
            <Button
              type="button"
              variant={mode === "signin" ? "default" : "secondary"}
              onClick={() => setMode("signin")}
              aria-pressed={mode === "signin"}
            >
              Anmelden
            </Button>
            <Button
              type="button"
              variant={mode === "signup" ? "default" : "secondary"}
              onClick={() => setMode("signup")}
              aria-pressed={mode === "signup"}
            >
              Registrieren
            </Button>
          </nav>
        </header>

        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <div className="grid gap-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="du@example.com"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="password">Passwort</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              placeholder="••••••••"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Bitte warten…" : mode === "signin" ? "Anmelden" : "Registrieren"}
            </Button>
          </div>
        </form>

        <aside className="mt-4 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Noch kein Konto? Wechsle oben zu \"Registrieren\"."
            : "Bereits registriert? Wechsle oben zu \"Anmelden\"."}
        </aside>
      </section>
    </main>
  );
}
