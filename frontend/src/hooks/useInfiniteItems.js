import { useInfiniteQuery } from '@tanstack/react-query';
import { itemsAPI } from '@/services/api';
import { useMemo } from 'react';

/**
 * Custom hook for infinite scrolling items with react-query
 * @param {Object} filters - Filter parameters
 * @param {string} filters.categoryId - Category ID filter
 * @param {string} filters.subcategoryId - Subcategory ID filter
 * @param {string} filters.q - Search query
 * @param {boolean} filters.isActive - Active status filter
 * @param {string} filters.sort - Sort field (name, price, stock, createdAt, sortOrder)
 * @param {string} filters.sortOrder - Sort order (asc, desc)
 * @returns {Object} - Query result with flattened items array
 */
export function useInfiniteItems(filters = {}) {
  const {
    categoryId,
    subcategoryId,
    q = '',
    isActive = true,
    sort = 'name',
    sortOrder = 'asc'
  } = filters;

  // Create query key based on filters for proper caching
  const queryKey = [
    'items',
    'infinite',
    categoryId || null,
    subcategoryId || null,
    q || null,
    isActive,
    sort,
    sortOrder
  ];

  const query = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam = null }) => {
      const params = {
        cursor: pageParam,
        limit: 50,
        categoryId,
        subcategoryId,
        q,
        isActive,
        sort,
        sortOrder
      };

      // Remove null/undefined values
      Object.keys(params).forEach(key => {
        if (params[key] === null || params[key] === undefined || params[key] === '') {
          delete params[key];
        }
      });

      const response = await itemsAPI.getItems(params);
      return response.data;
    },
    getNextPageParam: (lastPage) => {
      return lastPage?.pagination?.hasNext ? lastPage.pagination.nextCursor : undefined;
    },
    initialPageParam: null,
    staleTime: 5 * 60 * 1000, // 5 minutes - data considered fresh
    gcTime: 10 * 60 * 1000, // 10 minutes - cache time (formerly cacheTime)
  });

  // Flatten all pages into a single array for easy consumption
  const items = useMemo(() => {
    return query.data?.pages.flatMap(page => page.items || []) || [];
  }, [query.data]);

  return {
    ...query,
    items,
    // Convenience properties
    isLoading: query.isLoading || query.isFetching,
    hasMore: query.hasNextPage,
    loadMore: query.fetchNextPage,
  };
}















