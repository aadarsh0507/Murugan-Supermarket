import fs from 'fs';
import path from 'path';
import {
  listItems,
  getItemById as getItemByIdRepo,
  createItem as createItemRepo,
  updateItem as updateItemRepo,
  deleteItem as deleteItemRepo,
  findItemByBarcode as findItemByBarcodeRepo,
  getStockWithBatches as getStockWithBatchesRepo,
  syncLegacyProductRecord as syncLegacyProductRecordRepo
} from '../repositories/itemRepository.js';
import { uploadsRootDir } from '../utils/uploads.js';

const trimTrailingSlash = (value = '') => String(value).replace(/\/+$/, '');

const isHttpUrl = (value = '') => /^https?:\/\//i.test(String(value).trim());

const sanitizeItemImageSource = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().replace(/\\/g, '/');
};

const buildLocalItemImageCandidates = (imageSource) => {
  const normalized = sanitizeItemImageSource(imageSource);
  if (!normalized || isHttpUrl(normalized)) {
    return [];
  }

  const withoutQuery = normalized.split('?')[0].split('#')[0];
  const cleaned = withoutQuery.replace(/^\/+/, '');
  const fileName = path.posix.basename(cleaned);
  const matches = [];

  const addCandidate = (candidate) => {
    if (!candidate || typeof candidate !== 'string') {
      return;
    }

    const normalizedCandidate = candidate.replace(/^\/+/, '');
    if (!normalizedCandidate || matches.includes(normalizedCandidate)) {
      return;
    }

    matches.push(normalizedCandidate);
  };

  addCandidate(cleaned);

  const uploadsMatch = cleaned.match(/(?:^|\/)uploads\/(.+)/i);
  if (uploadsMatch?.[1]) {
    addCandidate(uploadsMatch[1]);
  }

  if (/^items\//i.test(cleaned)) {
    addCandidate(cleaned.replace(/^items\//i, ''));
  }

  if (!/^items\//i.test(cleaned) && fileName) {
    addCandidate(`items/${fileName}`);
  }

  return matches
    .map((relativePath) => path.resolve(uploadsRootDir, relativePath))
    .filter((absolutePath) => absolutePath.startsWith(uploadsRootDir));
};

const resolveLocalItemImagePath = (imageSource) => {
  const candidates = buildLocalItemImageCandidates(imageSource);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
};

const buildRequestBaseUrl = (req) => {
  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
  const protocol = forwardedProto || req.protocol || 'http';
  const host = forwardedHost || req.get('host');

  return host ? `${protocol}://${host}` : '';
};

const buildPublicItemImageUrl = (req, imageSource) => {
  const normalized = sanitizeItemImageSource(imageSource);
  if (!normalized) {
    return null;
  }

  if (isHttpUrl(normalized)) {
    return normalized;
  }

  const configuredBaseUrl =
    process.env.ITEM_IMAGE_BASE_URL ||
    process.env.UPLOADS_BASE_URL ||
    process.env.BACKEND_PUBLIC_URL ||
    process.env.API_PUBLIC_URL ||
    '';

  const baseUrl = trimTrailingSlash(configuredBaseUrl || buildRequestBaseUrl(req));
  if (!baseUrl) {
    return normalized;
  }

  return `${baseUrl}/api/items/image?src=${encodeURIComponent(normalized)}`;
};

const normalizeItemImage = (item, req) => {
  if (!item || typeof item !== 'object') {
    return item;
  }

  const savedImagePath = item.imageUrl ?? item.image_url ?? null;
  if (!savedImagePath) {
    return item;
  }

  return {
    ...item,
    imageUrl: buildPublicItemImageUrl(req, savedImagePath),
    imagePath: sanitizeItemImageSource(savedImagePath)
  };
};

const normalizeItemsResponse = (items, req) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => normalizeItemImage(item, req));
};

const parseNumber = (value, defaultValue = undefined) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : defaultValue;
};

const parseBoolean = (value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;
  return undefined;
};

const buildPagination = ({ offset = 0, limit = 0, total = 0, itemsLength = 0 }) => {
  const hasNext = offset + itemsLength < total;
  return {
    total,
    limit,
    offset,
    hasNext,
    nextCursor: hasNext ? offset + itemsLength : null
  };
};

