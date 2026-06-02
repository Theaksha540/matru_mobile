import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { ArrowLeft, MapPin, Users, TriangleAlert, Activity, WifiOff, Wifi } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { pregnantWomenAPI, usgAppointmentAPI, adminAPI } from '../../services/api';
import { offlineDB } from '../../utils/offlineDatabase';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { secureStorage } from '../../utils/secureStorage';
import Footer from '../../components/Footer';
import { formatDateDDMMYYYY } from '../../utils/dateFormat';
const WardDetailsScreen = ({
  navigation,
  route
}) => {
  const {
    t
  } = useTranslation();
  const isOnline = useNetworkStatus();
  const {
    wardId,
    wardName,
    blockId,
    blockName
  } = route.params;
  const [wardData, setWardData] = useState(null);
  const [pregnantWomen, setPregnantWomen] = useState([]);
  const [usgAppointments, setUsgAppointments] = useState([]);
  const [patients, setPatients] = useState({});
  const [usgCentres, setUsgCentres] = useState({});
  const [womenPage, setWomenPage] = useState(1);
  const [appointmentsPage, setAppointmentsPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const itemsPerPage = 10;
  useEffect(() => {
    loadWardData();
  }, [wardId, blockId]);
  useEffect(() => {
    if (isOnline && !loading) {
      loadWardData();
    }
  }, [isOnline]);
  const ensureArray = data => {
    if (Array.isArray(data)) return data;
    if (!data) return [];
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data?.items)) return data.data.items;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };
  const formatDate = dateString => {
    if (!dateString) return 'N/A';
    return formatDateDDMMYYYY(dateString);
  };
  const syncDataForOffline = async (womenData, appointmentsData, centresData) => {
    try {
      if (womenData?.length) {
        await offlineDB.savePatients(womenData);
      }
      if (appointmentsData?.length) {
        await offlineDB.saveAppointments(appointmentsData);
      }
      if (centresData?.length) {
        await offlineDB.saveSecureData('usg_centres', 'all', centresData);
      }
    } catch (error) {}
  };
  const loadWardData = async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      await offlineDB.init();
      await secureStorage.getItem('user_info');
      if (isOnline) {
        const [womenResponse, appointmentsResponse, centresResponse] = await Promise.allSettled([pregnantWomenAPI.getAll({
          block_id: blockId,
          limit: 1000
        }), usgAppointmentAPI.getAll({
          limit: 1000
        }), adminAPI.getUSGCentres().catch(() => [])]);
        const womenData = womenResponse.status === 'fulfilled' ? ensureArray(womenResponse.value) : [];
        const appointmentsData = appointmentsResponse.status === 'fulfilled' ? ensureArray(appointmentsResponse.value) : [];
        const centresData = centresResponse.status === 'fulfilled' ? ensureArray(centresResponse.value) : [];
        const wardWomen = womenData.filter(woman => woman && String(woman.ward_id) === String(wardId));
        const wardWomenIds = new Set(wardWomen.map(woman => woman.id).filter(Boolean));
        const wardAppointments = appointmentsData.filter(appointment => appointment && appointment.pregnant_woman_id && wardWomenIds.has(appointment.pregnant_woman_id));
        setWardData({
          total_pregnant_women: wardWomen.length,
          high_risk_cases: wardWomen.filter(woman => woman?.is_high_risk).length,
          pending_usg_appointments: wardAppointments.filter(appointment => appointment?.status === 'pending').length,
          completed_usg_appointments: wardAppointments.filter(appointment => appointment?.status === 'completed').length,
          total_usg_appointments: wardAppointments.length
        });
        setPregnantWomen(wardWomen);
        setUsgAppointments(wardAppointments);
        const patientData = {};
        wardWomen.forEach(woman => {
          if (woman?.id) {
            patientData[woman.id] = woman.full_name || woman.name || `${t('patient')} ${woman.id}`;
          }
        });
        setPatients(patientData);
        const centreData = {};
        centresData.forEach(centre => {
          if (centre?.id) {
            centreData[centre.id] = centre.name || centre.centre_name || `${t('centreLabel')} ${centre.id}`;
          }
        });
        setUsgCentres(centreData);
        syncDataForOffline(wardWomen, wardAppointments, centresData);
      } else {
        const womenData = (await offlineDB.getPatients()) || [];
        const appointmentsData = (await offlineDB.getAppointments()) || [];
        const centresData = (await offlineDB.getSecureData('usg_centres', 'all')) || [];
        const wardWomen = womenData.filter(woman => woman && String(woman.ward_id) === String(wardId));
        const wardWomenIds = new Set(wardWomen.map(woman => woman.id).filter(Boolean));
        const wardAppointments = appointmentsData.filter(appointment => appointment && appointment.pregnant_woman_id && wardWomenIds.has(appointment.pregnant_woman_id));
        setWardData({
          total_pregnant_women: wardWomen.length,
          high_risk_cases: wardWomen.filter(woman => woman?.is_high_risk).length,
          pending_usg_appointments: wardAppointments.filter(appointment => appointment?.status === 'pending').length,
          completed_usg_appointments: wardAppointments.filter(appointment => appointment?.status === 'completed').length,
          total_usg_appointments: wardAppointments.length
        });
        setPregnantWomen(wardWomen);
        setUsgAppointments(wardAppointments);
        const patientData = {};
        wardWomen.forEach(woman => {
          if (woman?.id) {
            patientData[woman.id] = woman.full_name || woman.name || `${t('patient')} ${woman.id}`;
          }
        });
        setPatients(patientData);
        const centreData = {};
        centresData.forEach(centre => {
          if (centre?.id) {
            centreData[centre.id] = centre.name || centre.centre_name || `${t('centreLabel')} ${centre.id}`;
          }
        });
        setUsgCentres(centreData);
      }
    } catch (error) {
      Alert.alert(t('error'), t('failedToLoadWardData'));
      setWardData({
        total_pregnant_women: 0,
        high_risk_cases: 0,
        pending_usg_appointments: 0,
        completed_usg_appointments: 0,
        total_usg_appointments: 0
      });
      setPregnantWomen([]);
      setUsgAppointments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  const handleRefresh = () => {
    loadWardData(true);
  };
  const stats = [{
    id: 1,
    value: wardData?.total_pregnant_women?.toString() || '0',
    title: t('totalRegistered'),
    icon: Users,
    bgColor: '#ffffff',
    borderColor: '#e5e7eb',
    textColor: '#111827'
  }, {
    id: 2,
    value: wardData?.high_risk_cases?.toString() || '0',
    title: t('highRiskCases'),
    icon: TriangleAlert,
    bgColor: '#fee2e2',
    borderColor: '#ff4d4f',
    textColor: '#c53030'
  }, {
    id: 3,
    value: wardData?.pending_usg_appointments?.toString() || '0',
    title: t('pendingUSG'),
    icon: Activity,
    bgColor: '#eff6ff',
    borderColor: '#3b5cff',
    textColor: '#1e40af'
  }, {
    id: 4,
    value: wardData?.completed_usg_appointments && wardData?.total_usg_appointments ? `${Math.round(wardData.completed_usg_appointments / wardData.total_usg_appointments * 100)}%` : '0%',
    title: t('usgCompletion'),
    icon: Activity,
    bgColor: '#dcfce7',
    borderColor: '#22c55e',
    textColor: '#166534'
  }];
  if (loading) {
    return <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#D2691E" />
            <Text style={styles.loadingText}>{t('loading')}...</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>;
  }
  return <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#D2691E']} />}>
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
                <ArrowLeft size={24} color="white" />
              </TouchableOpacity>

              <View style={styles.headerInfo}>
                <View style={styles.titleRow}>
                  <View style={styles.logoContainer}>
                    <Image source={require('../../../assets/image/image2.png')} style={styles.logo} resizeMode="contain" />
                  </View>
                  <Text style={styles.headerTitle}>{wardName}</Text>
                </View>

                <View style={styles.locationRow}>
                  <MapPin size={16} color="#e9d5ff" />
                  <Text style={styles.headerSubtitle}>
                    {t('wardDetails')} • {blockName || `${t('block')} ${blockId}`}
                  </Text>
                </View>

                <View style={styles.statusContainer}>
                  {!isOnline && <View style={styles.offlinePill}>
                      <WifiOff size={12} color="#92400e" />
                      <Text style={styles.offlinePillText}>{t('offline')}</Text>
                    </View>}
                  {isOnline && <View style={styles.onlinePill}>
                      <Wifi size={12} color="#166534" />
                      <Text style={styles.onlinePillText}>{t('online')}</Text>
                    </View>}
                </View>
              </View>
            </View>
          </View>

          <View style={styles.mainContent}>
            <View style={styles.contentContainer}>
              <View style={styles.statsGrid}>
                {stats.map(stat => {
                const IconComponent = stat.icon;
                return <View key={stat.id} style={[styles.statCard, {
                  backgroundColor: stat.bgColor,
                  borderColor: stat.borderColor
                }]}>
                      <View style={styles.statHeader}>
                        <IconComponent size={20} color={stat.textColor} />
                        <Text style={[styles.statValue, {
                      color: stat.textColor
                    }]}>{stat.value}</Text>
                      </View>
                      <Text style={[styles.statTitle, {
                    color: stat.textColor
                  }]}>{stat.title}</Text>
                    </View>;
              })}
              </View>

              {!isOnline && pregnantWomen.length === 0 && usgAppointments.length === 0 && <View style={styles.offlineMessage}>
                  <WifiOff size={40} color="#92400e" />
                  <Text style={styles.offlineMessageText}>{t('noDataAvailableOffline')}</Text>
                  <Text style={styles.offlineMessageSubtext}>{t('connectInternetToViewWardDetails')}</Text>
                  <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
                    <Text style={styles.retryButtonText}>{t('retry')}</Text>
                  </TouchableOpacity>
                </View>}

              {pregnantWomen.length > 0 && <>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>
                      {t('pregnantWomen').toUpperCase()} ({pregnantWomen.length})
                    </Text>
                  </View>

                  <ScrollView style={styles.listScrollContainer} showsVerticalScrollIndicator={true} nestedScrollEnabled={true}>
                    <View style={styles.listContainer}>
                      {pregnantWomen.slice((womenPage - 1) * itemsPerPage, womenPage * itemsPerPage).map((woman, index) => <View key={woman.id || index} style={styles.womanCard}>
                            <View style={styles.womanHeader}>
                              <Text style={styles.womanName}>
                                {woman.full_name || woman.name || `${t('patient')} ${woman.id}`}
                              </Text>
                              {woman.is_high_risk && <View style={styles.highRiskBadge}>
                                  <Text style={styles.highRiskText}>{t('highRisk')}</Text>
                                </View>}
                            </View>
                            <Text style={styles.womanDetail}>RCH ID: {woman.rch_id || woman.registration_no || 'N/A'}</Text>
                            <Text style={styles.womanDetail}>{t('mobileNumber')}: {woman.mobile_number || woman.phone || 'N/A'}</Text>
                            <Text style={styles.womanDetail}>LMP: {formatDate(woman.lmp_date)}</Text>
                            <Text style={styles.womanDetail}>EDD: {formatDate(woman.edd_date)}</Text>
                          </View>)}
                    </View>
                  </ScrollView>

                  {Math.ceil(pregnantWomen.length / itemsPerPage) > 1 && <View style={styles.pagination}>
                      <TouchableOpacity style={[styles.pageButton, womenPage === 1 && styles.disabledButton]} onPress={() => setWomenPage(Math.max(1, womenPage - 1))} disabled={womenPage === 1}>
                        <Text style={styles.pageButtonText}>{t('previous')}</Text>
                      </TouchableOpacity>
                      <Text style={styles.pageInfo}>{t('pageOf', {
                    current: womenPage,
                    total: Math.ceil(pregnantWomen.length / itemsPerPage)
                  })}</Text>
                      <TouchableOpacity style={[styles.pageButton, womenPage === Math.ceil(pregnantWomen.length / itemsPerPage) && styles.disabledButton]} onPress={() => setWomenPage(Math.min(Math.ceil(pregnantWomen.length / itemsPerPage), womenPage + 1))} disabled={womenPage === Math.ceil(pregnantWomen.length / itemsPerPage)}>
                        <Text style={styles.pageButtonText}>{t('next')}</Text>
                      </TouchableOpacity>
                    </View>}
                </>}

              {usgAppointments.length > 0 && <>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>
                      {t('usgAppointments').toUpperCase()} ({usgAppointments.length})
                    </Text>
                  </View>

                  <ScrollView style={styles.listScrollContainer} showsVerticalScrollIndicator={true} nestedScrollEnabled={true}>
                    <View style={styles.listContainer}>
                      {usgAppointments.slice((appointmentsPage - 1) * itemsPerPage, appointmentsPage * itemsPerPage).map((appointment, index) => <View key={appointment.id || index} style={styles.appointmentCard}>
                            <View style={styles.appointmentHeader}>
                              <Text style={styles.appointmentPatient}>
                                {patients[appointment.pregnant_woman_id] || `${t('patient')} ${appointment.pregnant_woman_id}`}
                              </Text>
                              <View style={[styles.statusBadge, {
                        backgroundColor: appointment.status === 'pending' ? '#fef3c7' : appointment.status === 'completed' ? '#dcfce7' : appointment.status === 'cancelled' ? '#fee2e2' : '#f3f4f6'
                      }]}>
                                <Text style={styles.statusBadgeText}>
                                  {appointment.status?.toUpperCase() || 'PENDING'}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.appointmentDetail}>{t('scheduledDateLabel')}: {formatDate(appointment.scheduled_date)}</Text>
                            <Text style={styles.appointmentDetail}>{t('appointmentTypeLabel')}: {appointment.appointment_type || 'Regular'}</Text>
                            <Text style={styles.appointmentDetail}>
                              {t('centreLabel')}: {usgCentres[appointment.usg_centre_id] || appointment.centre_name || `${t('centreLabel')} ${appointment.usg_centre_id}`}
                            </Text>
                          </View>)}
                    </View>
                  </ScrollView>

                  {Math.ceil(usgAppointments.length / itemsPerPage) > 1 && <View style={styles.pagination}>
                      <TouchableOpacity style={[styles.pageButton, appointmentsPage === 1 && styles.disabledButton]} onPress={() => setAppointmentsPage(Math.max(1, appointmentsPage - 1))} disabled={appointmentsPage === 1}>
                        <Text style={styles.pageButtonText}>{t('previous')}</Text>
                      </TouchableOpacity>
                      <Text style={styles.pageInfo}>{t('pageOf', {
                    current: appointmentsPage,
                    total: Math.ceil(usgAppointments.length / itemsPerPage)
                  })}</Text>
                      <TouchableOpacity style={[styles.pageButton, appointmentsPage === Math.ceil(usgAppointments.length / itemsPerPage) && styles.disabledButton]} onPress={() => setAppointmentsPage(Math.min(Math.ceil(usgAppointments.length / itemsPerPage), appointmentsPage + 1))} disabled={appointmentsPage === Math.ceil(usgAppointments.length / itemsPerPage)}>
                        <Text style={styles.pageButtonText}>{t('next')}</Text>
                      </TouchableOpacity>
                    </View>}
                </>}

              {pregnantWomen.length === 0 && usgAppointments.length === 0 && isOnline && <View style={styles.emptyState}>
                  <Users size={50} color="#d1d5db" />
                  <Text style={styles.emptyStateText}>{t('noDataAvailableForThisWard')}</Text>
                </View>}
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
  scrollView: {
    flex: 1
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280'
  },
  header: {
    backgroundColor: '#D2691E',
    paddingTop: 16,
    paddingBottom: 20
  },
  headerContent: {
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'flex-start'
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
    borderColor: 'rgba(255, 255, 255, 0.3)'
  },
  headerInfo: {
    flex: 1
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap'
  },
  logoContainer: {
    width: 32,
    height: 32,
    backgroundColor: 'white',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  logo: {
    width: 28,
    height: 28
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    flexShrink: 1
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#f3e8ff',
    fontWeight: '500'
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap'
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  statusText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600'
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999
  },
  onlinePillText: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '700'
  },
  offlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999
  },
  offlinePillText: {
    color: '#92400e',
    fontSize: 11,
    fontWeight: '700'
  },
  mainContent: {
    padding: 16
  },
  contentContainer: {
    gap: 16
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12
  },
  statCard: {
    width: '48%',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800'
  },
  statTitle: {
    fontSize: 13,
    fontWeight: '600'
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1f2937'
  },
  listScrollContainer: {
    maxHeight: 400
  },
  listContainer: {
    gap: 10
  },
  womanCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  womanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8
  },
  womanName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
    flex: 1
  },
  highRiskBadge: {
    backgroundColor: '#fee2e2',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  highRiskText: {
    color: '#b91c1c',
    fontSize: 11,
    fontWeight: '700'
  },
  womanDetail: {
    fontSize: 13,
    color: '#4b5563',
    marginTop: 3
  },
  appointmentCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8
  },
  appointmentPatient: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
    flex: 1
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151'
  },
  appointmentDetail: {
    fontSize: 13,
    color: '#4b5563',
    marginTop: 3
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  pageButton: {
    backgroundColor: '#D2691E',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10
  },
  disabledButton: {
    opacity: 0.5
  },
  pageButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700'
  },
  pageInfo: {
    flex: 1,
    textAlign: 'center',
    color: '#4b5563',
    fontSize: 13,
    fontWeight: '600'
  },
  offlineMessage: {
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  offlineMessageText: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '700',
    color: '#92400e',
    textAlign: 'center'
  },
  offlineMessageSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#a16207',
    textAlign: 'center'
  },
  retryButton: {
    marginTop: 14,
    backgroundColor: '#D2691E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '700'
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center'
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center'
  }
});
export default WardDetailsScreen;
