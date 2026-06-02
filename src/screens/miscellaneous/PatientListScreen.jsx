import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { ArrowLeft, Search, User, ChevronRight, Home } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import PaginationControls from '../../components/PaginationControls';
import { secureStorage } from '../../utils/secureStorage';
import { syncService } from '../../utils/syncService';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import '../../i18n';
const {
  useRef
} = React;
const PatientListScreen = ({
  navigation,
  route
}) => {
  const {
    t
  } = useTranslation();
  const {
    mode,
    initialSearchQuery,
    action
  } = route?.params || {};
  const isCreateReferralMode = action === 'createReferral';
  const [searchQuery, setSearchQuery] = useState('');
  const [allPatients, setAllPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [patientsWithActiveReferrals, setPatientsWithActiveReferrals] = useState(new Set());
  const hasHandledInitialFocus = useRef(false);
  const [userInfo, setUserInfo] = useState(null);
  const isOnline = useNetworkStatus();
  const pageSize = 10;
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
  const loadUserInfo = async () => {
    try {
      const userData = await secureStorage.getItem('user_info');
      if (userData) {
        setUserInfo(userData);
      }
    } catch (error) {}
  };
  const loadPatients = async () => {
    try {
      setLoading(true);
      const patients = await syncService.getPatients();
      setAllPatients(patients);
    } catch (error) {
      setAllPatients([]);
    } finally {
      setLoading(false);
    }
  };
  const normalizeReferralResponse = data => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.results)) return data.results;
    return [];
  };
  const mergeReferralsById = (...referralGroups) => {
    const merged = [];
    const seen = new Set();
    referralGroups.flat().forEach(referral => {
      if (!referral) return;
      const key = String(referral?.id ?? `${referral?.pregnant_woman_id || 'unknown'}_${referral?.status || 'unknown'}_${referral?.dp_id || 'unknown'}`);
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      merged.push(referral);
    });
    return merged;
  };
  const isOfflineOnlyPatientId = value => typeof value === 'string' && value.trim().toLowerCase().startsWith('offline_');
  const findActiveReferralForPatient = (referrals, patientId) => {
    const activeStatuses = ['pending', 'accepted', 're_referred'];
    return (Array.isArray(referrals) ? referrals : []).find(ref => String(ref?.pregnant_woman_id) === String(patientId) && activeStatuses.includes(ref?.status?.toLowerCase()));
  };
  const loadActiveReferrals = async () => {
    try {
      const [allReferrals, pendingReferrals, acceptedReferrals, reReferredReferrals] = await Promise.all([syncService.getDeliveryReferrals(), syncService.getDeliveryReferrals('pending'), syncService.getDeliveryReferrals('accepted'), syncService.getDeliveryReferrals('re_referred')]);
      const referralsList = mergeReferralsById(normalizeReferralResponse(allReferrals), normalizeReferralResponse(pendingReferrals), normalizeReferralResponse(acceptedReferrals), normalizeReferralResponse(reReferredReferrals));
      const activeStatuses = ['pending', 'accepted', 're_referred'];
      const activeReferrals = referralsList.filter(ref => activeStatuses.includes(ref.status?.toLowerCase()));
      const blockedPatientIds = activeReferrals.map(ref => ref.pregnant_woman_id);
      setPatientsWithActiveReferrals(new Set(blockedPatientIds));
    } catch (error) {
      setPatientsWithActiveReferrals(new Set());
    }
  };
  const filterPatients = patients => {
    if (!searchQuery.trim()) return patients;
    const query = searchQuery.toLowerCase().trim();
    return patients.filter(patient => {
      const fullName = patient?.full_name?.toLowerCase() || '';
      const mobile = patient?.mobile_number || '';
      const rchId = patient?.rch_id?.toLowerCase() || '';
      return fullName.includes(query) || mobile.includes(query) || rchId.includes(query);
    });
  };
  const getFilteredPatients = () => {
    let filtered = filterPatients(allPatients);
    if (isCreateReferralMode) {
      filtered = filtered.filter(patient => !patientsWithActiveReferrals.has(patient.id));
    }
    return filtered;
  };
  const filteredPatients = getFilteredPatients();
  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / pageSize));
  const paginatedPatients = filteredPatients.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const hasPreviousPage = currentPage > 1;
  const hasNextPage = currentPage < totalPages;
  const startIndex = filteredPatients.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, filteredPatients.length);
  const isPatientApproved = patient => {
    if (patient?.is_self_registered === false) {
      return true;
    }
    const approvalValue = patient?.registration_approved ?? patient?.is_registration_approved;
    if (typeof approvalValue === 'boolean') return approvalValue;
    if (typeof approvalValue === 'number') return approvalValue === 1;
    if (typeof approvalValue === 'string') {
      const normalized = approvalValue.trim().toLowerCase();
      return normalized === 'true' || normalized === '1' || normalized === 'approved';
    }
    return false;
  };
  const isWaitingForSync = patient => !isOnline && Boolean(patient?.created_offline) && patient?.sync_status === 'pending';
  useEffect(() => {
    loadUserInfo();
    loadPatients();
    if (isCreateReferralMode) {
      loadActiveReferrals();
    }
  }, [isCreateReferralMode]);
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (!hasHandledInitialFocus.current) {
        hasHandledInitialFocus.current = true;
        return;
      }
      loadPatients();
      if (isCreateReferralMode) {
        loadActiveReferrals();
      }
    });
    return unsubscribe;
  }, [navigation, isCreateReferralMode]);
  useEffect(() => {
    if (typeof initialSearchQuery === 'string' && initialSearchQuery.trim()) {
      setSearchQuery(initialSearchQuery.trim());
    }
  }, [initialSearchQuery]);
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);
  const onRefresh = async () => {
    setRefreshing(true);
    await loadPatients();
    if (isCreateReferralMode) {
      await loadActiveReferrals();
    }
    setRefreshing(false);
  };
  const handleSearchChange = text => {
    setSearchQuery(text);
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
  const handlePatientSelect = async patient => {
    if (isCreateReferralMode) {
      if (!isPatientApproved(patient)) {
        Alert.alert(t('error'), 'This beneficiary is not approved yet. Please approve first before creating a delivery referral.');
        return;
      }
      if (patientsWithActiveReferrals.has(patient.id)) {
        Alert.alert(t('error'), 'An active delivery referral already exists for this beneficiary.');
        return;
      }
      if (isOnline && !isOfflineOnlyPatientId(patient?.id)) {
        try {
          const {
            deliveryReferralAPI
          } = await import('../../services/api');
          const patientReferralsResponse = await deliveryReferralAPI.getAll({
            pregnant_woman_id: patient.id
          });
          const patientReferrals = normalizeReferralResponse(patientReferralsResponse);
          const matchedActiveReferral = findActiveReferralForPatient(patientReferrals, patient.id);
          if (matchedActiveReferral) {
            Alert.alert(t('error'), 'An active delivery referral already exists for this beneficiary. Please open the existing referral instead of creating a new one.', [{
              text: 'Cancel',
              style: 'cancel'
            }, {
              text: 'View Referral',
              onPress: () => navigation.navigate('ReferralDetail', {
                referralId: matchedActiveReferral.id
              })
            }]);
            return;
          }
        } catch (error) {}
      }
      navigation.navigate('ANCTracking', {
        patientId: patient.id
      });
    } else if (mode === 'usg') {
      if (!isPatientApproved(patient)) {
        Alert.alert(t('error'), 'This beneficiary is not approved yet. Please approve first before scheduling USG appointment.');
        return;
      }
      navigation.navigate('USGAppointmentForm', {
        patientId: patient.id,
        patientName: patient.full_name
      });
    } else {
      if (!isPatientApproved(patient)) {
        Alert.alert(t('error'), 'This beneficiary is not approved yet. Please approve first before ANC tracking.');
        return;
      }
      navigation.navigate('ANCTracking', {
        patientId: patient.id
      });
    }
  };
  return <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <ArrowLeft size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {action === 'createReferral' ? 'Select Patient for Referral' : mode === 'usg' ? t('selectPatientForUSG') : t('selectPatient')}
            </Text>
            <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
              <Home size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          {!isOnline && <View style={styles.offlineBanner}>
              <Text style={styles.offlineBannerText}>📵 Offline Mode - Showing synced data from login</Text>
            </View>}
          <View style={styles.searchInputContainer}>
            <View style={styles.searchIcon}>
              <Search size={20} color="#6b7280" />
            </View>
            <TextInput style={styles.searchInput} placeholder={t('searchByNameOrMobile')} value={searchQuery} onChangeText={handleSearchChange} />
          </View>
        </View>

        {/* Patient List */}
        <ScrollView style={styles.scrollView} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#8B4513']} tintColor="#8B4513" />}>
          <View style={styles.contentContainer}>
            {loading ? <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#8B4513" />
                <Text style={styles.loadingText}>
                  {t('loadingPatients')}
                </Text>
              </View> : paginatedPatients.length === 0 ? <View style={styles.noDataContainer}>
                <Text style={styles.noDataText}>
                  {action === 'createReferral' ? 'No patients available for referral.' : t('noPatientsFound')}
                </Text>
                {action === 'createReferral' && !isOnline && <Text style={styles.noDataHint}>
                    {allPatients.length > 0 ? 'All patients have active referrals (based on synced data)' : 'No patient data synced. Please connect to internet and try again.'}
                  </Text>}
                {action === 'createReferral' && isOnline && <Text style={styles.noDataHint}>
                    All patients have active referrals.
                  </Text>}
              </View> : <>
                {isCreateReferralMode && paginatedPatients.length > 0 && <View style={styles.infoBanner}>
                    <Text style={styles.infoBannerText}>
                      {isOnline ? `Showing only patients without active referrals (${filteredPatients.length} available)` : `📵 Offline: Showing patients without active referrals based on synced data (${filteredPatients.length} available)`}
                    </Text>
                  </View>}
                {paginatedPatients.map(patient => <TouchableOpacity key={patient.id} style={styles.patientCard} onPress={() => handlePatientSelect(patient)} activeOpacity={0.7}>
                    <View style={styles.patientContent}>
                      <View style={styles.avatarContainer}>
                        <User size={20} color="#8B4513" />
                      </View>
                      <View style={styles.patientInfo}>
                        <View style={styles.nameRow}>
                          <Text style={styles.patientName}>{patient.full_name}</Text>
                          {patient.is_self_registered ? <View style={[styles.registrationBadge, styles.selfRegBadge]}>
                              <Text style={styles.registrationBadgeText}>Self</Text>
                            </View> : <View style={styles.registrationBadge}>
                              <Text style={styles.registrationBadgeText}>Subcenter</Text>
                            </View>}
                        </View>
                        <Text style={styles.patientDetails}>
                          {t('age')}: {patient.age} | {t('mobile')}: {patient.mobile_number}
                        </Text>
                        <View style={styles.approvalRow}>
                          <Text style={styles.approvalLabel}>
                            {isWaitingForSync(patient) ? 'Sync:' : 'Approval:'}
                          </Text>
                          <View style={[styles.approvalBadge, isWaitingForSync(patient) ? styles.waitingSyncBadge : isPatientApproved(patient) ? styles.approvedBadge : styles.pendingBadge]}>
                            <Text style={styles.approvalBadgeText}>
                              {isWaitingForSync(patient) ? 'Waiting for Sync' : isPatientApproved(patient) ? 'Approved' : 'Not Approved'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.patientAddress}>{patient.address}</Text>
                      </View>
                      <ChevronRight size={20} color="#6b7280" />
                    </View>
                  </TouchableOpacity>)}
                
                <PaginationControls currentPage={currentPage} totalPages={totalPages} totalCount={filteredPatients.length} startIndex={startIndex} endIndex={endIndex} onPreviousPage={previousPage} onNextPage={nextPage} hasPreviousPage={hasPreviousPage} hasNextPage={hasNextPage} loading={loading} />
              </>}
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>;
};
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fad5a5'
  },
  header: {
    backgroundColor: '#D2691E',
    paddingHorizontal: 20,
    paddingVertical: 20
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginRight: 12
  },
  homeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginLeft: 12
  },
  headerTitle: {
    flex: 1,
    color: 'white',
    fontSize: 19,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  searchContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb'
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  searchIcon: {
    marginRight: 12
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937'
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#fad5a5'
  },
  contentContainer: {
    padding: 16
  },
  patientCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  patientContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  avatarContainer: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(139, 69, 19, 0.1)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  patientInfo: {
    flex: 1
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  patientName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginRight: 8
  },
  registrationBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  selfRegBadge: {
    backgroundColor: '#dcfce7'
  },
  registrationBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1e40af'
  },
  patientDetails: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2
  },
  approvalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6
  },
  approvalLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500'
  },
  approvalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12
  },
  approvedBadge: {
    backgroundColor: '#dcfce7'
  },
  waitingSyncBadge: {
    backgroundColor: '#fef3c7'
  },
  pendingBadge: {
    backgroundColor: '#fee2e2'
  },
  approvalBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1f2937'
  },
  patientAddress: {
    fontSize: 12,
    color: '#6b7280'
  },
  loadingText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 16,
    marginTop: 12
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40
  },
  infoBanner: {
    backgroundColor: '#dbeafe',
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16
  },
  infoBannerText: {
    fontSize: 13,
    color: '#1e40af',
    fontWeight: '500'
  },
  noDataText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 16,
    padding: 20
  },
  noDataContainer: {
    alignItems: 'center',
    padding: 20
  },
  noDataHint: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 8,
    fontStyle: 'italic'
  },
  offlineBanner: {
    backgroundColor: '#fef3c7',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12
  },
  offlineBannerText: {
    fontSize: 13,
    color: '#92400e',
    fontWeight: '500'
  }
});
export default PatientListScreen;
