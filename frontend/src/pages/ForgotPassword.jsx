import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Loader2, Shield, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { authAPI } from "@/services/api";
import Footer from "@/components/Footer";

const STEPS = [
  {
    id: 1,
    title: "Verify email",
    description: "We’ll send an OTP to your email address",
  },
  {
    id: 2,
    title: "Enter OTP",
    description: "Confirm the 6‑digit OTP from your inbox",
  },
  {
    id: 3,
    title: "Reset password",
    description: "Choose a strong new password",
  },
];

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: email, 2: OTP, 3: new password
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (step === 1) {
      if (!email) {
        toast({
          title: "Error",
          description: "Please enter your email address",
          variant: "destructive",
        });
        return;
      }

      setIsLoading(true);

      try {
        const response = await authAPI.forgotPassword(email);

        if (response.status === 'success') {
          setStep(2);
          toast({
            title: "Success",
            description: response.message,
          });
        }
      } catch (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to send OTP",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    } else if (step === 2) {
      if (!otp || otp.length !== 6) {
        toast({
          title: "Error",
          description: "Please enter a valid 6-digit OTP",
          variant: "destructive",
        });
        return;
      }

      setIsLoading(true);

      try {
        const response = await authAPI.verifyOTP(email, otp);

        if (response.status === 'success') {
          setStep(3);
          toast({
            title: "Success",
            description: "OTP verified successfully",
          });
        }
      } catch (error) {
        toast({
          title: "Error",
          description: error.message || "Invalid or expired OTP",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    } else if (step === 3) {
      if (!newPassword || newPassword.length < 6) {
        toast({
          title: "Error",
          description: "Password must be at least 6 characters long",
          variant: "destructive",
        });
        return;
      }

      if (newPassword !== confirmPassword) {
        toast({
          title: "Error",
          description: "Passwords do not match",
          variant: "destructive",
        });
        return;
      }

      setIsLoading(true);

      try {
        const response = await authAPI.resetPassword(email, otp, newPassword);

        if (response.status === 'success') {
          toast({
            title: "Success",
            description: "Password reset successfully! You can now log in.",
          });
          navigate("/");
        }
      } catch (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to reset password",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const renderStepContent = () => {
    if (step === 1) {
      return (
        <>
          <div className="text-center mb-8 space-y-3">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center shadow-inner">
              <Mail className="h-7 w-7 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Step 01</p>
              <h1 className="text-3xl font-bold text-gray-900">Forgot password?</h1>
              <p className="text-gray-600 text-sm leading-relaxed max-w-sm mx-auto">
                Enter the email you use to sign in. We’ll send a one-time passcode to help you securely reset your password.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  disabled={isLoading}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending OTP...
                </>
              ) : (
                <>
                  Send OTP
                  <ArrowLeft className="ml-2 h-4 w-4 rotate-180" />
                </>
              )}
            </Button>

            <div className="flex flex-col items-center gap-2 text-sm">
              <p className="text-muted-foreground">
                Didn’t receive an email? Check your spam folder.
              </p>
              <Link to="/" className="text-primary hover:underline inline-flex items-center">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back to login
              </Link>
            </div>
          </form>
        </>
      );
    } else if (step === 2) {
      return (
        <>
          <div className="text-center mb-8 space-y-3">
            <div className="mx-auto w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center shadow-inner">
              <Shield className="h-7 w-7 text-emerald-600" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Step 02</p>
              <h1 className="text-3xl font-bold text-gray-900">Enter the OTP</h1>
              <p className="text-gray-600 text-sm leading-relaxed max-w-sm mx-auto">
                We sent a 6-digit code to <span className="font-semibold text-gray-900">{email}</span>. Enter it below—your code expires in 10 minutes.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="otp">Enter OTP</Label>
              <Input
                id="otp"
                type="text"
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-2xl tracking-widest"
                disabled={isLoading}
                maxLength={6}
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
              disabled={isLoading || otp.length !== 6}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying OTP...
                </>
              ) : (
                "Verify OTP"
              )}
            </Button>

            <div className="flex justify-between text-sm text-muted-foreground">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-primary hover:underline inline-flex items-center"
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Change email
              </button>
              <button
                type="button"
                className="hover:text-foreground"
                onClick={() => handleSubmit(new Event("submit"))}
                disabled={isLoading}
              >
                Resend OTP
              </button>
            </div>
          </form>
        </>
      );
    } else if (step === 3) {
      return (
        <>
          <div className="text-center mb-8 space-y-3">
            <div className="mx-auto w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center shadow-inner">
              <Shield className="h-7 w-7 text-indigo-600" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Step 03</p>
              <h1 className="text-3xl font-bold text-gray-900">Set new password</h1>
              <p className="text-gray-600 text-sm leading-relaxed max-w-sm mx-auto">
                Choose a secure password you haven’t used recently.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm font-semibold"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm font-semibold"
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting Password...
                </>
              ) : (
                "Reset Password"
              )}
            </Button>

            <div className="flex justify-between text-sm text-muted-foreground">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-primary hover:underline inline-flex items-center"
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back to OTP
              </button>
              <Link to="/" className="hover:text-foreground">
                Return to login
              </Link>
            </div>
          </form>
        </>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-5xl grid gap-10 lg:grid-cols-[1.1fr_0.9fr]"
        >
          <div className="bg-white/80 backdrop-blur rounded-3xl border border-white/60 shadow-xl p-8 sm:p-10">
            <div className="flex flex-col gap-6">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Password Reset</p>
                <h2 className="text-3xl font-semibold text-gray-900">Let’s secure your account</h2>
                <p className="text-sm text-gray-500 max-w-md">
                  Follow the three simple steps to verify your identity and set a brand-new password.
                </p>
              </div>
              <div className="space-y-4">
                {STEPS.map((item) => {
                  const isCompleted = step > item.id;
                  const isActive = step === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-start gap-4 rounded-2xl border p-4 ${isActive
                          ? "border-primary/30 bg-primary/5"
                          : isCompleted
                            ? "border-emerald-200 bg-emerald-50/40"
                            : "border-gray-100 bg-white"
                        }`}
                    >
                      <div
                        className={`h-12 w-12 rounded-2xl flex items-center justify-center ${isActive
                            ? "bg-primary text-white"
                            : isCompleted
                              ? "bg-emerald-500 text-white"
                              : "bg-gray-100 text-gray-500"
                          }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-6 w-6" />
                        ) : (
                          <span className="text-lg font-semibold">{String(item.id).padStart(2, "0")}</span>
                        )}
                      </div>
                      <div>
                        <p className="text-base font-semibold text-gray-900">{item.title}</p>
                        <p className="text-sm text-gray-500">{item.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-purple-500 text-white p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] mb-2">Need help?</p>
                <p className="text-lg font-semibold mb-1">info@pushdiggy.com</p>
                <p className="text-sm opacity-90">Our team typically replies within a few hours.</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-3xl shadow-2xl border border-white/80 p-8 sm:p-10">
            {renderStepContent()}
          </div>
        </motion.div>
      </div>
      <Footer />
    </div>
  );
}