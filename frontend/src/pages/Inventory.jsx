import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Edit, Trash2, Package, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const mockInventory = [
  {
    id: "1",
    name: "Fresh Milk",
    category: "Dairy",
    barcode: "8901234567890",
    quantity: 45,
    costPrice: 45,
    sellingPrice: 55,
    supplier: "Amul",
    expiryDate: "2025-11-30",
  },
  {
    id: "2",
    name: "Whole Wheat Bread",
    category: "Bakery",
    barcode: "8901234567891",
    quantity: 12,
    costPrice: 30,
    sellingPrice: 40,
    supplier: "Modern Bakery",
    expiryDate: "2025-11-05",
  },
  {
    id: "3",
    name: "Basmati Rice 5kg",
    category: "Groceries",
    barcode: "8901234567892",
    quantity: 120,
    costPrice: 450,
    sellingPrice: 550,
    supplier: "India Gate",
    expiryDate: "2026-10-30",
  },
];

export default function Inventory() {
  const { toast } = useToast();
  const [inventory, setInventory] = useState(mockInventory);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});

  const filteredInventory = inventory.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.barcode.includes(searchTerm) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddNew = () => {
    setEditingItem(null);
    setFormData({});
    setIsModalOpen(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData(item);
    setIsModalOpen(true);
  };

  const handleDelete = (item) => {
    setInventory(inventory.filter((i) => i.id !== item.id));
    toast({
      title: "Item Deleted",
      description: `${item.name} has been removed from inventory`,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (editingItem) {
      setInventory(
        inventory.map((item) =>
          item.id === editingItem.id ? { ...item, ...formData } : item
        )
      );
      toast({
        title: "Item Updated",
        description: "Inventory item has been updated successfully",
      });
    } else {
      const newItem = {
        id: Date.now().toString(),
        ...formData,
      };
      setInventory([...inventory, newItem]);
      toast({
        title: "Item Added",
        description: "New item has been added to inventory",
      });
    }
    
    setIsModalOpen(false);
  };

  const columns = [
    { key: "name", header: "Item Name" },
    { key: "category", header: "Category" },
    { key: "barcode", header: "Barcode" },
    {
      key: "quantity",
      header: "Quantity",
      render: (item) => (
        <div className="flex items-center gap-2">
          <span>{item.quantity}</span>
          {item.quantity < 20 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Low
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "costPrice",
      header: "Cost Price",
      render: (item) => `₹${item.costPrice}`,
    },
    {
      key: "sellingPrice",
      header: "Selling Price",
      render: (item) => `₹${item.sellingPrice}`,
    },
    { key: "supplier", header: "Supplier" },
    { key: "expiryDate", header: "Expiry Date" },
    {
      key: "actions",
      header: "Actions",
      render: (item) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(item);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(item);
            }}
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
          <h1 className="text-2xl sm:text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Manage your stock and products</p>
        </motion.div>
        <Button onClick={handleAddNew} className="bg-gradient-primary w-full sm:w-auto min-h-11 touch-target-y">
          <Plus className="h-4 w-4 mr-2" />
          Add New Item
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
            placeholder="Search by name, barcode, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 min-h-11"
          />
        </div>
        <Select>
          <SelectTrigger className="w-full sm:w-48 min-h-11">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="dairy">Dairy</SelectItem>
            <SelectItem value="bakery">Bakery</SelectItem>
            <SelectItem value="groceries">Groceries</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <DataTable data={filteredInventory} columns={columns} />
      </motion.div>

      <Modal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        title={editingItem ? "Edit Item" : "Add New Item"}
        description="Enter the item details below"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Item Name</Label>
            <Input
              id="name"
              value={formData.name || ""}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category || ""}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode</Label>
              <Input
                id="barcode"
                value={formData.barcode || ""}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                value={formData.quantity || ""}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="costPrice">Cost Price</Label>
              <Input
                id="costPrice"
                type="number"
                value={formData.costPrice || ""}
                onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sellingPrice">Selling Price</Label>
              <Input
                id="sellingPrice"
                type="number"
                value={formData.sellingPrice || ""}
                onChange={(e) => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Input
                id="supplier"
                value={formData.supplier || ""}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiryDate">Expiry Date</Label>
              <Input
                id="expiryDate"
                type="date"
                value={formData.expiryDate || ""}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1 bg-gradient-primary">
              {editingItem ? "Update Item" : "Add Item"}
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
