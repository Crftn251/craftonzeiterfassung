import { NavLink, Outlet } from "react-router-dom";
import { BarChart3, History, Settings, ShieldCheck, LogOut, Timer, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-admin";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTimer } from "@/contexts/TimerContext";
const navItems = [
  { to: "/", label: "Tracken", icon: Timer },
  { to: "/profil", label: "Profil", icon: BarChart3 },
  { to: "/historie", label: "Historie", icon: History },
  { to: "/einstellungen", label: "Einstellungen", icon: Settings },
  { to: "/admin", label: "Admin", icon: ShieldCheck },
];

export default function AppShell() {
  const [user, setUser] = useState<any>(null);
  const { isAdmin } = useIsAdmin();
  const isMobile = useIsMobile();
  const { isTracking, isPaused, stopwatch } = useTimer();

  const formatTime = (totalSeconds: number): string => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  useEffect(() => {
    document.title = "Crafton Time – Zeiterfassung";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Tracke Arbeitszeiten schnell und DSGVO-konform. Timer, Pausen, Sessions, Analytics.");
  }, []);

  useEffect(() => {
    let sub: any;
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);
      sub = supabase.auth.onAuthStateChange((_e, session) => {
        setUser(session?.user ?? null);
      });
    })();
    return () => sub?.data?.subscription?.unsubscribe?.();
  }, []);

  // No automatic redirects; use explicit /login route


  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl" style={{ background: "var(--gradient-primary)" }} aria-hidden />
            <span className="font-semibold tracking-tight">Crafton Time</span>
            {/* Timer indicator */}
            {isTracking && (
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-mono ${
                isPaused ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400' : 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
              }`}>
                <Timer className={`h-3 w-3 ${!isPaused ? 'animate-pulse' : ''}`} />
                <span>{formatTime(stopwatch.totalSeconds)}</span>
                {isPaused && <span className="text-xs">⏸</span>}
              </div>
            )}
          </div>
          <div className="hidden md:flex items-center gap-2">
            {navItems.filter(item => item.to !== '/admin' || isAdmin).map(({ to, label }) => (
              <NavLink key={to} to={to} end className={({ isActive }) => `px-3 py-1.5 rounded-md transition-colors min-touch ${isActive ? 'bg-secondary text-foreground' : 'hover:bg-secondary'}`}>
                {label}
              </NavLink>
            ))}
            {user ? (
              <Button variant="ghost" className="ml-2" onClick={() => supabase.auth.signOut()}>
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

      <main className={`container py-6 ${user ? 'pb-safe-nav md:pb-6' : 'pb-6'}`}>
        <Outlet />
      </main>

      {/* Login-Dialog entfernt – bitte /login zum Anmelden verwenden */}

      {/* Bottom Nav on mobile - only show when logged in */}
      {user && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur pb-safe md:hidden">
          <ul className={`grid ${isAdmin ? 'grid-cols-6' : 'grid-cols-5'}`}>
          {navItems.filter(item => item.to !== '/admin' || isAdmin).map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink to={to} end className={({ isActive }) => `flex flex-col items-center gap-1 py-3 px-2 text-xs min-touch ${isActive ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                <Icon className="h-5 w-5" />
                {!isMobile && <span>{label}</span>}
                {isMobile && <span className="text-[10px] leading-tight">{label}</span>}
              </NavLink>
            </li>
          ))}
            <li>
              <button 
                onClick={() => supabase.auth.signOut()}
                className="flex flex-col items-center gap-1 py-3 px-2 text-xs text-muted-foreground w-full min-touch"
              >
                <LogOut className="h-5 w-5" />
                {!isMobile && <span>Logout</span>}
                {isMobile && <span className="text-[10px] leading-tight">Logout</span>}
              </button>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}
