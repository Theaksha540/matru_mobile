import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Image,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { 
  Menu,
  CheckCircle,
  Clock,
  Calendar,
  AlertTriangle,
  FileText,
  Bell,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { secureStorage } from '../../utils/secureStorage';
import { syncService } from '../../utils/syncService';
import { useTranslation } from 'react-i18next';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { usgAppointmentAPI, adminAPI } from '../../services/api';
import { useNotifications } from '../../contexts/NotificationContext';
import Footer from '../../components/Footer';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../../utils/dateFormat';
import '../../i18n';

const USGDashboard = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 380;
  const isTablet = width >= 768;
  const horizontalPadding = isSmallScreen ? 12 : isTablet ? 24 : 16;
  const contentMaxWidth = isTablet ? 860 : width;
  const bookingListMaxHeight = Math.max(280, Math.min(520, Math.round(height * 0.52)));
  const isOnline = useNetworkStatus();
  const { unreadCount } = useNotifications();
  const [userInfo, setUserInfo] = useState(null);
  const [appointments, setAppointments] = useState({ all: [], filtered: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState(new Date());
  const [rescheduleTime, setRescheduleTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  useEffect(() => {
    loadUserInfo();
    loadAppointments();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadAppointments(); // Refresh when screen comes into focus
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    const incomingSearch = String(route?.params?.bookingSearchQuery || '').trim();
    const incomingAppointmentId = Number(route?.params?.bookingAppointmentId);

    if (incomingSearch) {
      setSearchQuery(incomingSearch);
      setCurrentPage(1);
      navigation.setParams({ bookingSearchQuery: undefined, bookingAppointmentId: undefined });
      return;
    }

    if (Number.isFinite(incomingAppointmentId) && appointments.filtered.length > 0) {
      const matchedAppointment = appointments.filtered.find(
        (apt) => Number(apt?.id) === incomingAppointmentId
      );
      if (matchedAppointment) {
        const autoQuery =
          matchedAppointment?.patient?.mobile_number ||
          matchedAppointment?.patient?.full_name ||
          matchedAppointment?.patient?.address ||
          String(matchedAppointment.id);
        setSearchQuery(String(autoQuery));
        setCurrentPage(1);
      }
      navigation.setParams({ bookingSearchQuery: undefined, bookingAppointmentId: undefined });
    }
  }, [route?.params?.bookingSearchQuery, route?.params?.bookingAppointmentId, appointments.filtered, navigation]);

  const loadUserInfo = async () => {
    try {
      const userData = await secureStorage.getItem('user_info');
      if (userData) {
        const user = userData;
        setUserInfo(user);
        
        // Load USG centre name if user has usg_centre_id
        if (user.usg_centre_id) {
          try {
            const centres = await syncService.getUSGCentres(user.district_id);
            const userCentre = centres.find(c => c.id === user.usg_centre_id);
            if (userCentre) {
              setUserInfo({...user, centre_name: userCentre.name});
            }
          } catch (error) {
            console.error('Error loading USG centre name:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  };

  const loadAppointments = async () => {
    try {
      const data = await syncService.getAppointments();
      console.log('Loaded appointments:', data.length);
      console.log('Sample appointment:', data[0]);
      
      // Check for offline completed reports and update appointment status
      const offlineReports = await syncService.getOfflineData('offline_usg_reports') || [];
      const offlineCompletedIds = offlineReports
        .filter(r => r.sync_status === 'pending')
        .map(r => r.appointment_id);
      
      // Update appointment status for offline completed reports
      const updatedData = data.map(apt => {
        if (offlineCompletedIds.includes(apt.id)) {
          return { ...apt, status: 'completed' };
        }
        return apt;
      });
      
      // Store all appointments for KPI calculations
      const allAppointments = updatedData;
      
      // Filter to show scheduled, accepted, and rescheduled appointments for the list
      const filteredAppointments = updatedData.filter(apt => 
        apt.status === 'scheduled' || apt.status === 'accepted' || apt.status === 'rescheduled'
      );
      
      // Sort: Emergency first, then by latest created_at
      filteredAppointments.sort((a, b) => {
        if (a.appointment_type === 'emergency' && b.appointment_type !== 'emergency') return -1;
        if (a.appointment_type !== 'emergency' && b.appointment_type === 'emergency') return 1;
        return new Date(b.created_at) - new Date(a.created_at);
      });
      
      console.log('Filtered appointments:', filteredAppointments.length);
      
      // Fetch patient data for each appointment
      const appointmentsWithPatients = await Promise.all(
        filteredAppointments.map(async (apt) => {
          console.log('Appointment', apt.id, 'reschedule_count:', apt.reschedule_count);
          if (apt.pregnant_woman_id) {
            try {
              const patient = await syncService.getPatientById(apt.pregnant_woman_id);
              return { ...apt, patient };
            } catch (error) {
              console.error(`Error loading patient ${apt.pregnant_woman_id}:`, error);
              return apt;
            }
          }
          return apt;
        })
      );
      
      setAppointments({ all: allAppointments, filtered: appointmentsWithPatients });
    } catch (error) {
      console.error('Error loading appointments:', error);
      setAppointments({ all: [], filtered: [] });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAppointments();
  };

  const handleAccept = async (appointmentId) => {
    if (!isOnline) {
      Alert.alert('Offline Mode', 'Cannot accept appointments while offline. Please connect to the internet.');
      return;
    }
    
    try {
      await usgAppointmentAPI.accept(appointmentId);
      Alert.alert('Success', 'Appointment accepted successfully!');
      loadAppointments(); // This will update the KPI
    } catch (error) {
      const errorMsg =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.message ||
        'Failed to accept appointment';
      Alert.alert('Error', errorMsg);
    }
  };

  const handleReschedule = (appointmentId) => {
    const selectedAppointmentData = appointments.filtered.find((apt) => apt.id === appointmentId);
    const scheduledDate = selectedAppointmentData?.scheduled_date
      ? new Date(selectedAppointmentData.scheduled_date)
      : null;

    setSelectedAppointment(appointmentId);
    if (scheduledDate && !Number.isNaN(scheduledDate.getTime())) {
      setRescheduleDate(scheduledDate);
      setRescheduleTime(scheduledDate);
    } else {
      setRescheduleDate(new Date());
      setRescheduleTime(new Date());
    }
    setShowRescheduleModal(true);
  };

  const isSameCalendarDay = (firstDate, secondDate) => {
    return (
      firstDate.getFullYear() === secondDate.getFullYear() &&
      firstDate.getMonth() === secondDate.getMonth() &&
      firstDate.getDate() === secondDate.getDate()
    );
  };

  const buildRescheduleDateTime = (date, time) => {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      time.getHours(),
      time.getMinutes(),
      0,
      0
    );
  };

  const submitReschedule = async () => {
    if (!rescheduleReason) {
      Alert.alert('Error', 'Please enter reason for reschedule');
      return;
    }
    
    if (!isOnline) {
      Alert.alert('Offline Mode', 'Cannot reschedule appointments while offline. Please connect to the internet.');
      return;
    }

    const selectedDateTime = buildRescheduleDateTime(rescheduleDate, rescheduleTime);
    if (selectedDateTime <= new Date()) {
      Alert.alert(t('error'), t('appointmentDateTimeMustBeFuture'));
      return;
    }

    const selectedAppointmentData = appointments.filtered.find((apt) => apt.id === selectedAppointment);
    const originalScheduledDate = selectedAppointmentData?.scheduled_date
      ? new Date(selectedAppointmentData.scheduled_date)
      : null;

    if (originalScheduledDate && !Number.isNaN(originalScheduledDate.getTime())) {
      const maxAllowedRescheduleDate = new Date(originalScheduledDate);
      maxAllowedRescheduleDate.setDate(maxAllowedRescheduleDate.getDate() + 7);

      if (selectedDateTime > maxAllowedRescheduleDate) {
        Alert.alert(
          'Error',
          `Reschedule date must be within 7 days of the current scheduled date (${formatDateDDMMYYYY(originalScheduledDate)}).`
        );
        return;
      }
    }
    
    try {
      const year = rescheduleDate.getFullYear();
      const month = String(rescheduleDate.getMonth() + 1).padStart(2, '0');
      const day = String(rescheduleDate.getDate()).padStart(2, '0');
      const hours = String(rescheduleTime.getHours()).padStart(2, '0');
      const minutes = String(rescheduleTime.getMinutes()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}T${hours}:${minutes}:00`;
      console.log('Rescheduling appointment:', selectedAppointment, 'to', formattedDate, 'reason:', rescheduleReason);
      const result = await usgAppointmentAPI.reschedule(selectedAppointment, formattedDate, rescheduleReason);
      console.log('Reschedule result:', result);
      Alert.alert('Success', 'Appointment rescheduled successfully!');
      setShowRescheduleModal(false);
      setRescheduleDate(new Date());
      setRescheduleTime(new Date());
      setRescheduleReason('');
      // Force refresh from API
      setRefreshing(true);
      await syncService.syncAppointments();
      loadAppointments();
    } catch (error) {
      console.error('Reschedule error:', error);
      console.error('Error response:', error.response?.data);
      const errorMsg = error.response?.data?.detail || 'Failed to reschedule appointment';
      Alert.alert('Error', errorMsg);
    }
  };

  const getPriorityInfo = (patient, appointment) => {
    if (appointment?.appointment_type === 'emergency') {
      return { label: 'Emergency', color: '#ef4444' };
    }
    if (patient?.is_high_risk) {
      return { label: 'High Risk', color: '#f59e0b' };
    }
    return { label: 'Normal', color: '#22c55e' };
  };

  const getTrimester = (eddDate) => {
    if (!eddDate) return 'N/A';
    const edd = new Date(eddDate);
    const today = new Date();
    const weeksPregnant = Math.floor((280 - (edd - today) / (1000 * 60 * 60 * 24 * 7)));
    if (weeksPregnant <= 13) return '1st Trimester';
    if (weeksPregnant <= 26) return '2nd Trimester';
    return '3rd Trimester';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return formatDateTimeDDMMYYYY(dateString);
  };

  const getRequestedByDisplayName = (appointment) => {
    const candidates = [
      appointment?.requested_by_name,
      appointment?.requested_by_user_name,
      appointment?.requested_by_full_name,
      appointment?.created_by_name,
      appointment?.scheduled_by_name,
      appointment?.sub_centre_user_name,
      appointment?.anm_name,
      appointment?.requested_by,
    ];

    for (const value of candidates) {
      const normalized = String(value || '').trim();
      if (normalized && normalized.toLowerCase() !== 'null' && normalized.toLowerCase() !== 'undefined') {
        return normalized;
      }
    }

    return 'ANM';
  };

  const today = new Date().toDateString();
  const completedToday = appointments.all.filter(apt => 
    apt.status === 'completed' && 
    apt.completed_date && 
    new Date(apt.completed_date).toDateString() === today
  ).length;
  
  const pendingRequests = appointments.filtered.length;
  const filteredBookingRequests = appointments.filtered.filter(apt => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      apt.patient?.full_name?.toLowerCase().includes(query) ||
      apt.patient?.mobile_number?.includes(query) ||
      apt.patient?.address?.toLowerCase().includes(query)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filteredBookingRequests.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedBookingRequests = filteredBookingRequests.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const isAppointmentOverdue = (appointment) => {
    const scheduledDate = new Date(appointment?.scheduled_date);
    if (Number.isNaN(scheduledDate.getTime())) return false;
    const now = new Date();
    const daysDiff = Math.ceil((now - scheduledDate) / (1000 * 60 * 60 * 24));
    return daysDiff > 7 && appointment?.status !== 'completed';
  };
  
  const overdueAppointments = appointments.filtered.filter(apt => {
    return isAppointmentOverdue(apt);
  }).length;

  if (loading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8B4513" />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
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
                  <Text style={styles.headerTitle}>{t('usgDashboard')}</Text>
                </View>
                <Text style={styles.headerSubtitle}>
                  {userInfo?.full_name || t('loading')} • {t('usgOperator')}
                </Text>
                <View style={styles.networkStatus}>
                  <View style={[styles.statusDot, { backgroundColor: isOnline ? '#22c55e' : '#ef4444' }]} />
                  <Text style={styles.statusText}>{isOnline ? t('online') : t('offline')}</Text>
                </View>
                <Text style={styles.headerLocation}>{userInfo?.centre_name || `USG Centre ${userInfo?.usg_centre_id || ''}` || userInfo?.username || ''}</Text>
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
                    <View style={styles.notificationBadge}>
                      <Text style={styles.notificationBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.menuButton}
                  onPress={() => navigation.navigate('ProfileSettings', { role: 'usg' })}
                  activeOpacity={0.7}
                >
                  <Menu size={24} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <ScrollView 
          style={[styles.scrollViewStyle, { paddingHorizontal: horizontalPadding }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statCardGreen}>
              <Text style={styles.statNumberGreen}>{completedToday}</Text>
              <Text style={styles.statLabelGreen}>Completed Today</Text>
              <Text style={styles.statOdiaGreen}>ଆଜି ସମାପ୍ତ</Text>
            </View>
            <LinearGradient
              colors={['#fff7ed', '#fed6aa']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.statCard}
            >
              <Text style={styles.statNumberOrange}>{pendingRequests}</Text>
              <Text style={styles.statLabelOrange}>Pending Requests</Text>
              <Text style={styles.statOdiaOrange}>ବାକି ଅନୁରୋଧ</Text>
            </LinearGradient>
          </View>
          
          {overdueAppointments > 0 && (
            <View style={styles.overdueCard}>
              <AlertTriangle size={16} color="#ef4444" />
              <Text style={styles.overdueText}>{overdueAppointments} Overdue Appointment{overdueAppointments > 1 ? 's' : ''}</Text>
            </View>
          )}

          {/* Booking Requests */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Booking Requests / ବୁକିଂ ଅନୁରୋଧ</Text>
            
            {/* Search Bar */}
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, mobile, village..."
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            
            {filteredBookingRequests.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No pending requests</Text>
              </View>
            ) : (
              <ScrollView
                style={[styles.bookingRequestsScroll, { maxHeight: bookingListMaxHeight }]}
                contentContainerStyle={styles.bookingRequestsContent}
                nestedScrollEnabled
                showsVerticalScrollIndicator
                persistentScrollbar
              >
              {paginatedBookingRequests.map((apt) => {
                const priority = getPriorityInfo(apt.patient, apt);
                return (
                  <View key={apt.id} style={styles.requestCard}>
                    <TouchableOpacity 
                      onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: apt.id })}
                      activeOpacity={0.7}
                    >
                    <View style={styles.requestHeader}>
                      <View style={styles.priorityBadge}>
                        <View style={[styles.badge, { backgroundColor: priority.color }]}>
                          <Text style={styles.badgeText}>{priority.label}</Text>
                        </View>
                        {apt.patient?.is_high_risk && (
                          <AlertTriangle size={14} color="#f59e0b" />
                        )}
                      </View>
                    </View>
                    <Text style={styles.requestName}>{apt.patient?.full_name || 'N/A'}</Text>
                    <Text style={styles.requestDetails}>
                      Age: {apt.patient?.age || 'N/A'} years • {getTrimester(apt.patient?.edd_date)}{"\n"}
                      Village: {apt.patient?.address || 'N/A'}{"\n"}
                      Mobile: {apt.patient?.mobile_number || 'N/A'}
                    </Text>
                    <View style={styles.requestDate}>
                      <Calendar size={11} color="#374151" />
                      <Text style={styles.requestDateText}>
                        Requested: {formatDate(apt.created_at)}
                      </Text>
                    </View>
                    <View style={styles.requestDate}>
                      <Calendar size={11} color="#374151" />
                      <Text style={styles.requestDateText}>
                        Scheduled: {formatDate(apt.scheduled_date)}
                      </Text>
                    </View>
                    {apt.reschedule_count > 0 && (
                      <Text style={styles.rescheduleInfo}>
                        ⚠ Rescheduled {apt.reschedule_count} time(s)
                      </Text>
                    )}
                    {isAppointmentOverdue(apt) && (
                      <View style={styles.overdueBadge}>
                        <AlertTriangle size={12} color="#ef4444" />
                        <Text style={styles.overdueLabel}>OVERDUE</Text>
                      </View>
                    )}
                    <Text style={styles.requestedBy}>Requested by: {getRequestedByDisplayName(apt)}</Text>
                    {apt.appointment_type === 'emergency' && (
                      <View style={styles.emergencyBanner}>
                        <AlertTriangle size={12} color="#ef4444" />
                        <Text style={styles.emergencyText}>EMERGENCY CASE</Text>
                      </View>
                    )}
                    <View style={styles.actionButtons}>
                      {apt.status === 'accepted' ? (
                        <View style={styles.acceptedBadge}>
                          <CheckCircle size={14} color="#22c55e" style={{ marginRight: 4 }} />
                          <Text style={styles.acceptedText}>Accepted</Text>
                        </View>
                      ) : apt.status === 'rescheduled' ? (
                        <View style={styles.rescheduledBadge}>
                          <Clock size={14} color="#f59e0b" style={{ marginRight: 4 }} />
                          <Text style={styles.rescheduledText}>Rescheduled</Text>
                        </View>
                      ) : (
                        <>
                          <TouchableOpacity 
                            style={styles.acceptButton}
                            onPress={() => handleAccept(apt.id)}
                          >
                            <CheckCircle size={14} color="white" style={{ marginRight: 4 }} />
                            <Text style={styles.acceptButtonText}>Accept</Text>
                          </TouchableOpacity>
                          {apt.appointment_type !== 'emergency' && (
                            <TouchableOpacity 
                              style={styles.rescheduleButton}
                              onPress={() => handleReschedule(apt.id)}
                            >
                              <Clock size={14} color="white" style={{ marginRight: 4 }} />
                              <Text style={styles.rescheduleButtonText}>Reschedule</Text>
                            </TouchableOpacity>
                          )}
                        </>
                      )}
                    </View>
                    </TouchableOpacity>
                  </View>
                );
              })
              }
              </ScrollView>
            )}
            {filteredBookingRequests.length > 0 && (
              <View style={styles.paginationContainer}>
                <TouchableOpacity
                  style={[styles.pageButton, currentPage === 1 && styles.pageButtonDisabled]}
                  onPress={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <Text style={[styles.pageButtonText, currentPage === 1 && styles.pageButtonTextDisabled]}>Previous</Text>
                </TouchableOpacity>
                <Text style={styles.pageInfo}>Page {currentPage} of {totalPages}</Text>
                <TouchableOpacity
                  style={[styles.pageButton, currentPage === totalPages && styles.pageButtonDisabled]}
                  onPress={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  <Text style={[styles.pageButtonText, currentPage === totalPages && styles.pageButtonTextDisabled]}>Next</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('quickActions')} / ତ୍ୱରିତ କାର୍ଯ୍ୟ</Text>
            <TouchableOpacity 
              style={styles.actionItem}
              onPress={() => navigation.navigate('CompletedReports')}
            >
              <View style={styles.actionIcon}>
                <CheckCircle size={20} color="#8B4513" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>{t('viewCompletedReports')}</Text>
                <Text style={styles.actionSubtitle}>{t('todaysCompletedScans')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionItem}
              onPress={() => navigation.navigate('AllReports')}
            >
              <View style={styles.actionIcon}>
                <FileText size={20} color="#8B4513" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>{t('viewAllReports')}</Text>
                <Text style={styles.actionSubtitle}>{t('historicalRecords')}</Text>
              </View>
            </TouchableOpacity>
          </View>

          <Footer />
        </ScrollView>

        {/* Reschedule Modal */}
        <Modal visible={showRescheduleModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Reschedule Appointment</Text>
              <TouchableOpacity 
                style={styles.datePickerButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.datePickerText}>
                  {formatDateDDMMYYYY(rescheduleDate)}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={rescheduleDate}
                  mode="date"
                  display="default"
                  onChange={(event, date) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (date) {
                      setRescheduleDate(date);
                      const now = new Date();
                      if (isSameCalendarDay(date, now)) {
                        const selectedDateTime = buildRescheduleDateTime(date, rescheduleTime);
                        if (selectedDateTime <= now) {
                          setRescheduleTime(now);
                        }
                      }
                    }
                  }}
                  minimumDate={new Date()}
                />
              )}
              <TouchableOpacity 
                style={styles.datePickerButton}
                onPress={() => setShowTimePicker(true)}
              >
                <Text style={styles.datePickerText}>
                  {rescheduleTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
              {showTimePicker && (
                <DateTimePicker
                  value={rescheduleTime}
                  mode="time"
                  display="default"
                  onChange={(event, time) => {
                    setShowTimePicker(Platform.OS === 'ios');
                    if (time) {
                      const now = new Date();
                      const selectedDateTime = buildRescheduleDateTime(rescheduleDate, time);
                      if (isSameCalendarDay(rescheduleDate, now) && selectedDateTime <= now) {
                        Alert.alert(t('error'), t('selectFutureTimeForToday'));
                        return;
                      }
                      setRescheduleTime(time);
                    }
                  }}
                />
              )}
              <TextInput
                style={styles.modalInput}
                placeholder="Reason for reschedule"
                value={rescheduleReason}
                onChangeText={setRescheduleReason}
                multiline
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowRescheduleModal(false);
                    setShowDatePicker(false);
                    setShowTimePicker(false);
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.modalSubmitButton}
                  onPress={submitReschedule}
                >
                  <Text style={styles.modalSubmitText}>Reschedule</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f0f4f8',
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
  notificationBadge: {
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
  notificationBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  scrollViewStyle: {
    flex: 1,
    padding: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCardGreen: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  statCard: {
    flex: 1,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  statNumberGreen: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#22c55e',
    marginBottom: 4,
  },
  statLabelGreen: {
    fontSize: 12,
    fontWeight: '600',
    color: '#22c55e',
    marginBottom: 2,
  },
  statOdiaGreen: {
    fontSize: 10,
    color: '#22c55e',
  },
  statNumberOrange: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ea580c',
    marginBottom: 4,
  },
  statLabelOrange: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ea580c',
    marginBottom: 2,
  },
  statOdiaOrange: {
    fontSize: 10,
    color: '#ea580c',
  },
  section: {
    marginBottom: 20,
  },
  bookingRequestsScroll: {
    minHeight: 180,
  },
  bookingRequestsContent: {
    paddingRight: 4,
  },
  paginationContainer: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pageButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#8B4513',
  },
  pageButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  pageButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  pageButtonTextDisabled: {
    color: '#6b7280',
  },
  pageInfo: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  requestCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  requestHeader: {
    marginBottom: 8,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  requestName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  requestDetails: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 18,
  },
  requestDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  requestDateText: {
    fontSize: 11,
    color: '#374151',
  },
  requestedBy: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 16,
  },
  rescheduleInfo: {
    fontSize: 11,
    color: '#f59e0b',
    fontWeight: '600',
    marginBottom: 12,
  },
  emergencyBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 6,
    padding: 8,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emergencyText: {
    fontSize: 11,
    color: '#ef4444',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#8B4513',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 6,
  },
  acceptButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  rescheduleButton: {
    flex: 1,
    backgroundColor: '#6b7280',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 6,
  },
  rescheduleButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledButtonText: {
    color: '#9ca3af',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 69, 19, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 11,
    color: '#6b7280',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
  },
  datePickerButton: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: 'white',
  },
  datePickerText: {
    fontSize: 14,
    color: '#1f2937',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalCancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6b7280',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#6b7280',
    fontWeight: '600',
  },
  modalSubmitButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#8B4513',
    alignItems: 'center',
  },
  modalSubmitText: {
    color: 'white',
    fontWeight: '600',
  },
  searchInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
  },
  overdueCard: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  overdueText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  overdueBadge: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 6,
    padding: 6,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  overdueLabel: {
    fontSize: 11,
    color: '#ef4444',
    fontWeight: '600',
  },
  acceptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  acceptedText: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '600',
  },
  rescheduledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 6,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  rescheduledText: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default USGDashboard;