export const serveItemImage = async (req, res) => {
  try {
    const imageSource = req.query.src || req.query.imageUrl || req.query.image_url;

    if (!imageSource || typeof imageSource !== 'string') {
      return res.status(400).json({
        status: 'error',
        message: 'Image source is required'
      });
    }

    const normalizedSource = sanitizeItemImageSource(imageSource);

    if (isHttpUrl(normalizedSource)) {
      const upstreamResponse = await fetch(normalizedSource);
      if (!upstreamResponse.ok) {
        return res.status(404).json({
          status: 'error',
          message: 'Item image not found'
        });
      }

      const contentType = upstreamResponse.headers.get('content-type');
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }

      const arrayBuffer = await upstreamResponse.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    }

    const localImagePath = resolveLocalItemImagePath(normalizedSource);
    if (localImagePath) {
      return res.sendFile(localImagePath);
    }

    return res.status(404).json({
      status: 'error',
      message: 'Item image not found'
    });
  } catch (error) {
    console.error('Serve item image error:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to load item image'
    });
  }
};

const normalizeItemPayload = (body = {}, req = null) => {
  // Get store_id from request user or body
  let storeId = parseNumber(body.store_id ?? body.storeId);
  if (!storeId && req) {
    storeId =
      parseNumber(req.user?.selectedStore?.id ?? req.user?.selectedStore?._id) ??
      parseNumber(req.user?.selectedStoreId);
  }
  
  // Build payload, only including fields that are explicitly provided (not undefined)
  const payload = {};
  
  // Only include fields that are actually provided in the request
  if (body.itemCode !== undefined) payload.itemCode = body.itemCode?.trim() || null;
  if (body.sku !== undefined) payload.sku = body.sku?.trim() || null;
  
  // Name
  if (body.name !== undefined) {
    const trimmedName = body.name?.trim();
    payload.name = trimmedName || null;
  }
  
  // Description
  if (body.description !== undefined) {
    const trimmedDesc = body.description?.trim();
    payload.description = trimmedDesc || null;
  }
  
  // Brand - support both brandId (for brand selection) and brand (for text input)
  if (body.brandId !== undefined || body.brand !== undefined) {
    if (body.brandId !== undefined && body.brandId !== null && body.brandId !== '') {
      // Use brandId if provided (for brand selection from dropdown)
      payload.brandId = String(body.brandId).trim() || null;
    } else if (body.brand !== undefined) {
      // Fallback to brand string if brandId not provided
      const trimmedBrand = body.brand?.trim();
      payload.brand = trimmedBrand || null;
    }
  }
  
  // Category ID - handle empty string, null, and undefined
  if (body.categoryId !== undefined || body.category !== undefined) {
    const catId = body.categoryId ?? body.category;
    if (catId === null || catId === '' || catId === undefined) {
      payload.categoryId = null;
    } else {
      payload.categoryId = parseNumber(catId, null);
    }
  }
  
  // Subcategory ID - handle empty string, null, and undefined
  // Note: subcategoryId can be in composite format "categoryCode:subcategoryCode" (string) or just the code
  // Don't parse as number since it might contain colons for composite IDs
  if (body.subcategoryId !== undefined || body.subcategory !== undefined || body.subCategoryId !== undefined) {
    const subcatId = body.subcategoryId ?? body.subcategory ?? body.subCategoryId;
    if (subcatId === null || subcatId === '' || subcatId === undefined) {
      payload.subcategoryId = null;
    } else {
      // Keep as string to preserve composite format like "51:34"
      // The repository will extract the code part if needed
      payload.subcategoryId = String(subcatId).trim() || null;
    }
  }
  
  // Unit
  if (body.unit !== undefined || body.uom !== undefined) {
    const unitValue = body.unit ?? body.uom;
    payload.unit = unitValue?.trim() || null;
  }
  
  // Cost Price
  if (body.costPrice !== undefined || body.purchasePrice !== undefined) {
    const costPrice = body.costPrice ?? body.purchasePrice;
    payload.costPrice = parseNumber(costPrice, 0);
  }
  
  // Selling Price
  if (body.sellingPrice !== undefined || body.price !== undefined) {
    const sellingPrice = body.sellingPrice ?? body.price;
    payload.sellingPrice = parseNumber(sellingPrice, 0);
  }
  
  // MRP
  if (body.mrp !== undefined) {
    payload.mrp = parseNumber(body.mrp, 0);
  }
  
  // Reorder Level
  if (body.reorderLevel !== undefined || body.minStock !== undefined) {
    const reorderLevel = body.reorderLevel ?? body.minStock;
    payload.reorderLevel = parseNumber(reorderLevel, 0);
  }

  // Minimum Stock (explicit)
  if (body.minStock !== undefined) {
    payload.minStock = parseNumber(body.minStock, 0);
  }

  // Maximum Stock
  if (body.maxStock !== undefined) {
    payload.maxStock = parseNumber(body.maxStock, 0);
  }
  
  // GST Rate
  if (body.gstRate !== undefined || body.taxRate !== undefined || body.tax !== undefined) {
    const gstRate = body.gstRate ?? body.taxRate ?? body.tax;
    payload.gstRate = parseNumber(gstRate, 0);
  }
  
  // HSN Code
  if (body.hsnCode !== undefined) {
    const trimmedHsn = body.hsnCode?.trim();
    payload.hsnCode = trimmedHsn || null;
  }
  
  // Barcode
  if (body.barcode !== undefined) {
    const trimmedBarcode = body.barcode?.trim();
    payload.barcode = trimmedBarcode || null;
  }
  
  // Notes
  if (body.notes !== undefined) {
    const trimmedNotes = body.notes?.trim();
    payload.notes = trimmedNotes || null;
  }

  // Buy-one-get / BOGO offer label (shown on item cards)
  if (body.bogoOffer !== undefined) {
    if (body.bogoOffer === null || body.bogoOffer === '') {
      payload.bogoOffer = null;
    } else {
      const trimmed = String(body.bogoOffer).trim();
      payload.bogoOffer = trimmed || null;
    }
  }
  
  // Is Active
  if (body.isActive !== undefined) {
    payload.isActive = Boolean(body.isActive);
  }
  
  // Store ID
  if (storeId !== undefined && storeId !== null) {
    payload.storeId = storeId;
  }
  
  return payload;
};

