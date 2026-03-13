import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { categoriesAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

const Subcategories = () => {
  const { toast } = useToast();
  const { selectedStore } = useAuth();

  const [categories, setCategories] = useState([]);
  const [selectedCategoryCode, setSelectedCategoryCode] = useState("");
  const [subcategories, setSubcategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newSubcategoryName, setNewSubcategoryName] = useState("");

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState(null);
  const [editingSubcategoryName, setEditingSubcategoryName] = useState("");

  const storeId = selectedStore?._id || selectedStore?.id || selectedStore || null;

  useEffect(() => {
    const loadCategories = async () => {
      setLoading(true);
      try {
        const params = storeId ? { store_id: storeId } : {};
        const response = await categoriesAPI.getCategoryHierarchy(params);
        const hierarchy =
          response?.data?.categories ||
          response?.data ||
          response?.categories ||
          [];
        const list = Array.isArray(hierarchy) ? hierarchy : [];
        setCategories(list);

        // Auto-select first category if none selected
        if (!selectedCategoryCode && list.length > 0) {
          const firstCode = list[0].code || String(list[0].id ?? list[0]._id ?? "");
          setSelectedCategoryCode(firstCode);
          setSubcategories(list[0].subcategories || []);
        }
      } catch (error) {
        console.error("Error loading categories hierarchy:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to load categories",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const selectedCategory = useMemo(
    () => categories.find((cat) => String(cat.code) === String(selectedCategoryCode)),
    [categories, selectedCategoryCode]
  );

  useEffect(() => {
    if (selectedCategory) {
      setSubcategories(selectedCategory.subcategories || []);
    } else {
      setSubcategories([]);
    }
  }, [selectedCategory]);

  const filteredSubcategories = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return subcategories;
    return subcategories.filter((sub) =>
      (sub.name || "").toLowerCase().includes(term)
    );
  }, [subcategories, searchTerm]);

  const refreshCurrentCategory = async () => {
    if (!selectedCategoryCode) return;
    try {
      const params = storeId ? { store_id: storeId } : {};
      const response = await categoriesAPI.getCategory(selectedCategoryCode, params);
      const subs =
        response?.data?.subcategories ||
        response?.subcategories ||
        [];
      setSubcategories(Array.isArray(subs) ? subs : []);
    } catch (error) {
      console.error("Error refreshing subcategories:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to refresh subcategories",
        variant: "destructive",
      });
    }
  };

  const handleOpenCreateDialog = () => {
    if (!selectedCategoryCode) {
      toast({
        title: "Select category",
        description: "Please select a category before creating a subcategory.",
        variant: "destructive",
      });
      return;
    }
    setNewSubcategoryName("");
    setIsCreateDialogOpen(true);
  };

  const handleCreateSubcategory = async () => {
    if (!newSubcategoryName.trim()) {
      toast({
        title: "Validation Error",
        description: "Subcategory name is required",
        variant: "destructive",
      });
      return;
    }
    if (!selectedCategoryCode) {
      toast({
        title: "Validation Error",
        description: "Please select a category first",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const subcategoryData = {
        name: newSubcategoryName.trim(),
        parent_id: selectedCategoryCode,
      };
      if (storeId) {
        subcategoryData.store_id = storeId;
      }

      await categoriesAPI.addSubcategory(selectedCategoryCode, subcategoryData);

      toast({
        title: "Success",
        description: "Subcategory created successfully",
      });

      setIsCreateDialogOpen(false);
      setNewSubcategoryName("");
      await refreshCurrentCategory();
    } catch (error) {
      console.error("Error creating subcategory:", error);
      let message = "Failed to create subcategory";
      if (error.message) {
        if (error.message.includes("Access denied") || error.message.includes("Missing required screen permissions")) {
          message = "You don't have permission to create subcategories. Please contact an administrator.";
        } else if (error.message.includes("Validation failed")) {
          message = "Please check your input and try again.";
        } else {
          message = error.message;
        }
      }
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEditDialog = (subcategory) => {
    if (!subcategory) return;
    setEditingSubcategory(subcategory);
    setEditingSubcategoryName(subcategory.name || "");
    setIsEditDialogOpen(true);
  };

  const handleUpdateSubcategory = async () => {
    if (!editingSubcategory) return;
    if (!editingSubcategoryName.trim()) {
      toast({
        title: "Validation Error",
        description: "Subcategory name is required",
        variant: "destructive",
      });
      return;
    }

    const code = editingSubcategory.code || editingSubcategory.SubCategoryCode;
    if (!code) {
      toast({
        title: "Error",
        description: "Unable to determine subcategory code for update.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: editingSubcategoryName.trim(),
      };
      if (selectedCategoryCode) {
        payload.parent_id = selectedCategoryCode;
      }
      if (storeId) {
        payload.store_id = storeId;
      }

      await categoriesAPI.updateSubcategory(code, payload);

      toast({
        title: "Success",
        description: "Subcategory updated successfully",
      });

      setIsEditDialogOpen(false);
      setEditingSubcategory(null);
      setEditingSubcategoryName("");
      await refreshCurrentCategory();
    } catch (error) {
      console.error("Error updating subcategory:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update subcategory",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubcategory = async (subcategory) => {
    if (!subcategory) return;
    const code = subcategory.code || subcategory.SubCategoryCode;
    if (!code) {
      toast({
        title: "Error",
        description: "Unable to determine subcategory code for delete.",
        variant: "destructive",
      });
      return;
    }

    if (!window.confirm(`Are you sure you want to delete subcategory "${subcategory.name}"?`)) {
      return;
    }

    setSaving(true);
    try {
      await categoriesAPI.deleteSubcategory(code);
      toast({
        title: "Deleted",
        description: "Subcategory deleted successfully",
      });
      await refreshCurrentCategory();
    } catch (error) {
      console.error("Error deleting subcategory:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete subcategory",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <FolderOpen className="h-6 w-6" />
            Subcategories
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Manage subcategories independently from categories. Create, edit, or delete subcategory names.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleOpenCreateDialog} disabled={!selectedCategoryCode}>
            <Plus className="h-4 w-4 mr-2" />
            Add Subcategory
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="w-full md:w-72">
              <Label className="mb-1 block">Category</Label>
              <Select
                value={selectedCategoryCode || ""}
                onValueChange={(value) => setSelectedCategoryCode(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => {
                    const code = cat.code || String(cat.id ?? cat._id ?? "");
                    return (
                      <SelectItem key={code} value={String(code)}>
                        {cat.name} ({code})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[220px]">
              <Label className="mb-1 block">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search subcategories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subcategories List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold">
            {selectedCategory ? `Subcategories for "${selectedCategory.name}"` : "Subcategories"}
          </CardTitle>
          <Badge variant="secondary">
            {filteredSubcategories.length} {filteredSubcategories.length === 1 ? "subcategory" : "subcategories"}
          </Badge>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Loading...
            </div>
          ) : !selectedCategoryCode ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Select a category to view its subcategories.
            </div>
          ) : filteredSubcategories.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No subcategories found for this category.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSubcategories.map((sub) => (
                <div
                  key={sub.code || sub.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{sub.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Code: {sub.code}{" "}
                      {sub.isActive === false && (
                        <span className="ml-1">(Inactive)</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleOpenEditDialog(sub)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:text-red-700"
                      onClick={() => handleDeleteSubcategory(sub)}
                      disabled={saving}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Subcategory Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Subcategory</DialogTitle>
            <DialogDescription>
              Create a new subcategory under{" "}
              {selectedCategory ? `"${selectedCategory.name}"` : "the selected category"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-subcategory-name">Subcategory Name</Label>
              <Input
                id="new-subcategory-name"
                placeholder="Enter subcategory name"
                value={newSubcategoryName}
                onChange={(e) => setNewSubcategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateSubcategory();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSubcategory} disabled={saving || !newSubcategoryName.trim()}>
              {saving ? "Saving..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Subcategory Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Subcategory</DialogTitle>
            <DialogDescription>
              Update the subcategory name. This will not change the underlying code.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-subcategory-name">Subcategory Name</Label>
              <Input
                id="edit-subcategory-name"
                placeholder="Enter subcategory name"
                value={editingSubcategoryName}
                onChange={(e) => setEditingSubcategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleUpdateSubcategory();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingSubcategory(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateSubcategory} disabled={saving || !editingSubcategoryName.trim()}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Subcategories;

