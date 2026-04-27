import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for server-side pagination
 * @param {Function} fetchFunction - API function to fetch paginated data
 * @param {Object} initialParams - Initial parameters for the API call
 * @param {number} pageSize - Number of items per page (default: 10)
 * @returns {Object} Pagination state and methods
 */
export const useServerPagination = (fetchFunction, initialParams = {}, pageSize = 10, options = {}) => {
  const { prefetchNextPage = false } = options;
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState(null);
  const [params, setParams] = useState(initialParams);
  const prefetchedPagesRef = useRef(new Map());

  const getCacheKey = useCallback((page, pageParams = params) => {
    return JSON.stringify({
      page,
      pageSize,
      params: pageParams,
    });
  }, [pageSize, params]);

  const buildApiParams = useCallback((page, pageParams = params) => {
    const skip = (page - 1) * pageSize;
    return {
      ...pageParams,
      skip,
      limit: pageSize,
    };
  }, [pageSize, params]);

  const normalizeResponse = useCallback((response) => {
    let items = [];
    let total = 0;

    if (Array.isArray(response)) {
      items = response;
      total = response.length;
      console.warn('[SERVER-PAGINATION] API returned array without total count. Pagination may not work correctly.');
    } else if (response?.items && Array.isArray(response.items)) {
      items = response.items;
      total = response.total || response.count || response.total_count || items.length;
    } else if (response?.data && Array.isArray(response.data)) {
      items = response.data;
      total = response.total || response.count || response.total_count || items.length;
    } else {
      console.warn('[SERVER-PAGINATION] Unexpected response format', response);
    }

    return {
      items,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }, [pageSize]);

  const prefetchPage = useCallback(async (page, pageParams = params) => {
    if (!prefetchNextPage || page < 1) return;

    const cacheKey = getCacheKey(page, pageParams);
    if (prefetchedPagesRef.current.has(cacheKey)) return;

    try {
      const response = await fetchFunction(buildApiParams(page, pageParams));
      const normalized = normalizeResponse(response);
      prefetchedPagesRef.current.set(cacheKey, normalized);
    } catch (prefetchError) {
      console.warn('[SERVER-PAGINATION] Prefetch failed:', prefetchError);
    }
  }, [buildApiParams, fetchFunction, getCacheKey, normalizeResponse, params, prefetchNextPage]);

  /**
   * Fetch data from server
   */
  const fetchData = useCallback(async (page = currentPage, isRefreshing = false) => {
    try {
      if (isRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const apiParams = buildApiParams(page);
      const cacheKey = getCacheKey(page);

      console.log('[SERVER-PAGINATION] Fetching data', {
        page,
        skip: apiParams.skip,
        limit: pageSize,
        params: apiParams,
      });

      let normalized = prefetchedPagesRef.current.get(cacheKey);
      if (normalized) {
        prefetchedPagesRef.current.delete(cacheKey);
      } else {
        const response = await fetchFunction(apiParams);
        normalized = normalizeResponse(response);
      }

      const { items, total, totalPages: resolvedTotalPages } = normalized;

      setData(items);
      setTotalCount(total);
      setTotalPages(resolvedTotalPages);
      setCurrentPage(page);

      console.log('[SERVER-PAGINATION] Data fetched successfully', {
        itemsCount: items.length,
        totalCount: total,
        totalPages: resolvedTotalPages,
        currentPage: page,
      });

      if (prefetchNextPage && page < resolvedTotalPages) {
        prefetchPage(page + 1);
      }
    } catch (err) {
      console.error('[SERVER-PAGINATION] Error fetching data:', err);
      setError(err);
      setData([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [buildApiParams, currentPage, fetchFunction, getCacheKey, normalizeResponse, pageSize, prefetchNextPage, prefetchPage]);

  /**
   * Go to specific page
   */
  const goToPage = useCallback((page) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      fetchData(page);
    }
  }, [totalPages, currentPage, fetchData]);

  /**
   * Go to next page
   */
  const nextPage = useCallback(() => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  }, [currentPage, totalPages, goToPage]);

  /**
   * Go to previous page
   */
  const previousPage = useCallback(() => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  }, [currentPage, goToPage]);

  /**
   * Refresh current page
   */
  const refresh = useCallback(() => {
    fetchData(currentPage, true);
  }, [currentPage, fetchData]);

  /**
   * Update search/filter params and reset to page 1
   */
  const updateParams = useCallback((newParams) => {
    prefetchedPagesRef.current.clear();
    setParams(newParams);
    setCurrentPage(1);
  }, []);

  /**
   * Reset pagination to initial state
   */
  const reset = useCallback(() => {
    prefetchedPagesRef.current.clear();
    setCurrentPage(1);
    setParams(initialParams);
  }, [initialParams]);

  // Initial load
  useEffect(() => {
    fetchData(currentPage);
  }, [params]);

  return {
    // Data
    data,
    loading,
    refreshing,
    error,
    
    // Pagination state
    currentPage,
    totalPages,
    totalCount,
    pageSize,
    
    // Pagination info
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
    startIndex: (currentPage - 1) * pageSize + 1,
    endIndex: Math.min(currentPage * pageSize, totalCount),
    
    // Methods
    goToPage,
    nextPage,
    previousPage,
    refresh,
    updateParams,
    reset,
    setPage: goToPage,
  };
};

export default useServerPagination;
