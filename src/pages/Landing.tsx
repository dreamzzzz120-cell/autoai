import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SampleDiagnosis from "@/components/SampleDiagnosis";
import {
  ArrowRight,
  Shield,
  Search,
  Microscope,
  Wrench,
  Car,
  AlertTriangle,
  FileCheck,
  FileText,
  Zap,
  Brain,
  Globe,
  Mic,
  Play,
  Camera,
  Music,
} from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.8], [1, 0.95]);
  const heroY = useTransform(scrollYProgress, [0, 0.8], [0, 40]);

  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, delay: i * 0.1, ease: [0.25, 0.4, 0.25, 1] as const },
    }),
  };

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Ambient background orbs */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[60%] rounded-full bg-gradient-to-br from-sky-200/40 via-blue-200/25 to-transparent blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[55%] rounded-full bg-gradient-to-tl from-teal-200/30 via-cyan-200/20 to-transparent blur-3xl" />
        <div className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[35%] h-[35%] rounded-full bg-gradient-to-r from-indigo-200/15 via-blue-200/15 to-transparent blur-3xl" />
      </div>

      {/* Navigation */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 left-0 right-0 z-50 px-4 py-3"
      >
        <div className="max-w-6xl mx-auto glass rounded-2xl px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl glass-heavy flex items-center justify-center">
              <Wrench className="size-5 text-primary" />
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground">
              Mechanic<span className="text-primary">AI</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="glass-subtle hover:glass-light transition-all duration-300"
              onClick={() => navigate("/auth")}
            >
              Sign In
            </Button>
            <Button
              size="sm"
              className="shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 transition-all duration-300"
              onClick={() => navigate("/auth")}
            >
              Get Started
              <ArrowRight className="ml-1.5 size-4" />
            </Button>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <motion.section
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
        className="relative pt-32 pb-20 md:pt-44 md:pb-28 px-4"
      >
        <div className="max-w-6xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex mb-6"
          >
            <div className="glass-subtle rounded-full px-4 py-1.5 text-sm font-medium text-primary flex items-center gap-2">
              <Zap className="size-3.5" />
              Evidence-First Automotive Intelligence
            </div>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7, ease: [0.25, 0.4, 0.25, 1] }}
            className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] mb-6"
          >
            Diagnose with
            <br />
            <span className="bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-600 bg-clip-text text-transparent">
              certainty
            </span>
            , not
            <br />
            guesswork
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.7, ease: [0.25, 0.4, 0.25, 1] }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
          >
            The first AI diagnostic assistant that refuses to guess. Every
            finding is backed by OEM manuals, TSBs, sensor data, and verified
            evidence &mdash; or it tells you it doesn&apos;t know.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.7, ease: [0.25, 0.4, 0.25, 1] }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button
              size="lg"
              className="text-base px-8 py-6 shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 transition-all duration-300 rounded-2xl"
              onClick={() => navigate("/auth")}
            >
              Start Diagnosing Free
              <ArrowRight className="ml-2 size-5" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="text-base px-8 py-6 glass-subtle hover:glass-light transition-all duration-300 rounded-2xl border-2"
              onClick={() => {
                document
                  .getElementById("try-demo")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <Play className="mr-2 size-4" />
              Try a Sample Diagnosis
            </Button>
          </motion.div>

          {/* Capability pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.6 }}
            className="mt-12 flex flex-wrap items-center justify-center gap-3"
          >
            {[
              { icon: Car, label: "OBD-II Analysis" },
              { icon: Camera, label: "Photo Diagnosis" },
              { icon: Music, label: "Sound Diagnosis" },
              { icon: Mic, label: "Voice Input" },
            ].map((item) => (
              <div
                key={item.label}
                className="glass-subtle rounded-full px-4 py-2 flex items-center gap-2 text-sm text-muted-foreground"
              >
                <item.icon className="size-4 text-primary" />
                {item.label}
              </div>
            ))}
          </motion.div>

          {/* Hero Glass Card */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.8, ease: [0.25, 0.4, 0.25, 1] }}
            className="mt-16 max-w-3xl mx-auto"
          >
            <div className="glass-heavy rounded-3xl p-1">
              <div className="glass rounded-2xl p-6 md:p-8">
                <div className="flex items-start gap-4">
                  <div className="size-10 rounded-xl glass-heavy flex items-center justify-center shrink-0">
                    <Brain className="size-5 text-primary" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-foreground">
                        MechanicAI
                      </span>
                      <Badge
                        variant="secondary"
                        className="evidence-verified text-[10px] px-2 py-0 h-5"
                      >
                        Verified Fact
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-auto">
                        94% confidence
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                      Based on the OBD-II code <strong>P0302</strong> and your
                      description of rough idle after cold starts, the most
                      likely cause is a failing ignition coil on cylinder 2.
                      This is supported by TSB #21-047 from the manufacturer.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="evidence-strong text-[10px] px-2 py-0.5 rounded-full font-medium">
                        OEM TSB #21-047
                      </span>
                      <span className="evidence-verified text-[10px] px-2 py-0.5 rounded-full font-medium">
                        OBD-II P0302
                      </span>
                      <span className="evidence-inference text-[10px] px-2 py-0.5 rounded-full font-medium">
                        Professional Inference
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* Evidence Hierarchy Section */}
      <section className="relative py-20 md:py-28 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="text-center mb-16"
          >
            <Badge variant="secondary" className="glass-subtle mb-4 px-4 py-1.5">
              <Microscope className="size-3.5 mr-1.5" />
              Evidence Hierarchy
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Built on unshakeable evidence
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              MechanicAI ranks every source by authority. It never lets a forum
              post override an OEM service manual.
            </p>
          </motion.div>

          <div className="grid gap-4">
            {[
              {
                icon: FileCheck,
                label: "Tier 1",
                title: "OEM Service Manuals & TSBs",
                desc: "Manufacturer-authoritative procedures, specifications, and bulletins form the gold standard of every diagnosis.",
                color: "from-emerald-500/20 to-emerald-400/5 border-emerald-300/50",
                weight: "Gold Standard",
              },
              {
                icon: Globe,
                label: "Tier 2",
                title: "OBD-II & Live Sensor Data",
                desc: "Real-time vehicle data, DTCs, and sensor readings provide objective, measurable evidence of system health.",
                color: "from-sky-500/20 to-sky-400/5 border-sky-300/50",
                weight: "Measurable Evidence",
              },
              {
                icon: Search,
                label: "Tier 3",
                title: "Visual, Audio & Video Analysis",
                desc: "Uploaded images, video, and audio are analyzed for leaks, wear, corrosion, and abnormal mechanical sounds.",
                color: "from-teal-500/20 to-teal-400/5 border-teal-300/50",
                weight: "Direct Observation",
              },
              {
                icon: Brain,
                label: "Tier 4",
                title: "Industry Standards & Engineering",
                desc: "SAE, ISO, and ASE standards plus peer-reviewed engineering literature guide best-practice recommendations.",
                color: "from-indigo-500/20 to-indigo-400/5 border-indigo-300/50",
                weight: "Best Practice",
              },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeInUp}
                custom={i}
              >
                <div
                  className={`glass rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-5 bg-gradient-to-r ${item.color} transition-all duration-300 hover:shadow-lg`}
                >
                  <div className="size-12 rounded-xl glass-heavy flex items-center justify-center shrink-0">
                    <item.icon className="size-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-[10px] px-2 py-0 h-5">
                        {item.label}
                      </Badge>
                      <span className="text-[10px] text-primary/60 font-medium uppercase tracking-wider">
                        {item.weight}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Sample Diagnosis */}
      <SampleDiagnosis />

      {/* How It Works */}
      <section id="how-it-works" className="relative py-20 md:py-28 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="text-center mb-16"
          >
            <Badge variant="secondary" className="glass-subtle mb-4 px-4 py-1.5">
              Diagnostic Workflow
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              How MechanicAI thinks
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Every diagnosis follows a rigorous, evidence-first methodology.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: "01",
                icon: Search,
                title: "Gather Evidence",
                desc: "Collect OBD-II codes, sensor data, images, audio, repair history, and your description.",
              },
              {
                step: "02",
                icon: Microscope,
                title: "Validate Sources",
                desc: "Cross-reference each piece of evidence against OEM manuals, TSBs, and industry standards.",
              },
              {
                step: "03",
                icon: Brain,
                title: "Generate Hypotheses",
                desc: "Produce ranked possible causes with confidence percentages and supporting evidence.",
              },
              {
                step: "04",
                icon: Wrench,
                title: "Recommend Action",
                desc: "Suggest the least invasive, least expensive diagnostic test first, with safety flags.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeInUp}
                custom={i}
              >
                <div className="glass rounded-2xl p-6 h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                  <div className="size-10 rounded-xl glass-heavy flex items-center justify-center mb-4">
                    <item.icon className="size-5 text-primary" />
                  </div>
                  <div className="text-xs font-bold text-primary/60 mb-2">
                    {item.step}
                  </div>
                  <h3 className="font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Voice Input Demo */}
      <section className="relative py-20 md:py-28 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="glass-heavy rounded-3xl p-8 md:p-12 text-center"
          >
            <div className="size-16 rounded-2xl glass flex items-center justify-center mx-auto mb-6 relative">
              <Mic className="size-7 text-primary" />
              {/* Pulse ring */}
              <div className="absolute inset-0 rounded-2xl bg-primary/10 animate-ping" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
              Just say what&apos;s wrong
            </h2>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto mb-6">
              &ldquo;My truck won&apos;t start in the morning and there&apos;s a
              ticking sound from the engine&rdquo; — MechanicAI understands
              natural descriptions, transcribes audio, and analyzes engine
              noises with Whisper AI.
            </p>
            <div className="flex items-center justify-center gap-8 mt-8">
              {[
                { icon: Mic, label: "Voice Input" },
                { icon: FileText, label: "Auto-Transcribe" },
                { icon: Search, label: "Noise Analysis" },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <div className="size-10 rounded-xl glass flex items-center justify-center mx-auto mb-2">
                    <item.icon className="size-4 text-primary" />
                  </div>
                  <p className="text-[10px] text-muted-foreground font-medium">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Safety & Trust */}
      <section className="relative py-20 md:py-28 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="glass-heavy rounded-3xl p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeInUp}
              >
                <Badge variant="secondary" className="glass-subtle mb-4 px-4 py-1.5">
                  <Shield className="size-3.5 mr-1.5" />
                  Safety First
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                  We flag danger before it flags you
                </h2>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  MechanicAI immediately escalates safety-critical conditions:
                  brake failures, steering issues, fuel leaks, high-voltage
                  hazards, airbag systems, and structural damage. Safety
                  warnings are never buried.
                </p>
                <div className="space-y-3">
                  {[
                    "Brake & steering failures",
                    "Fuel system leaks",
                    "High-voltage / hybrid hazards",
                    "Airbag & restraint systems",
                    "Structural integrity concerns",
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 text-sm"
                    >
                      <AlertTriangle className="size-4 text-destructive shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeInUp}
                custom={1}
                className="glass rounded-2xl p-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Car className="size-5 text-primary" />
                  <span className="font-semibold text-sm">
                    Golden Rule
                  </span>
                </div>
                <blockquote className="text-lg font-medium italic text-muted-foreground leading-relaxed">
                  &ldquo;If the system cannot see it, measure it, verify it, or
                  support it with authoritative evidence, it must say &apos;I
                  don&apos;t know&apos; and request additional information
                  instead of inventing an answer.&rdquo;
                </blockquote>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  {[
                    { value: "100%", label: "Source-backed" },
                    { value: "0", label: "Hallucinations" },
                    { value: "Always", label: "Says \"I don't know\"" },
                  ].map((stat) => (
                    <div key={stat.label} className="text-center">
                      <p className="text-xl font-bold text-primary">{stat.value}</p>
                      <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-20 md:py-28 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <div className="glass-heavy rounded-3xl p-10 md:p-16">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                Stop guessing.
                <br />
                Start diagnosing with evidence.
              </h2>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
                Join mechanics and enthusiasts who trust MechanicAI for
                transparent, verifiable, evidence-first automotive diagnostics.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  size="lg"
                  className="text-base px-10 py-6 shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 transition-all duration-300 rounded-2xl"
                  onClick={() => navigate("/auth")}
                >
                  Get Started Free
                  <ArrowRight className="ml-2 size-5" />
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                No credit card required. Free to start.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-10 px-4 border-t border-border/40">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg glass-heavy flex items-center justify-center">
              <Wrench className="size-3.5 text-primary" />
            </div>
            <span className="text-sm font-semibold">
              Mechanic<span className="text-primary">AI</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Evidence-first automotive intelligence. Never guessing, always
            verifying.
          </p>
        </div>
      </footer>
    </div>
  );
}
