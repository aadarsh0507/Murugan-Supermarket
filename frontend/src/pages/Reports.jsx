import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Calendar, Download, TrendingUp, DollarSign, FileText, BarChart3, Users, Search, Package, Truck, CheckCircle, Clock, XCircle, ArrowLeft, CreditCard, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MetricCard } from "@/components/MetricCard";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { billsAPI, usersAPI, purchaseOrdersAPI, suppliersAPI, itemsAPI, categoriesAPI, creditsAPI, customerCreditsAPI, ordersAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage, getErrorTitle } from "@/utils/errorMessages";

const COLORS = ['hsl(239 70% 55%)', 'hsl(142 76% 45%)', 'hsl(38 92% 50%)', 'hsl(0 84% 60%)', 'hsl(263 70% 50%)'];

const formatUserDisplayName = (userItem) => {
  if (!userItem) return "Unnamed User";
  const first = userItem.firstName ? String(userItem.firstName).trim() : "";
  const last = userItem.lastName ? String(userItem.lastName).trim() : "";
  const fullName = [first, last].filter(Boolean).join(" ").trim();
  return fullName || userItem.fullName?.trim() || userItem.email || "Unnamed User";
};

const ORDERS_STATUS_COLORS = {
  pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
  confirmed: "bg-blue-100 text-blue-800 hover:bg-blue-200",
  processing: "bg-purple-100 text-purple-800 hover:bg-purple-200",
  inprogress: "bg-indigo-100 text-indigo-800 hover:bg-indigo-200",
  "in-progress": "bg-indigo-100 text-indigo-800 hover:bg-indigo-200",
  delivered: "bg-green-100 text-green-800 hover:bg-green-200",
  cancelled: "bg-red-100 text-red-800 hover:bg-red-200",
};

