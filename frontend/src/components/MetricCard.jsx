import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

export function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  trendUp,
  delay = 0,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className="hover:shadow-lg transition-shadow duration-300 h-full">
        <CardContent className="p-4 sm:p-6 h-full">
          <div className="flex h-full items-center justify-between gap-3 min-h-[4.5rem]">
            <div className="space-y-1 min-w-0 flex-1 flex flex-col justify-center">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground line-clamp-2 break-words">
                {title}
              </p>
              <p
                className="text-xl sm:text-2xl md:text-3xl font-bold whitespace-nowrap"
                title={typeof value === "string" ? value : String(value)}
              >
                {value}
              </p>
              {trend && (
                <p
                  className={`text-xs sm:text-sm font-medium whitespace-nowrap ${
                    trendUp ? "text-success" : "text-destructive"
                  }`}
                  title={trend}
                >
                  {trend}
                </p>
              )}
            </div>
            <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center flex-shrink-0">
              <Icon className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
