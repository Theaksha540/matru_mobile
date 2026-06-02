import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, useWindowDimensions, Alert, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, ClipboardList, FileText, Menu, TriangleAlert, UserCheck, RotateCw, CheckCircle, UserPlus, HeartPulse } from 'lucide-react-native';
import { secureStorage } from '../../utils/secureStorage';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useTranslation } from 'react-i18next';
import { adminAPI, dashboardAPI, deliveryReferralAPI } from '../../services/api';
import { syncService } from '../../utils/syncService';
import { useNotifications } from '../../contexts/NotificationContext';
import Footer from '../../components/Footer';
import '../../i18n';
import { useFocusEffect } from '@react-navigation/native';
const DPDashboard = ({
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
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deliveryReferrals, setDeliveryReferrals] = useState([]);
  const [referralStats, setReferralStats] = useState({
    total: 0,
    pending: 0,
    accepted: 0,
    reReferred: 0,
    completed: 0
  });
  const [refreshing, setRefreshing] = useState(false);
  const [offlineReferralActionCount, setOfflineReferralActionCount] = useState(0);
  useEffect(() => {
    loadData();

    // Set up auto-refresh every 5 minutes for real-time updates
    const refreshInterval = setInterval(() => {
      if (isOnline) {
        loadData();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(refreshInterval);
  }, [isOnline]);
  useFocusEffect(React.useCallback(() => {
    loadData();
  }, [isOnline]));
  const loadData = async () => {
    try {
      const user = await secureStorage.getItem('user_info');
      if (!user) return;
      setUserInfo(user);
      if (isOnline) {
        try {
          // Load real-time referral data using the delivery referrals API
          await loadReferralData();

          // Load general dashboard stats if available
          try {
            const overviewData = await dashboardAPI.getDistrictOverview();
            setStats(overviewData?.overall_stats || null);
            await syncService.setCachedResource('dp_overview', overviewData);
          } catch (overviewError) {}
        } catch (apiError) {
          await loadCachedData();
        }
      } else {
        await loadCachedData();
      }
      const offlineReferralActions = await syncService.getOfflineReferralActions();
      setOfflineReferralActionCount(Array.isArray(offlineReferralActions) ? offlineReferralActions.length : 0);
    } catch (error) {
      await loadCachedData();
      setOfflineReferralActionCount(0);
    } finally {
      setLoading(false);
    }
  };
  const loadReferralData = async () => {
    try {
      // Load counts for each status using the same approach as DeliveryReferralsScreen
      const [allData, pendingData, acceptedData, reReferredData, completedData, recentReferrals] = await Promise.all([deliveryReferralAPI.getAll(), deliveryReferralAPI.getAll({
        status: 'pending'
      }), deliveryReferralAPI.getAll({
        status: 'accepted'
      }), deliveryReferralAPI.getAll({
        status: 're_referred'
      }), deliveryReferralAPI.getAll({
        status: 'completed'
      }), deliveryReferralAPI.getAll()]);
      const calculatedStats = {
        total: Array.isArray(allData) ? allData.length : 0,
        pending: Array.isArray(pendingData) ? pendingData.length : 0,
        accepted: Array.isArray(acceptedData) ? acceptedData.length : 0,
        reReferred: Array.isArray(reReferredData) ? reReferredData.length : 0,
        completed: Array.isArray(completedData) ? completedData.length : 0
      };
      const recentReferralsList = Array.isArray(recentReferrals) ? recentReferrals : [];
      setReferralStats(calculatedStats);
      setDeliveryReferrals(recentReferralsList);
      await Promise.all([syncService.setCachedResource('dp_referral_stats', calculatedStats), syncService.setCachedResource('dp_referrals', recentReferralsList)]);
    } catch (error) {
      throw error;
    }
  };
  const loadCachedData = async () => {
    try {
      const [cachedOverview, cachedReferrals, cachedReferralStats] = await Promise.all([syncService.getCachedResource('dp_overview'), syncService.getCachedResource('dp_referrals'), syncService.getCachedResource('dp_referral_stats')]);
      if (cachedOverview) {
        setStats(cachedOverview?.overall_stats || null);
      }
      if (cachedReferrals) {
        setDeliveryReferrals(cachedReferrals);
      }
      if (cachedReferralStats) {
        setReferralStats(cachedReferralStats);
      }
    } catch (error) {}
  };
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };
  const getReferredToDPName = referral => {
    const chain = Array.isArray(referral?.referral_chain) ? referral.referral_chain : [];
    const latestStep = chain[chain.length - 1];
    return latestStep?.dp_name || referral?.dp_name || 'N/A';
  };
  const kpis = [{
    id: 1,
    value: String(referralStats.total || 0),
    title: t('totalReferrals') || 'Total Referrals',
    subtitle: 'ମୋଟ ରେଫରାଲ',
    color: '#111827',
    bgColor: '#ffffff',
    borderColor: '#e5e7eb'
  }, {
    id: 2,
    value: String(referralStats.pending || 0),
    title: t('pendingReferrals') || 'Pending Referrals',
    subtitle: 'ବାକି ରେଫରାଲ',
    color: '#d97706',
    bgColor: '#fef3c7',
    borderColor: '#fde68a'
  }, {
    id: 3,
    value: String(referralStats.accepted || 0),
    title: t('acceptedReferrals') || 'Accepted',
    subtitle: 'ଗ୍ରହୀତ',
    color: '#059669',
    bgColor: '#d1fae5',
    borderColor: '#a7f3d0'
  }, {
    id: 4,
    value: String(referralStats.reReferred || 0),
    title: t('reReferredCases') || 'Re-referred',
    subtitle: 'ପୁନଃ ରେଫର',
    color: '#dc2626',
    bgColor: '#fee2e2',
    borderColor: '#fecaca'
  }];
  const quickActions = [{
    id: 0,
    title: t('createDeliveryReferral') ||'Create Delivery Referral',
    subtitle: t('searchandrefer') ||'Search and refer pregnant women for delivery',
    icon: UserPlus,
    onPress: () => {
      navigation.navigate('PatientList', {
        action: 'createReferral'
      });
    },
    isPrimary: true
  }, {
    id: 1,
    title: t('pendingReferrals') || 'Pending Referrals',
    subtitle: t('reviewAndAccept') || 'Review and accept delivery referrals',
    icon: UserCheck,
    count: String(referralStats.pending || 0),
    onPress: () => navigation.navigate('PendingReferrals')
  }, {
    id: 2,
    title: t('reReferredCases') || 'Re-referred Cases',
    subtitle: t('handleReReferred') || 'Handle re-referred delivery cases',
    icon: RotateCw,
    count: String(referralStats.reReferred || 0),
    onPress: () => navigation.navigate('ReReferredCases')
  }, {
    id: 3,
    title: t('deliveryReferrals') || 'All Referrals',
    subtitle: t('viewCompleteHistory') || 'View complete referral history',
    icon: ClipboardList,
    onPress: () => navigation.navigate('DeliveryReferrals')
  }, {
    id: 4,
    title: t('createEcgReport'),
    subtitle: t('openEcgReportWorkflow'),
    icon: HeartPulse,
    onPress: () => navigation.navigate('CreateECGReport')
  }, {
    id: 5,
    title: t('ecgReports'),
    subtitle: t('viewCreatedEcgReports'),
    icon: FileText,
    onPress: () => navigation.navigate('ECGReportsList')
  }];
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
        <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#D2691E']} tintColor="#D2691E" />}>
          <View style={[styles.header, {
          paddingHorizontal: horizontalPadding
        }]}>
            <View style={[styles.headerContent, {
            maxWidth: contentMaxWidth
          }]}>
              <View style={styles.headerTop}>
                <View style={styles.headerInfo}>
                  <View style={styles.titleRow}>
                    <View style={styles.logoContainerLeft}>
                      <Image source={require('../../../assets/image/image2.png')} style={styles.logoLeft} resizeMode="contain" />
                    </View>
                    <Text style={styles.headerTitle}>{t('dpDashboard')}</Text>
                  </View>
                  <Text style={styles.headerSubtitle}>
                    {userInfo?.full_name || t('loading')} • {t('dpOfficer')}
                  </Text>
                  <View style={styles.networkStatus}>
                    <View style={[styles.statusDot, {
                    backgroundColor: isOnline ? '#22c55e' : '#ef4444'
                  }]} />
                    <Text style={styles.statusText}>{isOnline ? t('online') : t('offline')}</Text>
                  </View>
                  <Text style={styles.headerLocation}>
                    {userInfo?.dp_name || userInfo?.district_name || userInfo?.username || ''}
                  </Text>
                </View>

                <View style={styles.headerRightContainer}>
                  <TouchableOpacity style={styles.notificationButton} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.7}>
                    <Bell size={20} color="white" />
                    {unreadCount > 0 && <View style={styles.badge}>
                        <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                      </View>}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('ProfileSettings', {
                  userInfo
                })} activeOpacity={0.7}>
                    <Menu size={20} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.mainContent}>
            <View style={[styles.contentContainer, {
            maxWidth: contentMaxWidth
          }]}>
              <View style={styles.kpiGrid}>
                {kpis.map(kpi => <View key={kpi.id} style={[styles.kpiCard, {
                width: isTablet ? '23%' : '48%',
                backgroundColor: kpi.bgColor,
                borderColor: kpi.borderColor
              }]}>
                    <Text style={[styles.kpiValue, {
                  color: kpi.color
                }]}>{kpi.value}</Text>
                    <Text style={styles.kpiTitle}>{kpi.title}</Text>
                    <Text style={styles.kpiSubtitle}>{kpi.subtitle}</Text>
                  </View>)}
              </View>

              <Text style={styles.sectionTitle}>{t('quickActions')} / ଦ୍ରୁତ କାର୍ଯ୍ୟ</Text>
              {!isOnline && <LinearGradient colors={['#e0f2fe', '#f8fafc']} start={{
              x: 0,
              y: 0
            }} end={{
              x: 1,
              y: 1
            }} style={styles.offlineInfoBanner}>
                  <Text style={styles.offlineInfoTitle}>Offline mode</Text>
                  <Text style={styles.offlineInfoText}>
                    Referral actions from this dashboard are saved locally and will update the backend when internet returns.
                  </Text>
                  {offlineReferralActionCount > 0 && <Text style={styles.offlineInfoQueued}>
                      {offlineReferralActionCount} offline referral action{offlineReferralActionCount > 1 ? 's are' : ' is'} waiting to sync.
                    </Text>}
                </LinearGradient>}
              <View style={styles.actionsContainer}>
                {quickActions.map(action => {
                const Icon = action.icon;
                return <TouchableOpacity key={action.id} style={[styles.actionButton, action.isPrimary && styles.primaryActionButton]} onPress={action.onPress}>
                      <View style={styles.actionContent}>
                        <View style={[styles.actionIconContainer, action.isPrimary && styles.primaryActionIconContainer]}>
                          <Icon size={22} color={action.isPrimary ? "#fff" : "#8B4513"} />
                        </View>
                        <View style={styles.actionTextContainer}>
                          <Text style={[styles.actionTitle, action.isPrimary && styles.primaryActionTitle]}>{action.title}</Text>
                          <Text style={[styles.actionSubtitle, action.isPrimary && styles.primaryActionSubtitle]}>{action.subtitle}</Text>
                        </View>
                        {action.count ? <View style={styles.actionCount}>
                            <Text style={styles.actionCountText}>{action.count}</Text>
                          </View> : null}
                      </View>
                    </TouchableOpacity>;
              })}
              </View>

              <Text style={styles.sectionTitle}>{t('recentReferrals') || 'Recent Referrals'}</Text>
              <View style={styles.referralsContainer}>
                {loading ? <Text style={styles.loadingText}>{t('loadingReferrals') || 'Loading referrals...'}</Text> : deliveryReferrals.length === 0 ? <Text style={styles.noDataText}>{t('noReferralsFound') || 'No referrals found'}</Text> : deliveryReferrals.slice(0, 5).map(referral => <TouchableOpacity key={referral.id} style={styles.referralCard} onPress={() => navigation.navigate('ReferralDetail', {
                referralId: referral.id
              })}>
                      <View style={styles.referralHeader}>
                        <View style={styles.referralInfo}>
                          <Text style={styles.referralPatientName}>{referral.pregnant_woman_name}</Text>
                          <Text style={styles.referralMobile}>{referral.mobile_number}</Text>
                        </View>
                        <View style={[styles.statusBadge, {
                    backgroundColor: referral.status === 'pending' ? '#fef3c7' : referral.status === 'accepted' ? '#d1fae5' : referral.status === 're_referred' ? '#fee2e2' : referral.status === 'completed' ? '#dbeafe' : '#f3f4f6'
                  }]}>
                          <Text style={[styles.statusText, {
                      color: referral.status === 'pending' ? '#d97706' : referral.status === 'accepted' ? '#059669' : referral.status === 're_referred' ? '#dc2626' : referral.status === 'completed' ? '#2563eb' : '#6b7280'
                    }]}>
                            {referral.status.replace('_', ' ').toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.referralDetails}>
                        <Text style={styles.referralDP}>Referred to: {getReferredToDPName(referral)}</Text>
                        <Text style={styles.referralDate}>
                          {new Date(referral.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                      {referral.referral_chain_summary && <Text style={styles.referralNotes} numberOfLines={1}>
                          Chain: {referral.referral_chain_summary}
                        </Text>}
                      {referral.observation_notes && <Text style={styles.referralNotes} numberOfLines={2}>
                          {referral.observation_notes}
                        </Text>}
                    </TouchableOpacity>)}
                {deliveryReferrals.length > 5 && <TouchableOpacity style={styles.viewAllButton} onPress={() => navigation.navigate('DeliveryReferrals')}>
                    <Text style={styles.viewAllText}>{t('viewAllReferrals') || 'View All Referrals'}</Text>
                  </TouchableOpacity>}
              </View>

              {/* Real-time Monitoring Banner */}
              <LinearGradient colors={['#fad5a5', '#fff4e6']} start={{
              x: 0,
              y: 0
            }} end={{
              x: 1,
              y: 1
            }} style={styles.infoBanner}>
                <Text style={styles.infoText}>
                  <Text style={styles.infoBold}>Real-time Delivery Monitoring:</Text> Referral data updated every hour from all DPs and healthcare centers.
                </Text>
              </LinearGradient>

              <Footer />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>;
};
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  header: {
    backgroundColor: '#D2691E',
    paddingHorizontal: 16,
    paddingVertical: 16
  },
  headerContent: {
    width: '100%',
    alignSelf: 'center'
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  headerInfo: {
    flex: 1,
    paddingRight: 12
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
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
    fontSize: 22,
    fontWeight: '700'
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    marginBottom: 4
  },
  networkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
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
  headerLocation: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13
  },
  headerRightContainer: {
    alignItems: 'center',
    marginLeft: 12
  },
  notificationButton: {
    width: 44,
    height: 44,
    backgroundColor: '#6d28d9',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 8
  },
  menuButton: {
    width: 44,
    height: 44,
    backgroundColor: '#6d28d9',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
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
    paddingHorizontal: 16,
    paddingVertical: 20
  },
  contentContainer: {
    width: '100%',
    alignSelf: 'center'
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24
  },
  kpiCard: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderWidth: 1,
    marginBottom: 12,
    alignItems: 'center'
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4
  },
  kpiTitle: {
    fontSize: 13,
    color: '#374151',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 2
  },
  kpiSubtitle: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center'
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 24
  },
  actionButton: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#8b45131a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14
  },
  actionTextContainer: {
    flex: 1
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2
  },
  actionSubtitle: {
    fontSize: 13,
    color: '#6b7280'
  },
  actionCount: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8
  },
  actionCountText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700'
  },
  loadingText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 15,
    paddingVertical: 18
  },
  noDataText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 15,
    paddingVertical: 18
  },
  offlineInfoBanner: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bae6fd'
  },
  offlineInfoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4
  },
  offlineInfoText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18
  },
  offlineInfoQueued: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#0369a1'
  },
  referralsContainer: {
    gap: 12,
    marginBottom: 24
  },
  referralCard: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 16
  },
  referralHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  referralInfo: {
    flex: 1
  },
  referralPatientName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2
  },
  referralMobile: {
    fontSize: 14,
    color: '#6b7280'
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  referralDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  referralDP: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600'
  },
  referralDate: {
    fontSize: 12,
    color: '#6b7280'
  },
  referralNotes: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 4
  },
  viewAllButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151'
  },
  infoBanner: {
    borderLeftWidth: 4,
    borderLeftColor: '#8B4513',
    borderRadius: 8,
    padding: 14,
    marginTop: 8,
    marginBottom: 10
  },
  infoText: {
    fontSize: 12,
    color: '#8B4513',
    textAlign: 'center'
  },
  infoBold: {
    fontWeight: '600'
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'white',
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  statusIndicatorText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    marginLeft: 6
  },
  primaryActionButton: {
    backgroundColor: '#D2691E',
    borderColor: '#D2691E'
  },
  primaryActionIconContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)'
  },
  primaryActionTitle: {
    color: 'white'
  },
  primaryActionSubtitle: {
    color: 'rgba(255,255,255,0.9)'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  }
});
export default DPDashboard;
