import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Alert, useWindowDimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Menu, Bell, TriangleAlert, FileText, Download, MapPin, ClipboardList } from 'lucide-react-native';
import { secureStorage } from '../../utils/secureStorage';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useTranslation } from 'react-i18next';
import { adminAPI, dashboardAPI, reportsAPI } from '../../services/api';
import { useNotifications } from '../../contexts/NotificationContext';
import Footer from '../../components/Footer';
import '../../i18n';
import { useFocusEffect } from '@react-navigation/native';
import { downloadTextReport } from '../../utils/reportDownload';
import { syncService } from '../../utils/syncService';
const DistrictDashboard = ({
  navigation
}) => {
  const {
    t
  } = useTranslation();
  const {
    width
  } = useWindowDimensions();
  const isSmallScreen = width < 380;
  const isTablet = width >= 768;
  const horizontalPadding = isSmallScreen ? 12 : isTablet ? 24 : 16;
  const contentMaxWidth = isTablet ? 860 : width;
  const isOnline = useNetworkStatus();
  const {
    unreadCount
  } = useNotifications();
  const [userInfo, setUserInfo] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentBlockPage, setCurrentBlockPage] = useState(1);
  const [dpPerformance, setDpPerformance] = useState([]);
  const [deliverySummary, setDeliverySummary] = useState(null);
  const [deliveryOutcomeBreakdown, setDeliveryOutcomeBreakdown] = useState(null);
  const [downloadingDPReport, setDownloadingDPReport] = useState(false);
  const [currentDPPage, setCurrentDPPage] = useState(1);
  const blocksPerPage = 5;
  const dpPerPage = 5;
  useEffect(() => {
    loadData();
  }, []);
  useFocusEffect(React.useCallback(() => {
    loadData();
  }, [isOnline]));
  const loadData = async () => {
    try {
      const userData = await secureStorage.getItem('user_info');
      if (userData) {
        const user = userData;
        setUserInfo(user);
        if (isOnline) {
          // Load fresh data when online
          const [overviewData, blocksData, summaryData, outcomeData, pointPerformanceData] = await Promise.all([dashboardAPI.getDistrictOverview(), user.district_id ? adminAPI.getBlocks(user.district_id) : Promise.resolve([]), reportsAPI.getDeliverySummary().catch(() => null), reportsAPI.getDeliveryOutcomeBreakdown().catch(() => null), reportsAPI.getDeliveryPointPerformance().catch(() => [])]);
          setStats(overviewData.overall_stats);
          setBlocks(overviewData.block_wise_stats || blocksData);
          setDeliverySummary(summaryData);
          setDeliveryOutcomeBreakdown(outcomeData);
          setDpPerformance(Array.isArray(pointPerformanceData?.dp_performance) ? pointPerformanceData.dp_performance : Array.isArray(pointPerformanceData) ? pointPerformanceData : pointPerformanceData?.items || []);

          // Debug: Log the stats to see available fields

          await Promise.all([syncService.setCachedResource('district_overview', overviewData), syncService.setCachedResource('district_blocks', blocksData), syncService.setCachedResource('district_delivery_summary', summaryData), syncService.setCachedResource('district_delivery_outcome_breakdown', outcomeData), syncService.setCachedResource('district_dp_performance', pointPerformanceData)]);
        } else {
          const [cachedOverview, cachedBlocks, cachedDeliverySummary, cachedDeliveryOutcomeBreakdown, cachedDPPerformance] = await Promise.all([syncService.getCachedResource('district_overview'), syncService.getCachedResource('district_blocks'), syncService.getCachedResource('district_delivery_summary'), syncService.getCachedResource('district_delivery_outcome_breakdown'), syncService.getCachedResource('district_dp_performance')]);
          if (cachedOverview) {
            setStats(cachedOverview.overall_stats || null);
            setBlocks(cachedOverview.block_wise_stats || []);
          }
          if (cachedBlocks && !cachedOverview) {
            setBlocks(cachedBlocks);
          }
          if (cachedDeliverySummary) {
            setDeliverySummary(cachedDeliverySummary);
          }
          if (cachedDeliveryOutcomeBreakdown) {
            setDeliveryOutcomeBreakdown(cachedDeliveryOutcomeBreakdown);
          }
          if (cachedDPPerformance) {
            setDpPerformance(Array.isArray(cachedDPPerformance?.dp_performance) ? cachedDPPerformance.dp_performance : Array.isArray(cachedDPPerformance) ? cachedDPPerformance : cachedDPPerformance?.items || []);
          }
        }
      }
    } catch (error) {
      // Try loading from cache on error
      try {
        const [cachedOverview, cachedBlocks, cachedDeliverySummary, cachedDeliveryOutcomeBreakdown, cachedDPPerformance] = await Promise.all([syncService.getCachedResource('district_overview'), syncService.getCachedResource('district_blocks'), syncService.getCachedResource('district_delivery_summary'), syncService.getCachedResource('district_delivery_outcome_breakdown'), syncService.getCachedResource('district_dp_performance')]);
        if (cachedOverview) {
          setStats(cachedOverview.overall_stats || null);
          setBlocks(cachedOverview.block_wise_stats || []);
        }
        if (cachedBlocks && !cachedOverview) {
          setBlocks(cachedBlocks);
        }
        if (cachedDeliverySummary) {
          setDeliverySummary(cachedDeliverySummary);
        }
        if (cachedDeliveryOutcomeBreakdown) {
          setDeliveryOutcomeBreakdown(cachedDeliveryOutcomeBreakdown);
        }
        if (cachedDPPerformance) {
          setDpPerformance(Array.isArray(cachedDPPerformance?.dp_performance) ? cachedDPPerformance.dp_performance : Array.isArray(cachedDPPerformance) ? cachedDPPerformance : cachedDPPerformance?.items || []);
        }
      } catch (cacheError) {}
    } finally {
      setLoading(false);
    }
  };

  // KPI Data - now from API
  const kpis = [{
    id: 1,
    value: stats?.total_pregnant_women?.toString() || '0',
    title: t('totalRegistered'),
    subtitle: 'ମୋଟ ପଞ୍ଜୀକୃତ',
    bgColor: '#ffffff',
    borderColor: '#e5e7eb',
    textColor: '#111827',
    subTextColor: '#6b7280'
  }, {
    id: 2,
    value: stats?.high_risk_cases?.toString() || '0',
    title: t('highRiskCases'),
    subtitle: 'ଉଚ୍ଚ ବିପଦ ମାମଲା',
    bgColor: '#fee2e2',
    borderColor: '#ff4d4f',
    textColor: '#c53030',
    subTextColor: '#b91c1c'
  }, {
    id: 3,
    value: blocks.length.toString(),
    title: t('totalBlocks'),
    subtitle: 'ମୋଟ ବ୍ଲକ',
    bgColor: '#eff6ff',
    borderColor: '#3b5cff',
    textColor: '#1e40af',
    subTextColor: '#1d4ed8'
  }, {
    id: 4,
    value: stats?.pending_grievances?.toString() || '0',
    title: t('pendingGrievances'),
    subtitle: 'ଅପେକ୍ଷାରତ ଅଭିଯୋଗ',
    bgColor: '#fef3c7',
    borderColor: '#f59e0b',
    textColor: '#92400e',
    subTextColor: '#d97706'
  }];

  // Quick Actions
  const quickActions = [{
    id: 1,
    title: t('viewHighRiskCases'),
    subtitle: t('districtWideMonitoring'),
    icon: TriangleAlert,
    iconBgColor: '#8b45131a',
    iconColor: '#8B4513',
    count: stats?.high_risk_cases?.toString() || '0',
    onPress: () => navigation.navigate('HighRiskCases')
  }, {
    id: 2,
    title: t('grievanceManagement'),
    subtitle: t('handleDistrictGrievances'),
    icon: ClipboardList,
    iconBgColor: '#8b45131a',
    iconColor: '#8B4513',
    onPress: () => navigation.navigate('GrievanceHandling')
  }, {
    id: 3,
    title: t('districtReports'),
    subtitle: t('comprehensiveAnalytics'),
    icon: FileText,
    iconBgColor: '#8b45131a',
    iconColor: '#8B4513',
    onPress: () => navigation.navigate('DistrictReports')
  }, {
    id: 4,
    title: t('dpReports'),
    subtitle: t('deliveryPointAnalytics'),
    icon: FileText,
    iconBgColor: '#8b45131a',
    iconColor: '#8B4513',
    onPress: () => navigation.navigate('DPReports', {
      scope: 'district'
    })
  }];

  // Block Data - now from API
  const blockStats = blocks.map((block, index) => ({
    id: block.block_id || block.id || index,
    name: block.block_name || block.name,
    total: block.total_pregnant_women || 0,
    highRisk: block.high_risk_cases || 0,
    ancRate: block.completed_usg_appointments && block.total_usg_appointments ? Math.round(block.completed_usg_appointments / block.total_usg_appointments * 100) + '%' : '0%'
  }));
  const totalBlockPages = Math.max(1, Math.ceil(blockStats.length / blocksPerPage));
  const paginatedBlockStats = blockStats.slice((currentBlockPage - 1) * blocksPerPage, currentBlockPage * blocksPerPage);
  const toSafeNumber = value => {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : 0;
  };
  const normalizedDPPerformance = dpPerformance.map((item, index) => ({
    id: item?.dp_id || item?.id || index,
    name: item?.dp_name || item?.delivery_point_name || item?.name || `DP ${index + 1}`,
    referrals: toSafeNumber(item?.total_referrals_received ?? item?.total_referrals ?? item?.referrals ?? item?.total_cases ?? 0),
    accepted: toSafeNumber(item?.accepted ?? item?.accepted_referrals ?? item?.accepted_cases ?? 0),
    outcomes: toSafeNumber(item?.completed ?? item?.outcomes_recorded ?? item?.completed_outcomes ?? 0),
    reReferred: toSafeNumber(item?.re_referred ?? item?.re_referred_count ?? item?.referred_again ?? 0),
    rate: toSafeNumber(item?.acceptance_rate ?? item?.performance_rate ?? item?.outcome_recording_rate ?? item?.success_rate ?? 0),
    reReferralRate: toSafeNumber(item?.re_referral_rate ?? item?.re_referred_rate ?? item?.re_referral_percentage ?? 0)
  }));
  const totalDPPages = Math.max(1, Math.ceil(normalizedDPPerformance.length / dpPerPage));
  const paginatedDPPerformance = normalizedDPPerformance.slice((currentDPPage - 1) * dpPerPage, currentDPPage * dpPerPage);
  const dpKpis = [{
    id: 1,
    value: String(normalizedDPPerformance.length || 0),
    label: t('totalDPs'),
    textColor: '#111827',
    subTextColor: '#6b7280',
    bgColor: '#ffffff',
    borderColor: '#e5e7eb'
  }, {
    id: 2,
    value: String(normalizedDPPerformance.reduce((sum, item) => sum + toSafeNumber(item.referrals), 0)),
    label: t('referrals'),
    textColor: '#1e40af',
    subTextColor: '#1d4ed8',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe'
  }, {
    id: 3,
    value: String(normalizedDPPerformance.reduce((sum, item) => sum + toSafeNumber(item.accepted), 0)),
    label: t('accepted'),
    textColor: '#166534',
    subTextColor: '#15803d',
    bgColor: '#dcfce7',
    borderColor: '#86efac'
  }, {
    id: 4,
    value: String(normalizedDPPerformance.reduce((sum, item) => sum + toSafeNumber(item.outcomes), 0)),
    label: t('completed'),
    textColor: '#92400e',
    subTextColor: '#b45309',
    bgColor: '#fef3c7',
    borderColor: '#fcd34d'
  }];
  useEffect(() => {
    if (currentBlockPage > totalBlockPages) {
      setCurrentBlockPage(1);
    }
  }, [currentBlockPage, totalBlockPages]);
  useEffect(() => {
    if (currentDPPage > totalDPPages) {
      setCurrentDPPage(1);
    }
  }, [currentDPPage, totalDPPages]);
  const formatRate = value => {
    const numericValue = Number(value || 0);
    return `${Number.isFinite(numericValue) ? Math.round(numericValue) : 0}%`;
  };
  const buildDPReportCsv = () => {
    const summaryRows = [['Metric', 'Value'], ['Total Referrals', deliverySummary?.total_referrals || deliverySummary?.referrals || 0], ['Accepted Referrals', deliverySummary?.accepted_referrals || deliverySummary?.accepted || 0], ['Re-Referred', deliverySummary?.re_referred || deliverySummary?.re_referred_cases || 0], ['Recorded Outcomes', deliverySummary?.outcomes_recorded || deliverySummary?.recorded_outcomes || 0], ['Adverse Outcomes', deliveryOutcomeBreakdown?.adverse_summary?.total || deliveryOutcomeBreakdown?.adverse_outcomes || 0]];
    const outcomeItems = Array.isArray(deliveryOutcomeBreakdown?.outcomes) ? deliveryOutcomeBreakdown.outcomes : Array.isArray(deliveryOutcomeBreakdown?.items) ? deliveryOutcomeBreakdown.items : [];
    const outcomeRows = [[], ['Outcome Breakdown'], ['Outcome', 'Count', 'Percentage'], ...outcomeItems.map(item => [item?.outcome || item?.name || 'Unknown', item?.count || 0, item?.percentage || 0])];
    const performanceRows = [[], ['DP-wise Overview'], ['DP Name', 'Referrals', 'Accepted', 'Outcomes', 'Rate'], ...normalizedDPPerformance.map(item => [item.name, item.referrals, item.accepted, item.outcomes, formatRate(item.rate)])];
    return [...summaryRows, ...outcomeRows, ...performanceRows].map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  };
  const handleDownloadDPReport = async () => {
    if (!normalizedDPPerformance.length && !deliverySummary && !deliveryOutcomeBreakdown) {
      Alert.alert(t('error'), 'DP report data is not available yet.');
      return;
    }
    try {
      setDownloadingDPReport(true);
      const csvContent = buildDPReportCsv();
      const fileName = `district_dp_report_${new Date().toISOString().split('T')[0]}.csv`;
      await downloadTextReport({
        content: csvContent,
        fileName,
        mimeType: 'text/csv'
      });
      Alert.alert('Success', 'DP report downloaded successfully');
    } catch (error) {
      Alert.alert(t('error'), 'Failed to download DP report.');
    } finally {
      setDownloadingDPReport(false);
    }
  };

  // Handle menu button press
  const handleMenuPress = () => {
    navigation.navigate('ProfileSettings', {
      userInfo
    });
  };

  // Handle block selection
  const handleBlockSelect = block => {
    // Navigate to BlockDetailsScreen for district users
    navigation.navigate('BlockDetailsScreen', {
      blockId: block.id,
      blockName: block.name
    });
  };
  if (loading) {
    return <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#D2691E" />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>;
  }
  return <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView style={styles.scrollViewStyle} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={[styles.header, {
          paddingHorizontal: horizontalPadding
        }]}>
            <View style={[styles.headerContent, {
            maxWidth: contentMaxWidth
          }]}>
              <View style={styles.headerTop}>
                {/* Left Side - Logo + User Info */}
                <View style={styles.headerInfo}>
                  <View style={styles.titleRow}>
                    <View style={styles.logoContainerLeft}>
                      <Image source={require('../../../assets/image/image2.png')} style={styles.logoLeft} resizeMode="contain" />
                    </View>
                    <Text style={styles.headerTitle}>{t('districtDashboard')}</Text>
                  </View>
                  <Text style={styles.headerSubtitle}>
                    {userInfo?.full_name || t('loading')} • {t('districtHealthOfficer')}
                  </Text>
                  <View style={styles.networkStatus}>
                    <View style={[styles.statusDot, {
                    backgroundColor: isOnline ? '#22c55e' : '#ef4444'
                  }]} />
                    <Text style={styles.statusText}>{isOnline ? t('online') : t('offline')}</Text>
                  </View>
                  <Text style={styles.headerLocation}>{userInfo?.username || ''}</Text>
                </View>
                
                {/* Right Side - Bell + Menu */}
                <View style={styles.headerRightContainer}>
                  <TouchableOpacity style={styles.notificationButton} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.7}>
                    <Bell size={20} color="white" />
                    {unreadCount > 0 && <View style={styles.badge}>
                        <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                      </View>}
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.menuButton} onPress={handleMenuPress} activeOpacity={0.7}>
                    <Menu size={24} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {/* Main Content */}
          <View style={[styles.mainContent, {
          paddingHorizontal: horizontalPadding
        }]}>
            <View style={[styles.contentContainer, {
            maxWidth: contentMaxWidth
          }]}>
              {/* KPI Grid */}
              <View style={styles.kpiGrid}>
                {kpis.map(kpi => <View key={kpi.id} style={[styles.kpiCard, {
                width: '48%',
                backgroundColor: kpi.bgColor,
                borderColor: kpi.borderColor
              }]}>
                    <Text style={[styles.kpiValue, {
                  color: kpi.textColor
                }]}>
                      {kpi.value}
                    </Text>
                    <Text style={[styles.kpiTitle, {
                  color: kpi.textColor
                }]}>
                      {kpi.title}
                    </Text>
                    <Text style={[styles.kpiSubtitle, {
                  color: kpi.subTextColor
                }]}>
                      {kpi.subtitle}
                    </Text>
                  </View>)}
              </View>

              <Text style={styles.sectionTitle}>
                DP Summary / DP Referral KPI
              </Text>
              <View style={styles.dpKpiGrid}>
                {dpKpis.map(kpi => <View key={kpi.id} style={[styles.dpKpiCard, {
                backgroundColor: kpi.bgColor,
                borderColor: kpi.borderColor
              }]}>
                    <Text style={[styles.dpKpiValue, {
                  color: kpi.textColor
                }]}>{kpi.value}</Text>
                    <Text style={[styles.dpKpiLabel, {
                  color: kpi.subTextColor
                }]}>{kpi.label}</Text>
                  </View>)}
              </View>

              {/* Quick Actions */}
              <Text style={styles.sectionTitle}>
                {t('quickActions')} / ଦ୍ରୁତ କାର୍ଯ୍ୟ
              </Text>
              <View style={styles.actionsContainer}>
                {quickActions.map(action => {
                const IconComponent = action.icon;
                return <TouchableOpacity key={action.id} style={styles.actionButton} onPress={action.onPress} activeOpacity={0.7}>
                      <View style={styles.actionContent}>
                        <View style={[styles.actionIconContainer, {
                      backgroundColor: action.iconBgColor
                    }]}>
                          <IconComponent size={24} color={action.iconColor} />
                        </View>
                        <View style={styles.actionTextContainer}>
                          <Text style={styles.actionTitle}>{action.title}</Text>
                          <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
                        </View>
                        {action.count && <View style={styles.actionCount}>
                            <Text style={styles.actionCountText}>{action.count}</Text>
                          </View>}
                      </View>
                    </TouchableOpacity>;
              })}
              </View>

              {/* Block-wise Overview */}
              <Text style={styles.sectionTitle}>
                {t('blockWiseOverview')} / ବ୍ଲକ-ଆଧାରିତ ସାରାଂଶ
              </Text>
              <View style={styles.blocksContainer}>
                {loading ? <Text style={styles.loadingText}>{t('loadingBlocks')}</Text> : blockStats.length > 0 ? <>
                    <View>
                      {paginatedBlockStats.map(block => <TouchableOpacity key={block.id} style={styles.blockCard} onPress={() => handleBlockSelect(block)} activeOpacity={0.7}>
                          <View style={styles.blockHeader}>
                            <View style={styles.blockIconContainer}>
                              <MapPin size={16} color="#8B4513" />
                            </View>
                            <Text style={styles.blockName}>{block.name}</Text>
                          </View>
                          <View style={styles.blockStats}>
                            <View style={styles.statItem}>
                              <Text style={styles.statValue}>{block.total}</Text>
                              <Text style={styles.statLabel}>{t('total')}</Text>
                            </View>
                            <View style={styles.statItem}>
                              <Text style={styles.highRiskValue}>{block.highRisk}</Text>
                              <Text style={styles.highRiskLabel}>{t('highRisk')}</Text>
                            </View>
                            <View style={styles.statItem}>
                              <Text style={styles.ancRateValue}>{block.ancRate}</Text>
                              <Text style={styles.ancRateLabel}>{t('ancRate')}</Text>
                            </View>
                          </View>
                        </TouchableOpacity>)}
                    </View>

                    {totalBlockPages > 1 && <View style={styles.paginationContainer}>
                        <TouchableOpacity style={[styles.paginationButton, currentBlockPage === 1 && styles.paginationButtonDisabled]} onPress={() => setCurrentBlockPage(prev => Math.max(1, prev - 1))} disabled={currentBlockPage === 1}>
                          <Text style={styles.paginationButtonText}>Prev</Text>
                        </TouchableOpacity>

                        <View style={styles.paginationInfo}>
                          <Text style={styles.paginationText}>
                            Page {currentBlockPage} of {totalBlockPages}
                          </Text>
                          <Text style={styles.paginationSubtext}>
                            {blockStats.length} total blocks
                          </Text>
                        </View>

                        <TouchableOpacity style={[styles.paginationButton, currentBlockPage === totalBlockPages && styles.paginationButtonDisabled]} onPress={() => setCurrentBlockPage(prev => Math.min(totalBlockPages, prev + 1))} disabled={currentBlockPage === totalBlockPages}>
                          <Text style={styles.paginationButtonText}>Next</Text>
                        </TouchableOpacity>
                      </View>}
                  </> : <Text style={styles.noDataText}>{t('noBlocksFound')}</Text>}
              </View>

              <Text style={styles.sectionTitle}>
                DP-wise Overview / DP Referral Summary
              </Text>
              <View style={styles.dpContainer}>
                <TouchableOpacity style={[styles.dpDownloadButton, downloadingDPReport && styles.dpDownloadButtonDisabled]} onPress={handleDownloadDPReport} activeOpacity={0.7} disabled={downloadingDPReport}>
                  <Download size={16} color="white" style={styles.dpDownloadIcon} />
                  <Text style={styles.dpDownloadText}>
                    {downloadingDPReport ? t('preparingDPReport') : t('downloadDPReport')}
                  </Text>
                </TouchableOpacity>

                {normalizedDPPerformance.length > 0 ? <>
                    <View>
                      {paginatedDPPerformance.map(dp => <View key={dp.id} style={styles.blockCard}>
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
                              <Text style={styles.ancRateValue}>{formatRate(dp.rate)}</Text>
                              <Text style={styles.ancRateLabel}>{t('acceptedRate')}</Text>
                            </View>
                            <View style={styles.statItem}>
                              <Text style={styles.ancRateValue}>{formatRate(dp.reReferralRate)}</Text>
                              <Text style={styles.ancRateLabel}>{t('reReferralRate')}</Text>
                            </View>
                          </View>
                        </View>)}
                    </View>

                    {totalDPPages > 1 && <View style={styles.paginationContainer}>
                        <TouchableOpacity style={[styles.paginationButton, currentDPPage === 1 && styles.paginationButtonDisabled]} onPress={() => setCurrentDPPage(prev => Math.max(1, prev - 1))} disabled={currentDPPage === 1}>
                          <Text style={styles.paginationButtonText}>Prev</Text>
                        </TouchableOpacity>

                        <View style={styles.paginationInfo}>
                          <Text style={styles.paginationText}>
                            Page {currentDPPage} of {totalDPPages}
                          </Text>
                          <Text style={styles.paginationSubtext}>
                            {normalizedDPPerformance.length} total DPs
                          </Text>
                        </View>

                        <TouchableOpacity style={[styles.paginationButton, currentDPPage === totalDPPages && styles.paginationButtonDisabled]} onPress={() => setCurrentDPPage(prev => Math.min(totalDPPages, prev + 1))} disabled={currentDPPage === totalDPPages}>
                          <Text style={styles.paginationButtonText}>Next</Text>
                        </TouchableOpacity>
                      </View>}
                  </> : <Text style={styles.noDataText}>No DP referral performance data found</Text>}
              </View>

              {/* Real-time Monitoring Banner */}
              <LinearGradient colors={['#a9bfd6', '#fff4e6']} start={{
              x: 0,
              y: 0
            }} end={{
              x: 1,
              y: 1
            }} style={styles.infoBanner}>
                <Text style={styles.infoText}>
                  <Text style={styles.infoBold}>{t('realTimeMonitoring')}</Text> {t('dataUpdatedHourly')}
                </Text>
              </LinearGradient>
            </View>
          </View>

          <Footer />
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>;
};
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f9fafb'
  },
  scrollViewStyle: {
    flex: 1
  },
  header: {
    backgroundColor: '#D2691E',
    paddingHorizontal: 24,
    paddingVertical: 16
  },
  headerContent: {
    alignSelf: 'center',
    width: '100%'
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 1
  },
  headerInfo: {
    flex: 1
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4
  },
  logoContainerLeft: {
    width: 32,
    height: 32,
    backgroundColor: 'white',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
    overflow: 'hidden'
  },
  logoLeft: {
    width: 45,
    height: 45,
    borderRadius: 13
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4
  },
  headerSubtitle: {
    color: '#e9d5ff',
    fontSize: 11,
    opacity: 0.95,
    flexShrink: 1
  },
  headerLocation: {
    color: '#e9d5ff',
    fontSize: 14
  },
  networkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500'
  },
  headerRightContainer: {
    alignItems: 'center',
    marginLeft: 12
  },
  menuButton: {
    width: 44,
    height: 44,
    backgroundColor: '#6d28d9',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)'
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
    marginBottom: 8
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
    paddingHorizontal: 4
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold'
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 24
  },
  contentContainer: {
    alignSelf: 'center',
    width: '100%'
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24
  },
  kpiCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
    alignItems: 'center'
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 3,
    lineHeight: 20,
    textAlign: 'center'
  },
  kpiTitle: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
    textAlign: 'center',
    numberOfLines: 2
  },
  kpiSubtitle: {
    fontSize: 12,
    textAlign: 'center'
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 24
  },
  actionButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  actionTextContainer: {
    flex: 1
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#6b7280'
  },
  actionCount: {
    width: 32,
    height: 32,
    backgroundColor: '#dc2626',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12
  },
  actionCountText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700'
  },
  blocksContainer: {
    gap: 12,
    marginBottom: 24
  },
  blockCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  blockIconContainer: {
    width: 32,
    height: 32,
    backgroundColor: '#0b1c8c1a',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  blockName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3748'
  },
  blockStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    gap: 8
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
    borderColor: '#e2e8f0'
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 1
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#718096'
  },
  highRiskValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 1
  },
  highRiskLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#dc2626'
  },
  ancRateValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#276749',
    marginBottom: 1
  },
  ancRateLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#276749'
  },
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  paginationButton: {
    minWidth: 72,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center'
  },
  paginationButtonDisabled: {
    backgroundColor: '#f3f4f6',
    opacity: 0.6
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151'
  },
  paginationInfo: {
    flex: 1,
    alignItems: 'center'
  },
  paginationText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827'
  },
  paginationSubtext: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2
  },
  dpContainer: {
    gap: 12,
    marginBottom: 24
  },
  dpKpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  dpKpiCard: {
    width: '48%',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 10
  },
  dpKpiValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4
  },
  dpKpiLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center'
  },
  dpDownloadButton: {
    backgroundColor: '#8B4513',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  dpDownloadButtonDisabled: {
    opacity: 0.7
  },
  dpDownloadIcon: {
    marginRight: 8
  },
  dpDownloadText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700'
  },
  dpCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12
  },
  dpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  dpName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginRight: 12
  },
  dpRate: {
    fontSize: 14,
    fontWeight: '700',
    color: '#166534'
  },
  dpStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8
  },
  dpStatItem: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center'
  },
  dpStatValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2
  },
  dpStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280'
  },
  infoBanner: {
    borderLeftWidth: 4,
    borderLeftColor: '#0B1C8C',
    borderRadius: 8,
    padding: 14,
    marginTop: 8,
    marginBottom: 10
  },
  infoText: {
    fontSize: 12,
    color: '#0B1C8C',
    textAlign: 'center'
  },
  infoBold: {
    fontWeight: '600'
  },
  loadingText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 16,
    padding: 20
  },
  noDataText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 16,
    padding: 20
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  }
});
export default DistrictDashboard;
