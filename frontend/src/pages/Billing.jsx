import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Save, Search, Trash2, X, Loader2, Receipt, ScanBarcode, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { billsAPI, itemsAPI } from "@/services/api";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuth } from "@/contexts/AuthContext";
import BillModal from "@/components/BillModal";

const STORAGE_KEY = "billingTabsState.v1";
const MAX_BILL_TABS = 5;
const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "upi", label: "UPI" },
  { value: "credit", label: "Credit" },
  { value: "online", label: "Online" },
  { value: "other", label: "Other" },
];

const RECENT_BILLS_KEY = "billingRecentBills.v1";

const createId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
};

const normalizeItem = (item = {}) => {
  const sourceId =
    item.id ??
    item._id ??
    item.itemId ??
    item.item_id ??
    item.sku ??
    item.itemCode ??
    item.code ??
    createId();

  // Rate should strictly reflect the item's selling price as shown in Items screen
  const unitPrice = Number(
    item.sellingPrice ??
      item.price ??
      0
  );
  // MRP should strictly reflect the item's MRP as shown in Items screen
  const mrpValue = Number(
    item.mrp ??
      item.MRP ??
      0
  );

  return {
    sourceId,
    sku: item.sku ?? item.itemCode ?? "",
    name: item.name ?? item.itemName ?? "Unnamed Item",
    price: Number.isFinite(unitPrice) ? unitPrice : 0,
    unit: item.unit ?? "",
    mrp: Number.isFinite(mrpValue)
      ? mrpValue
      : Number.isFinite(unitPrice)
      ? unitPrice
      : 0,
  };
};

const buildBillDraft = (index) => {
  return {
    id: `bill-${createId()}`,
    label: `Bill ${index}`,
    customerName: "",
    customerPhone: "",
    customerId: "",
    customerEmail: "",
    customerAddress: "",
    customerGstin: "",
    paymentMethod: "upi",
    paymentStatus: "paid",
    discount: "0",
    tax: "0",
    notes: "",
    transactionId: "",
    items: [],
    isSaving: false,
    isSaved: false,
    savedBillNo: null,
    error: null,
    isCustomerLookupLoading: false
  };
};

const renumberBills = (bills) => {
  return bills.map((bill, index) => ({
    ...bill,
    label: `Bill ${index + 1}`
  }));
};

const getNextAvailableBillNumber = (bills) => {
  const usedNumbers = bills.map((bill) => {
    const match = bill.label.match(/Bill (\d+)/);
    return match ? Number.parseInt(match[1], 10) : null;
  }).filter(Boolean);
  
  for (let i = 1; i <= MAX_BILL_TABS; i++) {
    if (!usedNumbers.includes(i)) {
      return i;
    }
  }
  return null;
};

const getBillNumber = (bill) => {
  const match = bill.label.match(/Bill (\d+)/);
  return match ? Number.parseInt(match[1], 10) : 1;
};

const getTabColorClasses = (billNumber) => {
  const colors = {
    1: "bg-blue-600 text-white",
    2: "bg-green-600 text-white",
    3: "bg-purple-600 text-white",
    4: "bg-orange-600 text-white",
    5: "bg-pink-600 text-white",
  };
  return colors[billNumber] || colors[1];
};

const getBillTotals = (bill) => {
  const subtotal = bill.items.reduce(
    (sum, line) => sum + line.price * line.quantity,
    0
  );
  const discount = Number.parseFloat(bill.discount || 0) || 0;
  const tax = Number.parseFloat(bill.tax || 0) || 0;
  const total = Math.max(subtotal - discount + tax, 0);
  const savings = bill.items.reduce((sum, line) => {
    const mrpValue = Number.isFinite(Number(line.mrp))
      ? Number(line.mrp)
      : Number(line.price) || 0;
    const saleRate = Number(line.price) || 0;
    const qty = Number(line.quantity) || 0;
    const perUnitSavings = Math.max(mrpValue - saleRate, 0);
    return sum + perUnitSavings * qty;
  }, 0);

  return {
    subtotal,
    discount,
    tax,
    total,
    savings,
  };
};

const toCurrency = (value) => `₹${Number(value || 0).toFixed(2)}`;

const formatBillLabel = (bill) => {
  if (bill.savedBillNo) {
    return `${bill.label} • ${bill.savedBillNo}`;
  }
  if (bill.items.length > 0) {
    return `${bill.label} • ${bill.items.length} item${
      bill.items.length > 1 ? "s" : ""
    }`;
  }
  return bill.label;
};

const formatTimestamp = (value) => {
  if (!value) return "";
  const dateObj = new Date(value);
  if (Number.isNaN(dateObj.getTime())) {
    return "";
  }
  return dateObj.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const ensureNumberInput = (value, fallback = "0") => {
  if (value === "") return "";
  if (/^\d*\.?\d*$/.test(value)) {
    return value;
  }
  return fallback;
};

const loadSavedState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.bills) || parsed.bills.length === 0) {
      return null;
    }
    const loadedBills = parsed.bills.map((bill, index) => ({
      ...buildBillDraft(index + 1),
      ...bill,
      paymentMethod: bill.paymentMethod || "upi",
      items: Array.isArray(bill.items)
        ? bill.items.map((line) => ({
            lineId: line.lineId || `line-${createId()}`,
            sourceId: line.sourceId,
            name: line.name,
            sku: line.sku,
            price: Number(line.price || 0),
            quantity: Number.isFinite(line.quantity) ? line.quantity : 1
          }))
        : []
    }));
    
    return {
      bills: renumberBills(loadedBills),
      activeBillId: parsed.activeBillId
    };
  } catch (error) {
    console.warn("Failed to load billing state", error);
    return null;
  }
};

