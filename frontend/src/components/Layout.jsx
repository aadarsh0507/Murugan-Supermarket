import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import Footer from "./Footer";
import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

export function Layout({ children }) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  return (
    <div className="min-h-screen flex flex-col w-full overflow-x-hidden">
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1 w-full relative">
        {/* Mobile overlay */}
        {isMobile && sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Sidebar with responsive behavior */}
        {/* On mobile: fixed overlay, on desktop: static in flow */}
        <aside
          className={`
            ${isMobile 
              ? 'fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300 ease-in-out' 
              : 'static z-auto flex-shrink-0 h-full'
            }
            ${isMobile && sidebarOpen ? "translate-x-0" : isMobile ? "-translate-x-full" : ""}
          `}
        >
          <Sidebar onClose={() => isMobile && setSidebarOpen(false)} />
        </aside>
        
        {/* Main content area - adjusts automatically on desktop, full width on mobile */}
        <main className="flex-1 w-full min-w-0 p-3 sm:p-4 lg:p-6 bg-gradient-mesh overflow-auto overflow-x-hidden">
          <div className="w-full max-w-full min-w-0">
            {children}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
