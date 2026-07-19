import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Truck,
  Store,
  Mail,
  Phone,
  MapPin,
  User,
  Building2,
  Check,
  X,
  Save,
  ArrowLeft
} from "lucide-react";
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
import { suppliersAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

const getStoreIdValue = (store) => {
  if (!store || typeof store !== "object") {
    return null;
  }

  const rawId =
    store._id ??
    store.id ??
    store.storeId ??
    store.store_id ??
    store.storeCode ??
    store.code ??
    null;

  if (rawId === null || rawId === undefined || rawId === "") {
    return null;
  }

  return String(rawId);
};

const normalizeStoreIdForApi = (value) => {
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }
  return value;
};

const extractStoreIdsFromSupplier = (supplier) => {
  if (!supplier) {
    return [];
  }

  // First check if store_id is directly set (from Suppliers table)
  if (supplier.store_id) {
    return [String(supplier.store_id)];
  }

  // Fallback to stores array (from junction table)
  if (Array.isArray(supplier.stores) && supplier.stores.length > 0) {
    return supplier.stores
      .map((entry) => {
        const store = entry?.store ?? entry;
        return getStoreIdValue(store);
      })
      .filter(Boolean);
  }

  return [];
};

/** Tab order for Add/Edit supplier form — Enter moves to the next focusable field. */
const SUPPLIER_FORM_FIELD_IDS = [
  "companyName",
  "email",
  "firstName",
  "lastName",
  "designation",
  "primaryPhone",
  "secondaryPhone",
  "street",
  "city",
  "state",
  "zipCode",
  "gstNumber",
  "panNumber",
  "accountNumber",
  "bankName",
  "branch",
  "ifscCode",
  "creditLimit",
  "paymentTerms",
  "notes",
];

const focusNextSupplierFormField = (currentId) => {
  const i = SUPPLIER_FORM_FIELD_IDS.indexOf(currentId);
  if (i < 0) return;
  if (i >= SUPPLIER_FORM_FIELD_IDS.length - 1) {
    document.getElementById("supplierFormSubmit")?.focus();
    return;
  }
  document.getElementById(SUPPLIER_FORM_FIELD_IDS[i + 1])?.focus();
};

const supplierFieldEnterKeyDown = (e, fieldId) => {
  if (e.key !== "Enter") return;
  if (e.nativeEvent?.isComposing) return;
  e.preventDefault();
  focusNextSupplierFormField(fieldId);
};

