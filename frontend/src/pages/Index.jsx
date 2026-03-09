/**
 * Index / landing page — responsive for all screens:
 * Mobile: default → 639px | sm: 640px+ | md: 768px+ | lg: 1024px+ | xl: 1280px+ | 2xl: 1536px+
 */
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, BarChart3, Package, ShieldCheck } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-[radial-gradient(circle_at_top,_hsl(var(--primary))/12%,_transparent_55%),_radial-gradient(circle_at_bottom,_hsl(var(--accent))/10%,_transparent_55%)]">
      <div className="mx-auto flex min-h-screen w-full min-w-0 max-w-6xl flex-col px-4 py-10 sm:px-6 sm:py-14 md:px-7 lg:px-8 lg:py-20 xl:px-10 2xl:px-12">
        {/* Hero + summary */}
        <section className="flex flex-1 flex-col gap-8 sm:gap-10 md:gap-12 lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-center lg:gap-14 xl:gap-16">
          <div className="min-w-0 space-y-5 sm:space-y-6 text-left">
            <p className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full border border-primary/20 bg-background/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary shadow-sm backdrop-blur-sm sm:gap-2 sm:text-xs">
              Super Market OS
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
              <span className="text-[10px] text-muted-foreground sm:text-[11px]">
                Real-time insights across every store
              </span>
            </p>

            <div className="space-y-2 sm:space-y-3">
              <h1 className="text-balance text-2xl font-bold leading-tight tracking-tight text-foreground min-[480px]:text-3xl sm:text-4xl md:text-5xl lg:text-4xl xl:text-5xl">
                Run your entire
                <span className="bg-gradient-to-r from-primary via-indigo-500 to-emerald-500 bg-clip-text text-transparent">
                  {" "}
                  supermarket
                </span>
                <br />
                from a single dashboard.
              </h1>
              <p className="max-w-xl text-pretty text-sm text-muted-foreground sm:text-base">
                Track inventory, billing, suppliers, and store performance in one modern, responsive interface
                that feels at home on mobiles, tablets, and desktop screens.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" className="h-11 rounded-full px-6 text-sm sm:h-12 sm:px-7">
                Open Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-11 rounded-full border-dashed px-6 text-sm sm:h-12 sm:px-7"
              >
                Explore inventory tools
              </Button>
            </div>

            <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2 sm:gap-4 sm:text-sm md:grid-cols-3">
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Built for speed</p>
                <p className="text-[11px] sm:text-xs">
                  Optimized layouts, fewer clicks, and instant keyboard-friendly navigation.
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Responsive by design</p>
                <p className="text-[11px] sm:text-xs">
                  Fluid grid system adapts seamlessly from 320px phones to widescreen desktops.
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Production-ready</p>
                <p className="text-[11px] sm:text-xs">
                  Accessible colors, safe tap targets, and consistent spacing scale.
                </p>
              </div>
            </div>
          </div>

          {/* Right-side visual / summary cards */}
          <div className="flex min-h-[260px] items-stretch">
            <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <Card className="border-primary/15 bg-card/90 shadow-sm backdrop-blur">
                <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <BarChart3 className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Realtime overview</p>
                        <p className="text-sm font-semibold text-foreground">Store performance</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-500">
                      +18% today
                    </span>
                  </div>
                  <div className="mt-1 h-20 rounded-lg bg-gradient-to-br from-primary/10 via-accent/10 to-transparent" />
                  <p className="text-[11px] text-muted-foreground">
                    Designed to match your existing dashboard metrics and adapt cleanly across breakpoints.
                  </p>
                </CardContent>
              </Card>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <Card className="border-border/70 bg-background/90 shadow-sm backdrop-blur">
                  <CardContent className="flex flex-col gap-2 p-4">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
                        <Package className="h-4 w-4" />
                      </span>
                      <p className="text-xs font-semibold tracking-wide text-foreground uppercase">
                        Inventory-first layout
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Clear hierarchy for items, categories, and purchase orders on any device.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border/70 bg-background/90 shadow-sm backdrop-blur">
                  <CardContent className="flex flex-col gap-2 p-4">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                        <ShieldCheck className="h-4 w-4" />
                      </span>
                      <p className="text-xs font-semibold tracking-wide text-foreground uppercase">
                        Safe & accessible
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Comfortable tap targets, semantic structure, and contrast that works in bright stores.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Feature grid */}
        <section className="mt-8 border-t border-border/60 pt-6 sm:mt-10 sm:pt-8 lg:mt-12 lg:pt-10">
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 md:gap-5 lg:grid-cols-4 xl:gap-6">
            <FeatureStat label="Mobile-ready" value="320px → 1440px" />
            <FeatureStat label="Layout system" value="Flexbox + CSS Grid" />
            <FeatureStat label="Spacing scale" value="clamp-based, fluid" />
            <FeatureStat label="Performance" value="Optimized paints" />
          </div>
        </section>
      </div>
    </div>
  );
};

const FeatureStat = ({ label, value }) => {
  if (!label || !value) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border/80 bg-background/80 px-3 py-3 text-xs shadow-sm sm:px-4 sm:py-4 sm:text-sm">
      <p className="font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground sm:text-base">{value}</p>
    </div>
  );
};

export default Index;