export default function Reports() {
  const { toast } = useToast();
  const { hasScreenAccess, user, selectedStore } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reportType, setReportType] = useState("monthly");
  const [detailedBills, setDetailedBills] = useState([]); // Store bills with items for detailed report
  const [loading, setLoading] = useState(false);
  const [bills, setBills] = useState([]);
  // Pagination for detailed report
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("all");
  const [reportData, setReportData] = useState(null);

  // Purchase Order Report States
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("all");
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState("all");
  const [poReportData, setPoReportData] = useState(null);
  const [poReportType, setPoReportType] = useState("monthly"); // "monthly", "daily", "supplierwise"
  const [activeTab, setActiveTab] = useState("sales"); // "sales", "purchase", or "credits"
  // PO sub-tab removed; use poReportType to switch between summary/daily/supplierwise/stock
  const [poViewMode, setPoViewMode] = useState("summary"); // "summary" or "detailed"
  const [stockWithBatches, setStockWithBatches] = useState([]);
  const [stockSearch, setStockSearch] = useState("");
  const [stockLoading, setStockLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");

  // Credit Collection Report States
  const [credits, setCredits] = useState([]);
  const [customerCredits, setCustomerCredits] = useState([]);
  const [creditReportData, setCreditReportData] = useState(null);
  const [creditLoading, setCreditLoading] = useState(false);
  const [selectedCreditSupplierId, setSelectedCreditSupplierId] = useState("all");
  const [creditStatusFilter, setCreditStatusFilter] = useState("all");
  const [creditViewMode, setCreditViewMode] = useState("summary"); // "summary" or "detailed"
  const [creditTypeFilter, setCreditTypeFilter] = useState("po"); // "po" or "billing"

  // Mobile Orders (Orders) Report States
  const [mobileOrders, setMobileOrders] = useState([]);
  const [ordersReportLoading, setOrdersReportLoading] = useState(false);
  const [ordersStatusFilter, setOrdersStatusFilter] = useState("all");

  const canFilterByUser = hasScreenAccess('user-rights') || hasScreenAccess('users');
  const restrictToOwnData = !canFilterByUser;

  useEffect(() => {
    // Optional deep-link: ?tab=orders
    const tabParam = searchParams.get("tab");
    const fromOrdersLink = tabParam === "orders";
    if (fromOrdersLink) {
      setActiveTab("orders");
      setSearchParams({}, { replace: true });
    }

    // Restore persisted filters
    try {
      const saved = JSON.parse(localStorage.getItem('reports_filters') || '{}');
      if (saved.activeTab && !fromOrdersLink) setActiveTab(saved.activeTab);
      if (saved.reportType) setReportType(saved.reportType);
      if (saved.poReportType) setPoReportType(saved.poReportType);
      if (saved.poViewMode) setPoViewMode(saved.poViewMode);
      if (saved.dateFrom) setDateFrom(saved.dateFrom);
      if (saved.dateTo) setDateTo(saved.dateTo);
      if (saved.selectedUserId) setSelectedUserId(saved.selectedUserId);
      if (saved.selectedSupplierId) setSelectedSupplierId(saved.selectedSupplierId);
      if (saved.selectedStoreId) setSelectedStoreId(saved.selectedStoreId);
      if (saved.selectedCategoryId) setSelectedCategoryId(saved.selectedCategoryId);
      if (saved.stockSearch) setStockSearch(saved.stockSearch);
      if (saved.selectedCreditSupplierId) setSelectedCreditSupplierId(saved.selectedCreditSupplierId);
      if (saved.creditStatusFilter) setCreditStatusFilter(saved.creditStatusFilter);
      if (saved.creditViewMode) setCreditViewMode(saved.creditViewMode);
      if (saved.creditTypeFilter) setCreditTypeFilter(saved.creditTypeFilter);
      if (saved.ordersStatusFilter) setOrdersStatusFilter(saved.ordersStatusFilter);
    } catch { }

    loadUsers();
    loadSuppliers();
    loadStores();
    loadCategories();
    // Report data will be loaded by the useEffect when selectedStore is available
    if (activeTab === "purchase") {
      loadPOReportData();
    }
    if (activeTab === "credits") {
      loadCreditReportData();
    }
    if (activeTab === "orders" || fromOrdersLink) {
      loadOrdersReportData();
    }
  }, []);

  // Persist filters whenever they change
  useEffect(() => {
    const toSave = {
      activeTab,
      reportType,
      poReportType,
      poViewMode,
      dateFrom,
      dateTo,
      selectedUserId,
      selectedSupplierId,
      selectedStoreId,
      selectedCategoryId,
      stockSearch,
      selectedCreditSupplierId,
      creditStatusFilter,
      creditViewMode,
      creditTypeFilter,
      ordersStatusFilter,
    };
    localStorage.setItem('reports_filters', JSON.stringify(toSave));
  }, [activeTab, reportType, poReportType, poViewMode, dateFrom, dateTo, selectedUserId, selectedSupplierId, selectedStoreId, selectedCategoryId, stockSearch, selectedCreditSupplierId, creditStatusFilter, creditViewMode, creditTypeFilter, ordersStatusFilter]);

  // Get store ID for dependency tracking - this ensures the effect runs when store changes
  const storeIdForEffect = selectedStore?._id || selectedStore?.id || null;

  useEffect(() => {
    if (activeTab === "sales") {
      if (storeIdForEffect) {
        // Clear previous data when store changes to avoid showing stale data
        setReportData(null);
        setDetailedBills([]);
        setBills([]);
        // Then load new data
        loadReportData();
      } else {
        // Clear data if no store is selected
        setReportData(null);
        setDetailedBills([]);
        setBills([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, dateFrom, dateTo, selectedUserId, storeIdForEffect, activeTab]);

  useEffect(() => {
    if (activeTab === "purchase") {
      if (poReportType === "stock" || poReportType === "storewise") {
        loadStockWithBatches();
      } else {
        loadPOReportData();
      }
    }
    if (activeTab === "credits") {
      loadCreditReportData();
    }
    if (activeTab === "orders") {
      loadOrdersReportData();
    }
  }, [dateFrom, dateTo, selectedSupplierId, selectedStoreId, stockSearch, selectedCategoryId, poReportType, selectedCreditSupplierId, creditStatusFilter, creditTypeFilter, creditViewMode, activeTab, ordersStatusFilter]);

  const loadUsers = async () => {
    try {
      const response = await usersAPI.getUsers();
      setUsers(response.data.users || []);
    } catch (error) {
      console.error("Error loading users:", error);
    }
  };

  const loadSuppliers = async () => {
    try {
      const response = await suppliersAPI.getSuppliers();
      const suppliersData = response.data?.suppliers || [];
      setSuppliers(suppliersData);
    } catch (error) {
      console.error("Error loading suppliers:", error);
    }
  };

  const loadStores = async () => {
    try {
      const response = await suppliersAPI.getStores();
      const storesData = response.data || [];
      setStores(storesData);
    } catch (error) {
      console.error("Error loading stores:", error);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await categoriesAPI.getCategories({
        includeSubcategories: true,
        limit: 100
      });
      setCategories(response.data?.categories || []);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const loadCreditReportData = async () => {
    setCreditLoading(true);
    try {
      const params = {
        limit: 1000, // Get all credits for the report
        page: 1
      };
      if (dateFrom) params.startDate = dateFrom;
      if (dateTo) params.endDate = dateTo;
      if (creditStatusFilter && creditStatusFilter !== "all") {
        params.status = creditStatusFilter;
      }

      if (creditTypeFilter === "po") {
        // Load PO Credits
        if (selectedCreditSupplierId && selectedCreditSupplierId !== "all") {
          params.supplierId = selectedCreditSupplierId;
        }
        const response = await creditsAPI.getCredits(params);
        const creditsData = response.data?.credits || [];
        setCredits(creditsData);
        setCustomerCredits([]);

        // Process credit report data
        const processedData = processCreditReportData(creditsData, "po");
        setCreditReportData(processedData);
      } else {
        // Load Billing Credits
        const response = await customerCreditsAPI.getCustomerCredits(params);
        const creditsData = response.data?.credits || [];
        setCustomerCredits(creditsData);
        setCredits([]);

        // Process credit report data
        const processedData = processCreditReportData(creditsData, "billing");
        setCreditReportData(processedData);
      }
    } catch (error) {
      console.error("Error loading credit report data:", error);
      toast({
        title: getErrorTitle(error),
        description: getErrorMessage(error, "Failed to load credit collection data", "credit collection data"),
        variant: "destructive",
      });
    } finally {
      setCreditLoading(false);
    }
  };

  const loadOrdersReportData = useCallback(async () => {
    setOrdersReportLoading(true);
    try {
      const response = await ordersAPI.getOrders({ limit: 1000, offset: 0 });
      let ordersData = [];
      if (Array.isArray(response?.data)) ordersData = response.data;
      else if (response?.data?.orders) ordersData = response.data.orders;
      else if (response?.data?.data?.orders) ordersData = response.data.data.orders;
      else if (response?.data) {
        ordersData = Array.isArray(response.data.data) ? response.data.data : response.data.orders ?? [];
      } else if (Array.isArray(response)) ordersData = response;
      setMobileOrders(ordersData ?? []);
    } catch (error) {
      setMobileOrders([]);
      toast({
        title: getErrorTitle(error),
        description: getErrorMessage(error, "Failed to load orders report", "orders"),
        variant: "destructive",
      });
    } finally {
      setOrdersReportLoading(false);
    }
  }, [toast]);

  const processCreditReportData = (creditsData, type = "po") => {
    if (!creditsData || creditsData.length === 0) {
      return {
        summary: {
          totalCredits: 0,
          totalOriginalAmount: 0,
          totalPaidAmount: 0,
          totalBalanceAmount: 0,
          pendingCount: 0,
          partiallyPaidCount: 0,
          paidCount: 0,
        },
        tableData: [],
        groupData: []
      };
    }

    // Calculate summary
    const summary = creditsData.reduce((acc, credit) => {
      acc.totalCredits += 1;
      acc.totalOriginalAmount += credit.originalAmount || 0;
      acc.totalPaidAmount += credit.paidAmount || 0;
      acc.totalBalanceAmount += credit.balanceAmount || 0;

      if (credit.status === 'pending') acc.pendingCount += 1;
      else if (credit.status === 'partially_paid') acc.partiallyPaidCount += 1;
      else if (credit.status === 'paid') acc.paidCount += 1;

      return acc;
    }, {
      totalCredits: 0,
      totalOriginalAmount: 0,
      totalPaidAmount: 0,
      totalBalanceAmount: 0,
      pendingCount: 0,
      partiallyPaidCount: 0,
      paidCount: 0,
    });

    // Process by supplier (PO) or customer (Billing)
    const groupData = creditsData.reduce((acc, credit) => {
      let groupKey;
      if (type === "po") {
        groupKey = credit.supplier?.companyName || credit.supplierName || 'Unknown Supplier';
      } else {
        groupKey = credit.customerName || 'Unknown Customer';
      }

      if (!acc[groupKey]) {
        acc[groupKey] = {
          name: groupKey,
          credits: 0,
          totalOriginalAmount: 0,
          totalPaidAmount: 0,
          totalBalanceAmount: 0
        };
      }
      acc[groupKey].credits += 1;
      acc[groupKey].totalOriginalAmount += credit.originalAmount || 0;
      acc[groupKey].totalPaidAmount += credit.paidAmount || 0;
      acc[groupKey].totalBalanceAmount += credit.balanceAmount || 0;
      return acc;
    }, {});

    // Sort table data by date
    const sortDateField = type === "po" ? "orderDate" : "billDate";
    const sortedTableData = creditsData.sort((a, b) => {
      const dateA = a[sortDateField] ? new Date(a[sortDateField]) : new Date(0);
      const dateB = b[sortDateField] ? new Date(b[sortDateField]) : new Date(0);
      return dateB - dateA;
    });

    return {
      summary: {
        totalCredits: summary.totalCredits,
        totalOriginalAmount: Math.round(summary.totalOriginalAmount),
        totalPaidAmount: Math.round(summary.totalPaidAmount),
        totalBalanceAmount: Math.round(summary.totalBalanceAmount),
        pendingCount: summary.pendingCount,
        partiallyPaidCount: summary.partiallyPaidCount,
        paidCount: summary.paidCount,
      },
      tableData: sortedTableData,
      groupData: Object.values(groupData).sort((a, b) => b.totalBalanceAmount - a.totalBalanceAmount),
      type: type
    };
  };

  const loadPOReportData = async () => {
    setLoading(true);
    try {
      const params = {
        limit: 1000
      };
      if (dateFrom) params.startDate = dateFrom;
      if (dateTo) params.endDate = dateTo;
      if (selectedSupplierId && selectedSupplierId !== "all") {
        params.supplierId = selectedSupplierId;
      }
      if (selectedStoreId && selectedStoreId !== "all") {
        params.storeId = selectedStoreId;
      }

      const response = await purchaseOrdersAPI.getPurchaseOrders(params);
      const poData = response.data?.purchaseOrders || [];
      setPurchaseOrders(poData);

      const processedData = processPOReportData(poData, poReportType);
      setPoReportData(processedData);
    } catch (error) {
      console.error("Error loading PO report data:", error);
      toast({
        title: getErrorTitle(error),
        description: getErrorMessage(error, "Failed to load purchase order data", "purchase order data"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStockWithBatches = async () => {
    setStockLoading(true);
    try {
      const params = {};
      if (stockSearch) {
        params.search = stockSearch;
      }
      if (selectedCategoryId && selectedCategoryId !== "all") {
        params.categoryId = selectedCategoryId;
      }
      // Add store filter when a store is selected
      if (selectedStoreId && selectedStoreId !== "all") {
        params.storeId = selectedStoreId;
      }

      const response = await itemsAPI.getStockWithBatches(params);
      const stockData = response.data || [];
      setStockWithBatches(stockData);
    } catch (error) {
      console.error("Error loading stock with batches:", error);
      toast({
        title: getErrorTitle(error),
        description: getErrorMessage(error, "Failed to load stock with batch data", "stock with batch data"),
        variant: "destructive",
      });
    } finally {
      setStockLoading(false);
    }
  };

  const processPOReportData = (pos, type = "monthly") => {
    if (!pos || pos.length === 0) {
      return {
        summary: {
          totalPOs: 0,
          totalValue: "0.00",
          totalItems: 0,
          averagePOValue: "0.00",
          pendingPOs: 0,
          completedPOs: 0,
          cancelledPOs: 0
        },
        chartData: [],
        tableData: [],
        supplierData: [],
        rawData: [],
        storeItemsMap: {}
      };
    }

    // Process by status
    const statusData = pos.reduce((acc, po) => {
      if (!acc[po.status]) {
        acc[po.status] = { count: 0, value: 0, items: 0 };
      }
      acc[po.status].count += 1;
      acc[po.status].value += po.total || 0;
      acc[po.status].items += po.totalQuantity || 0;
      return acc;
    }, {});

    // Process by supplier
    const supplierData = pos.reduce((acc, po) => {
      const supplierName = po.supplier?.companyName || 'Unknown';
      if (!acc[supplierName]) {
        acc[supplierName] = { supplier: supplierName, pos: 0, value: 0, items: 0 };
      }
      acc[supplierName].pos += 1;
      acc[supplierName].value += po.total || 0;
      acc[supplierName].items += po.totalQuantity || 0;
      return acc;
    }, {});

    let chartData = [];
    let tableData = [];
    let storeItemsMap = {};

    if (type === "monthly") {
      // Process by month (keyed by yyyy-MM so sorting is chronological)
      const monthlyData = pos.reduce((acc, po) => {
        const date = new Date(po.orderDate);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

        if (!acc[monthKey]) {
          acc[monthKey] = { month: monthName, pos: 0, value: 0, items: 0 };
        }

        acc[monthKey].pos += 1;
        acc[monthKey].value += po.total || 0;
        acc[monthKey].items += po.totalQuantity || 0;

        return acc;
      }, {});

      chartData = Object.entries(monthlyData)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([, value]) => value);
      // Keep the PO monthly table in the same chronological order as the chart
      tableData = chartData;
    } else if (type === "daily") {
      // Process by day (keyed by ISO date so sorting is chronological)
      const dailyData = pos.reduce((acc, po) => {
        const date = new Date(po.orderDate);
        const dayKey = date.toISOString().split('T')[0];
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

        if (!acc[dayKey]) {
          acc[dayKey] = { day: dayName, pos: 0, value: 0, items: 0 };
        }

        acc[dayKey].pos += 1;
        acc[dayKey].value += po.total || 0;
        acc[dayKey].items += po.totalQuantity || 0;

        return acc;
      }, {});

      chartData = Object.entries(dailyData)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([, value]) => value)
        .slice(-30);
      tableData = Object.values(dailyData).sort((a, b) => b.value - a.value).slice(0, 20);
    } else if (type === "supplierwise") {
      // Use supplier data for charts
      chartData = Object.values(supplierData).sort((a, b) => b.value - a.value);
      tableData = Object.values(supplierData).sort((a, b) => b.value - a.value);
    } else if (type === "storewise") {
      // Group by store and also aggregate items per store
      const storeAgg = {};
      storeItemsMap = {};
      pos.forEach(po => {
        const storeName = po.store?.name || 'Unknown';
        const storeId = po.store?._id || po.store || 'unknown';
        if (!storeAgg[storeName]) {
          storeAgg[storeName] = { store: storeName, pos: 0, value: 0, items: 0 };
        }
        storeAgg[storeName].pos += 1;
        storeAgg[storeName].value += po.total || 0;
        storeAgg[storeName].items += po.totalQuantity || 0;

        if (!storeItemsMap[storeId]) storeItemsMap[storeId] = {};
        (po.items || []).forEach(it => {
          const key = it.sku || it.itemName;
          if (!key) return;
          if (!storeItemsMap[storeId][key]) {
            storeItemsMap[storeId][key] = {
              sku: it.sku || '',
              itemName: it.itemName || 'Unknown',
              totalQuantity: 0,
            };
          }
          storeItemsMap[storeId][key].totalQuantity += it.quantity || 0;
        });
      });
      chartData = Object.values(storeAgg).sort((a, b) => b.value - a.value);
      tableData = Object.values(storeAgg).sort((a, b) => b.value - a.value);
    }

    const totalValue = pos.reduce((sum, po) => sum + (po.total || 0), 0);
    const totalItems = pos.reduce((sum, po) => sum + (po.totalQuantity || 0), 0);
    const averagePOValue = pos.length > 0 ? totalValue / pos.length : 0;

    return {
      summary: {
        totalPOs: pos.length,
        totalValue: totalValue.toFixed(2),
        totalItems,
        averagePOValue: averagePOValue.toFixed(2),
        pendingPOs: statusData.pending?.count || 0,
        completedPOs: statusData.completed?.count || 0,
        cancelledPOs: statusData.cancelled?.count || 0
      },
      chartData,
      tableData,
      supplierData: Object.values(supplierData).sort((a, b) => b.value - a.value),
      rawData: pos.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate)),
      storeItemsMap
    };
  };

  const loadReportData = async () => {
    const storeId = selectedStore?._id || selectedStore?.id;
    if (!storeId) {
      // Don't load if no store is selected
      setReportData(null);
      setDetailedBills([]);
      setBills([]);
      setLoading(false);
      return;
    }
    
    // Clear previous data and set loading state
    setReportData(null);
    setDetailedBills([]);
    setBills([]);
    setLoading(true);
    try {
      const params = {
        limit: 10000  // Get all bills for detailed report (we'll paginate on frontend)
      };
      if (dateFrom) params.startDate = dateFrom;
      if (dateTo) params.endDate = dateTo;
      
      // Always filter by selected store
      params.storeId = storeId;

      if (restrictToOwnData) {
        params.createdBy = user.id;
      } else if (selectedUserId && selectedUserId !== "all") {
        params.createdBy = selectedUserId;
      }

      const response = await billsAPI.getBills(params);
      // Handle both array response and object with bills array
      let billsData = [];
      if (Array.isArray(response.data)) {
        billsData = response.data;
      } else if (response.data?.bills) {
        billsData = response.data.bills;
      } else if (response.data?.data) {
        billsData = Array.isArray(response.data.data) ? response.data.data : [];
      }
      
      setBills(billsData);

      // If detailed report, fetch items for each bill
      let billsForProcessing = billsData;
      if (reportType === "detailed") {
        const billsWithItems = await Promise.all(
          billsData.map(async (bill) => {
            try {
              const billId = bill.id || bill._id;
              if (!billId) return bill;
              
              const billDetail = await billsAPI.getBill(billId);
              // API returns { status: 'success', data: { bill } }
              const detailedBill = billDetail?.data?.bill || billDetail?.data || billDetail || bill;
              
              // Ensure we have all the fields from the original bill
              const mergedBill = {
                ...bill,
                ...detailedBill,
                items: detailedBill.items || bill.items || []
              };
              
              return mergedBill;
            } catch (error) {
              console.error(`Error fetching bill ${bill.id} details:`, error);
              return bill; // Return bill without items if fetch fails
            }
          })
        );
        setDetailedBills(billsWithItems);
        setCurrentPage(1); // Reset to first page when new data loads
        billsForProcessing = billsWithItems; // Use detailed bills for summary calculation
      } else {
        // For other report types, also fetch items to get accurate item counts
        billsForProcessing = await Promise.all(
          billsData.map(async (bill) => {
            try {
              const billId = bill.id || bill._id;
              if (!billId || bill.items) return bill; // Skip if already has items
              
              const billDetail = await billsAPI.getBill(billId);
              // API returns { status: 'success', data: { bill } }
              const detailedBill = billDetail?.data?.bill || billDetail?.data || billDetail || bill;
              
              return {
                ...bill,
                items: detailedBill.items || bill.items || []
              };
            } catch (error) {
              // Silently fail for non-detailed reports
              return bill;
            }
          })
        );
        setDetailedBills([]);
      }

      const processedData = processReportData(billsForProcessing, reportType);
      setReportData(processedData);
    } catch (error) {
      console.error("Error loading report data:", error);
      toast({
        title: getErrorTitle(error),
        description: getErrorMessage(error, "Failed to load report data", "report data"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const processReportData = (bills, type, detailedBills = []) => {
    if (!bills || bills.length === 0) {
      return {
        summary: {
          totalRevenue: 0,
          totalBills: 0,
          totalItems: 0,
          averageBill: 0,
        },
        chartData: [],
        tableData: [],
      };
    }

    let chartData = [];
    let tableData = [];

    if (type === "monthly") {
      // Aggregate by month key yyyy-MM so both chart and table are in chronological month order
      const monthlyData = bills.reduce((acc, bill) => {
        const date = new Date(bill.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

        if (!acc[monthKey]) {
          acc[monthKey] = { month: monthName, revenue: 0, bills: 0, items: 0 };
        }

        const billTotal = bill.total || bill.totalAmount || 0;
        acc[monthKey].revenue += Number(billTotal);
        acc[monthKey].bills += 1;
        const billItems = bill.items && Array.isArray(bill.items) 
          ? bill.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
          : (bill.totalQuantity || 0);
        acc[monthKey].items += Number(billItems);

        return acc;
      }, {});

      chartData = Object.entries(monthlyData)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([, value]) => value);
      // Show the detailed monthly table in the same chronological order as the chart
      tableData = chartData;
    } else if (type === "daily") {
      // Aggregate by ISO date so days are in correct order
      const dailyData = bills.reduce((acc, bill) => {
        const date = new Date(bill.createdAt);
        const dayKey = date.toISOString().split('T')[0];
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

        if (!acc[dayKey]) {
          acc[dayKey] = { day: dayName, revenue: 0, bills: 0, items: 0 };
        }

        const billTotal = bill.total || bill.totalAmount || 0;
        acc[dayKey].revenue += Number(billTotal);
        acc[dayKey].bills += 1;
        const billItems = bill.items && Array.isArray(bill.items) 
          ? bill.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
          : (bill.totalQuantity || 0);
        acc[dayKey].items += Number(billItems);

        return acc;
      }, {});

      chartData = Object.entries(dailyData)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([, value]) => value)
        .slice(-30);
      tableData = Object.values(dailyData).sort((a, b) => b.revenue - a.revenue).slice(0, 20);
    } else if (type === "userwise") {
      const userData = bills.reduce((acc, bill) => {
        // Get user name from various possible fields - check all variations
        let userName = null;
        
        // First check the mapped userName field
        if (bill.userName && typeof bill.userName === 'string' && bill.userName.trim() !== '') {
          userName = bill.userName.trim();
        }
        // Then check raw database fields
        else if (bill.user_first_name || bill.user_last_name) {
          const firstName = bill.user_first_name ? String(bill.user_first_name).trim() : '';
          const lastName = bill.user_last_name ? String(bill.user_last_name).trim() : '';
          const parts = [firstName, lastName].filter(Boolean);
          if (parts.length > 0) {
            userName = parts.join(' ');
          }
        }
        // Fallback to email if name not available
        else if (bill.userEmail || bill.user_email) {
          userName = (bill.userEmail || bill.user_email || '').trim();
        }
        // Last resort fallbacks
        else if (bill.billBy && typeof bill.billBy === 'string' && bill.billBy.trim() !== '') {
          userName = bill.billBy.trim();
        }
        
        // If still no userName, use "Unknown"
        if (!userName || userName === '') {
          userName = "Unknown";
        }
        
        // Get user email from various possible fields
        let userEmail = null;
        if (bill.userEmail && typeof bill.userEmail === 'string' && bill.userEmail.trim() !== '') {
          userEmail = bill.userEmail.trim();
        } else if (bill.user_email && typeof bill.user_email === 'string' && bill.user_email.trim() !== '') {
          userEmail = bill.user_email.trim();
        } else if (bill.createdBy?.email && typeof bill.createdBy.email === 'string' && bill.createdBy.email.trim() !== '') {
          userEmail = bill.createdBy.email.trim();
        }
        
        // If no email found, use "N/A"
        if (!userEmail || userEmail === '') {
          userEmail = "N/A";
        }

        // Use a unique key combining name and email to avoid duplicates
        const userKey = `${userName}|${userEmail}`;

        if (!acc[userKey]) {
          acc[userKey] = { user: userName, email: userEmail, revenue: 0, bills: 0, items: 0 };
        }

        const billTotal = bill.total || bill.totalAmount || 0;
        acc[userKey].revenue += Number(billTotal);
        acc[userKey].bills += 1;
        const billItems = bill.items && Array.isArray(bill.items) 
          ? bill.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
          : (bill.totalQuantity || 0);
        acc[userKey].items += Number(billItems);

        return acc;
      }, {});
      
      // Debug: Log user data aggregation
      // Aggregated user-wise data is available in userData if needed for debugging

      chartData = Object.values(userData).sort((a, b) => b.revenue - a.revenue);
      tableData = Object.values(userData).sort((a, b) => b.revenue - a.revenue);
    }

    // Calculate summary from bills (which may be detailedBills for detailed report type)
    const totalRevenue = bills.reduce((sum, bill) => {
      // Handle both totalAmount and total field names
      const billTotal = bill.total || bill.totalAmount || 0;
      return sum + Number(billTotal);
    }, 0);
    const totalBills = bills.length;
    const totalItems = bills.reduce((sum, bill) => {
      // Count items from bill.items array if available
      if (bill.items && Array.isArray(bill.items) && bill.items.length > 0) {
        const itemCount = bill.items.reduce((itemSum, item) => {
          // Handle different field names for quantity
          const qty = Number(item.quantity || item.qty || item.Quantity || 0);
          return itemSum + qty;
        }, 0);
        return sum + itemCount;
      }
      // Fallback to totalQuantity if items array not available
      return sum + (Number(bill.totalQuantity || bill.total_quantity || 0));
    }, 0);
    const averageBill = totalBills > 0 ? totalRevenue / totalBills : 0;

    return {
      summary: {
        totalRevenue: totalRevenue.toFixed(2),
        totalBills,
        totalItems,
        averageBill: averageBill.toFixed(2),
      },
      chartData,
      tableData,
    };
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { label: 'Pending', variant: 'secondary', icon: Clock },
      partially_received: { label: 'Partially Received', variant: 'default', icon: Package },
      completed: { label: 'Completed', variant: 'default', icon: CheckCircle },
      cancelled: { label: 'Cancelled', variant: 'destructive', icon: XCircle }
    };

    const config = statusConfig[status] || { label: status, variant: 'secondary', icon: Clock };
    const IconComponent = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <IconComponent className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const formatDateValue = (value, withTime = false) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-GB", withTime
      ? { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const formatCurrencyValue = (value) => {
    const num = Number(value ?? 0);
    return `₹${num.toFixed(2)}`;
  };

  const filteredMobileOrders = useMemo(() => {
    return mobileOrders.filter((order) => {
      const status = (order.status || "").toLowerCase();
      if (ordersStatusFilter !== "all" && status !== ordersStatusFilter) return false;
      const rawDate = order.orderDate || order.createdAt || order.created_at;
      if (dateFrom && rawDate) {
        const orderDt = new Date(rawDate);
        if (!Number.isNaN(orderDt.getTime())) {
          const from = new Date(`${dateFrom}T00:00:00`);
          if (orderDt < from) return false;
        }
      }
      if (dateTo && rawDate) {
        const orderDt = new Date(rawDate);
        if (!Number.isNaN(orderDt.getTime())) {
          const to = new Date(`${dateTo}T23:59:59.999`);
          if (orderDt > to) return false;
        }
      }
      return true;
    });
  }, [mobileOrders, dateFrom, dateTo, ordersStatusFilter]);

  const ordersReportMetrics = useMemo(() => {
    let totalAmount = 0, deliveredAmount = 0, pendingCount = 0, deliveredCount = 0, cancelledCount = 0;
    filteredMobileOrders.forEach((order) => {
      const total = Number(order.total) || 0;
      totalAmount += total;
      const status = (order.status || "").toLowerCase();
      if (status === "delivered") { deliveredAmount += total; deliveredCount += 1; }
      else if (status === "pending") pendingCount += 1;
      else if (status === "cancelled") cancelledCount += 1;
    });
    return { totalOrders: filteredMobileOrders.length, totalAmount, deliveredAmount, pendingCount, deliveredCount, cancelledCount };
  }, [filteredMobileOrders]);

  const summarizeAmountHistory = (credit) => {
    if (!credit) return "No data";
    const initialAmount = (() => {
      if (credit.initialOriginalAmount) return credit.initialOriginalAmount;
      if (credit.purchaseOrder?.total !== undefined && credit.purchaseOrder?.total !== null) {
        return credit.purchaseOrder.total;
      }
      return credit.originalAmount || 0;
    })();
    const currentAmount = credit.originalAmount || 0;
    let history = Array.isArray(credit.amountChangeHistory) ? [...credit.amountChangeHistory] : [];
    history.sort((a, b) => {
      const dateA = new Date(a.changeDate || a.createdAt || 0);
      const dateB = new Date(b.changeDate || b.createdAt || 0);
      return dateB - dateA;
    });
    if (history.length === 0 && Math.abs(initialAmount - currentAmount) > 0.01) {
      history.push({
        previousAmount: initialAmount,
        updatedAmount: currentAmount,
        changeDate: credit.orderDate || credit.billDate || credit.createdAt || credit.updatedAt || new Date(),
        notes: "Amount updated",
        changedBy: credit.updatedBy || credit.createdBy || null
      });
    }
    if (history.length === 0) return "Never edited";
    return history
      .map((entry) => {
        const date = formatDateValue(entry.changeDate || entry.createdAt || new Date(), true);
        const by = entry.changedBy
          ? ` by ${[entry.changedBy.firstName, entry.changedBy.lastName].filter(Boolean).join(" ")}`
          : "";
        const notes = entry.notes ? ` (${entry.notes})` : "";
        return `${date}: ${formatCurrencyValue(entry.previousAmount)} → ${formatCurrencyValue(entry.updatedAmount)}${by}${notes}`;
      })
      .join(" | ");
  };

  const summarizePaymentHistory = (credit) => {
    const payments = Array.isArray(credit?.paymentHistory) ? [...credit.paymentHistory] : [];
    if (payments.length === 0) return "No payments";
    payments.sort((a, b) => {
      const dateA = new Date(a.paymentDate || 0);
      const dateB = new Date(b.paymentDate || 0);
      return dateB - dateA;
    });
    return payments
      .map((payment) => {
        const date = formatDateValue(payment.paymentDate || payment.createdAt || new Date(), true);
        const by = payment.collectedBy
          ? ` by ${[payment.collectedBy.firstName, payment.collectedBy.lastName].filter(Boolean).join(" ")}`
          : "";
        const notes = payment.notes ? ` (${payment.notes})` : "";
        return `${date}: ${formatCurrencyValue(payment.amount)}${by}${notes}`;
      })
      .join(" | ");
  };

  const buildExportDataset = () => {
    const today = new Date().toISOString().slice(0, 10);

    if (activeTab === "sales" && reportData?.tableData?.length) {
      const labelHeader =
        reportType === "monthly" ? "Month" :
          reportType === "daily" ? "Date" : "User";
      const columns = [labelHeader];
      if (reportType === "userwise") columns.push("Email");
      columns.push("Revenue (₹)", "Bills", "Items");
      const rows = reportData.tableData.map((row) => {
        const labelValue =
          reportType === "monthly" ? row.month :
            reportType === "daily" ? row.day : row.user;
        const record = {
          [labelHeader]: labelValue,
          "Revenue (₹)": Number(row.revenue ?? 0).toFixed(2),
          "Bills": row.bills ?? 0,
          "Items": row.items ?? 0
        };
        if (reportType === "userwise") {
          record.Email = row.email || "";
        }
        return record;
      });
      return {
        title: `Sales Report (${reportType})`,
        filename: `sales-${reportType}-${today}`,
        columns: reportType === "userwise"
          ? [labelHeader, "Email", "Revenue (₹)", "Bills", "Items"]
          : columns,
        rows
      };
    }

    if (activeTab === "purchase") {
      if (poReportType === "stock" && stockWithBatches.length > 0) {
        const columns = [
          "Item Name",
          "SKU",
          "Category",
          "Subcategory",
          "Batch Number",
          "Quantity",
          "PO Number",
          "Purchase Order Date"
        ];
        const rows = stockWithBatches.map((item) => ({
          "Item Name": item.itemName || "",
          "SKU": item.sku || "",
          "Category": item.category || "",
          "Subcategory": item.subcategory || "",
          "Batch Number": item.batchNumber || "",
          "Quantity": item.quantity ?? 0,
          "PO Number": item.purchaseOrderNumber || "",
          "Purchase Order Date": formatDateValue(item.purchaseOrderDate)
        }));
        return {
          title: "Stock with Batches",
          filename: `purchase-stock-${today}`,
          columns,
          rows
        };
      }

      if (poViewMode === "detailed" && poReportData?.rawData?.length) {
        const columns = [
          "PO Number",
          "Supplier",
          "Order Date",
          "Status",
          "Items",
          "Total Value (₹)",
          "Created By"
        ];
        const rows = poReportData.rawData.map((po) => ({
          "PO Number": po.poNumber || "",
          "Supplier": po.supplier?.companyName || "Unknown",
          "Order Date": formatDateValue(po.orderDate),
          "Status": (po.status || "").replace(/_/g, " "),
          "Items": po.totalQuantity ?? 0,
          "Total Value (₹)": Number(po.total ?? 0).toFixed(2),
          "Created By": po.createdBy?.firstName
            ? `${po.createdBy.firstName} ${po.createdBy.lastName ?? ""}`.trim()
            : "Unknown"
        }));
        return {
          title: "Detailed Purchase Orders",
          filename: `purchase-orders-detailed-${today}`,
          columns,
          rows
        };
      }

      if (poReportData?.tableData?.length) {
        const labelHeader =
          poReportType === "monthly" ? "Month" :
            poReportType === "daily" ? "Date" :
              poReportType === "supplierwise" ? "Supplier" :
                "Store";
        const columns = [labelHeader, "POs", "Total Value (₹)", "Items"];
        const rows = poReportData.tableData.map((row) => {
          const labelValue =
            poReportType === "monthly" ? row.month :
              poReportType === "daily" ? row.day :
                poReportType === "supplierwise" ? row.supplier : row.store;
          return {
            [labelHeader]: labelValue,
            "POs": row.pos ?? 0,
            "Total Value (₹)": Number(row.value ?? 0).toFixed(2),
            "Items": row.items ?? 0
          };
        });
        return {
          title: `Purchase Orders (${poReportType})`,
          filename: `purchase-orders-${poReportType}-${today}`,
          columns,
          rows
        };
      }
    }

    if (activeTab === "credits" && creditReportData) {
      if (creditViewMode === "detailed" && creditReportData.tableData.length > 0) {
        const isPOCredit = creditTypeFilter === "po";
        const baseColumns = isPOCredit
          ? ["PO Number", "Supplier", "Order Date"]
          : ["Bill Number", "Customer", "Customer Phone", "Bill Date"];
        const columns = [
          ...baseColumns,
          "Initial Amount (₹)",
          "Current Amount (₹)",
          "Discount (₹)",
          "Paid Amount (₹)",
          "Balance (₹)",
          "Status",
          "Amount Edit History",
          "Payment Mode",
          "Notes"
        ];
        const rows = creditReportData.tableData.map((credit) => {
          const initialAmount = (() => {
            if (credit.initialOriginalAmount) return credit.initialOriginalAmount;
            if (credit.purchaseOrder?.total !== undefined && credit.purchaseOrder?.total !== null) {
              return credit.purchaseOrder.total;
            }
            return credit.originalAmount || 0;
          })();
          const baseData = isPOCredit
            ? {
              "PO Number": credit.poNumber || "",
              "Supplier": credit.supplier?.companyName || credit.supplierName || "Unknown",
              "Order Date": formatDateValue(credit.orderDate)
            }
            : {
              "Bill Number": credit.billNumber || "N/A",
              "Customer": credit.customerName || "Unknown",
              "Customer Phone": credit.customerPhone || "N/A",
              "Bill Date": formatDateValue(credit.billDate)
            };

          // Get payment modes from payment history only (actual payments made)
          const paymentModes = credit.paymentHistory && credit.paymentHistory.length > 0
            ? [...credit.paymentHistory]
                .map(p => {
                  const mode = p.paymentMode || p.payment_mode || 'cash';
                  return mode.toUpperCase();
                })
                .filter(mode => mode && mode !== 'CREDIT') // Filter out 'CREDIT' as it's the bill type, not a payment mode
                .filter((mode, index, self) => self.indexOf(mode) === index) // Get unique modes
                .join(", ")
            : "N/A";

          // Get notes from payment history
          const paymentNotes = credit.paymentHistory && credit.paymentHistory.length > 0
            ? [...credit.paymentHistory]
                .map(p => p.notes || '')
                .filter(note => note && note.trim() !== '')
                .join(" | ")
            : "N/A";

          const currentAmount = credit.originalAmount || 0;
          const discount = Math.max(0, initialAmount - currentAmount);

          return {
            ...baseData,
            "Initial Amount (₹)": Math.round(initialAmount),
            "Current Amount (₹)": Math.round(currentAmount),
            "Discount (₹)": Math.round(discount),
            "Paid Amount (₹)": Math.round(credit.paidAmount || 0),
            "Balance (₹)": Math.round(credit.balanceAmount || 0),
            "Status": (credit.status || "").replace(/_/g, " "),
            "Amount Edit History": summarizeAmountHistory(credit),
            "Payment Mode": paymentModes,
            "Notes": paymentNotes
          };
        });
        return {
          title: "Detailed Credit Collection Report",
          filename: `credits-detailed-${today}`,
          columns,
          rows
        };
      }

      if (creditReportData.groupData.length > 0) {
        const labelHeader = creditTypeFilter === "po" ? "Supplier" : "Customer";
        const columns = [
          labelHeader,
          "Credits",
          "Original Amount (₹)",
          "Paid Amount (₹)",
          "Balance (₹)"
        ];
        const rows = creditReportData.groupData.map((group) => ({
          [labelHeader]: group.name,
          "Credits": group.credits,
          "Original Amount (₹)": group.totalOriginalAmount ?? 0,
          "Paid Amount (₹)": group.totalPaidAmount ?? 0,
          "Balance (₹)": group.totalBalanceAmount ?? 0
        }));
        return {
          title: "Credit Summary",
          filename: `credits-summary-${today}`,
          columns,
          rows
        };
      }
    }

    return null;
  };

  const exportDatasetToCSV = (dataset) => {
    const { columns, rows, filename } = dataset;
    const header = columns.join(",");
    const csvRows = rows.map((row) =>
      columns
        .map((col) => {
          const value = row[col] !== undefined && row[col] !== null ? row[col] : "";
          const stringValue = typeof value === "string" ? value : String(value);
          return `"${stringValue.replace(/"/g, '""')}"`;
        })
        .join(",")
    );
    const csvContent = [header, ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename || "report"}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportDatasetToPDF = (dataset) => {
    const { columns, rows, title } = dataset;
    const printWindow = window.open("", "_blank", "width=900,height=650");
    if (!printWindow) {
      toast({
        title: "Popup Blocked",
        description: "Allow popups to export the PDF.",
        variant: "destructive"
      });
      return;
    }
    const tableHead = columns.map((col) => `<th style="padding:8px;border:1px solid #ccc;text-align:left;">${col}</th>`).join("");
    const tableRows = rows
      .map((row) =>
        `<tr>${columns
          .map((col) => `<td style="padding:8px;border:1px solid #eee;">${row[col] ?? ""}</td>`)
          .join("")}</tr>`
      )
      .join("");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { font-size: 20px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #f5f5f5; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <table>
            <thead><tr>${tableHead}</tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleExport = (format) => {
    const dataset = buildExportDataset();
    if (!dataset) {
      toast({
        title: "No Data",
        description: "No data available to export",
        variant: "destructive"
      });
      return;
    }

    if (format === "pdf") {
      exportDatasetToPDF(dataset);
      toast({
        title: "PDF Ready",
        description: "Use the print dialog to save the report as PDF."
      });
    } else {
      exportDatasetToCSV(dataset);
      toast({
        title: "Excel Ready",
        description: "Your report has been downloaded as a CSV file."
      });
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6 pb-10 min-w-0 overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 sm:gap-4 min-w-0"
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-9 w-9"
            title="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground">
              {restrictToOwnData
                ? `Your personal reports and analytics`
                : "Comprehensive business insights"}
            </p>
            {restrictToOwnData && (
              <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950 rounded-md">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <Users className="inline h-4 w-4 mr-1" />
                  Showing only your bills and transactions
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Report Type Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap gap-1 bg-muted p-1 rounded-lg w-full sm:w-fit"
      >
        <Button
          variant={activeTab === "sales" ? "default" : "ghost"}
          onClick={() => {
            setActiveTab("sales");
          }}
          className="flex items-center gap-2"
        >
          <DollarSign className="h-4 w-4" />
          Sales Reports
        </Button>
        <Button
          variant={activeTab === "purchase" ? "default" : "ghost"}
          onClick={() => {
            setActiveTab("purchase");
          }}
          className="flex items-center gap-2"
        >
          <Truck className="h-4 w-4" />
          Purchase Orders
        </Button>
        <Button
          variant={activeTab === "credits" ? "default" : "ghost"}
          onClick={() => {
            setActiveTab("credits");
            loadCreditReportData();
          }}
          className="flex items-center gap-2"
        >
          <CreditCard className="h-4 w-4" />
          Credit Collection
        </Button>
        <Button
          variant={activeTab === "orders" ? "default" : "ghost"}
          onClick={() => {
            setActiveTab("orders");
            loadOrdersReportData();
          }}
          className="flex items-center gap-2"
        >
          <ShoppingBag className="h-4 w-4" />
          Orders (Mobile)
        </Button>
      </motion.div>

      {(activeTab === "sales" || activeTab === "purchase" || activeTab === "credits" || activeTab === "orders") && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {activeTab === "sales" ? "Sales Report Filters" : activeTab === "purchase" ? "Purchase Order Filters" : activeTab === "credits" ? "Credit Collection Filters" : "Order Report Filters"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`grid gap-4 ${activeTab === "sales" ? "md:grid-cols-4" : activeTab === "purchase" ? "md:grid-cols-6" : activeTab === "orders" ? "md:grid-cols-4" : "md:grid-cols-6"}`}>
                {activeTab === "sales" ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="reportType">Report Type</Label>
                      <Select value={reportType} onValueChange={setReportType}>
                        <SelectTrigger id="reportType">
                          <SelectValue placeholder="Select report type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly Report</SelectItem>
                          <SelectItem value="daily">Daily Report</SelectItem>
                          <SelectItem value="userwise">User-wise Report</SelectItem>
                          <SelectItem value="detailed">Bill Detailed Report</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dateFrom">From Date</Label>
                      <Input
                        id="dateFrom"
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dateTo">To Date</Label>
                      <Input
                        id="dateTo"
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                      />
                    </div>

                    {reportType === "userwise" && canFilterByUser ? (
                      <div className="space-y-2">
                        <Label htmlFor="user">User</Label>
                        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                          <SelectTrigger id="user">
                            <SelectValue placeholder="All Users" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Users</SelectItem>
                            {users.map((userItem) => (
                              <SelectItem key={userItem._id} value={userItem._id}>
                                {formatUserDisplayName(userItem)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Export</Label>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => handleExport("pdf")}
                            className="flex-1"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            PDF
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleExport("excel")}
                            className="flex-1"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Excel
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : activeTab === "purchase" ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="poReportType">Report Type</Label>
                      <Select value={poReportType} onValueChange={setPoReportType}>
                        <SelectTrigger id="poReportType">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly Report</SelectItem>
                          <SelectItem value="daily">Daily Report</SelectItem>
                          <SelectItem value="supplierwise">Supplier-wise Report</SelectItem>
                          <SelectItem value="storewise">Store-wise Report</SelectItem>
                          <SelectItem value="stock">Stock with Batches</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="poViewMode">View</Label>
                      <Select value={poViewMode} onValueChange={setPoViewMode}>
                        <SelectTrigger id="poViewMode">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="summary">Summary</SelectItem>
                          <SelectItem value="detailed">Detailed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="poDateFrom">From Date</Label>
                      <Input
                        id="poDateFrom"
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="poDateTo">To Date</Label>
                      <Input
                        id="poDateTo"
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="supplier">Supplier</Label>
                      <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                        <SelectTrigger id="supplier">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Suppliers</SelectItem>
                          {suppliers.map((supplier) => (
                            <SelectItem key={supplier._id} value={supplier._id}>
                              {supplier.companyName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="store">Store</Label>
                      <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                        <SelectTrigger id="store">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Stores</SelectItem>
                          {stores.map((store) => (
                            <SelectItem key={store._id} value={store._id}>
                              {store.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {poReportType === "stock" && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="stockCategory">Category</Label>
                          <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                            <SelectTrigger id="stockCategory">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Categories</SelectItem>
                              {categories.map((category) => (
                                <SelectItem key={category._id} value={category._id}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="stockSearch">Search</Label>
                          <Input
                            id="stockSearch"
                            placeholder="Search by item name or SKU..."
                            value={stockSearch}
                            onChange={(e) => setStockSearch(e.target.value)}
                          />
                        </div>
                      </>
                    )}
                  </>
                ) : activeTab === "credits" ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="creditTypeFilter">Credit Type</Label>
                      <Select value={creditTypeFilter} onValueChange={setCreditTypeFilter}>
                        <SelectTrigger id="creditTypeFilter">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="po">PO Credit</SelectItem>
                          <SelectItem value="billing">Billing Credit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="creditViewMode">Report View</Label>
                      <Select value={creditViewMode} onValueChange={setCreditViewMode}>
                        <SelectTrigger id="creditViewMode">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="summary">Summary Report</SelectItem>
                          <SelectItem value="detailed">Detailed Report</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="creditDateFrom">From Date</Label>
                      <Input
                        id="creditDateFrom"
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="creditDateTo">To Date</Label>
                      <Input
                        id="creditDateTo"
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                      />
                    </div>

                    {creditTypeFilter === "po" && (
                      <div className="space-y-2">
                        <Label htmlFor="creditSupplier">Supplier</Label>
                        <Select value={selectedCreditSupplierId} onValueChange={setSelectedCreditSupplierId}>
                          <SelectTrigger id="creditSupplier">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Suppliers</SelectItem>
                            {suppliers.map((supplier) => (
                              <SelectItem key={supplier._id} value={supplier._id}>
                                {supplier.companyName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="creditStatus">Status</Label>
                      <Select value={creditStatusFilter} onValueChange={setCreditStatusFilter}>
                        <SelectTrigger id="creditStatus">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="partially_paid">Partially Paid</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Export</Label>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => handleExport("pdf")}
                          className="flex-1"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          PDF
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleExport("excel")}
                          className="flex-1"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Excel
                        </Button>
                      </div>
                    </div>
                  </>
                ) : activeTab === "orders" ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="ordersDateFrom">From Date</Label>
                      <Input
                        id="ordersDateFrom"
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ordersDateTo">To Date</Label>
                      <Input
                        id="ordersDateTo"
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ordersStatus">Status</Label>
                      <Select value={ordersStatusFilter} onValueChange={setOrdersStatusFilter}>
                        <SelectTrigger id="ordersStatus">
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="inprogress">In Progress</SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* No sub-tabs needed; handled by report type selector */}

      {/* Sales Reports */}
      {activeTab === "sales" && reportData && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6 min-w-0">
            <MetricCard
              title="Total Revenue"
              value={`₹${reportData.summary.totalRevenue}`}
              icon={DollarSign}
              delay={0.1}
            />
            <MetricCard
              title="Total Bills"
              value={reportData.summary.totalBills}
              icon={FileText}
              delay={0.2}
            />
            <MetricCard
              title="Total Items Sold"
              value={reportData.summary.totalItems}
              icon={BarChart3}
              delay={0.3}
            />
            <MetricCard
              title="Average Bill"
              value={`₹${reportData.summary.averageBill}`}
              icon={TrendingUp}
              delay={0.4}
            />
          </div>

          {reportType !== "detailed" && reportData.chartData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 min-w-0">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="min-w-0"
              >
                <Card className="overflow-hidden">
                  <CardHeader className="px-3 sm:px-6 py-4">
                    <CardTitle className="text-base sm:text-lg">
                      {reportType === "monthly" && "Monthly Revenue"}
                      {reportType === "daily" && "Daily Revenue"}
                      {reportType === "userwise" && "User-wise Revenue"}
                      {reportType === "detailed" && "Bill Detailed Report"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 sm:px-4 md:px-6 pb-6 pt-0">
                    {reportType === "detailed" ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Select date range and click "Generate Report" to view detailed bills
                      </div>
                    ) : (
                      <div className="w-full min-w-0 h-[280px] sm:h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        {reportType === "userwise" ? (
                          <PieChart>
                            <Pie
                              data={reportData.chartData}
                              dataKey="revenue"
                              nameKey="user"
                              cx="50%"
                              cy="50%"
                              outerRadius={100}
                              label
                            >
                              {reportData.chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        ) : (
                          <BarChart data={reportData.chartData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis
                              dataKey={reportType === "monthly" ? "month" : "day"}
                              className="text-xs"
                              angle={reportType === "daily" ? -45 : 0}
                              textAnchor={reportType === "daily" ? "end" : "middle"}
                            />
                            <YAxis className="text-xs" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "var(--radius)",
                              }}
                            />
                            <Bar dataKey="revenue" fill="hsl(239 70% 55%)" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="min-w-0"
              >
                <Card className="overflow-hidden">
                  <CardHeader className="px-3 sm:px-6 py-4">
                    <CardTitle className="text-base sm:text-lg">
                      {reportType === "monthly" && "Monthly Bills Trend"}
                      {reportType === "daily" && "Daily Bills Trend"}
                      {reportType === "userwise" && "User-wise Bills"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 sm:px-4 md:px-6 pb-6 pt-0">
                    <div className="w-full min-w-0 h-[280px] sm:h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      {reportType === "userwise" ? (
                        <BarChart data={reportData.chartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            dataKey="user"
                            className="text-xs"
                            angle={-45}
                            textAnchor="end"
                          />
                          <YAxis className="text-xs" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "var(--radius)",
                            }}
                          />
                          <Bar dataKey="bills" fill="hsl(142 76% 45%)" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      ) : (
                        <LineChart data={reportData.chartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            dataKey={reportType === "monthly" ? "month" : "day"}
                            className="text-xs"
                            angle={reportType === "daily" ? -45 : 0}
                            textAnchor={reportType === "daily" ? "end" : "middle"}
                          />
                          <YAxis className="text-xs" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "var(--radius)",
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="bills"
                            stroke="hsl(142 76% 45%)"
                            strokeWidth={2}
                          />
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          )}

          {reportType === "detailed" && detailedBills.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Bill Detailed Report</CardTitle>
                  <div className="text-sm text-muted-foreground mt-2">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, detailedBills.length)} of {detailedBills.length} bills
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">S.No</TableHead>
                          <TableHead>Bill Number</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Customer Name</TableHead>
                          <TableHead>Customer Phone</TableHead>
                          <TableHead>Address</TableHead>
                          <TableHead>GSTIN</TableHead>
                          <TableHead>Payment Method</TableHead>
                          <TableHead>Payment Status</TableHead>
                          <TableHead>Items</TableHead>
                          <TableHead className="text-right">Subtotal (₹)</TableHead>
                          <TableHead className="text-right">Discount (₹)</TableHead>
                          <TableHead className="text-right">Tax (₹)</TableHead>
                          <TableHead className="text-right">Total (₹)</TableHead>
                          <TableHead>Created By</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailedBills
                          .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                          .map((bill, index) => {
                          const billDate = bill.date ? new Date(bill.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A';
                          const items = bill.items || [];
                          // Calculate total quantity of items
                          const totalItemQuantity = items.reduce((sum, item) => {
                            const qty = Number(item.quantity || item.qty || item.Quantity || 0);
                            return sum + qty;
                          }, 0);
                          const itemsDisplay = items.length > 0 
                            ? items.map(item => {
                                const itemName = item.itemName || item.item_name || item.name || 'N/A';
                                const qty = Number(item.quantity || item.qty || item.Quantity || 0);
                                return `${itemName} (Qty: ${qty})`;
                              }).join(', ')
                            : 'No items';
                          const serialNo = (currentPage - 1) * itemsPerPage + index + 1;
                          
                          return (
                            <TableRow key={bill.id || bill._id}>
                              <TableCell className="text-center">{serialNo}</TableCell>
                              <TableCell className="font-medium">{bill.billNo || bill.bill_no || 'N/A'}</TableCell>
                              <TableCell>{billDate}</TableCell>
                              <TableCell>{bill.customerName || bill.customer_name || 'N/A'}</TableCell>
                              <TableCell>{bill.customerPhone || bill.customer_phone || 'N/A'}</TableCell>
                              <TableCell className="max-w-xs truncate">{bill.customerAddress || bill.customer_address || 'N/A'}</TableCell>
                              <TableCell>{bill.customerGstin || bill.customer_gstin || 'N/A'}</TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {(bill.paymentMethod || bill.payment_method || 'N/A').toUpperCase()}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant={bill.paymentStatus === 'paid' ? 'default' : bill.paymentStatus === 'pending' ? 'destructive' : 'secondary'}
                                >
                                  {(bill.paymentStatus || bill.payment_status || 'N/A').toUpperCase()}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-md">
                                <div className="text-xs" title={itemsDisplay}>
                                  {items.length > 0 ? (
                                    <>
                                      {items.length} item type(s), Total Qty: {totalItemQuantity}
                                    </>
                                  ) : 'No items'}
                                </div>
                                {items.length > 0 && (
                                  <details className="mt-1">
                                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                                      View items
                                    </summary>
                                    <div className="mt-2 space-y-1 text-xs">
                                      {items.map((item, idx) => {
                                        const itemName = item.itemName || item.item_name || item.name || 'N/A';
                                        const qty = Number(item.quantity || item.qty || item.Quantity || 0);
                                        const unitPrice = Number(item.unitPrice || item.unit_price || item.price || 0);
                                        const itemTotal = Number(item.total || item.subtotal || (qty * unitPrice) || 0);
                                        return (
                                          <div key={idx} className="border-l-2 pl-2">
                                            <div className="font-medium">{itemName}</div>
                                            <div className="text-muted-foreground">
                                              Qty: {qty} × ₹{unitPrice.toFixed(2)} = ₹{itemTotal.toFixed(2)}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </details>
                                )}
                              </TableCell>
                              <TableCell className="text-right">₹{Number(bill.subtotal || 0).toFixed(2)}</TableCell>
                              <TableCell className="text-right">₹{Number(bill.discount || 0).toFixed(2)}</TableCell>
                              <TableCell className="text-right">₹{Number(bill.tax || 0).toFixed(2)}</TableCell>
                              <TableCell className="text-right font-semibold">₹{Number(bill.total || 0).toFixed(2)}</TableCell>
                              <TableCell>
                                {bill.userName || 
                                 (bill.user_first_name && bill.user_last_name 
                                   ? `${bill.user_first_name} ${bill.user_last_name}`.trim()
                                   : bill.user_email) || 
                                 'N/A'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Pagination Controls */}
                  {detailedBills.length > itemsPerPage && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-muted-foreground">
                        Page {currentPage} of {Math.ceil(detailedBills.length / itemsPerPage)}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.min(Math.ceil(detailedBills.length / itemsPerPage), prev + 1))}
                          disabled={currentPage >= Math.ceil(detailedBills.length / itemsPerPage)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {reportType !== "detailed" && reportData.tableData.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Detailed Sales Report</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">S.No</TableHead>
                          <TableHead>
                            {reportType === "monthly" && "Month"}
                            {reportType === "daily" && "Date"}
                            {reportType === "userwise" && "User"}
                          </TableHead>
                          {reportType === "userwise" && <TableHead>Email</TableHead>}
                          <TableHead className="text-right">Revenue (₹)</TableHead>
                          <TableHead className="text-right">Bills</TableHead>
                          <TableHead className="text-right">Items</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.tableData.map((row, index) => (
                          <TableRow key={index}>
                            <TableCell className="text-center">{index + 1}</TableCell>
                            <TableCell className="font-medium">
                              {reportType === "monthly" && row.month}
                              {reportType === "daily" && row.day}
                              {reportType === "userwise" && row.user}
                            </TableCell>
                            {reportType === "userwise" && <TableCell className="text-muted-foreground">{row.email || "N/A"}</TableCell>}
                            <TableCell className="text-right">₹{row.revenue.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{row.bills}</TableCell>
                            <TableCell className="text-right">{row.items}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </>
      )}

      {/* Purchase Order Reports */}
      {activeTab === "purchase" && poReportType !== "stock" && poReportData && (
        <>
          {/* Summary Metrics - Always show */}
          <div className="grid md:grid-cols-4 gap-4 md:gap-6">
            <MetricCard
              title="Total POs"
              value={poReportData.summary.totalPOs}
              icon={FileText}
              delay={0.1}
            />
            <MetricCard
              title="Total Value"
              value={`₹${poReportData.summary.totalValue}`}
              icon={DollarSign}
              delay={0.2}
            />
            <MetricCard
              title="Total Items"
              value={poReportData.summary.totalItems}
              icon={Package}
              delay={0.3}
            />
            <MetricCard
              title="Average PO Value"
              value={`₹${poReportData.summary.averagePOValue}`}
              icon={TrendingUp}
              delay={0.4}
            />
          </div>

          <div className="grid md:grid-cols-3 gap-4 md:gap-6">
            <MetricCard
              title="Pending POs"
              value={poReportData.summary.pendingPOs}
              icon={Clock}
              delay={0.5}
            />
            <MetricCard
              title="Completed POs"
              value={poReportData.summary.completedPOs}
              icon={CheckCircle}
              delay={0.6}
            />
            <MetricCard
              title="Cancelled POs"
              value={poReportData.summary.cancelledPOs}
              icon={XCircle}
              delay={0.7}
            />
          </div>

          {/* Summary View - Charts and Summary Table */}
          {poViewMode === "summary" && poReportData.chartData.length > 0 && (
            <div className="grid lg:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {poReportType === "monthly" && "Monthly Purchase Orders"}
                      {poReportType === "daily" && "Daily Purchase Orders"}
                      {poReportType === "supplierwise" && "Supplier-wise Purchase Orders"}
                      {poReportType === "storewise" && "Store-wise Purchase Orders"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      {poReportType === "supplierwise" || poReportType === "storewise" ? (
                        <BarChart data={poReportData.chartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            dataKey={poReportType === "supplierwise" ? "supplier" : "store"}
                            className="text-xs"
                            angle={-45}
                            textAnchor="end"
                          />
                          <YAxis className="text-xs" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "var(--radius)",
                            }}
                          />
                          <Bar dataKey="value" fill="hsl(239 70% 55%)" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      ) : (
                        <BarChart data={poReportData.chartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            dataKey={poReportType === "monthly" ? "month" : "day"}
                            className="text-xs"
                            angle={poReportType === "daily" ? -45 : 0}
                            textAnchor={poReportType === "daily" ? "end" : "middle"}
                          />
                          <YAxis className="text-xs" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "var(--radius)",
                            }}
                          />
                          <Bar dataKey="value" fill="hsl(239 70% 55%)" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>{poReportType === "storewise" ? "Store-wise Purchase Orders" : "Supplier-wise Purchase Orders"}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={poReportType === "storewise" ? poReportData.chartData : poReportData.supplierData}
                          dataKey="value"
                          nameKey={poReportType === "storewise" ? "store" : "supplier"}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label
                        >
                          {(poReportType === "storewise" ? poReportData.chartData : poReportData.supplierData).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          )}

          {poViewMode === "summary" && poReportData.tableData.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>
                    {poReportType === "monthly" && "Monthly Purchase Order Summary"}
                    {poReportType === "daily" && "Daily Purchase Order Summary"}
                    {poReportType === "supplierwise" && "Supplier-wise Purchase Order Summary"}
                    {poReportType === "storewise" && "Store-wise Purchase Order Summary"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">S.No</TableHead>
                          {poReportType === "monthly" && <TableHead>Month</TableHead>}
                          {poReportType === "daily" && <TableHead>Date</TableHead>}
                          {poReportType === "supplierwise" && <TableHead>Supplier</TableHead>}
                          {poReportType === "storewise" && <TableHead>Store</TableHead>}
                          <TableHead className="text-right">POs</TableHead>
                          <TableHead className="text-right">Total Value (₹)</TableHead>
                          <TableHead className="text-right">Items</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {poReportData.tableData.map((row, index) => (
                          <TableRow key={index}>
                            <TableCell className="text-center">{index + 1}</TableCell>
                            <TableCell className="font-medium">
                              {poReportType === "monthly" && row.month}
                              {poReportType === "daily" && row.day}
                              {poReportType === "supplierwise" && row.supplier}
                              {poReportType === "storewise" && row.store}
                            </TableCell>
                            <TableCell className="text-right">{row.pos || 0}</TableCell>
                            <TableCell className="text-right">₹{(row.value || 0).toFixed(2)}</TableCell>
                            <TableCell className="text-right">{row.items || 0}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {poReportType === "storewise" && selectedStoreId !== "all" && stockWithBatches.length > 0 && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>Items with Batches available for selected store</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">S.No</TableHead>
                            <TableHead>Item Name</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Subcategory</TableHead>
                            <TableHead>Batch Number</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead>PO Number</TableHead>
                            <TableHead>Purchase Order Date</TableHead>
                            <TableHead className="text-right">Cost Price (₹)</TableHead>
                            <TableHead>HSN Number</TableHead>
                            <TableHead>Expiry Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stockWithBatches.map((stock, index) => (
                            <TableRow key={`${stock.sku}-${stock.batchNumber}-${index}`}>
                              <TableCell className="text-center">{index + 1}</TableCell>
                              <TableCell className="font-medium">{stock.itemName}</TableCell>
                              <TableCell>{stock.sku}</TableCell>
                              <TableCell>{stock.categoryName}</TableCell>
                              <TableCell>{stock.subcategoryName}</TableCell>
                              <TableCell>{stock.batchNumber}</TableCell>
                              <TableCell className="text-right">{stock.batchQuantity}</TableCell>
                              <TableCell>{stock.purchaseOrderNumber}</TableCell>
                              <TableCell>
                                {stock.purchaseDate
                                  ? new Date(stock.purchaseDate).toLocaleDateString()
                                  : 'N/A'}
                              </TableCell>
                              <TableCell className="text-right">₹{stock.costPrice.toFixed(2)}</TableCell>
                              <TableCell>{stock.hsnNumber}</TableCell>
                              <TableCell>
                                {stock.expiryDate
                                  ? new Date(stock.expiryDate).toLocaleDateString('en-GB', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric'
                                  })
                                  : 'N/A'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
              {poReportType === "storewise" && selectedStoreId !== "all" && stockWithBatches.length === 0 && !stockLoading && (
                <Card className="mt-4">
                  <CardContent className="pt-6">
                    <div className="text-center py-12">
                      <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No items available for this store</h3>
                      <p className="text-muted-foreground">No batches found for the selected store</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}

          {/* Detailed View - Detailed PO Table */}
          {poViewMode === "detailed" && poReportData.rawData && poReportData.rawData.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Detailed Purchase Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">S.No</TableHead>
                          <TableHead>PO Number</TableHead>
                          <TableHead>Supplier</TableHead>
                          <TableHead>Order Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Items</TableHead>
                          <TableHead className="text-right">Total Value (₹)</TableHead>
                          <TableHead>Created By</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {poReportData.rawData.map((po, index) => (
                          <TableRow key={po._id || index}>
                            <TableCell className="text-center">{index + 1}</TableCell>
                            <TableCell className="font-medium">{po.poNumber}</TableCell>
                            <TableCell>{po.supplier?.companyName || 'Unknown'}</TableCell>
                            <TableCell>{new Date(po.orderDate).toLocaleDateString()}</TableCell>
                            <TableCell>{getStatusBadge(po.status)}</TableCell>
                            <TableCell className="text-right">{po.totalQuantity || 0}</TableCell>
                            <TableCell className="text-right">₹{(po.total || 0).toFixed(2)}</TableCell>
                            <TableCell>{po.createdBy?.firstName ? `${po.createdBy.firstName} ${po.createdBy.lastName}` : 'Unknown'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </>
      )}

      {/* Stock with Batch Numbers Report */}
      {activeTab === "purchase" && poReportType === "stock" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Stock with Batch Numbers
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Search by item name or SKU..."
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                    className="w-64"
                  />
                  <Search className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {stockLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-600 mt-2">Loading stock data...</p>
                </div>
              ) : stockWithBatches.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">S.No</TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Subcategory</TableHead>
                        <TableHead>Batch Number</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead>PO Number</TableHead>
                        <TableHead>Purchase Order Date</TableHead>
                        <TableHead className="text-right">Cost Price (₹)</TableHead>
                        <TableHead>HSN Number</TableHead>
                        <TableHead>Expiry Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockWithBatches.map((stock, index) => (
                        <TableRow key={`${stock.sku}-${stock.batchNumber}-${index}`}>
                          <TableCell className="text-center">{index + 1}</TableCell>
                          <TableCell className="font-medium">{stock.itemName}</TableCell>
                          <TableCell>{stock.sku}</TableCell>
                          <TableCell>{stock.categoryName}</TableCell>
                          <TableCell>{stock.subcategoryName}</TableCell>
                          <TableCell>{stock.batchNumber}</TableCell>
                          <TableCell className="text-right">{stock.batchQuantity}</TableCell>
                          <TableCell>{stock.purchaseOrderNumber}</TableCell>
                          <TableCell>
                            {stock.purchaseDate
                              ? new Date(stock.purchaseDate).toLocaleDateString()
                              : 'N/A'}
                          </TableCell>
                          <TableCell className="text-right">₹{stock.costPrice.toFixed(2)}</TableCell>
                          <TableCell>{stock.hsnNumber}</TableCell>
                          <TableCell>
                            {stock.expiryDate
                              ? new Date(stock.expiryDate).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              })
                              : 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No stock data available</h3>
                  <p className="text-muted-foreground">Try adjusting your search to see data</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {loading && activeTab === "sales" && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading sales data...</p>
        </div>
      )}
      {loading && activeTab === "purchase" && poReportType !== "stock" && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading purchase order data...</p>
        </div>
      )}

      {ordersReportLoading && activeTab === "orders" && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading orders data...</p>
        </div>
      )}

      {!loading && activeTab === "sales" && (!reportData || reportData.tableData.length === 0) && (
        <div className="text-center py-12">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No sales data available</h3>
          <p className="text-muted-foreground">Try adjusting your filters to see data</p>
        </div>
      )}

      {!loading && activeTab === "purchase" && poReportType !== "stock" && !poReportData && (
        <div className="text-center py-12">
          <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No purchase order data available</h3>
          <p className="text-muted-foreground">Try adjusting your filters to see data</p>
        </div>
      )}

      {!ordersReportLoading && activeTab === "orders" && filteredMobileOrders.length === 0 && (
        <div className="text-center py-12">
          <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No orders found</h3>
          <p className="text-muted-foreground">Try adjusting date range or status filter</p>
        </div>
      )}

      {/* Orders (Mobile) Report */}
      {activeTab === "orders" && !ordersReportLoading && filteredMobileOrders.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-4 items-stretch">
            <MetricCard title="Total Orders" value={ordersReportMetrics.totalOrders} icon={ShoppingBag} delay={0.1} />
            <MetricCard title="Total Order Value" value={formatCurrencyValue(ordersReportMetrics.totalAmount)} icon={DollarSign} delay={0.2} />
            <MetricCard title="Delivered Orders" value={ordersReportMetrics.deliveredCount} icon={CheckCircle} delay={0.3} />
            <MetricCard title="Delivered Value" value={formatCurrencyValue(ordersReportMetrics.deliveredAmount)} icon={TrendingUp} delay={0.4} />
            <MetricCard title="Pending Orders" value={ordersReportMetrics.pendingCount} icon={Clock} delay={0.5} />
            <MetricCard title="Cancelled Orders" value={ordersReportMetrics.cancelledCount} icon={XCircle} delay={0.6} />
          </div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" />
                  Orders breakdown ({filteredMobileOrders.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Order Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                        <TableHead className="text-right">GST</TableHead>
                        <TableHead className="text-right">Delivery</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMobileOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.id}</TableCell>
                          <TableCell>{order.customerName || `User ${order.userId}` || "-"}</TableCell>
                          <TableCell>{order.customerPhone || "-"}</TableCell>
                          <TableCell>{formatDateValue(order.orderDate || order.createdAt, true)}</TableCell>
                          <TableCell>
                            <Badge className={ORDERS_STATUS_COLORS[order.status] || "bg-gray-100 text-gray-800"}>
                              {order.status || "pending"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrencyValue(order.subtotal)}</TableCell>
                          <TableCell className="text-right">{formatCurrencyValue(order.gst)}</TableCell>
                          <TableCell className="text-right">{formatCurrencyValue(order.delivery)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrencyValue(order.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}

      {/* Credit Collection Report */}
      {activeTab === "credits" && creditReportData && (
        <>
          {creditViewMode === "summary" && (
            <>
              <div className="grid md:grid-cols-4 gap-4 md:gap-6">
                <MetricCard
                  title="Total Credits"
                  value={creditReportData.summary.totalCredits}
                  icon={CreditCard}
                  delay={0.1}
                />
                <MetricCard
                  title="Total Original Amount"
                  value={`₹${creditReportData.summary.totalOriginalAmount}`}
                  icon={DollarSign}
                  delay={0.2}
                />
                <MetricCard
                  title="Total Paid Amount"
                  value={`₹${creditReportData.summary.totalPaidAmount}`}
                  icon={CheckCircle}
                  delay={0.3}
                />
                <MetricCard
                  title="Total Balance"
                  value={`₹${creditReportData.summary.totalBalanceAmount}`}
                  icon={TrendingUp}
                  delay={0.4}
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4 md:gap-6">
                <MetricCard
                  title="Pending Credits"
                  value={creditReportData.summary.pendingCount}
                  icon={Clock}
                  delay={0.5}
                />
                <MetricCard
                  title="Partially Paid"
                  value={creditReportData.summary.partiallyPaidCount}
                  icon={Package}
                  delay={0.6}
                />
                <MetricCard
                  title="Fully Paid"
                  value={creditReportData.summary.paidCount}
                  icon={CheckCircle}
                  delay={0.7}
                />
              </div>

              {creditReportData.groupData.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle>{creditTypeFilter === "po" ? "Supplier-wise Credit Summary" : "Customer-wise Credit Summary"}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">S.No</TableHead>
                              <TableHead>{creditTypeFilter === "po" ? "Supplier" : "Customer"}</TableHead>
                              <TableHead className="text-right">Credits</TableHead>
                              <TableHead className="text-right">Original Amount (₹)</TableHead>
                              <TableHead className="text-right">Paid Amount (₹)</TableHead>
                              <TableHead className="text-right">Balance (₹)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {creditReportData.groupData.map((item, index) => (
                              <TableRow key={index}>
                                <TableCell className="text-center">{index + 1}</TableCell>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell className="text-right">{item.credits}</TableCell>
                                <TableCell className="text-right">₹{item.totalOriginalAmount}</TableCell>
                                <TableCell className="text-right">₹{item.totalPaidAmount}</TableCell>
                                <TableCell className="text-right font-semibold text-blue-600">
                                  ₹{item.totalBalanceAmount}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </>
          )}

          {creditViewMode === "detailed" && creditReportData.tableData.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Detailed Credit Collection Report</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">S.No</TableHead>
                          {creditTypeFilter === "po" ? (
                            <>
                              <TableHead>PO Number</TableHead>
                              <TableHead>Supplier</TableHead>
                              <TableHead>Order Date</TableHead>
                            </>
                          ) : (
                            <>
                              <TableHead>Bill Number</TableHead>
                              <TableHead>Customer</TableHead>
                              <TableHead>Customer Phone</TableHead>
                              <TableHead>Bill Date</TableHead>
                            </>
                          )}
                          <TableHead className="text-right">Initial Amount (₹)</TableHead>
                          <TableHead className="text-right">Current Amount (₹)</TableHead>
                          <TableHead className="text-right">Discount (₹)</TableHead>
                          <TableHead className="text-right">Paid Amount (₹)</TableHead>
                          <TableHead className="text-right">Balance (₹)</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="min-w-[250px]">Amount Edit History</TableHead>
                          <TableHead>Payment Mode</TableHead>
                          <TableHead className="min-w-[200px]">Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {creditReportData.tableData.map((credit, index) => {
                          // Get initial amount - check multiple possible fields
                          // Priority: initialOriginalAmount > purchaseOrder.total > originalAmount
                          let initialAmount = credit.originalAmount || 0;
                          if (credit.initialOriginalAmount !== undefined && credit.initialOriginalAmount !== null && credit.initialOriginalAmount !== 0) {
                            initialAmount = credit.initialOriginalAmount;
                          } else if (credit.purchaseOrder?.total !== undefined && credit.purchaseOrder?.total !== null) {
                            // If no initialOriginalAmount, try to get from PO total
                            initialAmount = credit.purchaseOrder.total;
                          }

                          // Get current amount
                          const currentAmount = credit.originalAmount || 0;

                          // Sort amount change history by date (newest first)
                          let sortedAmountChanges = credit.amountChangeHistory && credit.amountChangeHistory.length > 0
                            ? [...credit.amountChangeHistory].sort((a, b) => {
                              const dateA = new Date(a.changeDate || a.createdAt || 0);
                              const dateB = new Date(b.changeDate || b.createdAt || 0);
                              return dateB - dateA; // Newest first
                            })
                            : [];

                          // Check if we need to show the initial amount change
                          // This handles cases where amount was changed but history wasn't recorded
                          const hasAmountChange = Math.abs(initialAmount - currentAmount) > 0.01; // Use small epsilon for float comparison

                          if (hasAmountChange) {
                            // If we have history, check if the first entry starts from the initial amount
                            if (sortedAmountChanges.length > 0) {
                              const firstChange = sortedAmountChanges[sortedAmountChanges.length - 1]; // Oldest entry
                              // If the first change doesn't start from initial amount, prepend it
                              if (Math.abs(firstChange.previousAmount - initialAmount) > 0.01) {
                                sortedAmountChanges.push({
                                  previousAmount: initialAmount,
                                  updatedAmount: firstChange.previousAmount,
                                  changeDate: credit.orderDate || credit.billDate || credit.createdAt || new Date(),
                                  notes: 'Initial amount',
                                  changedBy: credit.createdBy || null
                                });
                                // Re-sort after adding
                                sortedAmountChanges.sort((a, b) => {
                                  const dateA = new Date(a.changeDate || a.createdAt || 0);
                                  const dateB = new Date(b.changeDate || b.createdAt || 0);
                                  return dateB - dateA;
                                });
                              }
                            } else {
                              // No history but amount changed - show the change
                              sortedAmountChanges = [{
                                previousAmount: initialAmount,
                                updatedAmount: currentAmount,
                                changeDate: credit.orderDate || credit.billDate || credit.createdAt || credit.updatedAt || new Date(),
                                notes: credit.initialOriginalAmount !== undefined ? 'Amount changed' : 'Initial amount',
                                changedBy: credit.createdBy || credit.updatedBy || null
                              }];
                            }
                          }

                          // Get payment modes from payment history only (actual payments made)
                          const paymentModes = credit.paymentHistory && credit.paymentHistory.length > 0
                            ? [...credit.paymentHistory]
                                .map(p => {
                                  // Support both camelCase and snake_case, default to 'cash' if missing
                                  const mode = p.paymentMode || p.payment_mode || 'cash';
                                  return mode;
                                })
                                .filter(mode => mode && mode !== 'credit') // Filter out 'credit' as it's the bill type, not a payment mode
                                .filter((mode, index, self) => self.indexOf(mode) === index) // Get unique modes
                            : [];

                          // Get notes from payment history
                          const paymentNotes = credit.paymentHistory && credit.paymentHistory.length > 0
                            ? [...credit.paymentHistory]
                                .map(p => p.notes || '')
                                .filter(note => note && note.trim() !== '')
                            : [];

                          return (
                            <TableRow key={credit._id || index}>
                              <TableCell className="text-center">{index + 1}</TableCell>
                              {creditTypeFilter === "po" ? (
                                <>
                                  <TableCell className="font-medium">{credit.poNumber}</TableCell>
                                  <TableCell>{credit.supplier?.companyName || credit.supplierName || 'Unknown'}</TableCell>
                                  <TableCell>
                                    {credit.orderDate
                                      ? new Date(credit.orderDate).toLocaleDateString('en-GB')
                                      : 'N/A'}
                                  </TableCell>
                                </>
                              ) : (
                                <>
                                  <TableCell className="font-medium">{credit.billNumber || 'N/A'}</TableCell>
                                  <TableCell>{credit.customerName || 'Unknown'}</TableCell>
                                  <TableCell>{credit.customerPhone || 'N/A'}</TableCell>
                                  <TableCell>
                                    {credit.billDate
                                      ? new Date(credit.billDate).toLocaleDateString('en-GB')
                                      : 'N/A'}
                                  </TableCell>
                                </>
                              )}
                              <TableCell className="text-right">
                                ₹{Math.round(initialAmount)}
                              </TableCell>
                              <TableCell className="text-right">
                                ₹{Math.round(currentAmount)}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-green-600">
                                ₹{Math.round(Math.max(0, initialAmount - currentAmount))}
                              </TableCell>
                              <TableCell className="text-right">
                                ₹{Math.round(credit.paidAmount || 0)}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-blue-600">
                                ₹{Math.round(credit.balanceAmount || 0)}
                              </TableCell>
                              <TableCell>
                                {credit.status === 'pending' && (
                                  <Badge variant="destructive">Pending</Badge>
                                )}
                                {credit.status === 'partially_paid' && (
                                  <Badge variant="default">Partially Paid</Badge>
                                )}
                                {credit.status === 'paid' && (
                                  <Badge variant="secondary">Paid</Badge>
                                )}
                              </TableCell>
                              <TableCell className="min-w-[250px] max-w-[350px]">
                                {sortedAmountChanges.length > 0 ? (
                                  <div className="text-xs space-y-2 max-h-64 overflow-y-auto pr-2">
                                    {sortedAmountChanges.map((change, idx) => (
                                      <div key={idx} className="border-l-2 border-green-500 pl-2 py-1.5 bg-green-50 dark:bg-green-950/20 rounded-r">
                                        <div className="font-medium text-green-700 dark:text-green-400">
                                          ₹{Math.round(change.previousAmount || 0)} → ₹{Math.round(change.updatedAmount || 0)}
                                        </div>
                                        <div className="text-muted-foreground text-xs mt-0.5">
                                          {change.changeDate
                                            ? new Date(change.changeDate).toLocaleDateString('en-GB', {
                                              day: '2-digit',
                                              month: '2-digit',
                                              year: 'numeric',
                                              hour: '2-digit',
                                              minute: '2-digit'
                                            })
                                            : 'N/A'}
                                        </div>
                                        {change.changedBy && (
                                          <div className="text-muted-foreground text-xs mt-0.5">
                                            by {change.changedBy.firstName || ''} {change.changedBy.lastName || ''}
                                          </div>
                                        )}
                                        {change.notes && (
                                          <div className="text-muted-foreground italic text-xs mt-1 pt-1 border-t border-green-200 dark:border-green-800">
                                            {change.notes}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs">Never edited</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {paymentModes.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {paymentModes.map((mode, idx) => (
                                      <Badge key={idx} variant="outline" className="text-xs">
                                        {mode.toUpperCase()}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs">N/A</span>
                                )}
                              </TableCell>
                              <TableCell className="min-w-[200px] max-w-[300px]">
                                {paymentNotes.length > 0 ? (
                                  <div className="text-xs space-y-1 max-h-48 overflow-y-auto pr-2">
                                    {paymentNotes.map((note, idx) => (
                                      <div key={idx} className="text-muted-foreground italic border-b border-gray-200 dark:border-gray-700 pb-1 last:border-b-0">
                                        {note}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs">N/A</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {creditLoading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading credit collection data...</p>
            </div>
          )}

          {!creditLoading && (!creditReportData || creditReportData.tableData.length === 0) && (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No credit data available</h3>
              <p className="text-muted-foreground">Try adjusting your filters to see data</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
