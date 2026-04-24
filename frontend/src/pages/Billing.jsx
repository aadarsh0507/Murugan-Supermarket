import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Plus, Save, Trash2, X, Loader2, Receipt, ScanBarcode, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { billsAPI, itemsAPI, categoriesAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import BillModal from "@/components/BillModal";

// Load Razorpay checkout script once (for UPI payments)
const loadRazorpayScript = () => {
  if (typeof window !== "undefined" && window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(script);
  });
};

const STORAGE_KEY = "billingTabsState.v1";
const MAX_BILL_TABS = 5;
const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "credit", label: "Credit" },
];

const ALLOWED_PAYMENT_METHODS = new Set(PAYMENT_METHODS.map((method) => method.value));

const normalizePaymentMethod = (value) => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return ALLOWED_PAYMENT_METHODS.has(normalized) ? normalized : "cash";
};

const RECENT_BILLS_KEY = "billingRecentBills.v1";

const createId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
};

/** Items with a buy-one-get offer: default bill qty is 2; each repeat scan adds 2. */
const itemHasBogoOffer = (item = {}) =>
  Boolean(String(item?.bogoOffer ?? item?.bogo_offer ?? "").trim());

const bogoDefaultQuantity = (item = {}) => (itemHasBogoOffer(item) ? 2 : 1);

const bogoQuantityIncrement = (item = {}) => (itemHasBogoOffer(item) ? 2 : 1);

/**
 * Buy-one-get-one-free: amount scales with physical qty ÷ 2 (half the units are “paid”).
 * e.g. rate ₹700, qty 2 → ₹700; qty 1 → ₹350.
 */
/** Minimum quantity after blur / commit (allows fractional weight, etc.). */
const MIN_BILL_LINE_QUANTITY = 0.001;

/** Parse line quantity for totals and API; treats trailing "n." as n for interim display. */
const lineQuantityNumber = (q) => {
  if (q === "" || q === null || q === undefined) return 0;
  if (typeof q === "string" && /^\d+\.$/.test(q.trim())) {
    return Number.parseFloat(q);
  }
  const n = Number.parseFloat(q);
  return Number.isFinite(n) ? n : 0;
};

const clampBillQuantityCommit = (raw) => {
  const n = lineQuantityNumber(raw);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.max(MIN_BILL_LINE_QUANTITY, n);
};

const samePriceForManualMerge = (a, b) =>
  Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.0005;

/**
 * Whether an existing bill line is the same product as a manual-add row (merge qty instead of new line).
 * — Both non-empty SKUs (case-insensitive) must match, or differ → no match.
 * — Otherwise same trimmed name + same rate (and SKUs compatible: at most one side set, or both empty).
 */
const manualLineMatchesPending = (line, pending) => {
  const lineSku = String(line.sku ?? "").trim().toLowerCase();
  const pendingSku = String(pending.sku ?? "").trim().toLowerCase();
  const lineName = String(line.name ?? "").trim().toLowerCase();
  const pendingName = String(pending.name ?? "").trim().toLowerCase();

  if (!pendingName) return false;

  if (pendingSku && lineSku && pendingSku !== lineSku) {
    return false;
  }
  if (pendingSku && lineSku) {
    return pendingSku === lineSku;
  }

  if (!samePriceForManualMerge(line.price, pending.price)) {
    return false;
  }

  return pendingName === lineName;
};

const bogoBillableQuantity = (physicalQty, line = {}) => {
  const qty = lineQuantityNumber(physicalQty);
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  if (!itemHasBogoOffer(line)) return qty;
  return qty / 2;
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
  
  // GST rate from item
  const gstRate = Number(
    item.gstRate ??
    item.gst_rate ??
    item.taxRate ??
    0
  );

  const bogoText = String(item.bogoOffer ?? item.bogo_offer ?? "").trim();

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
    hsnCode: item.hsnCode ?? item.hsn_code ?? item.CommodityCode ?? "",
    gstRate: Number.isFinite(gstRate) ? gstRate : 0,
    batch: item.batch ?? item.batchNumber ?? "",
    bogoOffer: bogoText || null,
  };
};

