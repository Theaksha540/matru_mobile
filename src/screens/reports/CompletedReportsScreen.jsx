import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Calendar, FileText, Filter, Home } from 'lucide-react-native';
import { secureStorage } from '../../utils/secureStorage';
import { formatDateTimeDDMMYYYY } from '../../utils/dateFormat';
import { useTranslation } from 'react-i18next';
import PaginationControls from '../../components/PaginationControls';
import { useServerPagination } from '../../hooks/useServerPagination';
import { usgAppointmentAPI } from '../../services/api';
import { syncService } from '../../utils/syncService';
const CompletedReportsScreen = ({
  navigation
}) => {
  const {
    t
  } = useTranslation();
  const [filter, setFilter] = useState('today');
  const [userRole, setUserRole] = useState(null);
  const [reportsWithPatients, setReportsWithPatients] = useState([]);
  const [userInfo, setUserInfo] = useState(null);
  const handleGoHome = () => {
    const roleRouteMap = {
      dp: 'DPDashboard',
      sub_centre: 'SubCentreDashboard',
      district: 'DistrictDashboard',
      block: 'BlockDashboard',
      usg_centre: 'USGDashboard',
      mother: 'MotherDashboard'
    };
    const dashboardRoute = roleRouteMap[userInfo?.role] || 'SubCentreDashboard';
    navigation.navigate(dashboardRoute);
  };

  // Server-side pagination - always filter by completed status
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
    refresh
  } = useServerPagination(usgAppointmentAPI.getAll, {
    status: 'completed'
  },
  // Always filter completed
  10 // page size
  );
  useEffect(() => {
    loadUserInfo();
    loadUserRole();
  }, []);
  const loadUserInfo = async () => {
    try {
      const userData = await secureStorage.getItem('user_info');
      if (userData) {
        setUserInfo(userData);
      }
    } catch (error) {}
  };

  // Load patient data and apply date filtering
  useEffect(() => {
    const loadPatientData = async () => {
      if (reports.length === 0) {
        setReportsWithPatients([]);
        return;
      }
      const reportsWithPatientData = await Promise.all(reports.map(async report => {
        if (report.pregnant_woman_id) {
          try {
            const patient = await syncService.getPatientById(report.pregnant_woman_id);
            return {
              ...report,
              patient
            };
          } catch (error) {
            return report;
          }
        }
        return report;
      }));

      // Apply client-side date filtering
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      let filtered = reportsWithPatientData;
      if (filter === 'today') {
        filtered = reportsWithPatientData.filter(report => {
          if (!report.completed_date) return false;
          const completedDate = new Date(report.completed_date);
          return completedDate >= today && completedDate < tomorrow;
        });
      } else if (filter === 'week') {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        filtered = reportsWithPatientData.filter(report => {
          if (!report.completed_date) return false;
          const completedDate = new Date(report.completed_date);
          return completedDate >= weekAgo && completedDate < tomorrow;
        });
      } else if (filter === 'month') {
        const monthAgo = new Date(today);
        monthAgo.setDate(monthAgo.getDate() - 30);
        filtered = reportsWithPatientData.filter(report => {
          if (!report.completed_date) return false;
          const completedDate = new Date(report.completed_date);
          return completedDate >= monthAgo && completedDate < tomorrow;
        });
      }
      // 'all' filter - no date filtering needed
      filtered = [...filtered].sort((first, second) => {
        const firstDate = new Date(first?.completed_date || first?.created_at || first?.scheduled_date || 0).getTime();
        const secondDate = new Date(second?.completed_date || second?.created_at || second?.scheduled_date || 0).getTime();
        return secondDate - firstDate;
      });

      setReportsWithPatients(filtered);
    };
    loadPatientData();
  }, [reports, filter]);
  const loadUserRole = async () => {
    const userInfo = await secureStorage.getItem('user_info');
    setUserRole(userInfo?.role);
  };
  const formatDate = dateString => {
    return formatDateTimeDDMMYYYY(dateString);
  };
  const filters = [{
    key: 'today',
    label: t('today')
  }, {
    key: 'week',
    label: t('lastWeek')
  }, {
    key: 'month',
    label: t('lastMonth')
  }, {
    key: 'all',
    label: t('allTime')
  }];
  const isAllFilter = filter === 'all';
  const paginationTotalCount = isAllFilter ? totalCount : reportsWithPatients.length;
  const paginationTotalPages = isAllFilter ? totalPages : 1;
  const paginationHasNextPage = isAllFilter ? hasNextPage : false;
  const paginationHasPreviousPage = isAllFilter ? hasPreviousPage : false;
  const paginationStartIndex = paginationTotalCount === 0 ? 0 : isAllFilter ? startIndex : 1;
  const paginationEndIndex = paginationTotalCount === 0 ? 0 : isAllFilter ? endIndex : reportsWithPatients.length;
  const handlePreviousPage = isAllFilter ? previousPage : () => {};
  const handleNextPage = isAllFilter ? nextPage : () => {};
  return <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color="white" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{t('completedReports')}</Text>
          <Text style={styles.headerSubtitle}>{t('todaysCompletedScans')}</Text>
        </View>
        <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
          <Home size={20} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        <Filter size={16} color="#6b7280" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {filters.map(filterOption => <TouchableOpacity key={filterOption.key} style={[styles.filterButton, filter === filterOption.key && styles.filterButtonActive]} onPress={() => setFilter(filterOption.key)}>
              <Text style={[styles.filterText, filter === filterOption.key && styles.filterTextActive]}>
                {filterOption.label}
              </Text>
            </TouchableOpacity>)}
        </ScrollView>
      </View>

      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {loading ? <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>{t('loading')}</Text>
          </View> : reportsWithPatients.length === 0 ? <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t('noCompletedReportsFor', {
            period: filter === 'today' ? t('todayLower') : filter === 'week' ? t('lastWeekLower') : filter === 'month' ? t('lastMonthLower') : t('thisPeriod')
          })}</Text>
          </View> : <>
            {reportsWithPatients.map(report => <View key={report.id} style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <FileText size={16} color="#8B4513" />
                  <Text style={styles.reportId}>{t('reportNumber', {
                id: report.id
              })}</Text>
                  <View style={styles.statusBadges}>
                    <Text style={[styles.statusBadge, {
                backgroundColor: '#22c55e'
              }]}>
                      {t('completed')}
                    </Text>
                    {report.appointment_type === 'emergency' && <Text style={[styles.statusBadge, {
                backgroundColor: '#ef4444'
              }]}>{t('emergency')}</Text>}
                    {report.patient?.is_high_risk && <Text style={[styles.statusBadge, {
                backgroundColor: '#f59e0b'
              }]}>{t('highRisk')}</Text>}
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
                    {userRole === 'usg_centre' ? `${t('scheduled')}: ${formatDate(report.scheduled_date)} • ${t('completed')}: ${formatDate(report.completed_date)}` : `${t('created')}: ${formatDate(report.created_at)} • ${t('scheduled')}: ${formatDate(report.scheduled_date)} • ${t('completed')}: ${formatDate(report.completed_date)}`}
                  </Text>
                </View>
              </View>)}

            <PaginationControls currentPage={currentPage} totalPages={paginationTotalPages} totalCount={paginationTotalCount} startIndex={paginationStartIndex} endIndex={paginationEndIndex} onPreviousPage={handlePreviousPage} onNextPage={handleNextPage} hasPreviousPage={paginationHasPreviousPage} hasNextPage={paginationHasNextPage} loading={loading} />
          </>}
      </ScrollView>
    </SafeAreaView>;
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8'
  },
  header: {
    backgroundColor: '#D2691E',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center'
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  homeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12
  },
  headerInfo: {
    flex: 1
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white'
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)'
  },
  content: {
    flex: 1,
    padding: 16
  },
  reportCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    justifyContent: 'space-between'
  },
  reportId: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B4513',
    marginLeft: 8,
    flex: 1
  },
  patientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4
  },
  patientDetails: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4
  },
  patientAddress: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 12
  },
  reportFooter: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  completedDate: {
    fontSize: 11,
    color: '#6b7280',
    marginLeft: 6
  },
  emptyState: {
    padding: 40,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280'
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb'
  },
  filterScroll: {
    marginLeft: 12
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 8
  },
  filterButtonActive: {
    backgroundColor: '#8B4513'
  },
  filterText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500'
  },
  filterTextActive: {
    color: 'white'
  },
  statusBadges: {
    flexDirection: 'row',
    gap: 4
  },
  statusBadge: {
    fontSize: 10,
    color: 'white',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    fontWeight: '600'
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center'
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280'
  }
});
export default CompletedReportsScreen;
