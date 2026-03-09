import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import Footer from "./Footer";
import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle2 } from "lucide-react";

const LOGIN_SUCCESS_DURATION_MS = 2500;

export function Layout({ children }) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const { showLoginSuccess, clearLoginSuccess, user } = useAuth();

  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  useEffect(() => {
    if (!showLoginSuccess || !isMobile) return;
    const t = setTimeout(clearLoginSuccess, LOGIN_SUCCESS_DURATION_MS);
    return () => clearTimeout(t);
  }, [showLoginSuccess, isMobile, clearLoginSuccess]);

  const firstName = user?.firstName ?? user?.fullName?.split(" ")[0] ?? "there";

  return (
    <div className="min-h-screen min-w-0 flex flex-col w-full overflow-x-hidden">
      {/* Mobile-only: centered Login Successful message */}
      {isMobile && showLoginSuccess && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          role="alert"
          aria-live="polite"
        >
          <div className="bg-card border border-border rounded-2xl shadow-xl p-6 max-w-[min(20rem,90vw)] text-center animate-scale-in">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-3" aria-hidden />
            <h3 className="text-lg font-semibold text-foreground">Login Successful</h3>
            <p className="mt-1 text-sm text-muted-foreground">Welcome back, {firstName}!</p>
          </div>
        </div>
      )}

      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1 w-full min-w-0 relative">
        {/* Mobile overlay: < lg (1024px) when isMobile; desktop: sidebar in flow */}
        {isMobile && sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
        )}

        {/* Sidebar: mobile/tablet = fixed drawer; lg+ = static in flow */}
        <aside
          className={`
            ${isMobile
              ? "fixed inset-y-0 left-0 z-50 w-[min(16rem,85vw)] max-w-64 transition-transform duration-300 ease-in-out"
              : "static z-auto flex-shrink-0 h-full"
            }
            ${isMobile && sidebarOpen ? "translate-x-0" : isMobile ? "-translate-x-full" : ""}
          `}
        >
          <Sidebar onClose={() => isMobile && setSidebarOpen(false)} />
        </aside>

        {/* Main: responsive padding for all screens */}
        <main className="flex-1 w-full min-w-0 p-3 sm:p-4 md:p-5 lg:p-6 xl:p-8 bg-gradient-mesh overflow-auto overflow-x-hidden">
          <div className="w-full max-w-full min-w-0">
            {children}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
