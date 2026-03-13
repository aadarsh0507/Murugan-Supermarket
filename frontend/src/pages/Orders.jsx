import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingBag, Search, RefreshCw, Calendar, MapPin, CreditCard, Package, User, Phone, RotateCcw, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
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
import { ordersAPI } from "@/services/api";
import { getErrorMessage, getErrorTitle } from "@/utils/errorMessages";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
  confirmed: "bg-blue-100 text-blue-800 hover:bg-blue-200",
  processing: "bg-purple-100 text-purple-800 hover:bg-purple-200",
  inprogress: "bg-indigo-100 text-indigo-800 hover:bg-indigo-200",
  "in-progress": "bg-indigo-100 text-indigo-800 hover:bg-indigo-200",
  delivered: "bg-green-100 text-green-800 hover:bg-green-200",
  cancelled: "bg-red-100 text-red-800 hover:bg-red-200",
};

const hasReturn = (order) => {
  const status = order?.returnStatus ?? order?.return_status;
  return Boolean(status && String(status).trim());
};

const getReturnImageSrc = (imageUrl) => {
  if (!imageUrl || typeof imageUrl !== "string") return null;
  const base = import.meta.env?.VITE_BACKEND_URL ?? "";
  const uploadsBase = base ? base.replace(/\/api\/?$/, "") : "";
  return imageUrl.startsWith("http") ? imageUrl : `${uploadsBase}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
};

const Orders = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = Boolean(user?.isAdmin);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [total, setTotal] = useState(0);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [deliveryCost, setDeliveryCost] = useState("");
  const [deliveryActive, setDeliveryActive] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnImageFile, setReturnImageFile] = useState(null);
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [showReturnRequestsDialog, setShowReturnRequestsDialog] = useState(false);
  const [returnRequestsList, setReturnRequestsList] = useState([]);
  const [loadingReturnRequests, setLoadingReturnRequests] = useState(false);
  const [selectedOrderReturnRequests, setSelectedOrderReturnRequests] = useState([]);

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  useEffect(() => {
    if (!showReturnRequestsDialog) return;
    let cancelled = false;
    setLoadingReturnRequests(true);
    setReturnRequestsList([]);
    ordersAPI
      .getReturnRequests()
      .then((res) => {
        if (cancelled) return;
        const data = res?.data ?? res ?? [];
        setReturnRequestsList(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) {
          toast({
            title: getErrorTitle(err),
            description: getErrorMessage(err, "Failed to load return requests", "return requests"),
            variant: "destructive",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingReturnRequests(false);
      });
    return () => { cancelled = true; };
  }, [showReturnRequestsDialog, toast]);

  useEffect(() => {
    if (!selectedOrder?.id) {
      setSelectedOrderReturnRequests([]);
      return;
    }
    let cancelled = false;
    ordersAPI
      .getReturnRequests({ orderId: selectedOrder.id })
      .then((res) => {
        if (cancelled) return;
        const data = res?.data ?? res ?? [];
        setSelectedOrderReturnRequests(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setSelectedOrderReturnRequests([]);
      });
    return () => { cancelled = true; };
  }, [selectedOrder?.id]);

  useEffect(() => {
    if (!isAdmin) return;
    const loadSettings = async () => {
      setLoadingSettings(true);
      try {
        const response = await ordersAPI.getDeliverySettings();
        const data = response?.data ?? response;
        setDeliveryNote(data?.deliveryNote ?? "");
        setDeliveryCost(
          data?.deliveryCost === null || data?.deliveryCost === undefined
            ? ""
            : String(data.deliveryCost)
        );
        setDeliveryActive(
          data?.isActive === undefined || data?.isActive === null
            ? true
            : Boolean(data.isActive)
        );
      } catch (error) {
        // Non-critical; just log and continue
        console.error("Failed to load delivery settings", error);
      } finally {
        setLoadingSettings(false);
      }
    };
    loadSettings();
  }, [isAdmin]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params = {
        limit: 100,
        offset: 0,
      };

      if (statusFilter !== "all") {
        params.status = statusFilter;
      }

      const response = await ordersAPI.getOrders(params);

      let ordersData = [];
      let totalRecords = 0;

      if (Array.isArray(response?.data)) {
        ordersData = response.data;
      } else if (response?.data?.orders) {
        ordersData = response.data.orders;
        totalRecords = response.data.pagination?.total ?? ordersData.length;
      } else if (response?.data?.data?.orders) {
        ordersData = response.data.data.orders;
        totalRecords = response.data.data.pagination?.total ?? ordersData.length;
      } else if (response?.data) {
        ordersData = Array.isArray(response.data.data)
          ? response.data.data
          : response.data.orders ?? [];
        totalRecords = response.data.pagination?.total ?? ordersData.length;
      }

      setOrders(ordersData ?? []);
      setTotal(totalRecords ?? ordersData.length ?? 0);
    } catch (error) {
      setOrders([]);
      setTotal(0);
      const serverMessage = error?.response?.data?.message;
      const description = serverMessage || getErrorMessage(error, "Failed to load orders", "orders");
      toast({
        title: getErrorTitle(error),
        description,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      const response = await ordersAPI.updateOrderStatus(orderId, newStatus);
      const isOk =
        response?.success === true ||
        response?.status === "success" ||
        response?.status === "ok";
      if (isOk) {
        toast({
          title: "Success",
          description: "Order status updated successfully",
        });
        loadOrders();
      }
    } catch (error) {
      console.error("Error updating order status:", error);
      toast({
        title: getErrorTitle(error),
        description: getErrorMessage(error, "Failed to update order status", "order status"),
        variant: "destructive",
      });
    }
  };

  const filteredOrders = orders.filter((order) => {
    const status = (order.status || "").toLowerCase();

    const matchesStatus =
      statusFilter === "all"
        ? status !== "delivered" && status !== "cancelled"
        : status === statusFilter;

    if (!matchesStatus) return false;

    if (fromDate || toDate) {
      const rawDate = order.orderDate || order.createdAt || order.created_at;
      if (!rawDate) return false;
      const orderDt = new Date(rawDate);
      if (Number.isNaN(orderDt.getTime())) return false;

      if (fromDate) {
        const from = new Date(`${fromDate}T00:00:00`);
        if (orderDt < from) return false;
      }

      if (toDate) {
        const to = new Date(`${toDate}T23:59:59.999`);
        if (orderDt > to) return false;
      }
    }

    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      order.id?.toString().includes(search) ||
      order.customerName?.toLowerCase().includes(search) ||
      order.customerPhone?.toLowerCase().includes(search) ||
      order.address?.toLowerCase().includes(search) ||
      order.paymentMethod?.toLowerCase().includes(search) ||
      order.total?.toString().includes(search)
    );
  });

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "dd MMM yyyy, hh:mm a");
    } catch (error) {
      return dateString;
    }
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return "₹0.00";
    return `₹${parseFloat(amount).toFixed(2)}`;
  };

  const handleOrderClick = async (order) => {
    try {
      const response = await ordersAPI.getOrder(order.id);
      const payload =
        response?.data?.order ??
        response?.data?.data?.order ??
        response?.data?.orderData ??
        response?.data?.order ??
        response?.data ??
        response;

      if (payload) {
        setSelectedOrder({
          ...payload,
          deliveryNote: payload.deliveryNote ?? payload.delivery_note ?? "",
          isActive: payload.isActive ?? payload.is_active ?? payload.active ?? true,
        });
        setReturnReason("");
        setReturnImageFile(null);
        setShowOrderDialog(true);
      }
    } catch (error) {
      console.error("Error fetching order details:", error);
      toast({
        title: getErrorTitle(error),
        description: getErrorMessage(error, "Failed to load order details", "order details"),
        variant: "destructive",
      });
    }
  };

  const handleSubmitReturn = async () => {
    if (!selectedOrder?.id) return;
    setSubmittingReturn(true);
    try {
      const formData = new FormData();
      if (returnReason.trim()) formData.append("returnReason", returnReason.trim());
      if (returnImageFile) formData.append("image", returnImageFile);
      const response = await ordersAPI.submitOrderReturn(selectedOrder.id, formData);
      const isOk =
        response?.success === true ||
        response?.status === "success" ||
        response?.status === "ok";
      if (isOk) {
        toast({ title: "Success", description: "Return recorded successfully." });
        setReturnReason("");
        setReturnImageFile(null);
        const updated = {
          ...selectedOrder,
          returnStatus: "returned",
          returnReason: returnReason.trim() || selectedOrder.returnReason,
          returnImageUrl: response?.data?.returnImageUrl ?? selectedOrder.returnImageUrl,
        };
        setSelectedOrder(updated);
        loadOrders();
      }
    } catch (error) {
      toast({
        title: getErrorTitle(error),
        description: getErrorMessage(error, "Failed to record return", "return"),
        variant: "destructive",
      });
    } finally {
      setSubmittingReturn(false);
    }
  };

  const handleSaveDeliverySettings = async () => {
    if (!isAdmin) return;
    setSavingSettings(true);
    try {
      const payload = {
        deliveryNote,
        deliveryCost:
          deliveryCost === "" || deliveryCost === null || deliveryCost === undefined
            ? null
            : Number(deliveryCost),
        isActive: deliveryActive,
      };
      const response = await ordersAPI.updateDeliverySettings(payload);
      const isOk =
        response?.success === true ||
        response?.status === "success" ||
        response?.status === "ok";
      if (isOk) {
        toast({
          title: "Success",
          description: "Delivery note updated successfully",
        });
      }
    } catch (error) {
      toast({
        title: getErrorTitle(error),
        description: getErrorMessage(
          error,
          "Failed to update delivery note",
          "delivery note"
        ),
        variant: "destructive",
      });
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 sm:h-8 sm:w-8" />
            Orders
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Manage orders from mobile app
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            onClick={() => {
              setShowReturnRequestsDialog(true);
            }}
            variant="outline"
            className="touch-target-y min-h-11 w-full sm:w-auto"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Return requests
          </Button>
          <Button
            onClick={() => navigate("/reports?tab=orders")}
            variant="outline"
            className="touch-target-y min-h-11 w-full sm:w-auto"
          >
            <ShoppingBag className="h-4 w-4 mr-2" />
            Order Reports
          </Button>
          <Button
            onClick={loadOrders}
            variant="outline"
            disabled={loading}
            className="touch-target-y min-h-11 w-full sm:w-auto"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Delivery settings for mobile app</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <span className="text-sm font-medium">Common delivery note</span>
              <Textarea
                rows={2}
                placeholder="This note will be shown for all deliveries in the mobile app."
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                disabled={loadingSettings}
              />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={deliveryActive}
                  onCheckedChange={(value) => setDeliveryActive(Boolean(value))}
                  disabled={loadingSettings}
                />
                <span className="text-sm">Show delivery note in mobile app</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Default delivery cost</span>
                <Input
                  type="number"
                  className="w-24"
                  value={deliveryCost}
                  onChange={(e) => setDeliveryCost(e.target.value)}
                  disabled={loadingSettings}
                />
              </div>
              <div className="ml-auto">
                <Button
                  size="sm"
                  onClick={handleSaveDeliverySettings}
                  disabled={savingSettings || loadingSettings}
                >
                  {savingSettings ? "Saving..." : "Save settings"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <CardTitle>All Orders ({total})</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-full sm:w-64"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All (hide done)</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="inprogress">In Progress</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full sm:w-40"
                placeholder="From date"
              />
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full sm:w-40"
                placeholder="To date"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && orders.length === 0 ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground mt-2">Loading orders...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No orders found</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Return</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-right">GST</TableHead>
                    <TableHead className="text-right">Delivery</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleOrderClick(order)}
                    >
                      <TableCell className="font-medium">{order.id}</TableCell>
                      <TableCell className="font-medium">
                        {order.customerName || `User ${order.userId}` || "-"}
                      </TableCell>
                      <TableCell>{order.customerPhone || "-"}</TableCell>
                      <TableCell className="max-w-xs truncate" title={order.address}>
                        {order.address || "-"}
                      </TableCell>
                      <TableCell>{formatDate(order.orderDate)}</TableCell>
                      <TableCell>{order.paymentMethod || "-"}</TableCell>
                      <TableCell>
                        <Badge
                          className={statusColors[order.status] || "bg-gray-100 text-gray-800"}
                        >
                          {order.status || "pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {hasReturn(order) ? (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800 gap-1">
                            <RotateCcw className="h-3 w-3" />
                            Returned
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(order.subtotal)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(order.gst)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(order.delivery)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(order.total)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={order.status}
                          onValueChange={(value) => handleStatusUpdate(order.id, value)}
                        >
                          <SelectTrigger className="w-32 min-h-9 touch-target-y">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="processing">Processing</SelectItem>
                            <SelectItem value="inprogress">In Progress</SelectItem>
                            <SelectItem value="delivered">Delivered</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Details Dialog */}
      <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
        <DialogContent className="w-[100vw] max-w-[100vw] h-[100vh] overflow-y-auto sm:w-[100vw] sm:max-w-[100vw] sm:h-[100vh]">
          <DialogHeader>
            <DialogTitle>Order Details - #{selectedOrder?.id}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              {/* Order Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Order Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Order ID:</span>
                      <span className="font-medium">#{selectedOrder.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">User ID:</span>
                      <span className="font-medium">{selectedOrder.userId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Order Date:</span>
                      <span className="font-medium">{formatDate(selectedOrder.orderDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge
                        className={
                          statusColors[selectedOrder.status] || "bg-gray-100 text-gray-800"
                        }
                      >
                        {selectedOrder.status || "pending"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Payment & Delivery
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payment Method:</span>
                      <span className="font-medium">{selectedOrder.paymentMethod || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span className="font-medium">{formatCurrency(selectedOrder.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">GST:</span>
                      <span className="font-medium">{formatCurrency(selectedOrder.gst)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivery:</span>
                      <span className="font-medium">{formatCurrency(selectedOrder.delivery)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="text-lg font-semibold">Total:</span>
                      <span className="text-lg font-bold">{formatCurrency(selectedOrder.total)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Customer & Address Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Customer Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      <span className="font-medium">Phone:</span> {selectedOrder.customerPhone || "-"}
                    </span>
                  </div>
                  {selectedOrder.customerEmail && (
                    <div className="text-sm">
                      <span className="font-medium">Email:</span> {selectedOrder.customerEmail}
                    </div>
                  )}
                  {selectedOrder.address && (
                    <div className="pt-2 border-t">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <span className="text-sm font-medium block mb-1">Delivery Address:</span>
                          <p className="text-sm text-muted-foreground">{selectedOrder.address}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Return requests from app + admin return or record return */}
              <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <RotateCcw className="h-5 w-5" />
                      Return requests (from app)
                      {selectedOrderReturnRequests.length > 0 && (
                        <Badge variant="secondary" className="ml-1">
                          {selectedOrderReturnRequests.length}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedOrderReturnRequests.length > 0 ? (
                      <div className="space-y-4">
                        {selectedOrderReturnRequests.map((req) => (
                          <div
                            key={req.id}
                            className="rounded-lg border p-3 space-y-2 bg-muted/30"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                className={
                                  req.status === "pending"
                                    ? "bg-amber-100 text-amber-800"
                                    : req.status === "approved"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-800"
                                }
                              >
                                {req.status || "pending"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(req.createdAt)} · User #{req.userId}
                              </span>
                            </div>
                            {req.reason && (
                              <p className="text-sm">
                                <span className="font-medium text-muted-foreground">Reason: </span>
                                {req.reason}
                              </p>
                            )}
                            {req.imageUrl && (
                              <div>
                                <span className="text-sm font-medium text-muted-foreground flex items-center gap-1 mb-1">
                                  <ImageIcon className="h-4 w-4" />
                                  Attached image
                                </span>
                                <div className="rounded-md border bg-background overflow-hidden inline-block max-w-full">
                                  <img
                                    src={getReturnImageSrc(req.imageUrl) || req.imageUrl}
                                    alt="Return"
                                    className="max-h-48 w-auto object-contain"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No return requests from the mobile app for this order.
                      </p>
                    )}
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium mb-2">Record return (admin)</h4>
                      {hasReturn(selectedOrder) ? (
                        <>
                          {selectedOrder.returnReason && (
                            <div>
                              <span className="text-sm font-medium text-muted-foreground">Reason: </span>
                              <p className="text-sm mt-1">{selectedOrder.returnReason}</p>
                            </div>
                          )}
                          {(selectedOrder.returnImageUrl || selectedOrder.return_image_url) && (
                            <div className="mt-2">
                              <span className="text-sm font-medium text-muted-foreground flex items-center gap-1 mb-2">
                                <ImageIcon className="h-4 w-4" />
                                Attached image
                              </span>
                              <div className="rounded-md border bg-muted/30 overflow-hidden inline-block max-w-full">
                                <img
                                  src={selectedOrder.returnImageUrl || selectedOrder.return_image_url}
                                  alt="Return attachment"
                                  className="max-h-64 w-auto object-contain"
                                />
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="space-y-1">
                            <label className="text-sm font-medium">Reason (optional)</label>
                            <Textarea
                              placeholder="e.g. Defective, wrong item, customer request"
                              value={returnReason}
                              onChange={(e) => setReturnReason(e.target.value)}
                              rows={2}
                              disabled={submittingReturn}
                            />
                          </div>
                          <div className="space-y-1 mt-2">
                            <label className="text-sm font-medium">Attach image (optional)</label>
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(e) => setReturnImageFile(e.target.files?.[0] ?? null)}
                              disabled={submittingReturn}
                            />
                          </div>
                          <Button
                            className="mt-2"
                            onClick={handleSubmitReturn}
                            disabled={submittingReturn || (!returnReason.trim() && !returnImageFile)}
                          >
                            {submittingReturn ? "Saving..." : "Mark as returned"}
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

              {/* Order Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Order Items ({selectedOrder.items?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedOrder.items && selectedOrder.items.length > 0 ? (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead className="text-right">Price</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedOrder.items.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                {item.productName || item.name || `Item ${index + 1}`}
                              </TableCell>
                              <TableCell>{item.quantity || 1}</TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(item.price || item.unitPrice)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(
                                  (item.price || item.unitPrice) * (item.quantity || 1)
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      No items found for this order
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Return requests (from mobile app) dialog */}
      <Dialog open={showReturnRequestsDialog} onOpenChange={setShowReturnRequestsDialog}>
        <DialogContent className="w-[100vw] max-w-[100vw] h-[100vh] sm:h-[100vh] overflow-y-auto flex flex-col p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Return requests (from mobile app)
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto -mx-2 sm:-mx-6 px-2 sm:px-6">
            {loadingReturnRequests ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading return requests...</span>
              </div>
            ) : returnRequestsList.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No return requests from the mobile app.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-24">Image</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {returnRequestsList.map((req) => (
                      <TableRow
                        key={req.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          setShowReturnRequestsDialog(false);
                          handleOrderClick({ id: req.orderId });
                        }}
                      >
                        <TableCell className="font-medium">{req.id}</TableCell>
                        <TableCell>#{req.orderId}</TableCell>
                        <TableCell>{req.userId}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={req.reason || ""}>
                          {req.reason || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              req.status === "pending"
                                ? "bg-amber-100 text-amber-800"
                                : req.status === "approved"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }
                          >
                            {req.status || "pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(req.createdAt)}
                        </TableCell>
                        <TableCell>
                          {req.imageUrl ? (
                            <div className="rounded border overflow-hidden w-12 h-12 flex-shrink-0">
                              <img
                                src={getReturnImageSrc(req.imageUrl) || req.imageUrl}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Orders;

