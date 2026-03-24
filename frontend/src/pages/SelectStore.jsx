import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Store, Check, Phone, Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { suppliersAPI, usersAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";

export default function SelectStore() {
  const { toast } = useToast();
  const { user, updateSelectedStore, selectedStore } = useAuth();
  const navigate = useNavigate();
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentSelectedStore, setCurrentSelectedStore] = useState(null);
  const isAdmin = Boolean(user?.isAdmin ?? user?.is_admin);

  const accessibleStoreIds = useMemo(() => {
    if (isAdmin) {
      return null;
    }

    const storeCandidates = [
      ...(Array.isArray(user?.stores) ? user.stores : []),
      user?.primaryStore,
      user?.store,
      user?.storeId,
      user?.store_id,
    ];

    return Array.from(
      new Set(
        storeCandidates
          .map((storeLike) => {
            if (storeLike === null || storeLike === undefined) return null;
            if (typeof storeLike === "object") {
              return String(
                storeLike.id ??
                storeLike._id ??
                storeLike.storeId ??
                storeLike.store_id ??
                ""
              ).trim() || null;
            }
            return String(storeLike).trim() || null;
          })
          .filter(Boolean)
      )
    );
  }, [isAdmin, user]);

  const isStoreAccessible = (storeLike) => {
    if (isAdmin) {
      return true;
    }

    if (!Array.isArray(accessibleStoreIds) || accessibleStoreIds.length === 0) {
      return false;
    }

    const storeId =
      typeof storeLike === "object" && storeLike !== null
        ? storeLike.id ?? storeLike._id ?? storeLike.storeId ?? storeLike.store_id
        : storeLike;

    if (storeId === null || storeId === undefined) {
      return false;
    }

    return accessibleStoreIds.includes(String(storeId).trim());
  };

  useEffect(() => {
    if (user) {
      loadStores();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadCurrentSelectedStore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedStore]);

  const loadStores = async () => {
    setLoading(true);
    try {
      if (!isAdmin && Array.isArray(accessibleStoreIds) && accessibleStoreIds.length === 0) {
        setStores([]);
        return;
      }

      const allStores = await suppliersAPI.getStores({ isActive: true });
      const allowedStores = isAdmin
        ? allStores
        : allStores.filter((store) => isStoreAccessible(store));
      setStores(allowedStores);
    } catch (error) {
      console.error("Error loading stores:", error);
      toast({
        title: "Error",
        description: "Failed to load stores",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  };

  const loadCurrentSelectedStore = async () => {
    try {
      if (!isAdmin && Array.isArray(accessibleStoreIds) && accessibleStoreIds.length === 0) {
        setCurrentSelectedStore(null);
        setSelectedStoreId(null);
        return;
      }

      // Use selectedStore from auth context first, then fallback to API
      if (selectedStore && isStoreAccessible(selectedStore)) {
        setCurrentSelectedStore(selectedStore);
        setSelectedStoreId(selectedStore.id ?? selectedStore._id);
      } else {
        const response = await usersAPI.getSelectedStore();
        if (response.data?.selectedStore && isStoreAccessible(response.data.selectedStore)) {
          setCurrentSelectedStore(response.data.selectedStore);
          setSelectedStoreId(response.data.selectedStore.id ?? response.data.selectedStore._id);
        } else {
          setCurrentSelectedStore(null);
          setSelectedStoreId(null);
        }
      }
    } catch (error) {
      console.error("Error loading selected store:", error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  };

  const handleSelectStore = async (storeId) => {
    setSaving(true);
    setSelectedStoreId(storeId); // Track which store is being saved
    try {
      // Normalize store ID - backend expects numeric ID
      // Try to get numeric id first, fallback to _id if id is not available
      let normalizedStoreId = storeId;
      
      // If storeId is an object, extract the ID (prioritize numeric id)
      if (typeof storeId === 'object' && storeId !== null) {
        normalizedStoreId = storeId.id ?? storeId._id ?? storeId.storeId;
      }
      
      // Convert to number if it's a valid numeric string or number
      const numericId = Number(normalizedStoreId);
      if (!isNaN(numericId) && isFinite(numericId) && numericId > 0) {
        normalizedStoreId = numericId;
      } else {
        // If conversion failed, try to find the store in the list and get its numeric ID
        const store = stores.find(s => {
          const sId = s.id ?? s._id ?? s.storeId;
          return String(sId) === String(normalizedStoreId);
        });
        if (store && store.id) {
          normalizedStoreId = Number(store.id);
        } else if (store && store._id) {
          // Last resort: try to convert _id to number if it's numeric
          const fallbackId = Number(store._id);
          if (!isNaN(fallbackId) && isFinite(fallbackId) && fallbackId > 0) {
            normalizedStoreId = fallbackId;
          }
        }
      }
      
      console.log('Selecting store with ID:', normalizedStoreId, 'from original:', storeId);
      const response = await usersAPI.setSelectedStore(normalizedStoreId);

      if (response.status === 'success') {
        setCurrentSelectedStore(response.data.selectedStore);

        // Update user context with selectedStore
        updateSelectedStore(response.data.selectedStore);

        toast({
          title: "Success",
          description: `Store "${response.data.selectedStore.name}" has been selected`,
        });

        navigate("/dashboard", { replace: true });
      }
    } catch (error) {
      console.error("Error selecting store:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to select store",
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
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4"
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-9 w-9"
            title="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Select Store</h1>
            <p className="text-muted-foreground">
              Choose the store you want to work with. All your data will be saved against this store.
            </p>
            {/* {currentSelectedStore && (
              <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950 rounded-md">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <Store className="inline h-4 w-4 mr-1" />
                  Currently selected: <strong>{currentSelectedStore.name}</strong>
                </p>
              </div>
            )} */}
          </div>
        </motion.div>
      </div>

      {stores.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No store access assigned</h3>
              <p className="text-muted-foreground">Please contact your administrator to grant store access</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {stores.map((store) => {
            // Normalize store ID - prefer numeric id, fallback to _id
            const storeId = store.id ?? store._id ?? store.storeId;
            // Check against both currentSelectedStore state and selectedStore from context
            const currentStoreId = currentSelectedStore?.id ?? currentSelectedStore?._id ?? selectedStore?.id ?? selectedStore?._id;
            // Compare as strings to handle both numeric and string IDs
            const isSelected = currentStoreId && String(currentStoreId) === String(storeId);
            return (
              <motion.div
                key={storeId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                <Card
                  className={`transition-all ${isSelected
                    ? "ring-2 ring-primary bg-primary/5"
                    : "hover:border-primary/50"
                    }`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                            }`}
                        >
                          <Store className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{store.name}</CardTitle>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="p-1 bg-primary rounded-full">
                          <Check className="h-4 w-4 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {/* Address hidden per request */}
                      {store.phone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          <span>{store.phone}</span>
                        </div>
                      )}
                      {store.email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          <span>{store.email}</span>
                        </div>
                      )}
                      <div className="pt-2">
                        <Button
                          variant={isSelected ? "default" : "outline"}
                          className="w-full"
                          disabled={saving}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectStore(storeId);
                          }}
                        >
                          {saving && selectedStoreId === storeId
                            ? "Selecting..."
                            : isSelected
                              ? "Currently Selected"
                              : "Select This Store"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

