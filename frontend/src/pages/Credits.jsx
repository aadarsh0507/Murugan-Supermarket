import { useState, useEffect } from "react";
import { CreditCard, Search, Edit, FileText, Plus, Save, Printer, EyeOff } from "lucide-react";
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
import { creditsAPI, suppliersAPI, customerCreditsAPI, purchaseOrdersAPI, billsAPI, itemsAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage, getErrorTitle } from "@/utils/errorMessages";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "upi", label: "UPI" },
  { value: "credit", label: "Credit" },
  { value: "online", label: "Online" },
  { value: "other", label: "Other" },
];

/** PO / billing credit payment rows — newest first */
const getSortedPaymentHistory = (credit) => {
  const list = Array.isArray(credit?.paymentHistory) ? [...credit.paymentHistory] : [];
  list.sort(
    (a, b) =>
      new Date(b.paymentDate || b.createdAt || 0) - new Date(a.paymentDate || a.createdAt || 0)
  );
  return list;
};

const Credits = () => {
  const { toast } = useToast();
  const { selectedStore } = useAuth();
  const SUPPLIER_FETCH_LIMIT = 1000;
  const [credits, setCredits] = useState([]);
  const [customerCredits, setCustomerCredits] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [suppliersLoadedStoreId, setSuppliersLoadedStoreId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [creditTypeFilter, setCreditTypeFilter] = useState("po"); // "po" or "billing"
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editAmountDialogOpen, setEditAmountDialogOpen] = useState(false);
  const [changesDialogOpen, setChangesDialogOpen] = useState(false);
  const [printingCreditId, setPrintingCreditId] = useState(null);
  const [selectedCredit, setSelectedCredit] = useState(null);
  const [selectedCreditForChanges, setSelectedCreditForChanges] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailBill, setDetailBill] = useState(null);
  const [detailItems, setDetailItems] = useState([]);
  const [detailNotes, setDetailNotes] = useState("");
  const [sgstRateGlobal, setSgstRateGlobal] = useState(0);
  const [cgstRateGlobal, setCgstRateGlobal] = useState(0);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [selectedCredits, setSelectedCredits] = useState([]);
  const [newOriginalAmount, setNewOriginalAmount] = useState("");
  const [amountChangeNotes, setAmountChangeNotes] = useState("");
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 20
  });

  useEffect(() => {
    const storeId = selectedStore?._id || selectedStore?.id;
    if (storeId) {
      loadSuppliers().then(() => {
        // After suppliers are loaded, load credits
        setPagination(prev => ({ ...prev, currentPage: 1 }));
        if (creditTypeFilter === "po") {
          loadCredits();
        } else {
          loadCustomerCredits();
        }
      });
    } else {
      // Clear data when no store is selected
      setCredits([]);
      setCustomerCredits([]);
      setSuppliers([]);
      setSuppliersLoadedStoreId(null);
    }
    // Clear selected credits when filters change
    setSelectedCredits([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStore, searchTerm, statusFilter, supplierFilter, creditTypeFilter]);

  useEffect(() => {
    const storeId = selectedStore?._id || selectedStore?.id;
    if (storeId) {
      if (creditTypeFilter === "po") {
        loadCredits();
      } else {
        loadCustomerCredits();
      }
    } else {
      // Clear data when no store is selected
      setCredits([]);
      setCustomerCredits([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.currentPage]);

  const loadSuppliers = async (force = false) => {
    const storeId = selectedStore?._id || selectedStore?.id;
    if (!storeId) {
      setSuppliers([]);
      setSuppliersLoadedStoreId(null);
      return [];
    }

    if (!force && suppliersLoadedStoreId === storeId && suppliers.length > 0) {
      return suppliers;
    }

    try {
      const response = await suppliersAPI.getSuppliers({ limit: SUPPLIER_FETCH_LIMIT });
      const suppliersData = response.data?.suppliers || response.data || [];
      const sanitizedSuppliers = Array.isArray(suppliersData)
        ? suppliersData
          .map((supplier) => {
            if (!supplier) return null;
            const rawId = supplier._id ?? supplier.id ?? supplier.Suppliercode ?? supplier.SupplierId;
            const rawName = supplier.companyName ?? supplier.Suppliername ?? supplier.name ?? supplier.SupplierName;
            const normalizedId = typeof rawId === "string" || typeof rawId === "number"
              ? String(rawId).trim()
              : "";
            const normalizedName = typeof rawName === "string"
              ? rawName.trim()
              : "";

            if (!normalizedId || !normalizedName) {
              return null;
            }

            return {
              ...supplier,
              _id: normalizedId,
              companyName: normalizedName
            };
          })
          .filter(Boolean)
        : [];

      setSuppliers(sanitizedSuppliers);
      setSuppliersLoadedStoreId(selectedStore._id);
      return sanitizedSuppliers;
    } catch (error) {
      console.error("Error loading suppliers:", error);
      setSuppliers([]);
      setSuppliersLoadedStoreId(null);
      return [];
    }
  };

  const loadCredits = async () => {
    const storeId = selectedStore?._id || selectedStore?.id;
    if (!storeId) {
      setCredits([]);
      return;
    }

    setLoading(true);
    try {
      // Ensure suppliers are loaded first (if not already loaded)
      let suppliersList = suppliers;
      if (suppliersList.length === 0) {
        try {
          suppliersList = await loadSuppliers(true);
        } catch (supplierError) {
          console.error("Error loading suppliers in loadCredits:", supplierError);
          suppliersList = [];
        }
      }

      // Helper function to get supplier name from supplierId
      const getSupplierName = (supplierId) => {
        if (!supplierId || suppliersList.length === 0) return null;
        
        // Try multiple ways to match the supplier ID
        const foundSupplier = suppliersList.find(s => {
          const sId = s._id || s.id || s.Suppliercode || s.SupplierId;
          // Try exact string match
          if (String(sId) === String(supplierId)) return true;
          // Try number match
          if (Number(sId) === Number(supplierId)) return true;
          return false;
        });
        
        if (foundSupplier) {
          return foundSupplier.companyName || foundSupplier.name || foundSupplier.Suppliername || foundSupplier.SupplierName || null;
        }
        return null;
      };

      // Fetch existing credits
      const creditParams = {
        page: pagination.currentPage,
        limit: pagination.itemsPerPage,
        storeId: storeId, // Include storeId to filter by selected store
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && { status: statusFilter }),
        ...(supplierFilter && { supplierId: supplierFilter })
      };

      const creditResponse = await creditsAPI.getCredits(creditParams);
      let existingCredits = creditResponse.data.credits || [];

      // Ensure existing credits have supplier names populated
      existingCredits = existingCredits.map(credit => {
        // If supplier name is missing or empty, try to get it from supplierId
        if ((!credit.supplierName || credit.supplierName === 'N/A' || credit.supplierName.trim() === '') && credit.supplierId) {
          const foundName = getSupplierName(credit.supplierId);
          if (foundName) {
            return {
              ...credit,
              supplierName: foundName,
              supplier: credit.supplier || (credit.supplierId ? {
                _id: credit.supplierId,
                companyName: foundName
              } : null)
            };
          }
        }
        return credit;
      });

      console.log('Existing credits from database:', existingCredits.length);
      // Debug: Log credit with history to see what we're getting
      if (existingCredits.length > 0) {
        const creditWithHistory = existingCredits.find(c => c.amountChangeHistory && c.amountChangeHistory.length > 0);
        if (creditWithHistory) {
          console.log('Credit with history:', {
            poNumber: creditWithHistory.poNumber,
            initialAmount: creditWithHistory.initialOriginalAmount,
            currentAmount: creditWithHistory.originalAmount,
            historyCount: creditWithHistory.amountChangeHistory.length,
            history: creditWithHistory.amountChangeHistory
          });
        }
      }

      // Get all PO IDs that already have credits
      const creditPOIds = new Set(
        existingCredits
          .map(credit => credit.purchaseOrderId || credit.purchaseOrder?._id)
          .filter(id => id)
      );

      // Fetch all POs with isCredit: true
      // Use isCredit filter in the API call to get only credit POs from database
      const poParams = {
        limit: 10000, // Get a large number to ensure we get all POs
        storeId: selectedStore._id,
        isCredit: true, // Filter by isCredit at database level
        ...(supplierFilter && { supplierId: supplierFilter })
      };

      let allCreditPOs = [];
      try {
        // Fetch POs with isCredit: true directly from database
        const poResponse = await purchaseOrdersAPI.getPurchaseOrders(poParams);
        const allPOs = poResponse.data?.purchaseOrders || poResponse.data || [];

        console.log('Credit POs fetched from DB (isCredit=true):', allPOs.length);
        console.log('All credit PO numbers:', allPOs.map(po => ({
          id: po._id,
          poNumber: po.poNumber,
          isCredit: po.isCredit,
          orderDate: po.orderDate
        })));

        // Filter out POs that already have credit records
        allCreditPOs = allPOs.filter(po => !creditPOIds.has(po._id));

        console.log('Credit POs without existing credit records:', allCreditPOs.length);
        console.log('Final credit PO IDs:', allCreditPOs.map(po => ({ id: po._id, poNumber: po.poNumber })));

        // Debug: Log PO data to check structure and numbers
        console.log('Total POs fetched:', allPOs.length);
        console.log('Credit POs (isCredit=true):', allCreditPOs.length);
        if (allCreditPOs.length > 0) {
          // Log detailed PO information including raw database values
          console.log('First 5 credit POs (detailed):', allCreditPOs.slice(0, 5).map(po => {
            // Check all possible PO number properties
            const allPONumberProps = {
              poNumber: po.poNumber,
              po_number: po.po_number,
              purchaseOrder_poNumber: po.purchaseOrder?.poNumber,
              purchaseOrderNumber: po.purchaseOrderNumber,
              rawKeys: Object.keys(po).filter(k => k.toLowerCase().includes('po') || k.toLowerCase().includes('number'))
            };
            return {
              id: po._id,
              ...allPONumberProps,
              orderDate: po.orderDate,
              isCredit: po.isCredit,
              supplierName: po.supplierName,
              fullObject: po // Include full object for inspection
            };
          }));

          // Check for PO-2025-539 specifically
          const targetPO = allCreditPOs.find(po =>
            String(po.poNumber || '').includes('539') ||
            String(po.po_number || '').includes('539')
          );
          if (targetPO) {
            console.log('Found PO with 539:', {
              id: targetPO._id,
              poNumber: targetPO.poNumber,
              po_number: targetPO.po_number,
              allProperties: Object.keys(targetPO),
              fullObject: targetPO
            });
          }
        }
      } catch (poError) {
        console.error("Error loading credit POs:", poError);
        // Continue with existing credits even if PO fetch fails
      }

      // Convert POs to credit-like objects for display
      // Use exact database values - supplier is stored as supplierId and supplierName
      // If supplierName is missing, try to fetch from suppliers list
      const poCredits = await Promise.all(allCreditPOs.map(async (po) => {
        // Calculate total amount from database values
        const totalAmount = parseFloat(po.totalAmount || 0);

        // Get PO number - use the exact value from database
        // The repository maps row.po_number to poNumber
        // Use po.poNumber directly as it comes from row.po_number in the database
        let poNumber = po.poNumber;

        // If poNumber is undefined/null, check raw database column name
        if (!poNumber && po.po_number) {
          poNumber = po.po_number;
        }

        // Ensure it's a string and not undefined/null
        poNumber = String(poNumber || '');

        // Debug log for PO number issues
        if (!poNumber || poNumber === 'undefined' || poNumber === 'null' || poNumber === '') {
          console.warn('PO number missing or invalid for PO:', {
            id: po._id,
            poNumber: po.poNumber,
            po_number: po.po_number,
            allKeys: Object.keys(po),
            rawPO: po
          });
        }

        // Get supplier info from database
        let supplierName = po.supplierName || po.supplier_name || po.supplier?.companyName || null;
        const supplierId = po.supplierId || po.supplier_id || po.supplier?._id || po.supplier || null;

        // If supplierName is missing but supplierId exists, try to find it in suppliers list
        if (!supplierName || supplierName === 'N/A' || supplierName.trim() === '') {
          if (supplierId) {
            const foundName = getSupplierName(supplierId);
            if (foundName) {
              supplierName = foundName;
            }
          }
        }

        // Final fallback
        supplierName = supplierName || 'N/A';

        // Get original PO total amount - this should never change
        const originalPOAmount = parseFloat(po.totalAmount || po.total || 0);

        return {
          _id: `po-${po._id}`,
          purchaseOrderId: po._id,
          poNumber: poNumber, // Use the resolved PO number
          purchaseOrder: {
            poNumber: poNumber,
            total: originalPOAmount,
            _id: po._id
          },
          supplier: supplierId ? {
            _id: supplierId,
            companyName: supplierName
          } : null,
          supplierId: supplierId,
          supplierName: supplierName, // Store directly from DB or fetched from suppliers
          orderDate: po.orderDate || po.order_date,
          originalAmount: totalAmount,
          initialOriginalAmount: totalAmount,
          paidAmount: parseFloat(po.partialPayment || po.partial_payment || 0), // Use partial_payment from DB
          balanceAmount: totalAmount - parseFloat(po.partialPayment || po.partial_payment || 0),
          status: parseFloat(po.partialPayment || po.partial_payment || 0) > 0
            ? (parseFloat(po.partialPayment || po.partial_payment || 0) >= totalAmount ? 'paid' : 'partially_paid')
            : 'pending',
          notes: po.notes || '',
          isPOCredit: true // Flag to identify PO credits without credit records
        };
      }));

      // Combine existing credits and PO credits
      let allCredits = [...existingCredits, ...poCredits];

      // Apply client-side filtering for search and status (since POs don't have these filters)
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        allCredits = allCredits.filter(credit =>
          (credit.poNumber && credit.poNumber.toLowerCase().includes(searchLower)) ||
          (credit.purchaseOrder?.poNumber && credit.purchaseOrder.poNumber.toLowerCase().includes(searchLower))
        );
      }

      if (statusFilter) {
        allCredits = allCredits.filter(credit => credit.status === statusFilter);
      }

      // Sort by order date (newest first), then by PO number (latest sequence first)
      allCredits.sort((a, b) => {
        const dateA = new Date(a.orderDate || 0);
        const dateB = new Date(b.orderDate || 0);
        if (dateB.getTime() !== dateA.getTime()) {
          return dateB - dateA;
        }
        // If dates are same, sort by PO number (extract sequence number)
        const poNumA = (a.poNumber || a.purchaseOrder?.poNumber || '').match(/(\d+)$/);
        const poNumB = (b.poNumber || b.purchaseOrder?.poNumber || '').match(/(\d+)$/);
        if (poNumA && poNumB) {
          return parseInt(poNumB[1], 10) - parseInt(poNumA[1], 10);
        }
        return 0;
      });

      // Apply pagination
      const totalItems = allCredits.length;
      const offset = (pagination.currentPage - 1) * pagination.itemsPerPage;
      const paginatedCredits = allCredits.slice(offset, offset + pagination.itemsPerPage);

      setCredits(paginatedCredits);
      setPagination({
        ...pagination,
        totalItems,
        totalPages: Math.ceil(totalItems / pagination.itemsPerPage)
      });
    } catch (error) {
      console.error("Error loading credits:", error);
      toast({
        title: getErrorTitle(error),
        description: getErrorMessage(error, "Failed to load credits", "credits"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerCredits = async () => {
    const storeId = selectedStore?._id || selectedStore?.id;
    if (!storeId) {
      setCustomerCredits([]);
      return;
    }

    setLoading(true);
    try {
      const params = {
        page: pagination.currentPage,
        limit: pagination.itemsPerPage,
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && { status: statusFilter }),
        storeId: storeId
      };

      const response = await customerCreditsAPI.getCustomerCredits(params);
      setCustomerCredits(response.data.credits || []);
      setPagination(response.data.pagination || pagination);
    } catch (error) {
      console.error("Error loading customer credits:", error);
      toast({
        title: getErrorTitle(error),
        description: getErrorMessage(error, "Failed to load customer credits", "customer credits"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreditSelect = (credit, isSelected) => {
    if (isSelected) {
      setSelectedCredits((prev) => [...prev, credit]);
    } else {
      setSelectedCredits((prev) => prev.filter((c) => c._id !== credit._id));
    }
  };

  const handleSelectAll = (isSelected) => {
    const currentCredits = creditTypeFilter === "po" ? credits : customerCredits;
    const payableCredits = currentCredits.filter(
      (credit) => credit.status !== "paid" && (credit.balanceAmount || 0) > 0
    );
    if (isSelected) {
      setSelectedCredits(payableCredits);
    } else {
      setSelectedCredits([]);
    }
  };

  const calculateSelectedTotal = () => {
    return selectedCredits.reduce((total, credit) => {
      return total + (credit.balanceAmount || 0);
    }, 0);
  };

  const isCreditSelected = (creditId) => {
    return selectedCredits.some((c) => c._id === creditId);
  };

  const handlePaySelectedClick = () => {
    if (selectedCredits.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one credit to pay",
        variant: "destructive",
      });
      return;
    }
    const total = calculateSelectedTotal();
    setPaymentAmount(Math.round(total).toString());
    setPaymentNotes("");
    setPaymentMode("cash");
    setPaymentDialogOpen(true);
  };

  const handlePaymentClick = (credit) => {
    setSelectedCredit(credit);
    setSelectedCredits([credit]);
    setPaymentAmount("");
    setPaymentNotes("");
    setPaymentMode("cash");
    setPaymentDialogOpen(true);
  };

  const handlePaymentSubmit = async () => {
    if (selectedCredits.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one credit to pay",
        variant: "destructive",
      });
      return;
    }

    const amount = Math.round(parseFloat(paymentAmount) || 0);
    if (!amount || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      });
      return;
    }

    if (!paymentMode) {
      toast({
        title: "Error",
        description: "Please select a payment mode",
        variant: "destructive",
      });
      return;
    }

    const totalBalance = selectedCredits.reduce((sum, credit) => sum + (credit.balanceAmount || 0), 0);
    if (amount > totalBalance) {
      toast({
        title: "Error",
        description: `Payment amount cannot exceed total balance amount of ₹${Math.round(totalBalance)}`,
        variant: "destructive",
      });
      return;
    }

    try {
      // Process payments for all selected credits
      const paymentPromises = selectedCredits.map(async (credit) => {
        // Calculate payment amount for this credit (proportional or full balance)
        const creditBalance = credit.balanceAmount || 0;
        const creditPaymentAmount = amount >= totalBalance ? creditBalance : Math.round((creditBalance / totalBalance) * amount);

        if (creditPaymentAmount <= 0) return;

        if (creditTypeFilter === "po") {
          // If this is a PO credit without a credit record, create one first
          if (credit.isPOCredit && credit.purchaseOrderId) {
            try {
              const poResponse = await purchaseOrdersAPI.getPurchaseOrder(credit.purchaseOrderId);
              const po = poResponse.data;

              await creditsAPI.createCredit(
                credit.purchaseOrderId,
                creditPaymentAmount,
                paymentNotes || '',
                {
                  poNumber: po.poNumber || credit.poNumber,
                  orderDate: po.orderDate || credit.orderDate,
                  originalAmount: po.totalAmount || credit.originalAmount,
                  supplierId: po.supplierId || credit.supplierId,
                  supplierName: po.supplierName || credit.supplierName,
                  storeId: po.storeId || selectedStore?._id,
                  paymentMode: paymentMode
                }
              );
            } catch (poError) {
              console.error("Error fetching PO details:", poError);
              await creditsAPI.createCredit(
                credit.purchaseOrderId,
                creditPaymentAmount,
                paymentNotes || '',
                {
                  poNumber: credit.poNumber,
                  orderDate: credit.orderDate,
                  originalAmount: credit.originalAmount,
                  supplierId: credit.supplierId,
                  supplierName: credit.supplierName,
                  storeId: selectedStore?._id,
                  paymentMode: paymentMode
                }
              );
            }
          } else {
            await creditsAPI.updateCreditPayment(credit._id, creditPaymentAmount, paymentNotes || '', paymentMode);
          }
        } else {
          await customerCreditsAPI.updateCustomerCreditPayment(credit._id, creditPaymentAmount, paymentNotes || '', paymentMode);
        }
      });

      await Promise.all(paymentPromises);

      toast({
        title: "Success",
        description: `Payment of ₹${amount} recorded successfully for ${selectedCredits.length} credit(s)`,
      });

      setPaymentDialogOpen(false);
      setSelectedCredit(null);
      setSelectedCredits([]);
      if (creditTypeFilter === "po") {
        loadCredits();
      } else {
        loadCustomerCredits();
      }
    } catch (error) {
      console.error("Error updating credit payment:", error);
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to update payment",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount = 0, options = {}) => {
    const formatter = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: options.minimumFractionDigits ?? 2,
    });
    return formatter.format(Number(amount) || 0);
  };

  const getStoreAddress = () => {
    if (!selectedStore) return "";
    const parts = [
      selectedStore.addressStreet,
      selectedStore.addressCity,
      selectedStore.addressState,
      selectedStore.addressZipCode,
    ]
      .map((part) => (part ? String(part).trim() : ""))
      .filter(Boolean);
    return parts.join(", ");
  };

  const buildBillingCreditPrintHtml = ({ bill, credit }) => {
    const storeName = selectedStore?.name || "SRI MURUGAN SUPER MARKET";
    const storePhone = selectedStore?.phone || selectedStore?.contactPhone || "";
    const storeGstin = selectedStore?.gstNumber || selectedStore?.gstin || "";
    const storeStateCode = selectedStore?.stateCode || selectedStore?.addressStateCode || "33";
    const placeOfSupply = selectedStore?.placeOfSupply || selectedStore?.addressState || selectedStore?.address?.state || "TamilNadu";
    const storeAddress = getStoreAddress() || (selectedStore?.addressLine1 || "S.F. NO. 7/124B2C1 VANDAVASI ROAD, SOHUPAKKAM - 603 319, Chengalpattu District");
    const bankDetails = selectedStore?.bankDetails || {};
    const bankName = bankDetails?.bankName || "";
    const accountNumber = bankDetails?.accountNumber || "";
    const ifscCode = bankDetails?.ifscCode || "";
    const branchName = bankDetails?.branchName || "";
    const billDate = bill?.date ? format(new Date(bill.date), "dd-MM-yyyy") : "";
    const items = Array.isArray(bill?.items) ? bill.items : [];
    const totalQty = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalDiscount = items.reduce((sum, item) => sum + Number(item.discount || 0), 0);
    // Tax breakdown
    const taxableBase = items.reduce((sum, item) => {
      return sum + (Number(item.subtotal || 0) - Number(item.discount || 0));
    }, 0);
    const sgstRatePrint = bill?.sgstRateGlobal ?? credit?.sgstRateGlobal ?? 0;
    const cgstRatePrint = bill?.cgstRateGlobal ?? credit?.cgstRateGlobal ?? 0;
    const totalSGST = taxableBase * (Number(sgstRatePrint || 0) / 100);
    const totalCGST = taxableBase * (Number(cgstRatePrint || 0) / 100);
    const hasAnyCGST = Number(cgstRatePrint || 0) > 0;
    const totalTax = bill?.tax ?? (totalSGST + totalCGST);
    const roundedTotal = Math.round(Number(bill?.total || credit?.originalAmount || 0));
    const roundOff = roundedTotal - Number(bill?.total || credit?.originalAmount || 0);

    const rowsHtml =
      items.length > 0
        ? items
          .map((item, index) => {
            const taxableValue = Number(item.subtotal || 0) - Number(item.discount || 0);
            const globalCombinedRate = Number(sgstRatePrint || 0) + Number(cgstRatePrint || 0);
            // Prioritize item-level taxRate (even if 0), then item-level SGST+CGST, then global rates
            const itemSgstCgst = (Number(item.sgstRate || 0) + Number(item.cgstRate || 0));
            const hasExplicitTaxRate = item.taxRate !== null && item.taxRate !== undefined;
            const itemTaxRate = hasExplicitTaxRate ? Number(item.taxRate) : null;
            
            // If taxRate is explicitly set (even if 0), use it. Otherwise fall back to SGST+CGST or global rates
            let combinedRate = 0;
            if (hasExplicitTaxRate) {
              combinedRate = itemTaxRate; // Use taxRate even if it's 0
            } else if (itemSgstCgst > 0) {
              combinedRate = itemSgstCgst;
            } else if (globalCombinedRate > 0) {
              combinedRate = globalCombinedRate;
            }
            
            const gstAmount = taxableValue * (combinedRate / 100);
            const hsnCode =
              item.hsnCode ??
              item.hsnId ??
              item.hsn_code ??
              item.HSN ??
              item.hsn ??
              "";
            return `
                <tr>
                  <td>${index + 1}</td>
                  <td>
                    <div class="item-name">${item.itemName || "Item"}</div>
                    ${hsnCode ? `<div class="item-code">HSN/SAC: ${hsnCode}</div>` : ""}
                  </td>
                  <td class="text-center">${item.quantity || 0}</td>
                  <td class="text-right">${formatCurrency(item.unitPrice || 0)}</td>
                  <td class="text-center">${hsnCode || "-"}</td>
                  <td class="text-right">${combinedRate ? `${combinedRate}%` : "-"}</td>
                  <td class="text-right">${formatCurrency(gstAmount)}</td>
                  <td class="text-right">${formatCurrency(item.total || taxableValue + gstAmount)}</td>
                </tr>
              `;
          })
          .join("")
        : `
          <tr>
            <td colspan="8" class="text-center">No line items were found for this bill.</td>
          </tr>
        `;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Billing Credit - ${bill?.billNo || credit?.billNumber || ""}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: "Segoe UI", Arial, sans-serif;
              padding: 24px;
              color: #111;
            }
            .invoice-wrapper {
              max-width: 900px;
              margin: 0 auto;
              border: 1px solid #cbd5f5;
              padding: 24px;
            }
            .header { margin-bottom: 16px; }
            .header-title { text-align:center; font-size:22px; font-weight:700; text-transform:uppercase; color:#1e3a8a; }
            .header-sub { text-align:center; font-size:12px; margin-top:2px; }
            .header-grid { display:grid; grid-template-columns: repeat(5, 1fr); gap:8px; margin-top:10px; font-size:12px; }
            .cell { border:1px solid #cbd5f5; padding:6px 8px; min-height:38px; }
            .cell-title { font-weight:600; margin-bottom:2px; color:#374151; }
            .right { text-align:right; }
            .meta-grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:12px; margin: 10px 0 0; font-size: 13px; }
            .meta-label { font-weight: 600; color: #374151; }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 16px;
            }
            th, td {
              border: 1px solid #cbd5f5;
              padding: 8px;
              font-size: 13px;
            }
            th {
              background-color: #eef2ff;
              text-align: center;
              font-weight: 600;
            }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .summary {
              margin-top: 20px;
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 16px;
              font-size: 14px;
            }
            .summary-card {
              border: 1px solid #cbd5f5;
              padding: 12px;
            }
            .summary-card h3 {
              margin: 0 0 8px;
              font-size: 15px;
              text-transform: uppercase;
              color: #1e3a8a;
            }
            .summary-row {
              display: flex;
              justify-content: space-between;
              padding: 4px 0;
            }
            .signatures {
              margin-top: 40px;
              display: flex;
              justify-content: space-between;
            }
            .signature-line {
              width: 45%;
              text-align: center;
              padding-top: 40px;
              min-height: 60px;
              font-size: 12px;
              color: #4b5563;
            }
            @media print {
              body { padding: 0; }
              .invoice-wrapper { border: none; }
            }
          </style>
        </head>
        <body>
          <div class="invoice-wrapper">
            <div class="header">
              <div class="header-title">${storeName}</div>
              ${storeGstin && String(storeGstin).trim() ? `<div class="header-sub">GST IN: ${storeGstin}</div>` : ""}
              <div class="header-sub">${storeAddress}</div>
              ${storePhone ? `<div class="header-sub">Phone: ${storePhone}</div>` : ""}
              <div class="header-grid">
                <div class="cell">
                  <div class="cell-title">State Code</div>
                  <div>${storeStateCode}</div>
                </div>
                <div class="cell">
                  <div class="cell-title">Place of Supply</div>
                  <div>${placeOfSupply}</div>
                </div>
                <div class="cell">
                  <div class="cell-title">Bill No & Page No</div>
                  <div>${bill?.billNo || credit?.billNumber || "N/A"}</div>
                </div>
                <div class="cell">
                  <div class="cell-title">Bill Date</div>
                  <div>${billDate || "N/A"}</div>
                </div>
                <div class="cell">
                  <div class="cell-title">GST Invoice</div>
                  <div>${credit?.invoiceType || "GST Invoice"}</div>
                </div>
              </div>
              <div class="meta-grid">
                <div>
                  <div class="meta-label">Customer</div>
                  <div>${credit?.customerName || bill?.customerName || "N/A"}</div>
                </div>
                <div>
                  <div class="meta-label">Customer Phone</div>
                  <div>${credit?.customerPhone || bill?.customerPhone || "-"}</div>
                </div>
                ${(credit?.customerAddress || bill?.customerAddress) ? `
                <div>
                  <div class="meta-label">Customer Address</div>
                  <div>${credit?.customerAddress || bill?.customerAddress || "-"}</div>
                </div>
                ` : ""}
                ${(credit?.customerGstin || bill?.customerGstin) ? `
                <div>
                  <div class="meta-label">Customer GSTIN</div>
                  <div>${credit?.customerGstin || bill?.customerGstin || "-"}</div>
                </div>
                ` : ""}
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>HSN/SAC</th>
                  <th>GST %</th>
                  <th>GST Amt</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>

            <div class="summary">
              <div class="summary-card">
                <h3>Bill Summary</h3>
                <div class="summary-row">
                  <span>Total Items</span>
                  <strong>${items.length}</strong>
                </div>
                <div class="summary-row">
                  <span>Total Quantity</span>
                  <strong>${totalQty}</strong>
                </div>
                <div class="summary-row">
                  <span>Discount</span>
                  <strong>${formatCurrency(totalDiscount)}</strong>
                </div>
              </div>
              <div class="summary-card">
                <h3>Amount Details</h3>
                <div class="summary-row">
                  <span>Sub Total</span>
                  <strong>${formatCurrency(bill?.subtotal || credit?.initialOriginalAmount || 0)}</strong>
                </div>
                <div class="summary-row">
                  <span>SGST</span>
                  <strong>${formatCurrency(totalSGST)}</strong>
                </div>
                <div class="summary-row">
                  <span>CGST</span>
                  <strong>${hasAnyCGST ? formatCurrency(totalCGST) : ""}</strong>
                </div>
                <div class="summary-row">
                  <span>Tax</span>
                  <strong>${formatCurrency(totalTax)}</strong>
                </div>
                <div class="summary-row">
                  <span>Grand Total</span>
                  <strong>${formatCurrency(bill?.total || credit?.originalAmount || 0)}</strong>
                </div>
                <div class="summary-row">
                  <span>Round Off</span>
                  <strong>${formatCurrency(roundOff)}</strong>
                </div>
                <div class="summary-row" style="font-size:16px;">
                  <span>Rounded Net Amount</span>
                  <strong>${formatCurrency(roundedTotal)}</strong>
                </div>
              </div>
            </div>

            <div class="signatures" style="margin-top: 40px;">
              <div class="footer-info" style="width: 50%; font-size: 12px;">
                ${storeName ? `<div style="margin-bottom: 4px;"><strong>Store Name:</strong> ${storeName}</div>` : ""}
                ${storeAddress ? `<div style="margin-bottom: 4px;"><strong>Address:</strong> ${storeAddress}</div>` : ""}
                ${bankName ? `<div style="margin-bottom: 4px;"><strong>Bank Name:</strong> ${bankName}</div>` : ""}
                ${accountNumber ? `<div style="margin-bottom: 4px;"><strong>Account Number:</strong> ${accountNumber}</div>` : ""}
                ${ifscCode ? `<div style="margin-bottom: 4px;"><strong>IFSC Code:</strong> ${ifscCode}</div>` : ""}
                ${branchName ? `<div style="margin-bottom: 4px;"><strong>Branch Name:</strong> ${branchName}</div>` : ""}
              </div>
              <div class="signature-line" style="width: 45%; padding-top: 40px; min-height: 60px;">Authorized Signature</div>
            </div>
          </div>
        </body>
      </html>
    `;

    return html;
  };

  const openBillingCreditDetail = async (credit) => {
    if (!credit || creditTypeFilter !== "billing") return;
    setSelectedCredit(credit);
    setDetailDialogOpen(true);
    setDetailLoading(true);
    setDetailBill(null);
    setDetailItems([]);
    try {
      const billResponse = await billsAPI.getBill(credit.billId || credit._id);
      const billData = billResponse?.data?.bill || billResponse?.data || billResponse;
      const items = Array.isArray(billData?.items) ? billData.items : [];
      const gstFromIndex = (idx) => {
        const slabs = [0, 5, 12, 18, 28];
        const n = Number(idx);
        if (!Number.isFinite(n)) return null;
        if (n >= 0 && n < slabs.length) return slabs[n];
        // Sometimes stored as 5,12,18,28 already → return as is
        if (slabs.includes(n)) return n;
        return null;
      };
      const normalizeGstValue = (raw) => {
        // If raw already looks like a percent slab, use it
        const asNum = Number(raw);
        if (!Number.isFinite(asNum)) return 0;
        const slabMapped = gstFromIndex(asNum);
        // gstFromIndex will convert 0..4 → slab; if it was already 5/12/18/28 it returns itself
        return Number.isFinite(slabMapped) ? slabMapped : 0;
      };
      // Fetch saved item overrides
      let itemOverridesMap = new Map();
      try {
        const creditDetailResponse = await customerCreditsAPI.getCustomerCredit(credit._id);
        const creditDetail = creditDetailResponse?.data || {};
        if (creditDetail.itemOverrides && Array.isArray(creditDetail.itemOverrides)) {
          creditDetail.itemOverrides.forEach((override) => {
            const lineNo = override.lineNo || override.line_no || 0;
            if (lineNo > 0) {
              itemOverridesMap.set(lineNo, override);
            }
          });
        }
      } catch (err) {
        console.warn("Could not fetch item overrides:", err);
      }

      // Normalize items for editing (keep qty and allow price edit)
      const normalized = items.map((it, idx) => {
        const lineNo = idx + 1;
        const override = itemOverridesMap.get(lineNo);
        return {
          _key: `${idx}-${it._id || it.id || it.barcode || it.itemCode || Math.random()}`,
          itemId: it.itemId || it._id || it.id || null,
          itemName: override?.itemName || it.itemName || it.name || "Item",
          // Keep product code separate and use dedicated HSN fields
          itemCode: it.itemCode || it.item_code || "",
          batch: it.batch || it.batchNumber || "",
          mrp: Number(it.mrp ?? it.MRP ?? 0),
          hsnCode: override?.hsnCode || it.hsnCode || it.hsn_code || it.HSN || it.hsn || "",
          hsnId: it.hsnId || it.HSNId || "",
          quantity: override?.quantity !== null && override?.quantity !== undefined 
            ? Number(override.quantity) 
            : Number(it.quantity ?? it.qty ?? 1),
          unitPrice: override?.unitPrice !== null && override?.unitPrice !== undefined
            ? Number(override.unitPrice)
            : Number(it.unitPrice ?? it.saleRate ?? it.price ?? 0),
          discount: override?.discount !== null && override?.discount !== undefined
            ? Number(override.discount)
            : Number(it.discount ?? 0),
          // Use saved taxRate from override, otherwise default to 0
          taxRate: override?.taxRate !== null && override?.taxRate !== undefined
            ? Number(override.taxRate)
            : 0,
          subtotal: Number(it.subtotal ?? (Number(it.unitPrice ?? it.saleRate ?? it.price ?? 0) * Number(it.quantity ?? it.qty ?? 1))),
          total: Number(it.total ?? 0),
        };
      });
      
      setDetailBill(billData);
      setDetailItems(normalized);
      setDetailNotes(credit?.notes || "");
      // Load saved SGST and CGST global rates from credit object
      setSgstRateGlobal(Number(credit?.sgstRateGlobal || 0));
      setCgstRateGlobal(Number(credit?.cgstRateGlobal || 0));
    } catch (error) {
      console.error("Error loading bill for detail:", error);
      toast({
        title: getErrorTitle(error),
        description: getErrorMessage(error, "Failed to load bill details", "bill details"),
        variant: "destructive",
      });
      setDetailDialogOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const recalcDetailTotals = (items = detailItems) => {
    const withCalcs = items.map((it) => {
      const qty = Number(it.quantity || 0);
      const price = Number(it.unitPrice || 0);
      const subtotal = qty * price;
      const gst = subtotal * (Number(it.taxRate || 0) / 100);
      const lineTotal = subtotal - Number(it.discount || 0) + gst;
      return { ...it, subtotal, total: lineTotal };
    });
    const subtotal = withCalcs.reduce((s, it) => s + it.subtotal, 0);
    const discount = withCalcs.reduce((s, it) => s + Number(it.discount || 0), 0);
    const itemGst = withCalcs.reduce((s, it) => {
      const taxable = it.subtotal - Number(it.discount || 0);
      return s + taxable * (Number(it.taxRate || 0) / 100);
    }, 0);
    const taxableBase = withCalcs.reduce((s, it) => s + (it.subtotal - Number(it.discount || 0)), 0);
    const sgstAmt = taxableBase * (Number(sgstRateGlobal || 0) / 100);
    const cgstAmt = taxableBase * (Number(cgstRateGlobal || 0) / 100);
    const tax = itemGst + sgstAmt + cgstAmt;
    const grandTotal = subtotal - discount + tax;
    const roundedTotal = Math.round(grandTotal);
    const roundOff = roundedTotal - grandTotal;
    return {
      items: withCalcs,
      summary: { subtotal, discount, itemGst, sgstAmt, cgstAmt, tax, grandTotal, roundedTotal, roundOff },
    };
  };

  const handleDetailItemPriceChange = (key, value) => {
    setDetailItems((prev) => {
      const next = prev.map((it) =>
        it._key === key ? { ...it, unitPrice: Number(value || 0) } : it
      );
      return recalcDetailTotals(next).items;
    });
  };

  const handleDetailItemQtyChange = (key, value) => {
    setDetailItems((prev) => {
      const next = prev.map((it) =>
        it._key === key ? { ...it, quantity: Number(value || 0) } : it
      );
      return recalcDetailTotals(next).items;
    });
  };

  const handleDetailItemGstChange = (key, value) => {
    setDetailItems((prev) => {
      const parsed = Number(value || 0);
      const safe = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
      const half = safe / 2;
      const next = prev.map((it) =>
        it._key === key
          ? {
              ...it,
              taxRate: safe,
              // When user edits GST, split evenly into SGST/CGST for simplicity
              sgstRate: half,
              cgstRate: half,
            }
          : it
      );
      return recalcDetailTotals(next).items;
    });
  };

  const handleDetailItemSgstChange = (key, value) => {
    setDetailItems((prev) => {
      const parsed = Number(value || 0);
      const safe = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
      const next = prev.map((it) =>
        it._key === key ? { ...it, sgstRate: safe } : it
      );
      return recalcDetailTotals(next).items;
    });
  };

  const handleDetailItemCgstChange = (key, value) => {
    setDetailItems((prev) => {
      const parsed = Number(value || 0);
      const safe = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
      const next = prev.map((it) =>
        it._key === key ? { ...it, cgstRate: safe } : it
      );
      return recalcDetailTotals(next).items;
    });
  };

  const handleDetailItemHsnChange = (key, value) => {
    setDetailItems((prev) => {
      const next = prev.map((it) =>
        it._key === key ? { ...it, hsnCode: value } : it
      );
      return next;
    });
  };

  const handleSaveDetailAndPrint = async (credit) => {
    if (!credit || creditTypeFilter !== "billing") return;
    const { items, summary } = recalcDetailTotals(detailItems);
    try {
      // Persist detailed overrides and the new amount
      await customerCreditsAPI.updateCustomerCreditDetail(credit._id, {
        items: items.map((it, idx) => ({
          lineNo: idx + 1,
          itemName: it.itemName,
          hsnCode: it.hsnCode || it.hsnId || "",
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discount: it.discount || 0,
          taxRate: it.taxRate,
          sgstRate: it.sgstRate,
          cgstRate: it.cgstRate,
        })),
        sgstRateGlobal,
        cgstRateGlobal,
        notes: detailNotes || "Adjusted prices in bill credit detail",
        newAmount: summary.grandTotal,
      });
      // Refresh list
      await loadCustomerCredits();
      // Use existing A4 print with modified items and computed totals
      const billForPrint = {
        ...(detailBill || {}),
        items: items.map((it) => ({
          itemName: it.itemName,
          hsnCode: it.hsnCode || it.hsnId || "",
          hsnId: it.hsnId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          subtotal: it.subtotal,
          discount: it.discount,
          taxRate: it.taxRate,
          total: it.total,
        })),
        sgstRateGlobal,
        cgstRateGlobal,
        subtotal: summary.subtotal,
        tax: summary.tax,
        total: summary.grandTotal,
      };
      const htmlContent = buildBillingCreditPrintHtml({ bill: billForPrint, credit: { ...credit, originalAmount: summary.grandTotal } });
      const printWindow = window.open("", "_blank", "width=900,height=1200");
      if (!printWindow) {
        throw new Error("Please allow pop-ups to print the bill");
      }
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
      toast({ title: "Saved", description: "Prices updated and bill is ready to print." });
      setDetailDialogOpen(false);
    } catch (error) {
      console.error("Save/Print failed:", error);
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to save changes",
        variant: "destructive",
      });
    }
  };

  const handleSaveDetail = async (credit) => {
    if (!credit || creditTypeFilter !== "billing") return;
    const { summary } = recalcDetailTotals(detailItems);
    try {
      await customerCreditsAPI.updateCustomerCreditDetail(credit._id, {
        items: detailItems.map((it, idx) => ({
          lineNo: idx + 1,
          itemName: it.itemName,
          hsnCode: it.hsnCode || it.hsnId || "",
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discount: it.discount || 0,
          taxRate: it.taxRate,
          sgstRate: it.sgstRate,
          cgstRate: it.cgstRate,
        })),
        sgstRateGlobal,
        cgstRateGlobal,
        notes: detailNotes || "Saved bill credit detail with updated amounts",
        newAmount: summary.grandTotal,
      });
      await loadCustomerCredits();
      toast({ title: "Saved", description: "Changes saved successfully." });
      setDetailDialogOpen(false);
    } catch (error) {
      console.error("Save failed:", error);
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to save changes",
        variant: "destructive",
      });
    }
  };

  const handleBillingCreditPrint = async (credit) => {
    if (!credit || creditTypeFilter !== "billing") return;
    try {
      setPrintingCreditId(credit._id);
      const billResponse = await billsAPI.getBill(credit.billId || credit._id);
      const billData = billResponse?.data?.bill || billResponse?.data || billResponse;
      if (!billData) {
        throw new Error("Bill details not found for printing");
      }

      // Fetch saved item overrides to apply to bill items
      let itemOverridesMap = new Map();
      try {
        const creditDetailResponse = await customerCreditsAPI.getCustomerCredit(credit._id);
        const creditDetail = creditDetailResponse?.data || {};
        if (creditDetail.itemOverrides && Array.isArray(creditDetail.itemOverrides)) {
          creditDetail.itemOverrides.forEach((override) => {
            const lineNo = override.lineNo || override.line_no || 0;
            if (lineNo > 0) {
              itemOverridesMap.set(lineNo, override);
            }
          });
        }
      } catch (err) {
        console.warn("Could not fetch item overrides for print:", err);
      }

      // Apply overrides to bill items
      const itemsWithOverrides = (billData.items || []).map((item, idx) => {
        const lineNo = idx + 1;
        const override = itemOverridesMap.get(lineNo);
        if (override) {
          return {
            ...item,
            itemName: override.itemName || item.itemName || item.name || "Item",
            itemCode: item.itemCode || item.item_code || "",
            batch: item.batch || item.batchNumber || "",
            mrp: Number(item.mrp ?? item.MRP ?? 0),
            taxRate: override.taxRate !== null && override.taxRate !== undefined ? override.taxRate : (item.taxRate || 0),
            unitPrice: override.unitPrice !== null && override.unitPrice !== undefined ? override.unitPrice : item.unitPrice,
            quantity: override.quantity !== null && override.quantity !== undefined ? override.quantity : item.quantity,
            discount: override.discount !== null && override.discount !== undefined ? override.discount : (item.discount || 0),
            hsnCode: override.hsnCode || item.hsnCode,
          };
        }
        // If no override, ensure taxRate is 0 if not explicitly set
        return {
          ...item,
          itemName: item.itemName || item.name || "Item",
          itemCode: item.itemCode || item.item_code || "",
          batch: item.batch || item.batchNumber || "",
          mrp: Number(item.mrp ?? item.MRP ?? 0),
          taxRate: item.taxRate !== null && item.taxRate !== undefined ? item.taxRate : 0,
        };
      });

      const billDataWithOverrides = {
        ...billData,
        items: itemsWithOverrides,
        sgstRateGlobal: credit.sgstRateGlobal !== null && credit.sgstRateGlobal !== undefined ? credit.sgstRateGlobal : (billData.sgstRateGlobal || 0),
        cgstRateGlobal: credit.cgstRateGlobal !== null && credit.cgstRateGlobal !== undefined ? credit.cgstRateGlobal : (billData.cgstRateGlobal || 0),
      };

      const htmlContent = buildBillingCreditPrintHtml({ bill: billDataWithOverrides, credit });
      const printWindow = window.open("", "_blank", "width=900,height=1200");
      if (!printWindow) {
        throw new Error("Please allow pop-ups to print the bill");
      }
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
      toast({
        title: "Print Ready",
        description: "The bill is ready to be printed.",
      });
    } catch (error) {
      console.error("Billing credit print error:", error);
      toast({
        title: "Print Failed",
        description: error.message || "Unable to print this bill. Try again.",
        variant: "destructive",
      });
    } finally {
      setPrintingCreditId(null);
    }
  };

  const handleEditAmountClick = (credit) => {
    setSelectedCredit(credit);
    setNewOriginalAmount(credit.originalAmount?.toString() || "");
    setAmountChangeNotes("");
    setEditAmountDialogOpen(true);
  };

  const handleAmountUpdate = async () => {
    if (!selectedCredit) return;

    const newAmount = parseFloat(newOriginalAmount);
    const currentAmount = parseFloat(selectedCredit.originalAmount || 0);

    if (!newAmount || newAmount < 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    // Validation: new amount cannot be greater than current amount
    if (newAmount > currentAmount) {
      toast({
        title: "Error",
        description: `New amount cannot be greater than current amount (₹${Math.round(currentAmount)})`,
        variant: "destructive",
      });
      return;
    }

    if (newAmount === currentAmount) {
      toast({
        title: "No Change",
        description: "New amount is the same as current amount",
        variant: "destructive",
      });
      return;
    }

    try {
      if (creditTypeFilter === "po") {
        // If this is a PO credit without a credit record, create one first
        if (selectedCredit.isPOCredit && selectedCredit.purchaseOrderId) {
          // Fetch the PO details to get the correct PO number and other info
          try {
            const poResponse = await purchaseOrdersAPI.getPurchaseOrder(selectedCredit.purchaseOrderId);
            const po = poResponse.data;

            // Get the original PO total amount - this should be preserved as initialOriginalAmount
            const originalPOAmount = parseFloat(po.totalAmount || po.total || selectedCredit.purchaseOrder?.total || selectedCredit.originalAmount || 0);

            // Create credit with all PO details
            // originalAmount = newAmount (edited amount)
            // initialOriginalAmount = originalPOAmount (original PO amount, never changes)
            await creditsAPI.createCredit(
              selectedCredit.purchaseOrderId,
              0,
              amountChangeNotes || "Credit created from PO",
              {
                poNumber: po.poNumber || selectedCredit.poNumber,
                orderDate: po.orderDate || selectedCredit.orderDate,
                originalAmount: newAmount, // Use the new (edited) amount
                initialOriginalAmount: originalPOAmount, // Preserve the original PO amount
                supplierId: po.supplierId || selectedCredit.supplierId,
                supplierName: po.supplierName || selectedCredit.supplierName,
                storeId: po.storeId || selectedStore?._id
              }
            );
            toast({
              title: "Success",
              description: "Credit created with updated amount successfully",
            });
          } catch (poError) {
            console.error("Error fetching PO details:", poError);
            // Fallback: create credit with available data
            // Try to preserve original amount from purchaseOrder.total or originalAmount
            const originalPOAmount = parseFloat(
              selectedCredit.purchaseOrder?.total ||
              selectedCredit.initialOriginalAmount ||
              selectedCredit.originalAmount ||
              0
            );

            await creditsAPI.createCredit(
              selectedCredit.purchaseOrderId,
              0,
              amountChangeNotes || "Credit created from PO",
              {
                poNumber: selectedCredit.poNumber,
                orderDate: selectedCredit.orderDate,
                originalAmount: newAmount, // Use the new (edited) amount
                initialOriginalAmount: originalPOAmount, // Preserve the original PO amount
                supplierId: selectedCredit.supplierId,
                supplierName: selectedCredit.supplierName,
                storeId: selectedStore?._id
              }
            );
            toast({
              title: "Success",
              description: "Credit created with updated amount successfully",
            });
          }
        } else {
          // Update credit amount - this should update originalAmount but preserve initialOriginalAmount
          // The backend should handle preserving initialOriginalAmount if it exists
          await creditsAPI.updateCreditAmount(selectedCredit._id, newAmount, amountChangeNotes);
        }
      } else {
        await customerCreditsAPI.updateCustomerCreditAmount(selectedCredit._id, newAmount, amountChangeNotes);
      }

      setEditAmountDialogOpen(false);
      setSelectedCredit(null);
      setNewOriginalAmount("");
      setAmountChangeNotes("");

      // Reload credits to get the updated data with full history
      // Wait a bit to ensure backend has saved the changes
      await new Promise(resolve => setTimeout(resolve, 500));

      if (creditTypeFilter === "po") {
        await loadCredits();
      } else {
        await loadCustomerCredits();
      }

      // Show success message
      toast({
        title: "Success",
        description: "Amount updated and change history saved successfully",
      });
    } catch (error) {
      console.error("Error updating credit amount:", error);
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to update amount",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCredit = async (creditId) => {
    if (!confirm("Are you sure you want to delete this credit? This action cannot be undone.")) {
      return;
    }

    try {
      await creditsAPI.deleteCredit(creditId);
      toast({
        title: "Success",
        description: "Credit deleted successfully",
      });
      loadCredits();
    } catch (error) {
      console.error("Error deleting credit:", error);
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to delete credit",
        variant: "destructive",
      });
    }
  };

  const handleHideCredit = async (credit) => {
    if (!credit || creditTypeFilter !== "billing") return;
    
    if (!confirm("Are you sure you want to hide this bill? It will not appear in the list anymore.")) {
      return;
    }

    try {
      await customerCreditsAPI.toggleCreditVisibility(credit._id, true);
      toast({
        title: "Success",
        description: "Bill hidden successfully",
      });
      await loadCustomerCredits();
    } catch (error) {
      console.error("Error hiding credit:", error);
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to hide bill",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { variant: "destructive", label: "Pending" },
      partially_paid: { variant: "default", label: "Partially Paid" },
      paid: { variant: "secondary", label: "Paid" }
    };

    const config = statusConfig[status] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading && credits.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading credits...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl text-blue-600 flex items-center gap-2">
              <CreditCard className="h-6 w-6" />
              SUPPLIER CREDITS
            </CardTitle>
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-5 gap-4">
            <div>
              <Label>Credit Type</Label>
              <Select
                value={creditTypeFilter}
                onValueChange={setCreditTypeFilter}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="po">PO Credit</SelectItem>
                  <SelectItem value="billing">Billing Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={creditTypeFilter === "po" ? "Search by PO number..." : "Search by customer name or bill number..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={statusFilter || "all"}
                onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partially_paid">Partially Paid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {creditTypeFilter === "po" && (
              <div>
                <Label>Supplier</Label>
                <Select
                  value={supplierFilter || "all"}
                  onValueChange={(value) => setSupplierFilter(value === "all" ? "" : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Suppliers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Suppliers</SelectItem>
                    {Array.isArray(suppliers) && suppliers.length > 0
                      ? suppliers
                        .filter(supplier => {
                          if (!supplier || !supplier._id || !supplier.companyName) return false;
                          const id = String(supplier._id).trim();
                          const name = String(supplier.companyName).trim();
                          return id !== "" && name !== "";
                        })
                        .map((supplier) => {
                          const supplierId = String(supplier._id).trim();
                          const companyName = String(supplier.companyName).trim();
                          return (
                            <SelectItem key={supplierId} value={supplierId}>
                              {companyName}
                            </SelectItem>
                          );
                        })
                      : null}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("");
                  setSupplierFilter("");
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credits Table */}
      <Card>
        <CardContent className="pt-6">
          {selectedCredits.length > 0 && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-900">
                  {selectedCredits.length} credit(s) selected
                </p>
                <p className="text-lg font-bold text-blue-700">
                  Total Amount: ₹{Math.round(calculateSelectedTotal())}
                </p>
              </div>
              <Button
                onClick={handlePaySelectedClick}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Pay Selected ({selectedCredits.length})
              </Button>
            </div>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={
                        (creditTypeFilter === "po" ? credits : customerCredits).length > 0 &&
                        (creditTypeFilter === "po" ? credits : customerCredits)
                          .filter((credit) => credit.status !== "paid" && (credit.balanceAmount || 0) > 0)
                          .every((credit) => isCreditSelected(credit._id))
                      }
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </TableHead>
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
                      <TableHead>Bill Date</TableHead>
                    </>
                  )}
                  <TableHead>Initial Amount</TableHead>
                  <TableHead>Current Amount</TableHead>
                  <TableHead className="min-w-[148px]">Paid (history)</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-2">
                      <span>Changes</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          // Find first credit with changes to show
                          const creditWithChanges = (creditTypeFilter === "po" ? credits : customerCredits).find(
                            credit => {
                              let initialAmount = 0;
                              if (credit.initialOriginalAmount !== undefined && credit.initialOriginalAmount !== null && credit.initialOriginalAmount !== 0) {
                                initialAmount = credit.initialOriginalAmount;
                              } else if (credit.purchaseOrder?.total !== undefined && credit.purchaseOrder?.total !== null && credit.purchaseOrder?.total !== 0) {
                                initialAmount = credit.purchaseOrder.total;
                              } else {
                                initialAmount = credit.initialOriginalAmount ?? credit.originalAmount ?? 0;
                              }
                              const currentAmount = credit.originalAmount || 0;
                              const hasChanged = Math.abs(initialAmount - currentAmount) > 0.01;
                              const hasHistory = credit.amountChangeHistory && credit.amountChangeHistory.length > 0;
                              return hasChanged || hasHistory;
                            }
                          );
                          if (creditWithChanges) {
                            setSelectedCreditForChanges(creditWithChanges);
                            setChangesDialogOpen(true);
                          }
                        }}
                        title="View all changes"
                      >
                        <FileText className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (creditTypeFilter === "po" ? credits : customerCredits).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      No credits found
                    </TableCell>
                  </TableRow>
                ) : (
                  (creditTypeFilter === "po" ? credits : customerCredits).map((credit) => {
                    const paymentRows = getSortedPaymentHistory(credit);
                    return (
                    <TableRow key={credit._id}>
                      <TableCell>
                        {credit.status !== "paid" && (credit.balanceAmount || 0) > 0 && (
                          <input
                            type="checkbox"
                            checked={isCreditSelected(credit._id)}
                            onChange={(e) => handleCreditSelect(credit, e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                        )}
                      </TableCell>
                      {creditTypeFilter === "po" ? (
                        <>
                          <TableCell className="font-medium">
                            {credit.poNumber || credit.purchaseOrder?.poNumber || credit.po_number || 'N/A'}
                          </TableCell>
                          <TableCell>
                            {credit.supplierName || credit.supplier?.companyName || "N/A"}
                          </TableCell>
                          <TableCell>
                            {credit.orderDate
                              ? format(new Date(credit.orderDate), "dd-MM-yyyy")
                              : "N/A"}
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="font-medium">
                            {credit.billNumber || "N/A"}
                          </TableCell>
                          <TableCell>
                            {credit.customerName || "N/A"}
                          </TableCell>
                          <TableCell>
                            {credit.billDate
                              ? format(new Date(credit.billDate), "dd-MM-yyyy")
                              : "N/A"}
                          </TableCell>
                        </>
                      )}
                      <TableCell className="font-medium">
                        {(() => {
                          // Initial Amount should ALWAYS show the original PO amount (never changes)
                          // This is the amount from the PO before any edits
                          // Priority: initialOriginalAmount > purchaseOrder.total > originalAmount (for PO credits that haven't been edited)
                          let initialAmount = 0;

                          // First priority: use initialOriginalAmount if it exists and is not null
                          if (credit.initialOriginalAmount !== undefined && credit.initialOriginalAmount !== null && credit.initialOriginalAmount !== 0) {
                            initialAmount = credit.initialOriginalAmount;
                          }
                          // Second priority: use purchaseOrder.total if available (for PO credits without credit records)
                          else if (credit.purchaseOrder?.total !== undefined && credit.purchaseOrder?.total !== null && credit.purchaseOrder?.total !== 0) {
                            initialAmount = credit.purchaseOrder.total;
                          }
                          // Third priority: for PO credits without credit records, if originalAmount equals purchaseOrder total, use it
                          // This handles the case where the credit hasn't been edited yet
                          else if (credit.isPOCredit && credit.purchaseOrderId) {
                            // If it's a PO credit and amounts are the same, originalAmount is the initial amount
                            // But we should prefer to fetch from PO if possible
                            initialAmount = credit.originalAmount || 0;
                          }
                          // Last resort: for existing credits without initialOriginalAmount, 
                          // if originalAmount hasn't changed from initial, use it
                          // Otherwise, we'd need to fetch from PO (expensive)
                          else {
                            // For credits that already exist in DB, use initialOriginalAmount if available
                            // Otherwise, we can't determine the initial amount without fetching PO
                            // So we'll show originalAmount as a fallback (this is not ideal but necessary)
                            initialAmount = credit.initialOriginalAmount ?? credit.originalAmount ?? 0;
                          }

                          return `₹${Math.round(initialAmount)}`;
                        })()}
                      </TableCell>
                      <TableCell className="font-medium">
                        {(() => {
                          // Current Amount shows the edited/updated amount (originalAmount)
                          const currentAmount = credit.originalAmount || 0;
                          return `₹${Math.round(currentAmount)}`;
                        })()}
                      </TableCell>
                      <TableCell className="min-w-[140px] max-w-[220px] align-top text-left">
                        <div className="font-semibold text-sm">
                          ₹{Math.round(credit.paidAmount || 0)}
                        </div>
                        {paymentRows.length > 0 ? (
                          <div className="mt-1.5 space-y-1 max-h-28 overflow-y-auto text-[11px] leading-snug text-muted-foreground border-t border-border pt-1.5">
                            {paymentRows.map((p, pIdx) => {
                              const mode = (p.paymentMode || p.payment_mode || "cash").toString().toUpperCase();
                              const when = p.paymentDate || p.createdAt;
                              return (
                                <div
                                  key={p._id ?? p.id ?? pIdx}
                                  className="rounded border border-blue-100 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/20 px-1.5 py-1"
                                >
                                  <span className="font-medium text-foreground">
                                    ₹{Math.round(Number(p.amount ?? 0))}
                                  </span>
                                  <span className="text-muted-foreground"> · {mode}</span>
                                  {when ? (
                                    <div className="text-[10px] opacity-90">
                                      {format(new Date(when), "dd-MM-yyyy HH:mm")}
                                    </div>
                                  ) : null}
                                  {p.notes && String(p.notes).trim() ? (
                                    <div className="text-[10px] italic truncate" title={String(p.notes).trim()}>
                                      {String(p.notes).trim()}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : Number(credit.paidAmount) > 0 ? (
                          <p className="text-[10px] text-muted-foreground mt-1 italic">No per-payment log</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-semibold text-blue-600">
                        ₹{Math.round(credit.balanceAmount || 0)}
                      </TableCell>
                      <TableCell>{getStatusBadge(credit.status)}</TableCell>
                      <TableCell>
                        {(() => {
                          // Calculate initial amount using the same logic as Initial Amount column
                          let initialAmount = 0;
                          if (credit.initialOriginalAmount !== undefined && credit.initialOriginalAmount !== null && credit.initialOriginalAmount !== 0) {
                            initialAmount = credit.initialOriginalAmount;
                          } else if (credit.purchaseOrder?.total !== undefined && credit.purchaseOrder?.total !== null && credit.purchaseOrder?.total !== 0) {
                            initialAmount = credit.purchaseOrder.total;
                          } else if (credit.isPOCredit && credit.purchaseOrderId) {
                            initialAmount = credit.originalAmount || 0;
                          } else {
                            initialAmount = credit.initialOriginalAmount ?? credit.originalAmount ?? 0;
                          }

                          const currentAmount = credit.originalAmount || 0;
                          const hasChanged = Math.abs(initialAmount - currentAmount) > 0.01;
                          const hasHistory = credit.amountChangeHistory && credit.amountChangeHistory.length > 0;

                          if (!hasChanged && !hasHistory) {
                            return <span className="text-muted-foreground text-sm">No changes</span>;
                          }

                          return (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-1 text-xs text-blue-600 hover:text-blue-700"
                              onClick={() => {
                                setSelectedCreditForChanges(credit);
                                setChangesDialogOpen(true);
                              }}
                              title="View all changes"
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              View Changes
                            </Button>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {creditTypeFilter === "billing" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleBillingCreditPrint(credit)}
                              disabled={printingCreditId === credit._id}
                              className="border-blue-200 text-blue-600 hover:bg-blue-50"
                            >
                              <Printer className="h-4 w-4 mr-1" />
                              {printingCreditId === credit._id ? "Printing..." : "Print"}
                            </Button>
                          )}
                          {creditTypeFilter === "billing" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openBillingCreditDetail(credit)}
                              className="border-amber-200 text-amber-700 hover:bg-amber-50"
                              title="View/Edit items and prices"
                            >
                              A4 print
                            </Button>
                          )}
                          {credit.status !== "paid" && (credit.balanceAmount || 0) > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditAmountClick(credit)}
                              title="Edit Original Amount"
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          )}
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handlePaymentClick(credit)}
                            disabled={credit.status === "paid" || (credit.balanceAmount || 0) <= 0}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            Payment
                          </Button>
                          {creditTypeFilter === "billing" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleHideCredit(credit)}
                              className="border-gray-300 text-gray-600 hover:bg-gray-50"
                              title="Hide this bill from the list"
                            >
                              <EyeOff className="h-4 w-4 mr-1" />
                              Hide
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to{" "}
                {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of{" "}
                {pagination.totalItems} credits
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }));
                  }}
                  disabled={pagination.currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }));
                  }}
                  disabled={pagination.currentPage === pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedCredits.length > 1 ? `Add Payment (${selectedCredits.length} Credits)` : "Add Payment"}
            </DialogTitle>
          </DialogHeader>
          {selectedCredits.length > 0 && (
            <div className="space-y-4">
              {/* Selected Credits Summary */}
              {selectedCredits.length > 1 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 mb-2">
                    Selected Credits: {selectedCredits.length}
                  </p>
                  <p className="text-lg font-bold text-blue-700">
                    Total Balance: ₹{Math.round(selectedCredits.reduce((sum, c) => sum + (c.balanceAmount || 0), 0))}
                  </p>
                </div>
              )}

              {/* Credit Details */}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedCredits.map((credit, index) => (
                  <div key={credit._id || index} className="grid grid-cols-2 gap-4 p-3 bg-muted rounded-lg">
                    {creditTypeFilter === "po" ? (
                      <>
                        <div>
                          <Label className="text-xs text-muted-foreground">PO Number</Label>
                          <p className="font-medium text-sm">{credit.poNumber || credit.purchaseOrder?.poNumber || credit.po_number || 'N/A'}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Supplier</Label>
                          <p className="font-medium text-sm">{credit.supplierName || credit.supplier?.companyName || 'N/A'}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <Label className="text-xs text-muted-foreground">Bill Number</Label>
                          <p className="font-medium text-sm">{credit.billNumber || 'N/A'}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Customer</Label>
                          <p className="font-medium text-sm">{credit.customerName || 'N/A'}</p>
                        </div>
                      </>
                    )}
                    <div>
                      <Label className="text-xs text-muted-foreground">Balance Amount</Label>
                      <p className="font-medium text-sm text-blue-600">
                        ₹{Math.round(credit.balanceAmount || 0)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Original Amount</Label>
                      <p className="font-medium text-sm">₹{Math.round(credit.originalAmount || 0)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <Label htmlFor="paymentAmount">Payment Amount *</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  step="1"
                  min="1"
                  max={Math.round(selectedCredits.reduce((sum, c) => sum + (c.balanceAmount || 0), 0))}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Enter payment amount"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum: ₹{Math.round(selectedCredits.reduce((sum, c) => sum + (c.balanceAmount || 0), 0))}
                </p>
              </div>

              <div>
                <Label htmlFor="paymentMode">Payment Mode *</Label>
                <Select value={paymentMode} onValueChange={setPaymentMode}>
                  <SelectTrigger id="paymentMode">
                    <SelectValue placeholder="Select payment mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="paymentNotes">Notes (Optional)</Label>
                <Textarea
                  id="paymentNotes"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Add payment notes..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setPaymentDialogOpen(false);
              setSelectedCredits([]);
            }}>
              Cancel
            </Button>
            <Button onClick={handlePaymentSubmit}>
              <Save className="h-4 w-4 mr-1" />
              Save Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Billing Credit Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="inset-0 left-0 top-0 translate-x-0 translate-y-0 w-screen max-w-none h-screen max-h-none rounded-none p-0 gap-0 sm:max-w-none sm:w-screen sm:h-screen sm:rounded-none sm:p-0">
          <DialogHeader>
            <div className="px-6 py-4 border-b bg-background sticky top-0 z-10">
              <DialogTitle>Bill Credit Details</DialogTitle>
            </div>
          </DialogHeader>
          {detailLoading ? (
            <div className="py-10 text-center text-muted-foreground">Loading bill items...</div>
          ) : (
            <>
              <div className="h-[calc(100vh-140px)] overflow-y-auto px-6 py-4 space-y-4">
              <div className="rounded-lg border bg-card">
                <div className="border-b px-4 py-3">
                  <h3 className="text-sm font-semibold">Bill Header</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 p-4 bg-muted/40">
                <div>
                  <Label className="text-xs text-muted-foreground">Store</Label>
                  <p className="font-medium">{selectedStore?.name || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">State Code</Label>
                  <p className="font-medium">
                    {selectedStore?.stateCode || selectedStore?.addressStateCode || "33"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Place Of Supply</Label>
                  <p className="font-medium">
                    {selectedStore?.placeOfSupply || selectedStore?.addressState || selectedStore?.address?.state || "TamilNadu"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Bill Number</Label>
                  <p className="font-medium">{detailBill?.billNo || detailBill?.billNumber || selectedCredit?.billNumber || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Bill Date</Label>
                  <p className="font-medium">
                    {detailBill?.date ? format(new Date(detailBill.date), "dd-MM-yyyy") : "N/A"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Invoice Type</Label>
                  <p className="font-medium">{selectedCredit?.invoiceType || "GST Invoice"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Customer</Label>
                  <p className="font-medium">{selectedCredit?.customerName || detailBill?.customerName || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Customer Phone</Label>
                  <p className="font-medium">{selectedCredit?.customerPhone || detailBill?.customerPhone || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Customer GSTIN</Label>
                  <p className="font-medium">{selectedCredit?.customerGstin || detailBill?.customerGstin || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Payment Method</Label>
                  <p className="font-medium uppercase">{detailBill?.paymentMethod || "N/A"}</p>
                </div>
                <div className="md:col-span-2 xl:col-span-5">
                  <Label className="text-xs text-muted-foreground">Customer Address</Label>
                  <p className="font-medium break-words">
                    {selectedCredit?.customerAddress || detailBill?.customerAddress || "N/A"}
                  </p>
                </div>
              </div>
              </div>

              {selectedCredit &&
                (() => {
                  const payRows = getSortedPaymentHistory(selectedCredit);
                  return (
                    <div className="rounded-lg border bg-card">
                      <div className="border-b px-4 py-3">
                        <h3 className="text-sm font-semibold">Payment history</h3>
                      </div>
                      <div className="p-4">
                        <p className="text-sm mb-3">
                          <span className="text-muted-foreground">Total paid: </span>
                          <span className="font-semibold">₹{Math.round(selectedCredit.paidAmount || 0)}</span>
                          <span className="text-muted-foreground"> · Balance: </span>
                          <span className="font-semibold text-blue-600">
                            ₹{Math.round(selectedCredit.balanceAmount || 0)}
                          </span>
                        </p>
                        {payRows.length > 0 ? (
                          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {payRows.map((p, pIdx) => {
                              const mode = (p.paymentMode || p.payment_mode || "cash").toString().toUpperCase();
                              const when = p.paymentDate || p.createdAt;
                              const collector = p.collectedBy
                                ? [p.collectedBy.firstName, p.collectedBy.lastName].filter(Boolean).join(" ").trim()
                                : "";
                              return (
                                <div
                                  key={p._id ?? p.id ?? pIdx}
                                  className="text-sm border-l-4 border-blue-500 pl-3 py-2 bg-blue-50/80 dark:bg-blue-950/30 rounded-r"
                                >
                                  <div className="font-semibold text-blue-900 dark:text-blue-200">
                                    ₹{Math.round(Number(p.amount ?? 0))}{" "}
                                    <span className="text-xs font-normal text-muted-foreground">({mode})</span>
                                  </div>
                                  {when ? (
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                      {format(new Date(when), "dd-MM-yyyy HH:mm")}
                                    </div>
                                  ) : null}
                                  {collector ? (
                                    <div className="text-xs text-muted-foreground">by {collector}</div>
                                  ) : null}
                                  {p.notes && String(p.notes).trim() ? (
                                    <div className="text-xs italic text-muted-foreground mt-1 border-t border-blue-200/60 dark:border-blue-800 pt-1">
                                      {String(p.notes).trim()}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : Number(selectedCredit.paidAmount) > 0 ? (
                          <p className="text-xs text-muted-foreground italic">
                            Total paid is recorded but there is no per-payment log for this bill.
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">No payments recorded yet.</p>
                        )}
                      </div>
                    </div>
                  );
                })()}

              <div className="rounded-lg border bg-card">
                <div className="border-b px-4 py-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Items</h3>
                  <span className="text-xs text-muted-foreground">
                    {detailItems.length} {detailItems.length === 1 ? "item" : "items"}
                  </span>
                </div>
                <div className="space-y-3 p-3">
                {detailItems.map((it, idx) => (
                  <div key={it._key} className="rounded-lg border bg-background p-4 space-y-4">
                    <div className="rounded-md border bg-muted/30 overflow-hidden">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 px-4 py-2 text-[11px] font-medium text-muted-foreground border-b bg-muted/50">
                        <div className="whitespace-nowrap">Item Name</div>
                        <div className="whitespace-nowrap">Code</div>
                        <div className="whitespace-nowrap">Batch</div>
                        <div className="whitespace-nowrap">MRP</div>
                        <div className="text-right whitespace-nowrap">Line Total</div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 px-4 py-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Item #{idx + 1}</p>
                          <p className="font-semibold break-words">{it.itemName || "Item"}</p>
                        </div>
                        <div className="font-medium">{it.itemCode || "-"}</div>
                        <div className="font-medium">{it.batch || "-"}</div>
                        <div className="font-medium">{formatCurrency(it.mrp || 0)}</div>
                        <div className="font-semibold text-right">{formatCurrency(Number(it.total || 0))}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 rounded-md bg-muted/40 px-3 py-2 text-[11px] font-medium text-muted-foreground">
                      <div className="whitespace-nowrap">HSN/SAC</div>
                      <div className="whitespace-nowrap">Quantity</div>
                      <div className="whitespace-nowrap">GST %</div>
                      <div className="whitespace-nowrap">Price</div>
                      <div className="whitespace-nowrap">Discount</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                      <div className="space-y-1">
                        <Input
                          type="text"
                          value={it.hsnCode || ""}
                          onChange={(e) => handleDetailItemHsnChange(it._key, e.target.value)}
                          className="h-9"
                          placeholder="HSN"
                        />
                      </div>
                      <div className="space-y-1">
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          value={it.quantity}
                          onChange={(e) => handleDetailItemQtyChange(it._key, e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={it.taxRate}
                          onChange={(e) => handleDetailItemGstChange(it._key, e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={it.unitPrice}
                          onChange={(e) => handleDetailItemPriceChange(it._key, e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="h-9 rounded-md border bg-muted px-3 flex items-center justify-end text-sm">
                          {formatCurrency(it.discount || 0)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 rounded-md bg-muted/40 px-3 py-2 text-[11px] font-medium text-muted-foreground">
                      <div className="whitespace-nowrap">Sub Total</div>
                      <div className="whitespace-nowrap">GST Amount</div>
                      <div className="whitespace-nowrap">MRP</div>
                      <div className="whitespace-nowrap">Total</div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="rounded-md border bg-muted/40 p-3">
                        <div className="font-medium">{formatCurrency(it.subtotal || 0)}</div>
                      </div>
                      <div className="rounded-md border bg-muted/40 p-3">
                        <div className="font-medium">
                          {formatCurrency(((Number(it.subtotal || 0) - Number(it.discount || 0)) * Number(it.taxRate || 0)) / 100)}
                        </div>
                      </div>
                      <div className="rounded-md border bg-muted/40 p-3">
                        <div className="font-medium">{formatCurrency(it.mrp || 0)}</div>
                      </div>
                      <div className="rounded-md border bg-muted/40 p-3">
                        <div className="font-medium">{formatCurrency(Number(it.total || 0))}</div>
                      </div>
                    </div>
                  </div>
                ))}

                {detailItems.length === 0 && (
                  <div className="p-4 text-center text-muted-foreground">No items</div>
                )}
                </div>
              </div>

              {(() => {
                const { summary } = recalcDetailTotals(detailItems);
                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Notes</h3>
                      <Label className="mb-1 block">Notes (optional)</Label>
                      <Textarea
                        value={detailNotes}
                        onChange={(e) => setDetailNotes(e.target.value)}
                        rows={3}
                        placeholder="Add notes for this change..."
                      />
                    </div>
                    <div className="border rounded p-3 bg-card">
                      <h3 className="text-sm font-semibold mb-3">Amount Summary</h3>
                      <div className="flex justify-between py-1">
                        <span>Sub Total</span>
                        <strong>{formatCurrency(summary.subtotal)}</strong>
                      </div>
                      <div className="flex items-center justify-between py-1 gap-2">
                        <span>SGST % (apply to all)</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-8 w-24 text-right"
                          value={sgstRateGlobal}
                          onChange={(e) => {
                            const value = Number(e.target.value || 0);
                            setSgstRateGlobal(Number.isFinite(value) ? value : 0);
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between py-1 gap-2">
                        <span>CGST % (apply to all)</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-8 w-24 text-right"
                          value={cgstRateGlobal}
                          onChange={(e) => {
                            const value = Number(e.target.value || 0);
                            setCgstRateGlobal(Number.isFinite(value) ? value : 0);
                          }}
                        />
                      </div>
                      <div className="flex justify-between py-1">
                        <span>GST (items)</span>
                        <strong>{formatCurrency(summary.itemGst)}</strong>
                      </div>
                      <div className="flex justify-between py-1">
                        <span>SGST</span>
                        <strong>{formatCurrency(summary.sgstAmt)}</strong>
                      </div>
                      <div className="flex justify-between py-1">
                        <span>CGST</span>
                        <strong>{Number(cgstRateGlobal || 0) > 0 ? formatCurrency(summary.cgstAmt) : ""}</strong>
                      </div>
                      <div className="flex justify-between py-1">
                        <span>Total Tax</span>
                        <strong>{formatCurrency(summary.tax)}</strong>
                      </div>
                      <div className="flex justify-between py-1">
                        <span>Grand Total</span>
                        <strong>{formatCurrency(summary.grandTotal)}</strong>
                      </div>
                      <div className="flex justify-between py-1 text-blue-700">
                        <span>Rounded Net Amount</span>
                        <strong>{formatCurrency(summary.roundedTotal)}</strong>
                      </div>
                    </div>
                  </div>
                );
              })()}
              </div>
            </>
          )}
          <DialogFooter className="justify-between px-6 py-4 border-t bg-background">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
                Close
              </Button>
            </div>
            <div className="flex gap-2">
              {selectedCredit && creditTypeFilter === "billing" && (
                <>
                  <Button variant="secondary" onClick={() => handleSaveDetail(selectedCredit)}>
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  <Button onClick={() => handleSaveDetailAndPrint(selectedCredit)}>
                    <Save className="h-4 w-4 mr-1" />
                    Save & Print
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Amount Dialog */}
      <Dialog open={editAmountDialogOpen} onOpenChange={setEditAmountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Original Amount</DialogTitle>
          </DialogHeader>
          {selectedCredit && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <Label className="text-xs text-muted-foreground">PO Number</Label>
                  <p className="font-medium">{selectedCredit.poNumber}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Supplier</Label>
                  <p className="font-medium">{selectedCredit.supplierName || selectedCredit.supplier?.companyName || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Initial Amount</Label>
                  <p className="font-medium">
                    ₹{Math.round(selectedCredit.initialOriginalAmount || selectedCredit.originalAmount || 0)}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Current Amount</Label>
                  <p className="font-medium text-blue-600">
                    ₹{Math.round(selectedCredit.originalAmount || 0)}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Paid Amount</Label>
                  <p className="font-medium">₹{Math.round(selectedCredit.paidAmount || 0)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Current Balance</Label>
                  <p className="font-medium">₹{Math.round(selectedCredit.balanceAmount || 0)}</p>
                </div>
              </div>

              <div>
                <Label htmlFor="newAmount">New Original Amount *</Label>
                <Input
                  id="newAmount"
                  type="number"
                  step="1"
                  min="0"
                  max={Math.round(selectedCredit.originalAmount || 0)}
                  value={newOriginalAmount}
                  onChange={(e) => {
                    const value = e.target.value;
                    const numValue = parseFloat(value);
                    const currentAmount = parseFloat(selectedCredit.originalAmount || 0);
                    // Prevent entering value greater than current amount
                    if (value === '' || (!isNaN(numValue) && numValue <= currentAmount)) {
                      setNewOriginalAmount(value);
                    }
                  }}
                  placeholder="Enter new original amount"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Current: ₹{Math.round(selectedCredit.originalAmount || 0)}
                  {selectedCredit.initialOriginalAmount && selectedCredit.initialOriginalAmount !== selectedCredit.originalAmount && (
                    <span className="ml-2"> | Initial: ₹{Math.round(selectedCredit.initialOriginalAmount)}</span>
                  )}
                  <span className="ml-2 text-orange-600"> | Maximum: ₹{Math.round(selectedCredit.originalAmount || 0)}</span>
                </p>
              </div>

              <div>
                <Label htmlFor="amountChangeNotes">Notes (Optional)</Label>
                <Textarea
                  id="amountChangeNotes"
                  value={amountChangeNotes}
                  onChange={(e) => setAmountChangeNotes(e.target.value)}
                  placeholder="Add notes about this amount change..."
                  rows={3}
                />
              </div>

              {/* Amount Change History */}
              {selectedCredit.amountChangeHistory && selectedCredit.amountChangeHistory.length > 0 && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <Label className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-3 block">
                    Amount Change History
                  </Label>
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {selectedCredit.amountChangeHistory.map((change, index) => (
                      <div key={index} className="text-sm border-l-4 border-blue-500 pl-3 py-1 bg-white dark:bg-gray-800 rounded">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          ₹{Math.round(change.previousAmount || 0)} → ₹{Math.round(change.updatedAmount || 0)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {change.changeDate ? format(new Date(change.changeDate), "dd-MM-yyyy HH:mm") : ""}
                          {change.changedBy && ` by ${change.changedBy.firstName} ${change.changedBy.lastName}`}
                        </p>
                        {change.notes && (
                          <p className="text-xs text-muted-foreground italic mt-1">{change.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(() => {
                const payRows = getSortedPaymentHistory(selectedCredit);
                if (payRows.length === 0 && !(Number(selectedCredit.paidAmount) > 0)) return null;
                return (
                  <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <Label className="text-sm font-semibold text-emerald-800 dark:text-emerald-200 mb-2 block">
                      Payment history (₹{Math.round(selectedCredit.paidAmount || 0)} total)
                    </Label>
                    {payRows.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {payRows.map((p, pIdx) => {
                          const mode = (p.paymentMode || p.payment_mode || "cash").toString().toUpperCase();
                          const when = p.paymentDate || p.createdAt;
                          const collector = p.collectedBy
                            ? [p.collectedBy.firstName, p.collectedBy.lastName].filter(Boolean).join(" ").trim()
                            : "";
                          return (
                            <div
                              key={p._id ?? p.id ?? pIdx}
                              className="text-sm border-l-4 border-emerald-600 pl-3 py-1.5 bg-white dark:bg-gray-900 rounded"
                            >
                              <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                                ₹{Math.round(Number(p.amount ?? 0))}{" "}
                                <span className="text-xs font-normal text-muted-foreground">({mode})</span>
                              </p>
                              {when ? (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {format(new Date(when), "dd-MM-yyyy HH:mm")}
                                  {collector ? ` · ${collector}` : ""}
                                </p>
                              ) : null}
                              {p.notes && String(p.notes).trim() ? (
                                <p className="text-xs text-muted-foreground italic mt-1">{String(p.notes).trim()}</p>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        Paid total is on file but individual instalments were not logged.
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAmountDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAmountUpdate}>
              <Save className="h-4 w-4 mr-1" />
              Update Amount
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Changes History Dialog */}
      <Dialog open={changesDialogOpen} onOpenChange={setChangesDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Credit history</DialogTitle>
            <p className="text-sm text-muted-foreground font-normal">
              Amount changes and payment instalments for this credit
            </p>
          </DialogHeader>
          {selectedCreditForChanges && (() => {
            // Calculate initial amount
            let initialAmount = 0;
            if (selectedCreditForChanges.initialOriginalAmount !== undefined && selectedCreditForChanges.initialOriginalAmount !== null && selectedCreditForChanges.initialOriginalAmount !== 0) {
              initialAmount = selectedCreditForChanges.initialOriginalAmount;
            } else if (selectedCreditForChanges.purchaseOrder?.total !== undefined && selectedCreditForChanges.purchaseOrder?.total !== null && selectedCreditForChanges.purchaseOrder?.total !== 0) {
              initialAmount = selectedCreditForChanges.purchaseOrder.total;
            } else if (selectedCreditForChanges.isPOCredit && selectedCreditForChanges.purchaseOrderId) {
              initialAmount = selectedCreditForChanges.originalAmount || 0;
            } else {
              initialAmount = selectedCreditForChanges.initialOriginalAmount ?? selectedCreditForChanges.originalAmount ?? 0;
            }

            const currentAmount = selectedCreditForChanges.originalAmount || 0;
            const hasChanged = Math.abs(initialAmount - currentAmount) > 0.01;
            const hasHistory = selectedCreditForChanges.amountChangeHistory && selectedCreditForChanges.amountChangeHistory.length > 0;

            // Debug: Log what we have
            console.log('Changes Dialog - Credit Data:', {
              poNumber: selectedCreditForChanges.poNumber,
              initialAmount,
              currentAmount,
              hasChanged,
              hasHistory,
              historyCount: selectedCreditForChanges.amountChangeHistory?.length || 0,
              history: selectedCreditForChanges.amountChangeHistory,
              fullCredit: selectedCreditForChanges
            });

            // Build complete change timeline
            const allChanges = [];
            let changeCounter = 0;

            // Add initial amount as starting point
            allChanges.push({
              type: 'initial',
              amount: initialAmount,
              label: 'Initial Amount',
              date: selectedCreditForChanges.orderDate || selectedCreditForChanges.createdAt,
              isInitial: true
            });

            // Add all historical changes, sorted by date
            if (hasHistory) {
              const sortedHistory = [...selectedCreditForChanges.amountChangeHistory].sort((a, b) => {
                const dateA = a.changeDate ? new Date(a.changeDate).getTime() : 0;
                const dateB = b.changeDate ? new Date(b.changeDate).getTime() : 0;
                return dateA - dateB;
              });

              sortedHistory.forEach((change) => {
                changeCounter++;
                allChanges.push({
                  type: 'change',
                  previousAmount: change.previousAmount || 0,
                  updatedAmount: change.updatedAmount || 0,
                  date: change.changeDate,
                  changedBy: change.changedBy,
                  notes: change.notes,
                  changeNumber: changeCounter
                });
              });
            }

            // If there's a change but no history, create a change entry from initial to current
            if (hasChanged && !hasHistory) {
              changeCounter++;
              allChanges.push({
                type: 'change',
                previousAmount: initialAmount,
                updatedAmount: currentAmount,
                date: selectedCreditForChanges.updatedAt || new Date().toISOString(),
                changedBy: selectedCreditForChanges.updatedBy || null,
                notes: 'Amount changed (detailed history not available)',
                changeNumber: changeCounter
              });
            }

            // Always show current amount if it's different from initial
            const lastChangeAmount = allChanges.length > 1
              ? allChanges[allChanges.length - 1].updatedAmount || allChanges[allChanges.length - 1].amount
              : initialAmount;

            // Only add current if it's different from the last entry
            if (Math.abs(currentAmount - lastChangeAmount) > 0.01) {
              allChanges.push({
                type: 'current',
                amount: currentAmount,
                label: 'Current Amount',
                isCurrent: true
              });
            }

            return (
              <div className="space-y-4">
                {/* Credit Info */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  {creditTypeFilter === "po" ? (
                    <>
                      <div>
                        <Label className="text-xs text-muted-foreground">PO Number</Label>
                        <p className="font-medium">{selectedCreditForChanges.poNumber || selectedCreditForChanges.purchaseOrder?.poNumber || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Supplier</Label>
                        <p className="font-medium">{selectedCreditForChanges.supplierName || selectedCreditForChanges.supplier?.companyName || 'N/A'}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <Label className="text-xs text-muted-foreground">Bill Number</Label>
                        <p className="font-medium">{selectedCreditForChanges.billNumber || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Customer</Label>
                        <p className="font-medium">{selectedCreditForChanges.customerName || 'N/A'}</p>
                      </div>
                    </>
                  )}
                </div>

                {/* All Changes Timeline */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Complete Change Timeline</h4>
                  {allChanges.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No changes recorded</p>
                  ) : (
                    <div className="space-y-3">
                      {allChanges.map((changeItem, index) => {
                        if (changeItem.type === 'initial') {
                          return (
                            <div key={`initial-${index}`} className="p-3 border-l-4 border-green-500 bg-green-50 dark:bg-green-950/20 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-semibold text-green-700 dark:text-green-300">
                                    Initial Amount: ₹{Math.round(changeItem.amount)}
                                  </div>
                                  {changeItem.date && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {format(new Date(changeItem.date), "dd-MM-yyyy")}
                                    </div>
                                  )}
                                </div>
                                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                                  Initial
                                </Badge>
                              </div>
                            </div>
                          );
                        } else if (changeItem.type === 'change') {
                          const amountDifference = changeItem.updatedAmount - changeItem.previousAmount;
                          const isIncrease = amountDifference > 0;

                          return (
                            <div key={`change-${index}`} className="p-4 border-l-4 border-orange-400 bg-orange-50 dark:bg-orange-950/20 rounded-lg shadow-sm">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
                                      ₹{Math.round(changeItem.previousAmount)} → ₹{Math.round(changeItem.updatedAmount)}
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className={`${isIncrease ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300'}`}
                                    >
                                      {isIncrease ? '+' : ''}₹{Math.round(Math.abs(amountDifference))}
                                    </Badge>
                                  </div>
                                  <div className="grid grid-cols-1 gap-2 text-sm">
                                    {changeItem.date && (
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-gray-700 dark:text-gray-300 min-w-[80px]">Date & Time:</span>
                                        <span className="text-gray-600 dark:text-gray-400">
                                          {format(new Date(changeItem.date), "dd-MM-yyyy HH:mm:ss")}
                                        </span>
                                      </div>
                                    )}
                                    {changeItem.changedBy ? (
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-gray-700 dark:text-gray-300 min-w-[80px]">Changed by:</span>
                                        <span className="text-gray-600 dark:text-gray-400">
                                          {changeItem.changedBy.firstName} {changeItem.changedBy.lastName}
                                          {changeItem.changedBy.email && ` (${changeItem.changedBy.email})`}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-gray-700 dark:text-gray-300 min-w-[80px]">Changed by:</span>
                                        <span className="text-gray-500 italic">Unknown</span>
                                      </div>
                                    )}
                                    {changeItem.notes && (
                                      <div className="mt-2 p-3 bg-white dark:bg-gray-800 rounded border border-orange-200 dark:border-orange-800">
                                        <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Notes:</div>
                                        <div className="text-gray-600 dark:text-gray-400">{changeItem.notes}</div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 shrink-0">
                                  Change #{changeItem.changeNumber}
                                </Badge>
                              </div>
                            </div>
                          );
                        } else if (changeItem.type === 'current') {
                          return (
                            <div key={`current-${index}`} className="p-3 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-semibold text-blue-600 dark:text-blue-400">
                                    Current Amount: ₹{Math.round(changeItem.amount)}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Latest amount
                                  </div>
                                </div>
                                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                                  Current
                                </Badge>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-2 border-t border-border">
                  <h4 className="font-semibold text-sm">Payment instalments</h4>
                  {(() => {
                    const pr = getSortedPaymentHistory(selectedCreditForChanges);
                    if (pr.length === 0 && !(Number(selectedCreditForChanges.paidAmount) > 0)) {
                      return <p className="text-muted-foreground text-sm">No payments recorded</p>;
                    }
                    if (pr.length === 0) {
                      return (
                        <p className="text-muted-foreground text-sm italic">
                          Total paid ₹{Math.round(selectedCreditForChanges.paidAmount || 0)} — no per-payment log.
                        </p>
                      );
                    }
                    return (
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        <p className="text-xs text-muted-foreground">
                          Total paid:{" "}
                          <span className="font-semibold text-foreground">
                            ₹{Math.round(selectedCreditForChanges.paidAmount || 0)}
                          </span>
                        </p>
                        {pr.map((p, pIdx) => {
                          const mode = (p.paymentMode || p.payment_mode || "cash").toString().toUpperCase();
                          const when = p.paymentDate || p.createdAt;
                          const collector = p.collectedBy
                            ? [p.collectedBy.firstName, p.collectedBy.lastName].filter(Boolean).join(" ").trim()
                            : "";
                          return (
                            <div
                              key={p._id ?? p.id ?? pIdx}
                              className="p-3 border-l-4 border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/25 rounded-lg text-sm"
                            >
                              <div className="font-semibold">
                                ₹{Math.round(Number(p.amount ?? 0))}{" "}
                                <span className="text-xs font-normal text-muted-foreground">({mode})</span>
                              </div>
                              {when ? (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {format(new Date(when), "dd-MM-yyyy HH:mm:ss")}
                                  {collector ? ` · ${collector}` : ""}
                                </div>
                              ) : null}
                              {p.notes && String(p.notes).trim() ? (
                                <div className="text-xs text-muted-foreground mt-2 pt-2 border-t border-emerald-200/70 dark:border-emerald-800">
                                  {String(p.notes).trim()}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangesDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Credits;