export const getAllItems = async (req, res) => {
  try {
    // Set cache-control headers to prevent 304 responses
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    const limit = Math.min(parseNumber(req.query.limit, 50) || 50, 200);
    const cursor = parseNumber(req.query.cursor, 0) || 0;
    const search = req.query.q?.trim() || req.query.search?.trim() || undefined;
    const categoryId = parseNumber(req.query.categoryId);
    const subcategoryId = parseNumber(req.query.subcategoryId ?? req.query.subcategory);
    const isActive = parseBoolean(req.query.isActive);
    const storeId = parseNumber(req.user?.selectedStore?.id ?? req.user?.selectedStore?._id ?? req.query.storeId);

    const { items, total } = await listItems({
      search,
      categoryId,
      subcategoryId,
      isActive,
      storeId,
      limit,
      offset: cursor
    });

    const pagination = buildPagination({
      limit,
      offset: cursor,
      total,
      itemsLength: items.length
    });

    const normalizedItems = normalizeItemsResponse(items, req);

    return res.status(200).json({
      status: 'success',
      data: {
        items: normalizedItems,
        pagination
      }
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching items'
    });
  }
};

export const getItemById = async (req, res) => {
  try {
    const itemId = parseNumber(req.params.id);
    if (!itemId) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid item id'
      });
    }

    const storeId =
      parseNumber(req.query.storeId ?? req.query.store_id) ??
      parseNumber(req.user?.selectedStore?.id ?? req.user?.selectedStore?._id);
    const item = await getItemByIdRepo(itemId, storeId);
    if (!item) {
      return res.status(404).json({
        status: 'error',
        message: 'Item not found'
      });
    }

    res.json({
      status: 'success',
      data: { item: normalizeItemImage(item, req) }
    });
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching item'
    });
  }
};

export const getItemByBarcode = async (req, res) => {
  try {
    const barcode = req.params.barcode?.trim();
    if (!barcode) {
      return res.status(400).json({
        status: 'error',
        message: 'Barcode is required'
      });
    }

    const storeId =
      parseNumber(req.query.storeId ?? req.query.store_id) ??
      parseNumber(req.user?.selectedStore?.id ?? req.user?.selectedStore?._id);
    const item = await findItemByBarcodeRepo(barcode, storeId);
    if (!item) {
      return res.status(404).json({
        status: 'error',
        message: 'Item not found for the provided barcode'
      });
    }

    res.json({
      status: 'success',
      data: { item: normalizeItemImage(item, req) }
    });
  } catch (error) {
    console.error('Error fetching item by barcode:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching item by barcode'
    });
  }
};

