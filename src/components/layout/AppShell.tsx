import { NavLink, Outlet } from "react-router-dom";
import { BarChart3, History, Settings, ShieldCheck, LogOut, Timer, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";
import { toast } from "@/components/ui/use-toast";
const navItems = [
  { to: "/", label: "Tracken", icon: Timer },
  { to: "/profil", label: "Profil", icon: BarChart3 },
  { to: "/historie", label: "Historie", icon: History },
  { to: "/einstellungen", label: "Einstellungen", icon: Settings },
  { to: "/admin", label: "Admin", icon: ShieldCheck },
];

export default function AppShell() {
  const supabase = getSupabase();
  const [user, setUser] = useState<any>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    document.title = "Crafton Time – Zeiterfassung";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Tracke Arbeitszeiten schnell und DSGVO-konform. Timer, Pausen, Sessions, Analytics.");
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let sub: any;
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);
      sub = supabase.auth.onAuthStateChange((_e, session) => {
        setUser(session?.user ?? null);
      });
    })();
    return () => sub?.data?.subscription?.unsubscribe?.();
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    setLoginOpen(user === null);
  }, [supabase, user]);

  const sendMagicLink = async (e: any) => {
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
      setLoginOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl" style={{ background: "var(--gradient-primary)" }} aria-hidden />
            <span className="font-semibold tracking-tight">Crafton Time</span>
          </div>
          <div className="hidden md:flex items-center gap-2">
            {navItems.map(({ to, label }) => (
              <NavLink key={to} to={to} end className={({ isActive }) => `px-3 py-1.5 rounded-md transition-colors ${isActive ? 'bg-secondary text-foreground' : 'hover:bg-secondary'}`}>
                {label}
              </NavLink>
            ))}
            {user ? (
              <Button variant="ghost" className="ml-2" onClick={() => supabase?.auth.signOut()}>
                <LogOut className="h-4 w-4 mr-2" /> Logout
              </Button>
            ) : (
              <NavLink to="/login" className="ml-2">
                <Button variant="ghost">
                  <LogIn className="h-4 w-4 mr-2" /> Login
                </Button>
              </NavLink>
            )}
          </div>
        </div>
      </header>

      <main className="container py-6">
        <Outlet />
      </main>

      {supabase && (
        <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Anmeldung</DialogTitle>
              <DialogDescription>
                Melde dich mit deiner E‑Mail an. Wir senden dir einen Magic Link.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={sendMagicLink} className="grid gap-4">
              <div className="grid gap-2">
                <label className="text-sm text-muted-foreground">E‑Mail</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="du@example.com" />
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <DialogClose asChild>
                  <Button type="button" variant="secondary">Später</Button>
                </DialogClose>
                <Button type="submit">Magic Link senden</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Bottom Nav on mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur md:hidden">
        <ul className="grid grid-cols-5">
          {navItems.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink to={to} end className={({ isActive }) => `flex flex-col items-center gap-1 py-2 text-xs ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                <Icon className="h-5 w-5" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
