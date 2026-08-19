import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Loader2, Mail, Wrench } from "lucide-react";
import { motion } from "framer-motion";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

interface AuthProps { redirectAfterAuth?: string; }

function resolveRedirectAfterAuth(returnTo: string | null, fallback = "/dashboard") {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) return returnTo;
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(searchParams.get("returnTo"), redirectAfterAuth);
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) navigate(redirect);
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: String(formData.get("email") || "") });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to send verification code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      navigate(redirect);
    } catch {
      setError("The verification code is incorrect or expired.");
      setOtp("");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[60%] rounded-full bg-gradient-to-br from-sky-200/40 via-blue-200/25 to-transparent blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[55%] rounded-full bg-gradient-to-tl from-teal-200/30 via-cyan-200/20 to-transparent blur-3xl" />
      </div>
      <motion.nav initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="p-4">
        <div className="max-w-6xl mx-auto glass rounded-2xl px-6 py-3">
          <button onClick={() => navigate("/")} className="flex items-center gap-3 hover:opacity-80">
            <div className="size-9 rounded-xl glass-heavy flex items-center justify-center"><Wrench className="size-5 text-primary" /></div>
            <span className="text-lg font-bold">Mechanic<span className="text-primary">AI</span></span>
          </button>
        </div>
      </motion.nav>

      <div className="flex-1 flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Card className="glass-heavy border-0 shadow-2xl">
            {step === "signIn" ? (
              <>
                <CardHeader className="text-center pt-8">
                  <div className="flex justify-center mb-4"><div className="size-16 rounded-2xl glass flex items-center justify-center"><Wrench className="size-8 text-primary" /></div></div>
                  <CardTitle className="text-xl">Welcome to MechanicAI</CardTitle>
                  <CardDescription>Private, evidence-first automotive diagnostics. Sign in with your email to continue.</CardDescription>
                </CardHeader>
                <form onSubmit={handleEmailSubmit}>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1"><Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input name="email" placeholder="name@example.com" type="email" className="pl-9 rounded-xl bg-white/50" disabled={isLoading} required /></div>
                      <Button type="submit" size="icon" className="rounded-xl" disabled={isLoading}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}</Button>
                    </div>
                    {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
                  </CardContent>
                </form>
              </>
            ) : (
              <>
                <CardHeader className="text-center pt-8"><div className="flex justify-center mb-4"><div className="size-16 rounded-2xl glass flex items-center justify-center"><Mail className="size-8 text-primary" /></div></div><CardTitle>Check your email</CardTitle><CardDescription>We sent a six-digit verification code to <span className="font-medium text-foreground">{step.email}</span>.</CardDescription></CardHeader>
                <form onSubmit={handleOtpSubmit}>
                  <CardContent className="pb-4">
                    <input type="hidden" name="email" value={step.email} /><input type="hidden" name="code" value={otp} />
                    <div className="flex justify-center"><InputOTP value={otp} onChange={setOtp} maxLength={6} disabled={isLoading}><InputOTPGroup>{Array.from({ length: 6 }).map((_, i) => <InputOTPSlot key={i} index={i} />)}</InputOTPGroup></InputOTP></div>
                    {error && <p className="mt-3 text-sm text-destructive text-center">{error}</p>}
                  </CardContent>
                  <CardFooter className="flex-col gap-2"><Button type="submit" className="w-full rounded-xl" disabled={isLoading || otp.length !== 6}>{isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</> : <>Verify code <ArrowRight className="ml-2 h-4 w-4" /></>}</Button><Button type="button" variant="ghost" onClick={() => setStep("signIn")} disabled={isLoading}>Use different email</Button></CardFooter>
                </form>
              </>
            )}
            <div className="py-4 px-6 text-xs text-center text-muted-foreground border-t border-border/30">Authenticated accounts only · Evidence-first diagnostics powered by <span className="font-semibold text-primary">MechanicAI</span></div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) { return <Suspense><Auth {...props} /></Suspense>; }
