import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Calendar, Clock, MapPin, Search, Home } from 'lucide-react-native';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { secureStorage } from '../../utils/secureStorage';
import { syncService } from '../../utils/syncService';
import { formatDateTimeDDMMYYYY } from '../../utils/dateFormat';
import { useTranslation } from 'react-i18next';
import PaginationControls from '../../components/PaginationControls';

const PAGE_SIZE = 10;

const USGAppointmentsList = ({ navigation }) => {
  const { t } = useTranslation();
  const isOnline = useNetworkStatus();
  const [allAppointments, setAllAppointments] = useState([]);
  const [patients, setPatients] = useState({});
  const [usgCentresMap, setUsgCentresMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [userInfo, setUserInfo] = useState(null);

  const handleGoHome = () => {
    const roleRouteMap = {
      dp: 'DPDashboard',
      sub_centre: 'SubCentreDashboard',
      district: 'DistrictDashboard',
      block: 'BlockDashboard',
      usg: 'USGDashboard',
      mother: 'MotherDashboard',
    };
    const dashboardRoute = roleRouteMap[userInfo?.role] || 'SubCentreDashboard';
    navigation.navigate(dashboardRoute);
  };

  const loadUserInfo = async () => {
    try {
      const userData = await secureStorage.getItem('user_info');
      if (userData) {
        setUserInfo(userData);
      }
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  };

  const checkAccess = async () => {
    const userInfo = await secureStorage.getItem('user_info');
    if (userInfo?.role !== 'sub_centre' && userInfo?.role !== 'usg_centre') {
      Alert.alert(t('accessDenied'), t('usgListAccessDenied'));
      navigation.goBack();
    }
  };

  const loadUSGCentres = async () => {
    try {
      const userInfo = await secureStorage.getItem('user_info');
      const districtId = userInfo?.district_id;
      const blockId = userInfo?.block_id;

      const centres = districtId
        ? await syncService.getUSGCentres({ district_id: districtId })
        : blockId
          ? await syncService.getUSGCentres({ block_id: blockId })
          : await syncService.getUSGCentres();

      const centresLookup = {};
      (Array.isArray(centres) ? centres : []).forEach((centre) => {
        if (centre?.id !== undefined && centre?.id !== null) {
          centresLookup[String(centre.id)] =
            centre.name || centre.centre_name || centre.usg_centre_name || `USG Centre ${centre.id}`;
        }
      });

      setUsgCentresMap(centresLookup);
    } catch (error) {
      console.error('Error loading USG centres:', error);
      setUsgCentresMap({});
    }
  };

  const fetchPatientNames = async (patientIds) => {
    const patientData = {};
    await Promise.all(
      patientIds.map(async (patientId) => {
        try {
          const patient = await syncService.getPatientById(patientId);
          patientData[patientId] = {
            full_name: patient?.full_name || `Patient ${patientId}`,
            mobile_number: patient?.mobile_number || '',
            age: patient?.age !== undefined && patient?.age !== null ? String(patient.age) : '',
          };
        } catch (error) {
          patientData[patientId] = {
            full_name: `Patient ${patientId}`,
            mobile_number: '',
            age: '',
          };
        }
      })
    );
    return patientData;
  };

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const appointments = await syncService.getAppointments();
      setAllAppointments(appointments);

      const patientIds = [
        ...new Set(
          appointments
            .map((apt) => apt.pregnant_woman_id)
            .filter((id) => id !== null && id !== undefined)
        ),
      ];
      const patientData = await fetchPatientNames(patientIds);
      setPatients(patientData);
    } catch (error) {
      console.error('Error loading appointments:', error);
      setAllAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  const filterAppointments = () => {
    let filtered = allAppointments;

    if (selectedStatus !== 'all') {
      filtered = filtered.filter((apt) => apt.status === selectedStatus);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((appointment) => {
        const patientDetails = patients[appointment.pregnant_woman_id] || {};
        const name = String(patientDetails.full_name || '').toLowerCase();
        const mobile = String(patientDetails.mobile_number || '');
        const age = String(patientDetails.age || '');

        return name.includes(query) || mobile.includes(query) || age.includes(query);
      });
    }

    return filtered;
  };

  const filteredAppointments = filterAppointments();
  const totalPages = Math.max(1, Math.ceil(filteredAppointments.length / PAGE_SIZE));
  const paginatedAppointments = filteredAppointments.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const hasPreviousPage = currentPage > 1;
  const hasNextPage = currentPage < totalPages;
  const startIndex = filteredAppointments.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(currentPage * PAGE_SIZE, filteredAppointments.length);

  useEffect(() => {
    loadUserInfo();
    checkAccess();
    loadUSGCentres();
    loadAppointments();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStatus, searchQuery]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAppointments();
    setRefreshing(false);
  };

  const nextPage = () => {
    if (hasNextPage) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const previousPage = () => {
    if (hasPreviousPage) {
      setCurrentPage(prev => prev - 1);
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return '#0f766e';
      case 'completed': return '#059669';
      case 'cancelled': return '#dc2626';
      case 'rescheduled': return '#d97706';
      default: return '#6b7280';
    }
  };

  const getUSGCentreDisplayName = (appointment) => {
    return (
      appointment?.usg_centre_name ||
      appointment?.usg_center_name ||
      appointment?.centre_name ||
      usgCentresMap[String(appointment?.usg_centre_id)] ||
      (appointment?.usg_centre_id ? `USG Centre ${appointment.usg_centre_id}` : 'N/A')
    );
  };

  const renderAppointment = (appointment) => (
    <TouchableOpacity 
      key={appointment.id} 
      style={styles.appointmentCard}
      onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: appointment.id })}
      activeOpacity={0.7}
    >
      <View style={styles.appointmentHeader}>
        <View style={styles.appointmentInfo}>
          <Text style={styles.appointmentId}>ID: {appointment.id}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(appointment.status) }]}>
            <Text style={styles.statusText}>{formatDisplayValue(appointment.status)}</Text>
          </View>
        </View>
        <Text style={styles.appointmentType}>{formatDisplayValue(appointment.appointment_type)}</Text>
      </View>

      <View style={styles.appointmentDetails}>
        <View style={styles.detailRow}>
          <Calendar size={16} color="#6b7280" />
          <Text style={styles.detailText}>
            {formatDate(appointment.scheduled_date)}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <MapPin size={16} color="#6b7280" />
          <Text style={styles.detailText}>
            {t('usgCentre') || 'USG Centre'}: {getUSGCentreDisplayName(appointment)}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('patient')}:</Text>
          <Text style={styles.detailValue}>
            {patients[appointment.pregnant_woman_id]?.full_name || `Patient ${appointment.pregnant_woman_id}`}
          </Text>
        </View>

        {appointment.reschedule_count > 0 && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('reschedules')}:</Text>
            <Text style={styles.detailValue}>{appointment.reschedule_count}</Text>
          </View>
        )}

        {appointment.completed_date && appointment.status === 'completed' && (
          <View style={styles.detailRow}>
            <Clock size={16} color="#059669" />
            <Text style={styles.completedText}>
              {t('completed')}: {formatDate(appointment.completed_date)}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={20} color="white" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{t('viewUSGAppointments')}</Text>
          <Text style={styles.headerSubtitle}>USG ଆପଏଣ୍ଟମେଣ୍ଟ ତାଲିକା</Text>
          {!isOnline && (
            <Text style={styles.offlineIndicator}>● {t('offlineMode')}</Text>
          )}
        </View>
        <TouchableOpacity 
          style={styles.homeButton}
          onPress={handleGoHome}
        >
          <Home size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* Status Filter */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['all', 'scheduled', 'completed', 'cancelled', 'rescheduled'].map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterButton,
                selectedStatus === status && styles.activeFilter
              ]}
              onPress={() => setSelectedStatus(status)}
            >
              <Text style={[
                styles.filterText,
                selectedStatus === status && styles.activeFilterText
              ]}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Search size={18} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            placeholder={t('searchByNameMobileAge')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9ca3af"
          />
        </View>
      </View>

      {/* Appointments List */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8B4513" />
            <Text style={styles.loadingText}>{t('loadingAppointments')}</Text>
          </View>
        ) : paginatedAppointments.length > 0 ? (
          <>
            {paginatedAppointments.map(renderAppointment)}
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={filteredAppointments.length}
              startIndex={startIndex}
              endIndex={endIndex}
              onPreviousPage={previousPage}
              onNextPage={nextPage}
              hasPreviousPage={hasPreviousPage}
              hasNextPage={hasNextPage}
              loading={loading}
            />
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery.trim()
                ? t('noMatchingAppointments')
                : (isOnline ? t('noAppointmentsFound') : t('noCachedAppointments'))}
            </Text>
            {!isOnline && !searchQuery.trim() && (
              <Text style={styles.offlineText}>
                {t('connectInternetForAppointments')}
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fad5a5',
  },
  header: {
    backgroundColor: '#D2691E',
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  homeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#e9d5ff',
    fontSize: 14,
  },
  filterContainer: {
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: '#fad5a5',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  activeFilter: {
    backgroundColor: '#8B4513',
  },
  filterText: {
    fontSize: 14,
    color: '#6b7280',
  },
  activeFilterText: {
    color: 'white',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 110,
  },
  appointmentCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  appointmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appointmentId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  appointmentType: {
    fontSize: 14,
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  appointmentDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginRight: 8,
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  completedText: {
    fontSize: 14,
    color: '#059669',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 10,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  offlineText: {
    fontSize: 14,
    color: '#d97706',
    textAlign: 'center',
    marginTop: 8,
  },
  offlineIndicator: {
    color: '#fbbf24',
    fontSize: 12,
    marginTop: 2,
  },
});

export default USGAppointmentsList;
