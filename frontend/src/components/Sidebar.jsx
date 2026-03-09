import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ChevronLeft,
  ChevronRight,
  Archive,
  BarChart3,
  Truck,
  Building2,
  ShoppingCart,
  ShoppingBag,
  Store,
  CreditCard,
  Receipt,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { SCREEN_LOOKUP, SCREEN_ORDER } from "@/constants/screens";
import { SyncToGlobalButton } from "@/components/SyncToGlobalButton";

const SCREEN_ICON_MAP = {
  "select-store": Store,
  dashboard: LayoutDashboard,
  items: Archive,
  billing: Receipt,
  suppliers: Truck,
  stores: Building2,
  "purchase-orders": ShoppingCart,
  orders: ShoppingBag,
  credits: CreditCard,
  users: Users,
  "user-rights": ShieldCheck,
  reports: BarChart3,
};

const navItems = SCREEN_ORDER.map((screenKey) => {
  const screen = SCREEN_LOOKUP[screenKey];
  const Icon = SCREEN_ICON_MAP[screenKey];
  if (!screen || !Icon) {
    return null;
  }
  return {
    icon: Icon,
    label: screen.label,
    path: screen.path,
    screenKey,
    screenId: screen.id,
  };
}).filter(Boolean);

export function Sidebar({ onClose }) {
  const [collapsed, setCollapsed] = useState(false);
  const { hasScreenAccess } = useAuth();

  const visibleItems = navItems.filter((item) =>
    item.screenId ? hasScreenAccess(item.screenId) : true
  );

  const handleNavClick = () => {
    // Close sidebar on mobile when a link is clicked
    if (onClose && window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <aside
      className={cn(
        "relative border-r bg-card transition-all duration-300 ease-in-out h-full",
        "lg:relative lg:z-auto",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <nav className="flex flex-col h-full p-3 overflow-y-auto">
        <div className="flex-1 space-y-1">
          {visibleItems.map((item) => (
            <div key={item.path}>
              <NavLink
                to={item.path}
                onClick={handleNavClick}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                    "hover:bg-accent/50 touch-target",
                    "text-sm sm:text-base",
                    isActive && "bg-primary text-primary-foreground hover:bg-primary/90"
                  )
                }
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && (
                  <span className="font-medium truncate">{item.label}</span>
                )}
              </NavLink>

              {/* Place Sync button directly after the Reports nav item on the left sidebar */}
              {!collapsed && item.screenKey === "reports" && (
                <div className="mt-2 px-1">
                  <SyncToGlobalButton />
                </div>
              )}
            </div>
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="mt-auto hidden lg:flex"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </Button>
      </nav>
    </aside>
  );
}
