import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, RefreshControl, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Clock, Phone, AlertCircle, FileText, Search, Wifi, WifiOff, User, Home } from 'lucide-react-native';
import { syncService } from '../../utils/syncService';
import { secureStorage } from '../../utils/secureStorage';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useTranslation } from 'react-i18next';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../../utils/dateFormat';
import Footer from '../../components/Footer';
import { useFocusEffect } from '@react-navigation/native';
import PaginationControls from '../../components/PaginationControls';
const {
  useRef
} = React;
const ReReferredCasesScreen = ({
  navigation,
  route
}) => {
  const {
    t
  } = useTranslation();
  const isOnline = useNetworkStatus();
  const initialSearchQuery = route?.params?.initialSearchQuery;
  const mobileNumberFilter = String(route?.params?.mobileNumber || '').trim();
  const referenceIdFilter = String(route?.params?.referenceId || '').trim();
  const refreshToken = route?.params?.refreshToken;
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [userInfo, setUserInfo] = useState(null);
  const hasHandledInitialFocus = useRef(false);
  const itemsPerPage = 10;
  useEffect(() => {
    loadUserInfo();
    loadReReferredCases();
  }, []);
  const loadUserInfo = async () => {
    try {
      const userData = await secureStorage.getItem('user_info');
      if (userData) {
        setUserInfo(userData);
      }
    } catch (error) {}
  };
  const handleGoHome = () => {
    const roleRouteMap = {
      dp: 'DPDashboard',
      sub_centre: 'SubCentreDashboard',
      district: 'DistrictDashboard',
      block: 'BlockDashboard',
      usg: 'USGDashboard',
      mother: 'MotherDashboard'
    };
    const dashboardRoute = roleRouteMap[userInfo?.role] || 'SubCentreDashboard';
    navigation.navigate(dashboardRoute);
  };
  useFocusEffect(React.useCallback(() => {
    if (!hasHandledInitialFocus.current) {
      hasHandledInitialFocus.current = true;
      return;
    }
    loadReReferredCases();
  }, []));
  useEffect(() => {
    if (typeof initialSearchQuery === 'string' && initialSearchQuery.trim()) {
      setSearchQuery(initialSearchQuery.trim());
    }
  }, [initialSearchQuery]);
  useEffect(() => {
    if (refreshToken) {
      loadReReferredCases();
    }
  }, [refreshToken]);
  const loadReReferredCases = async () => {
    try {
      setLoading(true);
      const data = await syncService.getDeliveryReferrals('re_referred');
      const filteredData = Array.isArray(data) ? data.filter(r => r.status === 're_referred') : [];
      setReferrals(filteredData);
    } catch (error) {
      Alert.alert('Error', 'Failed to load re-referred cases');
      setReferrals([]);
    } finally {
      setLoading(false);
    }
  };
  const onRefresh = async () => {
    setRefreshing(true);
    setCurrentPage(1);
    await loadReReferredCases();
    setRefreshing(false);
  };
  const handleSearchChange = text => {
    setSearchQuery(text);
    setCurrentPage(1);
  };
  const handleViewDetails = referralId => {
    navigation.navigate('ReferralDetail', {
      referralId
    });
  };
  const getReferredToDPName = referral => {
    const chain = Array.isArray(referral?.referral_chain) ? referral.referral_chain : [];
    const latestStep = chain[chain.length - 1];
    return latestStep?.dp_name || referral?.dp_name || 'N/A';
  };
  const normalizeDigits = value => String(value || '').replace(/\D/g, '');
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredReferrals = referrals.filter(referral => {
    const referralMobile = normalizeDigits(referral?.mobile_number);
    const referralReferenceId = String(referral?.reference_id ?? referral?.id ?? '').trim();
    if (referenceIdFilter && referralReferenceId !== referenceIdFilter) {
      return false;
    }
    if (mobileNumberFilter && referralMobile !== mobileNumberFilter) {
      return false;
    }
    if (!normalizedQuery) return true;
    return [referral.pregnant_woman_name, referral.mobile_number, referral.dp_name, referral.sub_centre_name, referral.observation_notes, referral.re_refer_reason, referral.referral_chain_summary].filter(Boolean).some(value => String(value).toLowerCase().includes(normalizedQuery));
  });
  const totalCount = filteredReferrals.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const paginatedReferrals = filteredReferrals.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const hasPreviousPage = currentPage > 1;
  const hasNextPage = currentPage < totalPages;
  const startIndex = totalCount === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalCount);
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);
  return <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        {/* Header */}
        <LinearGradient colors={['#D2691E', '#B8860B']} start={{
        x: 0,
        y: 0
      }} end={{
        x: 1,
        y: 1
      }} style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={20} color="white" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Re-referred Cases</Text>
            <Text style={styles.headerSubtitle}>ପୁନଃ ରେଫର କେସ</Text>
          </View>
          <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
            <Home size={20} color="white" />
          </TouchableOpacity>
        </LinearGradient>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#D2691E']} tintColor="#D2691E" />}>
          {/* Search Filter */}
          <View style={styles.searchContainer}>
            <Search size={20} color="#666" style={styles.searchIcon} />
            <TextInput style={styles.searchInput} placeholder="Search by patient name, mobile, DP, or reason" value={searchQuery} onChangeText={handleSearchChange} placeholderTextColor="#999" />
            {searchQuery.length > 0 && <TouchableOpacity onPress={() => handleSearchChange('')} style={styles.clearButton}>
                <AlertCircle size={20} color="#666" />
              </TouchableOpacity>}
          </View>

          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <FileText size={20} color="#0369a1" />
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>Re-referred Cases:</Text> These are cases you have referred to other DP referrals for specialized care or capacity reasons.
            </Text>
          </View>

          {/* Cases List */}
          {loading ? <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#D2691E" />
              <Text style={styles.loadingText}>Loading re-referred cases...</Text>
            </View> : filteredReferrals.length === 0 ? <View style={styles.emptyContainer}>
              {searchQuery.trim() !== '' ? <>
                  <Search size={80} color="#9ca3af" />
                  <Text style={styles.emptyTitle}>No Matching Cases</Text>
                  <Text style={styles.emptySubtitle}>Try a different search term</Text>
                </> : <>
                  <FileText size={80} color="#9ca3af" />
                  <Text style={styles.emptyTitle}>No Re-referred Cases</Text>
                  <Text style={styles.emptySubtitle}>You haven't referred any cases to other DP referrals yet</Text>
                </>}
            </View> : <>
            <View style={styles.casesList}>
                {paginatedReferrals.map(referral => <TouchableOpacity key={referral.id} style={styles.caseCard} onPress={() => handleViewDetails(referral.id)} activeOpacity={0.7}>
                  {/* Card Header */}
                  <View style={styles.cardHeader}>
                    <View style={styles.patientInfo}>
                      <Text style={styles.patientName}>{referral.pregnant_woman_name}</Text>
                      <View style={styles.contactInfo}>
                        <Phone size={14} color="#6b7280" />
                        <Text style={styles.mobileNumber}>{referral.mobile_number}</Text>
                      </View>
                    </View>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>REFERRED OUT</Text>
                    </View>
                  </View>

                  {/* Referral Info */}
                  <View style={styles.referralInfo}>
                    <Text style={styles.dpName}>Referred to: {getReferredToDPName(referral)}</Text>
                    <View style={styles.dateInfo}>
                      <Clock size={14} color="#6b7280" />
                      <Text style={styles.dateText}>
                        {formatDateDDMMYYYY(referral.updated_at || referral.created_at)}
                      </Text>
                    </View>
                  </View>

                  {referral.referral_chain_summary && <View style={styles.notesContainer}>
                      <Text style={styles.notesLabel}>Chain:</Text>
                      <Text style={styles.observationNotes} numberOfLines={2}>
                        {referral.referral_chain_summary}
                      </Text>
                    </View>}

                  {/* Re-referral Timeline */}
                  <View style={styles.timelineInfo}>
                    <Text style={styles.timelineLabel}>Originally created: </Text>
                    <Text style={styles.timelineValue}>
                      {formatDateDDMMYYYY(referral.created_at)}
                    </Text>
                  </View>
                  {referral.updated_at && referral.updated_at !== referral.created_at && <View style={styles.timelineInfo}>
                      <Text style={styles.timelineLabel}>Re-referred on: </Text>
                      <Text style={styles.timelineValue}>
                        {formatDateTimeDDMMYYYY(referral.updated_at)}
                      </Text>
                    </View>}

                  {/* Re-referral Reason */}
                  {referral.re_refer_reason && <View style={styles.reasonContainer}>
                      <FileText size={16} color="#8B4513" />
                      <View style={styles.reasonContent}>
                        <Text style={styles.reasonLabel}>Re-referral Reason:</Text>
                        <Text style={styles.reasonText}>{referral.re_refer_reason}</Text>
                      </View>
                    </View>}

                  {/* Observation Notes */}
                  {referral.observation_notes && <View style={styles.notesContainer}>
                      <Text style={styles.notesLabel}>Original Notes:</Text>
                      <Text style={styles.observationNotes} numberOfLines={2}>
                        {referral.observation_notes}
                      </Text>
                    </View>}

                  {/* Status Info */}
                  <View style={styles.statusInfo}>
                    <View style={styles.statusRow}>
                      <Text style={styles.statusLabel}>Current Status:</Text>
                      <Text style={styles.statusValue}>Referred to Another DP</Text>
                    </View>
                    <View style={styles.statusRow}>
                      <Text style={styles.statusLabel}>Your Action:</Text>
                      <Text style={styles.actionCompleted}>Referral Completed</Text>
                    </View>
                  </View>

                  {/* Tap to View Details */}
                  <View style={styles.tapHint}>
                    <FileText size={14} color="#6b7280" />
                    <Text style={styles.tapHintText}>Tap to view full details</Text>
                  </View>
                </TouchableOpacity>)}
              </View>

              {/* Pagination */}
              <PaginationControls currentPage={currentPage} totalPages={totalPages} totalCount={totalCount} startIndex={startIndex} endIndex={endIndex} onPreviousPage={() => setCurrentPage(prev => Math.max(1, prev - 1))} onNextPage={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} hasPreviousPage={hasPreviousPage} hasNextPage={hasNextPage} loading={loading} />

              {/* Guidelines */}
              <LinearGradient colors={['#dbeafe', '#f0f9ff']} start={{
            x: 0,
            y: 0
          }} end={{
            x: 1,
            y: 1
          }} style={styles.guidelinesBanner}>
                <Text style={styles.guidelinesText}>
                  <Text style={styles.guidelinesBold}>Information:</Text> These cases have been successfully referred to other DP referrals. You can track their status and view referral details here.
                </Text>
              </LinearGradient>
            </>}
          
          <Footer />
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
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center'
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  homeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12
  },
  headerInfo: {
    flex: 1
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700'
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    marginTop: 2
  },
  headerRight: {
    alignItems: 'center'
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)'
  },
  countText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700'
  },
  content: {
    flex: 1,
    padding: 16
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    marginBottom: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e9ecef'
  },
  searchIcon: {
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333'
  },
  clearButton: {
    padding: 4
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#0369a1'
  },
  infoText: {
    fontSize: 14,
    color: '#0369a1',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20
  },
  infoBold: {
    fontWeight: '600'
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80
  },
  loadingText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500'
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80
  },
  emptyTitle: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 18,
    marginTop: 16,
    fontWeight: '600'
  },
  emptySubtitle: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 8,
    paddingHorizontal: 40
  },
  casesList: {
    gap: 16
  },
  caseCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderLeftWidth: 4,
    borderLeftColor: '#D2691E',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  patientInfo: {
    flex: 1
  },
  patientName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  mobileNumber: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500'
  },
  statusBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D2691E'
  },
  referralInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  dpName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151'
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  dateText: {
    fontSize: 12,
    color: '#6b7280'
  },
  reasonContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#8B4513',
    gap: 8
  },
  reasonContent: {
    flex: 1
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B4513',
    marginBottom: 4
  },
  reasonText: {
    fontSize: 13,
    color: '#92400e',
    lineHeight: 18
  },
  notesContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#d1d5db'
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4
  },
  observationNotes: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18
  },
  statusInfo: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#0ea5e9'
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0369a1'
  },
  statusValue: {
    fontSize: 13,
    color: '#0284c7',
    fontWeight: '500'
  },
  actionCompleted: {
    fontSize: 13,
    color: '#16a34a',
    fontWeight: '600'
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 6
  },
  tapHintText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    fontStyle: 'italic'
  },
  guidelinesBanner: {
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#8B4513'
  },
  guidelinesText: {
    fontSize: 13,
    color: '#0369a1',
    lineHeight: 18
  },
  guidelinesBold: {
    fontWeight: '600'
  },
  networkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderRadius: 8
  },
  onlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    gap: 6
  },
  onlineText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600'
  },
  offlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
    gap: 6
  },
  offlineText: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '600'
  },
  timelineInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 4
  },
  timelineLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500'
  },
  timelineValue: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600'
  }
});
export default ReReferredCasesScreen;
