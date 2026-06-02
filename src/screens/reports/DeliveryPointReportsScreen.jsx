import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { ArrowLeft, Funnel, Download, Home } from 'lucide-react-native';
import { reportsAPI } from '../../services/api';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useTranslation } from 'react-i18next';
import { formatDateDDMMYYYY } from '../../utils/dateFormat';
import { downloadTextReport } from '../../utils/reportDownload';
import { secureStorage } from '../../utils/secureStorage';
import { syncService } from '../../utils/syncService';
import '../../i18n';
const DeliveryPointReportsScreen = ({
  navigation,
  route
}) => {
  const {
    t
  } = useTranslation();
  const isOnline = useNetworkStatus();
  const reportScope = route?.params?.scope || 'district';
  const cachePrefix = reportScope === 'block' ? 'block_dp_reports' : 'district_dp_reports';
  const [showFilter, setShowFilter] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [summaryData, setSummaryData] = useState(null);
  const [outcomeData, setOutcomeData] = useState(null);
  const [pointPerformance, setPointPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
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
  useEffect(() => {
    loadUserInfo();
    loadData();
  }, []);
  const loadUserInfo = async () => {
    try {
      const userData = await secureStorage.getItem('user_info');
      if (userData) {
        setUserInfo(userData);
      }
    } catch (error) {}
  };
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation]);
  const normalizePointPerformance = data => {
    if (Array.isArray(data?.dp_performance)) return data.dp_performance;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  };
  const loadData = async (params = {}) => {
    try {
      setLoading(true);
      if (isOnline) {
        const [summary, outcomeBreakdown, performance] = await Promise.all([reportsAPI.getDeliverySummary(params), reportsAPI.getDeliveryOutcomeBreakdown(params), reportsAPI.getDeliveryPointPerformance(params)]);
        setSummaryData(summary);
        setOutcomeData(outcomeBreakdown);
        setPointPerformance(normalizePointPerformance(performance));
        await Promise.all([syncService.setCachedResource(`${cachePrefix}_summary`, summary), syncService.setCachedResource(`${cachePrefix}_outcomes`, outcomeBreakdown), syncService.setCachedResource(`${cachePrefix}_performance`, performance)]);
      } else {
        const [cachedSummary, cachedOutcomes, cachedPerformance] = await Promise.all([syncService.getCachedResource(`${cachePrefix}_summary`), syncService.getCachedResource(`${cachePrefix}_outcomes`), syncService.getCachedResource(`${cachePrefix}_performance`)]);
        if (cachedSummary) setSummaryData(cachedSummary);
        if (cachedOutcomes) setOutcomeData(cachedOutcomes);
        if (cachedPerformance) {
          setPointPerformance(normalizePointPerformance(cachedPerformance));
        }
      }
    } catch (error) {
      Alert.alert(t('error'), 'Failed to load DP reports.');
    } finally {
      setLoading(false);
    }
  };
  const buildFilterParams = filterId => {
    const params = {};
    const today = new Date();
    switch (filterId) {
      case 'this-month':
        params.start_date = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        params.end_date = today.toISOString().split('T')[0];
        break;
      case 'last-month':
        {
          const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
          params.start_date = lastMonth.toISOString().split('T')[0];
          params.end_date = lastMonthEnd.toISOString().split('T')[0];
          break;
        }
      case 'last-quarter':
        {
          const quarterStart = new Date(today.getFullYear(), today.getMonth() - 3, 1);
          params.start_date = quarterStart.toISOString().split('T')[0];
          params.end_date = today.toISOString().split('T')[0];
          break;
        }
      default:
        break;
    }
    return params;
  };
  const getFilterFileSuffix = filterId => {
    switch (filterId) {
      case 'this-month':
        return 'this_month';
      case 'last-month':
        return 'last_month';
      case 'last-quarter':
        return 'last_quarter';
      default:
        return 'all';
    }
  };
  const handleFilterSelect = async filterId => {
    setSelectedFilter(filterId);
    await loadData(buildFilterParams(filterId));
  };
  const formatRate = value => {
    const numericValue = Number(value || 0);
    return `${Number.isFinite(numericValue) ? Math.round(numericValue) : 0}%`;
  };
  const buildCsv = () => {
    const activeParams = buildFilterParams(selectedFilter);
    const summarySource = derivedSummary;
    const referralSummary = summaryData?.referral_summary || {};
    const outcomeSummary = summaryData?.outcome_summary || {};
    const summaryRows = [['Filter', getFilterFileSuffix(selectedFilter)], ['Start Date', activeParams.start_date || 'All'], ['End Date', activeParams.end_date || 'All'], [], ['Metric', 'Value'], ['Total Referrals', referralSummary.total_referrals ?? summarySource.totalReferrals], ['Pending Referrals', referralSummary.pending ?? 0], ['Accepted Referrals', referralSummary.accepted ?? summarySource.accepted], ['Re-Referred', referralSummary.re_referred ?? summarySource.reReferred], ['Completed Referrals', referralSummary.completed ?? summarySource.completed], ['Total Outcomes', outcomeSummary.total_outcomes ?? 0], ['Adverse Outcome Rate', outcomeSummary.adverse_outcome_rate ?? 0]];
    const performanceRows = [[], ['DP-wise Overview'], ['DP Name', 'Referrals', 'Accepted', 'Re-Referred', 'Completed', 'Acceptance Rate'], ...pointPerformance.map(item => [item?.dp_name || 'Unknown', item?.total_referrals_received || 0, item?.accepted || 0, item?.re_referred || 0, item?.completed || 0, formatRate(item?.acceptance_rate)])];
    return [...summaryRows, ...performanceRows].map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  };
  const handleDownloadReport = async () => {
    if (!isOnline) {
      Alert.alert('Offline Mode', 'Cannot download reports while offline. Please connect to the internet.');
      return;
    }
    if (!pointPerformance.length && !summaryData) {
      Alert.alert(t('error'), 'DP report data is not available yet.');
      return;
    }
    try {
      const csvContent = buildCsv();
      const fileName = `${cachePrefix}_${getFilterFileSuffix(selectedFilter)}_${new Date().toISOString().split('T')[0]}.csv`;
      await downloadTextReport({
        content: csvContent,
        fileName,
        mimeType: 'text/csv'
      });
    } catch (error) {
      if (error.message === 'Download cancelled') {
        return;
      }
      if (error.message.includes('Downloads folder access was not granted')) {
        Alert.alert('Permission Required', 'Download folder access is required to save reports. Please grant permission when prompted.', [{
          text: 'OK'
        }]);
      } else {
        Alert.alert(t('error'), error.message || 'Failed to download DP report.');
      }
    }
  };
  const filterOptions = [{
    id: 'all',
    label: t('allReports')
  }, {
    id: 'this-month',
    label: t('thisMonth')
  }, {
    id: 'last-month',
    label: t('lastMonth')
  }, {
    id: 'last-quarter',
    label: t('lastQuarter')
  }];
  const derivedSummary = pointPerformance.reduce((acc, item) => {
    acc.totalReferrals += Number(item?.total_referrals_received || 0);
    acc.accepted += Number(item?.accepted || 0);
    acc.reReferred += Number(item?.re_referred || 0);
    acc.completed += Number(item?.completed || 0);
    return acc;
  }, {
    totalReferrals: 0,
    accepted: 0,
    reReferred: 0,
    completed: 0
  });
  const summaryStats = [{
    id: 1,
    value: String(summaryData?.referral_summary?.total_referrals ?? summaryData?.total_referrals ?? summaryData?.referrals ?? derivedSummary.totalReferrals ?? 0),
    label: 'Referrals'
  }, {
    id: 2,
    value: String(summaryData?.referral_summary?.accepted ?? summaryData?.accepted_referrals ?? summaryData?.accepted ?? derivedSummary.accepted ?? 0),
    label: 'Accepted'
  }, {
    id: 3,
    value: String(summaryData?.outcome_summary?.total_outcomes ?? summaryData?.outcomes_recorded ?? summaryData?.recorded_outcomes ?? derivedSummary.completed ?? 0),
    label: 'Outcomes'
  }, {
    id: 4,
    value: `${String(summaryData?.outcome_summary?.adverse_outcome_rate ?? outcomeData?.adverse_summary?.rate ?? outcomeData?.adverse_outcome_rate ?? 0)}%`,
    label: 'Adverse Rate'
  }];
  const reportSummary = {
    title: `DP Performance Report - ${summaryData?.report_period?.start_date || outcomeData?.report_period?.start_date || 'N/A'} to ${summaryData?.report_period?.end_date || outcomeData?.report_period?.end_date || 'N/A'}`,
    date: formatDateDDMMYYYY(new Date()),
    stats: {
      total: String(summaryData?.referral_summary?.total_referrals ?? summaryData?.total_referrals ?? summaryData?.referrals ?? derivedSummary.totalReferrals ?? 0),
      accepted: String(summaryData?.referral_summary?.accepted ?? summaryData?.accepted_referrals ?? summaryData?.accepted ?? derivedSummary.accepted ?? 0),
      outcomes: String(summaryData?.outcome_summary?.total_outcomes ?? summaryData?.outcomes_recorded ?? summaryData?.recorded_outcomes ?? derivedSummary.completed ?? 0),
      adverseRate: String(summaryData?.outcome_summary?.adverse_outcome_rate ?? outcomeData?.adverse_summary?.rate ?? outcomeData?.adverse_outcome_rate ?? 0)
    }
  };
  return <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.headerTop}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                  <ArrowLeft size={20} color="white" />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                  <Text style={styles.headerTitle}>DP Reports</Text>
                  <Text style={styles.headerSubtitle}>DP Referral Reports</Text>
                </View>
                <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
                  <Home size={20} color="white" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilter(prev => !prev)}>
                  <Funnel size={20} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {showFilter && <View style={styles.filterSection}>
              <View style={styles.filterContent}>
                <Text style={styles.filterTitle}>{t('filterByPeriod')}</Text>
                <View style={styles.filterOptions}>
                  {filterOptions.map(option => <TouchableOpacity key={option.id} style={[styles.filterOption, selectedFilter === option.id && styles.filterOptionSelected]} onPress={() => handleFilterSelect(option.id)}>
                      <Text style={[styles.filterOptionText, selectedFilter === option.id && styles.filterOptionTextSelected]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>)}
                </View>
              </View>
            </View>}

          <View style={styles.mainContent}>
            <View style={styles.contentContainer}>
              <View style={styles.summaryGrid}>
                {summaryStats.map(stat => <View key={stat.id} style={styles.summaryCard}>
                    <Text style={styles.summaryValue}>{stat.value}</Text>
                    <Text style={styles.summaryLabel}>{stat.label}</Text>
                  </View>)}
              </View>

              <View style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <View style={styles.reportInfo}>
                    <Text style={styles.reportMonth}>{reportSummary.title}</Text>
                    <Text style={styles.reportDate}>{reportSummary.date}</Text>
                  </View>
                </View>

              <View style={styles.reportStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{reportSummary.stats.total}</Text>
                  <Text style={styles.statLabel}>Referrals</Text>
                </View>
                  <View style={styles.statItem}>
                    <Text style={styles.highRiskValue}>{reportSummary.stats.accepted}</Text>
                    <Text style={styles.highRiskLabel}>Accepted</Text>
                  </View>
                  <View style={styles.statItem}>
                  <Text style={styles.ancDoneValue}>{reportSummary.stats.outcomes}</Text>
                  <Text style={styles.ancDoneLabel}>Outcomes</Text>
                </View>
              </View>

              <View style={styles.reportStats}>
                <View style={styles.statItem}>
                  <Text style={styles.highRiskValue}>{reportSummary.stats.adverseRate}%</Text>
                  <Text style={styles.highRiskLabel}>Adverse Outcome Rate</Text>
                </View>
              </View>
              </View>

              <TouchableOpacity style={styles.downloadButton} onPress={handleDownloadReport} activeOpacity={0.7}>
                <Download size={16} color="white" style={styles.downloadIcon} />
                <Text style={styles.downloadText}>{t('downloadDPReport')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>;
};
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f0f4f8'
  },
  scrollContent: {
    flexGrow: 1,
    minHeight: '100%'
  },
  header: {
    backgroundColor: '#D2691E',
    paddingHorizontal: 20,
    paddingVertical: 20
  },
  headerContent: {
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%'
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  homeButton: {
    width: 40,
    height: 40,
    backgroundColor: '#8B4513',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8
  },
  headerTitleContainer: {
    flex: 1
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4
  },
  headerSubtitle: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9
  },
  filterButton: {
    width: 40,
    height: 40,
    backgroundColor: '#8B4513',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12
  },
  filterSection: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 20,
    paddingVertical: 8
  },
  filterContent: {
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%'
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4
  },
  filterOption: {
    padding: 4,
    paddingHorizontal: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 4
  },
  filterOptionSelected: {
    backgroundColor: '#8B4513'
  },
  filterOptionText: {
    fontSize: 12,
    color: '#1f2937'
  },
  filterOptionTextSelected: {
    color: 'white',
    fontWeight: '500'
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#f0f4f8'
  },
  contentContainer: {
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%'
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  summaryCard: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    marginBottom: 10,
    minHeight: 88,
    justifyContent: 'center'
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
    textAlign: 'center'
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    textAlign: 'center'
  },
  downloadButton: {
    backgroundColor: '#8B4513',
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  downloadIcon: {
    marginRight: 8
  },
  downloadText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center'
  },
  reportCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    marginBottom: 16
  },
  reportHeader: {
    padding: 12
  },
  reportInfo: {
    flex: 1
  },
  reportMonth: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 3
  },
  reportDate: {
    fontSize: 11,
    color: '#6b7280'
  },
  reportStats: {
    backgroundColor: '#f7fafc',
    borderRadius: 6,
    padding: 8,
    marginHorizontal: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    padding: 4,
    backgroundColor: '#f8fafc',
    borderRadius: 4
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2d3748',
    marginBottom: 1
  },
  statLabel: {
    fontSize: 8,
    fontWeight: '600',
    color: '#718096'
  },
  highRiskValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 4
  },
  highRiskLabel: {
    fontSize: 12,
    color: '#dc2626'
  },
  ancDoneValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#16a34a',
    marginBottom: 4
  },
  ancDoneLabel: {
    fontSize: 12,
    color: '#16a34a'
  }
});
export default DeliveryPointReportsScreen;