/** Business calendar day for the POS machine (aligns with report date filters). */
const localCalendarYmd = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
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
    paymentMethod: "cash",
    paymentStatus: "paid",
    discount: "0",
    tax: "0",
    notes: "",
    transactionId: "",
    items: [],
    isSaving: false,
    isSaved: false,
    savedBillNo: null,
    savedBillId: null,
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
  const subtotal = bill.items.reduce((sum, line) => {
    const qty = lineQuantityNumber(line.quantity);
    const price = Number(line.price) || 0;
    if (!Number.isFinite(qty) || qty <= 0) return sum;
    const billable = bogoBillableQuantity(qty, line);
    return sum + price * billable;
  }, 0);
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
      paymentMethod: normalizePaymentMethod(bill.paymentMethod),
      items: Array.isArray(bill.items)
        ? bill.items.map((line) => ({
            lineId: line.lineId || `line-${createId()}`,
            sourceId: line.sourceId,
            name: line.name,
            sku: line.sku,
            price: Number(line.price || 0),
            mrp: Number(line.mrp || 0),
            quantity: (() => {
              const q = lineQuantityNumber(line.quantity);
              return q > 0 ? q : 1;
            })(),
            hsnCode: line.hsnCode || "",
            gstRate: Number(line.gstRate || 0),
            batch: line.batch || "",
            cessAmount: Number(line.cessAmount || 0),
            sgstAmount: line.sgstAmount !== undefined ? Number(line.sgstAmount) : undefined,
            cgstAmount: line.cgstAmount !== undefined ? Number(line.cgstAmount) : undefined,
            gstAmount: line.gstAmount !== undefined ? Number(line.gstAmount) : undefined,
            bogoOffer: line.bogoOffer ?? line.bogo_offer ?? null,
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

/** Build a POS bill tab from a full bill returned by GET /bills/:id (for Update bills flow). */
const draftTabFromApiBill = (bill) => {
  const labelIndex = 1;
  const base = buildBillDraft(labelIndex);
  const billId = Number(bill?.id ?? bill?._id);
  const items = Array.isArray(bill?.items) ? bill.items : [];

  const lines = items.map((it, idx) => {
    const itemId = it.itemId ?? it.item_id ?? null;
    const code = (it.itemCode ?? it.item_code ?? it.sku ?? "").toString().trim();
    const sourceId =
      itemId != null && String(itemId).trim() !== ""
        ? String(itemId)
        : code || `imported-${idx}`;

    return {
      lineId: `line-${createId()}`,
      sourceId,
      name: (it.itemName ?? it.item_name ?? it.name ?? "Item").toString().trim() || "Item",
      sku: code,
      price: Number(it.unitPrice ?? it.price ?? it.sellingPrice ?? 0) || 0,
      mrp: Number.isFinite(Number(it.mrp)) && Number(it.mrp) >= 0 ? Number(it.mrp) : 0,
      quantity: (() => {
        const q = Number(it.quantity ?? 1);
        return Number.isFinite(q) && q > 0 ? q : 1;
      })(),
      hsnCode: (it.hsnCode ?? it.hsn_code ?? "").toString(),
      gstRate: Number(it.taxRate ?? it.tax_rate ?? 0) || 0,
      batch: (it.batch ?? "").toString(),
      cessAmount: Number(it.cessAmount ?? 0) || 0,
      sgstAmount: undefined,
      cgstAmount: undefined,
      gstAmount: undefined,
      bogoOffer: null,
    };
  });

  const pm = String(bill?.paymentMethod ?? bill?.payment_method ?? "cash").toLowerCase();

  return {
    ...base,
    id: `bill-${createId()}`,
    customerName: (bill?.customerName ?? bill?.customer_name ?? "").toString(),
    customerPhone: (bill?.customerPhone ?? bill?.customer_phone ?? "").toString(),
    customerId: (bill?.customerId ?? bill?.customer_id ?? "").toString(),
    customerEmail: (bill?.customerEmail ?? bill?.customer_email ?? "").toString(),
    customerAddress: (bill?.customerAddress ?? bill?.customer_address ?? "").toString(),
    customerGstin: (bill?.customerGstin ?? bill?.customer_gstin ?? "").toString(),
    paymentMethod: normalizePaymentMethod(pm),
    paymentStatus: (bill?.paymentStatus ?? bill?.payment_status ?? "paid").toString(),
    discount: String(bill?.discount ?? 0),
    tax: String(bill?.tax ?? 0),
    transactionId: (bill?.transactionId ?? bill?.transaction_id ?? "").toString(),
    notes: "",
    items: lines,
    savedBillId: Number.isFinite(billId) && billId > 0 ? billId : null,
    savedBillNo: bill?.billNo ?? bill?.bill_no ?? null,
    isSaved: true,
    isSaving: false,
    error: null,
    isCustomerLookupLoading: false,
  };
};

export default function Billing() {
  // Tax columns: show either GST only, or SGST+CGST only (not all three)
  const SHOW_SPLIT_GST_COLUMNS = true; // set false to show only GST

  const initialStateRef = useRef(null);
  if (!initialStateRef.current) {
    const saved = typeof window !== "undefined" ? loadSavedState() : null;
    initialStateRef.current = saved ?? createInitialState();
  }
  const { toast } = useToast();
  const { selectedStore, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [bills, setBills] = useState(initialStateRef.current.bills);
  const [activeBillId, setActiveBillId] = useState(
    initialStateRef.current.activeBillId || initialStateRef.current.bills[0]?.id
  );
  const [barcodeValue, setBarcodeValue] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const barcodeInputRef = useRef(null);
  const [newItemRow, setNewItemRow] = useState({
    sku: "",
    name: "",
    quantity: 1,
    batch: "",
    price: 0,
    mrp: 0,
    gstRate: 0,
    cessAmount: 0,
    sgstAmount: 0,
    cgstAmount: 0,
    gstAmount: 0,
    hsnCode: "",
    bogoOffer: null,
  });
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchField, setSearchField] = useState(null); // 'sku' or 'name'
  const [itemSearchHighlightIndex, setItemSearchHighlightIndex] = useState(0);
  const searchInputRef = useRef(null);
  const skuInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const quantityInputRef = useRef(null);
  const itemHighlightRefs = useRef([]);
  const [recentBills, setRecentBills] = useState([]);
  const [printModalState, setPrintModalState] = useState({ isOpen: false, bill: null });
  const [isFetchingBill, setIsFetchingBill] = useState(false);
  const [fetchBillError, setFetchBillError] = useState(null);
  const [isReprintModalOpen, setIsReprintModalOpen] = useState(false);
  const [allItems, setAllItems] = useState([]); // Preloaded items for instant suggestions
  const [itemsLoading, setItemsLoading] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 400 });

  const focusBarcodeInput = useCallback(() => {
    requestAnimationFrame(() => {
      barcodeInputRef.current?.focus();
    });
  }, []);

  const updateDropdownPosition = useCallback(() => {
    // Get the active input element based on searchField
    let inputEl = null;
    if (searchField === 'name' && nameInputRef.current) {
      inputEl = nameInputRef.current;
    } else if (searchField === 'sku' && skuInputRef.current) {
      inputEl = skuInputRef.current;
    }
    
    if (!inputEl) return;
    
    const rect = inputEl.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    // Calculate optimal height (leave some margin)
    const maxDropdownHeight = Math.min(500, Math.max(spaceBelow - 20, spaceAbove - 20, 300));
    
    // Determine if we should show above or below
    const showAbove = spaceBelow < 300 && spaceAbove > spaceBelow;
    
    setDropdownPosition({
      top: showAbove 
        ? rect.top + window.scrollY - maxDropdownHeight - 4
        : rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: Math.max(rect.width, 400),
      maxHeight: maxDropdownHeight
    });
  }, [searchField]);

  // Fetch all items for client-side filtering (like Purchase Orders)
  const fetchAllItems = useCallback(async () => {
    const aggregated = [];
    const limit = 200; // backend hard limit per page
    let cursor = 0;
    let hasNext = true;
    let guard = 0;

    while (hasNext && guard < 1000) {
      const params = { limit, cursor };
      const storeId = selectedStore?.id || selectedStore?._id;
      if (storeId) {
        params.storeId = storeId;
      }
      const res = await itemsAPI.getItems(params);
      const pageItems = res?.data?.items || res?.items || res?.data || [];
      if (Array.isArray(pageItems)) {
        aggregated.push(...pageItems);
      }

      const pagination = res?.data?.pagination || res?.pagination;
      if (pagination?.hasNext && pagination?.nextCursor !== null && pagination?.nextCursor !== undefined) {
        cursor = pagination.nextCursor;
        hasNext = true;
      } else {
        hasNext = false;
      }
      guard += 1;
    }

    return aggregated;
  }, [selectedStore]);

  const hydrateItems = useCallback(async (cats = []) => {
    setItemsLoading(true);
    try {
      const items = await fetchAllItems();

      const flattened = items.map(item => {
        const categoryId = String(item.categoryId || '').trim();
        const subcategoryId = String(item.subcategoryId || '').trim();

        let categoryName = item.category?.name || 'Uncategorized';
        let subcategoryName = item.subcategory?.name || null;

        if (!categoryName || categoryName === 'Uncategorized') {
          const matchedCat = cats.find(cat =>
            String(cat.id || cat._id || '').trim() === categoryId
          );
          categoryName = matchedCat?.name || categoryName;

          if (matchedCat && subcategoryId) {
            const matchedSub = (matchedCat.subcategories || []).find(sub =>
              String(sub.code || sub.id || '').trim() === subcategoryId
            );
            subcategoryName = matchedSub?.name || subcategoryName;
          }
        }

        return {
          _id: item.id || item._id || item.itemCode,
          id: item.id || item._id || item.itemCode,
          name: item.name || item.ProductName || 'Unnamed Item',
          sku: item.sku || item.itemCode || item.ProductCode || '',
          price: item.price || item.sellingPrice || item.SalePrice || 0,
          cost: item.cost || item.costPrice || item.PurchaseOrderPrice || 0,
          unit: item.unit || item.UnitOfMeasure || 'pcs',
          category: categoryName,
          subcategory: subcategoryName,
          hsnCode: item.hsnCode || item.hsn_code || item.CommodityCode || '',
          barcode: item.barcode || item.UniversalProductCode || '',
          stock: item.stock ?? item.quantity ?? item.stockQuantity ?? null,
          quantity: item.stock ?? item.quantity ?? item.stockQuantity ?? null,
          mrp: item.mrp ?? item.MRP ?? item.maxRetailPrice ?? item.max_retail_price ?? 0,
          gstRate: item.gstRate ?? item.gst_rate ?? item.taxRate ?? item.tax_rate ?? 0,
          cessAmount: item.cessAmount ?? item.cess_amount ?? item.cess ?? 0,
          batch: item.batch ?? item.batchNumber ?? item.batch_number ?? '',
          bogoOffer: (() => {
            const raw = item.bogoOffer ?? item.bogo_offer;
            const t = raw != null ? String(raw).trim() : "";
            return t || null;
          })(),
        };
      });

      setAllItems(flattened);
    } catch (itemsError) {
      console.error('Error loading items:', itemsError);
      setAllItems([]);
    } finally {
      setItemsLoading(false);
    }
  }, [fetchAllItems]);

  // Load items when store changes
  useEffect(() => {
    if (selectedStore?._id || selectedStore?.id) {
      const loadItems = async () => {
        let cats = [];
        try {
          const hierarchyRes = await categoriesAPI.getCategoryHierarchy();
          cats = hierarchyRes?.data?.categories || hierarchyRes?.data || [];
        } catch (e) {
          console.error('Error loading category hierarchy, trying fallback:', e);
          try {
            const catsRes = await categoriesAPI.getCategories({ limit: 100 });
            cats = catsRes?.data?.categories || catsRes?.data || [];
          } catch (e2) {
            console.error('Error loading categories:', e2);
          }
        }
        await hydrateItems(Array.isArray(cats) ? cats : []);
      };
      loadItems();
    }
  }, [selectedStore, hydrateItems]);

  // Client-side filtering for instant suggestions (like Purchase Orders)
  const itemSearchResults = useMemo(() => {
    if (!itemSearchTerm.trim()) {
      return allItems.slice(0, 100); // Show first 100 items when no search term
    }

    const trimmedTerm = itemSearchTerm.trim();
    const isLikelyBarcode = trimmedTerm.length >= 6 && /^[A-Za-z0-9\-]+$/.test(trimmedTerm);
    const lower = trimmedTerm.toLowerCase();

    const suggestions = allItems
      .filter(i => {
        const nameMatch = (i.name || '').toLowerCase().includes(lower);
        const skuMatch = (i.sku || '').toLowerCase().includes(lower);
        const barcodeMatch = (i.barcode || '').toLowerCase().includes(lower);
        return nameMatch || skuMatch || barcodeMatch;
      })
      .sort((a, b) => {
        // Sort exact SKU/barcode matches first for barcode scans
        if (isLikelyBarcode) {
          const aSkuExact = (a.sku || '').toUpperCase() === trimmedTerm.toUpperCase();
          const aBarcodeExact = (a.barcode || '').toUpperCase() === trimmedTerm.toUpperCase();
          const bSkuExact = (b.sku || '').toUpperCase() === trimmedTerm.toUpperCase();
          const bBarcodeExact = (b.barcode || '').toUpperCase() === trimmedTerm.toUpperCase();
          const aExact = aSkuExact || aBarcodeExact;
          const bExact = bSkuExact || bBarcodeExact;
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;
        }
        // Sort by name match quality (exact matches first, then starts with, then contains)
        const aNameLower = (a.name || '').toLowerCase();
        const bNameLower = (b.name || '').toLowerCase();
        if (aNameLower.startsWith(lower) && !bNameLower.startsWith(lower)) return -1;
        if (!aNameLower.startsWith(lower) && bNameLower.startsWith(lower)) return 1;
        return 0;
      })
      .slice(0, 200); // Show up to 200 results (scrollable)

    return suggestions.map((item) => normalizeItem(item));
  }, [itemSearchTerm, allItems]);

  // Reset highlight to top when results or dropdown visibility change
  useEffect(() => {
    setItemSearchHighlightIndex(0);
  }, [itemSearchResults.length, showSearchDropdown]);

  // Scroll highlighted item into view when navigating with arrows
  useEffect(() => {
    if (!showSearchDropdown || itemSearchResults.length === 0) return;
    itemHighlightRefs.current[itemSearchHighlightIndex]?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
  }, [itemSearchHighlightIndex, showSearchDropdown, itemSearchResults.length]);

  const selectItemFromSearch = (item) => {
    const normalized = normalizeItem(item);
    
    // BOGO items default to quantity 2 (user can change before adding)
    const quantity = bogoDefaultQuantity(normalized);
    const billableQty = bogoBillableQuantity(quantity, normalized);
    const baseAmount = (normalized.price || 0) * billableQty;
    const gstRate = normalized.gstRate || 0;
    const gstAmount = (baseAmount * gstRate) / 100;
    const sgstAmount = gstAmount / 2;
    const cgstAmount = gstAmount / 2;
    
    // Get CESS amount from item if available, otherwise 0
    const cessAmount = Number(item.cessAmount ?? item.cess_amount ?? item.cess ?? 0) || 0;
    
    // Populate the new item row (don't add immediately - let user edit quantity first)
    const itemRow = {
      sku: normalized.sku || "",
      name: normalized.name || "",
      quantity: quantity,
      batch: normalized.batch || "",
      price: normalized.price || 0,
      mrp: normalized.mrp || 0,
      gstRate: normalized.gstRate || 0,
      cessAmount: cessAmount,
      sgstAmount: sgstAmount,
      cgstAmount: cgstAmount,
      gstAmount: gstAmount,
      hsnCode: normalized.hsnCode || "",
      bogoOffer: normalized.bogoOffer || null,
    };
    
    setNewItemRow(itemRow);
    setItemSearchTerm("");
    setShowSearchDropdown(false);
    setSearchField(null);
    
    // Focus the Quantity field so user can edit it before adding
    setTimeout(() => {
      quantityInputRef.current?.focus();
      quantityInputRef.current?.select();
    }, 100);
  };

  useEffect(() => {
    focusBarcodeInput();
  }, [activeBillId, focusBarcodeInput]);

  // Update dropdown position when it's shown
  useEffect(() => {
    if (showSearchDropdown) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        updateDropdownPosition();
      });
    }
  }, [showSearchDropdown, updateDropdownPosition]);

  // Recalculate GST amounts when quantity or price changes in newItemRow
  useEffect(() => {
    if (newItemRow.name && newItemRow.gstRate !== undefined) {
      const quantity = lineQuantityNumber(newItemRow.quantity) || 1;
      const price = Number(newItemRow.price) || 0;
      const gstRate = Number(newItemRow.gstRate) || 0;
      const billableQty = bogoBillableQuantity(quantity, newItemRow);
      const baseAmount = price * billableQty;
      
      const newGstAmount = (baseAmount * gstRate) / 100;
      const newSgstAmount = newGstAmount / 2;
      const newCgstAmount = newGstAmount / 2;
      
      // Only update if values have changed to avoid infinite loops
      const currentGstAmount = Number(newItemRow.gstAmount) || 0;
      if (Math.abs(newGstAmount - currentGstAmount) > 0.01) {
        setNewItemRow(prev => ({
          ...prev,
          gstAmount: newGstAmount,
          sgstAmount: newSgstAmount,
          cgstAmount: newCgstAmount,
        }));
      }
    }
  }, [newItemRow.quantity, newItemRow.price, newItemRow.gstRate, newItemRow.bogoOffer]);

  // Update dropdown position on scroll/resize
  useEffect(() => {
    if (!showSearchDropdown) return;
    const handleReposition = () => updateDropdownPosition();
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [showSearchDropdown, updateDropdownPosition]);

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

  /** After a new bill is saved, close that tab and return to a fresh draft (original POS behaviour). */
  const closeBillAfterSave = useCallback(
    (savedTabId) => {
      setBills((prevBills) => {
        if (prevBills.length === 0) {
          return prevBills;
        }

        if (prevBills.length === 1 && prevBills[0].id === savedTabId) {
          const newBill = buildBillDraft(1);
          setActiveBillId(newBill.id);
          return [newBill];
        }

        const filtered = prevBills.filter((bill) => bill.id !== savedTabId);
        if (filtered.length === prevBills.length) {
          return prevBills;
        }

        const renumbered = renumberBills(filtered);
        const fallbackActiveId =
          renumbered[renumbered.length - 1]?.id ?? renumbered[0]?.id ?? "";
        setActiveBillId((current) =>
          current === savedTabId ? fallbackActiveId : current
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
          storeId: selectedStore?.id || selectedStore?._id
        });
        const customer =
          response?.data?.customer ??
          response?.customer ??
          response?.data ??
          null;
        const isNew = Boolean(response?.data?.isNew);

        if (customer) {
          const resolvedCustomerId = (() => {
            const cid = customer.customerId ?? customer.id;
            if (cid != null && cid !== "") return String(cid);
            return trimmed;
          })();
          updateBill(billId, (bill) => ({
            isCustomerLookupLoading: false,
            customerPhone: trimmed,
            customerName: customer.customerName ?? bill.customerName ?? "",
            customerEmail: customer.customerEmail ?? bill.customerEmail ?? "",
            customerAddress: customer.customerAddress ?? bill.customerAddress ?? "",
            customerGstin: customer.customerGstin ?? bill.customerGstin ?? "",
            customerId: resolvedCustomerId,
            paymentMethod: bill.paymentMethod === 'credit'
              ? bill.paymentMethod
              : customer.paymentMethod ?? bill.paymentMethod,
            paymentStatus:
              (customer.paymentMethod ?? bill.paymentMethod) === 'credit'
                ? 'pending'
                : bill.paymentStatus ?? 'paid',
          }));
          toast({
            title: isNew ? "New customer" : "Customer loaded",
            description: isNew
              ? "Details loaded from this phone. Add name and GSTIN if needed, then save the bill."
              : customer.customerName
                ? `Welcome back, ${customer.customerName}.`
                : "Saved customer details applied."
          });
          focusBarcodeInput();
        } else {
          updateBill(billId, {
            isCustomerLookupLoading: false
          });
          toast({
            title: "Lookup failed",
            description: "Could not load customer for this phone number.",
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
    [selectedStore?.id, selectedStore?._id, toast, updateBill, focusBarcodeInput]
  );

  const addItemToBill = (billId, item) => {
    updateBill(billId, (bill) => {
      const existingIndex = bill.items.findIndex(
        (line) => line.sourceId === item.sourceId
      );

      if (existingIndex >= 0) {
        const delta = bogoQuantityIncrement(item);
        const updatedItems = bill.items.map((line, index) => {
          if (index !== existingIndex) return line;
          const prev = lineQuantityNumber(line.quantity);
          const safe = Number.isFinite(prev) && prev > 0 ? prev : 1;
          return {
            ...line,
            quantity: safe + delta,
            gstAmount: undefined,
            sgstAmount: undefined,
            cgstAmount: undefined,
          };
        });
        return {
          items: updatedItems,
        };
      }

      const newLine = {
        lineId: `line-${createId()}`,
        sourceId: item.sourceId,
        name: item.name,
        sku: item.sku,
        price: item.price,
        mrp: item.mrp,
        quantity: bogoDefaultQuantity(item),
        hsnCode: item.hsnCode ?? "",
        gstRate: item.gstRate ?? 0,
        batch: item.batch ?? "",
        cessAmount: 0,
        sgstAmount: undefined, // Will be calculated
        cgstAmount: undefined, // Will be calculated
        gstAmount: undefined, // Will be calculated
        bogoOffer: item.bogoOffer ?? null,
      };

      return {
        items: [...bill.items, newLine],
      };
    });
    focusBarcodeInput();
  };

  const updateItemQuantity = (billId, lineId, quantityValue) => {
    let quantity;
    if (quantityValue === "" || quantityValue === null || quantityValue === undefined) {
      quantity = "";
    } else if (typeof quantityValue === "string" && /^\d+\.$/.test(quantityValue.trim())) {
      quantity = quantityValue.trim();
    } else {
      const parsed = Number.parseFloat(quantityValue);
      quantity = !Number.isFinite(parsed) || parsed < 0 ? "" : parsed;
    }
    
    updateBill(billId, (bill) => ({
      items: bill.items.map((line) =>
        line.lineId === lineId
          ? {
              ...line,
              quantity,
              // Drop manual GST so BOGO / qty changes recalc from rate × billable amount
              gstAmount: undefined,
              sgstAmount: undefined,
              cgstAmount: undefined,
            }
          : line
      ),
    }));
  };

  const updateLineItemField = (billId, lineId, field, value) => {
    updateBill(billId, (bill) => ({
      items: bill.items.map((line) =>
        line.lineId === lineId ? { ...line, [field]: value } : line
      ),
    }));
  };

  const removeItemFromBill = (billId, lineId) => {
    updateBill(billId, (bill) => ({
      items: bill.items.filter((line) => line.lineId !== lineId),
    }));
  };

  const addManualItem = (billId) => {
    if (!newItemRow.name || !newItemRow.name.trim()) {
      toast({
        title: "Product name required",
        description: "Please enter a product name to add the item.",
        variant: "destructive",
      });
      return;
    }

    const pendingSnapshot = {
      sku: newItemRow.sku,
      name: newItemRow.name.trim(),
      price: Number(newItemRow.price) || 0,
    };

    const addQty = (() => {
      const qn = lineQuantityNumber(newItemRow.quantity);
      return qn > 0
        ? Math.max(MIN_BILL_LINE_QUANTITY, qn)
        : bogoDefaultQuantity(newItemRow);
    })();

    const skuTrim = String(newItemRow.sku ?? "").trim();
    const stableSourceId =
      skuTrim ||
      `manual:${pendingSnapshot.name.toLowerCase()}|${pendingSnapshot.price.toFixed(2)}`;

    const bill = bills.find((b) => b.id === billId);
    const premergeIndex = bill
      ? bill.items.findIndex((line) => manualLineMatchesPending(line, pendingSnapshot))
      : -1;
    let toastTitle = "Item added";
    let toastDescription = `${pendingSnapshot.name} added to the bill`;
    if (premergeIndex >= 0 && bill) {
      const line = bill.items[premergeIndex];
      const prev = lineQuantityNumber(line.quantity);
      const safe = Number.isFinite(prev) && prev > 0 ? prev : 0;
      const nextQty = Number((safe + addQty).toFixed(4));
      toastTitle = "Quantity updated";
      toastDescription = `${pendingSnapshot.name}: total quantity is now ${nextQty}`;
    }

    updateBill(billId, (bill) => {
      const existingIndex = bill.items.findIndex((line) =>
        manualLineMatchesPending(line, pendingSnapshot)
      );

      if (existingIndex >= 0) {
        const updatedItems = bill.items.map((line, index) => {
          if (index !== existingIndex) return line;
          const prev = lineQuantityNumber(line.quantity);
          const safe = Number.isFinite(prev) && prev > 0 ? prev : 0;
          const nextQty = Number((safe + addQty).toFixed(4));
          return {
            ...line,
            quantity: nextQty,
            sku: (line.sku && line.sku.trim()) || skuTrim || line.sku,
            bogoOffer: line.bogoOffer ?? newItemRow.bogoOffer ?? null,
            gstAmount: undefined,
            sgstAmount: undefined,
            cgstAmount: undefined,
          };
        });
        return {
          items: updatedItems,
        };
      }

      const newLine = {
        lineId: `line-${createId()}`,
        sourceId: stableSourceId,
        name: pendingSnapshot.name,
        sku: skuTrim,
        price: pendingSnapshot.price,
        mrp: Number(newItemRow.mrp) || 0,
        quantity: addQty,
        hsnCode: newItemRow.hsnCode || "",
        gstRate: Number(newItemRow.gstRate) || 0,
        batch: newItemRow.batch || "",
        cessAmount: Number(newItemRow.cessAmount) || 0,
        sgstAmount: Number(newItemRow.sgstAmount) || 0,
        cgstAmount: Number(newItemRow.cgstAmount) || 0,
        gstAmount: Number(newItemRow.gstAmount) || 0,
        bogoOffer: newItemRow.bogoOffer || null,
      };

      return {
        items: [...bill.items, newLine],
      };
    });

    // Reset new item row
    setNewItemRow({
      sku: "",
      name: "",
      quantity: 1,
      batch: "",
      price: 0,
      mrp: 0,
      gstRate: 0,
      cessAmount: 0,
      sgstAmount: 0,
      cgstAmount: 0,
      gstAmount: 0,
      hsnCode: "",
      bogoOffer: null,
    });

    toast({
      title: toastTitle,
      description: toastDescription,
    });
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
      savedBillId: null,
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
        const quantity = lineQuantityNumber(line.quantity);
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
        const billableQty = bogoBillableQuantity(quantity, line);
        const total = Number((billableQty * unitPrice).toFixed(2));

        // Build payload object, only including defined fields
        const payload = {
          name: itemName,
          quantity: Number(quantity.toFixed(4)),
          unitPrice: Number(unitPrice.toFixed(2)),
          sellingPrice: Number(unitPrice.toFixed(2)),
          total
        };

        const bogoLabel = String(line.bogoOffer ?? line.bogo_offer ?? "").trim();
        if (bogoLabel) {
          payload.bogoOffer = bogoLabel;
        }

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

    const runSaveBill = async (transactionId) => {
      const existingSavedId = billToSave.savedBillId;
      const isUpdate =
        existingSavedId !== null &&
        existingSavedId !== undefined &&
        Number.isFinite(Number(existingSavedId)) &&
        Number(existingSavedId) > 0;

      const apiPayload = {
        storeId: selectedStore.id,
        date: localCalendarYmd(),
        customerName: trimmedCustomerName || undefined,
        customerPhone: trimmedCustomerPhone || undefined,
        customerId: trimmedCustomerId || trimmedCustomerPhone || undefined,
        customerEmail: trimmedCustomerEmail || undefined,
        customerAddress: (billToSave.customerAddress || "").trim() || undefined,
        customerGstin: (billToSave.customerGstin || "").trim() || undefined,
        paymentMethod: billToSave.paymentMethod,
        paymentStatus,
        transactionId: transactionId ?? undefined,
        subtotal: Number(totals.subtotal.toFixed(2)),
        discount: Number(totals.discount.toFixed(2)),
        tax: Number(totals.tax.toFixed(2)),
        total: Number(totals.total.toFixed(2)),
        items: itemsPayload
      };

      const response = isUpdate
        ? await billsAPI.updateBill(Number(existingSavedId), apiPayload)
        : await billsAPI.createBill(apiPayload);

      const persistedBill =
        response?.data?.bill ??
        response?.bill ??
        response?.data ??
        response;

      const assignedBillNo = persistedBill?.billNo ?? persistedBill?.bill_no ?? billToSave.savedBillNo;
      const numericBillId = Number(persistedBill?.id ?? persistedBill?.billId);
      const nextSavedBillId =
        Number.isFinite(numericBillId) && numericBillId > 0
          ? numericBillId
          : isUpdate
            ? Number(existingSavedId)
            : null;

      if (isUpdate) {
        updateBill(billId, {
          isSaving: false,
          isSaved: true,
          paymentStatus,
          savedBillNo: assignedBillNo ?? null,
          savedBillId: nextSavedBillId,
        });
      } else {
        // Keep the bill on screen after creating so the user can review/print.
        // A new blank bill is created only when the user clicks "New Bill".
        updateBill(billId, {
          isSaving: false,
          isSaved: true,
          paymentStatus,
          savedBillNo: assignedBillNo ?? null,
          savedBillId: nextSavedBillId,
        });
      }

      toast({
        title: isUpdate ? "Bill updated" : "Bill saved",
        description: assignedBillNo
          ? isUpdate
            ? `Bill ${assignedBillNo} updated successfully.`
            : `Bill ${assignedBillNo} saved successfully.`
          : isUpdate
            ? "Bill updated successfully."
            : "Bill saved successfully.",
      });

      try {
        const printableBill = await fetchBillDetails(
          {
            billId: nextSavedBillId ?? persistedBill?.id ?? persistedBill?.billId ?? null,
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
              // Prefer API MRP (what was saved) so receipt shows correct stored MRP
              // Only use local MRP when API didn't return one (e.g. legacy bills)
              const mrp =
                Number.isFinite(Number(it.mrp)) && Number(it.mrp) >= 0
                  ? Number(it.mrp)
                  : local?.mrp !== undefined && local?.mrp !== null && Number.isFinite(Number(local.mrp))
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
                        : Number.isFinite(Number(it.price))
                          ? Number(it.price)
                          : 0;
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
          items: enrichedItems,
          customerName: (printableBill?.customerName ?? printableBill?.customer_name ?? billToSave.customerName ?? '').toString().trim() || undefined
        };
        addBillToRecent(enhancedPrintableBill);
        setPrintModalState({ isOpen: true, bill: enhancedPrintableBill });
      } catch (printError) {
        console.warn("Unable to load bill for printing:", printError);
        addBillToRecent({
          id: nextSavedBillId ?? persistedBill?.id ?? persistedBill?.billId ?? null,
          billNo: assignedBillNo ?? null,
          total: totals.total,
          date: persistedBill?.date ?? new Date().toISOString(),
          paymentMethod: persistedBill?.paymentMethod ?? billToSave.paymentMethod,
          totalSavings: totals.savings || 0,
          userName:
            persistedBill?.userName ??
            persistedBill?.billBy ??
            persistedBill?.cashierName ??
            null
        });
      } finally {
        // Do not auto-close newly created bills; user can click "New Bill" when ready.
      }
    };

    // UPI: pay via Razorpay (key from API uses server RAZORPAY_KEY_ID; live keys => live checkout)
    if (billToSave.paymentMethod === "upi") {
      try {
        const orderRes = await billsAPI.createRazorpayOrder(totals.total, `bill_${Date.now()}`);
        const keyId = orderRes?.keyId ?? import.meta.env?.VITE_RAZORPAY_KEY_ID;
        const orderId = orderRes?.orderId;
        if (!keyId || !orderId) throw new Error("Razorpay order failed");
        await loadRazorpayScript();
        const storeName = selectedStore?.name ?? "Store";
        const rzp = new window.Razorpay({
          key: keyId,
          order_id: orderId,
          amount: orderRes.amount,
          currency: orderRes.currency || "INR",
          name: storeName,
          description: "Bill payment",
          handler: async function (res) {
            try {
              await billsAPI.verifyRazorpayPayment(res.razorpay_order_id, res.razorpay_payment_id, res.razorpay_signature);
              await runSaveBill(res.razorpay_payment_id);
            } catch (e) {
              updateBill(billId, { isSaving: false });
              toast({ title: "Payment failed", description: e?.message ?? "Verification failed", variant: "destructive" });
            }
          },
          modal: { ondismiss: () => updateBill(billId, { isSaving: false }) },
        });
        rzp.open();
      } catch (err) {
        updateBill(billId, { isSaving: false });
        toast({ title: "Payment error", description: err?.message ?? "Could not start payment", variant: "destructive" });
      }
      setTimeout(() => focusBarcodeInput(), 0);
      return;
    }

    try {
      await runSaveBill(trimmedTransactionId || undefined);
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

  /** Open a bill for editing when navigated from Update bills (`state.editBillId`). */
  useEffect(() => {
    const rawId = location.state?.editBillId;
    if (rawId === undefined || rawId === null || rawId === "") {
      return;
    }

    const editId = Number(rawId);
    if (!Number.isFinite(editId) || editId <= 0) {
      navigate("/billing", { replace: true, state: {} });
      return;
    }

    if (bills.length >= MAX_BILL_TABS) {
      toast({
        title: "Too many bills open",
        description: `Close a tab first (maximum ${MAX_BILL_TABS}).`,
        variant: "destructive",
      });
      navigate("/billing", { replace: true, state: {} });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await billsAPI.getBill(editId);
        const bill = res?.data?.bill ?? res?.bill ?? res?.data;
        if (!bill || cancelled) {
          return;
        }

        const billStore = Number(bill.storeId ?? bill.store_id);
        const currentStore = Number(selectedStore?.id ?? selectedStore?._id);
        if (
          Number.isFinite(billStore) &&
          billStore > 0 &&
          Number.isFinite(currentStore) &&
          currentStore > 0 &&
          billStore !== currentStore
        ) {
          toast({
            title: "Different store",
            description: "Switch the header store to match this bill, then try again.",
            variant: "destructive",
          });
          navigate("/billing", { replace: true, state: {} });
          return;
        }

        const draft = draftTabFromApiBill(bill);

        setBills((prev) => {
          if (prev.length >= MAX_BILL_TABS) {
            toast({
              title: "Too many bills open",
              description: `Close a tab first (maximum ${MAX_BILL_TABS}).`,
              variant: "destructive",
            });
            return prev;
          }
          return renumberBills([...prev, draft]);
        });

        setActiveBillId(draft.id);

        toast({
          title: "Bill loaded",
          description: bill.billNo || bill.bill_no ? `Editing ${bill.billNo || bill.bill_no}` : "You can change lines and press Update bill.",
        });
      } catch (error) {
        const description =
          error.response?.data?.message ?? error.message ?? "Unable to load that bill.";
        toast({
          title: "Could not open bill",
          description,
          variant: "destructive",
        });
      } finally {
        if (!cancelled) {
          navigate("/billing", { replace: true, state: {} });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.state, navigate, selectedStore, toast, bills.length]);

  const handleBarcodeSubmit = async (event) => {
    event.preventDefault();
    const value = barcodeValue.trim();
    if (!value || !activeBillId) {
      return;
    }

    setIsScanning(true);
    setScanError(null);

    try {
      // Match by SKU or barcode (aligned with item repo: barcode OR item_code / UniversalProductCode OR ProductCode)
      const valueUpper = value.toUpperCase();
      const foundItem = allItems.find(i => {
        const skuMatch = (i.sku || i.itemCode || '').toString().toUpperCase() === valueUpper;
        const barcodeMatch = (i.barcode || '').toString().toUpperCase() === valueUpper;
        return skuMatch || barcodeMatch;
      });

      if (foundItem) {
        // GST priority: fetch from backend so PO tax_percent wins over Products/Items gstRate
        const apiStoreId = selectedStore?._id || selectedStore?.id || selectedStore;
        let enriched = foundItem;
        try {
          const res = await itemsAPI.getItemByBarcode(value, { storeId: apiStoreId });
          const backendItem = res?.data?.item ?? res?.item ?? null;
          if (backendItem) {
            enriched = { ...foundItem, ...backendItem };
          }
        } catch {
          // Ignore lookup errors; fallback to preloaded item gstRate
        }

        const normalizedItem = normalizeItem(enriched);
        addItemToBill(activeBillId, normalizedItem);
        toast({
          title: "Item added",
          description: `${normalizedItem.name} added to the bill`
        });
        setBarcodeValue("");
        setIsScanning(false);
        focusBarcodeInput();
        return;
      }

      // Fallback to API if not found in preloaded items
      const apiStoreId = selectedStore?._id || selectedStore?.id || selectedStore;
      const response = await itemsAPI.getItemByBarcode(value, { storeId: apiStoreId });
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
  const billTotals = activeBill ? getBillTotals(activeBill) : { total: 0, subtotal: 0, discount: 0, tax: 0, savings: 0 };

  return (
    <div className="relative -m-3 sm:-m-4 md:-m-6 bg-background flex flex-col overflow-hidden min-w-0 min-h-0" style={{ height: 'calc(100vh - 10rem)' }}>
      {/* Header Bar */}
      <div className="bg-primary text-primary-foreground flex flex-col border-b shadow-sm min-w-0">
        {/* Total Amount Display - Big and Prominent */}
        <div className="px-3 py-3 sm:px-4 sm:py-4 md:px-6 bg-primary/90 border-b border-primary-foreground/20">
          <div className="flex flex-col gap-3 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
            <div className="flex items-baseline gap-2 sm:gap-3 min-w-0">
              <span className="text-sm font-medium text-primary-foreground/80 shrink-0">Total Amount:</span>
              <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary-foreground tracking-tight truncate">
                {toCurrency(billTotals.total)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-sm">
              <div className="flex flex-col items-end">
                <span className="text-primary-foreground/70">Subtotal</span>
                <span className="font-semibold text-primary-foreground">{toCurrency(billTotals.subtotal)}</span>
              </div>
              {billTotals.savings > 0 && (
                <div className="flex flex-col items-end">
                  <span className="text-primary-foreground/70">Savings</span>
                  <span className="font-semibold text-emerald-300">{toCurrency(billTotals.savings)}</span>
                </div>
              )}
              {billTotals.discount > 0 && (
                <div className="flex flex-col items-end">
                  <span className="text-primary-foreground/70">Discount</span>
                  <span className="font-semibold text-red-300">-{toCurrency(billTotals.discount)}</span>
                </div>
              )}
              {billTotals.tax > 0 && (
                <div className="flex flex-col items-end">
                  <span className="text-primary-foreground/70">Tax</span>
                  <span className="font-semibold text-primary-foreground">{toCurrency(billTotals.tax)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Top Row - Title and Actions: stack on mobile so buttons don't overflow */}
        <div className="px-3 py-2 sm:px-4 sm:py-3 md:px-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between min-w-0">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 shrink-0">
            <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2 truncate">
              <Receipt className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
              Billing
            </h1>
            {activeBill?.savedBillId && activeBill?.savedBillNo ? (
              <span className="text-xs sm:text-sm bg-primary-foreground/20 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full shrink-0">
                Editing #{activeBill.savedBillNo}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsReprintModalOpen(true)}
              className="bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground shrink-0 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
            >
              <Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
              Reprint
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => clearBill(activeBillId)}
              className="bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground shrink-0 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
            >
              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
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
              className="bg-primary-foreground hover:bg-primary-foreground/90 text-primary disabled:opacity-50 disabled:cursor-not-allowed shrink-0 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
              New Bill
            </Button>
          </div>
        </div>

        {/* Bill Tabs - Always show, at the top */}
        {bills.length > 0 && (
          <div className="px-3 pb-2 sm:px-4 md:px-6 border-t border-primary-foreground/20 min-w-0">
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

      {/* Main Content Area: stack right panel below on small screens */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-w-0 min-h-0">
        {/* Left Panel - Items Display */}
        <div className="flex-1 flex flex-col bg-muted/30 overflow-hidden min-w-0 min-h-0">
          {/* Barcode Input Only */}
          <div className="p-3 sm:p-4 border-b bg-background shadow-sm min-w-0">
            <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  ref={barcodeInputRef}
                  placeholder="Scan barcode to add item..."
                  value={barcodeValue}
                  onChange={(event) => {
                    setBarcodeValue(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && barcodeValue.trim() && !isScanning) {
                      event.preventDefault();
                      handleBarcodeSubmit(event);
                    }
                  }}
                  disabled={isScanning}
                  className="pl-10 h-11 text-base"
                  autoComplete="off"
                  inputMode="numeric"
                  autoFocus
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

            {scanError && (
              <div className="mt-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {scanError}
              </div>
            )}
          </div>

          {/* Items Display Area - Detailed Table Format */}
          <div className="flex-1 bg-background min-h-0" style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <div className="flex-1 overflow-y-auto min-h-0" style={{ position: 'relative' }}>
              <div className="p-4" style={{ position: 'relative', overflow: 'visible' }}>
                {/* Table Container with Horizontal Scroll */}
                <div className="overflow-x-auto" style={{ position: 'relative' }}>
                  <table className="w-full border-collapse" style={{ position: 'relative', tableLayout: 'auto' }}>
                    {/* Header Row */}
                    <thead className="bg-muted/50 sticky top-0 z-10">
                      <tr className="border-b">
                        <th className="p-2 text-center text-xs font-semibold text-muted-foreground min-w-[50px] whitespace-nowrap align-top">S.No.</th>
                        <th className="p-2 text-left text-xs font-semibold text-muted-foreground min-w-[80px] whitespace-nowrap align-top">P Code</th>
                        <th className="p-2 text-left text-xs font-semibold text-muted-foreground min-w-[200px] whitespace-nowrap align-top">Product Name</th>
                        <th className="p-2 text-center text-xs font-semibold text-muted-foreground min-w-[80px] whitespace-nowrap align-top">Quantity</th>
                        <th className="p-2 text-left text-xs font-semibold text-muted-foreground min-w-[100px] whitespace-nowrap align-top">Batch</th>
                        <th className="p-2 text-right text-xs font-semibold text-muted-foreground min-w-[80px] whitespace-nowrap align-top">Rate</th>
                        <th className="p-2 text-right text-xs font-semibold text-muted-foreground min-w-[80px] whitespace-nowrap align-top">MRP</th>
                        <th className="p-2 text-right text-xs font-semibold text-muted-foreground min-w-[70px] whitespace-nowrap align-top">Tax%</th>
                        <th className="p-2 text-right text-xs font-semibold text-muted-foreground min-w-[80px] whitespace-nowrap align-top">CESSAmt</th>
                        {SHOW_SPLIT_GST_COLUMNS ? (
                          <>
                            <th className="p-2 text-right text-xs font-semibold text-muted-foreground min-w-[80px] whitespace-nowrap align-top">SGST</th>
                            <th className="p-2 text-right text-xs font-semibold text-muted-foreground min-w-[80px] whitespace-nowrap align-top">CGST</th>
                          </>
                        ) : (
                          <th className="p-2 text-right text-xs font-semibold text-muted-foreground min-w-[80px] whitespace-nowrap align-top">GST</th>
                        )}
                        <th className="p-2 text-right text-xs font-semibold text-muted-foreground min-w-[100px] whitespace-nowrap align-top">Base Amount</th>
                        <th className="p-2 text-left text-xs font-semibold text-muted-foreground min-w-[100px] whitespace-nowrap align-top">HSN Code</th>
                        <th className="p-2 text-center text-xs font-semibold text-muted-foreground min-w-[60px] whitespace-nowrap align-top">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeBill?.items.map((line, index) => {
                        const qtyNum = lineQuantityNumber(line.quantity);
                        const safeQty = Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : 0;
                        const billableQty = bogoBillableQuantity(safeQty, line);
                        const baseAmount = Number(line.price || 0) * billableQty;
                        const gstRate = line.gstRate ?? 0;
                        // Use manual values if set, otherwise calculate
                        const gstAmount = line.gstAmount !== undefined ? line.gstAmount : (baseAmount * gstRate) / 100;
                        const sgstAmount = line.sgstAmount !== undefined ? line.sgstAmount : gstAmount / 2;
                        const cgstAmount = line.cgstAmount !== undefined ? line.cgstAmount : gstAmount / 2;
                        const cessAmount = line.cessAmount !== undefined ? line.cessAmount : 0;
                        
                        return (
                          <tr
                            key={line.lineId}
                            className="border-b hover:bg-muted/30 transition-colors"
                          >
                            {/* Serial Number */}
                            <td className="p-2 text-center">
                              <span className="text-sm font-medium text-muted-foreground">
                                {index + 1}
                              </span>
                            </td>
                            
                            {/* P Code */}
                            <td className="p-2 text-left">
                              <span className="text-sm text-muted-foreground">
                                {line.sku || "—"}
                              </span>
                            </td>
                            
                            {/* Product Name */}
                            <td className="p-2 text-left">
                              <div className="flex flex-col gap-1 items-start">
                                <span className="text-sm font-medium">
                                  {line.name || "—"}
                                </span>
                                {line.bogoOffer ? (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] font-medium px-1.5 py-0 bg-amber-100 text-amber-950 border-amber-200/80 hover:bg-amber-100"
                                  >
                                    {line.bogoOffer}
                                  </Badge>
                                ) : null}
                              </div>
                            </td>
                            
                            {/* Quantity */}
                            <td className="p-2 text-center">
                              <Input
                                type="number"
                                min={MIN_BILL_LINE_QUANTITY}
                                step="any"
                                value={line.quantity === "" || line.quantity === null || line.quantity === undefined ? "" : line.quantity}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  if (value === "") {
                                    updateItemQuantity(activeBillId, line.lineId, "");
                                    return;
                                  }
                                  const trimmed = value.trim();
                                  if (/^\d+\.$/.test(trimmed)) {
                                    updateItemQuantity(activeBillId, line.lineId, trimmed);
                                    return;
                                  }
                                  const quantity = Number(value);
                                  if (!Number.isNaN(quantity) && quantity >= 0) {
                                    updateItemQuantity(activeBillId, line.lineId, quantity);
                                  }
                                }}
                                onBlur={(event) => {
                                  const value = event.target.value;
                                  const quantity = clampBillQuantityCommit(value);
                                  updateItemQuantity(activeBillId, line.lineId, quantity);
                                }}
                                className="w-24 h-8 text-center mx-auto"
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    const value = event.target.value;
                                    const quantity = clampBillQuantityCommit(value);
                                    updateItemQuantity(activeBillId, line.lineId, quantity);
                                    event.currentTarget.blur();
                                  }
                                }}
                              />
                            </td>
                            
                            {/* Batch */}
                            <td className="p-2 text-left">
                              <span className="text-sm text-muted-foreground">
                                {line.batch || "—"}
                              </span>
                            </td>
                            
                            {/* Rate */}
                            <td className="p-2 text-right">
                              <span className="text-sm font-semibold">
                                ₹{Number(line.price || 0).toFixed(2)}
                              </span>
                            </td>
                            
                            {/* MRP */}
                            <td className="p-2 text-right">
                              <span className="text-sm line-through text-muted-foreground">
                                ₹{Number(line.mrp || 0).toFixed(2)}
                              </span>
                            </td>

                            {/* Tax% */}
                            <td className="p-2 text-right">
                              <span className="text-sm text-muted-foreground">
                                {Number(gstRate || 0).toFixed(2)}%
                              </span>
                            </td>
                            
                            {/* CESSAmt */}
                            <td className="p-2 text-right">
                              <span className="text-sm">
                                ₹{cessAmount.toFixed(2)}
                              </span>
                            </td>
                            
                            {SHOW_SPLIT_GST_COLUMNS ? (
                              <>
                                {/* SGST */}
                                <td className="p-2 text-right">
                                  <span className="text-sm">₹{sgstAmount.toFixed(2)}</span>
                                </td>

                                {/* CGST */}
                                <td className="p-2 text-right">
                                  <span className="text-sm">₹{cgstAmount.toFixed(2)}</span>
                                </td>
                              </>
                            ) : (
                              /* GST */
                              <td className="p-2 text-right">
                                <span className="text-sm">₹{gstAmount.toFixed(2)}</span>
                              </td>
                            )}
                            
                            {/* Base Amount */}
                            <td className="p-2 text-right">
                              <span className="text-sm font-bold text-primary">
                                ₹{baseAmount.toFixed(2)}
                              </span>
                            </td>
                            
                            {/* HSN Code */}
                            <td className="p-2 text-left">
                              <span className="text-sm text-muted-foreground">
                                {line.hsnCode || "—"}
                              </span>
                            </td>
                            
                            {/* Action */}
                            <td className="p-2 text-center">
                              <div className="flex justify-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => removeItemFromBill(activeBillId, line.lineId)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      
                      {/* Empty Row for Manual Entry - Always visible */}
                      <tr className="border-b-2 border-dashed bg-muted/20">
                        {/* Serial Number */}
                        <td className="p-2 text-center">
                          <span className="text-sm font-medium text-muted-foreground">
                            {(activeBill?.items.length || 0) + 1}
                          </span>
                        </td>
                        
                        {/* P Code */}
                        <td className="p-2 text-left" style={{ position: 'relative', zIndex: showSearchDropdown && searchField === 'sku' ? 1000 : 'auto' }}>
                          <div className="relative">
                            <Input
                              ref={skuInputRef}
                              type="text"
                              value={newItemRow.sku}
                              onChange={(event) => {
                                const value = event.target.value;
                                setNewItemRow({ ...newItemRow, sku: value });
                                setItemSearchTerm(value);
                                setSearchField('sku');
                                updateDropdownPosition();
                                setShowSearchDropdown(true);
                              }}
                              onFocus={() => {
                                setSearchField('sku');
                                if (newItemRow.sku) {
                                  setItemSearchTerm(newItemRow.sku);
                                } else {
                                  setItemSearchTerm("");
                                }
                                updateDropdownPosition();
                                setShowSearchDropdown(true);
                              }}
                              onBlur={() => {
                                setTimeout(() => setShowSearchDropdown(false), 200);
                              }}
                              placeholder="Enter P Code"
                              className="h-8 text-sm text-left"
                              onKeyDown={(event) => {
                                if (showSearchDropdown && itemSearchResults.length > 0) {
                                  if (event.key === "ArrowDown") {
                                    event.preventDefault();
                                    setItemSearchHighlightIndex((i) => Math.min(i + 1, itemSearchResults.length - 1));
                                    return;
                                  }
                                  if (event.key === "ArrowUp") {
                                    event.preventDefault();
                                    setItemSearchHighlightIndex((i) => Math.max(i - 1, 0));
                                    return;
                                  }
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    selectItemFromSearch(itemSearchResults[itemSearchHighlightIndex]);
                                    return;
                                  }
                                }
                                if (event.key === "Enter") {
                                  if (newItemRow.sku.trim()) {
                                    event.preventDefault();
                                    addManualItem(activeBillId);
                                  }
                                } else if (event.key === "Escape") {
                                  setShowSearchDropdown(false);
                                }
                              }}
                            />
                            {showSearchDropdown && searchField === 'sku' && (
                              <div 
                                className="fixed bg-background border rounded-lg shadow-xl"
                                style={{ 
                                  zIndex: 99999,
                                  top: `${dropdownPosition.top}px`,
                                  left: `${dropdownPosition.left}px`,
                                  width: `${dropdownPosition.width}px`,
                                  maxWidth: '500px',
                                  maxHeight: `${dropdownPosition.maxHeight || 500}px`,
                                  overflowY: 'auto',
                                  overflowX: 'hidden',
                                  display: 'block'
                                }}
                              >
                                {itemsLoading ? (
                                  <div className="bg-background border rounded-lg shadow-xl p-2">
                                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      <span className="text-sm">Loading items...</span>
                                    </div>
                                  </div>
                                ) : itemSearchResults.length > 0 ? (
                                  <div style={{ maxHeight: `${(dropdownPosition.maxHeight || 500) - 20}px`, overflowY: 'auto' }}>
                                    {itemSearchResults.map((item, idx) => (
                                      <div
                                        key={item.sourceId}
                                        ref={(el) => { itemHighlightRefs.current[idx] = el; }}
                                        className={`p-2 hover:bg-muted cursor-pointer border-b last:border-b-0 transition-colors ${idx === itemSearchHighlightIndex ? 'bg-primary/10' : ''}`}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          selectItemFromSearch(item);
                                        }}
                                      >
                                        <div className="flex justify-between items-center">
                                          <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm truncate">{item.name}</p>
                                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                              {item.sku && (
                                                <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                                              )}
                                              {item.hsnCode && (
                                                <p className="text-xs text-muted-foreground">HSN: {item.hsnCode}</p>
                                              )}
                                              {item.bogoOffer ? (
                                                <Badge
                                                  variant="secondary"
                                                  className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-950 border-amber-200/80"
                                                >
                                                  {item.bogoOffer} · qty 2
                                                </Badge>
                                              ) : null}
                                            </div>
                                          </div>
                                          <span className="font-semibold text-primary ml-2 text-sm">{toCurrency(item.price)}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : itemSearchTerm.trim().length > 0 ? (
                                  <div className="bg-background border rounded-lg shadow-xl p-2">
                                    <div className="text-center text-sm text-muted-foreground">
                                      No items found
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </div>
                        </td>
                        
                        {/* Product Name */}
                        <td className="p-2 text-left" style={{ position: 'relative' }}>
                          <div className="relative w-full">
                            <Input
                              ref={nameInputRef}
                              type="text"
                              value={newItemRow.name}
                              onChange={(event) => {
                                const value = event.target.value;
                                setNewItemRow({ ...newItemRow, name: value });
                                setItemSearchTerm(value);
                                setSearchField('name');
                                updateDropdownPosition();
                                setShowSearchDropdown(true);
                              }}
                              onFocus={() => {
                                setSearchField('name');
                                if (newItemRow.name && newItemRow.name.length > 0) {
                                  setItemSearchTerm(newItemRow.name);
                                } else {
                                  setItemSearchTerm("");
                                }
                                updateDropdownPosition();
                                setShowSearchDropdown(true);
                              }}
                              onBlur={(e) => {
                                // Delay hiding to allow click on dropdown items
                                const relatedTarget = e.relatedTarget;
                                setTimeout(() => {
                                  // Check if focus moved to dropdown or if clicking on dropdown
                                  const activeElement = document.activeElement;
                                  if (!activeElement || 
                                      (!activeElement.closest('.search-dropdown') && 
                                       !relatedTarget?.closest('.search-dropdown'))) {
                                    setShowSearchDropdown(false);
                                  }
                                }, 300);
                              }}
                              placeholder="Type product name to search..."
                              className="h-8 text-sm font-medium w-full text-left"
                              onKeyDown={(event) => {
                                if (showSearchDropdown && itemSearchResults.length > 0) {
                                  if (event.key === "ArrowDown") {
                                    event.preventDefault();
                                    setItemSearchHighlightIndex((i) => Math.min(i + 1, itemSearchResults.length - 1));
                                    return;
                                  }
                                  if (event.key === "ArrowUp") {
                                    event.preventDefault();
                                    setItemSearchHighlightIndex((i) => Math.max(i - 1, 0));
                                    return;
                                  }
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    selectItemFromSearch(itemSearchResults[itemSearchHighlightIndex]);
                                    return;
                                  }
                                }
                                if (event.key === "Enter") {
                                  if (newItemRow.name.trim()) {
                                    event.preventDefault();
                                    addManualItem(activeBillId);
                                  }
                                } else if (event.key === "Escape") {
                                  setShowSearchDropdown(false);
                                }
                              }}
                            />
                            {showSearchDropdown && searchField === 'name' && (
                              <div 
                                className="search-dropdown fixed bg-background border-2 border-primary/20 rounded-lg shadow-2xl"
                                style={{ 
                                  zIndex: 99999,
                                  top: `${dropdownPosition.top}px`,
                                  left: `${dropdownPosition.left}px`,
                                  width: `${dropdownPosition.width}px`,
                                  maxWidth: '500px',
                                  maxHeight: `${dropdownPosition.maxHeight || 500}px`,
                                  overflowY: 'auto',
                                  overflowX: 'hidden',
                                  position: 'fixed',
                                  display: 'block'
                                }}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                }}
                              >
                                {itemsLoading ? (
                                  <div className="p-4">
                                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      <span className="text-sm">Loading items...</span>
                                    </div>
                                  </div>
                                ) : itemSearchResults.length > 0 ? (
                                  <div className="overflow-y-auto" style={{ maxHeight: `${(dropdownPosition.maxHeight || 500) - 40}px` }}>
                                    <div className="p-2 bg-muted/50 border-b text-xs font-semibold text-muted-foreground sticky top-0 bg-background z-10">
                                      Select an item ({itemSearchResults.length} found)
                                    </div>
                                    <div>
                                      {itemSearchResults.map((item, idx) => (
                                        <div
                                          key={item.sourceId}
                                          ref={(el) => { itemHighlightRefs.current[idx] = el; }}
                                          className={`p-3 hover:bg-primary/10 cursor-pointer border-b last:border-b-0 transition-colors active:bg-primary/20 ${idx === itemSearchHighlightIndex ? 'bg-primary/10' : ''}`}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            selectItemFromSearch(item);
                                          }}
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            selectItemFromSearch(item);
                                          }}
                                          style={{ cursor: 'pointer' }}
                                        >
                                          <div className="flex justify-between items-start gap-2">
                                            <div className="flex-1 min-w-0">
                                              <p className="font-semibold text-sm text-foreground">{item.name}</p>
                                              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                                {item.sku && (
                                                  <p className="text-xs text-muted-foreground font-medium">Code: {item.sku}</p>
                                                )}
                                                {item.hsnCode && (
                                                  <p className="text-xs text-muted-foreground">HSN: {item.hsnCode}</p>
                                                )}
                                                {item.bogoOffer ? (
                                                  <Badge
                                                    variant="secondary"
                                                    className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-950 border-amber-200/80"
                                                  >
                                                    {item.bogoOffer} · qty 2
                                                  </Badge>
                                                ) : null}
                                              </div>
                                            </div>
                                            <span className="font-bold text-primary text-base whitespace-nowrap ml-2">{toCurrency(item.price)}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : itemSearchTerm.trim().length > 0 && !itemsLoading ? (
                                  <div className="p-4">
                                    <div className="text-center text-sm text-muted-foreground">
                                      <p>No items found for "{itemSearchTerm}"</p>
                                      <p className="text-xs mt-1">Try a different search term</p>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </div>
                        </td>
                        
                        {/* Quantity */}
                        <td className="p-2 text-center">
                          <Input
                            ref={quantityInputRef}
                            type="number"
                            min={MIN_BILL_LINE_QUANTITY}
                            step="any"
                            value={newItemRow.quantity === "" || newItemRow.quantity === null || newItemRow.quantity === undefined ? "" : newItemRow.quantity}
                            onChange={(event) => {
                              const value = event.target.value;
                              if (value === "") {
                                setNewItemRow({ ...newItemRow, quantity: "" });
                                return;
                              }
                              const trimmed = value.trim();
                              if (/^\d+\.$/.test(trimmed)) {
                                setNewItemRow({ ...newItemRow, quantity: trimmed });
                                return;
                              }
                              const numValue = Number(value);
                              if (!Number.isNaN(numValue) && numValue >= 0) {
                                setNewItemRow({ ...newItemRow, quantity: numValue });
                              }
                            }}
                            onBlur={(event) => {
                              const value = event.target.value;
                              const quantity = clampBillQuantityCommit(value);
                              setNewItemRow({ ...newItemRow, quantity });
                            }}
                            className="w-24 h-8 text-center mx-auto"
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                const quantity = clampBillQuantityCommit(newItemRow.quantity);
                                if (newItemRow.name && newItemRow.name.trim()) {
                                  setNewItemRow({ ...newItemRow, quantity });
                                  addManualItem(activeBillId);
                                  // After adding, focus back to product name for next item
                                  setTimeout(() => {
                                    nameInputRef.current?.focus();
                                  }, 100);
                                }
                              }
                            }}
                          />
                          {newItemRow.bogoOffer ? (
                            <p className="text-[10px] text-muted-foreground mt-1 max-w-[8rem] mx-auto leading-tight">
                              Offer: default qty 2 — edit if needed
                            </p>
                          ) : null}
                        </td>
                        
                        {/* Batch */}
                        <td className="p-2 text-left">
                          <Input
                            type="text"
                            value={newItemRow.batch}
                            onChange={(event) =>
                              setNewItemRow({ ...newItemRow, batch: event.target.value })
                            }
                            placeholder="—"
                            className="h-8 text-sm text-left"
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                addManualItem(activeBillId);
                              }
                            }}
                          />
                        </td>
                        
                        {/* Rate */}
                        <td className="p-2 text-right align-top">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={newItemRow.price}
                            onChange={(event) =>
                              setNewItemRow({ ...newItemRow, price: Number(event.target.value) || 0 })
                            }
                            placeholder="0.00"
                            className="h-8 text-sm text-right font-semibold w-full block"
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                addManualItem(activeBillId);
                              }
                            }}
                          />
                        </td>
                        
                        {/* MRP */}
                        <td className="p-2 text-right align-top">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={newItemRow.mrp}
                            onChange={(event) =>
                              setNewItemRow({ ...newItemRow, mrp: Number(event.target.value) || 0 })
                            }
                            placeholder="0.00"
                            className="h-8 text-sm text-right line-through text-muted-foreground w-full block"
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                addManualItem(activeBillId);
                              }
                            }}
                          />
                        </td>

                        {/* Tax% */}
                        <td className="p-2 text-right align-top">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={newItemRow.gstRate}
                            onChange={(event) =>
                              setNewItemRow({ ...newItemRow, gstRate: Number(event.target.value) || 0 })
                            }
                            placeholder="0"
                            className="h-8 text-sm text-right w-full block"
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                addManualItem(activeBillId);
                              }
                            }}
                          />
                        </td>
                        
                        {/* CESSAmt */}
                        <td className="p-2 text-right align-top">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={newItemRow.cessAmount}
                            placeholder="0.00"
                            readOnly
                            disabled
                            className="h-8 text-sm text-right w-full block bg-muted cursor-not-allowed"
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                addManualItem(activeBillId);
                              }
                            }}
                          />
                        </td>
                        
                        {SHOW_SPLIT_GST_COLUMNS ? (
                          <>
                            {/* SGST */}
                            <td className="p-2 text-right align-top">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={newItemRow.sgstAmount}
                                placeholder="0.00"
                                readOnly
                                disabled
                                className="h-8 text-sm text-right w-full block bg-muted cursor-not-allowed"
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    addManualItem(activeBillId);
                                  }
                                }}
                              />
                            </td>

                            {/* CGST */}
                            <td className="p-2 text-right align-top">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={newItemRow.cgstAmount}
                                placeholder="0.00"
                                readOnly
                                disabled
                                className="h-8 text-sm text-right w-full block bg-muted cursor-not-allowed"
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    addManualItem(activeBillId);
                                  }
                                }}
                              />
                            </td>
                          </>
                        ) : (
                          /* GST */
                          <td className="p-2 text-right align-top">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={newItemRow.gstAmount}
                              placeholder="0.00"
                              readOnly
                              disabled
                              className="h-8 text-sm text-right w-full block bg-muted cursor-not-allowed"
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  addManualItem(activeBillId);
                                }
                              }}
                            />
                          </td>
                        )}
                        
                        {/* Base Amount */}
                        <td className="p-2 text-right align-top">
                          <span className="text-sm font-bold text-primary block">
                            ₹
                            {(
                              (newItemRow.price || 0) *
                              bogoBillableQuantity(
                                lineQuantityNumber(newItemRow.quantity) || 1,
                                newItemRow
                              )
                            ).toFixed(2)}
                          </span>
                        </td>
                        
                        {/* HSN Code */}
                        <td className="p-2 text-left">
                          <Input
                            type="text"
                            value={newItemRow.hsnCode}
                            onChange={(event) =>
                              setNewItemRow({ ...newItemRow, hsnCode: event.target.value })
                            }
                            placeholder="—"
                            className="h-8 text-sm text-left"
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                addManualItem(activeBillId);
                              }
                            }}
                          />
                        </td>
                        
                        {/* Action */}
                        <td className="p-2 text-center">
                          <div className="flex justify-center">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => addManualItem(activeBillId)}
                              className="h-8 px-3"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Payment & Summary */}
        <div className="w-full lg:w-96 flex-shrink-0 lg:flex-shrink-0 bg-background border-t lg:border-t-0 lg:border-l flex flex-col overflow-hidden min-w-0 min-h-0">
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 min-h-0">
            {/* Discount & Tax - At Top */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Adjustments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Discount</label>
                  <div className="p-2 bg-muted rounded-md">
                    <span className="text-sm">{toCurrency(activeBill?.discount || 0)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tax</label>
                  <div className="p-2 bg-muted rounded-md">
                    <span className="text-sm">{toCurrency(activeBill?.tax || 0)}</span>
                  </div>
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
                  <label className="text-sm font-medium">Payment Method</label>
                  <Select
                    value={normalizePaymentMethod(activeBill?.paymentMethod)}
                    onValueChange={(value) => updateBill(activeBillId, { paymentMethod: value, paymentStatus: value === "credit" ? "pending" : "paid", ...(value !== "online" && value !== "upi" ? { transactionId: "" } : {}) })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Transaction ID: input for Online (manual entry), read-only for UPI (from Razorpay) */}
                {activeBill?.paymentMethod === "online" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Transaction ID (required for Online)</label>
                    <Input
                      placeholder="Enter transaction ID or reference"
                      value={activeBill?.transactionId ?? ""}
                      onChange={(e) => updateBill(activeBillId, { transactionId: e.target.value })}
                      className="w-full"
                    />
                  </div>
                )}
                {activeBill?.paymentMethod === "upi" && activeBill?.transactionId && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Transaction ID</label>
                    <div className="p-2 bg-muted rounded-md">
                      <span className="text-sm">{activeBill.transactionId}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Customer Details – editable (required for Credit) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Customer Details</CardTitle>
                {activeBill?.paymentMethod === "credit" && (
                  <p className="text-xs text-muted-foreground font-normal mt-1">Name and phone are required for credit bills.</p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    Customer Phone {activeBill?.paymentMethod === "credit" && <span className="text-destructive">*</span>}
                    {activeBill?.isCustomerLookupLoading && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
                    )}
                  </label>
                  <Input
                    placeholder="Enter phone number, then press Enter"
                    value={activeBill?.customerPhone ?? ""}
                    onChange={(e) => updateBill(activeBillId, { customerPhone: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        prefillCustomerByPhone(activeBillId, activeBill?.customerPhone);
                      }
                    }}
                    disabled={activeBill?.isCustomerLookupLoading}
                    className="w-full"
                    autoComplete="tel"
                  />
                  <p className="text-xs text-muted-foreground">
                    Press Enter to load saved details from the database, or create a new customer record for this number.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Customer Name {activeBill?.paymentMethod === "credit" && <span className="text-destructive">*</span>}</label>
                  <Input
                    placeholder="Enter customer name"
                    value={activeBill?.customerName ?? ""}
                    onChange={(e) => updateBill(activeBillId, { customerName: e.target.value })}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    placeholder="customer@example.com"
                    value={activeBill?.customerEmail ?? ""}
                    onChange={(e) => updateBill(activeBillId, { customerEmail: e.target.value })}
                    className="w-full"
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Address</label>
                  <Input
                    placeholder="Billing / shipping address"
                    value={activeBill?.customerAddress ?? ""}
                    onChange={(e) => updateBill(activeBillId, { customerAddress: e.target.value })}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">GSTIN</label>
                  <Input
                    placeholder="15-character GSTIN (e.g. 22AAAAA0000A1Z5)"
                    value={activeBill?.customerGstin ?? ""}
                    onChange={(e) =>
                      updateBill(activeBillId, {
                        customerGstin: e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "")
                      })
                    }
                    maxLength={15}
                    className="w-full font-mono tracking-wide"
                    autoComplete="off"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Footer — Create bill (default POS). "Update bill" only when editing an existing bill (e.g. from Update bills). */}
          <div className="border-t p-3 sm:p-4 md:p-6 bg-background space-y-3">
            {activeBill?.error && (
              <p className="text-sm text-destructive">{activeBill.error}</p>
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
                  {activeBill?.savedBillId ? "Updating bill..." : "Creating bill..."}
                </>
              ) : (
                <>
                  <Save className="h-5 w-5 mr-2" />
                  {activeBill?.savedBillId ? "Update bill" : "Create bill"}
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