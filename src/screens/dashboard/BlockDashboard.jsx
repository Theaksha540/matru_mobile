import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Menu,
  UserPlus,
  TriangleAlert,
  ClipboardList,
  FileText,
  Bell,
  Download,
  MapPin,
} from 'lucide-react-native';
import { secureStorage } from '../../utils/secureStorage';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { dashboardAPI, reportsAPI, pregnantWomenAPI, usgAppointmentAPI, grievanceAPI } from '../../services/api';
import { useTranslation } from 'react-i18next';
import '../../i18n';
import Footer from '../../components/Footer';
import { useNotifications } from '../../contexts/NotificationContext';
import { useFocusEffect } from '@react-navigation/native';
import { downloadTextReport } from '../../utils/reportDownload';
import { syncService } from '../../utils/syncService';

const BlockDashboard = ({ navigation, route }) => {
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 380;
  const isTablet = width >= 768;
  const horizontalPadding = isSmallScreen ? 12 : isTablet ? 24 : 16;
  const contentMaxWidth = isTablet ? 860 : width;
  const isOnline = useNetworkStatus();
  const { unreadCount } = useNotifications();
  const [userInfo, setUserInfo] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dpPerformance, setDpPerformance] = useState([]);
  const [wardPerformance, setWardPerformance] = useState([]);
  const [deliverySummary, setDeliverySummary] = useState(null);
  const [deliveryOutcomeBreakdown, setDeliveryOutcomeBreakdown] = useState(null);
  const [grievanceCount, setGrievanceCount] = useState(0);
  const [downloadingDPReport, setDownloadingDPReport] = useState(false);
  const [currentDPPage, setCurrentDPPage] = useState(1);
  const [currentWardPage, setCurrentWardPage] = useState(1);
  const [, forceUpdate] = useState({});
  const { blockId, blockName } = route?.params || {};
  const dpPerPage = 5;
  const wardsPerPage = 5;

  useEffect(() => {
    loadData();
    
    const onLanguageChange = () => {
      forceUpdate({});
    };
    
    i18n.on('languageChanged', onLanguageChange);
    
    return () => {
      i18n.off('languageChanged', onLanguageChange);
    };
  }, [i18n]);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [blockId, isOnline])
  );

  const loadData = async () => {
    try {
      const userData = await secureStorage.getItem('user_info');
      if (userData) {
        const user = userData;
        console.log('User data:', user);
        setUserInfo(user);
        
        if (isOnline) {
          const effectiveBlockId = blockId || user?.block_id;
          const reportParams = effectiveBlockId ? { block_id: effectiveBlockId } : {};
          // Load stats for specific block if blockId provided
          const [statsData, summaryData, outcomeData, pointPerformanceData, wardTrendData, grievanceData] = await Promise.all([
            effectiveBlockId
              ? dashboardAPI.getBlockStats(effectiveBlockId).catch((statsError) => {
                  console.error('Error loading block stats:', statsError);
                  return null;
                })
              : dashboardAPI.getStats().catch((statsError) => {
                  console.error('Error loading generic dashboard stats:', statsError);
                  return null;
                }),
            reportsAPI.getDeliverySummary(reportParams).catch((summaryError) => {
              console.error('Error loading delivery summary:', summaryError);
              return null;
            }),
            reportsAPI.getDeliveryOutcomeBreakdown(reportParams).catch((outcomeError) => {
              console.error('Error loading delivery outcome breakdown:', outcomeError);
              return null;
            }),
            reportsAPI.getDeliveryPointPerformance(reportParams).catch((pointError) => {
              console.error('Error loading delivery point performance:', pointError);
              return [];
            }),
            effectiveBlockId
              ? reportsAPI.getWardWiseTrends(effectiveBlockId).catch((wardError) => {
                  console.error('Error loading ward-wise trends:', wardError);
                  return [];
                })
              : Promise.resolve([]),
            grievanceAPI.getAll(reportParams).catch((grievanceError) => {
              console.error('Error loading grievances:', grievanceError);
              return [];
            }),
          ]);
          console.log('Stats data:', statsData);
          console.log('Block dashboard effective block id:', effectiveBlockId);
          console.log('Ward trends response:', wardTrendData);
          const normalizedStats = normalizeStatsResponse(statsData);
          const resolvedStats = normalizedStats || await buildFallbackBlockStats(effectiveBlockId);
          setStats(resolvedStats);
          setDeliverySummary(summaryData);
          setDeliveryOutcomeBreakdown(outcomeData);
          setGrievanceCount(extractListFromResponse(grievanceData, ['grievances', 'results']).length);
          setDpPerformance(
            extractListFromResponse(pointPerformanceData, ['dp_performance', 'delivery_points'])
          );
          setWardPerformance(
            extractListFromResponse(wardTrendData, [
              'wards',
              'ward_wise_trends',
              'ward_trends',
              'trends',
              'results',
            ])
          );
          const cacheKey = effectiveBlockId ? `cached_block_stats_${effectiveBlockId}` : 'cached_block_stats';
          await Promise.all([
            resolvedStats ? syncService.setCachedResource(cacheKey, resolvedStats) : Promise.resolve(false),
            summaryData ? syncService.setCachedResource(`${cacheKey}_delivery_summary`, summaryData) : Promise.resolve(false),
            outcomeData ? syncService.setCachedResource(`${cacheKey}_delivery_outcome_breakdown`, outcomeData) : Promise.resolve(false),
            pointPerformanceData ? syncService.setCachedResource(`${cacheKey}_dp_performance`, pointPerformanceData) : Promise.resolve(false),
            wardTrendData ? syncService.setCachedResource(`${cacheKey}_ward_performance`, wardTrendData) : Promise.resolve(false),
            grievanceData ? syncService.setCachedResource(`${cacheKey}_grievances`, grievanceData) : Promise.resolve(false),
          ]);
        } else {
          const effectiveBlockId = blockId || user?.block_id;
          const cacheKey = effectiveBlockId ? `cached_block_stats_${effectiveBlockId}` : 'cached_block_stats';
          const [
            cachedStats,
            cachedDeliverySummary,
            cachedDeliveryOutcomeBreakdown,
            cachedDPPerformance,
            cachedWardPerformance,
            cachedGrievances,
          ] = await Promise.all([
            syncService.getCachedResource(cacheKey),
            syncService.getCachedResource(`${cacheKey}_delivery_summary`),
            syncService.getCachedResource(`${cacheKey}_delivery_outcome_breakdown`),
            syncService.getCachedResource(`${cacheKey}_dp_performance`),
            syncService.getCachedResource(`${cacheKey}_ward_performance`),
            syncService.getCachedResource(`${cacheKey}_grievances`),
          ]);
          if (cachedStats) {
            console.log('Cached stats data:', cachedStats);
            setStats(normalizeStatsResponse(cachedStats) || cachedStats);
          }
          if (cachedDeliverySummary) {
            setDeliverySummary(cachedDeliverySummary);
          }
          if (cachedDeliveryOutcomeBreakdown) {
            setDeliveryOutcomeBreakdown(cachedDeliveryOutcomeBreakdown);
          }
          if (cachedDPPerformance) {
            setDpPerformance(
              extractListFromResponse(cachedDPPerformance, ['dp_performance', 'delivery_points'])
            );
          }
          if (cachedWardPerformance) {
            setWardPerformance(
              extractListFromResponse(cachedWardPerformance, [
                'wards',
                'ward_wise_trends',
                'ward_trends',
                'trends',
                'results',
              ])
            );
          }
          if (cachedGrievances) {
            setGrievanceCount(extractListFromResponse(cachedGrievances, ['grievances', 'results']).length);
          }
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      // Try loading from cache on error
      try {
        const effectiveBlockId = blockId || userInfo?.block_id;
        const cacheKey = effectiveBlockId ? `cached_block_stats_${effectiveBlockId}` : 'cached_block_stats';
        const [
          cachedStats,
          cachedDeliverySummary,
          cachedDeliveryOutcomeBreakdown,
          cachedDPPerformance,
          cachedWardPerformance,
          cachedGrievances,
        ] = await Promise.all([
          syncService.getCachedResource(cacheKey),
          syncService.getCachedResource(`${cacheKey}_delivery_summary`),
          syncService.getCachedResource(`${cacheKey}_delivery_outcome_breakdown`),
          syncService.getCachedResource(`${cacheKey}_dp_performance`),
          syncService.getCachedResource(`${cacheKey}_ward_performance`),
          syncService.getCachedResource(`${cacheKey}_grievances`),
        ]);
        if (cachedStats) {
          console.log('Fallback cached stats data:', cachedStats);
          setStats(normalizeStatsResponse(cachedStats) || cachedStats);
        }
        if (cachedDeliverySummary) {
          setDeliverySummary(cachedDeliverySummary);
        }
        if (cachedDeliveryOutcomeBreakdown) {
          setDeliveryOutcomeBreakdown(cachedDeliveryOutcomeBreakdown);
        }
        if (cachedDPPerformance) {
          setDpPerformance(
            extractListFromResponse(cachedDPPerformance, ['dp_performance', 'delivery_points'])
          );
        }
        if (cachedWardPerformance) {
          setWardPerformance(
            extractListFromResponse(cachedWardPerformance, [
              'wards',
              'ward_wise_trends',
              'ward_trends',
              'trends',
              'results',
            ])
          );
        }
        if (cachedGrievances) {
          setGrievanceCount(extractListFromResponse(cachedGrievances, ['grievances', 'results']).length);
        }
      } catch (cacheError) {
        console.error('Error loading cached stats:', cacheError);
      }
    } finally {
      setLoading(false);
    }
  };

  const extractListFromResponse = (response, keys = []) => {
    if (Array.isArray(response)) {
      return response;
    }

    if (!response || typeof response !== 'object') {
      return [];
    }

    for (const key of keys) {
      if (Array.isArray(response?.[key])) {
        return response[key];
      }
    }

    if (response.data && typeof response.data === 'object') {
      for (const key of keys) {
        if (Array.isArray(response.data?.[key])) {
          return response.data[key];
        }
      }
    }

    if (Array.isArray(response?.items)) {
      return response.items;
    }

    if (Array.isArray(response?.data?.items)) {
      return response.data.items;
    }

    return [];
  };

  const normalizeStatsResponse = (response) => {
    if (!response || typeof response !== 'object') {
      return null;
    }

    if (
      response.total_pregnant_women !== undefined ||
      response.high_risk_cases !== undefined ||
      response.pending_usg_appointments !== undefined ||
      response.completed_usg_appointments !== undefined
    ) {
      return response;
    }

    if (response.block_stats && typeof response.block_stats === 'object') {
      return response.block_stats;
    }

    if (response.overall_stats && typeof response.overall_stats === 'object') {
      return response.overall_stats;
    }

    if (response.data && typeof response.data === 'object') {
      return normalizeStatsResponse(response.data);
    }

    return null;
  };

  const buildFallbackBlockStats = async (effectiveBlockId) => {
    if (!effectiveBlockId) {
      return null;
    }

    try {
      const [womenResponse, appointmentsResponse] = await Promise.all([
        pregnantWomenAPI.getAll({ block_id: effectiveBlockId, limit: 1000 }),
        usgAppointmentAPI.getAll({ limit: 1000 }),
      ]);

      const womenData = extractListFromResponse(womenResponse, ['items']);
      const appointmentsData = extractListFromResponse(appointmentsResponse, ['items']);

      const blockWomen = womenData.filter(
        (woman) => woman && String(woman.block_id) === String(effectiveBlockId)
      );
      const blockWomenIds = new Set(blockWomen.map((woman) => woman?.id).filter(Boolean));
      const blockAppointments = appointmentsData.filter(
        (appointment) =>
          appointment &&
          appointment.pregnant_woman_id &&
          blockWomenIds.has(appointment.pregnant_woman_id)
      );

      return {
        total_pregnant_women: blockWomen.length,
        high_risk_cases: blockWomen.filter((woman) => woman?.is_high_risk).length,
        pending_usg_appointments: blockAppointments.filter((appointment) => appointment?.status === 'pending').length,
        completed_usg_appointments: blockAppointments.filter((appointment) => appointment?.status === 'completed').length,
        total_usg_appointments: blockAppointments.length,
      };
    } catch (fallbackError) {
      console.error('Error building fallback block stats:', fallbackError);
      return null;
    }
  };

  // KPI Data - from API
  const kpis = [
    {
      id: 1,
      value: stats?.total_pregnant_women?.toString() || '0',
      title: t('totalRegistered'),
      subtitle: t('totalRegistered'),
      bgColor: '#ffffff',
      borderColor: '#e5e7eb',
      textColor: '#111827',
      subTextColor: '#6b7280',
    },
    {
      id: 2,
      value: stats?.high_risk_cases?.toString() || '0',
      title: t('highRisk'),
      subtitle: t('highRisk'),
      bgColor: '#fef2f2',
      borderColor: '#ff4d4f',
      
      textColor: '#991b1b',
      subTextColor: '#b91c1c',
    },
    {
      id: 3,
      value: stats?.pending_usg_appointments?.toString() || '0',
      title: t('pendingUSG'),
      subtitle: t('pendingUSG'),
      bgColor: '#dbeafe',
      borderColor: '#3b5cff',
      textColor: '#1e40af',
      subTextColor: '#1d4ed8',
    },
    {
      id: 4,
      value: stats?.completed_usg_appointments && stats?.total_usg_appointments 
        ? `${Math.round((stats.completed_usg_appointments / stats.total_usg_appointments) * 100)}%`
        : '0%',
      title: t('usgCompletion'),
      subtitle: t('usgCompletion'),
      bgColor: '#dcfce7',
      borderColor: '#22c55e',
      textColor: '#166534',
      subTextColor: '#15803d',
    },
  ];

  // Quick Actions - Block Level
  const quickActions = [
    {
      id: 1,
      title: t('grievanceHandling'),
      subtitle: t('viewResolveIssues'),
      icon: ClipboardList,
      iconBgColor: 'rgba(139, 69, 19, 0.1)',
      iconColor: '#8B4513',
      count: grievanceCount.toString(),
      onPress: () => navigation.navigate('GrievanceHandling'),
    },
    {
      id: 2,
      title: t('viewHighRiskCases'),
      subtitle: t('monitorCriticalCases'),
      icon: TriangleAlert,
      iconBgColor: 'rgba(139, 69, 19, 0.1)',
      iconColor: '#8B4513',
      count: stats?.high_risk_cases?.toString() || '0',
      onPress: () => navigation.navigate('HighRiskCases'),
    },
    {
      id: 3,
      title: t('blockReports'),
      subtitle: t('analyticsExports'),
      icon: FileText,
      iconBgColor: 'rgba(139, 69, 19, 0.1)',
      iconColor: '#8B4513',
      onPress: () => navigation.navigate('BlockReports'),
    },
    {
      id: 4,
      title: t('dpReports'),
      subtitle: t('deliveryPointAnalytics'),
      icon: FileText,
      iconBgColor: 'rgba(139, 69, 19, 0.1)',
      iconColor: '#8B4513',
      onPress: () => navigation.navigate('DPReports', { scope: 'block' }),
    },
  ];

  const handleMenuPress = () => {
    // You can show a dropdown menu, drawer, or navigate to profile
    // For now, let's navigate to ProfileSettings
    navigation.navigate('ProfileSettings', { userInfo });
  };

  const handleWardSelect = (ward) => {
    navigation.navigate('WardDetailsScreen', {
      wardId: ward.id,
      wardName: ward.name,
      blockId: blockId || userInfo?.block_id,
      blockName: blockName || userInfo?.username || '',
    });
  };

  const toSafeNumber = (value) => {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : 0;
  };

  const normalizedDPPerformance = dpPerformance.map((item, index) => ({
    id: item?.dp_id || item?.id || index,
    name: item?.dp_name || item?.delivery_point_name || item?.name || `DP ${index + 1}`,
    referrals: toSafeNumber(
      item?.total_referrals_received ?? item?.total_referrals ?? item?.referrals ?? item?.total_cases ?? 0
    ),
    accepted: toSafeNumber(
      item?.accepted ?? item?.accepted_referrals ?? item?.accepted_cases ?? 0
    ),
    outcomes: toSafeNumber(
      item?.completed ?? item?.outcomes_recorded ?? item?.completed_outcomes ?? 0
    ),
    reReferred: toSafeNumber(
      item?.re_referred ?? item?.re_referred_count ?? item?.referred_again ?? 0
    ),
    rate: toSafeNumber(
      item?.acceptance_rate ?? item?.performance_rate ?? item?.outcome_recording_rate ?? item?.success_rate ?? 0
    ),
    reReferralRate: toSafeNumber(
      item?.re_referral_rate ?? item?.re_referred_rate ?? item?.re_referral_percentage ?? 0
    ),
  }));
  const totalDPPages = Math.max(1, Math.ceil(normalizedDPPerformance.length / dpPerPage));
  const paginatedDPPerformance = normalizedDPPerformance.slice(
    (currentDPPage - 1) * dpPerPage,
    currentDPPage * dpPerPage
  );
  const dpKpis = [
    {
      id: 1,
      value: String(normalizedDPPerformance.length || 0),
      label: t('totalDPs'),
      textColor: '#111827',
      subTextColor: '#6b7280',
      bgColor: '#ffffff',
      borderColor: '#e5e7eb',
    },
    {
      id: 2,
      value: String(
        normalizedDPPerformance.reduce((sum, item) => sum + toSafeNumber(item.referrals), 0)
      ),
      label: t('referrals'),
      textColor: '#1e40af',
      subTextColor: '#1d4ed8',
      bgColor: '#eff6ff',
      borderColor: '#bfdbfe',
    },
    {
      id: 3,
      value: String(
        normalizedDPPerformance.reduce((sum, item) => sum + toSafeNumber(item.accepted), 0)
      ),
      label: t('accepted'),
      textColor: '#166534',
      subTextColor: '#15803d',
      bgColor: '#dcfce7',
      borderColor: '#86efac',
    },
    {
      id: 4,
      value: String(
        normalizedDPPerformance.reduce((sum, item) => sum + toSafeNumber(item.outcomes), 0)
      ),
      label: t('completed'),
      textColor: '#92400e',
      subTextColor: '#b45309',
      bgColor: '#fef3c7',
      borderColor: '#fcd34d',
    },
  ];

  useEffect(() => {
    if (currentDPPage > totalDPPages) {
      setCurrentDPPage(1);
    }
  }, [currentDPPage, totalDPPages]);

  const normalizedWardPerformance = wardPerformance.map((item, index) => {
    const monthlyData = Array.isArray(item?.monthly_data) ? item.monthly_data : [];
    const totalRegistrations = monthlyData.length
      ? monthlyData.reduce((sum, month) => sum + toSafeNumber(month?.registrations), 0)
      : toSafeNumber(item?.registrations ?? item?.total_registrations ?? item?.total_cases ?? item?.registered_cases);
    const totalHighRisk = monthlyData.length
      ? monthlyData.reduce((sum, month) => sum + toSafeNumber(month?.high_risk), 0)
      : toSafeNumber(item?.high_risk ?? item?.high_risk_cases);
    const totalAppointments = monthlyData.length
      ? monthlyData.reduce((sum, month) => sum + toSafeNumber(month?.appointments), 0)
      : toSafeNumber(item?.appointments ?? item?.anc_visits ?? item?.total_appointments);
    const totalDeliveries = monthlyData.length
      ? monthlyData.reduce((sum, month) => sum + toSafeNumber(month?.deliveries), 0)
      : toSafeNumber(item?.deliveries ?? item?.completed_deliveries ?? item?.total_deliveries);
    const currentMonth = monthlyData[0] || {};
    const previousMonth = monthlyData[1] || {};
    const trendValue = previousMonth?.registrations
      ? ((toSafeNumber(currentMonth?.registrations) - toSafeNumber(previousMonth?.registrations)) / toSafeNumber(previousMonth?.registrations)) * 100
      : toSafeNumber(item?.trend ?? item?.trend_percentage);

    return {
      id: item?.ward_id || item?.id || index,
      name: item?.ward_name || item?.name || `Ward ${index + 1}`,
      registrations: totalRegistrations,
      highRisk: totalHighRisk,
      appointments: totalAppointments,
      deliveries: totalDeliveries,
      ancRate: totalRegistrations > 0 ? Math.round((totalAppointments / totalRegistrations) * 100) : 0,
      trend: Number.isFinite(trendValue) ? trendValue : 0,
    };
  });
  const totalWardPages = Math.max(1, Math.ceil(normalizedWardPerformance.length / wardsPerPage));
  const paginatedWardPerformance = normalizedWardPerformance.slice(
    (currentWardPage - 1) * wardsPerPage,
    currentWardPage * wardsPerPage
  );
  useEffect(() => {
    if (currentWardPage > totalWardPages) {
      setCurrentWardPage(1);
    }
  }, [currentWardPage, totalWardPages]);

  const formatRate = (value) => {
    const numericValue = Number(value || 0);
    return `${Number.isFinite(numericValue) ? Math.round(numericValue) : 0}%`;
  };

  const buildDPReportCsv = () => {
    const summaryRows = [
      ['Metric', 'Value'],
      ['Total Referrals', deliverySummary?.total_referrals || deliverySummary?.referrals || 0],
      ['Accepted Referrals', deliverySummary?.accepted_referrals || deliverySummary?.accepted || 0],
      ['Re-Referred', deliverySummary?.re_referred || deliverySummary?.re_referred_cases || 0],
      ['Recorded Outcomes', deliverySummary?.outcomes_recorded || deliverySummary?.recorded_outcomes || 0],
      ['Adverse Outcomes', deliveryOutcomeBreakdown?.adverse_summary?.total || deliveryOutcomeBreakdown?.adverse_outcomes || 0],
    ];

    const outcomeItems = Array.isArray(deliveryOutcomeBreakdown?.outcomes)
      ? deliveryOutcomeBreakdown.outcomes
      : Array.isArray(deliveryOutcomeBreakdown?.items)
        ? deliveryOutcomeBreakdown.items
        : [];

    const outcomeRows = [
      [],
      ['Outcome Breakdown'],
      ['Outcome', 'Count', 'Percentage'],
      ...outcomeItems.map((item) => [
        item?.outcome || item?.name || 'Unknown',
        item?.count || 0,
        item?.percentage || 0,
      ]),
    ];

    const performanceRows = [
      [],
      ['DP-wise Overview'],
      ['DP Name', 'Referrals', 'Accepted', 'Outcomes', 'Rate'],
      ...normalizedDPPerformance.map((item) => [
        item.name,
        item.referrals,
        item.accepted,
        item.outcomes,
        formatRate(item.rate),
      ]),
    ];

    return [...summaryRows, ...outcomeRows, ...performanceRows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
  };

  const handleDownloadDPReport = async () => {
    if (!normalizedDPPerformance.length && !deliverySummary && !deliveryOutcomeBreakdown) {
      Alert.alert(t('error'), t('dpReportDataUnavailable'));
      return;
    }

    try {
      setDownloadingDPReport(true);
      const csvContent = buildDPReportCsv();
      const fileName = `block_dp_report_${new Date().toISOString().split('T')[0]}.csv`;
      await downloadTextReport({
        content: csvContent,
        fileName,
        mimeType: 'text/csv',
      });

      Alert.alert(t('success'), t('dpReportDownloadedSuccessfully'));
    } catch (error) {
      console.error('DP report download error:', error);
      Alert.alert(t('error'), t('failedToDownloadDPReport'));
    } finally {
      setDownloadingDPReport(false);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView
          style={styles.scrollViewStyle}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={[styles.header, { paddingHorizontal: horizontalPadding }]}>
            <View style={[styles.headerContent, { maxWidth: contentMaxWidth }]}>
              <View style={styles.headerTop}>
                {/* Left Side - Logo + User Info */}
                <View style={styles.headerInfo}>
                  <View style={styles.titleRow}>
                    <View style={styles.logoContainerLeft}>
                      <Image 
                        source={require('../../../assets/image/image2.png')}
                        style={styles.logoLeft}
                        resizeMode="contain"
                      />
                    </View>
                    <Text style={styles.headerTitle}>
                      {blockName ? `${blockName} ${t('block')}` : t('blockDashboard')}
                    </Text>
                  </View>
                  <Text style={styles.headerSubtitle}>
                    {userInfo?.full_name || t('loading')} • {t('blockCoordinator')}
                  </Text>
                  <View style={styles.networkStatus}>
                    <View style={[styles.statusDot, { backgroundColor: isOnline ? '#22c55e' : '#ef4444' }]} />
                    <Text style={styles.statusText}>{isOnline ? t('online') : t('offline')}</Text>
                  </View>
                  <Text style={styles.headerLocation}>
                    {blockName || userInfo?.username || ''}
                  </Text>
                </View>
                
                {/* Right Side - Bell + Menu */}
                <View style={styles.headerRightContainer}>
                  <TouchableOpacity 
                    style={styles.notificationButton}
                    onPress={() => navigation.navigate('Notifications')}
                    activeOpacity={0.7}
                  >
                    <Bell size={20} color="white" />
                    {unreadCount > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.menuButton}
                    onPress={handleMenuPress}
                    activeOpacity={0.7}
                  >
                    <Menu size={24} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {/* Main Content */}
          <View style={[styles.mainContent, { paddingHorizontal: horizontalPadding }]}>
            <View style={[styles.contentContainer, { maxWidth: contentMaxWidth }]}>
              {/* KPI Grid */}
              <View style={styles.kpiGrid}>
                {kpis.map((kpi) => (
                  <View
                    key={kpi.id}
                    style={[
                      styles.kpiCard,
                      {
                        width: '48%',
                        backgroundColor: kpi.bgColor,
                        borderColor: kpi.borderColor,
                      },
                    ]}
                  >
                    <Text style={[styles.kpiValue, { color: kpi.textColor }]}>
                      {kpi.value}
                    </Text>
                    <Text style={[styles.kpiTitle, { color: kpi.textColor }]}>
                      {kpi.title}
                    </Text>
                    <Text style={[styles.kpiSubtitle, { color: kpi.subTextColor }]}>
                      {kpi.subtitle}
                    </Text>
                  </View>
                ))}
              </View>

              <Text style={styles.sectionTitle}>
                {t('dpSummary')} / {t('deliveryPointKPI')}
              </Text>
              <View style={styles.dpKpiGrid}>
                {dpKpis.map((kpi) => (
                  <View
                    key={kpi.id}
                    style={[
                      styles.kpiCard,
                      {
                        width: '48%',
                        backgroundColor: kpi.bgColor,
                        borderColor: kpi.borderColor,
                      },
                    ]}
                  >
                    <Text style={[styles.kpiValue, { color: kpi.textColor }]}>{kpi.value}</Text>
                    <Text style={[styles.kpiTitle, { color: kpi.subTextColor }]}>{kpi.label}</Text>
                  </View>
                ))}
              </View>

              {/* Quick Actions Title */}
              <Text style={styles.sectionTitle}>
                {t('quickActions')}
              </Text>

              {/* Quick Actions */}
              <View style={styles.actionsContainer}>
                {quickActions.map((action) => {
                  const IconComponent = action.icon;
                  return (
                    <TouchableOpacity
                      key={action.id}
                      style={styles.actionButton}
                      onPress={action.onPress}
                      activeOpacity={0.7}
                    >
                      <View style={styles.actionContent}>
                        <View
                          style={[
                            styles.actionIconContainer,
                            { backgroundColor: action.iconBgColor },
                          ]}
                        >
                          <IconComponent size={20} color={action.iconColor} />
                        </View>
                        <View style={styles.actionTextContainer}>
                          <Text style={styles.actionTitle}>{action.title}</Text>
                          <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
                        </View>
                        {action.count && (
                          <View style={styles.actionCount}>
                            <Text style={styles.actionCountText}>{action.count}</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sectionTitle}>
                {t('wardPerformance')} / {t('wardWiseSummary')}
              </Text>
              <View style={styles.dpContainer}>
                {normalizedWardPerformance.length > 0 ? (
                  <>
                    <ScrollView
                      style={styles.dpScrollContainer}
                      showsVerticalScrollIndicator={true}
                      nestedScrollEnabled={true}
                    >
                      {paginatedWardPerformance.map((ward) => (
                        <TouchableOpacity
                          key={ward.id}
                          style={styles.blockCard}
                          onPress={() => handleWardSelect(ward)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.blockHeader}>
                            <View style={styles.blockIconContainer}>
                              <MapPin size={16} color="#8B4513" />
                            </View>
                            <Text style={styles.blockName}>{ward.name}</Text>
                          </View>
                          <View style={styles.blockStats}>
                            <View style={styles.statItem}>
                              <Text style={styles.statValue}>{ward.registrations}</Text>
                              <Text style={styles.statLabel}>{t('total')}</Text>
                            </View>
                            <View style={styles.statItem}>
                              <Text style={styles.highRiskValue}>{ward.highRisk}</Text>
                              <Text style={styles.highRiskLabel}>{t('highRisk')}</Text>
                            </View>
                            <View style={styles.statItem}>
                              <Text style={styles.ancRateValue}>{ward.ancRate}%</Text>
                              <Text style={styles.ancRateLabel}>{t('ancRate')}</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    {totalWardPages > 1 && (
                      <View style={styles.paginationContainer}>
                        <TouchableOpacity
                          style={[
                            styles.paginationButton,
                            currentWardPage === 1 && styles.paginationButtonDisabled,
                          ]}
                          onPress={() => setCurrentWardPage((prev) => Math.max(1, prev - 1))}
                          disabled={currentWardPage === 1}
                        >
                          <Text style={styles.paginationButtonText}>{t('previous')}</Text>
                        </TouchableOpacity>

                        <View style={styles.paginationInfo}>
                          <Text style={styles.paginationText}>
                            {t('pageOf', { current: currentWardPage, total: totalWardPages })}
                          </Text>
                          <Text style={styles.paginationSubtext}>
                            {normalizedWardPerformance.length} wards
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={[
                            styles.paginationButton,
                            currentWardPage === totalWardPages && styles.paginationButtonDisabled,
                          ]}
                          onPress={() => setCurrentWardPage((prev) => Math.min(totalWardPages, prev + 1))}
                          disabled={currentWardPage === totalWardPages}
                        >
                          <Text style={styles.paginationButtonText}>{t('next')}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                ) : (
                  <Text style={styles.noDataText}>{t('noWardPerformanceDataFound')}</Text>
                )}
              </View>

              <Text style={styles.sectionTitle}>
                {t('dpWiseOverview')} / {t('deliveryPointSummary')}
              </Text>
              <View style={styles.dpContainer}>
                <TouchableOpacity
                  style={[styles.dpDownloadButton, downloadingDPReport && styles.dpDownloadButtonDisabled]}
                  onPress={handleDownloadDPReport}
                  activeOpacity={0.7}
                  disabled={downloadingDPReport}
                >
                  <Download size={16} color="white" style={styles.dpDownloadIcon} />
                  <Text style={styles.dpDownloadText}>
                    {downloadingDPReport ? t('preparingDPReport') : t('downloadDPReport')}
                  </Text>
                </TouchableOpacity>

                {normalizedDPPerformance.length > 0 ? (
                  <>
                    <ScrollView
                      style={styles.dpScrollContainer}
                      showsVerticalScrollIndicator={true}
                      nestedScrollEnabled={true}
                    >
                      {paginatedDPPerformance.map((dp) => (
                        <View key={dp.id} style={styles.blockCard}>
                          <View style={styles.blockHeader}>
                            <View style={styles.blockIconContainer}>
                              <MapPin size={16} color="#8B4513" />
                            </View>
                            <Text style={styles.blockName}>{dp.name}</Text>
                          </View>
                          <View style={styles.blockStats}>
                            <View style={styles.statItem}>
                              <Text style={styles.statValue}>{dp.referrals}</Text>
                              <Text style={styles.statLabel}>{t('referrals')}</Text>
                            </View>
                            <View style={styles.statItem}>
                              <Text style={styles.highRiskValue}>{dp.accepted}</Text>
                              <Text style={styles.highRiskLabel}>{t('accepted')}</Text>
                            </View>
                            <View style={styles.statItem}>
                              <Text style={styles.ancDoneValue}>{dp.outcomes}</Text>
                              <Text style={styles.ancDoneLabel}>{t('completed')}</Text>
                            </View>
                            <View style={styles.statItem}>
                              <Text style={styles.highRiskValue}>{dp.reReferred}</Text>
                              <Text style={styles.highRiskLabel}>{t('reReferred')}</Text>
                            </View>
                            <View style={styles.statItem}>
                              <Text style={styles.ancDoneValue}>{formatRate(dp.rate)}</Text>
                              <Text style={styles.ancDoneLabel}>{t('acceptedRate')}</Text>
                            </View>
                            <View style={styles.statItem}>
                              <Text style={styles.ancDoneValue}>{formatRate(dp.reReferralRate)}</Text>
                              <Text style={styles.ancDoneLabel}>{t('reReferralRate')}</Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </ScrollView>

                    {totalDPPages > 1 && (
                      <View style={styles.paginationContainer}>
                        <TouchableOpacity
                          style={[
                            styles.paginationButton,
                            currentDPPage === 1 && styles.paginationButtonDisabled,
                          ]}
                          onPress={() => setCurrentDPPage((prev) => Math.max(1, prev - 1))}
                          disabled={currentDPPage === 1}
                        >
                          <Text style={styles.paginationButtonText}>{t('previous')}</Text>
                        </TouchableOpacity>

                        <View style={styles.paginationInfo}>
                          <Text style={styles.paginationText}>
                            {t('pageOf', { current: currentDPPage, total: totalDPPages })}
                          </Text>
                          <Text style={styles.paginationSubtext}>
                            {normalizedDPPerformance.length} total DPs
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={[
                            styles.paginationButton,
                            currentDPPage === totalDPPages && styles.paginationButtonDisabled,
                          ]}
                          onPress={() => setCurrentDPPage((prev) => Math.min(totalDPPages, prev + 1))}
                          disabled={currentDPPage === totalDPPages}
                        >
                          <Text style={styles.paginationButtonText}>{t('next')}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                ) : (
                  <Text style={styles.noDataText}>{t('noDeliveryPointPerformanceDataFound')}</Text>
                )}
              </View>

              {/* Info Note */}
              <LinearGradient
                colors={['#e6f2ff', '#fff4e6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.infoNote}
              >
                <View style={styles.infoNoteBorder} />
                <Text style={styles.infoNoteText}>
                  <Text style={styles.infoNoteBold}>{t('note')}</Text> {t('bulkUploadNote')}
                </Text>
              </LinearGradient>
            </View>
          </View>

          <Footer />
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollViewStyle: {
    flex: 1,
  },
  header: {
    backgroundColor: '#D2691E',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerContent: {
    alignSelf: 'center',
    width: '100%',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 1,
  },
  headerInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  logoContainerLeft: {
    width: 32,
    height: 32,
    backgroundColor: 'white',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
    overflow: 'hidden',
  },
  logoLeft: {
    width: 45,
    height: 45,
    borderRadius: 13,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: '#e9d5ff',
    fontSize: 11,
    opacity:0.95,
    flexShrink: 1,
  },
  headerLocation: {
    color: '#e9d5ff',
    fontSize: 14,
  },
  networkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  // New styles for logo above hamburger menu
  headerRightContainer: {
    alignItems: 'center',
    marginLeft: 12,
  },

  menuButton: {
    width: 44,
    height: 44,
    backgroundColor: '#6d28d9',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  notificationButton: {
    width: 44,
    height: 44,
    backgroundColor: '#6d28d9',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 8,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#dc2626',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  contentContainer: {
    alignSelf: 'center',
    width: '100%',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  kpiCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  kpiTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
    textAlign: 'center',
  },
  kpiSubtitle: {
    fontSize: 10,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 10,
  },
  actionsContainer: {
    gap: 8,
    marginBottom: 12,
  },
  actionButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
  },
  actionButtonHighlighted: {
    borderColor: '#8B4513',
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  actionCount: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    paddingHorizontal: 6,
  },
  actionCountText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  dpContainer: {
    gap: 12,
    marginBottom: 16,
  },
  dpKpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  dpDownloadButton: {
    backgroundColor: '#8B4513',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dpDownloadButtonDisabled: {
    opacity: 0.7,
  },
  dpDownloadIcon: {
    marginRight: 8,
  },
  dpDownloadText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  dpScrollContainer: {
    maxHeight: 360,
  },
  blockCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  blockIconContainer: {
    width: 32,
    height: 32,
    backgroundColor: '#0b1c8c1a',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  blockName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3748',
  },
  blockStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    gap: 8,
  },
  statItem: {
    width: '31%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#718096',
  },
  highRiskValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 1,
  },
  highRiskLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#dc2626',
  },
  ancRateValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#276749',
    marginBottom: 1,
  },
  ancRateLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#276749',
  },
  ancDoneValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#276749',
    marginBottom: 1,
  },
  ancDoneLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#276749',
  },
  dpCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 10,
  },
  dpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dpName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginRight: 12,
  },
  dpRate: {
    fontSize: 14,
    fontWeight: '700',
    color: '#166534',
  },
  dpStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  dpStatItem: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  dpStatValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  dpStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
  },
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: 'white',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  paginationButton: {
    minWidth: 70,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: '#f3f4f6',
    opacity: 0.6,
  },
  paginationButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  paginationInfo: {
    flex: 1,
    alignItems: 'center',
  },
  paginationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  paginationSubtext: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  noDataText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 14,
    paddingVertical: 16,
  },
  grievancesContainer: {
    gap: 8,
    marginBottom: 12,
  },
  grievanceCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  grievanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  grievanceId: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
  },
  grievanceStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusPending: {
    backgroundColor: '#fef3c7',
  },
  statusProgress: {
    backgroundColor: '#dbeafe',
  },
  grievanceStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1f2937',
  },
  grievanceName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  grievanceLocation: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 6,
  },
  grievanceIssue: {
    fontSize: 12,
    color: '#1f2937',
    marginBottom: 8,
  },
  grievanceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grievanceDate: {
    fontSize: 11,
    color: '#6b7280',
  },
  resolveLink: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  infoNote: {
    borderRadius: 8,
    padding: 10,
    paddingLeft: 14,
    position: 'relative',
    marginTop: 4,
  },
  infoNoteBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#0B1C8C',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  infoNoteText: {
    fontSize: 12,
    color: '#0B1C8C',
    marginBottom: 4,
    lineHeight: 18,
  },
  infoNoteBold: {
    fontWeight: '600',
  },
  infoNoteTextOdia: {
    fontSize: 12,
    color: '#0B1C8C',
    lineHeight: 18,
  },
  footer: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  footerText: {
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
});

export default BlockDashboard;
