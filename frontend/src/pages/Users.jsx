import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Edit, Trash2, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { usersAPI, suppliersAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

const getStoreIdValue = (store) => {
  if (store === null || store === undefined) {
    return null;
  }

  if (typeof store === "string" && store.trim() !== "") {
    return store.trim();
  }

  if (typeof store === "number") {
    return String(store);
  }

  if (typeof store === "object") {
    const candidates = [
      store._id,
      store.id,
      store.storeId,
      store.store_id,
      store.storeCode,
      store.code,
    ];
    const value = candidates.find(
      (candidate) => candidate !== null && candidate !== undefined && candidate !== ""
    );
    return value !== undefined ? String(value) : null;
  }

  return null;
};

const normalizeStoreRecord = (store, fallbackIndex = 0) => {
  const id = getStoreIdValue(store) ?? `store-${fallbackIndex}`;
  return {
    id,
    name: store?.name || "",
    code: store?.code || store?.storeCode || "",
    isActive: store?.isActive ?? store?.is_active ?? true,
  };
};

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-indigo-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

const getAvatarColor = (identifier) => {
  if (!identifier) return AVATAR_COLORS[0];
  let hash = 0;
  const str = String(identifier);
  for (let i = 0; i < str.length; i += 1) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
};

const PRIMARY_STORE_NONE_VALUE = "__none__";

export default function Users() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({});
  const [stores, setStores] = useState([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalUsers: 0,
    hasNext: false,
    hasPrev: false
  });

  // Fetch users from API
  useEffect(() => {
    fetchUsers();
    fetchStores();
  }, []);

  const fetchStores = async () => {
    setLoadingStores(true);
    try {
      const response = await suppliersAPI.getStores({ isActive: true });
      const storeArray = Array.isArray(response) ? response : [];
      const normalized = storeArray.map((store, index) =>
        normalizeStoreRecord(store, index)
      );
      setStores(normalized);
      return normalized;
    } catch (error) {
      console.error("Error fetching stores:", error);
      toast({
        title: "Error",
        description: "Failed to fetch stores from database",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoadingStores(false);
    }
  };

  useEffect(() => {
    if (isModalOpen && editingUser) {
      fetchStores();
    }
  }, [isModalOpen, editingUser]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
    const response = await usersAPI.getUsers();
    const rawUsers = response.data.users || [];
    const normalizedUsers = rawUsers.map((user) => ({
      ...user,
      firstName: (user.firstName || "").toString().trim(),
      lastName: (user.lastName || "").toString().trim(),
    }));
    // Filter out push diggy user
    const filteredUsers = normalizedUsers.filter((user) => {
      const email = (user.email || "").toString().trim().toLowerCase();
      const firstName = (user.firstName || "").toString().trim().toLowerCase();
      const lastName = (user.lastName || "").toString().trim().toLowerCase();
      const fullName = `${firstName} ${lastName}`.trim().toLowerCase();
      
      // Filter out by email or name
      return email !== "pushdiggy@gmail.com" && 
             email !== "info@pushdiggy.com" &&
             fullName !== "push diggy";
    });
    setUsers(filteredUsers);
    setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to fetch users from database",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatUserName = (user) => {
    const first = (user.firstName || "").toString().trim();
    const last = (user.lastName || "").toString().trim();
    if (first && last) {
      return `${first} ${last}`;
    }
    return first || last || "";
  };

  const getPrimaryStoreLabel = (user) => {
    const primaryStore =
      user?.primaryStore || user?.selectedStore || null;
    if (primaryStore?.name && primaryStore?.code) {
      return `${primaryStore.name} (${primaryStore.code})`;
    }
    if (primaryStore?.name) {
      return primaryStore.name;
    }
    if (primaryStore?.code) {
      return primaryStore.code;
    }
    if (user?.storeId) {
      return `Store #${user.storeId}`;
    }
    return "Not set";
  };

  const getScreenNames = (user) => {
    if (user.isAdmin || user.is_admin) {
      return ["All screens (admin)"];
    }
    if (Array.isArray(user?.screenNames) && user.screenNames.length > 0) {
      return user.screenNames;
    }
    if (Array.isArray(user?.allowedScreens) && user.allowedScreens.length > 0) {
      return user.allowedScreens
        .map((screen) => screen?.name || screen?.key)
        .filter(Boolean);
    }
    return [];
  };

  const filteredUsers = users.filter((user) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    const name = formatUserName(user).toLowerCase();
    const email = (user.email || "").toLowerCase();
    const phone = (user.phone || "").toLowerCase();
    return name.includes(term) || email.includes(term) || phone.includes(term);
  });

  const handleAddNew = () => {
    setEditingUser(null);
    setFormData({ 
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      phone: "",
      isActive: true,
      stores: [],
      storeId: null,
      isAdmin: false
    });
    setIsModalOpen(true);
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      firstName: (user.firstName || "").toString().trim(),
      lastName: (user.lastName || "").toString().trim(),
      email: user.email,
      phone: user.phone,
      isActive: user.isActive,
      stores:
        user.stores
          ?.map((store) => getStoreIdValue(store))
          .filter((value) => value !== null) || [],
      storeId:
        getStoreIdValue(
          user.primaryStore ||
            user.store ||
            user.selectedStore ||
            user.storeId ||
            user.store_id ||
            null
        ) || null,
      isAdmin: Boolean(user.isAdmin ?? user.is_admin),
    });
    setIsModalOpen(true);
    fetchStores();
  };

  const handleDelete = async (user) => {
    if (user._id === currentUser?._id) {
      toast({
        title: "Action not allowed",
        description: "You cannot deactivate your own account.",
        variant: "destructive",
      });
      return;
    }
    try {
      await usersAPI.deleteUser(user._id);
      await fetchUsers(); // Refresh the list
      toast({
        title: "User Deactivated",
        description: `${formatUserName(user)} has been deactivated`,
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: "Failed to deactivate user",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        ...formData,
        isAdmin: formData.isAdmin === true,
      };
      if (editingUser) {
        await usersAPI.updateUser(editingUser._id, payload);
        toast({
          title: "User Updated",
          description: "User details have been updated successfully",
        });
      } else {
        await usersAPI.createUser(payload);
        toast({
          title: "User Added",
          description: "New user has been added to the system",
        });
      }
      
      await fetchUsers(); // Refresh the list
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save user",
        variant: "destructive",
      });
    }
  };

  const columns = [
    {
      key: "name",
      header: "User",
      render: (user) => (
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback className={`${getAvatarColor(user._id || user.id || user.email)} text-white`}>
              <span className="text-white font-semibold">
                {(user.firstName?.[0] || '') + (user.lastName?.[0] || '')}
              </span>
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{formatUserName(user)}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "primaryStore",
      header: "Primary Store",
      render: (user) => (
        <span className="text-sm text-muted-foreground">
          {getPrimaryStoreLabel(user)}
        </span>
      ),
    },
    {
      key: "accessLevel",
      header: "Access",
      render: (user) => (
        <Badge variant={user.isAdmin ? "default" : "secondary"}>
          {user.isAdmin ? "Admin (all screens)" : "Screen-based"}
        </Badge>
      ),
    },
    { key: "phone", header: "Phone" },
    {
      key: "screenNames",
      header: "Allowed Screens",
      render: (user) => {
        const screenNames = getScreenNames(user);
        if (screenNames.length === 0) {
          return <span className="text-sm text-muted-foreground">No screens</span>;
        }
        return (
          <div className="flex flex-wrap gap-1 max-w-xs">
            {screenNames.map((name) => (
              <Badge key={`${user._id}-${name}`} variant="secondary">
                {name}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (user) => (
        <Badge variant={user.isActive ? "default" : "secondary"}>
          {user.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (user) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(user);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(user);
            }}
            disabled={user._id === currentUser?._id}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="min-w-0"
        >
          <h1 className="text-2xl sm:text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Manage staff and access control</p>
        </motion.div>
        <Button onClick={handleAddNew} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto min-h-11 touch-target-y">
          <Plus className="h-4 w-4 mr-2" />
          Add New User
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4"
      >
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 min-h-11"
          />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading users...</span>
          </div>
        ) : (
          <DataTable data={filteredUsers} columns={columns} />
        )}
      </motion.div>

      <Modal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        title={editingUser ? "Edit User" : "Add New User"}
        description="Enter the user details below"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName || ""}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName || ""}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={formData.email || ""}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          {!editingUser && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password || ""}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone || ""}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="isActive">Status</Label>
            <Select
              value={formData.isActive?.toString()}
              onValueChange={(value) =>
                setFormData({ ...formData, isActive: value === "true" })
              }
            >
              <SelectTrigger id="isActive">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border p-4 space-y-2 bg-muted/30">
            <div className="flex items-start gap-3">
              <Checkbox
                id="isAdmin"
                checked={Boolean(formData.isAdmin)}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isAdmin: checked === true })
                }
              />
              <div>
                <Label htmlFor="isAdmin">Grant admin access</Label>
                <p className="text-xs text-muted-foreground">
                  Admins bypass screen assignments and automatically access every screen.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="primaryStore">Primary Store</Label>
            <Select
              value={formData.storeId ?? PRIMARY_STORE_NONE_VALUE}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  storeId: value === PRIMARY_STORE_NONE_VALUE ? null : value,
                })
              }
            >
              <SelectTrigger id="primaryStore">
                <SelectValue placeholder="Select primary store" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PRIMARY_STORE_NONE_VALUE}>
                  No primary store
                </SelectItem>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name} {store.code && `(${store.code})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Stores</Label>
            <div className="border rounded-md p-4 max-h-60 overflow-y-auto">
              {loadingStores ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading stores...</span>
                </div>
              ) : stores.length === 0 ? (
                <p className="text-sm text-muted-foreground">No stores available</p>
              ) : (
                <div className="space-y-2">
                  {stores.map((store) => (
                    <div key={store.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`store-${store.id}`}
                        checked={formData.stores?.includes(store.id) || false}
                        onCheckedChange={(checked) => {
                          const currentStores = Array.isArray(formData.stores)
                            ? [...formData.stores]
                            : [];
                          const storeId = store.id;
                          setFormData({
                            ...formData,
                            stores: checked
                              ? Array.from(new Set([...currentStores, storeId]))
                              : currentStores.filter((id) => id !== storeId),
                          });
                        }}
                      />
                      <Label
                        htmlFor={`store-${store.id}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {store.name} {store.code && `(${store.code})`}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
              {editingUser ? "Update User" : "Add User"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
