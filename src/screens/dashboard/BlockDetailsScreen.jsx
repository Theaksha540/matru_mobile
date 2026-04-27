import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { ArrowLeft, MapPin, Users, TriangleAlert, Activity, Wifi, WifiOff, Search } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { pregnantWomenAPI, usgAppointmentAPI, adminAPI } from '../../services/api';
import { offlineDB } from '../../utils/offlineDatabase';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { secureStorage } from '../../utils/secureStorage';
import Footer from '../../components/Footer';
import { formatDateDDMMYYYY } from '../../utils/dateFormat';

const BlockDetailsScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const isOnline = useNetworkStatus();
  const { blockId, blockName } = route.params;
  
  // State management
  const [userInfo, setUserInfo] = useState(null);
  const [blockData, setBlockData] = useState(null);
  const [pregnantWomen, setPregnantWomen] = useState([]);
  const [usgAppointments, setUsgAppointments] = useState([]);
  const [womenSearchQuery, setWomenSearchQuery] = useState('');
  const [appointmentsSearchQuery, setAppointmentsSearchQuery] = useState('');
  const [patients, setPatients] = useState({});
  const [usgCentres, setUsgCentres] = useState({});
  const [womenPage, setWomenPage] = useState(1);
  const [appointmentsPage, setAppointmentsPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  
  const itemsPerPage = 10;

  const filteredPregnantWomen = pregnantWomen.filter((woman) => {
    const query = womenSearchQuery.trim().toLowerCase();
    if (!query) return true;

    return [
      woman?.full_name,
      woman?.name,
      woman?.rch_id,
      woman?.registration_no,
      woman?.mobile_number,
      woman?.phone,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const filteredUsgAppointments = usgAppointments.filter((appointment) => {
    const query = appointmentsSearchQuery.trim().toLowerCase();
    if (!query) return true;

    return [
      patients[appointment?.pregnant_woman_id],
      appointment?.status,
      appointment?.appointment_type,
      appointment?.centre_name,
      usgCentres[appointment?.usg_centre_id],
      appointment?.notes,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  // Load data on mount and when network status changes
  useEffect(() => {
    loadBlockData();
  }, [blockId]);

  useEffect(() => {
    // Reload data when coming online
    if (isOnline && !loading) {
      loadBlockData();
    }
  }, [isOnline]);

  useEffect(() => {
    setWomenPage(1);
  }, [womenSearchQuery]);

  useEffect(() => {
    setAppointmentsPage(1);
  }, [appointmentsSearchQuery]);

  // Helper function to ensure data is always an array
  const ensureArray = (data) => {
    if (Array.isArray(data)) {
      return data;
    }
    if (data === null || data === undefined) {
      return [];
    }
    if (typeof data === 'object') {
      // Check if it's a single object with an id
      if (data.id || data._id) {
        return [data];
      }
      // If it's an object with items property (pagination)
      if (data.items && Array.isArray(data.items)) {
        return data.items;
      }
    }
    return [];
  };

  // Format date safely
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return formatDateDDMMYYYY(dateString);
  };

  // Safe property access
  const getProperty = (obj, prop, defaultValue = 'N/A') => {
    return obj && obj[prop] ? obj[prop] : defaultValue;
  };

  // Sync data for offline use
  const syncDataForOffline = async (womenData, appointmentsData, centresData) => {
    try {
      setSyncStatus('syncing');
      
      // Save patients
      if (womenData && womenData.length > 0) {
        await offlineDB.savePatients(womenData);
      }
      
      // Save appointments
      if (appointmentsData && appointmentsData.length > 0) {
        await offlineDB.saveAppointments(appointmentsData);
      }
      
      // Save centres
      if (centresData && centresData.length > 0) {
        await offlineDB.saveSecureData('usg_centres', 'all', centresData);
      }
      
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (error) {
      console.error('Error syncing data for offline:', error);
      setSyncStatus('error');
    }
  };

  // Load block data (online/offline)
  const loadBlockData = async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      await offlineDB.init();
      const userData = await secureStorage.getItem('user_info');
      setUserInfo(userData);
      
      if (isOnline) {
        // ONLINE MODE - Load fresh data from API
        console.log('Loading online data for block:', blockId);
        
        // Fetch all required data
        const [womenResponse, appointmentsResponse, centresResponse] = await Promise.allSettled([
          pregnantWomenAPI.getAll({ block_id: blockId, limit: 50 }),
          usgAppointmentAPI.getAll({ limit: 50 }),
          adminAPI.getUSGCentres().catch(() => []) // Fallback to empty array on error
        ]);
        
        // Process women data
        let womenData = [];
        if (womenResponse.status === 'fulfilled' && womenResponse.value) {
          womenData = ensureArray(womenResponse.value.items || womenResponse.value);
        }
        
        // Process appointments data
        let appointmentsData = [];
        if (appointmentsResponse.status === 'fulfilled' && appointmentsResponse.value) {
          appointmentsData = ensureArray(appointmentsResponse.value.items || appointmentsResponse.value);
        }
        
        // Process centres data
        let centresData = [];
        if (centresResponse.status === 'fulfilled' && centresResponse.value) {
          centresData = ensureArray(centresResponse.value);
        }
        
        // Filter women by block
        const blockWomen = womenData.filter(w => 
          w && (w.block_id?.toString() === blockId?.toString())
        );
        
        // Filter appointments for these women
        const blockWomenIds = new Set(blockWomen.map(w => w.id));
        const blockAppointments = appointmentsData.filter(a => 
          a && a.pregnant_woman_id && blockWomenIds.has(a.pregnant_woman_id)
        );
        
        // Update state
        setBlockData({
          total_pregnant_women: blockWomen.length,
          high_risk_cases: blockWomen.filter(w => w.is_high_risk).length,
          pending_usg_appointments: blockAppointments.filter(a => a.status === 'pending').length,
          completed_usg_appointments: blockAppointments.filter(a => a.status === 'completed').length,
          total_usg_appointments: blockAppointments.length
        });
        
        setPregnantWomen(blockWomen);
        setUsgAppointments(blockAppointments);
        
        // Load patient names
        const patientData = {};
        blockWomen.forEach(woman => {
          if (woman && woman.id) {
            patientData[woman.id] = woman.full_name || woman.name || `Patient ${woman.id}`;
          }
        });
        setPatients(patientData);
        
        // Load USG centre names
        const centreData = {};
        centresData.forEach(centre => {
          if (centre && centre.id) {
            centreData[centre.id] = centre.name || centre.centre_name || `Centre ${centre.id}`;
          }
        });
        setUsgCentres(centreData);
        
        // Sync data for offline use (don't await)
        syncDataForOffline(blockWomen, blockAppointments, centresData);
        
      } else {
        // OFFLINE MODE - Load from local database
        console.log('Loading offline data for block:', blockId);
        
        // Safely load data from offline DB
        let womenData = [];
        let appointmentsData = [];
        let centresData = [];
        
        try {
          const patientsResult = await offlineDB.getPatients();
          womenData = ensureArray(patientsResult);
        } catch (error) {
          console.warn('Error loading offline patients:', error);
        }
        
        try {
          const appointmentsResult = await offlineDB.getAppointments();
          appointmentsData = ensureArray(appointmentsResult);
        } catch (error) {
          console.warn('Error loading offline appointments:', error);
        }
        
        try {
          const centresResult = await offlineDB.getSecureData('usg_centres', 'all');
          centresData = ensureArray(centresResult);
        } catch (error) {
          console.warn('Error loading offline centres:', error);
        }
        
        console.log('Offline data counts:', {
          women: womenData.length,
          appointments: appointmentsData.length,
          centres: centresData.length
        });
        
        // Filter by blockId
        const blockWomen = womenData.filter(w => 
          w && w.block_id && w.block_id.toString() === blockId.toString()
        );
        
        const blockWomenIds = new Set(blockWomen.map(w => w.id));
        const blockAppointments = appointmentsData.filter(a => 
          a && a.pregnant_woman_id && blockWomenIds.has(a.pregnant_woman_id)
        );
        
        console.log('Filtered offline data:', { 
          blockWomen: blockWomen.length,
          blockAppointments: blockAppointments.length
        });
        
        // Update state
        setPregnantWomen(blockWomen);
        setUsgAppointments(blockAppointments);
        
        // Load patient names
        const patientData = {};
        blockWomen.forEach(woman => {
          if (woman && woman.id) {
            patientData[woman.id] = woman.full_name || woman.name || `Patient ${woman.id}`;
          }
        });
        setPatients(patientData);
        
        // Load USG centre names
        const centreData = {};
        if (centresData && centresData.length > 0) {
          centresData.forEach(centre => {
            if (centre && centre.id) {
              centreData[centre.id] = centre.name || centre.centre_name || `Centre ${centre.id}`;
            }
          });
        }
        setUsgCentres(centreData);
        
        // Set block stats
        setBlockData({
          total_pregnant_women: blockWomen.length,
          high_risk_cases: blockWomen.filter(w => w && w.is_high_risk).length,
          pending_usg_appointments: blockAppointments.filter(a => a && a.status === 'pending').length,
          completed_usg_appointments: blockAppointments.filter(a => a && a.status === 'completed').length,
          total_usg_appointments: blockAppointments.length
        });
        
        // Show message if no data
        if (blockWomen.length === 0 && blockAppointments.length === 0) {
          setSyncStatus('no_data');
        }
      }
    } catch (error) {
      console.error('Error loading block data:', error);
      Alert.alert(
        'Error',
        'Failed to load block data. Please try again.'
      );
      
      // Set empty state on error
      setBlockData({
        total_pregnant_women: 0,
        high_risk_cases: 0,
        pending_usg_appointments: 0,
        completed_usg_appointments: 0,
        total_usg_appointments: 0
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Handle manual refresh
  const handleRefresh = () => {
    loadBlockData(true);
  };

  // Navigate to woman details
  const handleWomanPress = (woman) => {
    navigation.navigate('PatientDetails', { patientId: woman.id });
  };

  // Navigate to appointment details
  const handleAppointmentPress = (appointment) => {
    navigation.navigate('AppointmentDetails', { appointmentId: appointment.id });
  };

  // Stats cards data
  const stats = [
    {
      id: 1,
      value: blockData?.total_pregnant_women?.toString() || '0',
      title: t('totalRegistered'),
      icon: Users,
      bgColor: '#ffffff',
      borderColor: '#e5e7eb',
      textColor: '#111827',
    },
    {
      id: 2,
      value: blockData?.high_risk_cases?.toString() || '0',
      title: t('highRiskCases'),
      icon: TriangleAlert,
      bgColor: '#fee2e2',
      borderColor: '#ff4d4f',
      textColor: '#c53030',
    },
    {
      id: 3,
      value: blockData?.pending_usg_appointments?.toString() || '0',
      title: t('pendingUSG'),
      icon: Activity,
      bgColor: '#eff6ff',
      borderColor: '#3b5cff',
      textColor: '#1e40af',
    },
    {
      id: 4,
      value: blockData?.completed_usg_appointments && blockData?.total_usg_appointments 
        ? `${Math.round((blockData.completed_usg_appointments / blockData.total_usg_appointments) * 100)}%`
        : '0%',
      title: t('usgCompletion'),
      icon: Activity,
      bgColor: '#dcfce7',
      borderColor: '#22c55e',
      textColor: '#166534',
    },
  ];

  // Render loading state
  if (loading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#D2691E" />
            <Text style={styles.loadingText}>{t('loading')}...</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#D2691E']}
            />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
              >
                <ArrowLeft size={24} color="white" />
              </TouchableOpacity>
              
              <View style={styles.headerInfo}>
                <View style={styles.titleRow}>
                  <View style={styles.logoContainer}>
                    <Image 
                      source={require('../../../assets/image/image2.png')}
                      style={styles.logo}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={styles.headerTitle}>{blockName} {t('block')}</Text>
                </View>
                
                <View style={styles.locationRow}>
                  <MapPin size={16} color="#e9d5ff" />
                  <Text style={styles.headerSubtitle}>{t('blockDetails')}</Text>
                </View>
                
                <View style={styles.statusContainer}>
                  <View style={[styles.statusDot, { backgroundColor: isOnline ? '#22c55e' : '#ef4444' }]} />
                  <Text style={styles.statusText}>
                    {isOnline ? t('online') : t('offline')}
                  </Text>
                  {syncStatus === 'syncing' && (
                    <View style={styles.syncBadge}>
                      <ActivityIndicator size="small" color="#D2691E" />
                      <Text style={styles.syncText}>Syncing...</Text>
                    </View>
                  )}
                  {syncStatus === 'synced' && (
                    <View style={[styles.syncBadge, styles.syncedBadge]}>
                      <Text style={styles.syncedText}>✓ Synced</Text>
                    </View>
                  )}
                  {syncStatus === 'no_data' && !isOnline && (
                    <View style={[styles.syncBadge, styles.noDataBadge]}>
                      <Text style={styles.noDataText}>No offline data</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Main Content */}
          <View style={styles.mainContent}>
            <View style={styles.contentContainer}>
              
              {/* Stats Grid */}
              <View style={styles.statsGrid}>
                {stats.map((stat) => {
                  const IconComponent = stat.icon;
                  return (
                    <View
                      key={stat.id}
                      style={[
                        styles.statCard,
                        {
                          backgroundColor: stat.bgColor,
                          borderColor: stat.borderColor,
                        },
                      ]}
                    >
                      <View style={styles.statHeader}>
                        <IconComponent size={20} color={stat.textColor} />
                        <Text style={[styles.statValue, { color: stat.textColor }]}>
                          {stat.value}
                        </Text>
                      </View>
                      <Text style={[styles.statTitle, { color: stat.textColor }]}>
                        {stat.title}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Offline Message */}
              {!isOnline && pregnantWomen.length === 0 && usgAppointments.length === 0 && (
                <View style={styles.offlineMessage}>
                  <WifiOff size={40} color="#92400e" />
                  <Text style={styles.offlineMessageText}>No Data Available Offline</Text>
                  <Text style={styles.offlineMessageSubtext}>
                    Please connect to internet and sync data to view block details
                  </Text>
                  <TouchableOpacity 
                    style={styles.retryButton}
                    onPress={handleRefresh}
                  >
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Pregnant Women List */}
              {pregnantWomen.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>
                      {t('pregnantWomen').toUpperCase()} ({pregnantWomen.length})
                    </Text>
                    {!isOnline && (
                      <View style={styles.offlineIndicator}>
                        <WifiOff size={14} color="#6b7280" />
                        <Text style={styles.offlineIndicatorText}>Offline</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.searchContainer}>
                    <Search size={18} color="#6b7280" style={styles.searchIcon} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search pregnant women..."
                      placeholderTextColor="#9ca3af"
                      value={womenSearchQuery}
                      onChangeText={setWomenSearchQuery}
                    />
                  </View>
                  
                  <View style={styles.listContainer}>
                    <ScrollView
                      style={styles.innerListScroll}
                      showsVerticalScrollIndicator={true}
                      nestedScrollEnabled={true}
                    >
                      {filteredPregnantWomen
                        .slice((womenPage - 1) * itemsPerPage, womenPage * itemsPerPage)
                        .map((woman, index) => (
                          <TouchableOpacity 
                            key={woman.id || index} 
                            style={styles.womanCard}
                            onPress={() => handleWomanPress(woman)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.womanHeader}>
                              <Text style={styles.womanName}>
                                {woman.full_name || woman.name || `Patient ${woman.id}`}
                              </Text>
                              {woman.is_high_risk && (
                                <View style={styles.highRiskBadge}>
                                  <Text style={styles.highRiskText}>High Risk</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.womanDetail}>
                              RCH ID: {woman.rch_id || woman.registration_no || 'N/A'}
                            </Text>
                            <Text style={styles.womanDetail}>
                              Mobile: {woman.mobile_number || woman.phone || 'N/A'}
                            </Text>
                            <Text style={styles.womanDetail}>
                              LMP: {formatDate(woman.lmp_date)}
                            </Text>
                            <Text style={styles.womanDetail}>
                              EDD: {formatDate(woman.edd_date)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                    </ScrollView>
                  </View>
                  
                  {/* Pagination */}
                  {Math.ceil(filteredPregnantWomen.length / itemsPerPage) > 1 && (
                    <View style={styles.pagination}>
                      <TouchableOpacity 
                        style={[styles.pageButton, womenPage === 1 && styles.disabledButton]}
                        onPress={() => setWomenPage(Math.max(1, womenPage - 1))}
                        disabled={womenPage === 1}
                      >
                        <Text style={styles.pageButtonText}>Previous</Text>
                      </TouchableOpacity>
                      <Text style={styles.pageInfo}>
                        {womenPage} / {Math.ceil(filteredPregnantWomen.length / itemsPerPage)}
                      </Text>
                      <TouchableOpacity 
                        style={[styles.pageButton, womenPage === Math.ceil(filteredPregnantWomen.length / itemsPerPage) && styles.disabledButton]}
                        onPress={() => setWomenPage(Math.min(Math.ceil(filteredPregnantWomen.length / itemsPerPage), womenPage + 1))}
                        disabled={womenPage === Math.ceil(filteredPregnantWomen.length / itemsPerPage)}
                      >
                        <Text style={styles.pageButtonText}>Next</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              {/* USG Appointments List */}
              {usgAppointments.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>
                      {t('usgAppointments').toUpperCase()} ({usgAppointments.length})
                    </Text>
                  </View>

                  <View style={styles.searchContainer}>
                    <Search size={18} color="#6b7280" style={styles.searchIcon} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search USG appointments..."
                      placeholderTextColor="#9ca3af"
                      value={appointmentsSearchQuery}
                      onChangeText={setAppointmentsSearchQuery}
                    />
                  </View>
                  
                  <View style={styles.listContainer}>
                    <ScrollView
                      style={styles.innerListScroll}
                      showsVerticalScrollIndicator={true}
                      nestedScrollEnabled={true}
                    >
                      {filteredUsgAppointments
                        .slice((appointmentsPage - 1) * itemsPerPage, appointmentsPage * itemsPerPage)
                        .map((appointment, index) => (
                          <TouchableOpacity 
                            key={appointment.id || index} 
                            style={styles.appointmentCard}
                            onPress={() => handleAppointmentPress(appointment)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.appointmentHeader}>
                              <Text style={styles.appointmentPatient}>
                                {patients[appointment.pregnant_woman_id] || `Patient ${appointment.pregnant_woman_id}`}
                              </Text>
                              <View style={[
                                styles.statusBadge, 
                                { 
                                  backgroundColor: appointment.status === 'pending' ? '#fef3c7' : 
                                                  appointment.status === 'completed' ? '#dcfce7' : 
                                                  appointment.status === 'cancelled' ? '#fee2e2' : '#f3f4f6'
                                }
                              ]}>
                                <Text style={styles.statusText}>
                                  {appointment.status?.toUpperCase() || 'PENDING'}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.appointmentDetail}>
                              Date: {formatDate(appointment.scheduled_date)}
                            </Text>
                            <Text style={styles.appointmentDetail}>
                              Type: {appointment.appointment_type || 'Regular'}
                            </Text>
                            <Text style={styles.appointmentDetail}>
                              Centre: {usgCentres[appointment.usg_centre_id] || 
                                      appointment.centre_name || 
                                      `Centre ${appointment.usg_centre_id}`}
                            </Text>
                            {appointment.notes && (
                              <Text style={styles.appointmentNotes}>
                                Notes: {appointment.notes}
                              </Text>
                            )}
                          </TouchableOpacity>
                        ))}
                    </ScrollView>
                  </View>
                  
                  {/* Pagination */}
                  {Math.ceil(filteredUsgAppointments.length / itemsPerPage) > 1 && (
                    <View style={styles.pagination}>
                      <TouchableOpacity 
                        style={[styles.pageButton, appointmentsPage === 1 && styles.disabledButton]}
                        onPress={() => setAppointmentsPage(Math.max(1, appointmentsPage - 1))}
                        disabled={appointmentsPage === 1}
                      >
                        <Text style={styles.pageButtonText}>Previous</Text>
                      </TouchableOpacity>
                      <Text style={styles.pageInfo}>
                        {appointmentsPage} / {Math.ceil(filteredUsgAppointments.length / itemsPerPage)}
                      </Text>
                      <TouchableOpacity 
                        style={[styles.pageButton, appointmentsPage === Math.ceil(filteredUsgAppointments.length / itemsPerPage) && styles.disabledButton]}
                        onPress={() => setAppointmentsPage(Math.min(Math.ceil(filteredUsgAppointments.length / itemsPerPage), appointmentsPage + 1))}
                        disabled={appointmentsPage === Math.ceil(filteredUsgAppointments.length / itemsPerPage)}
                      >
                        <Text style={styles.pageButtonText}>Next</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              {/* No Data Message */}
              {pregnantWomen.length === 0 && usgAppointments.length === 0 && isOnline && (
                <View style={styles.emptyState}>
                  <Users size={50} color="#d1d5db" />
                  <Text style={styles.emptyStateText}>No data available for this block</Text>
                </View>
              )}
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
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    backgroundColor: '#D2691E',
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  backButton: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  headerInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  logoContainer: {
    width: 32,
    height: 32,
    backgroundColor: 'white',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
    overflow: 'hidden',
  },
  logo: {
    width: 45,
    height: 45,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    flexShrink: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  headerSubtitle: {
    color: '#e9d5ff',
    fontSize: 14,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  syncText: {
    color: 'white',
    fontSize: 10,
  },
  syncedBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.3)',
  },
  syncedText: {
    color: '#dcfce7',
    fontSize: 10,
    fontWeight: '600',
  },
  noDataBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
  },
  noDataText: {
    color: '#fee2e2',
    fontSize: 10,
    fontWeight: '600',
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  contentContainer: {
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 32,
  },
  statCard: {
    width: '47%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    paddingVertical: 12,
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  offlineIndicatorText: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
  },
  listContainer: {
    marginBottom: 16,
  },
  innerListScroll: {
    maxHeight: 420,
  },
  womanCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  womanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  womanName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  highRiskBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  highRiskText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#dc2626',
  },
  womanDetail: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  appointmentCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  appointmentPatient: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#111827',
  },
  appointmentDetail: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  appointmentNotes: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
    fontStyle: 'italic',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  pageButton: {
    backgroundColor: '#D2691E',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  disabledButton: {
    backgroundColor: '#d1d5db',
  },
  pageButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  pageInfo: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  offlineMessage: {
    backgroundColor: '#fef3c7',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  offlineMessageText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#92400e',
    marginTop: 12,
    marginBottom: 4,
  },
  offlineMessageSubtext: {
    fontSize: 14,
    color: '#b45309',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#D2691E',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginVertical: 16,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 12,
    textAlign: 'center',
  },
});

export default BlockDetailsScreen;
