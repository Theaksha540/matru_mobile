import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Calendar, FileText, Filter } from 'lucide-react-native';
import { secureStorage } from '../../utils/secureStorage';
import { formatDateTimeDDMMYYYY } from '../../utils/dateFormat';
import { useTranslation } from 'react-i18next';
import PaginationControls from '../../components/PaginationControls';
import { useServerPagination } from '../../hooks/useServerPagination';
import { usgAppointmentAPI } from '../../services/api';
import { syncService } from '../../utils/syncService';

const AllReportsScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('all');
  const [userRole, setUserRole] = useState(null);
  const [reportsWithPatients, setReportsWithPatients] = useState([]);

  // Build API params based on filter
  const getApiParams = () => {
    const params = {};
    
    // Filter by status
    if (['scheduled', 'accepted', 'completed'].includes(filter)) {
      params.status = filter;
    }
    
    // Note: Date filtering (week, month, overdue) will be done client-side
    // as the API doesn't support these filters yet
    
    return params;
  };

  // Server-side pagination
  const {
    data: reports,
    loading,
    refreshing,
    currentPage,
    totalPages,
    totalCount,
    hasNextPage,
    hasPreviousPage,
    startIndex,
    endIndex,
    nextPage,
    previousPage,
    refresh,
    updateParams,
  } = useServerPagination(
    usgAppointmentAPI.getAll,
    getApiParams(),
    10 // page size
  );

  useEffect(() => {
    loadUserRole();
  }, []);

  useEffect(() => {
    // Update API params when filter changes
    updateParams(getApiParams());
  }, [filter]);

  // Load patient data for each report
  useEffect(() => {
    const loadPatientData = async () => {
      if (reports.length === 0) {
        setReportsWithPatients([]);
        return;
      }

      const reportsWithPatientData = await Promise.all(
        reports.map(async (report) => {
          if (report.pregnant_woman_id) {
            try {
              const patient = await syncService.getPatientById(report.pregnant_woman_id);
              return { ...report, patient };
            } catch (error) {
              console.error(`Error loading patient ${report.pregnant_woman_id}:`, error);
              return report;
            }
          }
          return report;
        })
      );

      // Apply client-side date filtering if needed
      let filtered = reportsWithPatientData;
      
      if (filter === 'overdue') {
        const now = new Date();
        filtered = reportsWithPatientData.filter(report => {
          const scheduledDate = new Date(report.scheduled_date);
          const daysDiff = Math.ceil((now - scheduledDate) / (1000 * 60 * 60 * 24));
          return daysDiff > 7 && report.status !== 'completed';
        });
      } else if (filter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        filtered = reportsWithPatientData.filter(report => 
          new Date(report.created_at) >= weekAgo
        );
      } else if (filter === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        filtered = reportsWithPatientData.filter(report => 
          new Date(report.created_at) >= monthAgo
        );
      }

      setReportsWithPatients(filtered);
    };

    loadPatientData();
  }, [reports]);

  const loadUserRole = async () => {
    const userInfo = await secureStorage.getItem('user_info');
    setUserRole(userInfo?.role);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return '#6b7280';
      case 'accepted': return '#8B4513';
      case 'completed': return '#22c55e';
      default: return '#6b7280';
    }
  };

  const formatDate = (dateString) => {
    return formatDateTimeDDMMYYYY(dateString);
  };

  const formatDisplayValue = (value) => {
    if (!value) return '';
    return String(value)
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const filters = [
    { key: 'all', label: t('allTime') },
    { key: 'week', label: t('lastWeek') },
    { key: 'month', label: t('lastMonth') },
    { key: 'scheduled', label: t('scheduled') },
    { key: 'accepted', label: t('accepted') },
    { key: 'completed', label: t('completed') },
    { key: 'overdue', label: t('overdue') },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color="white" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>{t('allReports')}</Text>
          <Text style={styles.headerSubtitle}>{t('historicalUSGReports')}</Text>
        </View>
      </View>

      <View style={styles.filterContainer}>
        <Filter size={16} color="#6b7280" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {filters.map((filterOption) => (
            <TouchableOpacity
              key={filterOption.key}
              style={[
                styles.filterButton,
                filter === filterOption.key && styles.filterButtonActive
              ]}
              onPress={() => setFilter(filterOption.key)}
            >
              <Text style={[
                styles.filterText,
                filter === filterOption.key && styles.filterTextActive
              ]}>
                {filterOption.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8B4513" />
            <Text style={styles.loadingText}>{t('loadingReports')}</Text>
          </View>
        ) : reportsWithPatients.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t('noReportsFound')}</Text>
          </View>
        ) : (
          <>
            {reportsWithPatients.map((report) => (
              <View key={report.id} style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <FileText size={16} color="#8B4513" />
                  <Text style={styles.reportId}>{t('reportNumber', { id: report.id })}</Text>
                  <View style={styles.statusBadges}>
                    <Text style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) }]}>
                      {formatDisplayValue(report.status)}
                    </Text>
                    {report.appointment_type === 'emergency' && (
                      <Text style={[styles.statusBadge, { backgroundColor: '#ef4444' }]}>{t('emergency')}</Text>
                    )}
                    {report.patient?.is_high_risk && (
                      <Text style={[styles.statusBadge, { backgroundColor: '#f59e0b' }]}>{t('highRisk')}</Text>
                    )}
                  </View>
                </View>
                <Text style={styles.patientName}>{report.patient?.full_name || t('notAvailable')}</Text>
                <Text style={styles.patientDetails}>
                  {t('age')}: {report.patient?.age || t('notAvailable')} • {t('mobile')}: {report.patient?.mobile_number || t('notAvailable')}
                </Text>
                <Text style={styles.patientAddress}>
                  {t('address')}: {report.patient?.address || t('notAvailable')}
                </Text>
                <View style={styles.reportFooter}>
                  <Calendar size={12} color="#6b7280" />
                  <Text style={styles.completedDate}>
                    {userRole === 'usg_centre'
                      ? `${t('scheduled')}: ${formatDate(report.scheduled_date)}`
                      : `${t('created')}: ${formatDate(report.created_at)} • ${t('scheduled')}: ${formatDate(report.scheduled_date)}`
                    }
                    {report.status === 'completed' && report.completed_date &&
                      ` • ${t('completed')}: ${formatDate(report.completed_date)}`
                    }
                  </Text>
                </View>
              </View>
            ))}
            
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              startIndex={startIndex}
              endIndex={endIndex}
              onPreviousPage={previousPage}
              onNextPage={nextPage}
              hasPreviousPage={hasPreviousPage}
              hasNextPage={hasNextPage}
              loading={loading}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  header: {
    backgroundColor: '#D2691E',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterScroll: {
    marginLeft: 12,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#8B4513',
  },
  filterText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  filterTextActive: {
    color: 'white',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  reportCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    justifyContent: 'space-between',
  },
  reportId: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B4513',
    marginLeft: 8,
    flex: 1,
  },
  statusBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  statusBadge: {
    fontSize: 8,
    color: 'white',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    fontWeight: '600',
  },
  patientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  patientDetails: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  patientAddress: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 12,
  },
  reportFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  completedDate: {
    fontSize: 11,
    color: '#6b7280',
    marginLeft: 6,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
  },
  filterLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    marginRight: 8,
  },
});

export default AllReportsScreen;
