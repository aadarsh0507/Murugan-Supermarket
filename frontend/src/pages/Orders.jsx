import { useState, useEffect } from "react";
import { ShoppingBag, Search, RefreshCw, Calendar, MapPin, CreditCard, Package, User, Phone } from "lucide-react";
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

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
  confirmed: "bg-blue-100 text-blue-800 hover:bg-blue-200",
  processing: "bg-purple-100 text-purple-800 hover:bg-purple-200",
  shipped: "bg-indigo-100 text-indigo-800 hover:bg-indigo-200",
  delivered: "bg-green-100 text-green-800 hover:bg-green-200",
  cancelled: "bg-red-100 text-red-800 hover:bg-red-200",
};

const Orders = () => {
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

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
      if (response?.success && response?.data) {
        setOrders(response.data.orders ?? []);
        setTotal(response.data.pagination?.total ?? 0);
      } else {
        setOrders([]);
        setTotal(0);
      }
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
      if (response.success) {
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
      if (response.success) {
        setSelectedOrder(response.data.order);
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
        <Button onClick={loadOrders} variant="outline" disabled={loading} className="touch-target-y min-h-11 w-full sm:w-auto">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

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
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
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
                            <SelectItem value="shipped">Shipped</SelectItem>
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
        <DialogContent className="w-[calc(100vw-2rem)] max-w-4xl max-h-[90vh] overflow-y-auto sm:max-w-4xl">
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
    </div>
  );
};

export default Orders;

