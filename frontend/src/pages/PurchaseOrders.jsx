import { useState, useEffect, useRef } from "react";
import { Plus, Search, X, Save, ShoppingCart, Check, Scale, Tag, Percent, Receipt, Minus, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { purchaseOrdersAPI, suppliersAPI, categoriesAPI, creditsAPI, itemsAPI } from "@/services/api";
import { getErrorMessage, getErrorTitle } from "@/utils/errorMessages";
import BarcodeLabel from "@/components/BarcodeLabel";
import { useAuth } from "@/contexts/AuthContext";
import JsBarcode from "jsbarcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

const EMPTY_ITEM_TEMPLATE = {
  particulars: "",
  sku: "",
  unit: "",
  itemId: "",
  categoryName: "",
  subcategoryName: "",
  batchNumber: "",
  hsnNumber: "",
  expiryDate: "",
  poQty: 0,
  discountType: '%',
  disPercent: 0,
  dis: 0,
  taxPercent: 0,
  price: 0,
  total: 0,
  mrp: 0
};

const createEmptyItem = () => ({ ...EMPTY_ITEM_TEMPLATE });

const PurchaseOrders = () => {
  const { toast } = useToast();
  const { selectedStore } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [stores, setStores] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingPO, setEditingPO] = useState(null);
  const [allItems, setAllItems] = useState([]); // Flattened list from Categories -> Subcategories -> Items
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemSuggestions, setItemSuggestions] = useState({}); // rowIndex -> items list
  const [openSuggestIndex, setOpenSuggestIndex] = useState(null);
  const [dropdownLayout, setDropdownLayout] = useState({
    top: 0,
    left: 0,
    width: 0,
    placement: "bottom"
  });
  const inputRefs = useRef({});
  const lastBarcodeScanRef = useRef({ barcode: '', time: 0 });
  const SCAN_DEBOUNCE_MS = 1800;
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [barcodeData, setBarcodeData] = useState(null);
  const [currentPOId, setCurrentPOId] = useState(null);
  const [highlightedRowIndex, setHighlightedRowIndex] = useState(null);
  const [barcodeScannerValue, setBarcodeScannerValue] = useState('');

  const [formData, setFormData] = useState({
    supplier: "",
    supplierName: "",
    supplierDetails: null, // Store full supplier details
    store: "",
    quotationDate: new Date().toISOString().split('T')[0],
    validDate: "",
    dueDate: "",
    items: [createEmptyItem()],
    totalItems: 0,
    totalQty: 0,
    price: 0,
    discount: 0,
    totalTax: 0,
    totalAmount: 0,
    partialPayment: "",
    isCredit: false
  });

  // Load data when component mounts or when selected store changes
  useEffect(() => {
    if (selectedStore?._id || selectedStore?.id) {
      const storeId = selectedStore._id ?? selectedStore.id;
      loadData(storeId);
    } else {
      setLoadError("Select a store to begin creating a purchase order.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStore]);

  // Auto-populate store field with selected store from header
  useEffect(() => {
    if (selectedStore?._id || selectedStore?.id) {
      setFormData(prev => {
        // Update store if it's empty or different from selected store
        const resolvedStoreId = selectedStore._id ?? selectedStore.id;
        if (!prev.store || prev.store !== resolvedStoreId) {
          // Clear supplier selection when store changes (suppliers will be reloaded by first useEffect)
          return { ...prev, store: resolvedStoreId, supplier: "", supplierName: "", supplierDetails: null };
        }
        return prev;
      });
    }
  }, [selectedStore]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openSuggestIndex !== null && !event.target.closest('.suggestions-dropdown')) {
        setOpenSuggestIndex(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openSuggestIndex]);

  useEffect(() => {
    if (openSuggestIndex === null) return;
    const handleReposition = () => updateDropdownPosition(openSuggestIndex);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [openSuggestIndex]);

  useEffect(() => {
    if (!allItems.length) return;
    setItemSuggestions(prev => {
      const next = { ...prev };
      formData.items.forEach((_, index) => {
        if (!next[index] || next[index].length === 0) {
          next[index] = allItems;
        }
      });
      return next;
    });
  }, [allItems, formData.items.length]);

  const normalizeCollection = (value) => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      if (Array.isArray(value.categories)) return value.categories;
      if (Array.isArray(value.data)) return value.data;
      if (Array.isArray(value.items)) return value.items;
    }
    return [];
  };

  const fetchAllItems = async () => {
    const aggregated = [];
    const limit = 200; // backend hard limit per page
    let cursor = 0;
    let hasNext = true;
    let guard = 0;

    while (hasNext && guard < 1000) {
      const res = await itemsAPI.getItems({ limit, cursor });
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
  };

  const hydrateItems = async (cats = []) => {
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
        };
      });

      setAllItems(flattened);
    } catch (itemsError) {
      console.error('Error loading items:', itemsError);
      setAllItems([]);
    } finally {
      setItemsLoading(false);
    }
  };

  // Helper function to filter suppliers by store ID
  const filterSuppliersByStore = (suppliers, storeId) => {
    if (!storeId || !Array.isArray(suppliers)) {
      return suppliers;
    }

    const storeIdStr = String(storeId);
    
    return suppliers.filter((supplier) => {
      // Check if supplier has direct store_id field matching the selected store
      const supplierStoreId = supplier.store_id;
      if (supplierStoreId && String(supplierStoreId) === storeIdStr) {
        return true;
      }

      // Check if supplier has stores array with matching store
      if (Array.isArray(supplier.stores) && supplier.stores.length > 0) {
        return supplier.stores.some((storeEntry) => {
          const store = storeEntry?.store ?? storeEntry;
          const storeIdValue = store?._id ?? store?.id ?? store?.storeId ?? store?.store_id;
          return storeIdValue && String(storeIdValue) === storeIdStr;
        });
      }

      return false;
    });
  };

  const loadData = async (storeIdToFilter = null) => {
    // Don't load if no store is selected
    const resolvedStoreId = selectedStore?._id ?? selectedStore?.id;
    if (!resolvedStoreId) {
      return;
    }

    // Use provided storeIdToFilter or fall back to formData.store or selectedStore
    const filterStoreId = storeIdToFilter ?? formData.store ?? resolvedStoreId;

    setLoading(true);
    setLoadError(null);
    try {
      const [suppliersRes, storesRes] = await Promise.all([
        suppliersAPI.getSuppliers({ limit: 100 }),
        suppliersAPI.getStores({ isActive: true })
      ]);
      const supplierList =
        suppliersRes?.data?.suppliers ??
        suppliersRes?.suppliers ??
        suppliersRes?.data ??
        suppliersRes ??
        [];
      const storeList =
        storesRes?.data?.stores ??
        storesRes?.stores ??
        storesRes?.data ??
        storesRes ??
        [];

      // Filter suppliers based on the selected store
      const allSuppliers = Array.isArray(supplierList) ? supplierList : [];
      const filteredSuppliers = filterStoreId 
        ? filterSuppliersByStore(allSuppliers, filterStoreId)
        : allSuppliers;

      setSuppliers(filteredSuppliers);
      setStores(Array.isArray(storeList) ? storeList : []);

      // Fetch categories for reference
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

      setCategories(Array.isArray(cats) ? cats : []);

      // Kick off item loading asynchronously (don't block UI)
      hydrateItems(cats);
    } catch (error) {
      console.error("Error loading purchase order dependencies:", error);
      setLoadError(error?.message || "Unable to load purchase order data.");
      toast({
        title: getErrorTitle(error),
        description: getErrorMessage(error, "Failed to load data", "purchase order data"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateDropdownPosition = (index) => {
    const inputEl = inputRefs.current[index];
    if (!inputEl) return;
    const rect = inputEl.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const approximateDropdownHeight = Math.min(480, viewportHeight - 32);
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const placeAbove = spaceBelow < approximateDropdownHeight && spaceAbove > spaceBelow;
    const topPosition = placeAbove
      ? rect.top + window.scrollY - 8
      : rect.bottom + window.scrollY + 8;
    setDropdownLayout({
      top: Math.max(8, topPosition),
      left: rect.left + window.scrollX,
      width: Math.max(rect.width, 560),
      placement: placeAbove ? "top" : "bottom"
    });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, createEmptyItem()]
    });
  };

  const removeItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    if (newItems.length === 0) {
      newItems.push(createEmptyItem());
    }
    setFormData({
      ...formData,
      items: newItems
    });
    calculateTotals(newItems);
  };

  const clearItem = (index) => {
    const items = [...formData.items];
    items[index] = createEmptyItem();
    setFormData({
      ...formData,
      items
    });
    setItemSuggestions(prev => {
      const updated = { ...prev };
      delete updated[index];
      return updated;
    });
    calculateTotals(items);
    setOpenSuggestIndex(null);
  };

  const updateItem = (index, field, value) => {
    const items = [...formData.items];
    items[index] = { ...items[index], [field]: value };

    // Auto-calculate total based on discount type
    if (field === 'poQty' || field === 'price' || field === 'disPercent' || field === 'dis' || field === 'taxPercent' || field === 'discountType') {
      const poQty = items[index].poQty || 0;
      const price = items[index].price || 0;
      const disPercent = items[index].disPercent || 0;
      const dis = items[index].dis || 0;
      const discountType = items[index].discountType || '%';
      const taxPercent = items[index].taxPercent || 0;

      // Calculate discount based on type
      let totalDiscountAmount = 0;
      const subtotalBeforeDiscount = poQty * price;

      if (discountType === '%') {
        // When type is %, use disPercent as percentage of the subtotal
        totalDiscountAmount = (subtotalBeforeDiscount * disPercent) / 100;
      } else { // discountType === 'Rate'
        // When type is Rate, use dis as a fixed total amount for the line item
        totalDiscountAmount = dis;
      }

      // Calculate subtotal after discount
      const subtotalAfterDiscount = subtotalBeforeDiscount - totalDiscountAmount;

      // Apply tax to the discounted subtotal
      const totalTaxAmount = (subtotalAfterDiscount * taxPercent) / 100;

      // Calculate total for the line item
      items[index].total = subtotalAfterDiscount + totalTaxAmount;
    }

    setFormData({ ...formData, items });
    calculateTotals(items);
  };

  const searchItems = async (index, term) => {
    const trimmedTerm = term.trim();
    const isLikelyBarcode = trimmedTerm.length >= 6 && /^[A-Za-z0-9\-]+$/.test(trimmedTerm);

    // Check if current row already has an item - if so and scanning new barcode, we'll create new row
    const currentItem = formData.items[index];
    const currentRowHasItem = currentItem && currentItem.itemId;

    // If row has item and scanning a new barcode, create new row first (don't update current field)
    let targetIndex = index;
    if (currentRowHasItem && isLikelyBarcode) {
      // Check if this is the same item being scanned again (compare with current SKU)
      const isSameItem = currentItem.sku && (currentItem.sku.toUpperCase() === trimmedTerm.toUpperCase());

      // If different item, create new row before searching
      if (!isSameItem) {
        // Store the original row's item name
        const originalItemName = currentItem.particulars || '';

        // Immediately restore the original row's item name to prevent concatenation
        // Do this synchronously before creating new row
        const currentItems = [...formData.items];
        currentItems[index] = {
          ...currentItems[index],
          particulars: originalItemName
        };

        // Add a new empty row with the scanned barcode
        const newItem = {
          ...createEmptyItem(),
          particulars: trimmedTerm
        };
        currentItems.push(newItem);
        targetIndex = currentItems.length - 1;

        // Update state with both changes at once
        setFormData({ ...formData, items: currentItems });
      } else {
        // Same item scanned - restore the item name and don't do anything else
        if (currentItem.particulars !== term && currentItem.particulars) {
          const currentItems = [...formData.items];
          currentItems[index] = {
            ...currentItems[index],
            particulars: currentItem.particulars
          };
          setFormData({ ...formData, items: currentItems });
        }
        return;
      }
    } else {
      // Update field first for regular search (only if row doesn't have an item or it's not a barcode)
      updateItem(index, 'particulars', term);
    }

    if (!term) {
      setItemSuggestions(prev => ({ ...prev, [targetIndex]: allItems }));
      setOpenSuggestIndex(targetIndex);
      return;
    }

    // If it's a barcode scan, try to find exact SKU or barcode match and auto-select
    if (isLikelyBarcode) {
      const exactMatch = allItems.find(i => {
        const skuMatch = (i.sku || '').toUpperCase() === trimmedTerm.toUpperCase();
        const barcodeMatch = (i.barcode || '').toUpperCase() === trimmedTerm.toUpperCase();
        return skuMatch || barcodeMatch;
      });

      if (exactMatch) {
        const now = Date.now();
        if (
          lastBarcodeScanRef.current.barcode === trimmedTerm &&
          now - lastBarcodeScanRef.current.time < SCAN_DEBOUNCE_MS
        ) {
          return;
        }
        lastBarcodeScanRef.current = { barcode: trimmedTerm, time: now };
        // Found exact SKU or barcode match - auto-select it in the target row
        setItemSuggestions(prev => ({ ...prev, [targetIndex]: [exactMatch] }));
        setOpenSuggestIndex(targetIndex);
        chooseSuggestion(targetIndex, exactMatch);
        return;
      }
    }

    // Regular search: Filter from preloaded items (from Categories)
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
        return 0;
      });
    setItemSuggestions(prev => ({ ...prev, [targetIndex]: suggestions }));
    setOpenSuggestIndex(targetIndex);
  };

  const chooseSuggestion = (index, suggestion) => {
    const items = [...formData.items];
    const currentItem = items[index];

    // Check if this is the same item already selected
    const isSameItem = currentItem && currentItem.itemId === suggestion._id;
    if (isSameItem) {
      // Same item - just keep it, don't update
      setOpenSuggestIndex(null);
      return;
    }

    // Populate the target row (index is already the correct row - new row created in searchItems if needed)
    items[index] = {
      ...items[index],
      particulars: suggestion.name || suggestion.itemName || '',
      sku: suggestion.sku || '',
      unit: suggestion.unit || '',
      price: suggestion.cost || suggestion.price || 0,
      mrp: suggestion.price || 0,
      itemId: suggestion._id || '',
      categoryName: suggestion.category || '',
      subcategoryName: suggestion.subcategory || '',
      hsnNumber: suggestion.hsnCode || suggestion.hsnNumber || '',
      // Attempt to set a default tax if available via tags
    };
    setFormData({ ...formData, items });
    calculateTotals(items);
    setOpenSuggestIndex(null);
  };

  // Barcode scanner handler (with duplicate-scan prevention)
  const handleBarcodeScan = async (barcode) => {
    const trimmedBarcode = barcode.trim();
    if (!trimmedBarcode || trimmedBarcode.length < 2) {
      return;
    }
    const now = Date.now();
    if (
      lastBarcodeScanRef.current.barcode === trimmedBarcode &&
      now - lastBarcodeScanRef.current.time < SCAN_DEBOUNCE_MS
    ) {
      return;
    }
    lastBarcodeScanRef.current = { barcode: trimmedBarcode, time: now };

    const isLikelyBarcode = trimmedBarcode.length >= 6 && /^[A-Za-z0-9\-]+$/.test(trimmedBarcode);

    if (!isLikelyBarcode) {
      return;
    }

    // Find item by SKU/barcode
    const foundItem = allItems.find(i =>
      (i.sku || '').toUpperCase() === trimmedBarcode.toUpperCase()
    );

    if (!foundItem) {
      toast({
        title: "Item not found",
        description: `No item found with barcode: ${trimmedBarcode}`,
        variant: "destructive"
      });
      return;
    }

    // Check if this item already exists in the table
    const existingRowIndex = formData.items.findIndex(
      item => item.itemId === foundItem._id || item.sku === foundItem.sku
    );

    if (existingRowIndex !== -1) {
      // Same item exists - highlight it
      setHighlightedRowIndex(existingRowIndex);
      // Remove highlight after 2 seconds
      setTimeout(() => {
        setHighlightedRowIndex(null);
      }, 2000);

      // Scroll to the highlighted row
      const rowElement = document.querySelector(`[data-row-index="${existingRowIndex}"]`);
      if (rowElement) {
        rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      toast({
        title: "Item already exists",
        description: "Item is already in the table (highlighted)",
      });
    } else {
      // Different item - add to new row
      const lastRowIndex = formData.items.length - 1;
      const lastItem = formData.items[lastRowIndex];

      // Check if last row is empty or has an item
      let targetIndex = lastRowIndex;
      if (lastItem && lastItem.itemId) {
        // Last row has item, create new row
        const newItem = {
          ...createEmptyItem()
        };
        const newItems = [...formData.items, newItem];
        targetIndex = newItems.length - 1;
        setFormData({ ...formData, items: newItems });
      }

      // Add the item to the target row
      chooseSuggestion(targetIndex, foundItem);

      // Scroll to the new row
      setTimeout(() => {
        const rowElement = document.querySelector(`[data-row-index="${targetIndex}"]`);
        if (rowElement) {
          rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  };

  const calculateTotals = (items) => {
    const totalItems = items.length;
    const totalQty = items.reduce((sum, item) => sum + (item.poQty || 0), 0);
    const price = items.reduce((sum, item) => sum + ((item.poQty || 0) * (item.price || 0)), 0);

    // Calculate total discount across all items based on discount type
    const discount = items.reduce((sum, item) => {
      const poQty = item.poQty || 0;
      const price = item.price || 0;
      const discountType = item.discountType || '%';
      const disPercent = item.disPercent || 0;
      const dis = item.dis || 0;
      const taxPercent = item.taxPercent || 0;

      const subtotalBeforeDiscount = poQty * price;

      let totalDiscountAmount = 0;
      if (discountType === '%') {
        totalDiscountAmount = (subtotalBeforeDiscount * disPercent) / 100;
      } else {
        totalDiscountAmount = dis; // Fixed amount discount
      }

      return sum + totalDiscountAmount;
    }, 0);

    const totalTax = items.reduce((sum, item) => {
      const poQty = item.poQty || 0;
      const price = item.price || 0;
      const discountType = item.discountType || '%';
      const disPercent = item.disPercent || 0;
      const dis = item.dis || 0;
      const taxPercent = item.taxPercent || 0;

      const subtotalBeforeDiscount = poQty * price;

      let totalDiscountAmount = 0;
      if (discountType === '%') {
        totalDiscountAmount = (subtotalBeforeDiscount * disPercent) / 100;
      } else {
        totalDiscountAmount = dis;
      }

      const subtotalAfterDiscount = subtotalBeforeDiscount - totalDiscountAmount;
      const taxAmount = (subtotalAfterDiscount * taxPercent) / 100;

      return sum + taxAmount;
    }, 0);

    const totalAmount = items.reduce((sum, item) => sum + (item.total || 0), 0);

    setFormData(prev => ({
      ...prev,
      totalItems,
      totalQty,
      price,
      discount,
      totalTax,
      totalAmount
    }));
  };

  const validateAndPreparePOData = (data = formData) => {
    // Validate supplier selection
    if (!data.supplier || data.supplier.trim() === "") {
      toast({
        title: "Error",
        description: "Please select a supplier before saving",
        variant: "destructive"
      });
      return null;
    }

    // Filter out empty items - check for itemId (properly selected item) and quantity > 0
    const validItems = data.items.filter(item =>
      item.itemId && item.poQty > 0
    );

    if (validItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item with quantity greater than 0",
        variant: "destructive"
      });
      return null;
    }

    // Validate: batch number is required for all items
    for (let i = 0; i < validItems.length; i++) {
      const it = validItems[i];
      const batch = (it.batchNumber || '').trim();
      if (batch === "") {
        toast({
          title: "Batch Number Required",
          description: `Batch number is required for item: ${it.particulars || it.sku || 'Item ' + (i + 1)}`,
          variant: "destructive",
        });
        return null;
      }
    }

    // Validate: batch number must be unique per same item (allow same batch across different items)
    const seenByItem = new Map(); // key: item identity -> Set(batchNumber)
    for (let i = 0; i < validItems.length; i++) {
      const it = validItems[i];
      const itemIdentity = (it.sku && it.sku.trim() !== "") ? `sku:${it.sku.trim()}` : `name:${(it.particulars || '').trim().toLowerCase()}`;
      const batch = (it.batchNumber || '').trim();
      if (!seenByItem.has(itemIdentity)) {
        seenByItem.set(itemIdentity, new Set());
      }
      const batches = seenByItem.get(itemIdentity);
      if (batches.has(batch)) {
        toast({
          title: "Duplicate Batch Number",
          description: `Batch '${batch}' is repeated for the same item (${it.particulars || it.sku}). Each item's batches must be unique.`,
          variant: "destructive",
        });
        return null;
      }
      batches.add(batch);
    }

    const poData = {
      supplier: data.supplier,
      store: data.store,
      orderDate: data.quotationDate,
      // Only include expectedDeliveryDate if it has a value
      ...(data.dueDate && data.dueDate.trim() !== "" && { expectedDeliveryDate: data.dueDate }),
      items: validItems.map(item => {
        const itemData = {
          itemName: item.particulars,
          quantity: item.poQty,
          costPrice: item.price,
          total: item.total
        };

        // Include itemId if available
        if (item.itemId) itemData.itemId = item.itemId;

        // Only include optional fields if they have values
        if (item.sku && item.sku.trim() !== "") itemData.sku = item.sku;
        if (item.unit && item.unit.trim() !== "") itemData.unit = item.unit;
        if (item.categoryName && item.categoryName.trim() !== "") itemData.categoryName = item.categoryName;
        if (item.subcategoryName && item.subcategoryName.trim() !== "") itemData.subcategoryName = item.subcategoryName;
        if (item.batchNumber && item.batchNumber.trim() !== "") itemData.batchNumber = item.batchNumber;
        if (item.hsnNumber && item.hsnNumber.trim() !== "") itemData.hsnNumber = item.hsnNumber;
        if (item.expiryDate && item.expiryDate.trim() !== "") itemData.expiryDate = item.expiryDate;

        // Include discount and tax fields
        if (item.discountType) itemData.discountType = item.discountType;
        if (item.discountType === '%' && item.disPercent !== undefined && item.disPercent !== null) {
          itemData.discountPercent = Number(item.disPercent) || 0;
        } else if (item.discountType === 'Rate' && item.dis !== undefined && item.dis !== null) {
          itemData.discountAmount = Number(item.dis) || 0;
        }
        if (item.taxPercent !== undefined && item.taxPercent !== null) {
          itemData.taxPercent = Number(item.taxPercent) || 0;
        }
        if (item.mrp !== undefined && item.mrp !== null) {
          itemData.mrp = Number(item.mrp) || 0;
        }

        return itemData;
      }),
      tax: data.totalTax || 0,
      discount: data.discount || 0,
      shipping: parseFloat(data.freight || 0),
      // Only include notes if it has a value
      ...(data.remarks && data.remarks.trim() !== "" && { notes: data.remarks }),
      // Include credit flag
      isCredit: data.isCredit || false
    };

    return poData;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const poData = validateAndPreparePOData();
      if (!poData) {
        setSaving(false);
        return;
      }

      // Validate partial payment if entered
      const partialPayment = parseFloat(formData.partialPayment || 0);
      if (partialPayment > 0 && partialPayment > formData.totalAmount) {
        toast({
          title: "Invalid Amount",
          description: `Partial payment cannot exceed total amount of ₹${formData.totalAmount}`,
          variant: "destructive"
        });
        setSaving(false);
        return;
      }

      let createdPO = null;
      if (editingPO) {
        createdPO = await purchaseOrdersAPI.updatePurchaseOrder(editingPO._id, poData);
        toast({ title: "Success", description: "PO updated" });
      } else {
        const response = await purchaseOrdersAPI.createPurchaseOrder(poData);
        createdPO = response.data;
        toast({ title: "Success", description: "PO created and barcodes generated" });

        // If partial payment is entered, create credit with partial payment
        if (partialPayment > 0 && partialPayment < formData.totalAmount) {
          try {
            await creditsAPI.createCredit(createdPO._id, partialPayment, "Initial partial payment");
            toast({
              title: "Credit Created",
              description: `Credit created with partial payment of ₹${Math.round(partialPayment)}. Remaining amount: ₹${Math.round(formData.totalAmount - partialPayment)}`
            });
          } catch (creditError) {
            console.error('Error creating credit with partial payment:', creditError);
            toast({
              title: "Warning",
              description: creditError.response?.data?.message || "PO created but failed to create credit",
              variant: "destructive"
            });
          }
        }

        // Fetch barcodes for the created PO
        try {
          const barcodesResponse = await purchaseOrdersAPI.getPurchaseOrderBarcodes(createdPO._id);
          setBarcodeData(barcodesResponse.data);
          setCurrentPOId(createdPO._id);
          setShowBarcodeModal(true);
        } catch (error) {
          console.error("Error fetching barcodes:", error);
        }
      }

      // Reset form
      handleNewPO();
    } catch (error) {
      console.error('Error saving purchase order:', error);

      // Handle validation errors specifically
      let errorMessage = "Failed to save purchase order";

      // Prioritize the message from backend if available
      if (error.response && error.response.data) {
        if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.data.errors && error.response.data.errors.length > 0) {
          const validationErrors = error.response.data.errors;
          console.error("Validation errors:", validationErrors);
          const errorMessages = validationErrors.map(err => {
            const field = err.path || err.param || 'field';
            return `${field}: ${err.msg}`;
          });
          errorMessage = `Validation failed:\n${errorMessages.join('\n')}`;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCredit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Create formData with isCredit set to true for credit button
      const creditFormData = { ...formData, isCredit: true };

      const poData = validateAndPreparePOData(creditFormData);
      if (!poData) {
        setSaving(false);
        return;
      }

      // Ensure isCredit is set to true
      poData.isCredit = true;

      // Validate partial payment if entered
      const partialPayment = parseFloat(formData.partialPayment || 0);
      if (partialPayment > 0 && partialPayment > formData.totalAmount) {
        toast({
          title: "Invalid Amount",
          description: `Partial payment cannot exceed total amount of ₹${formData.totalAmount}`,
          variant: "destructive"
        });
        setSaving(false);
        return;
      }

      // First create the purchase order
      let createdPO = null;
      if (editingPO) {
        createdPO = await purchaseOrdersAPI.updatePurchaseOrder(editingPO._id, poData);
      } else {
        const response = await purchaseOrdersAPI.createPurchaseOrder(poData);
        createdPO = response.data;
      }

      // Then create credit record with partial payment if entered
      try {
        const paymentNote = partialPayment > 0
          ? `Initial partial payment of ₹${Math.round(partialPayment)}`
          : "Credit entry";
        await creditsAPI.createCredit(createdPO._id, partialPayment, paymentNote);
        toast({
          title: "Success",
          description: partialPayment > 0
            ? `Purchase order saved as credit with partial payment of ₹${Math.round(partialPayment)}. Remaining: ₹${Math.round(formData.totalAmount - partialPayment)}`
            : "Purchase order saved as credit successfully"
        });
      } catch (creditError) {
        console.error('Error creating credit:', creditError);
        toast({
          title: "Warning",
          description: creditError.response?.data?.message || "PO created but failed to save as credit",
          variant: "destructive"
        });
      }

      // Fetch barcodes for the created PO (same as in handleSubmit)
      if (!editingPO) {
        try {
          const barcodesResponse = await purchaseOrdersAPI.getPurchaseOrderBarcodes(createdPO._id);
          setBarcodeData(barcodesResponse.data);
          setCurrentPOId(createdPO._id);
          setShowBarcodeModal(true);
        } catch (error) {
          console.error("Error fetching barcodes:", error);
        }
      }

      // Reset form
      handleNewPO();
    } catch (error) {
      console.error('Error saving purchase order as credit:', error);

      let errorMessage = "Failed to save purchase order as credit";

      if (error.response && error.response.data) {
        if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.data.errors && error.response.data.errors.length > 0) {
          const validationErrors = error.response.data.errors;
          const errorMessages = validationErrors.map(err => {
            const field = err.path || err.param || 'field';
            return `${field}: ${err.msg}`;
          });
          errorMessage = `Validation failed:\n${errorMessages.join('\n')}`;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleNewPO = () => {
    setEditingPO(null);
    setFormData({
      supplier: "",
      supplierName: "",
      supplierDetails: null,
      store: selectedStore?._id ?? selectedStore?.id ?? "",
      quotationDate: new Date().toISOString().split('T')[0],
      validDate: "",
      dueDate: "",
      referenceDate: "",
      quotationNo: "",
      referenceNo: "",
      chequeNo: "",
      advAmount: "",
      remarks: "",
      servCharge: "",
      taxPercent: "",
      netServCharge: "",
      addOthers: "",
      lessOthers: "",
      freight: "",
      netFreight: "",
      globalTax: "",
      paymentTerms: "",
      dispatchMode: "",
      items: [createEmptyItem()],
      totalItems: 0,
      totalQty: 0,
      price: 0,
      discount: 0,
      totalTax: 0,
      totalAmount: 0,
      partialPayment: "",
      isCredit: false
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Print function - always uses double label mode (2 labels per page)
  const handlePrintLabels = () => {
    const mode = 'double'; // Always use double label print
    // First check if barcodeData exists
    if (!barcodeData || !barcodeData.groupedBarcodes || barcodeData.groupedBarcodes.length === 0) {
      toast({
        title: "Error",
        description: "No barcode data available to print",
        variant: "destructive"
      });
      return;
    }

    // Try to find labels - first in the dialog, then globally
    const dialog = document.querySelector('[role="dialog"]');
    let labelContainers = dialog 
      ? dialog.querySelectorAll('.barcode-label-container')
      : document.querySelectorAll('.barcode-label-container');
    
    // If still not found, try finding by the wrapper class
    if (labelContainers.length === 0) {
      const wrappers = dialog
        ? dialog.querySelectorAll('.barcode-label-wrapper')
        : document.querySelectorAll('.barcode-label-wrapper');
      
      if (wrappers.length > 0) {
        // Create containers from wrappers
        labelContainers = wrappers;
      }
    }
    
    // Also try to find canvas elements (barcodes are rendered in canvas)
    if (labelContainers.length === 0) {
      const canvases = dialog
        ? dialog.querySelectorAll('canvas')
        : document.querySelectorAll('canvas');
      if (canvases.length > 0) {
        const foundContainers = [];
        canvases.forEach(canvas => {
          const container = canvas.closest('.barcode-label-container') || 
                          canvas.closest('.barcode-label-wrapper') ||
                          canvas.parentElement?.parentElement;
          if (container && !foundContainers.includes(container)) {
            foundContainers.push(container);
          }
        });
        if (foundContainers.length > 0) {
          labelContainers = foundContainers;
        }
      }
    }
    
    // Always build labels from data to ensure they're available
    // This is more reliable than trying to extract from DOM
    let labelsHTML = '';
    
    // Build labels from barcodeData
    barcodeData.groupedBarcodes.forEach((group) => {
      const storeName = selectedStore?.name || group.storeName || 'MURUGAN SUPER MARKET';
      const itemName = group.itemName || 'Item';
      const sku = group.itemSku || '';
      
      // Format expiry date
      const formatDate = (date) => {
        if (!date) return '';
        try {
          const d = new Date(date);
          return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch {
          return '';
        }
      };
      
      const expiryDate = formatDate(group.expiryDate);
      const price = group.amount || 0;
      const priceText = price ? `Rs. ${Number(price).toFixed(2)}` : '';
      const batchText = group.batchNumber ? `Batch: ${group.batchNumber}` : '';
      
      // Helper function to generate barcode image
      const generateBarcodeImage = (barcodeValue) => {
        try {
          // Create a temporary canvas to generate the barcode
          const tempCanvas = document.createElement('canvas');
          const isAlphaNumeric = /[A-Za-z]/.test(barcodeValue);
          const format = isAlphaNumeric ? "CODE128" : "EAN13";
          
          // Fix EAN13 if needed
          let valueToEncode = barcodeValue;
          if (format === "EAN13" && barcodeValue.length !== 13) {
            // Try to fix it
            if (barcodeValue.length === 14) {
              const base12 = barcodeValue.slice(0, 12);
              let sum = 0;
              for (let i = 0; i < 12; i++) {
                sum += parseInt(base12[i]) * (i % 2 === 0 ? 1 : 3);
              }
              const checksum = (10 - (sum % 10)) % 10;
              valueToEncode = base12 + checksum.toString();
            } else if (barcodeValue.length < 13 && /^\d+$/.test(barcodeValue)) {
              const padded = barcodeValue.padStart(12, '0').slice(0, 12);
              let sum = 0;
              for (let i = 0; i < 12; i++) {
                sum += parseInt(padded[i]) * (i % 2 === 0 ? 1 : 3);
              }
              const checksum = (10 - (sum % 10)) % 10;
              valueToEncode = padded + checksum.toString();
            }
          }
          
          JsBarcode(tempCanvas, valueToEncode, {
            format: format,
            width: 3.0,
            height: 80,
            displayValue: false,
            fontSize: 12,
            margin: 5
          });
          
          return tempCanvas.toDataURL('image/png');
        } catch (e) {
          console.error('Error generating barcode image:', e, 'Value:', barcodeValue);
          return null;
        }
      };
      
      // Generate labels for each barcode in this group
      group.barcodes.forEach((barcodeItem, barcodeIndex) => {
        const barcodeValue = barcodeItem.barcode || barcodeItem;
        const barcodeToShow = sku || String(barcodeValue);
        const globalIndex = labelsHTML.split('barcode-label-container').length - 1;
        
        // Try to get barcode image from DOM first
        let barcodeImage = null;
        if (labelContainers.length > globalIndex) {
          const canvas = labelContainers[globalIndex]?.querySelector('canvas');
          if (canvas) {
            try {
              barcodeImage = canvas.toDataURL('image/png');
            } catch (e) {
              console.error('Error converting canvas to image:', e);
            }
          }
        }
        
        // If not found in DOM, generate it
        if (!barcodeImage) {
          barcodeImage = generateBarcodeImage(barcodeToShow);
        }
        
        const barcodeImgTag = barcodeImage 
          ? `<img src="${barcodeImage}" class="barcode-image" alt="Barcode" />`
          : `<div class="barcode-placeholder"><span>${barcodeToShow}</span></div>`;
        
        labelsHTML += `
          <div class="barcode-label-container">
            <div class="barcode-label-wrapper">
              <div class="store-name">${storeName}</div>
              <div class="barcode-section">
                ${barcodeImgTag}
                ${barcodeToShow ? `<div class="sku-text">${barcodeToShow}</div>` : ''}
              </div>
              <div class="item-details">
                <div class="item-name">${itemName || 'Item Name'}</div>
                ${batchText ? `<div class="batch-text">${batchText}</div>` : ''}
                <div class="expiry-price">
                  <span>EXP: ${expiryDate || 'N/A'}</span>
                  ${priceText ? `<span>${priceText}</span>` : '<span>Rs. 0.00</span>'}
                </div>
              </div>
            </div>
          </div>
        `;
      });
    });
    

    // Determine page size and label dimensions based on mode
    // Paper Type: Roll Paper
    // Paper Height: 2.50cm (25mm), Paper Width: 10.5cm (105mm)
    // Label Height: 2.50cm (25mm), Label Width: 5.00cm (50mm)
    const isDouble = mode === 'double';
    const labelWidth = '50mm';  // 5.00cm
    const labelHeight = '25mm';  // 2.50cm
    const pageWidth = '105mm';  // 10.5cm paper width
    const pageHeight = '25mm';  // 2.50cm paper height
    const containerDisplay = isDouble ? 'flex' : 'block';
    const containerFlexDirection = isDouble ? 'row' : 'column';
    const containerGap = isDouble ? '0mm' : '0';

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      toast({
        title: "Print blocked",
        description: "Please allow pop-ups to print barcodes.",
        variant: "destructive"
      });
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Barcode Labels - ${barcodeData?.purchaseOrderNumber || 'Print'}</title>
          <meta charset="UTF-8">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            @page {
              size: ${pageWidth} ${pageHeight};
              margin: 0;
              padding: 0;
            }
            
            @media screen {
              body {
                padding: 10px;
              }
              
              .labels-page {
                margin-bottom: 20px;
                border: 1px dashed #ccc;
              }
            }
            
            body {
              margin: 0;
              padding: 0;
              background: white;
              font-family: Arial, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            
            .labels-page {
              width: ${pageWidth};
              height: ${pageHeight};
              display: ${containerDisplay};
              flex-direction: ${containerFlexDirection};
              gap: 0mm;
              padding: 0;
              margin: 0;
              page-break-after: always;
              page-break-inside: avoid;
              break-after: page;
              break-inside: avoid;
            }
            
            .labels-page:last-of-type {
              page-break-after: auto;
              break-after: auto;
            }
            
            .barcode-label-container {
              width: ${labelWidth};
              height: ${labelHeight};
              max-width: ${labelWidth};
              max-height: ${labelHeight};
              min-height: ${labelHeight};
              margin: 0;
              padding: 0;
              display: flex;
              align-items: flex-start;
              justify-content: center;
              position: relative;
              border: none;
              background: white;
              page-break-inside: avoid;
              break-inside: avoid;
              overflow: visible;
            }
            
            .barcode-label-wrapper {
              width: 100%;
              height: 100%;
              max-width: 100%;
              max-height: 100%;
              min-height: 100%;
              padding: 2mm 0.5mm 0.5mm 0.5mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              margin: 0;
              border: none;
              background: white;
              font-size: 7px;
              line-height: 1.1;
              overflow: visible;
            }
            
            .store-name {
              font-size: 10px;
              font-weight: bold;
              text-align: center;
              margin-bottom: 0.3mm;
              padding-bottom: 0.2mm;
              line-height: 1;
              flex-shrink: 0;
              color: #000;
              text-transform: uppercase;
            }
            
            .barcode-section {
              margin: 0.3mm 0;
              min-height: 11mm;
              max-height: 11mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
              position: relative;
            }
            
            .barcode-section img.barcode-image,
            .barcode-section canvas {
              max-width: 100%;
              width: auto;
              height: 10mm;
              display: block;
              margin: 0 auto;
              position: relative;
              z-index: 1;
            }
            
            .barcode-placeholder {
              height: 10mm;
              display: flex;
              align-items: center;
              justify-content: center;
              border: 1px solid #ccc;
              margin: 0 auto;
              width: 80%;
              font-size: 5px;
              color: #666;
            }
            
            .sku-text {
              font-size: 9px;
              font-family: 'Courier New', monospace;
              margin-top: 0.2mm;
              text-align: center;
              color: #000;
              line-height: 1;
              font-weight: bold;
            }
            
            .item-details {
              padding-top: 0.3mm;
              margin-top: 0.3mm;
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: flex-start;
              min-height: 0;
              overflow: visible;
            }
            
            .item-name {
              font-size: 10px;
              font-weight: bold;
              margin-bottom: 0.1mm;
              line-height: 1.1;
              word-wrap: break-word;
              overflow-wrap: break-word;
              color: #000;
              text-align: center;
              text-transform: uppercase;
              display: block;
              flex-shrink: 0;
            }
            
            .batch-text {
              font-size: 6px;
              margin-bottom: 0.1mm;
              color: #000;
              text-align: center;
              display: block;
              flex-shrink: 0;
              line-height: 1.1;
            }
            
            .expiry-price {
              font-size: 9px;
              display: flex;
              justify-content: center;
              gap: 2mm;
              margin-top: 0.1mm;
              padding-bottom: 0;
              color: #000;
              line-height: 1.2;
              font-weight: bold;
              width: 100%;
              flex-shrink: 0;
              white-space: nowrap;
            }
            
            @media print {
              body {
                margin: 0;
                padding: 0;
              }
              
              .labels-page {
                page-break-after: always;
              }
              
              .labels-page:last-of-type {
                page-break-after: auto;
              }
            }
          </style>
        </head>
        <body>
          ${(() => {
            // Group labels into pages based on mode
            // Split labels by finding each container
            let labels = [];
            let searchIndex = 0;
            
            while (true) {
              const startIndex = labelsHTML.indexOf('<div class="barcode-label-container">', searchIndex);
              if (startIndex === -1) break;
              
              // Find the matching closing tags (2 closing divs)
              let depth = 0;
              let endIndex = startIndex;
              let foundStart = false;
              
              for (let i = startIndex; i < labelsHTML.length; i++) {
                if (labelsHTML.substr(i, 4) === '<div') {
                  depth++;
                  foundStart = true;
                } else if (labelsHTML.substr(i, 6) === '</div>') {
                  depth--;
                  if (depth === 0 && foundStart) {
                    endIndex = i + 6;
                    break;
                  }
                }
              }
              
              if (endIndex > startIndex) {
                labels.push(labelsHTML.substring(startIndex, endIndex));
                searchIndex = endIndex;
              } else {
                break;
              }
            }
            
            // If method didn't work, try simpler approach
            if (labels.length === 0) {
              const parts = labelsHTML.split('</div></div>');
              let currentLabel = '';
              for (let i = 0; i < parts.length; i++) {
                currentLabel += parts[i];
                if (currentLabel.includes('barcode-label-container')) {
                  labels.push(currentLabel + '</div></div>');
                  currentLabel = '';
                }
              }
            }
            
            let pagesHTML = '';
            
            if (isDouble) {
              // Two labels per page
              for (let i = 0; i < labels.length; i += 2) {
                pagesHTML += '<div class="labels-page">';
                pagesHTML += labels[i] || '';
                pagesHTML += labels[i + 1] || '';
                pagesHTML += '</div>';
              }
            } else {
              // One label per page
              labels.forEach(label => {
                pagesHTML += '<div class="labels-page">';
                pagesHTML += label;
                pagesHTML += '</div>';
              });
            }
            
            // If still no pages, just use the raw HTML wrapped in pages
            if (pagesHTML === '' && labelsHTML !== '') {
              if (isDouble) {
                pagesHTML = '<div class="labels-page">' + labelsHTML + '</div>';
              } else {
                pagesHTML = '<div class="labels-page">' + labelsHTML + '</div>';
              }
            }
            
            return pagesHTML;
          })()}
        </body>
      </html>
    `);

    printWindow.document.close();

    // Wait for content and barcodes to load, then show preview and print dialog
    const printWhenReady = () => {
      setTimeout(() => {
        printWindow.focus();
        // Show preview first - the print dialog will appear
        printWindow.print();
      }, 2000); // Wait longer for JsBarcode to load and generate barcodes
    };
    
    // Set up load handler
    printWindow.onload = printWhenReady;
    
    // Fallback - check if already loaded
    if (printWindow.document.readyState === 'complete') {
      printWhenReady();
    } else {
      // Also set a timeout as backup
      setTimeout(printWhenReady, 3000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl text-red-600 flex items-center gap-2">
              PURCHASE

            </CardTitle>
            <div className="flex gap-2">
              <Button type="submit" form="poForm" variant="default" size="sm" disabled={saving}>
                <ShoppingCart className="h-4 w-4 mr-1" />
                GENERATE
              </Button>
              <Button type="button" form="poForm" onClick={handleCredit} variant="outline" size="sm" disabled={saving}>
                <CreditCard className="h-4 w-4 mr-1" />
                CREDIT
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={handleNewPO}>
                <X className="h-4 w-4 mr-1" />
                CANCEL
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Form */}
      <form id="poForm" onSubmit={handleSubmit}>
        <Card>
          <CardContent className="pt-6">
            {loadError && (
              <div className="mb-4 text-sm text-destructive">
                {loadError}
              </div>
            )}
            {/* Minimal fields: Supplier, Store, Purchase Order Date */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <Label>Supplier Name</Label>
                <Select
                  value={formData.supplier ? String(formData.supplier) : ""}
                  onValueChange={async (v) => {
                    const sup = suppliers?.find((s) => String(s._id || s.id) === String(v));
                    try {
                      const response = await suppliersAPI.getSupplier(v);
                      setFormData({
                        ...formData,
                        supplier: v,
                        supplierName: sup?.companyName || sup?.name || "",
                        supplierDetails: response.data
                      });
                    } catch (error) {
                      console.error('Error fetching supplier details:', error);
                      setFormData({
                        ...formData,
                        supplier: v,
                        supplierName: sup?.companyName || sup?.name || ""
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={suppliers?.length ? "Select supplier" : "No suppliers"}>
                      {formData.supplier && formData.supplierName
                        ? formData.supplierName
                        : formData.supplier
                          ? (suppliers?.find((s) => String(s._id || s.id) === String(formData.supplier))?.companyName ||
                            suppliers?.find((s) => String(s._id || s.id) === String(formData.supplier))?.name ||
                            'Selected supplier')
                          : null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="z-[10000] max-h-[300px]">
                    {(suppliers || []).map((s) => (
                      <SelectItem key={s._id || s.id} value={String(s._id || s.id)}>
                        {s.companyName || s.name || 'Unnamed Supplier'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Store</Label>
                <Select
                  value={formData.store ? String(formData.store) : ""}
                  onValueChange={(v) => {
                    setFormData({ ...formData, store: v, supplier: "", supplierName: "", supplierDetails: null });
                    // Reload suppliers filtered by the new store
                    loadData(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={stores?.length ? "Select store" : "No stores"}>
                      {formData.store
                        ? (stores?.find((s) => String(s._id || s.id) === String(formData.store))?.name || 'Selected store')
                        : null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="z-[10000] max-h-[300px]">
                    {(stores || []).map((s) => (
                      <SelectItem key={s._id || s.id} value={String(s._id || s.id)}>
                        {s.name || 'Unnamed Store'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Purchase Order Date</Label>
                <Input
                  type="date"
                  value={formData.quotationDate}
                  onChange={(e) => setFormData({ ...formData, quotationDate: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Supplier Details Section */}
        {formData.supplierDetails && (
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4 text-blue-600">Supplier Details</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs text-gray-500">Contact Person</Label>
                  <p className="font-medium">
                    {formData.supplierDetails.contactPerson?.firstName || ''} {formData.supplierDetails.contactPerson?.lastName || ''}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Email</Label>
                  <p className="font-medium">{formData.supplierDetails.email || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Phone</Label>
                  <p className="font-medium">{formData.supplierDetails.phone?.primary || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Address</Label>
                  <p className="font-medium">
                    {formData.supplierDetails.address?.street || ''}, {formData.supplierDetails.address?.city || ''}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">GST Number</Label>
                  <p className="font-medium">{formData.supplierDetails.gstNumber || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">PAN Number</Label>
                  <p className="font-medium">{formData.supplierDetails.panNumber || '-'}</p>
                </div>
                {formData.supplierDetails.paymentTerms && (
                  <div>
                    <Label className="text-xs text-gray-500">Payment Terms</Label>
                    <p className="font-medium">{formData.supplierDetails.paymentTerms}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Section */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-6 gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-blue-500" />
                <span className="text-sm">Total Items: <strong>{formData.totalItems}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-green-500" />
                <span className="text-sm">Total Qty: <strong>{formData.totalQty}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-purple-500" />
                <span className="text-sm">Price: <strong>₹{Math.round(formData.price)}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Percent className="h-5 w-5 text-orange-500" />
                <span className="text-sm">Discount: <strong>₹{Math.round(formData.discount)}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-red-500" />
                <span className="text-sm">Total Tax: <strong>₹{Math.round(formData.totalTax)}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-blue-600" />
                <span className="text-sm">Total Amount: <strong>₹{Math.round(formData.totalAmount)}</strong></span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div>
                <Label>Partial Payment (Optional)</Label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max={formData.totalAmount}
                    value={formData.partialPayment}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      if (value > formData.totalAmount) {
                        toast({
                          title: "Invalid Amount",
                          description: `Partial payment cannot exceed total amount of ₹${formData.totalAmount}`,
                          variant: "destructive"
                        });
                        return;
                      }
                      setFormData({ ...formData, partialPayment: e.target.value });
                    }}
                    placeholder="0"
                    className="pl-6"
                  />
                </div>
                {formData.partialPayment && parseFloat(formData.partialPayment) > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Remaining: ₹{Math.round(formData.totalAmount - parseFloat(formData.partialPayment || 0))}
                  </p>
                )}
              </div>
              <div></div>
              <div></div>
            </div>
          </CardContent>
        </Card>

        {/* Items Table */}
        <Card className="overflow-visible">
          <CardContent className="pt-6 overflow-visible">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold">Line Items</h3>
                {itemsLoading && (
                  <Badge variant="secondary" className="text-xs">
                    Loading items...
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Scan barcode to add item..."
                  value={barcodeScannerValue}
                  onChange={async (e) => {
                    const value = e.target.value;
                    setBarcodeScannerValue(value);
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && barcodeScannerValue.trim()) {
                      e.preventDefault();
                      const value = barcodeScannerValue;
                      setBarcodeScannerValue('');
                      await handleBarcodeScan(value);
                    }
                  }}
                  className="w-64"
                  autoFocus
                />
                <Button type="button" onClick={addItem} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Manual Add
                </Button>
              </div>
            </div>
            <div className="border rounded-lg w-full overflow-x-auto overflow-y-visible">
              <Table className="w-full table-auto min-w-[1400px]">
                <TableHeader className="bg-blue-600 text-white">
                  <TableRow>
                    <TableHead className="text-white w-10"><input type="checkbox" /></TableHead>
                    <TableHead className="text-white w-56">PARTICULARS</TableHead>
                    <TableHead className="text-white w-16">Qty</TableHead>
                    <TableHead className="text-white w-20">Batch No.</TableHead>
                    <TableHead className="text-white w-16">HSN</TableHead>
                    <TableHead className="text-white w-24">Expiry Date</TableHead>
                    <TableHead className="text-white w-20">Disc Type</TableHead>
                    <TableHead className="text-white w-14">DIS</TableHead>
                    <TableHead className="text-white w-14">TAX%</TableHead>
                    <TableHead className="text-white w-16">PRICE</TableHead>
                    <TableHead className="text-white w-16">TOTAL</TableHead>
                    <TableHead className="text-white w-16">MRP</TableHead>
                    <TableHead className="text-white w-12">ACTION</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formData.items.map((item, index) => (
                    <TableRow
                      key={index}
                      data-row-index={index}
                      className={highlightedRowIndex === index ? "bg-yellow-200 animate-pulse" : ""}
                    >
                      <TableCell><input type="checkbox" /></TableCell>
                      <TableCell className="relative overflow-visible min-w-[20rem]">
                        <div className="suggestions-dropdown relative w-full max-w-[24rem]">
                          <Input
                            ref={(el) => (inputRefs.current[index] = el)}
                            placeholder="Search for a Particulars"
                            value={item.particulars}
                            onChange={(e) => {
                              let inputValue = e.target.value;
                              const currentItem = formData.items[index];
                              const currentRowHasItem = currentItem && currentItem.itemId;

                              // If row already has an item, check if value is concatenated (item name + barcode)
                              if (currentRowHasItem && currentItem.particulars) {
                                const itemName = currentItem.particulars;
                                // Check if inputValue starts with item name followed by digits (barcode)
                                if (inputValue.startsWith(itemName) && inputValue.length > itemName.length) {
                                  const afterItemName = inputValue.substring(itemName.length);
                                  // If the part after item name looks like a barcode, extract just that
                                  if (afterItemName.length >= 6 && /^[A-Za-z0-9\-]+$/.test(afterItemName.trim())) {
                                    inputValue = afterItemName.trim();
                                    // Immediately restore the item name and search with the extracted barcode
                                    const currentItems = [...formData.items];
                                    currentItems[index] = {
                                      ...currentItems[index],
                                      particulars: itemName
                                    };
                                    setFormData({ ...formData, items: currentItems });
                                  }
                                }
                              }

                              // Check if this looks like a barcode scan
                              const isLikelyBarcode = inputValue.length >= 6 && /^[A-Za-z0-9\-]+$/.test(inputValue.trim());

                              // If row already has an item and scanning a new barcode, handle it specially
                              if (currentRowHasItem && isLikelyBarcode) {
                                // Check if this is the same item's barcode
                                const isSameItem = currentItem.sku && (currentItem.sku.toUpperCase() === inputValue.trim().toUpperCase());

                                if (isSameItem) {
                                  // Same item - restore item name and don't do anything else
                                  const currentItems = [...formData.items];
                                  currentItems[index] = {
                                    ...currentItems[index],
                                    particulars: currentItem.particulars
                                  };
                                  setFormData({ ...formData, items: currentItems });
                                  return;
                                }
                                // Different item - continue to searchItems which will create new row
                              }
                              updateDropdownPosition(index);
                              searchItems(index, inputValue);
                            }}
                            onKeyDown={(e) => {
                              // Handle Enter key for barcode scanners
                              if (e.key === 'Enter' && item.particulars.trim()) {
                                e.preventDefault();
                                let trimmedParticulars = item.particulars.trim();
                                const currentItem = formData.items[index];
                                const currentRowHasItem = currentItem && currentItem.itemId;

                                // If row has item, check for concatenation (item name + barcode)
                                if (currentRowHasItem && currentItem.particulars) {
                                  const itemName = currentItem.particulars;
                                  if (trimmedParticulars.startsWith(itemName) && trimmedParticulars.length > itemName.length) {
                                    const afterItemName = trimmedParticulars.substring(itemName.length);
                                    if (afterItemName.length >= 6 && /^[A-Za-z0-9\-]+$/.test(afterItemName.trim())) {
                                      trimmedParticulars = afterItemName.trim();
                                      // Restore item name
                                      const currentItems = [...formData.items];
                                      currentItems[index] = {
                                        ...currentItems[index],
                                        particulars: itemName
                                      };
                                      setFormData({ ...formData, items: currentItems });
                                    }
                                  }
                                }

                                const isLikelyBarcode = trimmedParticulars.length >= 6 && /^[A-Za-z0-9\-]+$/.test(trimmedParticulars);

                                // Check if row has item and scanning different barcode - use the last created row index
                                let targetIndex = index;
                                if (currentRowHasItem && isLikelyBarcode) {
                                  const isSameItem = currentItem.sku && (currentItem.sku.toUpperCase() === trimmedParticulars.toUpperCase());
                                  if (!isSameItem) {
                                    // Different item - find the last empty row or newly created row
                                    const lastItem = formData.items[formData.items.length - 1];
                                    if (!lastItem.itemId && lastItem.particulars === trimmedParticulars) {
                                      targetIndex = formData.items.length - 1;
                                    }
                                  } else {
                                    // Same item - don't process
                                    return;
                                  }
                                }

                                // Duplicate-scan prevention for row barcode Enter
                                const now = Date.now();
                                if (
                                  lastBarcodeScanRef.current.barcode === trimmedParticulars &&
                                  now - lastBarcodeScanRef.current.time < SCAN_DEBOUNCE_MS
                                ) {
                                  return;
                                }

                                // If there's exactly one suggestion, auto-select it
                                if (itemSuggestions[targetIndex]?.length === 1) {
                                  if (isLikelyBarcode) {
                                    lastBarcodeScanRef.current = { barcode: trimmedParticulars, time: now };
                                  }
                                  chooseSuggestion(targetIndex, itemSuggestions[targetIndex][0]);
                                  return;
                                }

                                // If it's a barcode scan, try to find exact SKU match
                                if (isLikelyBarcode) {
                                  const exactSkuMatch = allItems.find(i =>
                                    (i.sku || '').toUpperCase() === trimmedParticulars.toUpperCase()
                                  );

                                  if (exactSkuMatch) {
                                    lastBarcodeScanRef.current = { barcode: trimmedParticulars, time: now };
                                    chooseSuggestion(targetIndex, exactSkuMatch);
                                    return;
                                  }
                                }
                              }
                            }}
                            onFocus={() => {
                              updateDropdownPosition(index);
                              if (!item.particulars?.trim()) {
                                setItemSuggestions(prev => ({
                                  ...prev,
                                  [index]: allItems
                                }));
                              }
                              setOpenSuggestIndex(index);
                            }}
                            className="w-full pr-9"
                          />
                          {(item.particulars || item.itemId) && (
                            <button
                              type="button"
                              onClick={() => clearItem(index)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive transition"
                              aria-label="Clear selected item"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                          {openSuggestIndex === index && (itemSuggestions[index]?.length || 0) > 0 && (
                            <div
                              className="suggestions-dropdown fixed z-[1000] max-h-[60vh] overflow-y-auto rounded-xl border-2 border-primary/20 bg-white shadow-2xl"
                              style={{
                                top: `${dropdownLayout.top}px`,
                                left: `${dropdownLayout.left}px`,
                                width: dropdownLayout.width || 576,
                                transform: dropdownLayout.placement === 'top' ? 'translateY(-100%)' : 'translateY(0)'
                              }}
                            >
                              <div className="p-3 bg-primary/5 border-b border-primary/10 sticky top-0 z-10 bg-white rounded-t-xl">
                                <p className="text-xs font-semibold text-primary">
                                  {itemSuggestions[index]?.length || 0} suggestion{itemSuggestions[index]?.length !== 1 ? 's' : ''} found
                                </p>
                              </div>
                              <div className="divide-y divide-slate-100">
                                {itemSuggestions[index].map((s, suggestionIndex) => (
                                  <button
                                    key={s._id || suggestionIndex}
                                    type="button"
                                    className="w-full px-4 py-3 text-left hover:bg-primary/5 focus-visible:outline-none"
                                    onClick={() => chooseSuggestion(index, s)}
                                  >
                                    <p className="text-sm font-medium text-slate-900">{s.name}</p>
                                    {(s.sku || s.price) && (
                                      <div className="mt-1 text-xs text-muted-foreground flex items-center gap-3">
                                        {s.sku && <span>SKU: {s.sku}</span>}
                                        {s.price !== undefined && <span>₹{Number(s.price).toFixed(2)}</span>}
                                      </div>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[7rem]">
                        <Input
                          type="number"
                          value={item.poQty || ''}
                          onChange={(e) => updateItem(index, 'poQty', parseFloat(e.target.value) || 0)}
                          className="w-full"
                        />
                      </TableCell>
                      <TableCell className="min-w-[8rem]">
                        <Input
                          type="text"
                          value={item.batchNumber || ''}
                          onChange={(e) => updateItem(index, 'batchNumber', e.target.value)}
                          placeholder="Batch No. *"
                          className="w-full"
                          required
                        />
                      </TableCell>
                      <TableCell className="min-w-[7rem]">
                        <Input
                          type="text"
                          value={item.hsnNumber || ''}
                          onChange={(e) => updateItem(index, 'hsnNumber', e.target.value)}
                          placeholder="HSN Code"
                          className="w-full"
                        />
                      </TableCell>
                      <TableCell className="relative">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={`w-full max-w-24 justify-start text-left font-normal items-center h-9 px-2 ${!item.expiryDate ? "text-muted-foreground" : ""
                                }`}
                            >
                              <CalendarIcon className={`mr-2 h-4 w-4 flex-shrink-0 ${!item.expiryDate ? "opacity-50" : ""}`} />
                              <span className="truncate">{item.expiryDate ? format(new Date(item.expiryDate), "dd-MM-yyyy") : "Select date"}</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0 max-h-none" align="start" sideOffset={4} collisionPadding={10}>
                            <Calendar
                              mode="single"
                              selected={item.expiryDate ? new Date(item.expiryDate) : undefined}
                              onSelect={(date) => {
                                if (date) {
                                  updateItem(index, 'expiryDate', format(date, "yyyy-MM-dd"));
                                } else {
                                  updateItem(index, 'expiryDate', '');
                                }
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell className="min-w-[8rem]">
                        <Select
                          value={item.discountType || '%'}
                          onValueChange={(v) => updateItem(index, 'discountType', v)}
                        >
                          <SelectTrigger className="w-full max-w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="%">%</SelectItem>
                            <SelectItem value="Rate">Rate</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="min-w-[7rem]">
                        {item.discountType === '%' ? (
                          <Input
                            type="number"
                            value={item.disPercent || ''}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              updateItem(index, 'disPercent', value);
                            }}
                            placeholder="%"
                            className="w-full"
                          />
                        ) : (
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                            <Input
                              type="number"
                              value={item.dis || ''}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                updateItem(index, 'dis', value);
                              }}
                              placeholder="0"
                              className="w-full pl-6"
                            />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="min-w-[7rem]">
                        <Select value={String(item.taxPercent)} onValueChange={(v) => updateItem(index, 'taxPercent', parseFloat(v))}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0%</SelectItem>
                            <SelectItem value="5">5%</SelectItem>
                            <SelectItem value="12">12%</SelectItem>
                            <SelectItem value="18">18%</SelectItem>
                            <SelectItem value="28">28%</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="min-w-[8rem]">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                          <Input
                            type="text"
                            value={item.price || ''}
                            readOnly
                            tabIndex={-1}
                            className="w-full pl-6 bg-slate-100 text-slate-900"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium min-w-[7rem]">
                        <div className="rounded-md border px-3 py-2 bg-slate-50 text-slate-900">
                          ₹{Math.round(item.total)}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[8rem]">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                          <Input
                            type="text"
                            value={item.mrp || ''}
                            readOnly
                            tabIndex={-1}
                            className="w-full pl-6 bg-slate-100 text-slate-900"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => removeItem(index)}
                          className="h-8 w-8 p-0"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Barcode Labels Modal */}
      <Dialog open={showBarcodeModal} onOpenChange={setShowBarcodeModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <style>{`
            @media print {
              @page {
                size: 4in 2.5in;
                margin: 0;
                padding: 0;
              }
              
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              
              /* Hide everything by default */
              body * {
                visibility: hidden !important;
                display: none !important;
              }
              
              /* Show only label containers and their children */
              .barcode-label-container {
                visibility: visible !important;
                display: flex !important;
              }
              
              .barcode-label-container * {
                visibility: visible !important;
                display: block !important;
              }
              
              /* Reset body and html for printing */
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                height: auto !important;
                background: white !important;
                font-family: Arial, sans-serif !important;
              }
              
              /* Hide all dialog and UI elements */
              [class*="Dialog"],
              [class*="DialogHeader"],
              [class*="DialogContent"],
              [class*="DialogTitle"],
              [class*="DialogOverlay"],
              button,
              .print\\:hidden,
              header,
              footer,
              nav {
                display: none !important;
                visibility: hidden !important;
                margin: 0 !important;
                padding: 0 !important;
                height: 0 !important;
                width: 0 !important;
                overflow: hidden !important;
              }
              
              /* Hide all parent divs that don't contain labels directly */
              .space-y-6,
              .space-y-3,
              .flex.flex-col,
              .mt-4 {
                display: block !important;
                margin: 0 !important;
                padding: 0 !important;
                height: auto !important;
                page-break-inside: avoid !important;
              }
              
              /* Ensure parent containers don't create extra pages */
              div:not(.barcode-label-container) {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              
              /* Each label container is exactly one page */
              .barcode-label-container {
                width: 4in !important;
                height: 2.5in !important;
                max-width: 4in !important;
                max-height: 2.5in !important;
                min-height: 2.5in !important;
                page-break-after: always !important;
                page-break-before: auto !important;
                page-break-inside: avoid !important;
                break-after: page !important;
                break-before: auto !important;
                break-inside: avoid !important;
                margin: 0 !important;
                padding: 0.2in 0.15in 0.1in 0.15in !important;
                box-sizing: border-box !important;
                display: flex !important;
                align-items: flex-start !important;
                justify-content: center !important;
                position: relative !important;
                border: none !important;
                background: white !important;
              }
              
              /* First label - no page break before */
              .barcode-label-container:first-of-type {
                page-break-before: auto !important;
                break-before: auto !important;
              }
              
              /* Last label - no page break after */
              .barcode-label-container:last-of-type {
                page-break-after: auto !important;
                break-after: auto !important;
              }
              
              /* Label wrapper styling - optimized for print */
              .barcode-label-wrapper {
                width: 100% !important;
                max-width: 100% !important;
                min-height: auto !important;
                padding: 0.12in 0.12in 0.15in 0.12in !important;
                box-sizing: border-box !important;
                display: block !important;
                margin: 0 auto !important;
                border: 2px solid #000 !important;
                background: white !important;
                font-size: 10px !important;
                line-height: 1.2 !important;
              }
              
              /* Store name styling */
              .barcode-label-wrapper > div:first-child {
                font-size: 14px !important;
                font-weight: bold !important;
                text-align: center !important;
                margin-bottom: 4px !important;
                padding-bottom: 0 !important;
              }
              
              /* Barcode container */
              .barcode-label-wrapper > div:nth-child(2) {
                margin: 6px 0 !important;
                min-height: 70px !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
              }
              
              /* Ensure barcode canvas fits properly */
              .barcode-label-wrapper canvas {
                max-width: 100% !important;
                width: auto !important;
                height: 60px !important;
                display: block !important;
                margin: 0 auto 4px auto !important;
              }
              
              /* SKU text below barcode */
              .barcode-label-wrapper > div:nth-child(2) > div {
                font-size: 9px !important;
                font-family: 'Courier New', monospace !important;
                margin-top: 2px !important;
                text-align: center !important;
              }
              
              /* Item details section */
              .barcode-label-wrapper > div:last-child {
                padding-top: 4px !important;
                margin-top: 4px !important;
              }
              
              /* Item name */
              .barcode-label-wrapper > div:last-child > div:first-child {
                font-size: 11px !important;
                font-weight: bold !important;
                margin-bottom: 3px !important;
                line-height: 1.3 !important;
                word-wrap: break-word !important;
                overflow-wrap: break-word !important;
              }
              
              /* Batch number */
              .barcode-label-wrapper > div:last-child > div:nth-child(2) {
                font-size: 9px !important;
                margin-bottom: 2px !important;
              }
              
              /* Expiry and Price row */
              .barcode-label-wrapper > div:last-child > div:last-child {
                font-size: 9px !important;
                display: flex !important;
                justify-content: space-between !important;
                margin-top: 2px !important;
              }
              
              /* Remove all parent container styling */
              .space-y-6,
              .space-y-3,
              .flex.flex-col {
                margin: 0 !important;
                padding: 0 !important;
                display: block !important;
                gap: 0 !important;
              }
              
              /* Ensure no spacing between labels */
              .barcode-label-container + .barcode-label-container {
                margin-top: 0 !important;
                padding-top: 0 !important;
              }
              
              /* Ensure text is black and readable */
              .barcode-label-wrapper,
              .barcode-label-wrapper * {
                color: #000 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
          `}</style>
          <DialogHeader className="print:hidden">
            <DialogTitle>Barcode Labels - {barcodeData?.purchaseOrderNumber}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-between items-center mb-4 pb-4 border-b print:hidden">
            {currentPOId && (
              <Button
                variant="destructive"
                onClick={async () => {
                  try {
                    await purchaseOrdersAPI.regeneratePurchaseOrderBarcodes(currentPOId);
                    const barcodesResponse = await purchaseOrdersAPI.getPurchaseOrderBarcodes(currentPOId);
                    setBarcodeData(barcodesResponse.data);
                    toast({
                      title: "Success",
                      description: "Barcodes regenerated successfully"
                    });
                  } catch (error) {
                    toast({
                      title: "Error",
                      description: error.response?.data?.message || "Failed to regenerate barcodes",
                      variant: "destructive"
                    });
                  }
                }}
              >
                Regenerate Barcodes
              </Button>
            )}
            {!currentPOId && <div></div>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowBarcodeModal(false)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  // Check if barcodeData exists first
                  if (!barcodeData || !barcodeData.groupedBarcodes || barcodeData.groupedBarcodes.length === 0) {
                    toast({
                      title: "Error",
                      description: "No barcode data available. Please generate barcodes first.",
                      variant: "destructive"
                    });
                    return;
                  }

                  // Wait a bit for DOM to be ready, then print directly in double mode
                  setTimeout(() => {
                    handlePrintLabels();
                  }, 300);
                }}
              >
                Print Labels
              </Button>
            </div>
          </div>
          <div className="space-y-6 mt-4 print:m-0">
            {barcodeData?.groupedBarcodes?.map((group, groupIndex) => (
              <div key={groupIndex} className="space-y-3 print:space-y-0">
                <div className="font-semibold text-lg border-b pb-2 print:hidden">
                  {group.itemName} (SKU: {group.itemSku}) - {group.barcodes.length} labels
                </div>
                <div className="flex flex-col gap-4 items-center print:block print:gap-0">
                  {group.barcodes.map((barcodeItem, idx) => {
                    // Calculate if this is the absolute last label across all groups
                    let totalLabelsBefore = 0;
                    for (let i = 0; i < groupIndex; i++) {
                      totalLabelsBefore += barcodeData?.groupedBarcodes?.[i]?.barcodes?.length || 0;
                    }
                    const isAbsoluteLast = (totalLabelsBefore + idx + 1) ===
                      (barcodeData?.groupedBarcodes?.reduce((sum, g) => sum + (g?.barcodes?.length || 0), 0));

                    return (
                      <div
                        key={`${groupIndex}-${idx}`}
                        className="barcode-label-container border rounded p-2 print:border-0 print:p-0"
                      >
                        <BarcodeLabel
                          // Encode SKU so scanners return SKU text
                          sku={group.itemSku}
                          barcode={barcodeItem.barcode}
                          storeName={selectedStore?.name || group.storeName}
                          itemName={group.itemName}
                          expiryDate={group.expiryDate}
                          amount={group.amount}
                          batchNumber={group.batchNumber}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default PurchaseOrders;
