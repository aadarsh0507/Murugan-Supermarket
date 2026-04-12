// API configuration
// Prefer explicit backend URL when available, otherwise fall back to default dev server.
const buildApiBaseUrl = () => {
  const envValue = import.meta.env?.VITE_BACKEND_URL ?? import.meta.env?.VITE_API_URL ?? "";
  const rawUrl = typeof envValue === "string" ? envValue.trim() : "";
  const fallback = "/api";

  const trimTrailingSlash = (value = "") => value.replace(/\/+$/, "");
  const ensureLeadingSlash = (value = "") => (value.startsWith("/") ? value : `/${value}`);
  const ensureApiSuffix = (value = "") => {
    const trimmed = trimTrailingSlash(value);
    return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
  };

  if (!rawUrl) {
    return fallback;
  }

  const hasProtocol = /^https?:\/\//i.test(rawUrl);
  if (hasProtocol) {
    const sanitized = trimTrailingSlash(rawUrl);
    return ensureApiSuffix(sanitized);
  }

  // Relative path support (for legacy setups)
  const normalized = ensureLeadingSlash(rawUrl);
  return ensureApiSuffix(normalized || fallback);
};

const API_BASE_URL = buildApiBaseUrl();

// Helper function to get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

// Helper function to set auth token
const setAuthToken = (token) => {
  localStorage.setItem('authToken', token);
};

// Helper function to remove auth token
const removeAuthToken = () => {
  localStorage.removeItem('authToken');
};

// Generic API request function
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getAuthToken();
  const isFormData = options.body instanceof FormData;

  const defaultHeaders = {
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  if (!isFormData) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const defaultOptions = {
    credentials: 'include',
    headers: defaultHeaders,
  };

  const config = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
  };

  if (isFormData) {
    delete config.headers['Content-Type'];
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.message || 'API request failed');
      error.response = { data };
      error.status = response.status;
      throw error;
    }

    return data;
  } catch (error) {
    if (error.status !== 401) {
      console.error('API Error:', error);
    }
    throw error;
  }
};

