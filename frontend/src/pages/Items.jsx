import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Search, Package, Pencil, Loader2, ChevronDown, Check, ChevronLeft, ChevronRight, Barcode, Printer, Plus, X, ChevronRight as ChevronRightIcon, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { itemsAPI, categoriesAPI, brandsAPI, purchaseOrdersAPI } from "@/services/api";
import { useDebounce } from "@/hooks/useDebounce";
import { useSearchParams, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import BarcodeLabel from "@/components/BarcodeLabel";
import { useAuth } from "@/contexts/AuthContext";
import JsBarcode from "jsbarcode";

const EMPTY_STATE = {
  title: "No items found",
  description: "Adjust your filters or contact an administrator to add inventory.",
};

const DEFAULT_PAGE_SIZE = 100;
const CRITICAL_STOCK_THRESHOLD = 5;
/** Shown on product cards when the BOGO checkbox is enabled */
const BOGO_OFFER_CARD_LABEL = "Buy 1 Get 1 Free";

/** Move focus to the next editable control in an item edit/create form (Enter key). */
function focusNextFieldInForm(form, activeElement) {
  const selector =
    'input:not([type="hidden"]):not([type="file"]):not([disabled]):not([readonly]), textarea:not([disabled]), button[role="combobox"]:not([disabled])';
  const fields = Array.from(form.querySelectorAll(selector));
  const i = fields.indexOf(activeElement);
  if (i === -1 || i >= fields.length - 1) return;
  const next = fields[i + 1];
  next.focus();
  if (next.tagName === "INPUT" && typeof next.select === "function") {
    const ty = next.type || "text";
    if (["text", "search", "tel", "url", "number"].includes(ty)) {
      try {
        next.select();
      } catch {
        /* ignore */
      }
    }
  }
}

const STOCK_STATUS_OPTIONS = [
  { value: "all", label: "All stock levels" },
  { value: "low", label: "Below minimum" },
  { value: "healthy", label: "Within range" },
  { value: "overstock", label: "Above maximum" },
  { value: "no-movement", label: "No movement" }
];

export default function Items() {
  const { toast } = useToast();
  const { selectedStore, hasEditRight } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoryHierarchy, setCategoryHierarchy] = useState([]);
  const [brands, setBrands] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSubcategory, setSelectedSubcategory] = useState("all");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingItem, setEditingItem] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [itemBatches, setItemBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [selectedBatchIndex, setSelectedBatchIndex] = useState(null);
  const [loadingBarcodes, setLoadingBarcodes] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    sku: "",
    description: "",
    brand: "",
    brandId: "",
    price: "",
    costPrice: "",
    mrp: "",
    unit: "",
    categoryId: "",
    subcategoryId: "",
    barcode: "",
    hsnCode: "",
    gstRate: "",
    reorderLevel: "",
    minStock: "",
    maxStock: "",
    notes: "",
    bogoOfferEnabled: false,
    isActive: true
  });
  const hadExplicitPageParamRef = useRef(false);
  const autoSelectedLatestRef = useRef(false);
  const hasInitializedRef = useRef(false);

  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imageMetadata, setImageMetadata] = useState(null);
  const [saving, setSaving] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [categorySearchTerm, setCategorySearchTerm] = useState("");
  const [editCategoryPopoverOpen, setEditCategoryPopoverOpen] = useState(false);
  const [editCategorySearchTerm, setEditCategorySearchTerm] = useState("");
  const [createCategoryPopoverOpen, setCreateCategoryPopoverOpen] = useState(false);
  const [createCategorySearchTerm, setCreateCategorySearchTerm] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [createBrandPopoverOpen, setCreateBrandPopoverOpen] = useState(false);
  const [createBrandSearchTerm, setCreateBrandSearchTerm] = useState("");
  const [editBrandPopoverOpen, setEditBrandPopoverOpen] = useState(false);
  const [editBrandSearchTerm, setEditBrandSearchTerm] = useState("");
  const [showBrandCreation, setShowBrandCreation] = useState(false);
  const [newBrandInItemForm, setNewBrandInItemForm] = useState("");
  const [isCreateItemOpen, setIsCreateItemOpen] = useState(false);
  const [createItemForm, setCreateItemForm] = useState({
    name: "",
    sku: "",
    description: "",
    brand: "",
    brandId: "",
    price: "",
    costPrice: "",
    mrp: "",
    unit: "",
    categoryId: "",
    subcategoryId: "",
    barcode: "",
    hsnCode: "",
    gstRate: "",
    reorderLevel: "",
    minStock: "",
    maxStock: "",
    notes: "",
    bogoOfferEnabled: false,
    isActive: true
  });
  const [creatingItem, setCreatingItem] = useState(false);
  const [showCategoryCreation, setShowCategoryCreation] = useState(false);
  const [showSubcategoryCreation, setShowSubcategoryCreation] = useState(false);
  const [newCategoryInItemForm, setNewCategoryInItemForm] = useState("");
  const [newSubcategoryInItemForm, setNewSubcategoryInItemForm] = useState("");
  const [selectedCategoryForSubcategoryInItem, setSelectedCategoryForSubcategoryInItem] = useState(null);
  const [stockStatusFilter, setStockStatusFilter] = useState("all");

  // Reset to page 1 on initial mount/reload
  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      // Remove page parameter from URL and reset to page 1
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("page");
      setSearchParams(nextParams, { replace: true });
      setCurrentPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Clear search term when dropdown closes
  useEffect(() => {
    if (!categoryDropdownOpen) {
      setCategorySearchTerm("");
    }
  }, [categoryDropdownOpen]);
  const requestIdRef = useRef(0);
  const debouncedSearchTerm = useDebounce(searchTerm, 400);
  const categoryFilter = selectedCategory !== "all" ? selectedCategory : undefined;
  // Extract subcategory code from composite ID if needed
  const subcategoryFilter = selectedSubcategory !== "all"
    ? (selectedSubcategory.includes(':') ? selectedSubcategory.split(':')[1] : selectedSubcategory)
    : undefined;

  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const searchParamsString = searchParams.toString();

  const updatePageParam = useCallback(
    (pageNumber, options = {}) => {
      const nextParams = new URLSearchParams(searchParamsString);
      nextParams.set("page", String(pageNumber));
      setSearchParams(nextParams, options);
    },
    [searchParamsString, setSearchParams]
  );

  useEffect(() => {
    const pageParamValue = Number.parseInt(searchParams.get("page") ?? "", 10);
    if (Number.isFinite(pageParamValue) && pageParamValue > 0) {
      if (pageParamValue !== currentPage) {
        setCurrentPage(pageParamValue);
      }
      hadExplicitPageParamRef.current = true;
    } else if (searchParams.get("page") === null) {
      hadExplicitPageParamRef.current = false;
    }
  }, [searchParams, currentPage]);

  const fetchItemsPage = useCallback(
    async ({ page = currentPage, search = "", categoryId, subcategoryId } = {}) => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setErrorMessage(null);

      const normalizedPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
      const offset = (normalizedPage - 1) * pageSize;

      try {
        const params = {
          limit: pageSize,
          cursor: offset
        };

        const trimmedSearch = search?.trim();
        if (trimmedSearch) {
          params.q = trimmedSearch;
        }

        // Explicitly pass storeId to ensure search is filtered by selected store
        const storeId = selectedStore?._id || selectedStore?.id || selectedStore;
        if (storeId) {
          params.storeId = storeId;
        }

        if (categoryId !== undefined && categoryId !== null && categoryId !== "") {
          params.categoryId = categoryId;
        }

        if (subcategoryId !== undefined && subcategoryId !== null && subcategoryId !== "") {
          params.subcategoryId = subcategoryId;
        }

        const response = await itemsAPI.getItems(params);
        const pageItems =
          response?.data?.items ||
          response?.items ||
          response?.data ||
          [];

        if (requestId !== requestIdRef.current) {
          return;
        }

        const pagination = response?.data?.pagination || response?.pagination || null;
        const totalItems =
          pagination?.total ??
          (Number.isFinite(response?.total) ? response.total : pageItems.length) ??
          0;
        const limitFromResponse =
          pagination?.limit ??
          (Number.isFinite(response?.limit) ? response.limit : undefined) ??
          pageSize;
        const resolvedPageSize = limitFromResponse > 0 ? limitFromResponse : DEFAULT_PAGE_SIZE;
        const computedTotalPages =
          resolvedPageSize > 0 ? Math.max(1, Math.ceil(totalItems / resolvedPageSize)) : 1;

        setPageSize(resolvedPageSize);
        setTotalCount(totalItems);
        setTotalPages(computedTotalPages);

        // Disabled auto-select to latest page - always start at page 1
        // if (!hadExplicitPageParamRef.current && !autoSelectedLatestRef.current) {
        //   autoSelectedLatestRef.current = true;
        //   const latestPage = computedTotalPages;
        //   if (latestPage !== normalizedPage) {
        //     setCurrentPage(latestPage);
        //     updatePageParam(latestPage, { replace: true });
        //     return;
        //   }
        // }

        const latestPage = computedTotalPages;
        // If requested page is beyond total pages, go to page 1 instead of last page
        if (normalizedPage > latestPage && latestPage >= 1) {
          if (currentPage !== 1) {
            setCurrentPage(1);
            updatePageParam(1, { replace: true });
          }
          return;
        }

        setItems(pageItems);
      } catch (error) {
        console.error("Error loading items:", error);
        const message =
          error.response?.data?.message ||
          error.message ||
          "Failed to load items.";
        if (requestId === requestIdRef.current) {
          setErrorMessage(message);
          toast({
            title: "Unable to load items",
            description: message,
            variant: "destructive",
          });
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [currentPage, pageSize, toast, updatePageParam, selectedStore]
  );


  useEffect(() => {
    const loadCategories = async () => {
      try {
        // Get store_id from selectedStore
        const storeId = selectedStore?._id || selectedStore?.id || selectedStore;
        const categoryParams = { limit: 1000 };
        if (storeId) {
          categoryParams.store_id = storeId;
        }

        const categoriesResponse = await categoriesAPI.getCategories(categoryParams);
        const fetchedCategories =
          categoriesResponse?.data?.categories ||
          categoriesResponse?.categories ||
          [];
        setCategories(fetchedCategories);

        // Also load category hierarchy to get subcategories
        try {
          const hierarchyParams = storeId ? { store_id: storeId } : {};
          const hierarchyResponse = await categoriesAPI.getCategoryHierarchy(hierarchyParams);
          const hierarchy =
            hierarchyResponse?.data?.categories ||
            hierarchyResponse?.data ||
            hierarchyResponse?.categories ||
            [];
          setCategoryHierarchy(Array.isArray(hierarchy) ? hierarchy : []);
        } catch (hierarchyError) {
          console.error("Error loading category hierarchy:", hierarchyError);
          // Fallback: try to get subcategories from individual categories
          const hierarchyWithSubs = await Promise.all(
            fetchedCategories.map(async (cat) => {
              try {
                const catParams = storeId ? { store_id: storeId } : {};
                const catResponse = await categoriesAPI.getCategory(cat._id || cat.id, catParams);
                const subcategories = catResponse?.data?.subcategories || [];
                return { ...cat, subcategories };
              } catch {
                return { ...cat, subcategories: [] };
              }
            })
          );
          setCategoryHierarchy(hierarchyWithSubs);
        }
      } catch (error) {
        console.error("Error loading categories:", error);
      }
    };

    loadCategories();
  }, [selectedStore]);

  useEffect(() => {
    const loadBrands = async () => {
      try {
        const storeId = selectedStore?._id || selectedStore?.id || selectedStore;
        const brandParams = { limit: 1000 };
        if (storeId) {
          brandParams.store_id = storeId;
        }
        const activeSubId = isCreateItemOpen
          ? createItemForm.subcategoryId || null
          : isEditOpen
            ? editForm.subcategoryId || null
            : null;
        if (activeSubId) {
          brandParams.subcategory_id = activeSubId;
          brandParams.include_legacy = "true";
        }
        const brandsResponse = await brandsAPI.getBrands(brandParams);
        const fetchedBrands =
          brandsResponse?.data?.brands ||
          brandsResponse?.brands ||
          [];
        setBrands(Array.isArray(fetchedBrands) ? fetchedBrands : []);
      } catch (error) {
        console.error("Error loading brands:", error);
      }
    };
    loadBrands();
  }, [
    selectedStore,
    isCreateItemOpen,
    isEditOpen,
    createItemForm.subcategoryId,
    editForm.subcategoryId,
  ]);


  // Load categories when create item dialog opens
  useEffect(() => {
    if (isCreateItemOpen) {
      // Ensure categories are loaded
      const loadCategoriesForItemForm = async () => {
        try {
          // Get store_id from selectedStore
          const storeId = selectedStore?._id || selectedStore?.id || selectedStore;
          const categoryParams = { limit: 1000 };
          if (storeId) {
            categoryParams.store_id = storeId;
          }

          const categoriesResponse = await categoriesAPI.getCategories(categoryParams);
          const fetchedCategories =
            categoriesResponse?.data?.categories ||
            categoriesResponse?.categories ||
            [];
          setCategories(fetchedCategories);

          const hierarchyParams = storeId ? { store_id: storeId } : {};
          const hierarchyResponse = await categoriesAPI.getCategoryHierarchy(hierarchyParams);
          const hierarchy =
            hierarchyResponse?.data?.categories ||
            hierarchyResponse?.data ||
            hierarchyResponse?.categories ||
            [];
          setCategoryHierarchy(Array.isArray(hierarchy) ? hierarchy : []);
        } catch (error) {
          console.error("Error loading categories:", error);
        }
      };
      loadCategoriesForItemForm();
    }
  }, [isCreateItemOpen, selectedStore]);

  // Load categories when edit item dialog opens
  useEffect(() => {
    if (isEditOpen) {
      // Ensure categories are loaded for edit form
      const loadCategoriesForEditForm = async () => {
        try {
          // Get store_id from selectedStore
          const storeId = selectedStore?._id || selectedStore?.id || selectedStore;
          const categoryParams = { limit: 1000 };
          if (storeId) {
            categoryParams.store_id = storeId;
          }

          const categoriesResponse = await categoriesAPI.getCategories(categoryParams);
          const fetchedCategories =
            categoriesResponse?.data?.categories ||
            categoriesResponse?.categories ||
            [];
          setCategories(fetchedCategories);

          const hierarchyParams = storeId ? { store_id: storeId } : {};
          const hierarchyResponse = await categoriesAPI.getCategoryHierarchy(hierarchyParams);
          const hierarchy =
            hierarchyResponse?.data?.categories ||
            hierarchyResponse?.data ||
            hierarchyResponse?.categories ||
            [];
          setCategoryHierarchy(Array.isArray(hierarchy) ? hierarchy : []);
        } catch (error) {
          console.error("Error loading categories:", error);
        }
      };
      const loadBrandsForEditForm = async () => {
        try {
          const storeId = selectedStore?._id || selectedStore?.id || selectedStore;
          const brandParams = { limit: 1000 };
          if (storeId) {
            brandParams.store_id = storeId;
          }
          const brandsResponse = await brandsAPI.getBrands(brandParams);
          const fetchedBrands =
            brandsResponse?.data?.brands ||
            brandsResponse?.brands ||
            [];
          setBrands(Array.isArray(fetchedBrands) ? fetchedBrands : []);
        } catch (error) {
          console.error("Error loading brands:", error);
        }
      };

      loadCategoriesForEditForm();
      loadBrandsForEditForm();
    }
  }, [isEditOpen, selectedStore]);

  useEffect(() => {
    fetchItemsPage({
      page: currentPage,
      search: debouncedSearchTerm,
      categoryId: categoryFilter,
      subcategoryId: subcategoryFilter
    });
  }, [fetchItemsPage, debouncedSearchTerm, categoryFilter, subcategoryFilter, currentPage]);

  const pageNumbers = useMemo(() => {
    if (!totalPages || totalPages <= 0) {
      return [];
    }
    // Show first 10 pages, or pages around current page if we're beyond page 10
    const maxPagesToShow = 10;
    if (totalPages <= maxPagesToShow) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    // If current page is in first 10, show first 10
    if (currentPage <= maxPagesToShow) {
      return Array.from({ length: maxPagesToShow }, (_, index) => index + 1);
    }

    // Otherwise, show pages around current page (5 before, current, 4 after)
    const startPage = Math.max(1, currentPage - 5);
    const endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    return Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);
  }, [totalPages, currentPage]);

  const handlePageChange = useCallback(
    (pageNumber) => {
      if (!Number.isFinite(pageNumber)) {
        return;
      }
      const normalized = Math.floor(pageNumber);
      const clamped = Math.min(Math.max(normalized, 1), totalPages || 1);
      if (clamped === currentPage) {
        return;
      }
      hadExplicitPageParamRef.current = true;
      setCurrentPage(clamped);
      updatePageParam(clamped);
    },
    [currentPage, totalPages, updatePageParam]
  );

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.defaultPrevented) {
        return;
      }

      const activeElement = document.activeElement;
      if (activeElement) {
        const tagName = activeElement.tagName?.toLowerCase();
        const isEditable =
          activeElement.isContentEditable ||
          tagName === "input" ||
          tagName === "textarea" ||
          tagName === "select";
        if (isEditable) {
          return;
        }
      }

      if (event.key === "ArrowLeft") {
        if (currentPage < totalPages) {
          handlePageChange(currentPage + 1);
          event.preventDefault();
        }
      } else if (event.key === "ArrowRight") {
        if (currentPage > 1) {
          handlePageChange(currentPage - 1);
          event.preventDefault();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, totalPages, handlePageChange]);

  const normalizeStockNumber = useCallback((value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }, []);

  const evaluateStockStatus = useCallback(
    (item) => {
      const stock = normalizeStockNumber(item.stock ?? item.quantity ?? 0);
      // Ensure minStock and maxStock are properly parsed as numbers
      const minStock = normalizeStockNumber(
        typeof item.minStock === 'string'
          ? parseFloat(item.minStock.split(' ')[0]) || item.reorderLevel || 0
          : (item.minStock ?? item.reorderLevel ?? 0)
      );
      const maxStock = normalizeStockNumber(
        typeof item.maxStock === 'string'
          ? parseFloat(item.maxStock.split(' ')[0]) || 0
          : (item.maxStock ?? 0)
      );
      const isCriticalStock = stock <= CRITICAL_STOCK_THRESHOLD;
      const isNoMovement = stock <= 0;
      const isBelowConfiguredMin = minStock > 0 && stock < minStock;

      if (isCriticalStock) {
        return {
          key: isNoMovement ? "no-movement" : "low",
          label: isNoMovement ? "No movement" : "Low stock",
          badgeClass: "bg-red-100 text-red-700 border border-red-200",
          cardClass: "ring-1 ring-red-200",
          backgroundClass: "bg-red-50",
          description: isNoMovement
            ? "No stock movement recorded"
            : `${stock} unit${stock === 1 ? "" : "s"} left`
        };
      }

      if (isBelowConfiguredMin) {
        return {
          key: "low",
          label: "Below minimum",
          badgeClass: "bg-red-100 text-red-700 border border-red-200",
          cardClass: "ring-1 ring-red-200",
          backgroundClass: "bg-red-50",
          description: `Below minimum (${stock}/${minStock})`
        };
      }

      if (maxStock > 0 && stock > maxStock) {
        return {
          key: "overstock",
          label: "Above maximum",
          badgeClass: "bg-amber-100 text-amber-700 border border-amber-200",
          cardClass: "ring-1 ring-amber-200",
          backgroundClass: "bg-amber-50",
          description: `Above maximum (${stock}/${maxStock})`
        };
      }

      if (minStock > 0 || maxStock > 0) {
        return {
          key: "healthy",
          label: "Within range",
          badgeClass: "bg-emerald-100 text-emerald-800 border border-emerald-200",
          cardClass: "ring-1 ring-emerald-200",
          backgroundClass: "bg-emerald-50/60",
          description: "Stock level is healthy"
        };
      }

      return {
        key: "normal",
        label: "In stock",
        badgeClass: "bg-blue-100 text-blue-800 border border-blue-200",
        cardClass: "ring-1 ring-blue-200",
        backgroundClass: "bg-blue-50",
        description: "Stock available"
      };
    },
    [normalizeStockNumber]
  );

  const getCategoryLabel = useCallback(
    (categoryId) => {
      if (!categoryId) return null;
      const match = categoryHierarchy.find(
        (category) => String(category._id ?? category.id) === String(categoryId)
      );
      return match?.name ?? null;
    },
    [categoryHierarchy]
  );

  const filteredItems = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        item.name?.toLowerCase().includes(query) ||
        (item.sku && item.sku.toLowerCase().includes(query)) ||
        (item.itemCode && String(item.itemCode).toLowerCase().includes(query));

      const matchesCategory =
        selectedCategory === "all" ||
        String(item.categoryId || '').trim() === String(selectedCategory).trim() ||
        item.category?._id === selectedCategory ||
        item.category?.id === selectedCategory;

      const itemSubcategoryId = item.subcategoryId ? String(item.subcategoryId).trim() : '';
      const itemSubcategoryName = item.subcategory?.name ? String(item.subcategory.name).trim() : '';

      // Extract subcategory code from composite ID (format: "categoryCode:subcategoryCode")
      const selectedSubcategoryCode = selectedSubcategory === "all"
        ? null
        : selectedSubcategory.includes(':')
          ? selectedSubcategory.split(':')[1]
          : selectedSubcategory;

      const matchesSubcategory =
        selectedSubcategory === "all" ||
        itemSubcategoryId === String(selectedSubcategoryCode || selectedSubcategory).trim() ||
        itemSubcategoryName === String(selectedSubcategoryCode || selectedSubcategory).trim() ||
        item.subcategory?._id === selectedSubcategory ||
        item.subcategory?.id === selectedSubcategory ||
        item.subcategory?.code === selectedSubcategory ||
        item.subcategory?.code === selectedSubcategoryCode;

      const stockStatus = evaluateStockStatus(item);
      const matchesStockStatus =
        stockStatusFilter === "all" || stockStatus.key === stockStatusFilter;

      return matchesSearch && matchesCategory && matchesSubcategory && matchesStockStatus;
    });
  }, [items, searchTerm, selectedCategory, selectedSubcategory, stockStatusFilter, evaluateStockStatus]);

  const identifierForItem = (item) =>
    String(item?.id ?? item?._id ?? item?.itemCode ?? "");

  const resetEditState = () => {
    setIsEditOpen(false);
    setEditingItem(null);
    setEditForm({
      name: "",
      sku: "",
      description: "",
      brand: "",
      brandId: "",
    brandId: "",
      price: "",
      costPrice: "",
      mrp: "",
      unit: "",
      categoryId: "",
      subcategoryId: "",
      barcode: "",
      hsnCode: "",
      gstRate: "",
      reorderLevel: "",
      minStock: "",
      maxStock: "",
      notes: "",
      bogoOfferEnabled: false,
      isActive: true
    });
    setItemBatches([]);
    // Reset selected batch and loading barcodes when dialog closes
    setSelectedBatchIndex(null);
    setLoadingBarcodes(false);
    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(null);
    setImageFile(null);
    setImageMetadata(null);
  };

  const handleDialogOpenChange = (open) => {
    if (!open) {
      resetEditState();
    } else {
      setIsEditOpen(true);
    }
  };

  const handleEditClick = async (item) => {
    const identifier = identifierForItem(item);
    if (!identifier) {
      toast({
        title: "Unable to edit item",
        description: "Item identifier is missing.",
        variant: "destructive"
      });
      return;
    }

    setEditingItem(item);
    setEditForm({
      name: item.name || "",
      sku: item.sku || item.itemCode || "",
      description: item.description || "",
      brand: item.brand || "",
      price:
        item.price !== undefined && item.price !== null
          ? String(item.price)
          : item.sellingPrice !== undefined && item.sellingPrice !== null
            ? String(item.sellingPrice)
            : "",
      costPrice:
        item.costPrice !== undefined && item.costPrice !== null
          ? String(item.costPrice)
          : "",
      mrp:
        item.mrp !== undefined && item.mrp !== null
          ? String(item.mrp)
          : "",
      unit: item.unit || "",
      categoryId: item.categoryId ? String(item.categoryId) : "",
      subcategoryId: item.subcategoryId ? String(item.subcategoryId) : "",
      barcode: item.barcode || "",
      hsnCode: item.hsnCode || "",
      gstRate:
        item.gstRate !== undefined && item.gstRate !== null
          ? String(item.gstRate)
          : "",
      reorderLevel:
        item.reorderLevel !== undefined && item.reorderLevel !== null
          ? String(item.reorderLevel)
          : "",
      minStock:
        item.minStock !== undefined && item.minStock !== null
          ? String(item.minStock)
          : "",
      maxStock:
        item.maxStock !== undefined && item.maxStock !== null
          ? String(item.maxStock)
          : "",
      notes: item.notes || "",
      bogoOfferEnabled: Boolean(
        String(item.bogoOffer ?? item.bogo_offer ?? "").trim()
      ),
      isActive: item.isActive !== undefined ? item.isActive : true
    });
    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(item.imageUrl || null);
    setImageFile(null);
    setImageMetadata(null);

    // Fetch batches with barcodes for this item
    setLoadingBatches(true);
    setItemBatches([]);
    setSelectedBatchIndex(null);
    setLoadingBarcodes(false);

    try {
      const itemSku = (item.sku || item.itemCode || '').toString().trim();
      const itemName = (item.name || '').toString().trim();
      const storeId = item.store?._id || item.store || selectedStore?._id || selectedStore?.id;

      console.log("Fetching batches for item:", { itemSku, itemName, storeId });

      // Try to fetch stock with batches - fetch ALL batches first, then filter
      // Don't filter by store ID initially - get ALL batches across all stores
      let stockData = [];
      try {
        const params = {}; // Don't filter by store or search - get ALL batches

        console.log("=== FETCHING ALL BATCHES ===");
        console.log("Calling getStockWithBatches with params (NO FILTERS):", params);
        const response = await itemsAPI.getStockWithBatches(params);
        console.log("=== RAW RESPONSE ===");
        console.log("Response:", response);
        console.log("Response type:", typeof response);
        console.log("Response.data:", response?.data);
        console.log("Is response.data array?", Array.isArray(response?.data));

        // Handle different response structures
        // Backend returns: { status: 'success', data: batches }
        // apiRequest returns the parsed JSON, so response = { status: 'success', data: batches }
        if (response?.data && Array.isArray(response.data)) {
          stockData = response.data;
          console.log("✓ Using response.data (array)");
        } else if (Array.isArray(response)) {
          stockData = response;
          console.log("✓ Using response directly (array)");
        } else if (response?.data?.data && Array.isArray(response.data.data)) {
          stockData = response.data.data;
          console.log("✓ Using response.data.data (nested array)");
        } else {
          stockData = [];
          console.warn("⚠ No valid array found in response structure");
          console.log("Full response structure:", JSON.stringify(response, null, 2));
        }
        console.log("=== PARSED BATCHES ===");
        console.log("Total batches fetched:", stockData.length);
        console.log("First 3 batches:", stockData.slice(0, 3));
      } catch (stockError) {
        console.warn("Stock with batches endpoint error, fetching from purchase orders:", stockError);
        // If endpoint doesn't exist, fetch from purchase orders directly
        try {
          const poParams = {
            limit: 200
          };
          if (itemSku || itemName) {
            poParams.search = itemSku || itemName;
          }
          if (storeId) {
            poParams.storeId = storeId;
          }
          // Don't filter by status - check all POs

          console.log("Fetching purchase orders with params:", poParams);
          const posResponse = await purchaseOrdersAPI.getPurchaseOrders(poParams);
          const pos = posResponse.data?.purchaseOrders || posResponse.data || posResponse.purchaseOrders || [];
          console.log("Fetched purchase orders:", pos.length);

          // Extract batches from purchase orders
          const batchMap = new Map();
          for (const po of pos) {
            if (!po.items || !Array.isArray(po.items)) {
              continue;
            }

            for (const poItem of po.items) {
              // Check for batch number in various field formats
              const batchNumber = poItem.batchNumber || poItem.batch_number || poItem.batch || '';

              // Only include items with batch numbers
              if (!batchNumber || String(batchNumber).trim() === '') {
                continue;
              }

              const batchKey = `${(poItem.sku || poItem.itemSku || '').toString().trim()}-${String(batchNumber).trim()}-${String(po._id || po.id)}`;

              if (!batchMap.has(batchKey)) {
                batchMap.set(batchKey, {
                  sku: poItem.sku || poItem.itemSku || poItem.item_code || '',
                  itemName: poItem.itemName || poItem.name || poItem.particulars || '',
                  batchNumber: String(batchNumber).trim(),
                  batchQuantity: Number(poItem.quantity || poItem.poQty || 0),
                  costPrice: Number(poItem.costPrice || poItem.price || poItem.cost || 0),
                  expiryDate: poItem.expiryDate || poItem.expiry_date || null,
                  purchaseOrderId: String(po._id || po.id),
                  purchaseOrderNumber: po.poNumber || po.po_number || po.poNumber || '',
                  purchaseDate: po.orderDate || po.order_date || po.date || null,
                  hsnNumber: poItem.hsnNumber || poItem.hsn_number || poItem.hsnCode || '',
                  categoryName: poItem.categoryName || poItem.category_name || poItem.category || '',
                  subcategoryName: poItem.subcategoryName || poItem.subcategory_name || poItem.subcategory || '',
                  barcodes: []
                });
              } else {
                const existing = batchMap.get(batchKey);
                existing.batchQuantity += Number(poItem.quantity || poItem.poQty || 0);
              }
            }
          }
          stockData = Array.from(batchMap.values());
          console.log("Extracted batches from purchase orders:", stockData.length, stockData);
        } catch (poError) {
          console.error("Error fetching batches from purchase orders:", poError);
          console.error("Error details:", poError.message, poError.stack);
          stockData = [];
        }
      }

      // Filter batches for this specific item - use more flexible matching
      // Convert SKUs to strings for comparison (database has integers, items might have strings)
      const normalizedItemSku = itemSku ? String(itemSku).trim().toLowerCase() : '';
      const normalizedItemName = itemName ? itemName.trim().toLowerCase() : '';

      console.log("=== FILTERING BATCHES FOR ITEM ===");
      console.log("Item SKU:", normalizedItemSku);
      console.log("Item Name:", normalizedItemName);
      console.log("Total batches to filter:", stockData.length);
      console.log("Sample batches (first 5):", stockData.slice(0, 5).map(b => ({
        sku: b.sku || b.itemSku,
        itemName: b.itemName || b.name,
        batchNumber: b.batchNumber
      })));

      const itemBatchesData = stockData.filter(stock => {
        // Handle SKU matching - convert both to strings for comparison
        const stockSku = stock.sku || stock.itemSku || '';
        const stockSkuStr = String(stockSku).trim().toLowerCase();

        // Handle item name matching
        const stockName = (stock.itemName || stock.name || '').toString().trim().toLowerCase();

        let matches = false;
        let matchReason = '';

        // Try exact SKU match (both as strings and as numbers)
        if (normalizedItemSku && stockSkuStr) {
          // Exact string match
          if (stockSkuStr === normalizedItemSku) {
            matches = true;
            matchReason = 'exact SKU string match';
          }
          // Try numeric match (in case one is number and one is string)
          else if (!matches && !isNaN(normalizedItemSku) && !isNaN(stockSkuStr)) {
            const itemSkuNum = Number(normalizedItemSku);
            const stockSkuNum = Number(stockSkuStr);
            if (itemSkuNum === stockSkuNum && itemSkuNum !== 0) {
              matches = true;
              matchReason = 'exact SKU numeric match';
            }
          }
        }

        // Try exact name match
        if (!matches && normalizedItemName && stockName) {
          if (stockName === normalizedItemName) {
            matches = true;
            matchReason = 'exact name match';
          }
        }

        // Try partial matches if exact didn't work
        if (!matches) {
          if (normalizedItemSku && stockSkuStr) {
            // Partial SKU match
            if (stockSkuStr.includes(normalizedItemSku) || normalizedItemSku.includes(stockSkuStr)) {
              matches = true;
              matchReason = 'partial SKU match';
            }
          }

          if (!matches && normalizedItemName && stockName) {
            // Partial name match - check if one contains the other
            if (stockName.includes(normalizedItemName) || normalizedItemName.includes(stockName)) {
              matches = true;
              matchReason = 'partial name match (contains)';
            }
            // Also try removing spaces and special characters for matching
            if (!matches) {
              const normalizedNameClean = normalizedItemName.replace(/\s+/g, '').replace(/[^a-z0-9]/gi, '');
              const stockNameClean = stockName.replace(/\s+/g, '').replace(/[^a-z0-9]/gi, '');
              if (normalizedNameClean && stockNameClean &&
                (stockNameClean.includes(normalizedNameClean) || normalizedNameClean.includes(stockNameClean))) {
                matches = true;
                matchReason = 'partial name match (normalized)';
              }
            }
          }
        }

        if (matches) {
          console.log("✓ MATCHED BATCH:", {
            reason: matchReason,
            itemSku: normalizedItemSku,
            stockSku: stockSkuStr,
            itemName: normalizedItemName,
            stockName,
            batchNumber: stock.batchNumber,
            poNumber: stock.purchaseOrderNumber
          });
        }

        return matches;
      });

      console.log("Filtered batches for item:", itemBatchesData.length, itemBatchesData);

      // Load batches without barcodes initially
      // Barcodes will be loaded when a batch is selected from dropdown
      const batchesWithoutBarcodes = itemBatchesData.map(batch => ({
        ...batch,
        barcodes: [],
        barcodesLoaded: false
      }));

      setItemBatches(batchesWithoutBarcodes);

      if (batchesWithoutBarcodes.length === 0) {
        console.log("No batches found for item:", { itemSku, itemName, totalBatchesChecked: stockData.length });
        toast({
          title: "No batches found",
          description: `No batches found for ${itemName || itemSku}. Batches are created when items are added to purchase orders.`,
          variant: "default"
        });
      } else {
        console.log(`Found ${batchesWithoutBarcodes.length} batch(es) for item`);
      }
    } catch (error) {
      console.error("Error loading batches:", error);
      setItemBatches([]);
      toast({
        title: "Error loading batches",
        description: error.message || "Could not load batches for this item.",
        variant: "destructive"
      });
    } finally {
      setLoadingBatches(false);
    }

    setIsEditOpen(true);
  };

  // Function to load barcodes for a specific batch
  const loadBarcodesForBatch = async (batch, batchIndex) => {
    // If barcodes are already loaded, don't load again
    if (batch.barcodesLoaded && batch.barcodes && batch.barcodes.length > 0) {
      return;
    }

    // Set loading state
    setLoadingBarcodes(true);

    try {
      let barcodes = [];
      if (batch.purchaseOrderId || batch.purchaseOrderNumber) {
        try {
          let poId = batch.purchaseOrderId;

          // If we only have PO number, try to find the PO ID
          if (!poId && batch.purchaseOrderNumber) {
            try {
              const posResponse = await purchaseOrdersAPI.getPurchaseOrders({
                search: batch.purchaseOrderNumber,
                limit: 10
              });
              const pos = posResponse.data?.purchaseOrders || posResponse.data || [];
              // Find exact match by PO number
              const matchingPO = pos.find(po =>
                (po.poNumber || po.po_number || '').toString().trim() === batch.purchaseOrderNumber.toString().trim()
              );
              if (matchingPO) {
                poId = matchingPO._id || matchingPO.id;
              } else if (pos.length > 0) {
                poId = pos[0]._id || pos[0].id;
              }
            } catch (poSearchError) {
              console.error("Error finding PO by number:", poSearchError);
            }
          }

          // Get barcodes from PO if we have the ID
          if (poId) {
            try {
              const poResponse = await purchaseOrdersAPI.getPurchaseOrderBarcodes(poId);
              // Handle different response structures
              let barcodeData = poResponse.data || poResponse;
              if (barcodeData?.data) {
                barcodeData = barcodeData.data;
              }

              if (barcodeData?.groupedBarcodes && Array.isArray(barcodeData.groupedBarcodes)) {
                // Match barcodes by batch number and SKU/item name
                const batchSku = (batch.sku || '').toString().trim().toLowerCase();
                const batchName = (batch.itemName || '').toString().trim().toLowerCase();
                const batchNumber = (batch.batchNumber || '').toString().trim().toLowerCase();

                for (const group of barcodeData.groupedBarcodes) {
                  const groupSku = (group.itemSku || group.sku || '').toString().trim().toLowerCase();
                  const groupName = (group.itemName || group.name || '').toString().trim().toLowerCase();
                  const groupBatchNumber = (group.batchNumber || '').toString().trim().toLowerCase();

                  // Match by SKU or item name first
                  const skuMatch = batchSku && groupSku && (
                    batchSku === groupSku ||
                    batchSku.includes(groupSku) ||
                    groupSku.includes(batchSku)
                  );
                  const nameMatch = batchName && groupName && (
                    batchName === groupName ||
                    batchName.includes(groupName) ||
                    groupName.includes(batchName)
                  );

                  // If we have a match by SKU or name, check batch number
                  if (skuMatch || nameMatch) {
                    // If both have batch numbers, they must match
                    // If one doesn't have a batch number, still include it
                    if (batchNumber && groupBatchNumber) {
                      // Both have batch numbers - must match
                      if (batchNumber === groupBatchNumber) {
                        if (group.barcodes && Array.isArray(group.barcodes)) {
                          barcodes.push(...group.barcodes);
                        }
                      }
                    } else if (!batchNumber && !groupBatchNumber) {
                      // Neither has batch number - include it
                      if (group.barcodes && Array.isArray(group.barcodes)) {
                        barcodes.push(...group.barcodes);
                      }
                    }
                  }
                }
              } else if (barcodeData?.barcodes && Array.isArray(barcodeData.barcodes)) {
                // Handle flat array of barcodes
                barcodes = barcodeData.barcodes;
              } else if (Array.isArray(barcodeData)) {
                // Handle direct array response
                barcodes = barcodeData;
              }

              // Remove duplicates and normalize barcode format
              // Also preserve group information for accurate label data
              const uniqueBarcodes = [];
              const seenBarcodes = new Set();
              
              // If we have groupedBarcodes, preserve the group info with each barcode
              if (barcodeData?.groupedBarcodes && Array.isArray(barcodeData.groupedBarcodes)) {
                console.log('Processing groupedBarcodes:', barcodeData.groupedBarcodes.length, 'groups');
                for (const group of barcodeData.groupedBarcodes) {
                  const groupSku = (group.itemSku || group.sku || '').toString().trim().toLowerCase();
                  const groupName = (group.itemName || group.name || '').toString().trim().toLowerCase();
                  const groupBatchNumber = (group.batchNumber || '').toString().trim().toLowerCase();
                  
                  // Check if this group matches our batch
                  const batchSku = (batch.sku || '').toString().trim().toLowerCase();
                  const batchName = (batch.itemName || '').toString().trim().toLowerCase();
                  const batchNumber = (batch.batchNumber || '').toString().trim().toLowerCase();
                  
                  const skuMatch = batchSku && groupSku && (
                    batchSku === groupSku ||
                    batchSku.includes(groupSku) ||
                    groupSku.includes(batchSku)
                  );
                  const nameMatch = batchName && groupName && (
                    batchName === groupName ||
                    batchName.includes(groupName) ||
                    groupName.includes(batchName)
                  );
                  
                  // Match by batch number first - if batch numbers match, include the group
                  // This ensures we get all items for the same batch, even if item names differ slightly
                  const batchMatch = (!batchNumber && !groupBatchNumber) || 
                                    (batchNumber && groupBatchNumber && batchNumber === groupBatchNumber);
                  
                  // Include if batch matches OR if SKU/name matches (more flexible matching)
                  if (batchMatch || (skuMatch || nameMatch)) {
                    console.log('Including group:', {
                      groupName: group.itemName || group.name,
                      groupSku: group.itemSku || group.sku,
                      groupBatchNumber,
                      batchMatch,
                      skuMatch,
                      nameMatch
                    });
                    // Add barcodes from this group with group metadata
                    if (group.barcodes && Array.isArray(group.barcodes)) {
                      for (const barcodeItem of group.barcodes) {
                        const barcodeValue = barcodeItem.barcode || barcodeItem;
                        if (barcodeValue && !seenBarcodes.has(barcodeValue)) {
                          seenBarcodes.add(barcodeValue);
                          // Use item details from barcodeItem if available, otherwise from group
                          const barcodeObj = typeof barcodeItem === 'string' 
                            ? { barcode: barcodeItem }
                            : barcodeItem;
                          // Store the full group data with each barcode for accurate label generation
                          uniqueBarcodes.push({
                            barcode: barcodeObj.barcode || barcodeValue,
                            // Prefer barcode item data, then group data, then batch data
                            itemName: barcodeObj.itemName || barcodeObj.name || group.itemName || group.name || batch.itemName || '',
                            itemSku: barcodeObj.itemSku || barcodeObj.sku || group.itemSku || group.sku || batch.sku || '',
                            expiryDate: barcodeObj.expiryDate || group.expiryDate || batch.expiryDate,
                            amount: barcodeObj.amount || barcodeObj.costPrice || group.amount || group.costPrice || batch.costPrice || batch.amount,
                            batchNumber: barcodeObj.batchNumber || group.batchNumber || batch.batchNumber,
                            // Store the full group object for reference
                            _groupData: group,
                            _barcodeObj: barcodeObj
                          });
                        }
                      }
                    }
                  }
                }
              } else {
                // Fallback for non-grouped barcodes
                for (const barcodeItem of barcodes) {
                  const barcodeValue = barcodeItem.barcode || barcodeItem;
                  if (barcodeValue && !seenBarcodes.has(barcodeValue)) {
                    seenBarcodes.add(barcodeValue);
                    uniqueBarcodes.push({
                      barcode: typeof barcodeItem === 'string' ? barcodeItem : (barcodeItem.barcode || barcodeItem),
                      itemName: batch.itemName || '',
                      itemSku: batch.sku || '',
                      expiryDate: batch.expiryDate,
                      amount: batch.costPrice || batch.amount,
                      batchNumber: batch.batchNumber
                    });
                  }
                }
              }
              barcodes = uniqueBarcodes;
              console.log(`Loaded ${barcodes.length} barcodes for batch ${batch.batchNumber}`);
            } catch (barcodeError) {
              console.error("Error fetching barcodes for batch:", batch.batchNumber, barcodeError);
            }
          } else {
            console.warn("No purchase order ID found for batch:", batch.batchNumber);
          }
        } catch (error) {
          console.error("Error processing batch barcodes:", error);
        }
      } else {
        console.warn("Batch has no purchase order ID or number:", batch);
      }

      // Update the batch with loaded barcodes
      setItemBatches(prevBatches => {
        const updatedBatches = [...prevBatches];
        if (updatedBatches[batchIndex]) {
          updatedBatches[batchIndex] = {
            ...updatedBatches[batchIndex],
            barcodes,
            barcodesLoaded: true
          };
        }
        return updatedBatches;
      });
    } catch (error) {
      console.error("Error loading barcodes for batch:", error);
    } finally {
      setLoadingBarcodes(false);
    }
  };

  // Handle batch selection from dropdown
  const handleBatchSelect = async (batchIndexStr) => {
    const batchIndex = parseInt(batchIndexStr, 10);
    if (isNaN(batchIndex) || batchIndex < 0 || batchIndex >= itemBatches.length) {
      setSelectedBatchIndex(null);
      return;
    }

    console.log("Batch selected:", batchIndex, itemBatches[batchIndex]);
    setSelectedBatchIndex(batchIndex);
    const selectedBatch = itemBatches[batchIndex];

    // Always load barcodes when batch is selected (even if already loaded, refresh)
    if (selectedBatch) {
      await loadBarcodesForBatch(selectedBatch, batchIndex);
    }
  };

  // Handle printing barcodes - directly print in double label mode
  const handlePrintBarcodes = () => {
    // Check if batch is selected
    if (selectedBatchIndex === null || !itemBatches[selectedBatchIndex]) {
      toast({
        title: "Error",
        description: "Please select a batch first",
        variant: "destructive"
      });
      return;
    }

    const selectedBatch = itemBatches[selectedBatchIndex];
    
    // Check if we have barcode data
    if (!selectedBatch.barcodes || selectedBatch.barcodes.length === 0) {
      toast({
        title: "Error",
        description: "No barcodes available for this batch. Please wait for barcodes to load.",
        variant: "destructive"
      });
      return;
    }

    // Wait longer for DOM to be ready, then print directly in double mode
    // Give more time for labels to render with their individual data and barcodes
    setTimeout(() => {
      handlePrintLabels();
    }, 1500);
  };

  // Print function - always uses double label mode (2 labels per page)
  const handlePrintLabels = async () => {
    const mode = 'double'; // Always use double label print
    
    // Check if we have batch data
    if (selectedBatchIndex === null || !itemBatches[selectedBatchIndex]) {
      toast({
        title: "Error",
        description: "Please select a batch first",
        variant: "destructive"
      });
      return;
    }

    const selectedBatch = itemBatches[selectedBatchIndex];

    // Always build labels from data to ensure each label has correct individual details
    // This is more reliable than DOM extraction and ensures all details are included
    console.log('Building labels from data with individual item details');
    
    let labelsHTML = '';
    
    // Get default data for labels (fallback)
    const defaultStoreName = selectedStore?.name || 'MURUGAN SUPER MARKET';
    const defaultItemName = selectedBatch.itemName || editingItem?.name || 'Item';
    const defaultSku = selectedBatch.sku || editingItem?.sku || editingItem?.itemCode || '';
    const defaultExpiryDate = selectedBatch.expiryDate;
    const defaultPrice = selectedBatch.costPrice || selectedBatch.amount || 0;
    const defaultBatchNumber = selectedBatch.batchNumber;
    
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
          width: 4.2,
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
    
    // Generate labels from barcode data with barcode images
    // Use item-specific data from each barcode item if available
    console.log('Generating labels for batch:', selectedBatch);
    console.log('Barcodes to print:', selectedBatch.barcodes);
    
    selectedBatch.barcodes.forEach((barcodeItem, index) => {
      const barcodeValue = barcodeItem.barcode || barcodeItem;
      
      // Use item-specific data from barcode item, fallback to batch/default data
      // First try the stored properties we set when loading barcodes
      let itemName = barcodeItem.itemName || barcodeItem.name;
      let sku = barcodeItem.itemSku || barcodeItem.sku;
      
      // If not found, try the group data we stored
      if (!itemName && barcodeItem._groupData) {
        itemName = barcodeItem._groupData.itemName || barcodeItem._groupData.name;
      }
      if (!sku && barcodeItem._groupData) {
        sku = barcodeItem._groupData.itemSku || barcodeItem._groupData.sku;
      }
      
      // Final fallback to batch/default data
      itemName = itemName || defaultItemName;
      sku = sku || defaultSku;
      
      // For barcode generation, use SKU if available, otherwise use barcode value
      const barcodeToShow = sku || String(barcodeValue);
      // For display, always show SKU if available, otherwise show barcode
      const skuToDisplay = sku || String(barcodeValue);
      
      // Get expiry date, price, and batch number with proper fallbacks
      // Use the stored group data if available
      let expiryDate = barcodeItem.expiryDate;
      let price = barcodeItem.amount || barcodeItem.costPrice;
      let batchNumber = barcodeItem.batchNumber;
      
      // Try group data if available (stored when loading barcodes)
      if (barcodeItem._groupData) {
        if (!expiryDate) expiryDate = barcodeItem._groupData.expiryDate;
        if (!price) price = barcodeItem._groupData.amount || barcodeItem._groupData.costPrice;
        if (!batchNumber) batchNumber = barcodeItem._groupData.batchNumber;
      }
      
      // Final fallback to defaults
      expiryDate = expiryDate || defaultExpiryDate;
      price = price || defaultPrice;
      batchNumber = batchNumber || defaultBatchNumber;
      
      const formattedExpiryDate = formatDate(expiryDate);
      const priceText = price ? `Rs. ${Number(price).toFixed(2)}` : '';
      const batchText = batchNumber ? `Batch: ${batchNumber}` : '';
      const storeName = defaultStoreName;
      
      // Debug logging for each label - log all labels to see the data
      console.log(`Label ${index}:`, {
        barcodeValue,
        itemName,
        sku,
        barcodeToShow,
        expiryDate: formattedExpiryDate,
        price,
        batchNumber,
        'has _groupData': !!barcodeItem._groupData,
        'barcodeItem keys': Object.keys(barcodeItem),
        'barcodeItem': barcodeItem
      });
      
      // Generate barcode image from data
      const barcodeImage = generateBarcodeImage(barcodeToShow);
      
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
                <span>EXP: ${formattedExpiryDate || 'N/A'}</span>
                ${priceText ? `<span>${priceText}</span>` : '<span>Rs. 0.00</span>'}
              </div>
            </div>
          </div>
        </div>
      `;
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

    const batchItemName = selectedBatchIndex !== null && itemBatches[selectedBatchIndex]
      ? (itemBatches[selectedBatchIndex].itemName || editingItem?.name || 'Item')
      : (editingItem?.name || 'Item');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Barcode Labels - ${batchItemName}</title>
          <meta charset="UTF-8">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            @page {
              size: ${pageWidth} ${pageHeight};
              margin: 0 0.25mm 0.15mm 0.25mm;
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
              position: relative;
              z-index: 2;
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
            
            // If regex method didn't work, try simpler approach
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
                // Split into pairs
                const allLabels = labelsHTML;
                pagesHTML = '<div class="labels-page">' + allLabels + '</div>';
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
    // Use onload since addEventListener might not work with document.write
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

  const handleFormChange = (field) => (event) => {
    const value = event.target.value;
    setEditForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
      setImagePreview(editingItem?.imageUrl || null);
      setImageFile(null);
      setImageMetadata(null);
      return;
    }

    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    const previewUrl = URL.createObjectURL(file);
    setImageFile(file);
    setImagePreview(previewUrl);

    // Get image dimensions and file size
    const img = new Image();
    img.onload = () => {
      const fileSizeInKB = (file.size / 1024).toFixed(2);
      const fileSizeInMB = (file.size / (1024 * 1024)).toFixed(2);
      const fileSizeDisplay = file.size > 1024 * 1024 
        ? `${fileSizeInMB} MB` 
        : `${fileSizeInKB} KB`;
      
      setImageMetadata({
        width: img.width,
        height: img.height,
        fileSize: fileSizeDisplay,
        fileSizeBytes: file.size
      });
    };
    img.onerror = () => {
      // If image fails to load, still show file size
      const fileSizeInKB = (file.size / 1024).toFixed(2);
      const fileSizeInMB = (file.size / (1024 * 1024)).toFixed(2);
      const fileSizeDisplay = file.size > 1024 * 1024 
        ? `${fileSizeInMB} MB` 
        : `${fileSizeInKB} KB`;
      
      setImageMetadata({
        width: null,
        height: null,
        fileSize: fileSizeDisplay,
        fileSizeBytes: file.size
      });
    };
    img.src = previewUrl;
  };

  const handleEditFormKeyDown = useCallback((event) => {
    if (event.key !== "Enter") return;
    if (event.defaultPrevented) return;
    const target = event.target;
    const isTextarea = target.tagName === "TEXTAREA";
    const isTextLikeInput =
      target.tagName === "INPUT" &&
      !["file", "hidden", "checkbox", "radio", "button", "submit", "reset", "image"].includes(
        target.type
      );
    const isComboboxTrigger =
      target.tagName === "BUTTON" && target.getAttribute("role") === "combobox";
    if (!isTextLikeInput && !isComboboxTrigger && !isTextarea) return;
    if (target.disabled || target.readOnly) return;
    if (target.closest("[cmdk-input-wrapper]")) return;

    event.preventDefault();
    focusNextFieldInForm(event.currentTarget, target);
  }, []);

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    if (!editingItem) {
      return;
    }

    const identifier = identifierForItem(editingItem);
    if (!identifier) {
      toast({
        title: "Unable to update item",
        description: "Item identifier is missing.",
        variant: "destructive"
      });
      return;
    }

    const payload = {};

    // Name
    const trimmedName = editForm.name.trim();
    if (trimmedName) {
      payload.name = trimmedName;
    }

    // SKU is auto-generated, don't send it in update

    // Description
    const trimmedDescription = editForm.description.trim();
    if (trimmedDescription !== undefined) {
      payload.description = trimmedDescription || null;
    }

    // Brand
    const trimmedBrand = editForm.brand.trim();
    if (trimmedBrand !== undefined) {
      payload.brand = trimmedBrand || null;
    }

    // Selling Price
    let sellingPriceValue = null;
    if (editForm.price !== undefined && editForm.price !== "") {
      const priceValue = Number(editForm.price);
      if (!Number.isNaN(priceValue)) {
        sellingPriceValue = priceValue;
        payload.sellingPrice = priceValue;
      }
    } else {
      // Use existing selling price from item if not being updated
      const existingPrice = editingItem.sellingPrice ?? editingItem.price;
      if (existingPrice !== undefined && existingPrice !== null) {
        sellingPriceValue = Number(existingPrice);
      }
    }

    // Cost Price
    if (editForm.costPrice !== undefined && editForm.costPrice !== "") {
      const costPriceValue = Number(editForm.costPrice);
      if (!Number.isNaN(costPriceValue)) {
        payload.costPrice = costPriceValue;
      }
    }

    // MRP
    let mrpValue = null;
    if (editForm.mrp !== undefined && editForm.mrp !== "") {
      const mrp = Number(editForm.mrp);
      if (!Number.isNaN(mrp)) {
        mrpValue = mrp;
        payload.mrp = mrp;
      }
    } else {
      // Use existing MRP from item if not being updated
      const existingMrp = editingItem.mrp;
      if (existingMrp !== undefined && existingMrp !== null) {
        mrpValue = Number(existingMrp);
      }
    }

    // Validate that selling price is less than or equal to MRP
    if (sellingPriceValue !== null && mrpValue !== null && !isNaN(sellingPriceValue) && !isNaN(mrpValue) && mrpValue > 0 && sellingPriceValue > mrpValue) {
      toast({
        title: "Validation Error",
        description: "Selling price must be less than or equal to MRP",
        variant: "destructive",
      });
      return;
    }

    // Unit
    const trimmedUnit = editForm.unit.trim();
    if (trimmedUnit !== undefined) {
      payload.unit = trimmedUnit || null;
    }

    // Category ID
    if (editForm.categoryId !== undefined && editForm.categoryId !== "") {
      payload.categoryId = editForm.categoryId;
    } else if (editForm.categoryId === "") {
      payload.categoryId = null;
    }

    // Subcategory ID
    if (editForm.subcategoryId !== undefined && editForm.subcategoryId !== "") {
      payload.subcategoryId = editForm.subcategoryId;
    } else if (editForm.subcategoryId === "") {
      payload.subcategoryId = null;
    }

    // Barcode
    const trimmedBarcode = editForm.barcode.trim();
    if (trimmedBarcode !== undefined) {
      payload.barcode = trimmedBarcode || null;
    }

    // HSN Code
    const trimmedHsnCode = editForm.hsnCode.trim();
    if (trimmedHsnCode !== undefined) {
      payload.hsnCode = trimmedHsnCode || null;
    }

    // GST Rate
    if (editForm.gstRate !== undefined && editForm.gstRate !== "") {
      const gstRateValue = Number(editForm.gstRate);
      if (!Number.isNaN(gstRateValue)) {
        payload.gstRate = gstRateValue;
      }
    }

    // Reorder Level
    if (editForm.reorderLevel !== undefined && editForm.reorderLevel !== "") {
      const reorderLevelValue = Number(editForm.reorderLevel);
      if (!Number.isNaN(reorderLevelValue)) {
        payload.reorderLevel = reorderLevelValue;
      }
    }

    let minStockValue =
      editingItem.minStock !== undefined && editingItem.minStock !== null
        ? Number(editingItem.minStock)
        : Number(editingItem.reorderLevel ?? 0);
    if (editForm.minStock !== undefined) {
      if (editForm.minStock === "") {
        payload.minStock = 0;
        minStockValue = 0;
      } else {
        const parsedMin = Number(editForm.minStock);
        if (!Number.isNaN(parsedMin)) {
          payload.minStock = parsedMin;
          minStockValue = parsedMin;
        }
      }
    }

    let maxStockValue =
      editingItem.maxStock !== undefined && editingItem.maxStock !== null
        ? Number(editingItem.maxStock)
        : 0;
    if (editForm.maxStock !== undefined) {
      if (editForm.maxStock === "") {
        payload.maxStock = 0;
        maxStockValue = 0;
      } else {
        const parsedMax = Number(editForm.maxStock);
        if (!Number.isNaN(parsedMax)) {
          payload.maxStock = parsedMax;
          maxStockValue = parsedMax;
        }
      }
    }

    if (
      Number.isFinite(minStockValue) &&
      Number.isFinite(maxStockValue) &&
      maxStockValue > 0 &&
      minStockValue > maxStockValue
    ) {
      toast({
        title: "Validation Error",
        description: "Minimum stock cannot exceed maximum stock",
        variant: "destructive",
      });
      return;
    }

    // Notes
    const trimmedNotes = editForm.notes.trim();
    if (trimmedNotes !== undefined) {
      payload.notes = trimmedNotes || null;
    }

    payload.bogoOffer = editForm.bogoOfferEnabled ? BOGO_OFFER_CARD_LABEL : null;

    // Is Active
    if (editForm.isActive !== undefined) {
      payload.isActive = editForm.isActive;
    }

    setSaving(true);
    try {
      const updateResponse = await itemsAPI.updateItem(identifier, payload);
      let updatedItem =
        updateResponse?.data?.item ??
        updateResponse?.item ??
        updateResponse?.data ??
        null;

      if (imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);
        const uploadResponse = await itemsAPI.uploadItemImage(identifier, formData);
        updatedItem = uploadResponse?.data?.item ?? uploadResponse?.item ?? updatedItem;
      }

      if (updatedItem) {
        setItems((prev) =>
          prev.map((item) =>
            identifierForItem(item) === identifier ? { ...item, ...updatedItem } : item
          )
        );
      }

      toast({
        title: "Item updated",
        description: "Changes saved successfully."
      });
      resetEditState();

      // Refresh items list to get updated data
      await fetchItemsPage({
        page: currentPage,
        search: debouncedSearchTerm,
        categoryId: categoryFilter,
        subcategoryId: subcategoryFilter
      });
    } catch (error) {
      console.error("Failed to update item:", error);
      const description =
        error.response?.data?.message ||
        error.message ||
        "Failed to update item.";
      toast({
        title: "Update failed",
        description,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const renderItemCard = (item) => {
    const imageUrl = item.imageUrl || item.image_url || null;
    const skuValue = item.sku || item.itemCode || "—";
    const sellingPrice = Number(item.price ?? item.sellingPrice ?? 0);
    const originalPrice = Number(item.mrp ?? item.costPrice ?? 0);
    const priceDifference = originalPrice > 0 ? originalPrice - sellingPrice : 0;
    const discountPercentage = originalPrice > 0 && sellingPrice < originalPrice
      ? ((priceDifference / originalPrice) * 100).toFixed(0)
      : 0;
    const stockStatus = evaluateStockStatus(item);
    const stockQuantity = normalizeStockNumber(item.stock ?? item.quantity ?? 0);
    const bogoLabel = (item.bogoOffer ?? item.bogo_offer ?? "").trim();
    // Ensure minStock and maxStock are properly parsed as numbers
    const minStockValue = normalizeStockNumber(
      typeof item.minStock === 'string' 
        ? parseFloat(item.minStock.split(' ')[0]) || item.reorderLevel || 0
        : (item.minStock ?? item.reorderLevel ?? 0)
    );
    const maxStockValue = normalizeStockNumber(
      typeof item.maxStock === 'string'
        ? parseFloat(item.maxStock.split(' ')[0]) || 0
        : (item.maxStock ?? 0)
    );

    return (
      <motion.div
        key={item.id || item._id}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        <Card
          className={cn(
            "h-full overflow-hidden flex flex-col border transition-colors duration-200",
            stockStatus.cardClass,
            stockStatus.backgroundClass
          )}
        >
          <div className="h-40 w-full bg-muted flex items-center justify-center">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={item.name}
                className="h-full w-full object-cover"
                loading="eager"
                decoding="async"
              />
            ) : (
              <span className="text-xs text-muted-foreground">No image uploaded</span>
            )}
          </div>
          <CardHeader className="flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold">
                  {item.name}
                </CardTitle>
                <p className="text-xs text-muted-foreground">SKU: {skuValue}</p>
                {bogoLabel ? (
                  <Badge
                    variant="secondary"
                    className="mt-1 inline-flex w-fit max-w-full items-center gap-1 whitespace-normal text-left font-medium bg-amber-100 text-amber-950 hover:bg-amber-100 border-amber-200/80"
                  >
                    <Tag className="h-3 w-3 shrink-0" />
                    {bogoLabel}
                  </Badge>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Badge className={cn("text-xs font-medium", stockStatus.badgeClass)}>
                  {stockStatus.label}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEditClick(item)}
                  title={hasEditRight("items") ? "Edit item" : "Edit permission required"}
                  disabled={!hasEditRight("items")}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {/* Price Information */}
            <div className="space-y-2">
              {originalPrice > 0 && originalPrice > sellingPrice && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">Original Price</span>
                  <span className="text-xs line-through text-muted-foreground">₹{originalPrice.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Selling Price</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg">₹{sellingPrice.toFixed(2)}</span>
                  {originalPrice > 0 && originalPrice > sellingPrice && discountPercentage > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {discountPercentage}% OFF
                    </Badge>
                  )}
                </div>
              </div>
              {originalPrice > 0 && priceDifference !== 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs">
                    {priceDifference > 0 ? "You Save" : "Markup"}
                  </span>
                  <span className={`text-xs font-medium ${priceDifference > 0 ? 'text-green-600' : 'text-orange-600'}`}>
                    {priceDifference > 0 ? '-' : '+'}₹{Math.abs(priceDifference).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Stock</span>
                <span className="font-medium">
                  {stockQuantity}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{stockStatus.description}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border bg-muted/40 p-2">
                  <p className="text-muted-foreground">Min Stock</p>
                  <p className="font-semibold">
                    {minStockValue > 0 ? minStockValue : "Not set"}
                  </p>
                </div>
                <div className="rounded-md border bg-muted/40 p-2">
                  <p className="text-muted-foreground">Max Stock</p>
                  <p className="font-semibold">
                    {maxStockValue > 0 ? maxStockValue : "Not set"}
                  </p>
                </div>
              </div>
            </div>
            {item.description && (
              <p className="text-muted-foreground text-xs line-clamp-2">
                {item.description}
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  const headerDescription = errorMessage
    ? errorMessage
    : "Browse inventory pulled directly from the API.";

  const handleCreateCategoryInItemForm = async () => {
    if (!newCategoryInItemForm.trim()) {
      toast({
        title: "Validation Error",
        description: "Category name is required",
        variant: "destructive",
      });
      return;
    }

    setSavingCategory(true);
    try {
      // Get store_id from selectedStore
      const storeId = selectedStore?._id || selectedStore?.id || selectedStore;
      const categoryData = {
        code: newCategoryInItemForm.trim().toUpperCase().replace(/\s+/g, '_'),
        name: newCategoryInItemForm.trim(),
        subcategories: []
      };

      // Include store_id if available
      if (storeId) {
        categoryData.store_id = storeId;
      }

      const response = await categoriesAPI.createCategory(categoryData);
      const newCategory = response.data;

      toast({
        title: "Success",
        description: "Category created successfully",
      });

      setNewCategoryInItemForm("");
      setShowCategoryCreation(false);

      // Refresh categories and set the newly created category
      const categoryParams = { limit: 1000 };
      if (storeId) {
        categoryParams.store_id = storeId;
      }
      const categoriesResponse = await categoriesAPI.getCategories(categoryParams);
      const fetchedCategories =
        categoriesResponse?.data?.categories ||
        categoriesResponse?.categories ||
        [];
      setCategories(fetchedCategories);

      const hierarchyParams = storeId ? { store_id: storeId } : {};
      const hierarchyResponse = await categoriesAPI.getCategoryHierarchy(hierarchyParams);
      const hierarchy =
        hierarchyResponse?.data?.categories ||
        hierarchyResponse?.data ||
        hierarchyResponse?.categories ||
        [];
      setCategoryHierarchy(Array.isArray(hierarchy) ? hierarchy : []);

      // Set the newly created category in the form
      setCreateItemForm(prev => ({
        ...prev,
        categoryId: newCategory._id || newCategory.id
      }));
    } catch (error) {
      console.error("Error creating category:", error);
      let errorMessage = "Failed to create category";

      if (error.message) {
        if (error.message.includes("Access denied") || error.message.includes("Missing required screen permissions")) {
          errorMessage = "You don't have permission to create categories. Please contact an administrator.";
        } else if (error.message.includes("Validation failed")) {
          errorMessage = "Please check your input and try again.";
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSavingCategory(false);
    }
  };

  const handleCreateBrandInItemForm = async () => {
    if (!newBrandInItemForm.trim()) {
      toast({
        title: "Validation Error",
        description: "Brand name is required",
        variant: "destructive",
      });
      return;
    }

    setSavingCategory(true);
    try {
      const storeId = selectedStore?._id || selectedStore?.id || selectedStore;
      const brandData = {
        name: newBrandInItemForm.trim(),
      };
      if (storeId) {
        brandData.store_id = storeId;
      }
      if (createItemForm.subcategoryId) {
        brandData.subcategory_id = createItemForm.subcategoryId;
      }

      const response = await brandsAPI.createBrand(brandData);
      const newBrand = response?.data || response;

      setBrands((prev) => [...prev, newBrand]);
      setCreateItemForm((prev) => ({
        ...prev,
        brandId: String(newBrand.id || newBrand.code),
        brand: ""
      }));
      setNewBrandInItemForm("");
      setShowBrandCreation(false);

      toast({
        title: "Success",
        description: "Brand created successfully",
      });
    } catch (error) {
      console.error("Error creating brand:", error);
      let errorMessage = "Failed to create brand. Please try again.";
      if (error.message) {
        if (error.message.includes("Access denied") || error.message.includes("Missing required screen permissions")) {
          errorMessage = "You don't have permission to create brands. Please contact an administrator.";
        } else if (error.message.includes("Validation failed")) {
          errorMessage = "Please check your input and try again.";
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSavingCategory(false);
    }
  };

  const handleCreateSubcategoryInItemForm = async () => {
    if (!newSubcategoryInItemForm.trim()) {
      toast({
        title: "Validation Error",
        description: "Subcategory name is required",
        variant: "destructive",
      });
      return;
    }

    if (!selectedCategoryForSubcategoryInItem) {
      toast({
        title: "Validation Error",
        description: "Please select a category first",
        variant: "destructive",
      });
      return;
    }

    setSavingCategory(true);
    try {
      // Get store_id from selectedStore
      const storeId = selectedStore?._id || selectedStore?.id || selectedStore;
      const categoryId = selectedCategoryForSubcategoryInItem._id || selectedCategoryForSubcategoryInItem.id || selectedCategoryForSubcategoryInItem.code;
      const subcategoryData = {
        code: newSubcategoryInItemForm.trim().toUpperCase().replace(/\s+/g, '_'),
        name: newSubcategoryInItemForm.trim(),
        parent_id: categoryId
      };

      // Include store_id if available
      if (storeId) {
        subcategoryData.store_id = storeId;
      }

      const response = await categoriesAPI.addSubcategory(
        categoryId,
        subcategoryData
      );

      toast({
        title: "Success",
        description: "Subcategory created successfully",
      });

      setNewSubcategoryInItemForm("");
      setShowSubcategoryCreation(false);
      setSelectedCategoryForSubcategoryInItem(null);

      // Refresh categories
      const categoryParams = { limit: 1000 };
      if (storeId) {
        categoryParams.store_id = storeId;
      }
      const categoriesResponse = await categoriesAPI.getCategories(categoryParams);
      const fetchedCategories =
        categoriesResponse?.data?.categories ||
        categoriesResponse?.categories ||
        [];
      setCategories(fetchedCategories);

      const hierarchyParams = storeId ? { store_id: storeId } : {};
      const hierarchyResponse = await categoriesAPI.getCategoryHierarchy(hierarchyParams);
      const hierarchy =
        hierarchyResponse?.data?.categories ||
        hierarchyResponse?.data ||
        hierarchyResponse?.categories ||
        [];
      setCategoryHierarchy(Array.isArray(hierarchy) ? hierarchy : []);

      // Refresh the selected category to get updated subcategories
      const updatedCategory = hierarchy.find(
        cat => (cat._id || cat.id) === (selectedCategoryForSubcategoryInItem._id || selectedCategoryForSubcategoryInItem.id)
      );
      if (updatedCategory && updatedCategory.subcategories) {
        const newSubcategory = updatedCategory.subcategories[updatedCategory.subcategories.length - 1];
        setCreateItemForm(prev => ({
          ...prev,
          categoryId: selectedCategoryForSubcategoryInItem._id || selectedCategoryForSubcategoryInItem.id,
          subcategoryId: newSubcategory._id || newSubcategory.id
        }));
      }
    } catch (error) {
      console.error("Error creating subcategory:", error);
      let errorMessage = "Failed to create subcategory";

      if (error.message) {
        if (error.message.includes("Access denied") || error.message.includes("Missing required screen permissions")) {
          errorMessage = "You don't have permission to create subcategories. Please contact an administrator.";
        } else if (error.message.includes("Validation failed")) {
          errorMessage = "Please check your input and try again.";
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSavingCategory(false);
    }
  };

  const handleCreateItem = async (event) => {
    event.preventDefault();

    if (!createItemForm.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Item name is required",
        variant: "destructive",
      });
      return;
    }

    if (!createItemForm.price || isNaN(Number(createItemForm.price)) || Number(createItemForm.price) <= 0) {
      toast({
        title: "Validation Error",
        description: "Valid price is required",
        variant: "destructive",
      });
      return;
    }

    // Validate that selling price is less than or equal to MRP
    const sellingPrice = Number(createItemForm.price);
    const mrp = createItemForm.mrp ? Number(createItemForm.mrp) : null;
    if (mrp !== null && !isNaN(mrp) && mrp > 0 && sellingPrice > mrp) {
      toast({
        title: "Validation Error",
        description: "Selling price must be less than or equal to MRP",
        variant: "destructive",
      });
      return;
    }

    const minStockValue = createItemForm.minStock ? Number(createItemForm.minStock) : 0;
    const maxStockValue = createItemForm.maxStock ? Number(createItemForm.maxStock) : 0;

    if (
      !Number.isNaN(minStockValue) &&
      !Number.isNaN(maxStockValue) &&
      maxStockValue > 0 &&
      minStockValue > maxStockValue
    ) {
      toast({
        title: "Validation Error",
        description: "Minimum stock cannot exceed maximum stock",
        variant: "destructive",
      });
      return;
    }

    setCreatingItem(true);
    try {
      // Get store_id from selectedStore
      const storeId = selectedStore?._id || selectedStore?.id || selectedStore;

      const itemData = {
        name: createItemForm.name.trim(),
        // SKU is auto-generated, don't send it in create
        // sku: createItemForm.sku.trim() || null,
        description: createItemForm.description.trim() || null,
        brandId: createItemForm.brandId || null,
        brand: createItemForm.brandId ? null : (createItemForm.brand.trim() || null),
        sellingPrice: Number(createItemForm.price) || 0,
        costPrice: createItemForm.costPrice ? Number(createItemForm.costPrice) : 0,
        mrp: createItemForm.mrp ? Number(createItemForm.mrp) : 0,
        unit: createItemForm.unit.trim() || null,
        categoryId: createItemForm.categoryId || null,
        subcategoryId: createItemForm.subcategoryId || null,
        barcode: createItemForm.barcode.trim() || null,
        hsnCode: createItemForm.hsnCode.trim() || null,
        gstRate: createItemForm.gstRate ? Number(createItemForm.gstRate) : 0,
        reorderLevel: createItemForm.reorderLevel ? Number(createItemForm.reorderLevel) : 0,
        minStock: Number.isFinite(minStockValue) ? minStockValue : 0,
        maxStock: Number.isFinite(maxStockValue) ? maxStockValue : 0,
        notes: createItemForm.notes.trim() || null,
        bogoOffer: createItemForm.bogoOfferEnabled ? BOGO_OFFER_CARD_LABEL : null,
        isActive: createItemForm.isActive
      };

      // Include store_id if available
      if (storeId) {
        itemData.store_id = storeId;
      }

      await itemsAPI.createItem(itemData);

      toast({
        title: "Success",
        description: "Item created successfully",
      });

      // Reset form
      setCreateItemForm({
        name: "",
        sku: "",
        description: "",
        brand: "",
    brandId: "",
        price: "",
        costPrice: "",
        mrp: "",
        unit: "",
        categoryId: "",
        subcategoryId: "",
        barcode: "",
        hsnCode: "",
        gstRate: "",
        reorderLevel: "",
        minStock: "",
        maxStock: "",
        notes: "",
        bogoOfferEnabled: false,
        isActive: true
      });
      setShowCategoryCreation(false);
      setShowSubcategoryCreation(false);
      setNewCategoryInItemForm("");
      setNewSubcategoryInItemForm("");
      setSelectedCategoryForSubcategoryInItem(null);
      setIsCreateItemOpen(false);

      // Refresh items list
      await fetchItemsPage({
        page: 1,
        search: "",
        categoryId: categoryFilter,
        subcategoryId: subcategoryFilter
      });
    } catch (error) {
      console.error("Error creating item:", error);
      const errorMessage = error.response?.data?.message || error.message || "Failed to create item";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setCreatingItem(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold">PRODUCTS</h1>
            {totalCount !== null && (
              <Badge variant="secondary" className="text-sm font-semibold px-3 py-1">
                {totalCount.toLocaleString()} {totalCount === 1 ? 'product' : 'products'}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm md:text-base">
            {headerDescription}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate("/categories")}
            >
              Categories
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate("/subcategories")}
            >
              Subcategories
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate("/brands")}
            >
              <Tag className="h-3.5 w-3.5 mr-1.5" aria-hidden />
              Brands
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or SKU…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Popover open={categoryDropdownOpen} onOpenChange={setCategoryDropdownOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={categoryDropdownOpen}
                    className="w-[220px] justify-between"
                  >
                    {selectedCategory === "all"
                      ? "Select category..."
                      : categoryHierarchy.find(
                        (cat) => (cat.id ?? cat._id) === selectedCategory
                      )?.name || "Select category..."}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-0" align="start">
                  <Command shouldFilter={true}>
                    <CommandInput
                      placeholder="Search category..."
                      value={categorySearchTerm}
                      onValueChange={setCategorySearchTerm}
                    />
                    <CommandList>
                      <CommandEmpty>No category found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all All Categories"
                          onSelect={() => {
                            setSelectedCategory("all");
                            setSelectedSubcategory("all");
                            setCategoryDropdownOpen(false);
                            setCategorySearchTerm("");
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedCategory === "all" ? "opacity-100" : "opacity-0"
                            )}
                          />
                          All Categories
                        </CommandItem>
                        {categoryHierarchy.map((category) => {
                          const categoryId = category.id ?? category._id;
                          const isSelected = selectedCategory === categoryId;
                          // Include both name and code in the value for better search
                          const searchValue = `${category.name} ${category.code || ""}`.trim();
                          return (
                            <CommandItem
                              key={`category-${categoryId}`}
                              value={searchValue}
                              onSelect={() => {
                                setSelectedCategory(categoryId);
                                setSelectedSubcategory("all");
                                setCategoryDropdownOpen(false);
                                setCategorySearchTerm("");
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  isSelected ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {category.name}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            {selectedCategory !== "all" && (() => {
              const selectedCat = categoryHierarchy.find(
                (cat) => (cat.id ?? cat._id) === selectedCategory
              );
              const subcategories = selectedCat?.subcategories || [];

              if (subcategories.length === 0) return null;

              return (
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={selectedSubcategory === "all" ? "all" : selectedSubcategory}
                    onValueChange={(value) => setSelectedSubcategory(value)}
                  >
                    <SelectTrigger className="w-[220px] justify-between">
                      <SelectValue placeholder="Select subcategory..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        All Subcategories
                      </SelectItem>
                      {subcategories.map((subcategory, subIndex) => {
                        // Use subcategory code for filtering (the actual value in database)
                        const subcategoryValue = subcategory.code ?? subcategory.id;
                        const subcategoryName = subcategory.name || `Subcategory ${subcategoryValue}`;

                        return (
                          <SelectItem
                            key={`subcategory-${subcategory.id ?? subIndex}`}
                            value={subcategoryValue}
                          >
                            {subcategoryName}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              );
            })()}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={stockStatusFilter} onValueChange={setStockStatusFilter}>
                <SelectTrigger className="w-[220px] justify-between">
                  <SelectValue placeholder="Stock status" />
                </SelectTrigger>
                <SelectContent>
                  {STOCK_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={() => setIsCreateItemOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Item
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Loading items…</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-20 text-center space-y-3">
          <Package className="h-12 w-12 mx-auto text-muted-foreground" />
          <h3 className="text-lg font-semibold">{EMPTY_STATE.title}</h3>
          <p className="text-muted-foreground text-sm">
            {EMPTY_STATE.description}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredItems.map((item) => renderItemCard(item))}
          </div>
          {pageNumbers.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 py-6">
              {/* Previous page button */}
              {currentPage > 1 && (
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={loading}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}

              {/* Page number buttons */}
              {pageNumbers.map((pageNumber, index) => (
                <Button
                  key={`page-${pageNumber}-${index}`}
                  variant={pageNumber === currentPage ? "default" : "outline"}
                  onClick={() => handlePageChange(pageNumber)}
                  disabled={loading && pageNumber === currentPage}
                  aria-current={pageNumber === currentPage ? "page" : undefined}
                >
                  {pageNumber}
                </Button>
              ))}

              {/* Next page button */}
              {currentPage < totalPages && (
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={loading}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </>
      )}

      <Dialog open={isEditOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Item Details</DialogTitle>
            <DialogDescription>
              Update the information for the selected inventory item. Changes are saved when you click save.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} onKeyDown={handleEditFormKeyDown} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-item-name">Item Name *</Label>
                  <Input
                    id="edit-item-name"
                    value={editForm.name}
                    onChange={handleFormChange('name')}
                    placeholder="Enter item name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-item-sku">SKU (Auto-generated)</Label>
                  <Input
                    id="edit-item-sku"
                    value={editForm.sku}
                    placeholder="Auto-generated"
                    disabled
                    readOnly
                    className="bg-muted cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-item-unit">Unit</Label>
                  <Input
                    id="edit-item-unit"
                    value={editForm.unit}
                    onChange={handleFormChange('unit')}
                    placeholder="e.g., kg, pieces, etc."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-item-description">Description</Label>
                <Textarea
                  id="edit-item-description"
                  value={editForm.description}
                  onChange={handleFormChange('description')}
                  placeholder="Enter item description"
                  rows={3}
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Pricing</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-item-price">Selling Price (₹) *</Label>
                  <Input
                    id="edit-item-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.price}
                    onChange={handleFormChange('price')}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-item-cost">Cost Price (₹)</Label>
                  <Input
                    id="edit-item-cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.costPrice}
                    onChange={handleFormChange('costPrice')}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-item-mrp">MRP (₹)</Label>
                  <Input
                    id="edit-item-mrp"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.mrp}
                    onChange={handleFormChange('mrp')}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Promotions */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Offers</h3>
              <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-4">
                <Checkbox
                  id="edit-item-bogo"
                  checked={editForm.bogoOfferEnabled}
                  onCheckedChange={(checked) =>
                    setEditForm((prev) => ({
                      ...prev,
                      bogoOfferEnabled: checked === true
                    }))
                  }
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="edit-item-bogo"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Buy one get one offer
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    When ticked, “{BOGO_OFFER_CARD_LABEL}” appears on the product card.
                  </p>
                </div>
              </div>
            </div>

            {/* Category (subcategory stays on the item for APIs/brands; change it from Subcategories master if needed) */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Category</h3>
              <div className="space-y-2">
                <Label htmlFor="edit-item-category">Category</Label>
                <Popover open={editCategoryPopoverOpen} onOpenChange={setEditCategoryPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={editCategoryPopoverOpen}
                      className="w-full justify-between"
                    >
                      {getCategoryLabel(editForm.categoryId) ?? "Select category..."}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Search category..."
                        value={editCategorySearchTerm}
                        onValueChange={setEditCategorySearchTerm}
                      />
                      <CommandList>
                        <CommandEmpty>No category found.</CommandEmpty>
                        <CommandGroup>
                          {categoryHierarchy.map((category) => {
                            const categoryId = String(category._id ?? category.id);
                            const isSelected = String(editForm.categoryId || "") === categoryId;
                            const searchValue = `${category.name} ${category.code || ""}`.trim();
                            return (
                              <CommandItem
                                key={`edit-category-${categoryId}`}
                                value={searchValue}
                                onSelect={() => {
                                  const subcats = category.subcategories || [];
                                  setEditForm((prev) => {
                                    const stillValid = subcats.some(
                                      (s) => String(s._id ?? s.id) === String(prev.subcategoryId)
                                    );
                                    const nextSub = stillValid
                                      ? prev.subcategoryId
                                      : subcats[0]
                                        ? String(subcats[0]._id ?? subcats[0].id)
                                        : "";
                                    return {
                                      ...prev,
                                      categoryId,
                                      subcategoryId: nextSub,
                                    };
                                  });
                                  setEditCategoryPopoverOpen(false);
                                  setEditCategorySearchTerm("");
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    isSelected ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {category.name}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Brand Selection - Only show after subcategory is selected */}
              {editForm.subcategoryId && (
                <div className="space-y-2">
                  <Label htmlFor="edit-item-brand">Brand</Label>
                  <Popover open={editBrandPopoverOpen} onOpenChange={setEditBrandPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="edit-item-brand"
                        variant="outline"
                        role="combobox"
                        aria-expanded={editBrandPopoverOpen}
                        className="w-full justify-between"
                      >
                        {brands.find(b => (b.id || b.code) === editForm.brandId)?.name || "Select brand..."}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Search brand name or code..."
                          value={editBrandSearchTerm}
                          onValueChange={setEditBrandSearchTerm}
                        />
                        <CommandList>
                          <CommandEmpty>No brand found.</CommandEmpty>
                          <CommandGroup>
                            {brands
                              .filter((brand) => {
                                if (!editBrandSearchTerm) return true;
                                const searchLower = editBrandSearchTerm.toLowerCase();
                                const nameMatch = brand.name?.toLowerCase().includes(searchLower);
                                const codeMatch = brand.code?.toLowerCase().includes(searchLower) || brand.id?.toLowerCase().includes(searchLower);
                                return nameMatch || codeMatch;
                              })
                              .map((brand) => {
                                const brandId = String(brand.id || brand.code);
                                const isSelected = String(editForm.brandId || "") === brandId;
                                const searchValue = `${brand.name} ${brand.code || brand.id || ""}`.trim();
                                return (
                                  <CommandItem
                                    key={`edit-brand-${brandId}`}
                                    value={searchValue}
                                    onSelect={() => {
                                      setEditForm((prev) => ({
                                        ...prev,
                                        brandId: brandId,
                                        brand: ""
                                      }));
                                      setEditBrandPopoverOpen(false);
                                      setEditBrandSearchTerm("");
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        isSelected ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {brand.name}
                                  </CommandItem>
                                );
                              })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            {/* Additional Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Additional Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-item-barcode">Barcode</Label>
                  <Input
                    id="edit-item-barcode"
                    value={editForm.barcode}
                    onChange={handleFormChange('barcode')}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasted = (e.clipboardData?.getData?.('text') || '').trim();
                      if (pasted) setEditForm((prev) => ({ ...prev, barcode: pasted }));
                    }}
                    placeholder="Enter barcode"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-item-hsn">HSN Code</Label>
                  <Input
                    id="edit-item-hsn"
                    value={editForm.hsnCode}
                    onChange={handleFormChange('hsnCode')}
                    placeholder="Enter HSN code"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-item-gst">GST Rate (%)</Label>
                  <Input
                    id="edit-item-gst"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={editForm.gstRate}
                    onChange={handleFormChange('gstRate')}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-item-reorder">Reorder Level</Label>
                  <Input
                    id="edit-item-reorder"
                    type="number"
                    min="0"
                    value={editForm.reorderLevel}
                    onChange={handleFormChange('reorderLevel')}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-item-min-stock">Minimum Stock</Label>
                  <Input
                    id="edit-item-min-stock"
                    type="number"
                    min="0"
                    value={editForm.minStock}
                    onChange={handleFormChange('minStock')}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-item-max-stock">Maximum Stock</Label>
                  <Input
                    id="edit-item-max-stock"
                    type="number"
                    min="0"
                    value={editForm.maxStock}
                    onChange={handleFormChange('maxStock')}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-item-notes">Notes</Label>
                <Textarea
                  id="edit-item-notes"
                  value={editForm.notes}
                  onChange={handleFormChange('notes')}
                  placeholder="Enter any additional notes"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-item-image">Image</Label>
                <Input
                  id="edit-item-image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                />
                {imagePreview && (
                  <div className="mt-2 space-y-2">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="h-28 w-28 rounded-md object-cover border"
                    />
                    {imageMetadata && (
                      <div className="text-xs text-muted-foreground space-y-1">
                        {imageMetadata.width && imageMetadata.height && (
                          <div className="font-medium">
                            Resolution: {imageMetadata.width} × {imageMetadata.height} px
                          </div>
                        )}
                        <div className="font-medium">
                          File Size: {imageMetadata.fileSize}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-item-active"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="edit-item-active" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                  Item is Active
                </Label>
              </div>
            </div>

            {/* Batches with Barcodes Section */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center gap-2">
                <Barcode className="h-5 w-5 text-blue-600" />
                <Label className="text-lg font-semibold">Batches & Barcodes</Label>
              </div>
              {loadingBatches ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading batches...</span>
                </div>
              ) : itemBatches.length > 0 ? (
                <div className="space-y-4">
                  {/* Batch Dropdown */}
                  <div className="space-y-2">
                    <Label htmlFor="batch-select">Select Batch</Label>
                    <Select
                      value={selectedBatchIndex !== null ? String(selectedBatchIndex) : ""}
                      onValueChange={handleBatchSelect}
                    >
                      <SelectTrigger id="batch-select" className="w-full">
                        <SelectValue placeholder="Select a batch to view barcodes" />
                      </SelectTrigger>
                      <SelectContent>
                        {itemBatches.map((batch, index) => {
                          const batchDisplay = batch.batchNumber || 'N/A';
                          const poNumber = batch.purchaseOrderNumber ? ` (PO: ${batch.purchaseOrderNumber})` : '';
                          const qty = batch.batchQuantity ? ` - Qty: ${batch.batchQuantity}` : '';
                          const expiry = batch.expiryDate ? ` - Exp: ${new Date(batch.expiryDate).toLocaleDateString()}` : '';
                          const cost = batch.costPrice ? ` - ₹${batch.costPrice.toFixed(2)}` : '';
                          return (
                            <SelectItem key={index} value={String(index)}>
                              Batch: {batchDisplay}{poNumber}{qty}{cost}{expiry}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Barcodes Display - Same as PO screen */}
                  {selectedBatchIndex !== null && selectedBatchIndex >= 0 && selectedBatchIndex < itemBatches.length && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-medium">
                          Barcodes
                          {(() => {
                            const selectedBatch = itemBatches[selectedBatchIndex];
                            if (selectedBatch.barcodesLoaded && selectedBatch.barcodes && selectedBatch.barcodes.length > 0) {
                              return (
                                <span className="ml-2 text-sm font-normal text-muted-foreground">
                                  ({selectedBatch.barcodes.length} barcode{selectedBatch.barcodes.length !== 1 ? 's' : ''})
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </Label>
                        <div className="flex items-center gap-2">
                          {loadingBarcodes && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Loading barcodes...</span>
                            </div>
                          )}
                          {(() => {
                            const selectedBatch = itemBatches[selectedBatchIndex];
                            if (selectedBatch.barcodesLoaded && selectedBatch.barcodes && selectedBatch.barcodes.length > 0) {
                              return (
                                <Button
                                  onClick={handlePrintBarcodes}
                                  variant="outline"
                                  size="sm"
                                  className="flex items-center gap-2"
                                >
                                  <Printer className="h-4 w-4" />
                                  <span>Print Labels</span>
                                </Button>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                      {loadingBarcodes ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          <span className="ml-2 text-sm text-muted-foreground">Loading barcodes...</span>
                        </div>
                      ) : (() => {
                        const selectedBatch = itemBatches[selectedBatchIndex];
                        if (selectedBatch.barcodesLoaded && selectedBatch.barcodes && selectedBatch.barcodes.length > 0) {
                          return (
                            <div className="space-y-3">
                              {/* Print styles - same as PO screen */}
                              <style>{`
                                @media print {
                                  @page {
                                    size: 4in 2.5in;
                                    margin: 0 0.25mm 0.15mm 0.25mm;
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
                              <div className="flex flex-col gap-4 items-center print:block print:gap-0">
                                {selectedBatch.barcodes.map((barcodeItem, barcodeIndex) => {
                                  // Use individual item data from barcodeItem if available, otherwise use batch data
                                  const itemName = barcodeItem.itemName || barcodeItem.name || selectedBatch.itemName || editingItem?.name;
                                  const sku = barcodeItem.itemSku || barcodeItem.sku || selectedBatch.sku || editingItem?.sku || editingItem?.itemCode;
                                  const expiryDate = barcodeItem.expiryDate || selectedBatch.expiryDate;
                                  const amount = barcodeItem.amount || barcodeItem.costPrice || selectedBatch.costPrice;
                                  const batchNumber = barcodeItem.batchNumber || selectedBatch.batchNumber;
                                  
                                  return (
                                    <div
                                      key={barcodeIndex}
                                      className="barcode-label-container border rounded p-2 print:border-0 print:p-0"
                                    >
                                      <BarcodeLabel
                                        sku={sku}
                                        barcode={barcodeItem.barcode || barcodeItem}
                                        storeName={selectedStore?.name}
                                        itemName={itemName}
                                        expiryDate={expiryDate}
                                        amount={amount}
                                        batchNumber={batchNumber}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        } else if (selectedBatch.barcodesLoaded) {
                          return (
                            <div className="text-center py-8 text-sm text-muted-foreground border rounded-md">
                              <Barcode className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p>No barcodes found for this batch</p>
                              {selectedBatch.sku && (
                                <p className="text-xs mt-1">SKU: {selectedBatch.sku}</p>
                              )}
                            </div>
                          );
                        } else {
                          return (
                            <div className="text-center py-8 text-sm text-muted-foreground border rounded-md">
                              <p>Select a batch to load barcodes</p>
                            </div>
                          );
                        }
                      })()}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <Barcode className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No batches found for this item</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </span>
                ) : (
                  'Save changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Item Dialog */}
      <Dialog open={isCreateItemOpen} onOpenChange={setIsCreateItemOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Item</DialogTitle>
            <DialogDescription>
              Enter item details below. You can create categories and subcategories if needed.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateItem} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="create-item-name">Item Name *</Label>
                  <Input
                    id="create-item-name"
                    value={createItemForm.name}
                    onChange={(e) => setCreateItemForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter item name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-item-unit">Unit</Label>
                  <Input
                    id="create-item-unit"
                    value={createItemForm.unit}
                    onChange={(e) => setCreateItemForm(prev => ({ ...prev, unit: e.target.value }))}
                    placeholder="e.g., kg, pieces, etc."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-item-description">Description</Label>
                <Textarea
                  id="create-item-description"
                  value={createItemForm.description}
                  onChange={(e) => setCreateItemForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter item description"
                  rows={3}
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Pricing</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="create-item-price">Selling Price (₹) *</Label>
                  <Input
                    id="create-item-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={createItemForm.price}
                    onChange={(e) => setCreateItemForm(prev => ({ ...prev, price: e.target.value }))}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-item-cost">Cost Price (₹)</Label>
                  <Input
                    id="create-item-cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={createItemForm.costPrice}
                    onChange={(e) => setCreateItemForm(prev => ({ ...prev, costPrice: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-item-mrp">MRP (₹)</Label>
                  <Input
                    id="create-item-mrp"
                    type="number"
                    step="0.01"
                    min="0"
                    value={createItemForm.mrp}
                    onChange={(e) => setCreateItemForm(prev => ({ ...prev, mrp: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Category and Subcategory */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Category & Subcategory</h3>

              {/* Category Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="create-item-category">Category</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowCategoryCreation(!showCategoryCreation);
                      setShowSubcategoryCreation(false);
                    }}
                    className="text-xs"
                  >
                    {showCategoryCreation ? "Cancel" : "+ Create Category"}
                  </Button>
                </div>

                {!showCategoryCreation ? (
                  <Popover open={createCategoryPopoverOpen} onOpenChange={setCreateCategoryPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="create-item-category"
                        variant="outline"
                        role="combobox"
                        aria-expanded={createCategoryPopoverOpen}
                        className="w-full justify-between"
                      >
                        {getCategoryLabel(createItemForm.categoryId) ?? "Select category..."}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Search category..."
                          value={createCategorySearchTerm}
                          onValueChange={setCreateCategorySearchTerm}
                        />
                        <CommandList>
                          <CommandEmpty>No category found.</CommandEmpty>
                          <CommandGroup>
                            {categoryHierarchy.map((category) => {
                              const categoryId = String(category._id ?? category.id);
                              const isSelected = String(createItemForm.categoryId || "") === categoryId;
                              const searchValue = `${category.name} ${category.code || ""}`.trim();
                              return (
                                <CommandItem
                                  key={`create-category-${categoryId}`}
                                  value={searchValue}
                                  onSelect={() => {
                                    const selectedCat = categoryHierarchy.find(
                                      (cat) => String(cat._id ?? cat.id) === categoryId
                                    );
                                    setCreateItemForm((prev) => ({
                                      ...prev,
                                      categoryId,
                                      subcategoryId: ""
                                    }));
                                    setSelectedCategoryForSubcategoryInItem(selectedCat || null);
                                    setCreateCategoryPopoverOpen(false);
                                    setCreateCategorySearchTerm("");
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      isSelected ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {category.name}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <div className="space-y-2 p-4 border rounded-lg bg-muted/50">
                    <Label>Create New Category</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter category name..."
                        value={newCategoryInItemForm}
                        onChange={(e) => setNewCategoryInItemForm(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCreateCategoryInItemForm();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        onClick={handleCreateCategoryInItemForm}
                        disabled={savingCategory || !newCategoryInItemForm.trim()}
                      >
                        {savingCategory ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-2" />
                            Create
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Subcategory Selection */}
              {createItemForm.categoryId && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="create-item-subcategory">Subcategory</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowSubcategoryCreation(!showSubcategoryCreation);
                        setShowCategoryCreation(false);
                      }}
                      className="text-xs"
                    >
                      {showSubcategoryCreation ? "Cancel" : "+ Create Subcategory"}
                    </Button>
                  </div>

                  {!showSubcategoryCreation ? (
                    <Select
                      value={createItemForm.subcategoryId || ""}
                      onValueChange={(value) => setCreateItemForm(prev => ({ ...prev, subcategoryId: value }))}
                    >
                      <SelectTrigger id="create-item-subcategory">
                        <SelectValue placeholder="Select subcategory..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          const selectedCat = categoryHierarchy.find(
                            cat => (cat._id || cat.id) === createItemForm.categoryId
                          );
                          const subcategories = selectedCat?.subcategories || [];
                          return subcategories.map((subcategory) => (
                            <SelectItem key={subcategory._id || subcategory.id} value={subcategory._id || subcategory.id}>
                              {subcategory.name}
                            </SelectItem>
                          ));
                        })()}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="space-y-2 p-4 border rounded-lg bg-muted/50">
                      <Label>Create New Subcategory</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter subcategory name..."
                          value={newSubcategoryInItemForm}
                          onChange={(e) => setNewSubcategoryInItemForm(e.target.value)}
                          disabled={!createItemForm.categoryId}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && createItemForm.categoryId) {
                              e.preventDefault();
                              handleCreateSubcategoryInItemForm();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          onClick={handleCreateSubcategoryInItemForm}
                          disabled={savingCategory || !newSubcategoryInItemForm.trim() || !createItemForm.categoryId}
                        >
                          {savingCategory ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-2" />
                              Create
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Brand Selection - Only show after subcategory is selected */}
              {createItemForm.subcategoryId && (
                <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="create-item-brand">Brand</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowBrandCreation(!showBrandCreation);
                      setShowCategoryCreation(false);
                      setShowSubcategoryCreation(false);
                    }}
                    className="text-xs"
                  >
                    {showBrandCreation ? "Cancel" : "+ Create Brand"}
                  </Button>
                </div>

                {!showBrandCreation ? (
                  <Popover open={createBrandPopoverOpen} onOpenChange={setCreateBrandPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="create-item-brand"
                        variant="outline"
                        role="combobox"
                        aria-expanded={createBrandPopoverOpen}
                        className="w-full justify-between"
                      >
                        {brands.find(b => (b.id || b.code) === createItemForm.brandId)?.name || "Select brand..."}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Search brand name or code..."
                          value={createBrandSearchTerm}
                          onValueChange={setCreateBrandSearchTerm}
                        />
                        <CommandList>
                          <CommandEmpty>No brand found.</CommandEmpty>
                          <CommandGroup>
                            {brands
                              .filter((brand) => {
                                if (!createBrandSearchTerm) return true;
                                const searchLower = createBrandSearchTerm.toLowerCase();
                                const nameMatch = brand.name?.toLowerCase().includes(searchLower);
                                const codeMatch = brand.code?.toLowerCase().includes(searchLower) || brand.id?.toLowerCase().includes(searchLower);
                                return nameMatch || codeMatch;
                              })
                              .map((brand) => {
                                const brandId = String(brand.id || brand.code);
                                const isSelected = String(createItemForm.brandId || "") === brandId;
                                const searchValue = `${brand.name} ${brand.code || brand.id || ""}`.trim();
                                return (
                                  <CommandItem
                                    key={`create-brand-${brandId}`}
                                    value={searchValue}
                                    onSelect={() => {
                                      setCreateItemForm((prev) => ({
                                        ...prev,
                                        brandId: brandId,
                                        brand: ""
                                      }));
                                      setCreateBrandPopoverOpen(false);
                                      setCreateBrandSearchTerm("");
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        isSelected ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {brand.name}
                                  </CommandItem>
                                );
                              })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <div className="space-y-2 p-4 border rounded-lg bg-muted/50">
                    <Label>Create New Brand</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter brand name..."
                        value={newBrandInItemForm}
                        onChange={(e) => setNewBrandInItemForm(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCreateBrandInItemForm();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        onClick={handleCreateBrandInItemForm}
                        disabled={savingCategory || !newBrandInItemForm.trim()}
                      >
                        {savingCategory ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-2" />
                            Create
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                </div>
              )}
            </div>

            {/* Additional Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Additional Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="create-item-barcode">Barcode</Label>
                  <Input
                    id="create-item-barcode"
                    value={createItemForm.barcode}
                    onChange={(e) => setCreateItemForm(prev => ({ ...prev, barcode: e.target.value }))}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasted = (e.clipboardData?.getData?.('text') || '').trim();
                      if (pasted) setCreateItemForm((prev) => ({ ...prev, barcode: pasted }));
                    }}
                    placeholder="Enter barcode"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-item-hsn">HSN Code</Label>
                  <Input
                    id="create-item-hsn"
                    value={createItemForm.hsnCode}
                    onChange={(e) => setCreateItemForm(prev => ({ ...prev, hsnCode: e.target.value }))}
                    placeholder="Enter HSN code"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-item-gst">GST Rate (%)</Label>
                  <Input
                    id="create-item-gst"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={createItemForm.gstRate}
                    onChange={(e) => setCreateItemForm(prev => ({ ...prev, gstRate: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-item-reorder">Reorder Level</Label>
                  <Input
                    id="create-item-reorder"
                    type="number"
                    min="0"
                    value={createItemForm.reorderLevel}
                    onChange={(e) => setCreateItemForm(prev => ({ ...prev, reorderLevel: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-item-min-stock">Minimum Stock</Label>
                  <Input
                    id="create-item-min-stock"
                    type="number"
                    min="0"
                    value={createItemForm.minStock}
                    onChange={(e) => setCreateItemForm(prev => ({ ...prev, minStock: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-item-max-stock">Maximum Stock</Label>
                  <Input
                    id="create-item-max-stock"
                    type="number"
                    min="0"
                    value={createItemForm.maxStock}
                    onChange={(e) => setCreateItemForm(prev => ({ ...prev, maxStock: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-4">
                <Checkbox
                  id="create-item-bogo"
                  checked={createItemForm.bogoOfferEnabled}
                  onCheckedChange={(checked) =>
                    setCreateItemForm((prev) => ({
                      ...prev,
                      bogoOfferEnabled: checked === true
                    }))
                  }
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="create-item-bogo"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Buy one get one offer
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    When ticked, “{BOGO_OFFER_CARD_LABEL}” shows on the product card.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-item-notes">Notes</Label>
                <Textarea
                  id="create-item-notes"
                  value={createItemForm.notes}
                  onChange={(e) => setCreateItemForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Enter any additional notes"
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateItemOpen(false);
                  setShowCategoryCreation(false);
                  setShowSubcategoryCreation(false);
                }}
                disabled={creatingItem}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creatingItem}>
                {creatingItem ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Item
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}

