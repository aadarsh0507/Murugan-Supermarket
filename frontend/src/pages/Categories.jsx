import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Plus, 
  Search, 
  Trash2, 
  Package, 
  Filter, 
  Eye,
  EyeOff,
  MoreHorizontal,
  ChevronRight,
  ChevronDown,
  FolderPlus,
  FolderOpen,
  ArrowLeft,
  ArrowRight,
  Check,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/Modal";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { categoriesAPI, itemsAPI } from "@/services/api";

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Multi-step modal state
  const [currentStep, setCurrentStep] = useState(1);
  const [createdCategory, setCreatedCategory] = useState(null);
  const [createdSubcategories, setCreatedSubcategories] = useState([]);
  const [createdItems, setCreatedItems] = useState([]);
  const [isMultiStepModal, setIsMultiStepModal] = useState(false);

  // Multi-step form data
  const [multiStepData, setMultiStepData] = useState({
    category: { name: "" },
    subcategories: [{ name: "" }], // Start with one subcategory, user can add more
    currentSubcategoryIndex: 0,
    item: {
    name: "",
      sku: "",
      description: "",
      price: "",
      cost: "",
      stock: 0,
      minStock: 0,
      maxStock: "",
      unit: "",
      weight: "",
      barcode: "",
      tags: [],
      isActive: true,
      isDigital: false,
      requiresPrescription: false,
      isBOGO: false,
      expiryDate: ""
    }
  });

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    filterAndSortCategories();
  }, [categories, searchTerm, filterStatus, sortBy, sortOrder]);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const response = await categoriesAPI.getCategories({ 
        includeSubcategories: true,
        limit: 100 
      });
      console.log("Categories response:", response.data.categories);
      setCategories(response.data.categories || []);
    } catch (error) {
      console.error("Error loading categories:", error);
      toast({
        title: "Error",
        description: "Failed to load categories",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortCategories = () => {
    let filtered = [...categories];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(category =>
        category.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by status
    if (filterStatus !== "all") {
      filtered = filtered.filter(category =>
        filterStatus === "active" ? category.isActive : !category.isActive
      );
    }

    // Sort categories
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "createdAt":
          comparison = new Date(a.createdAt) - new Date(b.createdAt);
          break;
        default:
          comparison = a.name.localeCompare(b.name);
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    setFilteredCategories(filtered);
  };


  // Multi-step modal functions
  const handleCreateCompleteFlow = () => {
    setCurrentStep(1);
    setCreatedCategory(null);
    setCreatedSubcategories([]);
    setCreatedItems([]);
    setMultiStepData({
      category: { name: "" },
      subcategories: [{ name: "" }], // Start with one subcategory
      currentSubcategoryIndex: 0,
      item: {
      name: "",
        sku: "",
        description: "",
        price: "",
        cost: "",
        stock: 0,
        minStock: 0,
        maxStock: "",
        unit: "",
        weight: "",
        barcode: "",
        tags: [],
        isActive: true,
        isDigital: false,
        requiresPrescription: false,
        expiryDate: ""
      }
    });
    setIsMultiStepModal(true);
  };

  const handleStepNext = async () => {
    if (currentStep === 1) {
      // Create category
      if (!multiStepData.category.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Category name is required",
        variant: "destructive",
      });
      return;
    }

      setSaving(true);
      try {
        const categoryData = {
          name: multiStepData.category.name.trim(),
          subcategories: []
        };
        
        const response = await categoriesAPI.createCategory(categoryData);
        
        setCreatedCategory(response.data);
        setCurrentStep(2);
        toast({
          title: "Success",
          description: "Category created successfully",
        });
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
        setSaving(false);
      }
    } else if (currentStep === 2) {
      // Create all subcategories
      const validSubcategories = multiStepData.subcategories.filter(sub => sub.name.trim());
      
      if (validSubcategories.length === 0) {
      toast({
        title: "Validation Error",
          description: "At least one subcategory name is required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
        // Create all subcategories
        const subcategoryPromises = validSubcategories.map(sub => 
          categoriesAPI.addSubcategory(createdCategory._id, {
            name: sub.name.trim()
          })
        );
        
        const responses = await Promise.all(subcategoryPromises);
        
        // Get all created subcategories
        const allSubcategories = [];
        responses.forEach(response => {
          const newSubcategory = response.data.subcategories.find(sub => 
            validSubcategories.some(validSub => validSub.name.trim() === sub.name)
          );
          if (newSubcategory) {
            allSubcategories.push(newSubcategory);
          }
        });
        
        // Store all created subcategories
        setCreatedSubcategories(allSubcategories);
        setCreatedItems([]);
        
        setCurrentStep(3);
        toast({
          title: "Success",
          description: `${allSubcategories.length} subcategory(ies) created successfully`,
        });
      } catch (error) {
        console.error("Error creating subcategories:", error);
        let errorMessage = "Failed to create subcategories";
        
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
        setSaving(false);
      }
    }
  };

  const handleStepBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Functions to manage multiple subcategories
  const addSubcategoryField = () => {
    setMultiStepData({
      ...multiStepData,
      subcategories: [...multiStepData.subcategories, { name: "" }]
    });
  };

  const removeSubcategoryField = (index) => {
    if (multiStepData.subcategories.length > 1) {
      const newSubcategories = multiStepData.subcategories.filter((_, i) => i !== index);
      setMultiStepData({
        ...multiStepData,
        subcategories: newSubcategories,
        currentSubcategoryIndex: Math.min(multiStepData.currentSubcategoryIndex, newSubcategories.length - 1)
      });
    }
  };

  const updateSubcategoryName = (index, name) => {
    const newSubcategories = [...multiStepData.subcategories];
    newSubcategories[index] = { name };
    setMultiStepData({
      ...multiStepData,
      subcategories: newSubcategories
    });
  };

  const handleAddItem = async () => {
    // Validate item data
    if (!multiStepData.item.name.trim() || !multiStepData.item.sku.trim() || !multiStepData.item.price || !multiStepData.item.unit.trim()) {
      toast({
        title: "Validation Error",
        description: "Item name, SKU, price, and unit are required",
        variant: "destructive",
      });
      return;
    }

    // Additional numeric validations
    const priceNum = parseFloat(multiStepData.item.price);
    const costNum = multiStepData.item.cost === "" || multiStepData.item.cost === null || typeof multiStepData.item.cost === 'undefined'
      ? undefined
      : parseFloat(multiStepData.item.cost);

    if (isNaN(priceNum) || priceNum <= 0) {
      toast({
        title: "Validation Error",
        description: "Price must be a number greater than 0",
        variant: "destructive",
      });
      return;
    }

    if (typeof costNum !== 'undefined' && !isNaN(costNum) && priceNum > costNum) {
      toast({
        title: "Validation Error",
        description: "Price must be less than or equal to cost price",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const itemData = {
        name: multiStepData.item.name.trim(),
        sku: multiStepData.item.sku.trim(),
        description: multiStepData.item.description.trim(),
        price: priceNum,
        cost: typeof costNum === 'undefined' ? null : costNum,
        stock: parseInt(multiStepData.item.stock) || 0,
        minStock: parseInt(multiStepData.item.minStock) || 0,
        maxStock: multiStepData.item.maxStock ? parseInt(multiStepData.item.maxStock) : null,
        unit: multiStepData.item.unit.trim(),
        weight: multiStepData.item.weight ? parseFloat(multiStepData.item.weight) : null,
        barcode: multiStepData.item.barcode.trim(),
        tags: multiStepData.item.tags || [],
        isActive: multiStepData.item.isActive,
        isDigital: multiStepData.item.isDigital,
        requiresPrescription: multiStepData.item.requiresPrescription,
        expiryDate: multiStepData.item.expiryDate || null
      };

      const selectedSubcategory = createdSubcategories[multiStepData.currentSubcategoryIndex];
      
      const response = await categoriesAPI.addItemToSubcategory(
        createdCategory._id, 
        selectedSubcategory._id, 
        itemData
      );
      
      // Find the newly added item
      const updatedSubcategory = response.data.subcategories.find(sub => 
        sub._id.toString() === selectedSubcategory._id.toString()
      );
      const newItem = updatedSubcategory.items[updatedSubcategory.items.length - 1];
      
      // Update the subcategory in createdSubcategories array
      const updatedSubcategories = [...createdSubcategories];
      updatedSubcategories[multiStepData.currentSubcategoryIndex] = updatedSubcategory;
      setCreatedSubcategories(updatedSubcategories);
      
      setCreatedItems([...createdItems, newItem]);
      
      // Reset item form for next item
      setMultiStepData({
        ...multiStepData,
        item: {
          name: "",
          sku: "",
          description: "",
          price: "",
          cost: "",
          stock: 0,
          minStock: 0,
          maxStock: "",
          unit: "",
          weight: "",
          barcode: "",
          tags: [],
          isActive: true,
          isDigital: false,
          requiresPrescription: false,
          expiryDate: ""
        }
      });

        toast({
          title: "Success",
        description: "Item added successfully. You can add more items or finish.",
        });
    } catch (error) {
      console.error("Error creating item:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create item",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFinishFlow = async () => {
    await loadCategories(); // Refresh categories
    setIsMultiStepModal(false);
    setCurrentStep(1);
    setCreatedCategory(null);
    setCreatedSubcategories([]);
    setCreatedItems([]);
    
    toast({
      title: "Complete",
      description: `Successfully ${createdCategory?._id ? 'added' : 'created'} ${createdSubcategories.length} subcategory(ies)${createdCategory?._id ? ` to "${createdCategory.name}"` : ''}, and ${createdSubcategories.reduce((total, sub) => total + (sub.items ? sub.items.length : 0), 0)} item(s)`,
    });
  };

  const handleCancelFlow = () => {
    setIsMultiStepModal(false);
    setCurrentStep(1);
    setCreatedCategory(null);
    setCreatedSubcategories([]);
    setCreatedItems([]);
  };

  // Function to add subcategories to existing category
  const handleAddSubcategoriesToCategory = (category) => {
    setCurrentStep(2);
    setCreatedCategory(category);
    setCreatedSubcategories([]);
    setCreatedItems([]);
    setMultiStepData({
      category: { name: category.name },
      subcategories: [{ name: "" }], // Start with one subcategory
      currentSubcategoryIndex: 0,
      item: {
        name: "",
        sku: "",
        description: "",
        price: "",
        cost: "",
        stock: 0,
        minStock: 0,
        maxStock: "",
        unit: "",
        weight: "",
        barcode: "",
        tags: [],
        isActive: true,
        isDigital: false,
        requiresPrescription: false,
        expiryDate: ""
      }
    });
    setIsMultiStepModal(true);
  };

  // Function to add items to existing subcategory
  const handleAddItemsToSubcategory = (category, subcategory) => {
    setCurrentStep(3);
    setCreatedCategory(category);
    setCreatedSubcategories([subcategory]);
    setCreatedItems(subcategory.items || []);
    setMultiStepData({
      category: { name: category.name },
      subcategories: [{ name: subcategory.name }],
      currentSubcategoryIndex: 0,
      item: {
        name: "",
        sku: "",
        description: "",
        price: "",
        cost: "",
        stock: 0,
        minStock: 0,
        maxStock: "",
        unit: "",
        weight: "",
        barcode: "",
        tags: [],
        isActive: true,
        isDigital: false,
        requiresPrescription: false,
        expiryDate: ""
      }
    });
    setIsMultiStepModal(true);
  };



  const handleDeleteCategory = async (category) => {
    if (window.confirm(`Are you sure you want to delete "${category.name}"?`)) {
      try {
        await categoriesAPI.deleteCategory(category._id);
        await loadCategories(); // Refresh the list
        toast({
          title: "Success",
          description: "Category deleted successfully",
        });
      } catch (error) {
        console.error("Error deleting category:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to delete category",
          variant: "destructive",
        });
      }
    }
  };

  const handleToggleStatus = async (category) => {
    try {
      await categoriesAPI.toggleCategoryStatus(category._id);
      await loadCategories(); // Refresh the list
      toast({
        title: "Success",
        description: `Category ${!category.isActive ? 'activated' : 'deactivated'} successfully`,
      });
    } catch (error) {
      console.error("Error toggling status:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update category status",
        variant: "destructive",
      });
    }
  };

  const toggleExpanded = (categoryId) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const renderCategoryCard = (category, level = 0) => {
    const hasSubcategories = category.subcategories && category.subcategories.length > 0;
    const hasItems = level === 1 && category.items && category.items.length > 0;
    const isExpandable = hasSubcategories || hasItems;
    const isExpanded = expandedCategories.has(category._id);
    const indentClass = level > 0 ? `ml-${level * 4}` : '';


    return (
      <motion.div
        key={category._id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-2"
      >
        <Card className={indentClass}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {isExpandable && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpanded(category._id)}
                    className="p-1 h-6 w-6"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                )}
                {!isExpandable && level > 0 && (
                  <div className="w-6 h-6 flex items-center justify-center">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  {level === 0 ? (
                    <FolderOpen className="h-5 w-5 text-blue-600" />
                  ) : (
                    <FolderPlus className="h-4 w-4 text-green-600" />
                  )}
                  <div>
                    <h3 className="font-semibold text-lg">{category.name}</h3>
                    {level === 1 && category.items && category.items.length > 0 && (
                      <p className="text-sm text-gray-500">
                        {category.items.length} item(s) • Stock: {category.items.reduce((sum, item) => sum + (item.stock || 0), 0)}
                      </p>
                    )}
                    {level === 0 && (
                      <p className="text-sm text-gray-500">
                        {category.subcategories && category.subcategories.length > 0 
                          ? `${category.subcategories.length} subcategory(ies) • ${category.subcategories.reduce((sum, sub) => sum + (sub.items ? sub.items.length : 0), 0)} total items`
                          : 'No subcategories yet • Click "Add Subcategories" to create'
                        }
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Badge variant={category.isActive ? "default" : "destructive"}>
                  {category.isActive ? "Active" : "Inactive"}
                </Badge>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {level === 0 && (
                      <>
                        <DropdownMenuItem onClick={() => handleCreateCompleteFlow()}>
                          <Package className="h-4 w-4 mr-2" />
                          Complete Flow
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAddSubcategoriesToCategory(category)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Subcategories
                        </DropdownMenuItem>
                      </>
                    )}
                    {level === 1 && (
                      <DropdownMenuItem onClick={() => {
                        // Find the parent category that contains this subcategory
                        const parentCategory = categories.find(cat => 
                          cat.subcategories && cat.subcategories.some(sub => sub._id === category._id)
                        );
                        if (parentCategory) {
                          handleAddItemsToSubcategory(parentCategory, category);
                        }
                      }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Items
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => handleToggleStatus(category)}>
                      {category.isActive ? (
                        <EyeOff className="h-4 w-4 mr-2" />
                      ) : (
                        <Eye className="h-4 w-4 mr-2" />
                      )}
                      {category.isActive ? "Deactivate" : "Activate"}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDeleteCategory(category)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Render subcategories if expanded */}
        {hasSubcategories && isExpanded && (
          <div className="ml-4 mt-2">
            {category.subcategories.map(subcategory => 
              renderCategoryCard(subcategory, level + 1)
            )}
          </div>
        )}

        {/* Render items if subcategory is expanded */}
        {level === 1 && isExpanded && category.items && category.items.length > 0 && (
          <div className="ml-8 mt-2">
            <h4 className="text-sm font-medium text-gray-600 mb-2">Items ({category.items.length})</h4>
            <div className="space-y-1">
              {category.items.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">{item.name}</span>
                      <Badge variant="outline" className="text-xs">{item.sku}</Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Stock: {item.stock} {item.unit} | Min: {item.minStock}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">₹{item.price}</div>
                    <Badge variant={item.isActive ? "default" : "secondary"} className="text-xs">
                      {item.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Categories</h1>
          <p className="text-gray-600 mt-1">Manage product categories and subcategories</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={handleCreateCompleteFlow} className="flex items-center space-x-2">
            <Package className="h-4 w-4" />
            <span>Complete Flow</span>
        </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search categories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="createdAt">Created Date</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            >
              {sortOrder === "asc" ? "↑" : "↓"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Categories List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading categories...</p>
          </div>
        ) : filteredCategories.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No categories found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || filterStatus !== "all"
                  ? "Try adjusting your search or filter criteria"
                  : "Get started by creating your first category"}
              </p>
              {!searchTerm && filterStatus === "all" && (
                <Button onClick={handleCreateCompleteFlow}>
                  <Package className="h-4 w-4 mr-2" />
                  Complete Flow
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredCategories.map(category => renderCategoryCard(category, 0))
        )}
      </div>


      {/* Multi-Step Complete Flow Modal */}
      <Modal
        open={isMultiStepModal}
        onOpenChange={setIsMultiStepModal}
        title={createdCategory?._id ? `Add Subcategories to "${createdCategory.name}"` : "Complete Category Setup"}
        description={createdCategory?._id ? "Add more subcategories and items to existing category" : "Create category, subcategory, and add items in one flow"}
        className="max-w-4xl"
      >
        <div className="space-y-6 max-h-[80vh] overflow-y-auto px-1">
          {/* Progress Indicator */}
          <div className="flex items-center justify-center space-x-4">
            {!createdCategory?._id && (
              <>
                <div className={`flex items-center space-x-2 ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                    {currentStep > 1 ? <Check className="h-4 w-4" /> : '1'}
                  </div>
                  <span className="text-sm font-medium">Category</span>
                </div>
                <div className={`w-8 h-1 ${currentStep >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
              </>
            )}
            <div className={`flex items-center space-x-2 ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                {currentStep > 2 ? <Check className="h-4 w-4" /> : '2'}
              </div>
              <span className="text-sm font-medium">Subcategory</span>
            </div>
            <div className={`w-8 h-1 ${currentStep >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
            <div className={`flex items-center space-x-2 ${currentStep >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                3
              </div>
              <span className="text-sm font-medium">Items</span>
            </div>
          </div>

          {/* Step Content */}
          {currentStep === 1 && (
        <div className="space-y-4">
            <div>
                <Label htmlFor="categoryName">Category Name *</Label>
                <Input
                  id="categoryName"
                  value={multiStepData.category.name}
                  onChange={(e) => setMultiStepData({
                    ...multiStepData,
                    category: { ...multiStepData.category, name: e.target.value }
                  })}
                  placeholder="Enter category name"
                />
              </div>
            </div>
          )}

           {currentStep === 2 && (
             <div className="space-y-4">
               <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                 <div className="flex items-center space-x-2">
                   <Check className="h-4 w-4 text-green-600" />
                   <span className="text-sm font-medium text-green-800">
                     {createdCategory?.name ? `Category "${createdCategory.name}" ${createdCategory._id ? 'selected' : 'created'} successfully` : 'Category created successfully'}
                   </span>
                 </div>
               </div>
               
               <div className="space-y-4">
                 <div className="flex items-center justify-between">
                   <h3 className="text-lg font-semibold">
                     {createdCategory?._id ? `Add More Subcategories to "${createdCategory.name}"` : 'Add Subcategories'}
                   </h3>
                   <Button 
                     type="button" 
                     variant="outline" 
                     size="sm" 
                     onClick={addSubcategoryField}
                     className="flex items-center space-x-1"
                   >
                     <Plus className="h-4 w-4" />
                     <span>Add Subcategory</span>
                   </Button>
                 </div>
                 
                 {multiStepData.subcategories.map((subcategory, index) => (
                   <div key={index} className="flex items-center space-x-2">
                     <div className="flex-1">
                       <Label htmlFor={`subcategoryName-${index}`}>
                         Subcategory {index + 1} Name *
                       </Label>
                       <Input
                         id={`subcategoryName-${index}`}
                         value={subcategory.name}
                         onChange={(e) => updateSubcategoryName(index, e.target.value)}
                         placeholder="Enter subcategory name"
                       />
                     </div>
                     {multiStepData.subcategories.length > 1 && (
                       <Button
                         type="button"
                         variant="outline"
                         size="sm"
                         onClick={() => removeSubcategoryField(index)}
                         className="mt-6 text-red-600 hover:text-red-700"
                       >
                         <X className="h-4 w-4" />
                       </Button>
                     )}
                   </div>
                 ))}
               </div>
             </div>
           )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">
                    {multiStepData.subcategories.length} subcategory(ies) created successfully
                  </span>
                </div>
              </div>

              {/* Subcategory Selector */}
              <div className="space-y-2">
                <Label htmlFor="subcategorySelector">Select Subcategory for Adding Items</Label>
              <Select
                  value={multiStepData.currentSubcategoryIndex.toString()} 
                  onValueChange={(value) => setMultiStepData({
                    ...multiStepData,
                    currentSubcategoryIndex: parseInt(value)
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select subcategory" />
                </SelectTrigger>
                <SelectContent>
                    {multiStepData.subcategories.map((subcategory, index) => (
                      <SelectItem key={index} value={index.toString()}>
                        {subcategory.name || `Subcategory ${index + 1}`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

              {/* Item Form */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">
                  Add Item to "{multiStepData.subcategories[multiStepData.currentSubcategoryIndex]?.name || `Subcategory ${multiStepData.currentSubcategoryIndex + 1}`}"
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="itemName">Item Name *</Label>
                    <Input
                      id="itemName"
                      value={multiStepData.item.name}
                      onChange={(e) => setMultiStepData({
                        ...multiStepData,
                        item: { ...multiStepData.item, name: e.target.value }
                      })}
                      placeholder="Enter item name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="itemSku">SKU *</Label>
                    <Input
                      id="itemSku"
                      value={multiStepData.item.sku}
                      onChange={(e) => setMultiStepData({
                        ...multiStepData,
                        item: { ...multiStepData.item, sku: e.target.value }
                      })}
                      placeholder="Enter SKU"
                    />
                  </div>
                </div>

          <div>
                  <Label htmlFor="itemDescription">Description</Label>
            <Input
                    id="itemDescription"
                    value={multiStepData.item.description}
                    onChange={(e) => setMultiStepData({
                      ...multiStepData,
                      item: { ...multiStepData.item, description: e.target.value }
                    })}
                    placeholder="Enter item description"
            />
          </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="itemPrice">Price (₹) *</Label>
                    <Input
                      id="itemPrice"
                      type="number"
                      value={multiStepData.item.price}
                      onChange={(e) => setMultiStepData({
                        ...multiStepData,
                        item: { ...multiStepData.item, price: e.target.value }
                      })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="itemCost">Cost (₹)</Label>
                    <Input
                      id="itemCost"
                      type="number"
                      value={multiStepData.item.cost}
                      onChange={(e) => setMultiStepData({
                        ...multiStepData,
                        item: { ...multiStepData.item, cost: e.target.value }
                      })}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="itemStock">Stock</Label>
                    <Input
                      id="itemStock"
                      type="number"
                      value={multiStepData.item.stock}
                      onChange={(e) => setMultiStepData({
                        ...multiStepData,
                        item: { ...multiStepData.item, stock: parseInt(e.target.value) || 0 }
                      })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="itemMinStock">Min Stock</Label>
                    <Input
                      id="itemMinStock"
                      type="number"
                      value={multiStepData.item.minStock}
                      onChange={(e) => setMultiStepData({
                        ...multiStepData,
                        item: { ...multiStepData.item, minStock: parseInt(e.target.value) || 0 }
                      })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="itemMaxStock">Max Stock</Label>
                    <Input
                      id="itemMaxStock"
                      type="number"
                      value={multiStepData.item.maxStock}
                      onChange={(e) => setMultiStepData({
                        ...multiStepData,
                        item: { ...multiStepData.item, maxStock: e.target.value }
                      })}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="itemUnit">Unit *</Label>
                    <Input
                      id="itemUnit"
                      value={multiStepData.item.unit}
                      onChange={(e) => setMultiStepData({
                        ...multiStepData,
                        item: { ...multiStepData.item, unit: e.target.value }
                      })}
                      placeholder="kg, pieces, etc."
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="itemWeight">Weight (kg)</Label>
                    <Input
                      id="itemWeight"
                      type="number"
                      value={multiStepData.item.weight}
                      onChange={(e) => setMultiStepData({
                        ...multiStepData,
                        item: { ...multiStepData.item, weight: e.target.value }
                      })}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="itemIsBOGO"
                    checked={multiStepData.item.isBOGO || false}
                    onCheckedChange={(checked) => setMultiStepData({
                      ...multiStepData,
                      item: { ...multiStepData.item, isBOGO: checked }
                    })}
                  />
                  <Label
                    htmlFor="itemIsBOGO"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Buy One Get One (BOGO) Offer
                  </Label>
                </div>

                 {/* Created Items List for Selected Subcategory */}
                 {createdSubcategories[multiStepData.currentSubcategoryIndex]?.items && 
                  createdSubcategories[multiStepData.currentSubcategoryIndex].items.length > 0 && (
                   <div className="mt-4">
                     <h4 className="text-sm font-medium mb-2">
                       Items in "{createdSubcategories[multiStepData.currentSubcategoryIndex]?.name}" ({createdSubcategories[multiStepData.currentSubcategoryIndex].items.length})
                     </h4>
                     <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                       {createdSubcategories[multiStepData.currentSubcategoryIndex].items.map((item, index) => (
                         <div key={index} className="flex items-center justify-between p-3 bg-white rounded border">
                           <div className="flex-1 min-w-0">
                             <div className="flex items-center space-x-2 mb-1">
                               <span className="text-sm font-medium truncate">{item.name}</span>
                               <Badge variant="outline" className="text-xs flex-shrink-0">{item.sku}</Badge>
                             </div>
                             <div className="text-xs text-gray-500">
                               Stock: {item.stock} {item.unit} | Min: {item.minStock}
                             </div>
                           </div>
                           <div className="text-right flex-shrink-0 ml-3">
                             <div className="text-sm font-semibold">₹{item.price}</div>
                             <Badge variant={item.isActive ? "default" : "secondary"} className="text-xs">
                               {item.isActive ? "Active" : "Inactive"}
                             </Badge>
                           </div>
                         </div>
                       ))}
                     </div>
                   </div>
                 )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col space-y-3 pt-4">
            {/* Top row - Navigation buttons */}
            <div className="flex justify-between">
              <div className="flex space-x-2">
                {currentStep > 1 && (
                  <Button variant="outline" onClick={handleStepBack} disabled={saving}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                )}
                <Button variant="outline" onClick={handleCancelFlow}>
                  <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
              </div>
              
              {currentStep < 3 && (
                <Button onClick={handleStepNext} disabled={saving}>
                  {saving ? "Saving..." : "Next"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>

            {/* Bottom row - Action buttons for step 3 */}
            {currentStep === 3 && (
              <div className="flex justify-center space-x-3">
                <Button onClick={handleAddItem} disabled={saving} variant="outline" className="flex-1 max-w-[200px]">
                  {saving ? "Adding..." : "Add More Items"}
                  <Plus className="h-4 w-4 ml-2" />
                </Button>
                <Button onClick={handleFinishFlow} disabled={saving} className="flex-1 max-w-[200px]">
                  {createdSubcategories.reduce((total, sub) => total + (sub.items ? sub.items.length : 0), 0) > 0 
                    ? `Finish (${createdSubcategories.reduce((total, sub) => total + (sub.items ? sub.items.length : 0), 0)} items)` 
                    : "Finish"}
                  <Check className="h-4 w-4 ml-2" />
            </Button>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Categories;
