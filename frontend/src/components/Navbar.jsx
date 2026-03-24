import { useState } from "react";
import { LogOut, Settings, UserCircle, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Modal } from "@/components/Modal";
import { authAPI } from "@/services/api";
import { useIsMobile } from "@/hooks/use-mobile";

export function Navbar({ onMenuClick }) {
  const { user, logout, selectedStore } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Show the brand instead of a store name when no store is assigned/selected.
  const storeName = selectedStore?.name || "SuperMart";
  const storeInitials = selectedStore?.name
    ? selectedStore.name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2)
    : "SM";

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
      navigate("/");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleProfileClick = () => {
    setProfileModalOpen(true);
  };
  const handlePasswordInput = (field) => (event) => {
    const value = event.target.value;
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePasswordUpdate = async (event) => {
    event?.preventDefault();
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      toast({
        title: "Missing information",
        description: "Please fill in all password fields.",
        variant: "destructive",
      });
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "New password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Please confirm your new password correctly.",
        variant: "destructive",
      });
      return;
    }

    try {
      setUpdatingPassword(true);
      await authAPI.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      toast({
        title: "Password updated",
        description: "Your password has been updated successfully.",
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setProfileModalOpen(false);
    } catch (error) {
      toast({
        title: "Update failed",
        description: error?.message || "Unable to update password right now.",
        variant: "destructive",
      });
    } finally {
      setUpdatingPassword(false);
    }
  };

  const resolvedEmail = (user?.email || "").toString().trim();
  const resolvedFullName =
    (user?.fullName || "").toString().trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  const resolvedUsername = resolvedFullName || resolvedEmail || "Not set";
  const resolvedDisplayName = resolvedFullName || resolvedUsername || "User";

  const profileDetails = [
    { label: "Username", value: resolvedUsername || "Not set" },
    { label: "Email", value: resolvedEmail || "Not set" },
  ];

  const handleSettingsClick = () => {
    // Navigate to settings page
    toast({
      title: "Settings",
      description: "Settings page coming soon!",
    });
  };

  const isMobile = useIsMobile();

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex h-14 sm:h-16 items-center justify-between gap-2 px-3 sm:px-4 md:px-6 sm:gap-4">
          {/* Left: mobile menu + brand */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden touch-target h-10 w-10 flex-shrink-0"
              onClick={onMenuClick}
              aria-label="Toggle menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0">
                <span className="text-primary-foreground font-bold text-sm sm:text-lg">
                  {storeInitials}
                </span>
              </div>
              <h1
                className="text-base sm:text-lg md:text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent truncate"
                title={storeName}
              >
                {storeName}
              </h1>
            </div>
          </div>

          {/* Right: profile menu flush to the right */}
          <div className="flex items-center justify-end gap-1 sm:gap-2 flex-shrink-0 min-w-0">
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Open profile menu"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-indigo-500 text-primary-foreground shadow-sm hover:opacity-90 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <UserCircle className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-0 overflow-hidden shadow-xl border-0">
                <DropdownMenuLabel className="p-4 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-indigo-500 text-primary-foreground flex items-center justify-center shadow">
                      <UserCircle className="h-6 w-6" />
                    </div>
                    <div className="flex flex-col">
                      <p className="font-semibold text-base text-foreground">{resolvedDisplayName}</p>
                      <Badge variant="secondary" className="w-fit text-xs mt-1">
                        {user?.isAdmin ? "Admin" : "Staff"}
                      </Badge>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="mx-4" />
                <div className="py-1">
                  <DropdownMenuItem onClick={handleProfileClick} className="px-4 py-2 flex items-center gap-3">
                    <span className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-primary">
                      <UserCircle className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-medium">Profile Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSettingsClick} className="px-4 py-2 flex items-center gap-3">
                    <span className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-primary">
                      <Settings className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-medium">Preferences</span>
                  </DropdownMenuItem>
                </div>
                <DropdownMenuSeparator className="mx-4" />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive px-4 py-3 flex items-center gap-3 font-semibold">
                  <span className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                    <LogOut className="h-4 w-4" />
                  </span>
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          </div>
        </div>
      </header>
      <Modal
        open={isProfileModalOpen}
        onOpenChange={setProfileModalOpen}
        title="Profile Settings"
        description="Review your account details and maintain a secure password."
      >
        <div className="space-y-6">
          <div className="rounded-2xl border bg-gradient-to-r from-primary/10 via-accent/10 to-transparent p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
              <UserCircle className="h-7 w-7" />
            </div>
            <div>
              <p className="text-lg font-semibold">{resolvedDisplayName}</p>
              <p className="text-sm text-muted-foreground">{resolvedEmail || "Email not provided"}</p>
            </div>
          </div>
          <div className="grid gap-3 rounded-2xl border bg-muted/20 p-4">
            {profileDetails.map((detail) => (
              <div key={detail.label} className="flex items-center justify-between border-b last:border-b-0 border-border/60 pb-3 last:pb-0">
                <span className="text-sm font-medium text-muted-foreground">{detail.label}</span>
                <span className="text-sm font-semibold text-foreground">{detail.value}</span>
              </div>
            ))}
          </div>
          <form className="space-y-4" onSubmit={handlePasswordUpdate}>
            <div>
              <p className="text-sm font-semibold text-foreground">Update Password</p>
              <p className="text-xs text-muted-foreground">
                Choose a strong password to keep your account secure.
              </p>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordInput("currentPassword")}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordInput("newPassword")}
                  placeholder="At least 6 characters"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordInput("confirmPassword")}
                  placeholder="Re-enter new password"
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-primary hover:opacity-90"
              disabled={updatingPassword}
            >
              {updatingPassword ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </div>
      </Modal>
    </>
  );
}