const Suppliers = () => {
  const { toast } = useToast();
  const { selectedStore } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [stores, setStores] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingSupplierId, setTogglingSupplierId] = useState(null);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [currentScreen, setCurrentScreen] = useState("list"); // 'list', 'supplier', 'stores'
  const [currentSupplier, setCurrentSupplier] = useState(null);
  const selectedStoreId = useMemo(
    () => selectedStore?._id ?? selectedStore?.id ?? selectedStore?.storeId ?? null,
    [selectedStore]
  );
  const selectedStoreIdString = useMemo(
    () =>
      selectedStoreId !== null && selectedStoreId !== undefined
        ? String(selectedStoreId)
        : null,
    [selectedStoreId]
  );
  const formStores = useMemo(
    () =>
      selectedStoreIdString
        ? stores.filter((store) => getStoreIdValue(store) === selectedStoreIdString)
        : [],
    [stores, selectedStoreIdString]
  );

  // Form data
  const [formData, setFormData] = useState({
    companyName: "",
    contactPerson: {
      firstName: "",
      lastName: "",
      designation: ""
    },
    email: "",
    phone: {
      primary: "",
      secondary: ""
    },
    address: {
      street: "",
      city: "",
      state: "",
      zipCode: "",
      country: "India"
    },
    gstNumber: "",
    panNumber: "",
    bankDetails: {
      accountNumber: "",
      bankName: "",
      branch: "",
      ifscCode: ""
    },
    creditLimit: "",
    paymentTerms: "",
    isActive: true,
    notes: ""
  });

  const [selectedStores, setSelectedStores] = useState([]);

  useEffect(() => {
    loadData();
  }, [selectedStoreId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [suppliersRes, storesRes] = await Promise.all([
        suppliersAPI.getSuppliers({
                    ...(selectedStoreId ? { storeId: selectedStoreId } : {}),
        }),
        suppliersAPI.getStores({ isActive: true })
      ]);
      
      const suppliersList = Array.isArray(suppliersRes?.data?.suppliers) ? suppliersRes.data.suppliers : [];
      const storesList = Array.isArray(storesRes) ? storesRes : [];
      
      console.log('[Suppliers] Loaded suppliers:', suppliersList.length);
      // Log stores for each supplier
      suppliersList.forEach(supplier => {
        if (supplier.stores && supplier.stores.length > 0) {
          console.log(`[Suppliers] Supplier ${supplier._id} (${supplier.companyName}) has ${supplier.stores.length} stores:`, 
            supplier.stores.map(s => ({
              storeId: s.store?.id || s.store_id,
              name: s.store?.name,
              code: s.store?.code
            }))
          );
        }
      });
      
      setSuppliers(suppliersList);
      setStores(storesList);
    } catch (error) {
      console.error('[Suppliers] Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load suppliers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSupplierStatus = async (supplier) => {
    const supplierId = supplier?._id ?? supplier?.id;
    if (!supplierId) return;

    setTogglingSupplierId(String(supplierId));
    try {
      const response = await suppliersAPI.toggleSupplierStatus(supplierId);
      const updatedSupplier = response?.data ?? {};
      const nextStatus = Boolean(updatedSupplier.isActive);

      setSuppliers((prev) =>
        prev.map((item) =>
          String(item._id ?? item.id) === String(supplierId)
            ? { ...item, isActive: nextStatus }
            : item
        )
      );

      toast({
        title: "Success",
        description: `Supplier ${nextStatus ? "activated" : "deactivated"} successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to update supplier status",
        variant: "destructive",
      });
    } finally {
      setTogglingSupplierId(null);
    }
  };

  const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];

  const filteredSuppliers = safeSuppliers.filter((supplier = {}) => {
    const companyName = supplier.companyName || "";
    const contactPerson = supplier.contactPerson || {};
    const email = supplier.email || "";
    const phone = supplier.phone || {};

    const matchesSearch = 
      companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contactPerson.firstName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (phone.primary || "").includes(searchTerm);
    
    const matchesStatus = 
      filterStatus === "all" || 
      (filterStatus === "active" && supplier.isActive) ||
      (filterStatus === "inactive" && !supplier.isActive);
    
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / PAGE_SIZE));
  const paginatedSuppliers = filteredSuppliers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Reset to page 1 when filters change
  const handleSearchChange = (val) => { setSearchTerm(val); setCurrentPage(1); };
  const handleFilterChange = (val) => { setFilterStatus(val); setCurrentPage(1); };

  const handleAddNew = () => {
    setEditingSupplier(null);
    setCurrentSupplier(null);
    setFormData({
      companyName: "",
      contactPerson: { firstName: "", lastName: "", designation: "" },
      email: "",
      phone: { primary: "", secondary: "" },
      address: { street: "", city: "", state: "", zipCode: "", country: "India" },
      gstNumber: "",
      panNumber: "",
      bankDetails: { accountNumber: "", bankName: "", branch: "", ifscCode: "" },
      creditLimit: "",
      paymentTerms: "",
      isActive: true,
      notes: ""
    });
    setSelectedStores(selectedStoreIdString ? [selectedStoreIdString] : []);
    setCurrentScreen("supplier");
  };

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    setCurrentSupplier(supplier);
    setFormData({
      companyName: supplier.companyName || "",
      contactPerson: supplier.contactPerson || { firstName: "", lastName: "", designation: "" },
      email: supplier.email || "",
      phone: supplier.phone || { primary: "", secondary: "" },
      address: supplier.address || { street: "", city: "", state: "", zipCode: "", country: "India" },
      gstNumber: supplier.gstNumber || "",
      panNumber: supplier.panNumber || "",
      bankDetails: supplier.bankDetails || { accountNumber: "", bankName: "", branch: "", ifscCode: "" },
      creditLimit: supplier.creditLimit || "",
      paymentTerms: supplier.paymentTerms || "",
      isActive: supplier.isActive !== undefined ? supplier.isActive : true,
      notes: supplier.notes || ""
    });
    // Set selected stores from the supplier
    const storeIds = extractStoreIdsFromSupplier(supplier);
    setSelectedStores(storeIds);
    setCurrentScreen("supplier");
  };

  const handleDelete = async (supplier) => {
    if (!confirm(`Are you sure you want to delete ${supplier.companyName}?`)) return;
    
    try {
      await suppliersAPI.deleteSupplier(supplier._id);
      toast({
        title: "Success",
        description: "Supplier deleted successfully",
      });
      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete supplier",
        variant: "destructive",
      });
    }
  };

  const handleSupplierSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      if (!selectedStoreIdString) {
        toast({
          title: "Store Required",
          description: "Please select a store before saving a supplier",
          variant: "destructive",
        });
        return;
      }

      const sanitizePayload = (payload) => {
        return Object.entries(payload).reduce((acc, [key, value]) => {
          if (value === undefined || value === null) {
            return acc;
          }

          if (typeof value === "string") {
            const trimmed = value.trim();
            if (trimmed.length === 0) {
              return acc;
            }
            acc[key] = trimmed;
            return acc;
          }

          acc[key] = value;
          return acc;
        }, {});
      };

      const contactFirstName = formData.contactPerson.firstName?.trim() || "";
      const contactLastName = formData.contactPerson.lastName?.trim() || "";
      const contactFullName = [contactFirstName, contactLastName].filter(Boolean).join(" ").trim();

      const payload = sanitizePayload({
        Suppliername: formData.companyName,
        Email: formData.email,
        Phone: formData.phone.primary,
        Contactperson1: contactFullName || undefined,
        CP1Designation: formData.contactPerson.designation,
        Address1: formData.address.street,
        Citycode: formData.address.city,
        State: formData.address.state,
        Pincode: formData.address.zipCode,
        Remarks: formData.notes,
        GSTNumber: formData.gstNumber,
        PANNumber: formData.panNumber,
        Creditterms: formData.creditLimit,
        Paymentofweek: formData.paymentTerms,
        isActive: formData.isActive ? 1 : 0,
      });

      const scopedStoreIds = [selectedStoreIdString];
      const primaryStoreId = normalizeStoreIdForApi(scopedStoreIds[0]);
      
      // Save supplier only under the currently selected store
      const normalizedStoreIds = scopedStoreIds
        .map(storeId => {
          const normalized = normalizeStoreIdForApi(storeId);
          // Ensure we have a valid number
          if (normalized !== null && normalized !== undefined) {
            const numValue = typeof normalized === 'string' ? Number(normalized) : normalized;
            if (!isNaN(numValue) && numValue > 0) {
              return numValue;
            }
          }
          return null;
        })
        .filter(storeId => storeId !== null && storeId !== undefined);
      
      console.log('[Suppliers] Selected stores (raw):', scopedStoreIds);
      console.log('[Suppliers] Normalized store IDs:', normalizedStoreIds);
      console.log('[Suppliers] Primary store ID to save:', primaryStoreId);
      
      const finalPayload = {
        ...payload,
        ...(primaryStoreId && { store_id: primaryStoreId }),
        // Always include stores array (even if empty) to ensure proper update
        stores: normalizedStoreIds
      };
      console.log('[Suppliers] Final payload with stores:', JSON.stringify(finalPayload, null, 2));

      if (editingSupplier) {
        // Update supplier with store_id
        console.log('[Suppliers] Updating supplier:', editingSupplier._id);
        const response = await suppliersAPI.updateSupplier(editingSupplier._id, finalPayload);
        console.log('[Suppliers] Update response:', response);
        console.log('[Suppliers] Response data stores:', response?.data?.stores);
        console.log('[Suppliers] Response data stores count:', response?.data?.stores?.length);
        if (response?.data?.stores) {
          console.log('[Suppliers] Stores in response:', response.data.stores.map(s => ({
            storeId: s.store?.id || s.store_id,
            name: s.store?.name,
            code: s.store?.code
          })));
        }
        toast({
          title: "Success",
          description: `Supplier updated successfully with ${normalizedStoreIds.length} store(s)`,
        });
      } else {
        // Create supplier with store_id
        console.log('[Suppliers] Creating supplier');
        const response = await suppliersAPI.createSupplier(finalPayload);
        console.log('[Suppliers] Create response:', response);
        toast({
          title: "Success",
          description: `Supplier created successfully with ${normalizedStoreIds.length} store(s)`,
        });
      }
      
      setCurrentScreen("list");
      // Reload data to show updated stores
      await loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to save supplier",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleStoreAssignment = (supplier) => {
    setCurrentSupplier(supplier);
    setCurrentScreen("stores");
  };

  const handleAddStoreToSupplier = async (storeId) => {
    if (!currentSupplier) return;
    const normalizedStoreId = normalizeStoreIdForApi(storeId);
    if (normalizedStoreId === null || normalizedStoreId === undefined || normalizedStoreId === "") {
      return;
    }
    
    try {
      const response = await suppliersAPI.addStoreToSupplier(currentSupplier._id, normalizedStoreId);
      toast({
        title: "Success",
        description: "Store added successfully",
      });
      // Update current supplier with fresh data
      setCurrentSupplier(response.data);
      // Reload suppliers list
      const suppliersRes = await suppliersAPI.getSuppliers({ limit: 100 });
      setSuppliers(suppliersRes.data.suppliers);
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to add store",
        variant: "destructive",
      });
    }
  };

  const handleRemoveStoreFromSupplier = async (storeId) => {
    if (!currentSupplier) return;
    const normalizedStoreId = normalizeStoreIdForApi(storeId);
    if (normalizedStoreId === null || normalizedStoreId === undefined || normalizedStoreId === "") {
      return;
    }
    
    try {
      const response = await suppliersAPI.removeStoreFromSupplier(currentSupplier._id, normalizedStoreId);
      toast({
        title: "Success",
        description: "Store removed successfully",
      });
      // Update current supplier with fresh data
      setCurrentSupplier(response.data);
      // Reload suppliers list
      const suppliersRes = await suppliersAPI.getSuppliers({ limit: 100 });
      setSuppliers(suppliersRes.data.suppliers);
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove store",
        variant: "destructive",
      });
    }
  };

  const isStoreAssigned = (storeId) => {
    if (!storeId || !Array.isArray(currentSupplier?.stores)) {
      return false;
    }

    return currentSupplier.stores.some((entry) => {
      const store = entry?.store ?? entry;
      const id = getStoreIdValue(store);
      return id === storeId;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading suppliers...</p>
        </div>
      </div>
    );
  }

  // Render different screens
  if (currentScreen === "supplier") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => setCurrentScreen("list")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to List
          </Button>
          <h1 className="text-3xl font-bold">
            {editingSupplier ? "Edit Supplier" : "Add New Supplier"}
          </h1>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSupplierSubmit} className="space-y-6">
              {/* Company Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Company Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="companyName">Company Name *</Label>
                    <Input
                      id="companyName"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      onKeyDown={(e) => supplierFieldEnterKeyDown(e, "companyName")}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      onKeyDown={(e) => supplierFieldEnterKeyDown(e, "email")}
                    />
                  </div>
                </div>
              </div>

              {/* Contact Person */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Contact Person
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={formData.contactPerson.firstName}
                      onChange={(e) => setFormData({
                        ...formData,
                        contactPerson: { ...formData.contactPerson, firstName: e.target.value }
                      })}
                      onKeyDown={(e) => supplierFieldEnterKeyDown(e, "firstName")}
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={formData.contactPerson.lastName}
                      onChange={(e) => setFormData({
                        ...formData,
                        contactPerson: { ...formData.contactPerson, lastName: e.target.value }
                      })}
                      onKeyDown={(e) => supplierFieldEnterKeyDown(e, "lastName")}
                    />
                  </div>
                  <div>
                    <Label htmlFor="designation">Designation</Label>
                    <Input
                      id="designation"
                      value={formData.contactPerson.designation}
                      onChange={(e) => setFormData({
                        ...formData,
                        contactPerson: { ...formData.contactPerson, designation: e.target.value }
                      })}
                      onKeyDown={(e) => supplierFieldEnterKeyDown(e, "designation")}
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Contact Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="primaryPhone">Primary Phone *</Label>
                    <Input
                      id="primaryPhone"
                      value={formData.phone.primary}
                      onChange={(e) => setFormData({
                        ...formData,
                        phone: { ...formData.phone, primary: e.target.value }
                      })}
                      onKeyDown={(e) => supplierFieldEnterKeyDown(e, "primaryPhone")}
                      placeholder="e.g., 9876543210"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Format: 10 digits, starting with 1-9 (no leading zeros)
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="secondaryPhone">Secondary Phone</Label>
                    <Input
                      id="secondaryPhone"
                      value={formData.phone.secondary}
                      onChange={(e) => setFormData({
                        ...formData,
                        phone: { ...formData.phone, secondary: e.target.value }
                      })}
                      onKeyDown={(e) => supplierFieldEnterKeyDown(e, "secondaryPhone")}
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Address
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="street">Street</Label>
                    <Input
                      id="street"
                      value={formData.address.street}
                      onChange={(e) => setFormData({
                        ...formData,
                        address: { ...formData.address, street: e.target.value }
                      })}
                      onKeyDown={(e) => supplierFieldEnterKeyDown(e, "street")}
                    />
                  </div>
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.address.city}
                      onChange={(e) => setFormData({
                        ...formData,
                        address: { ...formData.address, city: e.target.value }
                      })}
                      onKeyDown={(e) => supplierFieldEnterKeyDown(e, "city")}
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.address.state}
                      onChange={(e) => setFormData({
                        ...formData,
                        address: { ...formData.address, state: e.target.value }
                      })}
                      onKeyDown={(e) => supplierFieldEnterKeyDown(e, "state")}
                    />
                  </div>
                  <div>
                    <Label htmlFor="zipCode">Zip Code</Label>
                    <Input
                      id="zipCode"
                      value={formData.address.zipCode}
                      onChange={(e) => setFormData({
                        ...formData,
                        address: { ...formData.address, zipCode: e.target.value }
                      })}
                      onKeyDown={(e) => supplierFieldEnterKeyDown(e, "zipCode")}
                    />
                  </div>
                </div>
              </div>

              {/* Tax Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Tax Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="gstNumber">GST Number</Label>
                    <Input
                      id="gstNumber"
                      value={formData.gstNumber}
                      onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                      onKeyDown={(e) => supplierFieldEnterKeyDown(e, "gstNumber")}
                    />
                  </div>
                  <div>
                    <Label htmlFor="panNumber">PAN Number</Label>
                    <Input
                      id="panNumber"
                      value={formData.panNumber}
                      onChange={(e) => setFormData({ ...formData, panNumber: e.target.value })}
                      onKeyDown={(e) => supplierFieldEnterKeyDown(e, "panNumber")}
                    />
                  </div>
                </div>
              </div>

              {/* Banking Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Banking Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="accountNumber">Account Number</Label>
                    <Input
                      id="accountNumber"
                      value={formData.bankDetails.accountNumber}
                      onChange={(e) => setFormData({
                        ...formData,
                        bankDetails: { ...formData.bankDetails, accountNumber: e.target.value }
                      })}
                      onKeyDown={(e) => supplierFieldEnterKeyDown(e, "accountNumber")}
                    />
                  </div>
                  <div>
                    <Label htmlFor="bankName">Bank Name</Label>
                    <Input
                      id="bankName"
                      value={formData.bankDetails.bankName}
                      onChange={(e) => setFormData({
                        ...formData,
                        bankDetails: { ...formData.bankDetails, bankName: e.target.value }
                      })}
                      onKeyDown={(e) => supplierFieldEnterKeyDown(e, "bankName")}
                    />
                  </div>
                  <div>
                    <Label htmlFor="branch">Branch</Label>
                    <Input
                      id="branch"
                      value={formData.bankDetails.branch}
                      onChange={(e) => setFormData({
                        ...formData,
                        bankDetails: { ...formData.bankDetails, branch: e.target.value }
                      })}
                      onKeyDown={(e) => supplierFieldEnterKeyDown(e, "branch")}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ifscCode">IFSC Code</Label>
                    <Input
                      id="ifscCode"
                      value={formData.bankDetails.ifscCode}
                      onChange={(e) => setFormData({
                        ...formData,
                        bankDetails: { ...formData.bankDetails, ifscCode: e.target.value }
                      })}
                      onKeyDown={(e) => supplierFieldEnterKeyDown(e, "ifscCode")}
                    />
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Additional Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="creditLimit">Credit Limit (₹)</Label>
                    <Input
                      id="creditLimit"
                      type="number"
                      value={formData.creditLimit}
                      onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                      onKeyDown={(e) => supplierFieldEnterKeyDown(e, "creditLimit")}
                    />
                  </div>
                  <div>
                    <Label htmlFor="paymentTerms">Payment Terms</Label>
                    <Input
                      id="paymentTerms"
                      value={formData.paymentTerms}
                      onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                      onKeyDown={(e) => supplierFieldEnterKeyDown(e, "paymentTerms")}
                      placeholder="e.g., Net 30"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <textarea
                    id="notes"
                    className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.shiftKey) return;
                      if (e.key === "Enter") {
                        if (e.nativeEvent?.isComposing) return;
                        e.preventDefault();
                        focusNextSupplierFormField("notes");
                      }
                    }}
                    placeholder="Additional notes..."
                  />
                </div>
              </div>

              {/* Store Assignment */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  Assigned Store
                </h3>
                <div>
                  <Label>Current Store</Label>
                  <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border rounded-lg p-4">
                    {formStores.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No selected store available. Please choose a store first.
                      </p>
                    ) : (
                      formStores.map((store, index) => {
                        const storeIdValue = getStoreIdValue(store);
                        const storeKey = storeIdValue ?? `store-${index}`;
                        const checkboxId = `store-${storeKey}`;
                        const isChecked = storeIdValue === selectedStoreIdString;

                        return (
                          <div key={storeKey} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={checkboxId}
                              checked={isChecked}
                              readOnly
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                              disabled
                            />
                            <Label 
                              htmlFor={checkboxId}
                              className="flex items-center gap-2 flex-1"
                            >
                              <span className="font-medium">{store.name}</span>
                              <span className="text-sm text-muted-foreground">({store.code})</span>
                            </Label>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {selectedStoreIdString && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Supplier will be saved only for the currently selected store.
                    </p>
                  )}
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentScreen("list")}
                >
                  Cancel
                </Button>
                <Button id="supplierFormSubmit" type="submit" disabled={saving}>
                  {saving ? "Saving..." : editingSupplier ? "Update Supplier" : "Create Supplier"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentScreen === "stores") {
    const assignedStores = currentSupplier?.stores || [];
    const assignedStoreIds = assignedStores
      .map((assigned) => {
        const store = assigned?.store ?? assigned;
        return getStoreIdValue(store);
      })
      .filter(Boolean);

    const availableStores = stores.filter((store) => {
      const storeIdValue = getStoreIdValue(store);
      if (!storeIdValue) {
        return true;
      }
      return !assignedStoreIds.includes(storeIdValue);
    });

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => setCurrentScreen("list")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to List
          </Button>
          <h1 className="text-3xl font-bold">Store Assignment</h1>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Assigned Stores */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="h-5 w-5" />
                Assigned Stores ({assignedStores.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {assignedStores.map((storeItem, index) => {
                  const storeData = storeItem?.store ?? storeItem;
                  const storeIdValue = getStoreIdValue(storeData);
                  const storeKey = storeIdValue ?? `assigned-${index}`;

                  return (
                    <div
                      key={storeKey}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent"
                    >
                      <div>
                        <p className="font-medium">{storeData?.name}</p>
                        <p className="text-sm text-muted-foreground">{storeData?.code}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (!storeIdValue) return;
                          handleRemoveStoreFromSupplier(storeIdValue);
                        }}
                        disabled={!storeIdValue}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
                {assignedStores.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No stores assigned
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Available Stores */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Available Stores ({availableStores.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {availableStores.map((store, index) => {
                  const storeIdValue = getStoreIdValue(store);
                  const storeKey = storeIdValue ?? `available-${index}`;

                  return (
                    <div
                      key={storeKey}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent"
                    >
                      <div>
                        <p className="font-medium">{store.name}</p>
                        <p className="text-sm text-muted-foreground">{store.code}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!storeIdValue) return;
                          handleAddStoreToSupplier(storeIdValue);
                        }}
                        disabled={!storeIdValue}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
                {availableStores.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    All stores are assigned
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Main List View
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Supplier Master</h1>
          <p className="text-muted-foreground">
            Manage suppliers for {selectedStore?.name || "the selected store"}
          </p>
        </div>
        <Button onClick={handleAddNew}>
          <Plus className="mr-2 h-4 w-4" />
          Add Supplier
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap items-center">
            <Input
              placeholder="Search suppliers..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-64"
            />
            <Select value={filterStatus} onValueChange={handleFilterChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground ml-auto">
              {filteredSuppliers.length} supplier{filteredSuppliers.length !== 1 ? "s" : ""}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Suppliers Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>S.No.</TableHead>
                <TableHead>Company Name</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Stores</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <p className="text-muted-foreground">No suppliers found</p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedSuppliers.map((supplier, index) => (
                  <TableRow key={supplier._id}>
                    <TableCell className="text-muted-foreground">{(currentPage - 1) * PAGE_SIZE + index + 1}</TableCell>
                    <TableCell className="font-medium">{supplier.companyName}</TableCell>
                    <TableCell>
                      {supplier.contactPerson?.firstName} {supplier.contactPerson?.lastName}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        {supplier.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3" />
                        {supplier.phone?.primary}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(() => {
                          // Get all unique stores from both store_id and stores array
                          const storeMap = new Map();
                          
                          // First, add stores from the stores array (most reliable source)
                          if (Array.isArray(supplier.stores) && supplier.stores.length > 0) {
                            supplier.stores.forEach(entry => {
                              const store = entry?.store ?? entry;
                              const sId = getStoreIdValue(store);
                              if (sId) {
                                const storeIdStr = String(sId);
                                storeMap.set(storeIdStr, {
                                  name: store?.name || store?.storeName || 'Unknown Store',
                                  code: store?.code || store?.storeCode || ''
                                });
                              }
                            });
                          }
                          
                          // Then, add store from store_id if not already in map
                          if (supplier.store_id) {
                            const storeIdStr = String(supplier.store_id);
                            if (!storeMap.has(storeIdStr)) {
                              // Try to find it in the stores array
                              const primaryStore = stores.find(s => {
                                const sId = getStoreIdValue(s);
                                return sId && String(sId) === storeIdStr;
                              });
                              if (primaryStore) {
                                storeMap.set(storeIdStr, {
                                  name: primaryStore.name || 'Unknown Store',
                                  code: primaryStore.code || ''
                                });
                              } else {
                                // If not found in stores array, still add it with the ID
                                storeMap.set(storeIdStr, {
                                  name: `Store ${supplier.store_id}`,
                                  code: ''
                                });
                              }
                            }
                          }
                          
                          const storeList = Array.from(storeMap.values());
                          
                          if (storeList.length === 0) {
                            return <Badge variant="secondary">No stores</Badge>;
                          }
                          
                          return storeList.map((store, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {store.name}
                              {store.code && <span className="ml-1 text-muted-foreground">({store.code})</span>}
                            </Badge>
                          ));
                        })()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={supplier.isActive ? "default" : "secondary"}>
                        {supplier.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleSupplierStatus(supplier)}
                          disabled={togglingSupplierId === String(supplier._id ?? supplier.id)}
                        >
                          {supplier.isActive ? (
                            <X className="h-4 w-4" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(supplier)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStoreAssignment(supplier)}
                        >
                          <Store className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(supplier)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredSuppliers.length)} of {filteredSuppliers.length}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  «
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  ‹
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                  .reduce((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">…</span>
                    ) : (
                      <Button
                        key={item}
                        variant={currentPage === item ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(item)}
                        className="w-8"
                      >
                        {item}
                      </Button>
                    )
                  )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  ›
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  »
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Suppliers;