const createInitialState = () => {
  const firstBill = buildBillDraft(1);
  return {
    bills: [firstBill],
    activeBillId: firstBill.id
  };
};

export default function Billing() {
  const initialStateRef = useRef(null);
  if (!initialStateRef.current) {
    const saved = typeof window !== "undefined" ? loadSavedState() : null;
    initialStateRef.current = saved ?? createInitialState();
  }
  const { toast } = useToast();
  const { selectedStore, user } = useAuth();

  const [bills, setBills] = useState(initialStateRef.current.bills);
  const [activeBillId, setActiveBillId] = useState(
    initialStateRef.current.activeBillId || initialStateRef.current.bills[0]?.id
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [barcodeValue, setBarcodeValue] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const barcodeInputRef = useRef(null);
  const [recentBills, setRecentBills] = useState([]);
  const [printModalState, setPrintModalState] = useState({ isOpen: false, bill: null });
  const [isFetchingBill, setIsFetchingBill] = useState(false);
  const [fetchBillError, setFetchBillError] = useState(null);
  const [isReprintModalOpen, setIsReprintModalOpen] = useState(false);

  const debouncedSearch = useDebounce(searchTerm, 300);

  const focusBarcodeInput = useCallback(() => {
    requestAnimationFrame(() => {
      barcodeInputRef.current?.focus();
    });
  }, []);

  const {
    data: searchResponse,
    isFetching: isSearching,
    error: searchError,
  } = useQuery({
    queryKey: ["billing-items", debouncedSearch],
    queryFn: async () => {
      const params = { limit: 50 };
      if (debouncedSearch.trim()) {
        params.q = debouncedSearch.trim();
      }
      const response = await itemsAPI.getItems(params);
      return (
        response?.data?.items ??
        response?.items ??
        response?.data ??
        response ??
        []
      );
    },
  });

  const searchResults = useMemo(() => {
    const items = Array.isArray(searchResponse) ? searchResponse : [];
    return items.map((item) => normalizeItem(item));
  }, [searchResponse]);

  useEffect(() => {
    focusBarcodeInput();
  }, [activeBillId, focusBarcodeInput]);

  // Load recent bills filtered by selected store
  useEffect(() => {
    if (typeof window === "undefined" || !selectedStore) {
      setRecentBills([]);
      return;
    }
    
    try {
      const raw = localStorage.getItem(RECENT_BILLS_KEY);
      if (!raw) {
        setRecentBills([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        setRecentBills([]);
        return;
      }
      
      const currentStoreId = selectedStore?.id || selectedStore?._id;
      if (currentStoreId) {
        const filtered = parsed
          .filter((bill) => bill.storeId && Number(bill.storeId) === Number(currentStoreId))
          .slice(0, 10);
        setRecentBills(filtered);
      } else {
        setRecentBills([]);
      }
    } catch (error) {
      console.warn("Failed to load recent bills", error);
      setRecentBills([]);
    }
  }, [selectedStore]);

  // Save recent bills to localStorage (preserving bills from other stores)
  useEffect(() => {
    if (typeof window === "undefined" || !selectedStore) return;
    
    try {
      // Load existing bills from all stores
      const raw = localStorage.getItem(RECENT_BILLS_KEY);
      let allBills = [];
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            allBills = parsed;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      // Merge current store's recent bills with other stores' bills
      const currentStoreId = selectedStore?.id || selectedStore?._id;
      if (currentStoreId && recentBills.length > 0) {
        // Remove old bills from current store
        allBills = allBills.filter((bill) => !bill.storeId || Number(bill.storeId) !== Number(currentStoreId));
        // Add current store's recent bills
        allBills = [...recentBills, ...allBills];
        // Keep only last 50 bills total (across all stores)
        allBills = allBills.slice(0, 50);
        localStorage.setItem(RECENT_BILLS_KEY, JSON.stringify(allBills));
      }
    } catch (error) {
      console.warn("Failed to persist recent bills", error);
    }
  }, [recentBills, selectedStore]);

  const updateBill = useCallback((billId, updater) => {
    setBills((prev) =>
      prev.map((bill) => {
        if (bill.id !== billId) return bill;
        const updates =
          typeof updater === "function" ? updater(bill) : updater || {};
        return { ...bill, ...updates };
      })
    );
  }, []);

  const addBillTab = () => {
    if (bills.length >= MAX_BILL_TABS) {
      toast({
        title: "Maximum tabs reached",
        description: `You can keep only ${MAX_BILL_TABS} bills open at once.`,
        variant: "destructive",
      });
      return;
    }

    const nextNumber = getNextAvailableBillNumber(bills);
    if (!nextNumber) {
      toast({
        title: "Maximum tabs reached",
        description: `You can keep only ${MAX_BILL_TABS} bills open at once.`,
        variant: "destructive",
      });
      return;
    }

    const newBill = buildBillDraft(nextNumber);
    setBills((prev) => renumberBills([...prev, newBill]));
    setActiveBillId(newBill.id);
  };

  const removeBillTab = (billId) => {
    if (bills.length === 1) {
      toast({
        title: "Cannot close tab",
        description: "At least one bill tab must remain open.",
        variant: "destructive",
      });
      return;
    }

    setBills((prev) => {
      const filtered = prev.filter((bill) => bill.id !== billId);
      return renumberBills(filtered);
    });

    if (activeBillId === billId) {
      const remaining = bills.filter((bill) => bill.id !== billId);
      setActiveBillId(remaining[remaining.length - 1]?.id ?? "");
    }
  };

  const addBillToRecent = useCallback((bill) => {
    if (!bill) return;

    const billId = bill.id ?? bill.billId ?? null;
    const billNo = bill.billNo ?? bill.bill_no ?? (billId ? `BILL-${billId}` : "");
    const totalValue = Number.isFinite(Number.parseFloat(bill.total ?? bill.totalAmount))
      ? Number.parseFloat(bill.total ?? bill.totalAmount)
      : 0;
    const billDate = bill.date ?? bill.createdAt ?? new Date().toISOString();
    const currentStoreId = selectedStore?.id || selectedStore?._id;

    if (!currentStoreId) {
      // Don't add to recent bills if no store is selected
      return;
    }

    setRecentBills((prev) => {
      const entry = {
        id: billId,
        billNo,
        total: totalValue,
        date: billDate,
        paymentMethod: bill.paymentMethod ?? null,
        userName:
          bill.userName ??
          bill.billBy ??
          bill.cashierName ??
          null,
        storeId: currentStoreId
      };

      // Only check for duplicates within the same store
      const existingIndex = prev.findIndex(
        (item) =>
          Number(item.storeId) === Number(currentStoreId) &&
          ((entry.id && item.id === entry.id) ||
          (entry.billNo && item.billNo === entry.billNo))
      );

      let updated;
      if (existingIndex >= 0) {
        updated = [...prev];
        if (!entry.userName && updated[existingIndex]?.userName) {
          entry.userName = updated[existingIndex].userName;
        }
        if (!entry.paymentMethod && updated[existingIndex]?.paymentMethod) {
          entry.paymentMethod = updated[existingIndex].paymentMethod;
        }
        updated.splice(existingIndex, 1);
        updated.unshift(entry);
      } else {
        updated = [entry, ...prev];
      }

      // Filter to only current store's bills and limit to 10
      return updated
        .filter((item) => Number(item.storeId) === Number(currentStoreId))
        .slice(0, 10);
    });
  }, [selectedStore]);

  const fetchBillDetails = useCallback(
    async ({ billId, billNo }, { silent = false } = {}) => {
      if (!billId && !billNo) {
        throw new Error("Bill identifier is required");
      }

      try {
        setIsFetchingBill(true);
        setFetchBillError(null);

        const response = billId
          ? await billsAPI.getBill(billId)
          : await billsAPI.getBillByNumber(billNo);

        const bill =
          response?.data?.bill ??
          response?.bill ??
          response?.data ??
          response;

        if (!bill) {
          throw new Error("Bill not found");
        }

        return bill;
      } catch (error) {
        console.error("Failed to load bill:", error);
        const description =
          error.response?.data?.message ??
          error.message ??
          "Unable to load bill details right now.";
        setFetchBillError(description);
        if (!silent) {
          toast({
            title: "Unable to load bill",
            description,
            variant: "destructive"
          });
        }
        throw error;
      } finally {
        setIsFetchingBill(false);
      }
    },
    [toast]
  );

  const closeBillAfterSave = useCallback(
    (billId) => {
      setBills((prevBills) => {
        if (prevBills.length === 0) {
          return prevBills;
        }

        if (prevBills.length === 1 && prevBills[0].id === billId) {
          const newBill = buildBillDraft(1);
          setActiveBillId(newBill.id);
          return [newBill];
        }

        const filtered = prevBills.filter((bill) => bill.id !== billId);
        if (filtered.length === prevBills.length) {
          return prevBills;
        }

        const renumbered = renumberBills(filtered);
        const fallbackActiveId =
          renumbered[renumbered.length - 1]?.id ?? renumbered[0]?.id ?? "";
        setActiveBillId((current) =>
          current === billId ? fallbackActiveId : current
        );
        return renumbered;
      });
      focusBarcodeInput();
    },
    [focusBarcodeInput]
  );

  const handleReprintBill = useCallback(
    async (billSummary) => {
      if (!billSummary) return;
      try {
        const bill = await fetchBillDetails(
          {
            billId: billSummary.id,
            billNo: billSummary.billNo
          },
          { silent: false }
        );
        addBillToRecent(bill);
        setPrintModalState({ isOpen: true, bill });
      } catch (error) {
        // Error handling surfaced via toast inside fetchBillDetails
      }
    },
    [addBillToRecent, fetchBillDetails]
  );

  const prefillCustomerByPhone = useCallback(
    async (billId, phone) => {
      const trimmed = (phone ?? '').trim();
      if (!trimmed) {
        return;
      }

      if (!/^[\+]?[0-9]{6,20}$/.test(trimmed)) {
        toast({
          title: "Invalid phone number",
          description: "Enter a valid customer phone number before fetching.",
          variant: "destructive"
        });
        return;
      }

      updateBill(billId, {
        isCustomerLookupLoading: true,
        error: null
      });

      try {
        const response = await billsAPI.getCustomerByPhone(trimmed, {
          storeId: selectedStore?.id
        });
        const customer =
          response?.data?.customer ??
          response?.customer ??
          response?.data ??
          null;

        if (customer) {
          updateBill(billId, (bill) => ({
            isCustomerLookupLoading: false,
            customerPhone: trimmed,
            customerName: customer.customerName ?? bill.customerName ?? "",
            customerEmail: customer.customerEmail ?? bill.customerEmail ?? "",
            customerAddress: customer.customerAddress ?? bill.customerAddress ?? "",
            customerGstin: customer.customerGstin ?? bill.customerGstin ?? "",
            customerId: customer.customerId ?? trimmed,
            paymentMethod: bill.paymentMethod === 'credit'
              ? bill.paymentMethod
              : customer.paymentMethod ?? bill.paymentMethod,
            paymentStatus:
              (customer.paymentMethod ?? bill.paymentMethod) === 'credit'
                ? 'pending'
                : bill.paymentStatus ?? 'paid',
            isSaved: false,
            savedBillNo: null
          }));
          toast({
            title: "Customer loaded",
            description: customer.customerName
              ? `Welcome back, ${customer.customerName}.`
              : "Saved customer details applied."
          });
          focusBarcodeInput();
        } else {
          updateBill(billId, {
            isCustomerLookupLoading: false
          });
          toast({
            title: "Customer not found",
            description: "No saved customer details for this phone number.",
            variant: "destructive"
          });
          focusBarcodeInput();
        }
      } catch (error) {
        console.error("Failed to fetch customer:", error);
        const description =
          error.response?.data?.message ??
          error.message ??
          "Unable to fetch customer details.";
        updateBill(billId, {
          isCustomerLookupLoading: false
        });
        toast({
          title: "Lookup failed",
          description,
          variant: "destructive"
        });
        focusBarcodeInput();
      }
    },
    [selectedStore?.id, toast, updateBill, focusBarcodeInput]
  );

  const addItemToBill = (billId, item) => {
    updateBill(billId, (bill) => {
      const existingIndex = bill.items.findIndex(
        (line) => line.sourceId === item.sourceId
      );

      if (existingIndex >= 0) {
        const updatedItems = bill.items.map((line, index) =>
          index === existingIndex
            ? { ...line, quantity: line.quantity + 1 }
            : line
        );
        return {
          items: updatedItems,
          isSaved: false,
          savedBillNo: null,
        };
      }

      const newLine = {
        lineId: `line-${createId()}`,
        sourceId: item.sourceId,
        name: item.name,
        sku: item.sku,
        price: item.price,
        mrp: item.mrp,
        quantity: 1,
      };

      return {
        items: [...bill.items, newLine],
        isSaved: false,
        savedBillNo: null,
      };
    });
    focusBarcodeInput();
  };

  const updateItemQuantity = (billId, lineId, quantityValue) => {
    const quantity = Math.max(Number.parseInt(quantityValue, 10) || 0, 0);
    updateBill(billId, (bill) => ({
      items: bill.items.map((line) =>
        line.lineId === lineId ? { ...line, quantity } : line
      ),
      isSaved: false,
      savedBillNo: null,
    }));
  };

  const removeItemFromBill = (billId, lineId) => {
    updateBill(billId, (bill) => ({
      items: bill.items.filter((line) => line.lineId !== lineId),
      isSaved: false,
      savedBillNo: null,
    }));
  };

  const clearBill = (billId) => {
    updateBill(billId, (bill) => ({
      items: [],
      customerName: "",
      customerPhone: "",
      customerId: "",
      customerEmail: "",
      customerAddress: "",
      customerGstin: "",
      discount: "0",
      tax: "0",
      transactionId: "",
      paymentStatus: bill.paymentMethod === "credit" ? "pending" : "paid",
      isSaved: false,
      savedBillNo: null,
      isCustomerLookupLoading: false
    }));
    focusBarcodeInput();
  };

  const handleSaveBill = async (billId) => {
    const billToSave = bills.find((bill) => bill.id === billId);
    if (!billToSave) return;

    if (!selectedStore?.id) {
      toast({
        title: "Select a store",
        description: "Please select a store before saving a bill.",
        variant: "destructive",
      });
      return;
    }

    if (billToSave.items.length === 0) {
      toast({
        title: "Add items first",
        description: "A bill must contain at least one item before saving.",
        variant: "destructive",
      });
      return;
    }

    const totals = getBillTotals(billToSave);
    const trimmedCustomerName = (billToSave.customerName || "").trim();
    const trimmedCustomerPhone = (billToSave.customerPhone || "").trim();
    const trimmedCustomerId = (billToSave.customerId || "").trim();
    const trimmedCustomerEmail = (billToSave.customerEmail || "").trim();
    const trimmedTransactionId = (billToSave.transactionId || "").trim();
    const requiresCustomer = billToSave.paymentMethod === "credit";
    const requiresTransactionId = billToSave.paymentMethod === "online";
    const paymentStatus = requiresCustomer ? "pending" : "paid";

    if (requiresCustomer) {
      if (!trimmedCustomerName) {
        toast({
          title: "Customer name required",
          description: "Please enter the customer's name for credit bills.",
          variant: "destructive"
        });
        return;
      }

      if (!/^[\+]?[0-9]{6,20}$/.test(trimmedCustomerPhone)) {
        toast({
          title: "Customer phone required",
          description: "Enter a valid customer phone number for credit bills.",
          variant: "destructive"
        });
        return;
      }
    }

    if (requiresTransactionId) {
      if (!trimmedTransactionId) {
        toast({
          title: "Transaction ID required",
          description: "Please enter the transaction ID or number for online payments.",
          variant: "destructive"
        });
        return;
      }
    }

    const itemsPayload = billToSave.items
      .map((line) => {
        const quantity = Number.parseInt(line.quantity, 10);
        const unitPrice = Number.parseFloat(line.price);

        if (!Number.isFinite(quantity) || quantity <= 0) {
          return null;
        }
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          return null;
        }

        // Validate name field (required by backend validation)
        const itemName = (line.name || "").trim();
        if (!itemName || itemName.length === 0) {
          return null;
        }
        if (itemName.length > 200) {
          return null;
        }

        const parsedId = Number.parseInt(line.sourceId, 10);
        const total = Number((quantity * unitPrice).toFixed(2));

        // Build payload object, only including defined fields
        const payload = {
          name: itemName,
          quantity,
          unitPrice: Number(unitPrice.toFixed(2)),
          sellingPrice: Number(unitPrice.toFixed(2)),
          total
        };

        // Only include itemId if it's a valid positive integer
        if (Number.isFinite(parsedId) && parsedId > 0) {
          payload.itemId = parsedId;
        }

        // Only include itemCode if it exists
        if (line.sku && line.sku.trim()) {
          payload.itemCode = line.sku.trim();
        }

        // Only include mrp if it's a valid number
        if (Number.isFinite(Number(line.mrp)) && Number(line.mrp) >= 0) {
          payload.mrp = Number(Number(line.mrp).toFixed(2));
        }

        return payload;
      })
      .filter(Boolean);

    if (itemsPayload.length === 0) {
      toast({
        title: "Invalid items",
        description: "Ensure each item has a quantity greater than zero.",
        variant: "destructive"
      });
      return;
    }

    updateBill(billId, { isSaving: true, error: null });

    try {
      const response = await billsAPI.createBill({
        storeId: selectedStore.id,
        customerName: trimmedCustomerName || undefined,
        customerPhone: trimmedCustomerPhone || undefined,
        customerId: trimmedCustomerId || trimmedCustomerPhone || undefined,
        customerEmail: trimmedCustomerEmail || undefined,
        customerAddress: (billToSave.customerAddress || "").trim() || undefined,
        customerGstin: (billToSave.customerGstin || "").trim() || undefined,
        paymentMethod: billToSave.paymentMethod,
        paymentStatus,
        transactionId: trimmedTransactionId || undefined,
        subtotal: Number(totals.subtotal.toFixed(2)),
        discount: Number(totals.discount.toFixed(2)),
        tax: Number(totals.tax.toFixed(2)),
        total: Number(totals.total.toFixed(2)),
        items: itemsPayload
      });

      const createdBill =
        response?.data?.bill ??
        response?.bill ??
        response?.data ??
        response;

      const assignedBillNo = createdBill?.billNo ?? createdBill?.bill_no;

      updateBill(billId, {
        isSaving: false,
        isSaved: true,
        paymentStatus,
        savedBillNo: assignedBillNo ?? null,
      });

      toast({
        title: "Bill saved",
        description: assignedBillNo
          ? `Bill ${assignedBillNo} saved successfully.`
          : "Bill saved successfully.",
      });

      try {
        const printableBill = await fetchBillDetails(
          {
            billId: createdBill?.id ?? createdBill?.billId ?? null,
            billNo: assignedBillNo ?? null
          },
          { silent: true }
        );
        // Enrich printable bill items with local bill's MRP/selling price when missing
        const localLineKey = (line) => {
          const code = (line.itemCode ?? line.sku ?? "").toString().trim().toLowerCase();
          const name = (line.name ?? "").toString().trim().toLowerCase();
          const price = Number(line.unitPrice ?? line.price ?? 0);
          return `${code}|${name}|${price}`;
        };
        const localLinesIndex = new Map(
          billToSave.items.map((line) => [localLineKey(line), line])
        );
        const enrichedItems = Array.isArray(printableBill?.items)
          ? printableBill.items.map((it, idx) => {
              // Try key-based match first
              const key = localLineKey({
                itemCode: it.itemCode ?? it.sku,
                name: it.name,
                unitPrice: it.unitPrice ?? it.price
              });
              let local = localLinesIndex.get(key);
              // If key match fails, try position-based fallback (most bills preserve order)
              if (!local && Array.isArray(billToSave.items) && billToSave.items.length === printableBill.items.length) {
                local = billToSave.items[idx];
              }
              const mrp =
                Number.isFinite(Number(it.mrp))
                  ? Number(it.mrp)
                  : Number.isFinite(Number(local?.mrp))
                    ? Number(local.mrp)
                    : 0;
              const sellingPrice =
                Number.isFinite(Number(it.sellingPrice))
                  ? Number(it.sellingPrice)
                  : Number.isFinite(Number(it.unitPrice))
                    ? Number(it.unitPrice)
                    : Number.isFinite(Number(local?.sellingPrice))
                      ? Number(local.sellingPrice)
                      : Number.isFinite(Number(local?.price))
                        ? Number(local.price)
                        : Number(isFinite(it.price) ? it.price : 0);
              return {
                ...it,
                mrp,
                sellingPrice
              };
            })
          : printableBill?.items ?? [];

        const enhancedPrintableBill = {
          ...printableBill,
          totalSavings: totals.savings || 0,
          items: enrichedItems
        };
        addBillToRecent(enhancedPrintableBill);
        setPrintModalState({ isOpen: true, bill: enhancedPrintableBill });
      } catch (printError) {
        console.warn("Unable to load bill for printing:", printError);
        addBillToRecent({
          id: createdBill?.id ?? createdBill?.billId ?? null,
          billNo: assignedBillNo ?? null,
          total: totals.total,
          date: createdBill?.date ?? new Date().toISOString(),
          paymentMethod: createdBill?.paymentMethod ?? billToSave.paymentMethod,
          totalSavings: totals.savings || 0,
          userName:
            createdBill?.userName ??
            createdBill?.billBy ??
            createdBill?.cashierName ??
            null
        });
      } finally {
        closeBillAfterSave(billId);
      }
    } catch (error) {
      console.error("Failed to save bill:", error);
      
      // Extract detailed validation errors if available
      let description = error.response?.data?.message ?? error.message ?? "Unable to save the bill right now.";
      
      // If there are validation errors, show them in detail
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        const validationErrors = error.response.data.errors
          .map((err) => {
            const field = err.path || err.param || err.field || "field";
            const msg = err.msg || err.message || "Invalid value";
            return `${field}: ${msg}`;
          })
          .join("; ");
        
        if (validationErrors) {
          description = `Validation failed: ${validationErrors}`;
        }
      }
      
      updateBill(billId, {
        isSaving: false,
        error: description,
      });
      toast({
        title: "Failed to save bill",
        description,
        variant: "destructive",
      });
    } finally {
      setTimeout(() => {
        focusBarcodeInput();
      }, 0);
    }
  };

  const renderBillSummary = (bill) => {
    const totals = getBillTotals(bill);

    return (
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">{toCurrency(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Savings</span>
          <span className="font-medium text-emerald-600">
            {toCurrency(totals.savings || 0)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Discount</span>
          <span className="font-medium text-destructive">
            -{toCurrency(totals.discount)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Tax</span>
          <span className="font-medium">{toCurrency(totals.tax)}</span>
        </div>
        <div className="border-t pt-3 flex justify-between text-base font-semibold">
          <span>Total</span>
          <span>{toCurrency(totals.total)}</span>
        </div>
      </div>
    );
  };

  useEffect(() => {
    const payload = {
      bills,
      activeBillId
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn("Failed to persist billing state", error);
    }
  }, [bills, activeBillId]);

  const handleBarcodeSubmit = async (event) => {
    event.preventDefault();
    const value = barcodeValue.trim();
    if (!value || !activeBillId) {
      return;
    }

    setIsScanning(true);
    setScanError(null);

    try {
      const response = await itemsAPI.getItemByBarcode(value);
      const itemData =
        response?.data?.item ??
        response?.item ??
        response;

      if (!itemData) {
        setScanError("Item not found for this barcode");
        toast({
          title: "Barcode not found",
          description: "No item is registered with this barcode.",
          variant: "destructive"
        });
        return;
      }

      const normalizedItem = normalizeItem(itemData);
      addItemToBill(activeBillId, normalizedItem);
      toast({
        title: "Item added",
        description: `${normalizedItem.name} added to the bill`
      });
    } catch (error) {
      console.error("Failed to load item by barcode:", error);
      const description =
        error.response?.data?.message ?? error.message ?? "Unable to find item for this barcode.";
      setScanError(description);
      toast({
        title: "Barcode scan failed",
        description,
        variant: "destructive"
      });
    } finally {
      setBarcodeValue("");
      setIsScanning(false);
      focusBarcodeInput();
    }
  };

  const activeBill = bills.find((b) => b.id === activeBillId);

  return (
    <div className="relative -m-6 bg-background flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 10rem)' }}>
      {/* Header Bar */}
      <div className="bg-primary text-primary-foreground flex flex-col border-b shadow-sm">
        {/* Top Row - Title and Actions */}
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Receipt className="h-6 w-6" />
              Billing
            </h1>
            {activeBill?.savedBillNo && (
              <span className="text-sm bg-primary-foreground/20 px-3 py-1 rounded-full">
                Bill #{activeBill.savedBillNo}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsReprintModalOpen(true)}
              className="bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground"
            >
              <Printer className="h-4 w-4 mr-2" />
              Reprint
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => clearBill(activeBillId)}
              className="bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                if (bills.length < MAX_BILL_TABS) {
                  addBillTab();
                  toast({
                    title: "New bill created",
                    description: "You can now add items to the new bill.",
                  });
                } else {
                  toast({
                    title: "Maximum bills reached",
                    description: `You can keep only ${MAX_BILL_TABS} bills open at once.`,
                    variant: "destructive",
                  });
                }
              }}
              disabled={bills.length >= MAX_BILL_TABS}
              className="bg-primary-foreground hover:bg-primary-foreground/90 text-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Bill
            </Button>
          </div>
        </div>
        
        {/* Bill Tabs - Always show, at the top */}
        {bills.length > 0 && (
          <div className="px-4 pb-2 border-t border-primary-foreground/20">
            <div className="flex gap-2 overflow-x-auto">
              {bills.map((bill) => {
                const billNumber = getBillNumber(bill);
                const colorClasses = getTabColorClasses(billNumber);
                const isActive = bill.id === activeBillId;
                return (
                  <button
                    key={bill.id}
                    onClick={() => setActiveBillId(bill.id)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                      isActive
                        ? `${colorClasses} text-white shadow-md`
                        : "bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border border-primary-foreground/20"
                    }`}
                  >
                    <span>{formatBillLabel(bill)}</span>
                    {bills.length > 1 && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBillTab(bill.id);
                        }}
                        className="ml-1 rounded-full p-1 hover:bg-black/10 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Items Display */}
        <div className="flex-1 flex flex-col bg-muted/30 overflow-hidden">
          {/* Search and Barcode Input */}
          <div className="p-4 border-b bg-background space-y-3 shadow-sm">
            <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  ref={barcodeInputRef}
                  placeholder="Scan barcode..."
                  value={barcodeValue}
                  onChange={(event) => setBarcodeValue(event.target.value)}
                  disabled={isScanning}
                  className="pl-10 h-11 text-base"
                  autoComplete="off"
                  inputMode="numeric"
                />
              </div>
              <Button 
                type="submit" 
                disabled={isScanning || !barcodeValue.trim()}
                className="h-11 px-6"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Scanning
                  </>
                ) : (
                  <>
                    <ScanBarcode className="h-4 w-4 mr-2" />
                    Scan
                  </>
                )}
              </Button>
            </form>

            {/* Product Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
              <Input
                placeholder="Type product name to search..."
                className="pl-10 h-11 text-base"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              
              {/* Search Results Dropdown */}
              {searchTerm && searchResults.length > 0 && !isSearching && (
                <div className="absolute z-50 mt-2 w-full bg-background border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {searchResults.slice(0, 10).map((item) => (
                    <div
                      key={item.sourceId}
                      className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0 transition-colors"
                      onClick={() => {
                        addItemToBill(activeBillId, item);
                        setSearchTerm("");
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          {item.sku && (
                            <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                          )}
                        </div>
                        <span className="font-semibold text-primary">{toCurrency(item.price)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {searchTerm && isSearching && (
                <div className="absolute z-50 mt-2 w-full bg-background border rounded-lg shadow-lg p-4">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Searching...</span>
                  </div>
                </div>
              )}
            </div>

            {scanError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {scanError}
              </div>
            )}
          </div>

          {/* Items Display Area - Row Format */}
          <div className="flex-1 overflow-y-auto bg-background">
            {activeBill?.items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-muted-foreground p-8">
                <ScanBarcode className="h-16 w-16 opacity-20" />
                <div>
                  <p className="text-lg font-medium">No items added yet</p>
                  <p className="text-sm mt-1">Scan barcode or search for products to add items</p>
                </div>
              </div>
            ) : (
              <div className="p-4">
                {/* Header Row */}
                <div className="grid grid-cols-12 gap-4 pb-3 mb-2 border-b font-semibold text-sm text-muted-foreground sticky top-0 bg-background z-10 py-2">
                  <div className="col-span-1 text-center">S.No.</div>
                  <div className="col-span-3">Product Name</div>
                  <div className="col-span-2 text-right">MRP</div>
                  <div className="col-span-2 text-right">Price</div>
                  <div className="col-span-2 text-center">Quantity</div>
                  <div className="col-span-1 text-right">Total</div>
                  <div className="col-span-1 text-center">Action</div>
                </div>
                
                {/* Item Rows */}
                <div className="space-y-2">
                  {activeBill?.items.map((line, index) => (
                    <div
                      key={line.lineId}
                      className="grid grid-cols-12 gap-4 items-center py-2.5 px-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      {/* Serial Number */}
                      <div className="col-span-1 text-center">
                        <span className="text-sm font-medium text-muted-foreground">
                          {index + 1}
                        </span>
                      </div>
                      
                      {/* Product Name */}
                      <div className="col-span-3 flex items-center">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{line.name}</p>
                          {line.sku && (
                            <p className="text-xs text-muted-foreground">SKU: {line.sku}</p>
                          )}
                        </div>
                      </div>
                      
                      {/* MRP */}
                      <div className="col-span-2 text-right">
                        <span className="line-through text-muted-foreground text-sm">
                          ₹{Number(line.mrp ?? 0).toFixed(2)}
                        </span>
                      </div>
                      
                      {/* Price */}
                      <div className="col-span-2 text-right">
                        <span className="font-semibold text-sm">
                          ₹{line.price.toFixed(2)}
                        </span>
                      </div>
                      
                      {/* Quantity */}
                      <div className="col-span-2 flex justify-center">
                        <Input
                          type="number"
                          min="0"
                          value={line.quantity}
                          onChange={(event) =>
                            updateItemQuantity(
                              activeBillId,
                              line.lineId,
                              event.target.value
                            )
                          }
                          className="w-20 h-9 text-center"
                        />
                      </div>
                      
                      {/* Total */}
                      <div className="col-span-1 text-right">
                        <span className="font-bold text-primary text-sm">
                          ₹{(line.price * line.quantity).toFixed(2)}
                        </span>
                      </div>
                      
                      {/* Remove Button */}
                      <div className="col-span-1 flex justify-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeItemFromBill(activeBillId, line.lineId)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Payment & Summary */}
        <div className="w-96 bg-background border-l flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Discount & Tax - At Top */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Adjustments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Discount</label>
                  <Input
                    placeholder="0.00"
                    value={activeBill?.discount || "0"}
                    onChange={(event) =>
                      updateBill(activeBillId, {
                        discount: ensureNumberInput(
                          event.target.value,
                          activeBill?.discount || "0"
                        ),
                        isSaved: false,
                        savedBillNo: null,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tax</label>
                  <Input
                    placeholder="0.00"
                    value={activeBill?.tax || "0"}
                    onChange={(event) =>
                      updateBill(activeBillId, {
                        tax: ensureNumberInput(
                          event.target.value,
                          activeBill?.tax || "0"
                        ),
                        isSaved: false,
                        savedBillNo: null,
                      })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Bill Summary - In Middle */}
            {activeBill && (
              <Card className="bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-lg">Bill Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  {renderBillSummary(activeBill)}
                </CardContent>
              </Card>
            )}

            {/* Payment Method */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Payment Method</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Payment Mode</label>
                  <Select
                    value={activeBill?.paymentMethod || "upi"}
                    onValueChange={(value) =>
                      updateBill(activeBillId, {
                        paymentMethod: value,
                        paymentStatus: value === "credit" ? "pending" : "paid",
                        transactionId: value !== "online" ? "" : activeBill?.transactionId,
                        isSaved: false,
                        savedBillNo: null,
                      })
                    }
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem
                          key={method.value}
                          value={method.value}
                        >
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {activeBill?.paymentMethod === "online" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Transaction ID</label>
                    <Input
                      placeholder="Enter transaction ID"
                      value={activeBill?.transactionId || ""}
                      onChange={(event) =>
                        updateBill(activeBillId, {
                          transactionId: event.target.value,
                          isSaved: false,
                          savedBillNo: null,
                        })
                      }
                    />
                  </div>
                )}

                {activeBill?.paymentMethod === "credit" && (
                  <p className="text-xs text-muted-foreground">
                    Customer name and phone are required for credit bills.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Customer Details - At Bottom */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Customer Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Customer Name</label>
                  <Input
                    placeholder="Enter customer name"
                    value={activeBill?.customerName || ""}
                    onChange={(event) =>
                      updateBill(activeBillId, {
                        customerName: event.target.value,
                        isSaved: false,
                        savedBillNo: null,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Customer Phone</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter phone"
                      value={activeBill?.customerPhone || ""}
                      onChange={(event) =>
                        updateBill(activeBillId, {
                          customerPhone: event.target.value,
                          isSaved: false,
                          savedBillNo: null,
                        })
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          prefillCustomerByPhone(activeBillId, event.currentTarget.value);
                        }
                      }}
                      inputMode="tel"
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => prefillCustomerByPhone(activeBillId, activeBill?.customerPhone)}
                      disabled={
                        activeBill?.isCustomerLookupLoading ||
                        !activeBill?.customerPhone ||
                        !activeBill?.customerPhone.trim()
                      }
                    >
                      {activeBill?.isCustomerLookupLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Fetch"
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Footer - Create Bill Button */}
          <div className="border-t p-6 bg-background">
            {activeBill?.error && (
              <p className="text-sm text-destructive mb-3">{activeBill.error}</p>
            )}
            <Button
              onClick={() => handleSaveBill(activeBillId)}
              disabled={activeBill?.isSaving || !activeBill?.items || activeBill.items.length === 0}
              size="lg"
              className="w-full h-14 text-lg font-semibold"
            >
              {activeBill?.isSaving ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Creating Bill...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5 mr-2" />
                  Create Bill
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Reprint Bill Modal */}
      <Dialog open={isReprintModalOpen} onOpenChange={setIsReprintModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Reprint Bill</DialogTitle>
            <DialogDescription>
              Select a bill from the last 10 printed bills to reprint
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {recentBills.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Printer className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>No recent bills found</p>
                <p className="text-sm mt-2">Bills will appear here after they are created</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {recentBills
                  .filter((bill) => {
                    const currentStoreId = selectedStore?.id || selectedStore?._id;
                    return currentStoreId && Number(bill.storeId) === Number(currentStoreId);
                  })
                  .slice(0, 10)
                  .map((bill) => (
                    <div
                      key={`${bill.id ?? bill.billNo}`}
                      className="flex items-center justify-between gap-3 rounded-lg border p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={async () => {
                        try {
                          setIsFetchingBill(true);
                          setFetchBillError(null);
                          const billDetails = await fetchBillDetails(
                            {
                              billId: bill.id,
                              billNo: bill.billNo
                            },
                            { silent: false }
                          );
                          addBillToRecent(billDetails);
                          setPrintModalState({ isOpen: true, bill: billDetails });
                          setIsReprintModalOpen(false);
                        } catch (error) {
                          // Error handling surfaced via toast inside fetchBillDetails
                        } finally {
                          setIsFetchingBill(false);
                        }
                      }}
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-base">
                            {bill.billNo || (bill.id ? `Bill #${bill.id}` : "Bill")}
                          </p>
                          {bill.paymentMethod && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              {bill.paymentMethod.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {toCurrency(bill.total)}
                          </span>
                          {formatTimestamp(bill.date) && (
                            <span>• {formatTimestamp(bill.date)}</span>
                          )}
                          {bill.userName && <span>• {bill.userName}</span>}
                        </div>
                      </div>
                      <div className="flex items-center">
                        {isFetchingBill ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <Printer className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
            {fetchBillError && (
              <p className="text-sm text-destructive mt-2">{fetchBillError}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <BillModal
        isOpen={printModalState.isOpen}
        billData={printModalState.bill}
        isAdmin={Boolean(user?.isAdmin)}
        onClose={() => {
          setPrintModalState({ isOpen: false, bill: null });
          focusBarcodeInput();
        }}
      />
    </div>
  );
}


