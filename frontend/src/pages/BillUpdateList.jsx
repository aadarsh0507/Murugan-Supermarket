import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FilePen, Loader2, Receipt, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { billsAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

const formatMoney = (n) => `₹${Number(n || 0).toFixed(2)}`;

const formatBillDate = (bill) => {
  const raw = bill?.dateCalendarYmd ?? bill?.date ?? bill?.createdAt ?? bill?.created_at;
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw).slice(0, 16);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function BillUpdateList() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { selectedStore } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");

  const storeId = selectedStore?.id ?? selectedStore?._id ?? null;

  const loadBills = useCallback(async () => {
    if (!storeId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await billsAPI.getBills({
        storeId,
        limit: 500,
      });
      let billsData = [];
      if (Array.isArray(response?.data)) {
        billsData = response.data;
      } else if (Array.isArray(response?.data?.bills)) {
        billsData = response.data.bills;
      } else if (Array.isArray(response?.data?.data)) {
        billsData = response.data.data;
      } else if (Array.isArray(response?.bills)) {
        billsData = response.bills;
      }
      setRows(Array.isArray(billsData) ? billsData : []);
    } catch (error) {
      console.error("[BillUpdateList] load failed", error);
      toast({
        title: "Could not load bills",
        description: error.response?.data?.message ?? error.message ?? "Try again later.",
        variant: "destructive",
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [storeId, toast]);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((bill) => {
      const no = String(bill.billNo ?? bill.bill_no ?? "").toLowerCase();
      const name = String(bill.customerName ?? bill.customer_name ?? "").toLowerCase();
      const phone = String(bill.customerPhone ?? bill.customer_phone ?? "");
      const id = String(bill.id ?? bill._id ?? "");
      return no.includes(q) || name.includes(q) || phone.includes(q) || id === q;
    });
  }, [rows, search]);

  const openBillForEdit = (bill) => {
    const id = bill?.id ?? bill?._id;
    if (!id) {
      toast({ title: "Invalid bill", description: "Missing bill id.", variant: "destructive" });
      return;
    }
    navigate("/billing", { state: { editBillId: Number(id) } });
  };

  if (!storeId) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Receipt className="h-7 w-7" />
          Update bills
        </h1>
        <p className="text-muted-foreground">Select a store from the header to load bills.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FilePen className="h-7 w-7" />
            Update bills
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Bills for <span className="font-medium text-foreground">{selectedStore?.name ?? "this store"}</span>.
            Choose a bill to open it on the billing screen for full editing and{" "}
            <span className="font-medium">Update bill</span>.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/billing")}>
          <Receipt className="h-4 w-4 mr-2" />
          Back to billing
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">All bills</CardTitle>
          <div className="relative max-w-md mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by bill no, customer, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              Loading bills…
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No bills match your search.</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Bill no</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((bill, index) => {
                    const id = bill.id ?? bill._id;
                    return (
                      <TableRow key={id ?? index}>
                        <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                        <TableCell className="font-medium">{bill.billNo ?? bill.bill_no ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{formatBillDate(bill)}</TableCell>
                        <TableCell>{bill.customerName ?? bill.customer_name ?? "—"}</TableCell>
                        <TableCell className="text-sm">{bill.customerPhone ?? bill.customer_phone ?? "—"}</TableCell>
                        <TableCell className="text-right font-medium">{formatMoney(bill.total)}</TableCell>
                        <TableCell className="capitalize text-sm">
                          {bill.paymentMethod ?? bill.payment_method ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="default" onClick={() => openBillForEdit(bill)}>
                            <FilePen className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
