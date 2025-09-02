
import React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import Track from "./pages/Track";
import ProfileAnalytics from "./pages/ProfileAnalytics";
import HistoryPage from "./pages/HistoryPage";
import SettingsPage from "./pages/SettingsPage";
import AdminPage from "./pages/AdminPage";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import RequireAuth from "@/components/auth/RequireAuth";
import { TimerProvider } from "@/contexts/TimerContext";

// Create QueryClient with proper configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App: React.FC = () => {
  return (
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <TimerProvider>
          <TooltipProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<AppShell />}>
                  <Route index element={<RequireAuth><Track /></RequireAuth>} />
                  <Route path="profil" element={<RequireAuth><ProfileAnalytics /></RequireAuth>} />
                  <Route path="historie" element={<RequireAuth><HistoryPage /></RequireAuth>} />
                  <Route path="einstellungen" element={<RequireAuth><SettingsPage /></RequireAuth>} />
                  <Route path="admin" element={<RequireAuth><AdminPage /></RequireAuth>} />
                  <Route path="login" element={<Auth />} />
                </Route>
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
            <Toaster />
          </TooltipProvider>
        </TimerProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
};

export default App;
