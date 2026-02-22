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
      <Card className="hover:shadow-lg transition-shadow duration-300">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{title}</p>
              <p className="text-2xl sm:text-3xl font-bold truncate">{value}</p>
              {trend && (
                <p
                  className={`text-sm font-medium ${
                    trendUp ? "text-success" : "text-destructive"
                  }`}
                >
                  {trend}
                </p>
              )}
            </div>
            <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Icon className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
