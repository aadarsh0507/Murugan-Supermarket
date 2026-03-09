import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { DollarSign, Package, TrendingUp, Users, AlertCircle, Truck } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { dashboardAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { getErrorMessage, getErrorTitle } from "@/utils/errorMessages";

const COLORS = ["hsl(239 70% 55%)", "hsl(25 95% 55%)", "hsl(142 76% 45%)", "hsl(260 70% 60%)", "hsl(35 95% 60%)"];

export default function Dashboard() {
  const { selectedStore } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [supplierCount, setSupplierCount] = useState(0);
  const [itemsCount, setItemsCount] = useState(null);
  const selectedStoreId = useMemo(() => {
    if (!selectedStore) return null;
    return selectedStore.id ?? selectedStore._id ?? selectedStore.storeId ?? null;
  }, [selectedStore]);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // Format number with commas
  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-IN').format(num || 0);
  };

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await dashboardAPI.getDashboardStats();
      if (response.success) {
        console.log('Dashboard data received:', response.data);
        setDashboardData(response.data);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      if (error.response?.data?.message) {
        if (error.response.data.message.includes('select a store')) {
          toast({
            title: "Store Selection Required",
            description: "Please select a store to view dashboard data",
            variant: "destructive",
          });
          navigate("/select-store");
        } else {
          toast({
            title: getErrorTitle(error),
            description: getErrorMessage(error, "Failed to load dashboard data", "dashboard data"),
            variant: "destructive",
          });
        }
      }
    } finally {
      setLoading(false);
    }
  }, [toast, navigate]);

  const fetchSupplierCount = useCallback(async () => {
    if (!selectedStoreId) {
      console.log('[Dashboard] No store selected, skipping supplier count fetch');
      setSupplierCount(0);
      return;
    }

    try {
      console.log('[Dashboard] Fetching supplier count for store:', selectedStoreId);
      const response = await dashboardAPI.getTotalSuppliersCount();
      console.log('[Dashboard] Supplier count response:', response);
      if (response && response.success) {
        const count = response.data?.totalSuppliers ?? 0;
        console.log('[Dashboard] Setting supplier count to:', count, 'for store:', selectedStoreId);
        setSupplierCount(count);
      } else {
        console.warn('[Dashboard] Supplier count response not successful:', response);
        setSupplierCount(0);
      }
    } catch (error) {
      console.error("Error fetching supplier count:", error);
      console.error("Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.status,
        storeId: selectedStoreId
      });
      setSupplierCount(0);
    }
  }, [selectedStoreId]);

  const fetchItemsCount = useCallback(async () => {
    if (!selectedStoreId) {
      console.log('[Dashboard] No store selected, skipping items count fetch');
      setItemsCount(0);
      return;
    }

    try {
      console.log('[Dashboard] Fetching items count for store:', selectedStoreId);
      const response = await dashboardAPI.getStoreItemsCount();
      if (response.success) {
        setItemsCount(response.data?.totalItems ?? 0);
      }
    } catch (error) {
      console.error("Error fetching items count:", error);
      setItemsCount(0);
    }
  }, [selectedStoreId]);

  // Initial load and reload when store changes
  useEffect(() => {
    if (!selectedStoreId) {
      setDashboardData(null);
      setLoading(false);
      return;
    }

    setDashboardData(null);
    setLoading(true);
    fetchDashboardData();
    fetchSupplierCount();
    fetchItemsCount();

    // Set up auto-refresh every 30 seconds for real-time updates
    const interval = setInterval(() => {
      fetchDashboardData();
      fetchSupplierCount();
      fetchItemsCount();
    }, 30000); // 30 seconds

    // Cleanup interval on unmount or store change
    return () => {
      clearInterval(interval);
    };
  }, [selectedStoreId, fetchDashboardData, fetchSupplierCount, fetchItemsCount]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  // Show store selection message
  if (!selectedStore) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground text-sm sm:text-base">Please select a store to view dashboard data</p>
          </motion.div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Store Selected</h3>
              <p className="text-muted-foreground mb-4">Please select a store to view real-time dashboard data</p>
              <button
                onClick={() => navigate("/select-store")}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Select Store
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error state if no data
  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <p className="text-muted-foreground">Unable to load dashboard data</p>
        </div>
      </div>
    );
  }

  const { metrics, trends, charts, lowStockItems } = dashboardData;

  // Calculate trend display
  const salesTrendText = trends.salesTrend >= 0
    ? `+${trends.salesTrend}% from last week`
    : `${trends.salesTrend}% from last week`;

  const dailyTrendText = trends.dailyTrend >= 0
    ? `+${trends.dailyTrend}% from yesterday`
    : `${trends.dailyTrend}% from yesterday`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's your store overview - {selectedStore?.name || 'Store'}
          </p>
        </motion.div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          title="Total Sales"
          value={formatCurrency(metrics.totalSales)}
          icon={DollarSign}
          trend={salesTrendText}
          trendUp={trends.salesTrend >= 0}
          delay={0}
        />
        <MetricCard
          title="Total Items"
          value={formatNumber(itemsCount ?? metrics.totalItems ?? 0)}
          icon={Package}
          trend={`${formatNumber(trends.itemsAddedThisMonth)} added this month`}
          trendUp={true}
          delay={0.1}
        />
        <MetricCard
          title="Daily Revenue"
          value={formatCurrency(metrics.dailyRevenue)}
          icon={TrendingUp}
          trend={dailyTrendText}
          trendUp={trends.dailyTrend >= 0}
          delay={0.2}
        />
        <MetricCard
          title="Total Customers"
          value={formatNumber(metrics.totalCustomers)}
          icon={Users}
          trend={`+${formatNumber(trends.newCustomersToday)} new today`}
          trendUp={true}
          delay={0.3}
        />
        <MetricCard
          title="Total Suppliers"
          value={formatNumber(supplierCount ?? 0)}
          icon={Truck}
          trend="suppliers"
          trendUp={true}
          delay={0.4}
        />
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sales Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Weekly Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={charts.weeklySales || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Bar dataKey="sales" fill="hsl(239 70% 55%)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Category Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Sales by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={charts.categorySales || []}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                  >
                    {(charts.categorySales || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems && lowStockItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
        >
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5 animate-pulse-glow" />
                Low Stock Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {lowStockItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20"
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Current: {formatNumber(item.quantity)} units (Threshold: {formatNumber(item.threshold)})
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-destructive font-semibold">
                        {Math.round((item.quantity / item.threshold) * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
