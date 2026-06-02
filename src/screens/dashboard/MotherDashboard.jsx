import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, Image, useWindowDimensions } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { Menu, Heart, Bell, Calendar, FileText, MessageCircle, CircleAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { pregnantWomenAPI, usgAppointmentAPI } from '../../services/api';
import Footer from '../../components/Footer';
import { useNotifications } from '../../contexts/NotificationContext';
import { formatDateDDMMYYYY } from '../../utils/dateFormat';
import { secureStorage } from '../../utils/secureStorage';
import '../../i18n';
const MotherDashboard = ({
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
  const [motherData, setMotherData] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    loadMotherData();
  }, []);
  const loadMotherData = async () => {
    try {
      const userData = await secureStorage.getItem('user_info');
      if (userData) {
        const user = userData;

        // For mother role, get their own pregnancy data
        if (user.role === 'mother' && user.id) {
          const motherInfo = await pregnantWomenAPI.getById(user.id);
          setMotherData(motherInfo);

          // Get mother's USG appointments
          const motherAppointments = await usgAppointmentAPI.getAll();
          setAppointments(motherAppointments);
        }
      }
    } catch (error) {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  const onRefresh = () => {
    setRefreshing(true);
    loadMotherData();
  };
  const calculateWeeksPregnant = lmpDate => {
    if (!lmpDate) return 0;
    const lmp = new Date(lmpDate);
    const today = new Date();
    const diffTime = Math.abs(today - lmp);
    const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
    return diffWeeks;
  };
  const calculateDaysToDelivery = eddDate => {
    if (!eddDate) return 0;
    const edd = new Date(eddDate);
    const today = new Date();
    const diffTime = edd - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };
  const formatDate = dateString => {
    if (!dateString) return 'N/A';
    return formatDateDDMMYYYY(dateString);
  };
  const weeksPregnant = calculateWeeksPregnant(motherData?.lmp_date);
  const daysToDelivery = calculateDaysToDelivery(motherData?.edd_date);
  const completedAppointments = appointments.filter(apt => apt.status === 'completed').length;

  // Dynamic notifications based on real data
  const notifications = [...(daysToDelivery > 0 && daysToDelivery <= 30 ? [{
    id: 1,
    type: 'reminder',
    title: 'Delivery Approaching',
    subtitle: 'ପ୍ରସବ ନିକଟବର୍ତ୍ତୀ',
    message: `Your delivery is expected in ${daysToDelivery} days. Please stay prepared.`,
    messageOdia: `ଆପଣଙ୍କର ପ୍ରସବ ${daysToDelivery} ଦିନରେ ଆଶା କରାଯାଉଛି। ଦୟାକରି ପ୍ରସ୍ତୁତ ରୁହନ୍ତୁ।`,
    date: formatDateDDMMYYYY(new Date()),
    icon: Calendar,
    iconColor: '#dc2626',
    bgColor: '#fef2f2',
    borderColor: '#fecaca'
  }] : []), ...(completedAppointments > 0 ? [{
    id: 2,
    type: 'report',
    title: 'USG Reports Available',
    subtitle: 'USG ରିପୋର୍ଟ ଉପଲବ୍ଧ',
    message: `You have ${completedAppointments} completed USG report(s) available.`,
    messageOdia: `ଆପଣଙ୍କର ${completedAppointments}ଟି ସମ୍ପୂର୍ଣ୍ଣ USG ରିପୋର୍ଟ ଉପଲବ୍ଧ।`,
    date: formatDateDDMMYYYY(new Date()),
    icon: FileText,
    iconColor: '#16a34a',
    bgColor: '#dcfce7',
    borderColor: '#86efac'
  }] : []), {
    id: 3,
    type: 'tip',
    title: 'Health Tip',
    subtitle: 'ସ୍ୱାସ୍ଥ୍ୟ ଟିପ୍ସ',
    message: 'Remember to take your iron and calcium tablets daily.',
    messageOdia: 'ପ୍ରତିଦିନ ଆପଣଙ୍କର ଆଇରନ୍ ଏବଂ କ୍ୟାଲସିୟମ୍ ଟାବଲେଟ୍ ନେବାକୁ ମନେରଖନ୍ତୁ।',
    date: formatDateDDMMYYYY(new Date()),
    icon: Heart,
    iconColor: '#be185d',
    bgColor: '#fce7f3',
    borderColor: '#f9a8d4'
  }];

  // Quick access actions
  const quickActions = [{
    id: 1,
    title: 'My ANC Visits',
    subtitle: 'ମୋର ANC ଭେଟ',
    icon: Calendar,
    iconBgColor: '#dbeafe',
    iconColor: '#1d4ed8',
    onPress: () => navigation.navigate('ANCTrackingBlock')
  }, {
    id: 2,
    title: 'My USG Reports',
    subtitle: 'ମୋର USG ରିପୋର୍ଟ',
    icon: FileText,
    iconBgColor: '#dcfce7',
    iconColor: '#16a34a',
    count: completedAppointments.toString(),
    onPress: () => navigation.navigate('USGAppointmentsList')
  }, {
    id: 3,
    title: 'Health Tips',
    subtitle: 'ସ୍ୱାସ୍ଥ୍ୟ ଟିପ୍ସ',
    icon: Heart,
    iconBgColor: '#fce7f3',
    iconColor: '#be185d',
    onPress: () => {}
  }, {
    id: 4,
    title: 'Contact Health Worker',
    subtitle: 'ସ୍ୱାସ୍ଥ୍ୟ କର୍ମୀ ସହ ଯୋଗାଯୋଗ',
    icon: MessageCircle,
    iconBgColor: '#ccfbf1',
    iconColor: '#0f766e',
    onPress: () => {}
  }];

  // Handle menu button press
  const handleMenuPress = () => {
    navigation.navigate('ProfileSettings', {
      role: 'mother'
    });
  };
  return <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView style={styles.scrollViewStyle} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
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
                      <Image source={require('../../../assets/image/image.png')} style={styles.logoLeft} resizeMode="contain" />
                    </View>
                    <Text style={styles.headerTitle}>{t('welcome')}, {motherData?.full_name || t('loading')}</Text>
                  </View>
                  <Text style={styles.headerSubtitle}>ମାତୃସାଥୀ • MatruSaathi</Text>
                  <View style={styles.networkStatus}>
                    <View style={[styles.statusDot, {
                    backgroundColor: isOnline ? '#22c55e' : '#ef4444'
                  }]} />
                    <Text style={styles.statusText}>{isOnline ? t('online') : t('offline')}</Text>
                  </View>
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
              {/* Pregnancy Overview Card */}
              <View style={styles.pregnancyCard}>
                <View style={styles.pregnancyHeader}>
                  <Heart size={32} color="white" style={styles.heartIcon} />
                  <View style={styles.pregnancyTitleContainer}>
                    <Text style={styles.pregnancyTitle}>{t('yourPregnancy')}</Text>
                    <Text style={styles.pregnancySubtitle}>ଆପଣଙ୍କର ଗର୍ଭଧାରଣ</Text>
                  </View>
                </View>

                <View style={styles.pregnancyStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>{t('weeksPregnant')}</Text>
                    <Text style={styles.statValue}>{weeksPregnant} {t('weeks')}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>{t('daysToDelivery')}</Text>
                    <Text style={styles.statValue}>{daysToDelivery} {t('days')}</Text>
                  </View>
                  <View style={[styles.statItem, styles.fullWidth]}>
                    <Text style={styles.statLabel}>{t('expectedDeliveryDate')}</Text>
                    <Text style={styles.statValue}>{formatDate(motherData?.edd_date)}</Text>
                  </View>
                </View>
              </View>

              {/* Notifications Header */}
              <View style={styles.notificationsHeader}>
                <Text style={styles.sectionTitle}>{t('notifications')} / ବିଜ୍ଞପ୍ତି</Text>
                <View style={styles.notificationCount}>
                  <Bell size={20} color="#be185d" style={styles.bellIcon} />
                  <Text style={styles.countText}>{notifications.length}</Text>
                </View>
              </View>

              {/* Notifications List */}
              <View style={styles.notificationsContainer}>
                {notifications.map(notification => {
                const IconComponent = notification.icon;
                return <View key={notification.id} style={[styles.notificationCard, {
                  backgroundColor: notification.bgColor,
                  borderColor: notification.borderColor
                }]}>
                      <View style={styles.notificationContent}>
                        <IconComponent size={20} color={notification.iconColor} style={styles.notificationIcon} />
                        <View style={styles.notificationText}>
                          <Text style={styles.notificationTitle}>{notification.title}</Text>
                          <Text style={styles.notificationSubtitle}>{notification.subtitle}</Text>
                          <Text style={styles.notificationMessage}>{notification.message}</Text>
                          <Text style={styles.notificationMessageOdia}>{notification.messageOdia}</Text>
                          <Text style={styles.notificationDate}>{notification.date}</Text>
                        </View>
                      </View>
                    </View>;
              })}
              </View>

              {/* Quick Access */}
              <Text style={styles.sectionTitle}>
                {t('quickAccess')} / ଦ୍ରୁତ ପ୍ରବେଶ
              </Text>

              <View style={styles.quickActionsContainer}>
                {quickActions.map(action => {
                const IconComponent = action.icon;
                return <TouchableOpacity key={action.id} style={styles.quickActionButton} onPress={action.onPress} activeOpacity={0.7}>
                      <View style={styles.quickActionContent}>
                        <View style={[styles.quickActionIconContainer, {
                      backgroundColor: action.iconBgColor
                    }]}>
                          <IconComponent size={24} color={action.iconColor} />
                        </View>
                        <View style={styles.quickActionTextContainer}>
                          <Text style={styles.quickActionTitle}>{action.title}</Text>
                          <Text style={styles.quickActionSubtitle}>{action.subtitle}</Text>
                        </View>
                        {action.count && <View style={styles.quickActionCount}>
                            <Text style={styles.quickActionCountText}>{action.count}</Text>
                          </View>}
                      </View>
                    </TouchableOpacity>;
              })}
              </View>

              {/* WhatsApp Notification Banner */}
              <View style={styles.whatsappBanner}>
                <MessageCircle size={20} color="#16a34a" style={styles.whatsappIcon} />
                <View style={styles.whatsappContent}>
                  <Text style={styles.whatsappTitle}>
                    <Text style={styles.whatsappBold}>WhatsApp Notifications Active</Text>
                  </Text>
                  <Text style={styles.whatsappText}>
                    You will receive reminders and updates on WhatsApp at {motherData?.mobile_number || 'your registered number'}
                  </Text>
                  <Text style={styles.whatsappTextOdia}>
                    ଆପଣ {motherData?.mobile_number || 'ଆପଣଙ୍କର ପଞ୍ଜୀକୃତ ନମ୍ବର'} ରେ WhatsApp ରେ ସ୍ମାରକ ଏବଂ ଅପଡେଟ୍ ପାଇବେ
                  </Text>
                </View>
              </View>

              {/* Emergency Helpline Banner */}
              <View style={styles.emergencyBanner}>
                <CircleAlert size={20} color="#dc2626" style={styles.emergencyIcon} />
                <View style={styles.emergencyContent}>
                  <Text style={styles.emergencyTitle}>
                    <Text style={styles.emergencyBold}>Emergency Helpline</Text>
                  </Text>
                  <Text style={styles.emergencyText}>
                    For urgent medical help: 108 (Ambulance)
                  </Text>
                  <Text style={styles.emergencyTextOdia}>
                    ଜରୁରୀ ଚିକିତ୍ସା ସହାୟତା: 108 (ଆମ୍ବୁଲାନ୍ସ)
                  </Text>
                </View>
              </View>
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
    backgroundColor: '#f0f4f8'
  },
  scrollViewStyle: {
    flex: 1
  },
  header: {
    backgroundColor: '#D2691E',
    paddingHorizontal: 20,
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
    marginBottom: 12
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
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3
  },
  logoLeft: {
    width: 26,
    height: 26
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
    flexShrink: 1
  },
  headerSubtitle: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9
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
  // New styles for logo above hamburger menu
  headerRightContainer: {
    alignItems: 'center',
    marginLeft: 12
  },
  menuButton: {
    width: 44,
    height: 44,
    backgroundColor: '#8B4513',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  notificationButton: {
    width: 44,
    height: 44,
    backgroundColor: '#8B4513',
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#f0f4f8'
  },
  contentContainer: {
    alignSelf: 'center',
    width: '100%'
  },
  pregnancyCard: {
    backgroundColor: '#8B4513',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  pregnancyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20
  },
  heartIcon: {
    marginRight: 12
  },
  pregnancyTitleContainer: {
    flex: 1
  },
  pregnancyTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4
  },
  pregnancySubtitle: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9
  },
  pregnancyStats: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16
  },
  statItem: {
    flex: 1,
    minWidth: '45%'
  },
  fullWidth: {
    minWidth: '100%',
    marginTop: 8
  },
  statLabel: {
    color: 'white',
    fontSize: 12,
    marginBottom: 4,
    opacity: 0.9
  },
  statValue: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  notificationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937'
  },
  notificationCount: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  bellIcon: {
    marginRight: 4
  },
  countText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B4513'
  },
  notificationsContainer: {
    marginBottom: 20
  },
  notificationCard: {
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    marginBottom: 8
  },
  notificationContent: {
    flexDirection: 'row'
  },
  notificationIcon: {
    marginRight: 12,
    marginTop: 2
  },
  notificationText: {
    flex: 1
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4
  },
  notificationSubtitle: {
    fontSize: 12,
    color: '#374151',
    marginBottom: 8
  },
  notificationMessage: {
    fontSize: 12,
    color: '#4b5563',
    marginBottom: 4,
    lineHeight: 18
  },
  notificationMessageOdia: {
    fontSize: 12,
    color: '#4b5563',
    marginBottom: 8,
    lineHeight: 18
  },
  notificationDate: {
    fontSize: 12,
    color: '#6b7280'
  },
  quickActionsContainer: {
    marginBottom: 20
  },
  quickActionButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8
  },
  quickActionContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  quickActionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  quickActionTextContainer: {
    flex: 1
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2
  },
  quickActionSubtitle: {
    fontSize: 12,
    color: '#6b7280'
  },
  quickActionCount: {
    width: 24,
    height: 24,
    backgroundColor: '#16a34a',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12
  },
  quickActionCountText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600'
  },
  whatsappBanner: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row'
  },
  whatsappIcon: {
    marginRight: 12,
    marginTop: 2
  },
  whatsappContent: {
    flex: 1
  },
  whatsappTitle: {
    fontSize: 14,
    color: '#166534',
    marginBottom: 8
  },
  whatsappBold: {
    fontWeight: '600'
  },
  whatsappText: {
    fontSize: 14,
    color: '#166534',
    marginBottom: 4,
    lineHeight: 20
  },
  whatsappTextOdia: {
    fontSize: 14,
    color: '#166534',
    lineHeight: 20
  },
  emergencyBanner: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row'
  },
  emergencyIcon: {
    marginRight: 12,
    marginTop: 2
  },
  emergencyContent: {
    flex: 1
  },
  emergencyTitle: {
    fontSize: 14,
    color: '#991b1b',
    marginBottom: 8
  },
  emergencyBold: {
    fontWeight: '600'
  },
  emergencyText: {
    fontSize: 14,
    color: '#991b1b',
    marginBottom: 4,
    lineHeight: 20
  },
  emergencyTextOdia: {
    fontSize: 14,
    color: '#991b1b',
    lineHeight: 20
  },
  footer: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingHorizontal: 24,
    paddingVertical: 12
  },
  footerText: {
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%'
  }
});
export default MotherDashboard;
