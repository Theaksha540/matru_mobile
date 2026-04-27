import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

/**
 * Reusable Pagination Component for Server-Side Pagination
 * @param {number} currentPage - Current page number
 * @param {number} totalPages - Total number of pages
 * @param {number} totalCount - Total number of items
 * @param {number} startIndex - Start index of current page items
 * @param {number} endIndex - End index of current page items
 * @param {Function} onPreviousPage - Callback for previous page
 * @param {Function} onNextPage - Callback for next page
 * @param {boolean} hasPreviousPage - Whether previous page exists
 * @param {boolean} hasNextPage - Whether next page exists
 * @param {boolean} loading - Whether data is loading
 */
const PaginationControls = ({
  currentPage,
  totalPages,
  totalCount,
  startIndex,
  endIndex,
  onPreviousPage,
  onNextPage,
  hasPreviousPage,
  hasNextPage,
  loading = false,
}) => {
  console.log('[PaginationControls] Render:', {
    currentPage,
    totalPages,
    totalCount,
    startIndex,
    endIndex,
    hasPreviousPage,
    hasNextPage,
    loading
  });
  
  // Always show pagination info, even if only one page
  // This helps users see the total count
  const showNavigation = totalPages > 1;

  return (
    <View style={styles.paginationContainer}>
      {/* Previous Button - only show if multiple pages */}
      {showNavigation && (
        <TouchableOpacity
          style={[
            styles.paginationButton,
            (!hasPreviousPage || loading) && styles.paginationButtonDisabled,
          ]}
          onPress={onPreviousPage}
          disabled={!hasPreviousPage || loading}
          activeOpacity={0.7}
        >
          <ChevronLeft 
            size={20} 
            color={!hasPreviousPage || loading ? '#9ca3af' : '#374151'} 
          />
        </TouchableOpacity>
      )}

      {/* Page Info - always show */}
      <View style={[styles.paginationInfo, !showNavigation && styles.paginationInfoCentered]}>
        {showNavigation && (
          <Text style={styles.paginationText}>
            Page {currentPage} of {totalPages}
          </Text>
        )}
        <Text style={styles.paginationSubtext}>
          {showNavigation 
            ? `Showing ${startIndex}-${endIndex} of ${totalCount}`
            : `Total: ${totalCount} patient${totalCount !== 1 ? 's' : ''}`
          }
        </Text>
      </View>

      {/* Next Button - only show if multiple pages */}
      {showNavigation && (
        <TouchableOpacity
          style={[
            styles.paginationButton,
            (!hasNextPage || loading) && styles.paginationButtonDisabled,
          ]}
          onPress={onNextPage}
          disabled={!hasNextPage || loading}
          activeOpacity={0.7}
        >
          <ChevronRight 
            size={20} 
            color={!hasNextPage || loading ? '#9ca3af' : '#374151'} 
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  paginationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  paginationButtonDisabled: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
    opacity: 0.5,
  },
  paginationInfo: {
    alignItems: 'center',
    flex: 1,
  },
  paginationInfoCentered: {
    flex: 1,
    justifyContent: 'center',
  },
  paginationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 2,
  },
  paginationSubtext: {
    fontSize: 12,
    color: '#6b7280',
  },
});

export default PaginationControls;
