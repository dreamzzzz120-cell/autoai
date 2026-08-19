import { motion } from "framer-motion";
import { ArrowRight, Brain, Check, ShieldCheck, Wrench, Zap } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Prove the value before you pay.",
    features: [
      "1 diagnostic workspace",
      "Manual symptom and DTC analysis",
      "Basic evidence-first AI guidance",
      "Limited vehicle telemetry sessions",
    ],
    cta: "Start Free",
    featured: false,
  },
  {
    name: "AutoAI Plus",
    price: "$9.99",
    period: "/month",
    description: "Your vehicle's always-on intelligence layer.",
    features: [
      "Continuous Bluetooth OBD-II monitoring",
      "Live vehicle-health dashboard",
      "DTC and abnormal-trend alerts",
      "AI interpretation of telemetry changes",
      "Vehicle history and diagnostic timeline",
      "Repair-next-step recommendations",
    ],
    cta: "Start Plus",
    featured: true,
  },
  {
    name: "AutoAI Pro",
    price: "$99",
    period: "/year",
    description: "The best value for owners who keep their cars for years.",
    features: [
      "Everything in Plus",
      "Unlimited monitoring sessions",
      "Deeper diagnostic evidence reports",
      "Maintenance forecasting",
      "Pre-repair decision reports",
      "Priority AI diagnostic analysis",
    ],
    cta: "Choose Pro",
    featured: false,
  },
];

export default function Pricing() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen px-4 py-12 md:py-20">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-3xl mx-auto">
          <Badge variant="secondary" className="glass-subtle mb-4 px-4 py-1.5">
            <Zap className="size-3.5 mr-1.5" />
            Vehicle Intelligence
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Don't just read the check-engine light.
            <span className="block text-primary mt-2">Understand the vehicle.</span>
          </h1>
          <p className="text-lg text-muted-foreground mt-5">
            AutoAI turns compatible vehicle data into continuous health insight, early warnings, and evidence-backed next steps. The adapter gets the data; AutoAI makes it useful.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 mt-12">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className={`relative rounded-3xl p-1 ${plan.featured ? "bg-gradient-to-br from-primary/50 via-primary/20 to-transparent" : ""}`}
            >
              <div className="h-full glass rounded-[1.35rem] p-7">
                {plan.featured && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most Popular</Badge>
                )}
                <div className="flex items-center gap-2 mb-4">
                  <div className="size-9 rounded-xl glass-heavy flex items-center justify-center">
                    {plan.name === "Free" ? <Wrench className="size-4 text-primary" /> : plan.name === "AutoAI Plus" ? <Brain className="size-4 text-primary" /> : <ShieldCheck className="size-4 text-primary" />}
                  </div>
                  <h2 className="text-xl font-semibold">{plan.name}</h2>
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-sm text-muted-foreground mb-1">{plan.period}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-3 min-h-10">{plan.description}</p>
                <Button className="w-full mt-6 rounded-xl" variant={plan.featured ? "default" : "outline"} onClick={() => navigate("/auth")}>
                  {plan.cta}<ArrowRight className="size-4 ml-2" />
                </Button>
                <div className="mt-7 space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="size-4 text-primary shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="glass rounded-3xl p-7 md:p-9 mt-8">
          <div className="flex flex-col md:flex-row md:items-center gap-5">
            <div className="size-12 rounded-2xl glass-heavy flex items-center justify-center shrink-0">
              <Brain className="size-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">The paid promise</h3>
              <p className="text-sm text-muted-foreground mt-1">
                You are not paying for another code reader. You are paying for a second brain that watches the vehicle, remembers its history, finds changes, explains what matters, and tells you what to test next.
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              See the workspace
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
