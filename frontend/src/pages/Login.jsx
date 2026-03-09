import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Mail, Loader2, Facebook, Twitter, Linkedin, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login, isLoading, error, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: "Error",
        description: "Please enter both email and password",
        variant: "destructive",
      });
      return;
    }

    clearError(); // Clear any previous errors

    const result = await login(email, password);

    if (result.success) {
      toast({
        title: "Login Successful",
        description: `Welcome back, ${result.data.user.firstName}!`,
      });

      // Redirect to store selection after successful login
      navigate("/select-store", { replace: true });
    } else {
      toast({
        title: "Login Failed",
        description: result.error || "Invalid email or password",
        variant: "destructive",
      });
    }
  };

  const handleMailClick = () => {
    // Open Gmail compose with the email address
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=jprsupermarket@gmail.com`, "_blank");
  };

  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-white overflow-x-hidden">
      {/* Red Header: single row, logo + name left, Pushdiggy right; responsive padding and sizes */}
      <header className="bg-red-600 min-h-14 sm:h-16 flex items-center justify-between gap-2 px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="flex min-w-0 flex-shrink items-center gap-2 sm:gap-3">
          <img
            src="/favicon.ico"
            alt="Logo"
            className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 flex-shrink-0 object-contain"
          />
          <div className="flex items-baseline gap-1 sm:gap-2 min-w-0">
            <span className="text-white text-lg font-bold truncate sm:text-xl md:text-2xl">Murugan</span>
            <span className="text-yellow-300 text-base sm:text-lg md:text-xl flex-shrink-0">Super Mart</span>
          </div>
        </div>
        <div className="flex-shrink-0">
          <img
            src="/pushdiggylogo.jpg"
            alt="Pushdiggy"
            className="h-8 w-auto max-h-12 object-contain sm:h-10 md:h-12 lg:h-14"
          />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 min-h-0 w-full min-w-0">
        {/* Left Side - Supermarket Image */}
        <div className="hidden lg:flex lg:w-2/3 relative overflow-hidden items-center justify-center p-2">
          <div className="relative w-full h-full">
            <img
              src="/loginimage.jpg"
              alt="Supermarket Aisle"
              className="w-half h-half object-cover rounded-2xl border-4 border-gray-200 shadow-2xl"
            />
            <div className="absolute inset-0 rounded-2xl border-2 border-white shadow-inner"></div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full min-w-0 lg:w-1/3 flex items-center justify-center p-3 sm:p-4 bg-white overflow-auto">
          <div className="w-full max-w-lg min-w-0">
            <div className="bg-white rounded-xl shadow-2xl p-6 sm:p-8 md:p-10 lg:p-12 border-2 sm:border-4 border-gray-200 relative">
              <div className="absolute inset-0 rounded-xl border-2 border-white shadow-inner"></div>
              <div className="relative z-10">
                <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
                  Stores
                </h2>

                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Or</span>
                  </div>
                </div>

                <form onSubmit={handleLogin} className="space-y-8">
                  <div className="space-y-3">
                    <Label htmlFor="email" className="text-gray-700 font-medium">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-9 bg-blue-50 border-gray-300 focus:border-yellow-500 focus:ring-yellow-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="password" className="text-gray-700 font-medium">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-9 pr-9 bg-blue-50 border-gray-300 focus:border-yellow-500 focus:ring-yellow-500"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 rounded-lg shadow-md transition-all duration-300"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        LOGIN
                      </>
                    ) : (
                      "LOGIN"
                    )}
                  </Button>

                  <div className="text-center mt-4">
                    <Link
                      to="/forgot-password"
                      className="text-blue-600 hover:text-blue-800 hover:underline text-sm font-medium transition-colors duration-200"
                    >
                      Forgot Password?
                    </Link>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Red Footer: responsive padding, wraps on small screens, no overflow */}
      <footer className="bg-red-600 min-h-14 sm:min-h-16 w-full min-w-0 overflow-hidden">
        <div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4 sm:py-4 md:px-6 lg:px-8">
          <div className="flex min-w-0 flex-shrink items-center justify-center gap-2 text-white sm:justify-start">
            <img
              src="/android-chrome.png"
              alt="Chrome Icon"
              className="h-5 w-5 flex-shrink-0 object-contain sm:h-6 sm:w-6"
            />
            <a
              href="mailto:info@pushdiggy.gmail.com"
              className="text-xs text-white underline-offset-2 hover:underline sm:text-sm truncate min-w-0"
            >
              info@pushdiggy.gmail.com
            </a>
          </div>
          <div className="flex items-center justify-center gap-3 sm:gap-4 sm:flex-shrink-0">
            <Facebook className="h-4 w-4 text-white cursor-pointer sm:h-5 sm:w-5" aria-hidden />
            <div className="h-4 w-4 sm:h-5 sm:w-5 bg-white rounded-full flex items-center justify-center cursor-pointer flex-shrink-0">
              <span className="text-red-600 text-[10px] font-bold sm:text-xs">g+</span>
            </div>
            <Mail
              className="h-4 w-4 sm:h-5 sm:w-5 text-white cursor-pointer hover:text-yellow-300 transition-colors flex-shrink-0"
              onClick={handleMailClick}
              title="Send email to jprsupermarket@gmail.com"
              aria-label="Email"
            />
            <Linkedin className="h-4 w-4 text-white cursor-pointer sm:h-5 sm:w-5" aria-hidden />
            <Twitter className="h-4 w-4 text-white cursor-pointer sm:h-5 sm:w-5" aria-hidden />
          </div>
        </div>
      </footer>
    </div>
  );
}