export const getItemsCount = async (req, res) => {
  try {
    const search = req.query.q?.trim() || req.query.search?.trim() || undefined;
    const categoryId = parseNumber(req.query.categoryId);
    const subcategoryId = parseNumber(req.query.subcategoryId ?? req.query.subcategory);
    const isActive = parseBoolean(req.query.isActive);
    const storeId = parseNumber(req.user?.selectedStore?.id ?? req.user?.selectedStore?._id ?? req.query.storeId);

    const { total } = await listItems({
      search,
      categoryId,
      subcategoryId,
      isActive,
      storeId,
      limit: 0,
      offset: 0
    });

    res.json({
      status: 'success',
      data: { count: total }
    });
  } catch (error) {
    console.error('Error getting items count:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while getting items count'
    });
  }
};

export const createItem = async (req, res) => {
  try {
    const payload = normalizeItemPayload(req.body, req);
    if (!payload.name) {
      return res.status(400).json({
        status: 'error',
        message: 'Item name is required'
      });
    }

    // Validate that selling price is less than or equal to MRP
    if (payload.sellingPrice !== undefined && payload.mrp !== undefined && 
        payload.mrp > 0 && payload.sellingPrice > payload.mrp) {
      return res.status(400).json({
        status: 'error',
        message: 'Selling price must be less than or equal to MRP'
      });
    }

    if (payload.minStock !== undefined && payload.maxStock !== undefined) {
      const minValue = Number(payload.minStock);
      const maxValue = Number(payload.maxStock);
      if (Number.isFinite(minValue) && Number.isFinite(maxValue) && maxValue > 0 && minValue > maxValue) {
        return res.status(400).json({
          status: 'error',
          message: 'Minimum stock cannot exceed maximum stock'
        });
      }
    }

    const item = await createItemRepo(payload);

    res.status(201).json({
      status: 'success',
      message: 'Item created successfully',
      data: { item: normalizeItemImage(item, req) }
    });
  } catch (error) {
    console.error('Error creating item:', error);
    if (error.code === 'ITEMS_TABLE_MISSING') {
      return res.status(503).json({
        status: 'error',
        message: 'Items table is not configured for write operations in this environment.'
      });
    }
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        status: 'error',
        message: 'An item with the same unique value already exists'
      });
    }
    res.status(500).json({
      status: 'error',
      message: 'Server error while creating item'
    });
  }
};

export const updateItem = async (req, res) => {
  try {
    const itemId = parseNumber(req.params.id);
    if (!itemId) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid item id'
      });
    }

    // Set cache-control headers to prevent 304 responses
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    const payload = normalizeItemPayload(req.body, req);

    const hintStore =
      parseNumber(req.body?.store_id ?? req.body?.storeId) ??
      parseNumber(req.user?.selectedStore?.id ?? req.user?.selectedStore?._id) ??
      parseNumber(req.user?.selectedStoreId);

    // Get existing item to check current values (merge store-scoped item_overrides)
    const existing = await getItemByIdRepo(itemId, hintStore);
    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: 'Item not found'
      });
    }

    // Determine the selling price and MRP to validate (use payload if provided, otherwise existing)
    const sellingPrice = payload.sellingPrice !== undefined ? payload.sellingPrice : (existing.sellingPrice ?? existing.price);
    const mrp = payload.mrp !== undefined ? payload.mrp : existing.mrp;

    // Validate that selling price is less than or equal to MRP
    if (sellingPrice !== undefined && sellingPrice !== null && 
        mrp !== undefined && mrp !== null && mrp > 0 && sellingPrice > mrp) {
      return res.status(400).json({
        status: 'error',
        message: 'Selling price must be less than or equal to MRP'
      });
    }

    const minValue = payload.minStock !== undefined
      ? Number(payload.minStock)
      : Number(existing.minStock ?? existing.reorderLevel ?? 0);
    const maxValue = payload.maxStock !== undefined
      ? Number(payload.maxStock)
      : Number(existing.maxStock ?? 0);

    if (
      Number.isFinite(minValue) &&
      Number.isFinite(maxValue) &&
      maxValue > 0 &&
      minValue > maxValue
    ) {
      return res.status(400).json({
        status: 'error',
        message: 'Minimum stock cannot exceed maximum stock'
      });
    }
    
    // Log the update for debugging
    console.log('Updating item:', itemId, 'with payload:', payload);

    const resolvedStoreForWrite = parseNumber(payload.storeId) ?? hintStore;
    if (Number.isFinite(resolvedStoreForWrite) && resolvedStoreForWrite > 0) {
      payload.storeId = resolvedStoreForWrite;
    }

    const updated = await updateItemRepo(itemId, payload);

    if (!updated) {
      return res.status(404).json({
        status: 'error',
        message: 'Item not found'
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Item updated successfully',
      data: { item: normalizeItemImage(updated, req) }
    });
  } catch (error) {
    console.error('Error updating item:', error);
    if (error.code === 'ITEMS_TABLE_MISSING') {
      return res.status(503).json({
        status: 'error',
        message: 'Items table is not configured for write operations in this environment.'
      });
    }
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        status: 'error',
        message: 'An item with the same unique value already exists'
      });
    }
    res.status(500).json({
      status: 'error',
      message: 'Server error while updating item'
    });
  }
};