// Authentication API
export const authAPI = {
  // Login user
  login: async (email, password, rememberMe = false) => {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, rememberMe }),
    });

    if (response.data?.token) {
      setAuthToken(response.data.token);
    }

    return response;
  },

  // Register user
  register: async (userData) => {
    const response = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    if (response.data?.token) {
      setAuthToken(response.data.token);
    }

    return response;
  },

  // Logout user
  logout: async () => {
    try {
      await apiRequest('/auth/logout', {
        method: 'POST',
      });
    } finally {
      removeAuthToken();
    }
  },

  // Get current user profile
  getProfile: async () => {
    return await apiRequest('/auth/me');
  },

  // Update user profile
  updateProfile: async (profileData) => {
    return await apiRequest('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  },

  // Change password
  changePassword: async (currentPassword, newPassword) => {
    return await apiRequest('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  // Forgot password
  forgotPassword: async (email) => {
    return await apiRequest('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  // Verify OTP
  verifyOTP: async (email, otp) => {
    return await apiRequest('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  },

  // Reset password
  resetPassword: async (email, otp, newPassword) => {
    return await apiRequest('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        email,
        otp,
        newPassword,
      }),
    });
  },
};

// Users API
export const usersAPI = {
  // Get all users
  getUsers: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/users?${queryString}` : '/users';
    return await apiRequest(endpoint);
  },

  // Get user by ID
  getUser: async (userId) => {
    return await apiRequest(`/users/${userId}`);
  },

  // Create user
  createUser: async (userData) => {
    return await apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  // Update user
  updateUser: async (userId, userData) => {
    return await apiRequest(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },

  // Deactivate user
  deleteUser: async (userId) => {
    return await apiRequest(`/users/${userId}`, {
      method: 'DELETE',
    });
  },

  // Activate user
  activateUser: async (userId) => {
    return await apiRequest(`/users/${userId}/activate`, {
      method: 'PUT',
    });
  },

  // Get user statistics
  getUserStats: async () => {
    return await apiRequest('/users/stats/overview');
  },

  // Get selected store for current user
  getSelectedStore: async () => {
    return await apiRequest('/users/selected-store');
  },

  // Set selected store for current user
  setSelectedStore: async (storeId) => {
    return await apiRequest('/users/selected-store', {
      method: 'PUT',
      body: JSON.stringify({ storeId }),
    });
  },
};

// Categories API
// Note: Categories now return itemsCount, inStockCount, lowStockCount, expiringSoonCount
// Items are no longer embedded - use itemsAPI.getItems() with categoryId/subcategoryId filters
export const categoriesAPI = {
  // Get all categories (returns itemsCount, not embedded items)
  // Params: { page, limit, search, isActive, sortBy, sortOrder, store }
  getCategories: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/categories?${queryString}` : '/categories';
    return await apiRequest(endpoint);
  },

  // Get single category
  // Params: { store_id }
  getCategory: async (categoryId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/categories/${categoryId}?${queryString}` : `/categories/${categoryId}`;
    return await apiRequest(endpoint);
  },

  // Create category or subcategory
  createCategory: async (categoryData) => {
    return await apiRequest('/categories', {
      method: 'POST',
      body: JSON.stringify(categoryData),
    });
  },

  // Update category
  updateCategory: async (categoryId, categoryData) => {
    return await apiRequest(`/categories/${categoryId}`, {
      method: 'PUT',
      body: JSON.stringify(categoryData),
    });
  },

  // Delete category
  deleteCategory: async (categoryId) => {
    return await apiRequest(`/categories/${categoryId}`, {
      method: 'DELETE',
    });
  },

  // Toggle category status
  toggleCategoryStatus: async (categoryId) => {
    return await apiRequest(`/categories/${categoryId}/toggle-status`, {
      method: 'PATCH',
    });
  },

  // Get subcategories of a specific category (returns itemsCount, not embedded items)
  getSubcategories: async (categoryId) => {
    return await apiRequest(`/categories/${categoryId}/subcategories`);
  },

  // Get category hierarchy (tree structure)
  // Params: { store_id, include_inactive } — include_inactive shows inactive categories/subcategories
  getCategoryHierarchy: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/categories/hierarchy?${queryString}` : '/categories/hierarchy';
    return await apiRequest(endpoint);
  },

  // Get category statistics
  getCategoryStats: async () => {
    return await apiRequest('/categories/stats/overview');
  },

  // Add subcategory to existing category
  // Note: subcategoryData should include parent_id
  addSubcategory: async (categoryId, subcategoryData) => {
    // Ensure parent_id is included in the data
    const dataWithParent = {
      ...subcategoryData,
      parent_id: categoryId
    };
    return await apiRequest('/categories/subcategories', {
      method: 'POST',
      body: JSON.stringify(dataWithParent),
    });
  },

  // Update existing subcategory (by SubCategoryCode)
  // subcategoryCode: underlying `SubCategoryCode` value (usually numeric or code string)
  // data: { name?, parent_id?, store_id?, isActive? }
  updateSubcategory: async (subcategoryCode, data) => {
    if (!subcategoryCode) {
      throw new Error('Subcategory code is required');
    }
    return await apiRequest(`/categories/subcategories/${encodeURIComponent(subcategoryCode)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete subcategory (by SubCategoryCode)
  deleteSubcategory: async (subcategoryCode) => {
    if (!subcategoryCode) {
      throw new Error('Subcategory code is required');
    }
    return await apiRequest(`/categories/subcategories/${encodeURIComponent(subcategoryCode)}`, {
      method: 'DELETE',
    });
  },

  // Add item to subcategory (now uses items endpoint directly)
  // Note: itemData should include categoryId and subcategoryId
  addItemToSubcategory: async (categoryId, subcategoryId, itemData) => {
    // Include category and subcategory references in item data
    const itemDataWithRefs = {
      ...itemData,
      categoryId,
      subcategoryId
    };
    return await apiRequest('/items', {
      method: 'POST',
      body: JSON.stringify(itemDataWithRefs),
    });
  },
};

// Brands API
export const brandsAPI = {
  // Get all brands
  // Params: { limit, offset, q, store_id, subcategory_id, include_legacy, include_inactive }
  getBrands: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/brands?${queryString}` : '/brands';
    return await apiRequest(endpoint);
  },

  // Get single brand
  getBrand: async (brandId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/brands/${brandId}?${queryString}` : `/brands/${brandId}`;
    return await apiRequest(endpoint);
  },

  // Create brand
  createBrand: async (brandData) => {
    return await apiRequest('/brands', {
      method: 'POST',
      body: JSON.stringify(brandData),
    });
  },

  // Update brand
  updateBrand: async (brandId, brandData) => {
    return await apiRequest(`/brands/${brandId}`, {
      method: 'PUT',
      body: JSON.stringify(brandData),
    });
  },

  // Delete brand
  deleteBrand: async (brandId) => {
    return await apiRequest(`/brands/${brandId}`, {
      method: 'DELETE',
    });
  },
};

// Items API
export const itemsAPI = {
  // Get all items (cursor-based pagination)
  // Params: { cursor, limit, q, store, categoryId, subcategoryId, isActive, sort, sortOrder }
  getItems: async (params = {}) => {
    // Add timestamp to prevent caching
    const paramsWithTimestamp = { ...params, _t: Date.now() };
    const queryString = new URLSearchParams(paramsWithTimestamp).toString();
    const endpoint = queryString ? `/items?${queryString}` : `/items?_t=${Date.now()}`;
    return await apiRequest(endpoint, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });
  },

  // Get items count with filters
  // Params: { store, categoryId, subcategoryId, isActive, q }
  getItemsCount: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/items/count?${queryString}` : '/items/count';
    return await apiRequest(endpoint);
  },

  // Get single item (full details with images and batches)
  getItem: async (itemId) => {
    return await apiRequest(`/items/${itemId}`);
  },

  // Get item by barcode (optional storeId for store-scoped item_overrides)
  getItemByBarcode: async (barcode, { storeId } = {}) => {
    const encoded = encodeURIComponent(barcode);
    const qs =
      storeId != null && storeId !== ''
        ? `?storeId=${encodeURIComponent(String(storeId))}`
        : '';
    return await apiRequest(`/items/barcode/${encoded}${qs}`);
  },

  // Create item
  createItem: async (itemData) => {
    return await apiRequest('/items', {
      method: 'POST',
      body: JSON.stringify(itemData),
    });
  },

  // Update item (now uses direct items endpoint)
  updateItem: async (itemId, itemData) => {
    return await apiRequest(`/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(itemData),
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });
  },

  // Upload item image
  uploadItemImage: async (itemId, formData) => {
    return await apiRequest(`/items/${itemId}/image`, {
      method: 'POST',
      body: formData,
    });
  },

  // Delete item
  deleteItem: async (itemId) => {
    return await apiRequest(`/items/${itemId}`, {
      method: 'DELETE',
    });
  },

  // Toggle item status
  toggleItemStatus: async (itemId) => {
    return await apiRequest(`/items/${itemId}/toggle-status`, {
      method: 'PATCH',
    });
  },

  // Get low stock items
  getLowStockItems: async () => {
    return await apiRequest('/items/low-stock');
  },

  // Get items by subcategory (using cursor pagination)
  getItemsBySubcategory: async (subcategoryId, params = {}) => {
    const queryParams = { ...params, subcategoryId };
    const queryString = new URLSearchParams(queryParams).toString();
    const endpoint = `/items?${queryString}`;
    return await apiRequest(endpoint);
  },

  // Get stock with batches
  getStockWithBatches: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/items/stock-with-batches?${queryString}` : '/items/stock-with-batches';
    return await apiRequest(endpoint);
  },

  // Get item statistics
  getItemStats: async () => {
    return await apiRequest('/items/stats/overview');
  },
};

// Bills API
export const billsAPI = {
  // Create a new bill
  createBill: async (billData) => {
    return await apiRequest('/bills', {
      method: 'POST',
      body: JSON.stringify(billData),
    });
  },

  // Razorpay (UPI) – get public key for checkout
  getRazorpayKey: async () => {
    const res = await apiRequest('/bills/razorpay/key');
    return res?.keyId ?? import.meta.env?.VITE_RAZORPAY_KEY_ID ?? null;
  },

  // Razorpay – create order (amount in rupees)
  createRazorpayOrder: async (amountInRupees, receipt) => {
    return await apiRequest('/bills/razorpay/create-order', {
      method: 'POST',
      body: JSON.stringify({ amount: amountInRupees, receipt: receipt || undefined }),
    });
  },

  // Razorpay – verify payment after success
  verifyRazorpayPayment: async (razorpay_order_id, razorpay_payment_id, razorpay_signature) => {
    return await apiRequest('/bills/razorpay/verify', {
      method: 'POST',
      body: JSON.stringify({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      }),
    });
  },

  // Get all bills
  getBills: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/bills?${queryString}` : '/bills';
    return await apiRequest(endpoint);
  },

  // Get bill by ID
  getBill: async (billId) => {
    return await apiRequest(`/bills/${billId}`);
  },

  // Get bill by bill number
  getBillByNumber: async (billNo) => {
    if (!billNo) {
      throw new Error('Bill number is required');
    }
    return await apiRequest(`/bills/number/${encodeURIComponent(billNo)}`);
  },

  // Get daily sales summary
  getDailySalesSummary: async (date) => {
    return await apiRequest(`/bills/summary/${date}`);
  },

  // Get low stock items
  getLowStockItems: async () => {
    return await apiRequest('/bills/low-stock');
  },

  // Get items with no movement
  getNoMovementItems: async () => {
    return await apiRequest('/bills/no-movement');
  },

  // Get latest customer details by phone
  getCustomerByPhone: async (phone, params = {}) => {
    if (!phone) {
      throw new Error('Customer phone is required');
    }
    const query = new URLSearchParams();
    if (params.storeId) {
      query.set('storeId', params.storeId);
    }
    const queryString = query.toString();
    const endpoint = queryString
      ? `/bills/customer/by-phone/${encodeURIComponent(phone)}?${queryString}`
      : `/bills/customer/by-phone/${encodeURIComponent(phone)}`;
    return await apiRequest(endpoint);
  },
};

// Mobile App Orders API - backed by `orders` table (Super_Mart_Mobile_app DB)
export const ordersAPI = {
  // Get all mobile app orders
  getOrders: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    // Backend route is /mobile-orders → proxied as /api/mobile-orders
    const endpoint = queryString ? `/mobile-orders?${queryString}` : '/mobile-orders';
    return await apiRequest(endpoint);
  },

  // Get single mobile app order by ID
  getOrder: async (orderId) => {
    if (!orderId) {
      throw new Error('Order ID is required');
    }
    return await apiRequest(`/mobile-orders/${orderId}`);
  },

  // Update order status for a mobile app order
  updateOrderStatus: async (orderId, status) => {
    if (!orderId) {
      throw new Error('Order ID is required');
    }
    if (!status) {
      throw new Error('Order status is required');
    }
    return await apiRequest(`/mobile-orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  // Update delivery-related metadata for a mobile app order
  updateOrderMeta: async (orderId, meta = {}) => {
    if (!orderId) {
      throw new Error('Order ID is required');
    }
    return await apiRequest(`/mobile-orders/${orderId}/meta`, {
      method: 'PATCH',
      body: JSON.stringify(meta),
    });
  },

  // Get global delivery settings for mobile app
  getDeliverySettings: async () => {
    return await apiRequest('/mobile-orders/settings');
  },

  // Update global delivery settings for mobile app
  updateDeliverySettings: async (settings) => {
    return await apiRequest('/mobile-orders/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  // Get return requests from mobile app (order_returns table). Optional: { orderId } to filter by order.
  getReturnRequests: async (params = {}) => {
    const queryString = new URLSearchParams();
    if (params.orderId != null) queryString.set('orderId', params.orderId);
    const qs = queryString.toString();
    const endpoint = qs ? `/mobile-orders/returns?${qs}` : '/mobile-orders/returns';
    return await apiRequest(endpoint);
  },

  // Update status of a specific return request (owner/admin decision)
  updateReturnRequestStatus: async (returnId, status) => {
    if (!returnId) throw new Error('Return ID is required');
    if (!status) throw new Error('Status is required');
    return await apiRequest(`/mobile-orders/returns/${returnId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  // Submit order return (reason + optional image). Pass FormData with returnReason and optional 'image' file.
  submitOrderReturn: async (orderId, formData) => {
    if (!orderId) throw new Error('Order ID is required');
    if (!(formData instanceof FormData)) {
      const fd = new FormData();
      if (formData?.returnReason != null) fd.append('returnReason', formData.returnReason);
      if (formData?.image instanceof File) fd.append('image', formData.image);
      formData = fd;
    }
    return await apiRequest(`/mobile-orders/${orderId}/return`, {
      method: 'PATCH',
      body: formData,
    });
  },
};

// Suppliers API
const splitContactName = (fullName = "") => {
  if (!fullName || typeof fullName !== "string") {
    return { firstName: "", lastName: "" };
  }

  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }

  const firstName = parts.shift() ?? "";
  const lastName = parts.join(" ");
  return { firstName, lastName };
};

const normalizeSupplierRecord = (supplier = {}) => {
  if (!supplier || typeof supplier !== "object") {
    return null;
  }

  const supplierCode =
    supplier.supplierCode ??
    supplier.Suppliercode ??
    supplier.SupplierCode ??
    supplier._id ??
    supplier.id ??
    null;

  const structuredContact =
    supplier.contactPerson && typeof supplier.contactPerson === "object"
      ? supplier.contactPerson
      : null;
  const fallbackContactName =
    supplier.Contactperson1 ??
    supplier.CONTACTPERSON1 ??
    supplier.Contactperson ??
    supplier.contact_person ??
    supplier.contact ??
    "";
  const { firstName, lastName } = structuredContact
    ? {
      firstName: structuredContact.firstName ?? "",
      lastName: structuredContact.lastName ?? "",
    }
    : splitContactName(fallbackContactName);

  const contactPerson = {
    firstName,
    lastName,
    designation:
      (structuredContact && structuredContact.designation) ??
      supplier.CP1Designation ??
      supplier.contactDesignation ??
      "",
  };

  const structuredPhone =
    supplier.phone && typeof supplier.phone === "object"
      ? supplier.phone
      : null;
  const primaryPhone =
    (structuredPhone && structuredPhone.primary) ??
    supplier.Phone ??
    supplier.phone ??
    supplier.PHONENO ??
    supplier.Phoneno ??
    supplier.Mobilenumber ??
    supplier.MOBILENUMBER ??
    "";
  const secondaryPhone =
    (structuredPhone && structuredPhone.secondary) ??
    supplier.SecondaryPhone ??
    "";

  const structuredAddress =
    supplier.address && typeof supplier.address === "object"
      ? supplier.address
      : null;

  const address = {
    street:
      (structuredAddress && structuredAddress.street) ??
      supplier.Address1 ??
      supplier.STREET ??
      supplier.Street ??
      "",
    city:
      (structuredAddress && structuredAddress.city) ??
      supplier.Citycode ??
      supplier.CITY ??
      supplier.City ??
      "",
    state:
      (structuredAddress && structuredAddress.state) ??
      (supplier.State !== undefined && supplier.State !== null
        ? String(supplier.State)
        : supplier.STATE !== undefined && supplier.STATE !== null
          ? String(supplier.STATE)
          : ""),
    zipCode:
      (structuredAddress && structuredAddress.zipCode) ??
      (supplier.Pincode !== undefined && supplier.Pincode !== null
        ? String(supplier.Pincode)
        : supplier.PINCODE !== undefined && supplier.PINCODE !== null
          ? String(supplier.PINCODE)
          : ""),
    country:
      (structuredAddress && structuredAddress.country) ??
      supplier.addressCountry ??
      supplier.COUNTRY ??
      supplier.Country ??
      "India",
  };

  const normalizeBoolean = (value, defaultValue = true) => {
    if (value === undefined || value === null || value === "") {
      return defaultValue;
    }
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      return value !== 0;
    }
    const normalized = String(value).trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
    return defaultValue;
  };

  const normalized = {
    ...supplier,
    _id:
      supplier._id ??
      (supplierCode !== null && supplierCode !== undefined
        ? String(supplierCode)
        : undefined),
    supplierCode:
      supplierCode !== null && supplierCode !== undefined
        ? String(supplierCode)
        : undefined,
    companyName: supplier.companyName ?? supplier.Suppliername ?? "",
    contactPerson,
    email: supplier.email ?? supplier.Email ?? supplier.EMAIL ?? "",
    phone: {
      primary:
        primaryPhone !== undefined && primaryPhone !== null
          ? String(primaryPhone)
          : "",
      secondary:
        secondaryPhone !== undefined && secondaryPhone !== null
          ? String(secondaryPhone)
          : "",
    },
    address,
    gstNumber: supplier.gstNumber ?? supplier.GSTNumber ?? supplier.Tngstnumber ?? supplier.TINNO ?? supplier.Tinno ?? "",
    panNumber: supplier.panNumber ?? supplier.PANNumber ?? supplier.PAN ?? supplier.Pannumber ?? "",
    creditLimit: supplier.creditLimit ?? supplier.Creditterms ?? "",
    paymentTerms: supplier.paymentTerms ?? supplier.Paymentofweek ?? "",
    notes: supplier.notes ?? supplier.Remarks ?? "",
    isActive: normalizeBoolean(
      supplier.isActive ??
      supplier.IsActive ??
      supplier.active ??
      supplier.status
    ),
    stores: Array.isArray(supplier.stores) ? supplier.stores : [],
    // Preserve store_id from database
    store_id: supplier.store_id ?? supplier.storeId ?? null,
  };

  return normalized;
};

const normalizeSupplierList = (payload) => {
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload.map(normalizeSupplierRecord).filter(Boolean);
};

const normalizeSuppliersResponse = (response) => {
  const candidates = [
    response?.data?.suppliers,
    response?.data?.data?.suppliers,
    response?.data?.data,
    response?.data,
    response,
  ];

  const firstArray = candidates.find(Array.isArray) || [];
  const suppliers = normalizeSupplierList(firstArray);

  if (response && typeof response === "object" && !Array.isArray(response)) {
    const baseData =
      response.data && typeof response.data === "object" && !Array.isArray(response.data)
        ? response.data
        : {};

    return {
      ...response,
      data: {
        ...baseData,
        suppliers,
      },
    };
  }

  return {
    data: {
      suppliers,
    },
  };
};

const normalizeSupplierResponse = (response) => {
  const candidate =
    response?.data?.supplier ??
    response?.data?.data ??
    response?.data ??
    response;
  const supplier = normalizeSupplierRecord(candidate) ?? {};

  if (response && typeof response === "object" && !Array.isArray(response)) {
    return {
      ...response,
      data: supplier,
    };
  }

  return { data: supplier };
};

export const suppliersAPI = {
  // Get all suppliers
  getSuppliers: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/suppliers?${queryString}` : '/suppliers';
    const response = await apiRequest(endpoint);
    return normalizeSuppliersResponse(response);
  },

  // Get single supplier
  getSupplier: async (supplierId) => {
    const response = await apiRequest(`/suppliers/${supplierId}`);
    return normalizeSupplierResponse(response);
  },

  // Create supplier
  createSupplier: async (supplierData) => {
    const response = await apiRequest('/suppliers', {
      method: 'POST',
      body: JSON.stringify(supplierData),
    });
    return normalizeSupplierResponse(response);
  },

  // Update supplier
  updateSupplier: async (supplierId, supplierData) => {
    const response = await apiRequest(`/suppliers/${supplierId}`, {
      method: 'PUT',
      body: JSON.stringify(supplierData),
    });
    return normalizeSupplierResponse(response);
  },

  // Delete supplier
  deleteSupplier: async (supplierId) => {
    return await apiRequest(`/suppliers/${supplierId}`, {
      method: 'DELETE',
    });
  },

  // Toggle supplier status
  toggleSupplierStatus: async (supplierId) => {
    return await apiRequest(`/suppliers/${supplierId}/toggle-status`, {
      method: 'PATCH',
    });
  },

  // Add store to supplier
  addStoreToSupplier: async (supplierId, storeId) => {
    const response = await apiRequest(`/suppliers/${supplierId}/stores`, {
      method: 'POST',
      body: JSON.stringify({ storeId }),
    });
    return normalizeSupplierResponse(response);
  },

  // Remove store from supplier
  removeStoreFromSupplier: async (supplierId, storeId) => {
    const response = await apiRequest(`/suppliers/${supplierId}/stores/${storeId}`, {
      method: 'DELETE',
    });
    return normalizeSupplierResponse(response);
  },

  // Get all stores
  getStores: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/suppliers/stores?${queryString}` : '/suppliers/stores';
    const response = await apiRequest(endpoint);
    return (
      response?.data?.stores ||
      response?.stores ||
      response?.data ||
      []
    );
  },

  // Create store
  createStore: async (storeData) => {
    return await apiRequest('/suppliers/stores', {
      method: 'POST',
      body: JSON.stringify(storeData),
    });
  },

  // Update store
  updateStore: async (storeId, storeData) => {
    return await apiRequest(`/suppliers/stores/${storeId}`, {
      method: 'PUT',
      body: JSON.stringify(storeData),
    });
  },

  // Delete store
  deleteStore: async (storeId) => {
    return await apiRequest(`/suppliers/stores/${storeId}`, {
      method: 'DELETE',
    });
  },
};

// Purchase Orders API
export const purchaseOrdersAPI = {
  // Get all purchase orders
  getPurchaseOrders: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/purchase-orders?${queryString}` : '/purchase-orders';
    return await apiRequest(endpoint);
  },

  // Get single purchase order
  getPurchaseOrder: async (poId) => {
    return await apiRequest(`/purchase-orders/${poId}`);
  },

  // Create purchase order
  createPurchaseOrder: async (poData) => {
    return await apiRequest('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(poData),
    });
  },

  // Update purchase order
  updatePurchaseOrder: async (poId, poData) => {
    return await apiRequest(`/purchase-orders/${poId}`, {
      method: 'PUT',
      body: JSON.stringify(poData),
    });
  },

  // Delete purchase order
  deletePurchaseOrder: async (poId) => {
    return await apiRequest(`/purchase-orders/${poId}`, {
      method: 'DELETE',
    });
  },

  // Receive purchase order (update stock)
  receivePurchaseOrder: async (poId, receivedItems = []) => {
    return await apiRequest(`/purchase-orders/${poId}/receive`, {
      method: 'PATCH',
      body: JSON.stringify({ receivedItems }),
    });
  },

  // Get barcodes for a purchase order
  getPurchaseOrderBarcodes: async (poId) => {
    return await apiRequest(`/purchase-orders/${poId}/barcodes`);
  },

  // Regenerate barcodes for a purchase order
  regeneratePurchaseOrderBarcodes: async (poId) => {
    return await apiRequest(`/purchase-orders/${poId}/regenerate-barcodes`, {
      method: 'POST',
    });
  },
};

// Credits API
export const creditsAPI = {
  // Get all credits
  getCredits: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/credits?${queryString}` : '/credits';
    return await apiRequest(endpoint);
  },

  // Get single credit
  getCredit: async (creditId) => {
    return await apiRequest(`/credits/${creditId}`);
  },

  // Create credit from purchase order
  createCredit: async (purchaseOrderId, initialPayment = 0, notes = '', additionalData = {}) => {
    return await apiRequest('/credits', {
      method: 'POST',
      body: JSON.stringify({
        purchaseOrderId,
        initialPayment,
        notes,
        ...additionalData // Include poNumber, orderDate, originalAmount, supplierId, supplierName, storeId
      }),
    });
  },

  // Update credit original amount
  updateCreditAmount: async (creditId, newAmount, notes = '') => {
    return await apiRequest(`/credits/${creditId}/amount`, {
      method: 'PUT',
      body: JSON.stringify({ newAmount, notes }),
    });
  },

  // Update credit payment
  updateCreditPayment: async (creditId, paymentAmount, notes = '', paymentMode = 'cash') => {
    return await apiRequest(`/credits/${creditId}/payment`, {
      method: 'PUT',
      body: JSON.stringify({ paymentAmount, notes, paymentMode }),
    });
  },

  // Delete credit
  deleteCredit: async (creditId) => {
    return await apiRequest(`/credits/${creditId}`, {
      method: 'DELETE',
    });
  },

  // Get credits summary by supplier
  getCreditsSummaryBySupplier: async (supplierId) => {
    return await apiRequest(`/credits/summary/${supplierId}`);
  },
};

// Customer Credits API
export const customerCreditsAPI = {
  // Get all customer credits
  getCustomerCredits: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/customer-credits?${queryString}` : '/customer-credits';
    return await apiRequest(endpoint);
  },

  // Get single customer credit
  getCustomerCredit: async (creditId) => {
    return await apiRequest(`/customer-credits/${creditId}`);
  },

  // Create customer credit from bill
  createCustomerCredit: async (billId, customerData, initialPayment = 0, notes = '') => {
    return await apiRequest('/customer-credits', {
      method: 'POST',
      body: JSON.stringify({
        billId,
        ...customerData,
        initialPayment,
        notes
      }),
    });
  },

  // Update customer credit amount
  updateCustomerCreditAmount: async (creditId, newAmount, notes = '') => {
    return await apiRequest(`/customer-credits/${creditId}/amount`, {
      method: 'PUT',
      body: JSON.stringify({ newAmount, notes }),
    });
  },

  // Update detailed credit overrides (items, GST, notes) and optionally amount
  updateCustomerCreditDetail: async (creditId, detail) => {
    return await apiRequest(`/customer-credits/${creditId}/detail`, {
      method: 'PUT',
      body: JSON.stringify(detail),
    });
  },

  // Update customer credit payment
  updateCustomerCreditPayment: async (creditId, paymentAmount, notes = '', paymentMode = 'cash') => {
    return await apiRequest(`/customer-credits/${creditId}/payment`, {
      method: 'PUT',
      body: JSON.stringify({ paymentAmount, notes, paymentMode }),
    });
  },

  // Toggle credit visibility (hide/show)
  toggleCreditVisibility: async (creditId, isHidden = true) => {
    return await apiRequest(`/customer-credits/${creditId}/hide`, {
      method: 'PUT',
      body: JSON.stringify({ isHidden }),
    });
  },

  // Delete customer credit
  deleteCustomerCredit: async (creditId) => {
    return await apiRequest(`/customer-credits/${creditId}`, {
      method: 'DELETE',
    });
  },

  // Get customer by phone number
  getCustomerByPhone: async (phone) => {
    return await apiRequest(`/customer-credits/customer-by-phone/${encodeURIComponent(phone)}`);
  },
};

// Barcodes API
export const barcodesAPI = {
  // Get item by barcode
  getItemByBarcode: async (barcode) => {
    return await apiRequest(`/barcodes/${barcode}`);
  },
};

// Dashboard API
export const dashboardAPI = {
  // Get dashboard statistics for selected store
  getDashboardStats: async () => {
    return await apiRequest('/dashboard/stats');
  },
  getTotalSuppliersCount: async () => {
    return await apiRequest('/dashboard/suppliers/total');
  },
  getStoreItemsCount: async () => {
    return await apiRequest('/dashboard/items/total');
  },
};

// Screens API
export const screensAPI = {
  getScreens: async (params = {}) => {
    const query = params.includeInactive ? '?includeInactive=true' : '';
    return await apiRequest(`/screens${query}`);
  },
};

// Health check
export const healthCheck = async () => {
  return await apiRequest('/health');
};

// Sync API - initiate sync from local (mobile app) DB to global DB.
// Progress is streamed via SSE from /api/sync-to-global/stream.
export const syncAPI = {
  startSyncToGlobal: async () => {
    return await apiRequest('/sync-to-global', {
      method: 'POST',
    });
  },
};

// Export utility functions
export { API_BASE_URL, getAuthToken, setAuthToken, removeAuthToken, apiRequest };
