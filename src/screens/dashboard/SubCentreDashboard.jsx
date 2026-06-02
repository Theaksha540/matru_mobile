import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, useWindowDimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Menu, UserPlus, TriangleAlert, ClipboardList, Bell, Calendar, CheckCircle, Ambulance } from 'lucide-react-native';
import { secureStorage } from '../../utils/secureStorage';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { dashboardAPI, pregnantWomenAPI } from '../../services/api';
import { useTranslation } from 'react-i18next';
import '../../i18n';
import Footer from '../../components/Footer';
import { useNotifications } from '../../contexts/NotificationContext';
import { useFocusEffect } from '@react-navigation/native';
const SubCentreDashboard = ({
  navigation
}) => {
  const {
    t,
    i18n
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
  const [totalRegisteredCount, setTotalRegisteredCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [highRiskCount, setHighRiskCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [, forceUpdate] = useState({});
  useEffect(() => {
    const onLanguageChange = () => {
      forceUpdate({});
    };
    i18n.on('languageChanged', onLanguageChange);
    return () => {
      i18n.off('languageChanged', onLanguageChange);
    };
  }, [i18n]);
  useFocusEffect(React.useCallback(() => {
    loadData();
  }, [isOnline]));
  const normalizeList = data => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  };
  const matchesApprovalScope = (item, blockId) => {
    if (!blockId) return true;
    if (item?.block_id === null || item?.block_id === undefined) return false;
    return String(item.block_id) === String(blockId);
  };
  const loadData = async () => {
    try {
      const userData = await secureStorage.getItem('user_info');
      if (userData) {
        const user = userData;
        setUserInfo(user);
        if (isOnline) {
          const highRiskPromise = pregnantWomenAPI.getAll({
            is_high_risk: true
          });
          const totalRegisteredPromise = user.sub_centre_id ? pregnantWomenAPI.getAll({
            sub_centre_id: user.sub_centre_id
          }) : pregnantWomenAPI.getAll();
          const [statsData, pendingData, highRiskData, totalRegisteredData] = await Promise.all([dashboardAPI.getStats(), pregnantWomenAPI.getPendingApproval(), highRiskPromise, totalRegisteredPromise]);
          const pendingList = normalizeList(pendingData);
          const filteredPending = pendingList.filter(item => matchesApprovalScope(item, user.block_id));
          const highRiskList = normalizeList(highRiskData).filter(item => matchesApprovalScope(item, user.block_id));
          const highRiskCountValue = highRiskList.length || 0;
          const totalRegisteredList = normalizeList(totalRegisteredData).filter(item => matchesApprovalScope(item, user.block_id));
          const totalRegisteredValue = totalRegisteredList.length || 0;
          setStats(statsData);
          setTotalRegisteredCount(totalRegisteredValue);
          setPendingCount(filteredPending.length || 0);
          setHighRiskCount(highRiskCountValue);
          // Cache the data (sub-centre scoped)
          await secureStorage.setItem('cached_subcentre_stats', JSON.stringify(statsData));
          await secureStorage.setItem('cached_subcentre_pending', JSON.stringify(filteredPending));
          await secureStorage.setItem('cached_subcentre_high_risk', JSON.stringify(highRiskCountValue));
          await secureStorage.setItem('cached_subcentre_total_registered', JSON.stringify(totalRegisteredValue));
        } else {
          // Load from cache when offline
          const cachedStats = await secureStorage.getItem('cached_subcentre_stats');
          const cachedPending = await secureStorage.getItem('cached_subcentre_pending');
          const cachedHighRisk = await secureStorage.getItem('cached_subcentre_high_risk');
          const cachedTotalRegistered = await secureStorage.getItem('cached_subcentre_total_registered');
          if (cachedStats) {
            setStats(cachedStats);
          }
          if (cachedTotalRegistered) {
            const cachedTotalValue = Number(cachedTotalRegistered) || 0;
            setTotalRegisteredCount(cachedTotalValue);
          }
          if (cachedPending) {
            const pendingData = cachedPending;
            const pendingList = normalizeList(pendingData);
            setPendingCount(pendingList.length || 0);
          }
          if (cachedHighRisk) {
            const cachedHighRiskValue = Number(cachedHighRisk) || 0;
            setHighRiskCount(cachedHighRiskValue);
          }
        }
      }
    } catch (error) {
      // Try loading from cache on error
      try {
        const cachedStats = await secureStorage.getItem('cached_subcentre_stats');
        const cachedPending = await secureStorage.getItem('cached_subcentre_pending');
        const cachedHighRisk = await secureStorage.getItem('cached_subcentre_high_risk');
        const cachedTotalRegistered = await secureStorage.getItem('cached_subcentre_total_registered');
        if (cachedStats) {
          setStats(cachedStats);
        }
        if (cachedTotalRegistered) {
          const cachedTotalValue = Number(cachedTotalRegistered) || 0;
          setTotalRegisteredCount(cachedTotalValue);
        }
        if (cachedPending) {
          const pendingData = cachedPending;
          const pendingList = normalizeList(pendingData);
          setPendingCount(pendingList.length || 0);
        }
        if (cachedHighRisk) {
          const cachedHighRiskValue = Number(cachedHighRisk) || 0;
          setHighRiskCount(cachedHighRiskValue);
        }
      } catch (cacheError) {}
    } finally {
      setLoading(false);
    }
  };
  const kpis = [{
    id: 1,
    value: totalRegisteredCount.toString(),
    title: t('totalRegistered'),
    subtitle: 'ମୋଟ ପଞ୍ଜୀକୃତ',
    bgColor: '#ffffff',
    borderColor: '#e5e7eb',
    textColor: '#111827'
  }, {
    id: 2,
    value: highRiskCount.toString(),
    title: t('highRisk'),
    subtitle: 'ଉଚ୍ଚ ବିପଦ',
    bgColor: '#fef2f2',
    borderColor: '#ff4d4f',
    textColor: '#991b1b'
  }, {
    id: 3,
    value: pendingCount.toString(),
    title: t('pendingApprovals'),
    subtitle: 'ବାକି ଅନୁମୋଦନ',
    bgColor: '#fff7ed',
    borderColor: '#fed7aa',
    textColor: '#ea580c'
  }];
  const quickActions = [{
    id: 1,
    title: t('registerPregnancy'),
    subtitle: 'ଗର୍ଭଧାରଣ ପଞ୍ଜୀକରଣ',
    icon: UserPlus,
    iconBgColor: 'rgba(139, 69, 19, 0.1)',
    iconColor: '#8B4513',
    onPress: () => navigation.navigate('RegisterPregnancy')
  }, {
    id: 2,
    title: t('pendingApprovals'),
    subtitle: 'ବାକି ଅନୁମୋଦନ',
    icon: CheckCircle,
    iconBgColor: '#dbeafe',
    iconColor: '#2563eb',
    count: pendingCount.toString(),
    onPress: () => navigation.navigate('PendingApproval')
  }, {
    id: 3,
    title: t('viewHighRiskCases'),
    subtitle: 'ଉଚ୍ଚ ବିପଦ ମାମଲା ଦେଖନ୍ତୁ',
    icon: TriangleAlert,
    iconBgColor: '#fef3c7',
    iconColor: '#d97706',
    count: highRiskCount.toString(),
    onPress: () => navigation.navigate('HighRiskCases')
  }, {
    id: 4,
    title: t('scheduleANCUSGAppointment'),
    subtitle: t('bookUSGAppointments'),
    icon: Calendar,
    iconBgColor: 'rgba(139, 69, 19, 0.1)',
    iconColor: '#8B4513',
    onPress: () => navigation.navigate('PatientList')
  }, {
    id: 5,
    title: t('viewUSGAppointments'),
    subtitle: t('viewScheduledUSGList'),
    icon: ClipboardList,
    iconBgColor: 'rgba(34, 197, 94, 0.1)',
    iconColor: '#22c55e',
    onPress: () => navigation.navigate('USGAppointmentsList')
  }, {
    id: 6,
    title: t('createDeliveryReferral'),
    subtitle: 'ଡେଲିଭରି ରେଫରାଲ ସୃଷ୍ଟି କରନ୍ତୁ',
    icon: Ambulance,
    iconBgColor: 'rgba(220, 38, 38, 0.1)',
    iconColor: '#dc2626',
    onPress: () => navigation.navigate('PatientList', {
      action: 'createReferral'
    })
  }, {
    id: 7,
    title: t('deliveryReferrals'),
    subtitle: 'ଡେଲିଭରି ରେଫରାଲ ଦେଖନ୍ତୁ',
    icon: Ambulance,
    iconBgColor: 'rgba(245, 158, 11, 0.1)',
    iconColor: '#f59e0b',
    onPress: () => navigation.navigate('DeliveryReferrals')
  }];

  // Handle menu button press
  const handleMenuPress = () => {
    navigation.navigate('ProfileSettings', {
      userInfo
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
                    <Text style={styles.headerTitle}>{t('subCentreDashboard')}</Text>
                  </View>
                  <Text style={styles.headerSubtitle}>
                    {userInfo?.full_name || t('loading')} • {t('subCentreOfficer')}
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
                {kpis.map(kpi => {
                if (kpi.id === 2 || kpi.id === 3) {
                  return <LinearGradient key={kpi.id} colors={kpi.id === 2 ? ['#fef2f2', '#fee2e2'] : ['#fff7ed', '#fed7aa']} start={{
                    x: 0,
                    y: 0
                  }} end={{
                    x: 1,
                    y: 1
                  }} style={[styles.kpiCard, {
                    width: '31.5%'
                  }, {
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
                      color: kpi.textColor
                    }]}>
                          {kpi.subtitle}
                        </Text>
                      </LinearGradient>;
                }
                return <View key={kpi.id} style={[styles.kpiCard, {
                  width: '31.5%'
                }, {
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
                    color: kpi.textColor
                  }]}>
                        {kpi.subtitle}
                      </Text>
                    </View>;
              })}
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

              {/* Critical Rule Banner */}
              <LinearGradient colors={['#a9bfd6', '#fff4e6']} start={{
              x: 0,
              y: 0
            }} end={{
              x: 1,
              y: 1
            }} style={styles.criticalBanner}>
                <Text style={styles.criticalText}>
                  <Text style={styles.criticalBold}>{t('criticalRule')}</Text> {t('followUpHighRisk24h')}
                </Text>
                <Text style={styles.criticalTextOdia}>
                  24 ଘଣ୍ଟା ମଧ୍ୟରେ ସମସ୍ତ ଉଚ୍ଚ ବିପଦ ମାମଲାଗୁଡିକର ଅନୁସରଣ କରନ୍ତୁ
                </Text>
              </LinearGradient>
            </View>

            <Footer />
          </View>

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
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  headerContent: {
    alignSelf: 'center',
    width: '100%'
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  headerInfo: {
    flex: 1
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2
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
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    marginBottom: 2
  },
  headerLocation: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12
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
  logo: {
    width: 32,
    height: 32
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
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  statusIndicator: {
    width: 8,
    height: 8,
    backgroundColor: '#4ade80',
    borderRadius: 4,
    marginRight: 6
  },
  statusText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  contentContainer: {
    alignSelf: 'center',
    width: '100%'
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    marginBottom: 24
  },
  kpiCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    alignItems: 'center'
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center'
  },
  kpiTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
    textAlign: 'center'
  },
  kpiSubtitle: {
    fontSize: 10,
    textAlign: 'center'
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 10
  },
  actionsContainer: {
    gap: 8,
    marginBottom: 12
  },
  actionButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  actionTextContainer: {
    flex: 1
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2
  },
  actionSubtitle: {
    fontSize: 11,
    color: '#6b7280'
  },
  actionCount: {
    minWidth: 24,
    height: 24,
    backgroundColor: '#dc2626',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    paddingHorizontal: 6
  },
  actionCountText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600'
  },
  criticalBanner: {
    borderLeftWidth: 4,
    borderLeftColor: '#0B1C8C',
    borderRadius: 8,
    padding: 10,
    paddingLeft: 14
  },
  criticalText: {
    fontSize: 12,
    color: '#0B1C8C',
    marginBottom: 4,
    lineHeight: 18
  },
  criticalBold: {
    fontWeight: '600'
  },
  criticalTextOdia: {
    fontSize: 12,
    color: '#0B1C8C',
    lineHeight: 18
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  }
});
export default SubCentreDashboard;