export const deleteItem = async (req, res) => {
  try {
    const itemId = parseNumber(req.params.id);
    if (!itemId) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid item id'
      });
    }

    await deleteItemRepo(itemId);

    res.json({
      status: 'success',
      message: 'Item deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting item:', error);
    if (error.code === 'ITEMS_TABLE_MISSING') {
      return res.status(503).json({
        status: 'error',
        message: 'Items table is not configured for write operations in this environment.'
      });
    }
    res.status(500).json({
      status: 'error',
      message: 'Server error while deleting item'
    });
  }
};

export const toggleItemStatus = async (req, res) => {
  try {
    const itemId = parseNumber(req.params.id);
    if (!itemId) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid item id'
      });
    }

    const hintStore =
      parseNumber(req.body?.store_id ?? req.body?.storeId) ??
      parseNumber(req.user?.selectedStore?.id ?? req.user?.selectedStore?._id) ??
      parseNumber(req.user?.selectedStoreId);
    const existing = await getItemByIdRepo(itemId, hintStore);
    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: 'Item not found'
      });
    }

    const updated = await updateItemRepo(itemId, {
      isActive: !existing.isActive,
      ...(Number(hintStore) > 0 ? { storeId: hintStore } : {})
    });

    res.json({
      status: 'success',
      message: `Item ${updated.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { item: normalizeItemImage(updated, req) }
    });
  } catch (error) {
    console.error('Error toggling item status:', error);
    if (error.code === 'ITEMS_TABLE_MISSING') {
      return res.status(503).json({
        status: 'error',
        message: 'Items table is not configured for write operations in this environment.'
      });
    }
    res.status(500).json({
      status: 'error',
      message: 'Server error while toggling item status'
    });
  }
};

export const uploadItemImage = async (req, res) => {
  try {
    const itemId = req.params.id;
    if (!itemId) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid item id'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'Image file is required'
      });
    }

    const imageUrl = `/uploads/items/${req.file.filename}`.replace(/\\/g, '/');
    const hintStore =
      parseNumber(req.body?.store_id ?? req.body?.storeId) ??
      parseNumber(req.user?.selectedStore?.id ?? req.user?.selectedStore?._id) ??
      parseNumber(req.user?.selectedStoreId);
    const payload = {
      imageUrl,
      imageFileName: req.file.originalname || req.file.filename,
      ...(Number(hintStore) > 0 ? { storeId: hintStore } : {})
    };

    const updated = await updateItemRepo(itemId, payload);

    res.json({
      status: 'success',
      message: 'Item image updated successfully',
      data: { item: normalizeItemImage(updated, req) }
    });
  } catch (error) {
    console.error('Item image upload error:', error);
    if (error.code === 'ITEMS_TABLE_MISSING') {
      return res.status(503).json({
        status: 'error',
        message: 'Items table is not configured for write operations in this environment.'
      });
    }
    res.status(500).json({
      status: 'error',
      message: 'Server error while uploading item image'
    });
  }
};

export const getStockWithBatches = async (req, res) => {
  try {
    const search = req.query.search?.trim() || req.query.q?.trim() || undefined;
    const storeId = req.query.storeId || req.query.store || undefined;
    const categoryId = parseNumber(req.query.categoryId);

    const batches = await getStockWithBatchesRepo({
      search,
      storeId,
      categoryId
    });

    res.json({
      status: 'success',
      data: batches
    });
  } catch (error) {
    console.error('Error getting stock with batches:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching stock with batches'
    });
  }
};
