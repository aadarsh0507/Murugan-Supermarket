import { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, Store, MapPin, Phone, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/Modal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { suppliersAPI } from "@/services/api";

  const normalizeStore = (store = {}) => {
  const address = store.address || {};
  const fallbackAddress = {
    street: store.addressStreet,
    city: store.addressCity,
    state: store.addressState,
    zipCode: store.addressZipCode,
  };

  const normalizedAddress = {
    street: address.street ?? fallbackAddress.street ?? "",
    city: address.city ?? fallbackAddress.city ?? "",
    state: address.state ?? fallbackAddress.state ?? "",
    zipCode: address.zipCode ?? fallbackAddress.zipCode ?? "",
  };

  const bankDetails = store.bankDetails || {};
  const normalizedBankDetails = {
    bankName: bankDetails.bankName ?? "",
    accountNumber: bankDetails.accountNumber ?? "",
    ifscCode: bankDetails.ifscCode ?? "",
    branchName: bankDetails.branchName ?? "",
  };

  const normalized = {
    ...store,
    id: store.id ?? store._id ?? null,
    name: store.name ?? "",
    code: store.code ?? store.storeCode ?? "",
    address: normalizedAddress,
    phone: store.phone ?? "",
    email: store.email ?? "",
    managerName: store.managerName ?? "",
    gstNumber: store.gstNumber ?? store.gst_number ?? store.gstin ?? "",
    bankDetails: normalizedBankDetails,
  };

  if (store.isActive !== undefined) {
    normalized.isActive = Boolean(store.isActive);
  } else if (store.is_active !== undefined) {
    normalized.isActive = Boolean(store.is_active);
  } else {
    normalized.isActive = true;
  }

  return normalized;
};

const Stores = () => {
  const { toast } = useToast();
  const [stores, setStores] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    address: {
      street: "",
      city: "",
      state: "",
      zipCode: "",
    },
    phone: "",
    email: "",
    managerName: "",
    gstNumber: "",
    bankDetails: {
      bankName: "",
      accountNumber: "",
      ifscCode: "",
      branchName: "",
    },
    isActive: true
  });

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    setLoading(true);
    try {
      const response = await suppliersAPI.getStores();
      const normalizedStores = Array.isArray(response)
        ? response.map(normalizeStore)
        : [];
      setStores(normalizedStores);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load stores",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredStores = (Array.isArray(stores) ? stores : []).filter((store) => {
    const name = store?.name ?? "";
    const code = store?.code ?? "";
    const city = store?.address?.city ?? "";

    const term = searchTerm.toLowerCase();

    return (
      name.toLowerCase().includes(term) ||
      code.toLowerCase().includes(term) ||
      city.toLowerCase().includes(term)
    );
  });

  const handleAddNew = () => {
    setEditingStore(null);
    setFormData({
      name: "",
      code: "",
      address: { street: "", city: "", state: "", zipCode: "" },
      phone: "",
      email: "",
      managerName: "",
      gstNumber: "",
      bankDetails: {
        bankName: "",
        accountNumber: "",
        ifscCode: "",
        branchName: "",
      },
      isActive: true
    });
    setIsModalOpen(true);
  };

  const handleEdit = (store) => {
    const normalizedStore = normalizeStore(store);
    setEditingStore(normalizedStore);
    setFormData({
      name: normalizedStore.name,
      code: normalizedStore.code,
      address: normalizedStore.address,
      phone: normalizedStore.phone,
      email: normalizedStore.email,
      managerName: normalizedStore.managerName,
      gstNumber: normalizedStore.gstNumber,
      bankDetails: normalizedStore.bankDetails,
      isActive: normalizedStore.isActive
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (store) => {
    if (!confirm(`Are you sure you want to delete ${store.name}?`)) return;

    try {
      await suppliersAPI.deleteStore(store.id ?? store._id);
      toast({
        title: "Success",
        description: "Store deleted successfully",
      });
      loadStores();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete store",
        variant: "destructive",
      });
    }
  };

  const normalizeTextValue = (value) => {
    if (value === undefined || value === null) {
      return null;
    }
    const trimmed = value.toString().trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const isEditing = Boolean(editingStore);
      // Clean up the data - remove empty strings and undefined values
      const cleanedData = {
        name: formData.name,
        isActive: formData.isActive,
        phone: normalizeTextValue(formData.phone),
        email: normalizeTextValue(formData.email),
        managerName: normalizeTextValue(formData.managerName),
        gstNumber: normalizeTextValue(formData.gstNumber)
      };

      if (!isEditing) {
        cleanedData.code = formData.code.toUpperCase();
      } else if (editingStore) {
        cleanedData.storeCode = editingStore.code ?? editingStore.storeCode ?? "";
      }

      const address = {
        street: normalizeTextValue(formData.address?.street),
        city: normalizeTextValue(formData.address?.city),
        state: normalizeTextValue(formData.address?.state),
        zipCode: normalizeTextValue(formData.address?.zipCode)
      };
      cleanedData.address = address;

      const bankDetails = {
        bankName: normalizeTextValue(formData.bankDetails?.bankName),
        accountNumber: normalizeTextValue(formData.bankDetails?.accountNumber),
        ifscCode: normalizeTextValue(formData.bankDetails?.ifscCode),
        branchName: normalizeTextValue(formData.bankDetails?.branchName)
      };
      cleanedData.bankDetails = bankDetails;

      if (editingStore) {
        await suppliersAPI.updateStore(editingStore.id ?? editingStore._id, cleanedData);
        toast({
          title: "Success",
          description: "Store updated successfully",
        });
      } else {
        await suppliersAPI.createStore(cleanedData);
        toast({
          title: "Success",
          description: "Store created successfully",
        });
      }

      setIsModalOpen(false);
      loadStores();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to save store",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading stores...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Store Management</h1>
          <p className="text-muted-foreground">
            Manage all your store locations
          </p>
        </div>
        <Button onClick={handleAddNew}>
          <Plus className="mr-2 h-4 w-4" />
          Add Store
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by store name, code, or city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stores Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Store Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <p className="text-muted-foreground">No stores found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredStores.map((store) => (
                  <TableRow key={store.id ?? store._id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <Store className="h-4 w-4" />
                      {store.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{store.code}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span>
                          {store.address?.city && store.address?.state
                            ? `${store.address.city}, ${store.address.state}`
                            : store.address?.city || store.address?.state || "N/A"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {store.phone ? (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {store.phone}
                        </div>
                      ) : (
                        <span className="inline-block min-h-[1rem]" />
                      )}
                    </TableCell>
                    <TableCell>
                      {store.email ? (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {store.email}
                        </div>
                      ) : (
                        <span className="inline-block min-h-[1rem]" />
                      )}
                    </TableCell>
                    <TableCell>
                      {store.managerName ? (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {store.managerName}
                        </div>
                      ) : (
                        <span className="inline-block min-h-[1rem]" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={store.isActive ? "default" : "secondary"}>
                        {store.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(store)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(store)}
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
        </CardContent>
      </Card>

      {/* Store Modal */}
      <Modal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        title={editingStore ? "Edit Store" : "Create New Store"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Store Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="code">Store Code *</Label>
            <Input
              id="code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="e.g., STORE001"
              required
              disabled={Boolean(editingStore)}
              readOnly={Boolean(editingStore)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {editingStore
                ? "Store code cannot be changed once created."
                : "Unique code for this store (will be auto-uppercased)"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="managerName">Manager Name</Label>
            <Input
              id="managerName"
              value={formData.managerName}
              onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="gstNumber">GSTIN</Label>
            <Input
              id="gstNumber"
              value={formData.gstNumber}
              onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
              placeholder="e.g., 33AABCU1234D1Z5"
              maxLength={15}
            />
            <p className="text-xs text-muted-foreground mt-1">
              GST Identification Number (15 characters)
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Bank Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bankName">Bank Name</Label>
                <Input
                  id="bankName"
                  value={formData.bankDetails.bankName}
                  onChange={(e) => setFormData({
                    ...formData,
                    bankDetails: { ...formData.bankDetails, bankName: e.target.value }
                  })}
                  placeholder="e.g., State Bank of India"
                />
              </div>
              <div>
                <Label htmlFor="accountNumber">Account Number</Label>
                <Input
                  id="accountNumber"
                  value={formData.bankDetails.accountNumber}
                  onChange={(e) => setFormData({
                    ...formData,
                    bankDetails: { ...formData.bankDetails, accountNumber: e.target.value }
                  })}
                  placeholder="e.g., 1234567890"
                />
              </div>
              <div>
                <Label htmlFor="ifscCode">IFSC Code</Label>
                <Input
                  id="ifscCode"
                  value={formData.bankDetails.ifscCode}
                  onChange={(e) => setFormData({
                    ...formData,
                    bankDetails: { ...formData.bankDetails, ifscCode: e.target.value.toUpperCase() }
                  })}
                  placeholder="e.g., SBIN0001234"
                  maxLength={11}
                />
              </div>
              <div>
                <Label htmlFor="branchName">Branch Name</Label>
                <Input
                  id="branchName"
                  value={formData.bankDetails.branchName}
                  onChange={(e) => setFormData({
                    ...formData,
                    bankDetails: { ...formData.bankDetails, branchName: e.target.value }
                  })}
                  placeholder="e.g., Main Branch"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Address</h4>
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
                />
              </div>
              <div>
                <Label htmlFor="zipCode">Pin Code</Label>
                <Input
                  id="zipCode"
                  value={formData.address.zipCode}
                  onChange={(e) => setFormData({
                    ...formData,
                    address: { ...formData.address, zipCode: e.target.value }
                  })}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : editingStore ? "Update Store" : "Create Store"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Stores;

