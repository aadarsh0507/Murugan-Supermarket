import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Pencil, Tag, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { categoriesAPI, brandsAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

/** Match hierarchy rows whether API uses `code`, `id`, or `_id` as the category key. */
const categoryRowKey = (cat) => String(cat?.code ?? cat?.id ?? cat?._id ?? "");

const Brands = () => {
  const { toast } = useToast();
  const { selectedStore, hasEditRight } = useAuth();

  const [categories, setCategories] = useState([]);
  const [selectedCategoryCode, setSelectedCategoryCode] = useState("");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState("");
  const [subcategories, setSubcategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [editingBrandName, setEditingBrandName] = useState("");

  const storeId = selectedStore?._id || selectedStore?.id || selectedStore || null;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = { include_inactive: true };
        if (storeId) params.store_id = storeId;
        const response = await categoriesAPI.getCategoryHierarchy(params);
        const hierarchy =
          response?.data?.categories || response?.data || response?.categories || [];
        const list = Array.isArray(hierarchy) ? hierarchy : [];
        setCategories(list);
        if (!selectedCategoryCode && list.length > 0) {
          const firstCode = categoryRowKey(list[0]);
          setSelectedCategoryCode(firstCode);
          setSubcategories(list[0].subcategories || []);
        }
      } catch (error) {
        console.error(error);
        toast({
          title: "Error",
          description: error.message || "Failed to load categories",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const selectedCategory = useMemo(
    () =>
      categories.find((c) => categoryRowKey(c) === String(selectedCategoryCode)),
    [categories, selectedCategoryCode]
  );

  useEffect(() => {
    if (selectedCategory) {
      const subs = selectedCategory.subcategories || [];
      setSubcategories(subs);
      setSelectedSubcategoryId((prev) => {
        if (prev && subs.some((s) => String(s.id) === String(prev))) return prev;
        return subs.length ? String(subs[0].id) : "";
      });
    } else {
      setSubcategories([]);
      setSelectedSubcategoryId("");
    }
  }, [selectedCategory]);

  const reloadHierarchy = useCallback(async () => {
    try {
      const params = { include_inactive: true };
      if (storeId) params.store_id = storeId;
      const response = await categoriesAPI.getCategoryHierarchy(params);
      const hierarchy =
        response?.data?.categories || response?.data || response?.categories || [];
      setCategories(Array.isArray(hierarchy) ? hierarchy : []);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: error.message || "Failed to reload categories",
        variant: "destructive",
      });
    }
  }, [storeId, toast]);

  const selectedSubcategory = useMemo(
    () => subcategories.find((s) => String(s.id) === String(selectedSubcategoryId)),
    [subcategories, selectedSubcategoryId]
  );

  const loadBrandsForSubcategory = useCallback(async () => {
    if (!selectedSubcategoryId) {
      setBrands([]);
      return;
    }
    setBrandsLoading(true);
    try {
      const params = {
        limit: 500,
        subcategory_id: selectedSubcategoryId,
        include_legacy: false,
        include_inactive: true,
      };
      if (storeId) params.store_id = storeId;
      const res = await brandsAPI.getBrands(params);
      const list = res?.data?.brands || res?.brands || [];
      setBrands(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: error.message || "Failed to load brands",
        variant: "destructive",
      });
      setBrands([]);
    } finally {
      setBrandsLoading(false);
    }
  }, [selectedSubcategoryId, storeId, toast]);

  useEffect(() => {
    loadBrandsForSubcategory();
  }, [loadBrandsForSubcategory]);

  const filteredBrands = useMemo(() => {
    const t = searchTerm.trim().toLowerCase();
    if (!t) return brands;
    return brands.filter(
      (b) =>
        (b.name || "").toLowerCase().includes(t) ||
        String(b.code || b.id || "").toLowerCase().includes(t)
    );
  }, [brands, searchTerm]);

  const openCreate = () => {
    if (!selectedSubcategoryId) {
      toast({
        title: "Select subcategory",
        description: "Choose a category and subcategory before adding a brand.",
        variant: "destructive",
      });
      return;
    }
    setNewBrandName("");
    setIsCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!newBrandName.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    if (!selectedSubcategoryId) return;
    setSaving(true);
    try {
      const body = {
        name: newBrandName.trim(),
        subcategory_id: selectedSubcategoryId,
      };
      if (storeId) body.store_id = storeId;
      await brandsAPI.createBrand(body);
      toast({ title: "Brand created" });
      setIsCreateOpen(false);
      setNewBrandName("");
      await loadBrandsForSubcategory();
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: error.message || "Failed to create brand",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (brand) => {
    setEditingBrand(brand);
    setEditingBrandName(brand?.name || "");
    setIsEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingBrand) return;
    const code = editingBrand.code || editingBrand.id;
    if (!code) {
      toast({ title: "Invalid brand", variant: "destructive" });
      return;
    }
    if (!editingBrandName.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body = { name: editingBrandName.trim() };
      if (storeId) body.store_id = storeId;
      await brandsAPI.updateBrand(String(code), body);
      toast({ title: "Brand updated" });
      setIsEditOpen(false);
      setEditingBrand(null);
      await loadBrandsForSubcategory();
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: error.message || "Failed to update brand",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleBrandActive = async (brand) => {
    const code = brand?.code || brand?.id;
    if (!code) return;
    const currentlyActive = brand.isActive !== false;
    setSaving(true);
    try {
      const body = { isActive: !currentlyActive };
      if (storeId) body.store_id = storeId;
      await brandsAPI.updateBrand(String(code), body);
      toast({
        title: "Updated",
        description: !currentlyActive ? "Brand is now active." : "Brand is now inactive.",
      });
      await loadBrandsForSubcategory();
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: error.message || "Failed to update brand status",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCategoryActive = async () => {
    if (!selectedCategoryCode || !selectedCategory) return;
    const currentlyActive = selectedCategory.isActive !== false;
    setSaving(true);
    try {
      await categoriesAPI.updateCategory(String(selectedCategoryCode), {
        isActive: !currentlyActive,
      });
      toast({
        title: "Updated",
        description: !currentlyActive ? "Category is now active." : "Category is now inactive.",
      });
      await reloadHierarchy();
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: error.message || "Failed to update category status",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSubcategoryActive = async () => {
    if (!selectedSubcategory?.code) return;
    const currentlyActive = selectedSubcategory.isActive !== false;
    setSaving(true);
    try {
      await categoriesAPI.updateSubcategory(String(selectedSubcategory.code), {
        isActive: !currentlyActive,
      });
      toast({
        title: "Updated",
        description: !currentlyActive ? "Subcategory is now active." : "Subcategory is now inactive.",
      });
      await reloadHierarchy();
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: error.message || "Failed to update subcategory status",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const canEdit = hasEditRight("items");

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Tag className="h-7 w-7" />
            Brands
          </h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-2xl">
            Maintain brands per subcategory. Item forms will list brands for the selected subcategory
            (and legacy brands without a subcategory when applicable).
          </p>
        </div>
        <Button onClick={openCreate} disabled={!selectedSubcategoryId || !canEdit}>
          <Plus className="h-4 w-4 mr-2" />
          Add brand
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-full md:w-64">
              <Label className="mb-1 block">Category</Label>
              <Select
                value={selectedCategoryCode || ""}
                onValueChange={(v) => {
                  setSelectedCategoryCode(v);
                  setSelectedSubcategoryId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => {
                    const key = categoryRowKey(cat);
                    const inactive = cat.isActive === false;
                    return (
                      <SelectItem key={key} value={key}>
                        {cat.name} ({key}){inactive ? " — inactive" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-64">
              <Label className="mb-1 block">Subcategory</Label>
              <Select
                value={selectedSubcategoryId || ""}
                onValueChange={(v) => setSelectedSubcategoryId(v)}
                disabled={!subcategories.length}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Subcategory" />
                </SelectTrigger>
                <SelectContent>
                  {subcategories.map((sub) => {
                    const inactive = sub.isActive === false;
                    return (
                      <SelectItem key={sub.id || sub.code} value={String(sub.id)}>
                        {sub.name} ({sub.code}){inactive ? " — inactive" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label className="mb-1 block">Search brands</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by name or code…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            {(selectedCategory || selectedSubcategory) && (
              <div className="flex flex-wrap items-center gap-3 w-full pt-3 border-t text-sm">
                {selectedCategory && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">Category</span>
                    <Badge variant={selectedCategory.isActive === false ? "destructive" : "default"}>
                      {selectedCategory.isActive === false ? "Inactive" : "Active"}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={!canEdit || saving}
                      onClick={handleToggleCategoryActive}
                    >
                      <Power className="h-3.5 w-3.5 mr-1" />
                      {selectedCategory.isActive === false ? "Activate" : "Deactivate"}
                    </Button>
                  </div>
                )}
                {selectedSubcategory && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">Subcategory</span>
                    <Badge variant={selectedSubcategory.isActive === false ? "destructive" : "default"}>
                      {selectedSubcategory.isActive === false ? "Inactive" : "Active"}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={!canEdit || saving}
                      onClick={handleToggleSubcategoryActive}
                    >
                      <Power className="h-3.5 w-3.5 mr-1" />
                      {selectedSubcategory.isActive === false ? "Activate" : "Deactivate"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold">
            {selectedSubcategoryId && selectedCategory
              ? `Brands — ${selectedCategory.name} › ${
                  subcategories.find((s) => String(s.id) === String(selectedSubcategoryId))?.name ||
                  "…"
                }`
              : "Brands"}
          </CardTitle>
          <Badge variant="secondary">
            {filteredBrands.length}{" "}
            {filteredBrands.length === 1 ? "brand" : "brands"}
          </Badge>
        </CardHeader>
        <CardContent>
          {!selectedSubcategoryId ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Select a subcategory to view and manage its brands.
            </p>
          ) : brandsLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : filteredBrands.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No brands for this subcategory yet. Add one to map it here.
            </p>
          ) : (
            <div className="space-y-2">
              {filteredBrands.map((b) => (
                <div
                  key={b.code || b.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <div>
                      <div className="font-medium">{b.name}</div>
                      <div className="text-xs text-muted-foreground">Code: {b.code || b.id}</div>
                    </div>
                    <Badge variant={b.isActive === false ? "destructive" : "default"}>
                      {b.isActive === false ? "Inactive" : "Active"}
                    </Badge>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => handleToggleBrandActive(b)}
                      disabled={!canEdit || saving}
                    >
                      <Power className="h-3.5 w-3.5 mr-1" />
                      {b.isActive === false ? "Activate" : "Deactivate"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(b)}
                      disabled={!canEdit}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add brand</DialogTitle>
            <DialogDescription>
              This brand is stored under the subcategory you selected above.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="new-brand-name">Brand name</Label>
            <Input
              id="new-brand-name"
              value={newBrandName}
              onChange={(e) => setNewBrandName(e.target.value)}
              placeholder="e.g. Acme Foods"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreate} disabled={saving || !newBrandName.trim()}>
              {saving ? "Saving…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit brand</DialogTitle>
            <DialogDescription>Update the display name. Brand code stays the same.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="edit-brand-name">Brand name</Label>
            <Input
              id="edit-brand-name"
              value={editingBrandName}
              onChange={(e) => setEditingBrandName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setIsEditOpen(false);
                setEditingBrand(null);
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleUpdate} disabled={saving || !editingBrandName.trim()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Brands;
