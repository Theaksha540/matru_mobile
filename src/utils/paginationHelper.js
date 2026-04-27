/**
 * Helper to wrap API calls that don't return proper pagination metadata
 * This fetches total count separately if needed
 */

/**
 * Wraps an API function to add pagination metadata
 * @param {Function} apiFunction - The API function to wrap
 * @returns {Function} Wrapped function that returns {items, total}
 */
export const wrapWithPagination = (apiFunction) => {
  return async (params = {}) => {
    const response = await apiFunction(params);
    
    // If response already has proper format, return as is
    if (response?.items && response?.total !== undefined) {
      return response;
    }
    
    if (response?.data && response?.total !== undefined) {
      return {
        items: response.data,
        total: response.total
      };
    }
    
    // If response is just an array, we need to get total count
    if (Array.isArray(response)) {
      // If skip is 0 or undefined and we got less than limit, this is the total
      const skip = params.skip || 0;
      const limit = params.limit || 10;
      
      if (skip === 0 && response.length < limit) {
        // This is the only page
        return {
          items: response,
          total: response.length
        };
      }
      
      // Otherwise, we need to fetch without pagination to get total
      // This is not ideal but works as fallback
      const { skip: _, limit: __, ...paramsWithoutPagination } = params;
      const allData = await apiFunction(paramsWithoutPagination);
      const totalCount = Array.isArray(allData) ? allData.length : 0;
      
      return {
        items: response,
        total: totalCount
      };
    }
    
    // Fallback
    return {
      items: [],
      total: 0
    };
  };
};
