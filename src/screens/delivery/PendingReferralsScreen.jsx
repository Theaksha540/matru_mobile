import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  ArrowLeft, 
  UserCheck, 
  RefreshCw, 
  Clock,
  Phone,
  User,
  AlertCircle,
  Wifi,
  WifiOff,
  Search,
  Home
} from 'lucide-react-native';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { syncService } from '../../utils/syncService';
import { secureStorage } from '../../utils/secureStorage';
import { useTranslation } from 'react-i18next';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../../utils/dateFormat';
import Footer from '../../components/Footer';
import PaginationControls from '../../components/PaginationControls';

const { useRef } = React;
const PendingReferralsScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const isOnline = useNetworkStatus();
  const initialSearchQuery = route?.params?.initialSearchQuery;
  const mobileNumberFilter = String(route?.params?.mobileNumber || '').trim();
  const referenceIdFilter = String(route?.params?.referenceId || '').trim();
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [userInfo, setUserInfo] = useState(null);
  const [offlineReferralActionCount, setOfflineReferralActionCount] = useState(0);
  const hasHandledInitialFocus = useRef(false);
  const itemsPerPage = 10;

  useEffect(() => {
    loadUserInfo();
    loadPendingReferrals();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!hasHandledInitialFocus.current) {
        hasHandledInitialFocus.current = true;
        return;
      }
      loadPendingReferrals();
    }, [])
  );

  useEffect(() => {
    if (typeof initialSearchQuery === 'string' && initialSearchQuery.trim()) {
      setSearchQuery(initialSearchQuery.trim());
    }
  }, [initialSearchQuery]);

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

  const loadPendingReferrals = async () => {
    try {
      setLoading(true);
      console.log('Loading pending referrals with pagination...');

      const [data, offlineReferralActions] = await Promise.all([
        syncService.getDeliveryReferrals('pending'),
        syncService.getOfflineReferralActions(),
      ]);
      console.log('Pending referrals loaded:', data);

      const filteredData = Array.isArray(data)
        ? data.filter((referral) => referral?.status === 'pending')
        : [];
      setReferrals(filteredData);
      setOfflineReferralActionCount(Array.isArray(offlineReferralActions) ? offlineReferralActions.length : 0);
    } catch (error) {
      console.error('Error loading pending referrals:', error);
      Alert.alert('Error', 'Failed to load pending referrals');
      setReferrals([]);
      setOfflineReferralActionCount(0);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setCurrentPage(1);
    await loadPendingReferrals();
    setRefreshing(false);
  };

  const handleSearchChange = (text) => {
    setSearchQuery(text);
    setCurrentPage(1);
  };

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

  const handleAcceptReferral = async (referralId) => {
    Alert.alert(
      'Accept Referral',
      'Are you sure you want to accept this delivery referral?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            try {
              const result = await syncService.acceptDeliveryReferral(referralId);
              await loadPendingReferrals();
              Alert.alert('Success', result?.offline ? 'Referral accepted offline and will sync when online.' : 'Referral accepted successfully', [
                {
                  text: 'OK',
                  onPress: () => navigation.navigate('ReferralDetail', { referralId })
                }
              ]);
            } catch (error) {
              Alert.alert('Error', 'Failed to accept referral');
            }
          }
        }
      ]
    );
  };

  const handleReRefer = (referralId) => {
    navigation.navigate('ReReferScreen', { referralId });
  };

  const handleViewDetails = (referralId) => {
    navigation.navigate('ReferralDetail', { referralId });
  };

  const getReferredToDPName = (referral) => {
    const chain = Array.isArray(referral?.referral_chain) ? referral.referral_chain : [];
    const latestStep = chain[chain.length - 1];
    return latestStep?.dp_name || referral?.dp_name || 'N/A';
  };

  const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredReferrals = referrals.filter((referral) => {
    const referralMobile = normalizeDigits(referral?.mobile_number);
    const referralReferenceId = String(
      referral?.reference_id ??
      referral?.id ??
      ''
    ).trim();

    if (referenceIdFilter && referralReferenceId !== referenceIdFilter) {
      return false;
    }

    if (mobileNumberFilter && referralMobile !== mobileNumberFilter) {
      return false;
    }

    if (!normalizedQuery) return true;

    return [
      referral.pregnant_woman_name,
      referral.mobile_number,
      referral.dp_name,
      referral.sub_centre_name,
      referral.observation_notes,
      referral.referral_chain_summary,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery));
  });
  const totalCount = filteredReferrals.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const paginatedReferrals = filteredReferrals.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const hasPreviousPage = currentPage > 1;
  const hasNextPage = currentPage < totalPages;
  const startIndex = totalCount === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalCount);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        {/* Header */}
        <LinearGradient
          colors={['#D2691E', '#B8860B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft size={20} color="white" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{t('pendingReferrals') || 'Pending Referrals'}</Text>
            <Text style={styles.headerSubtitle}>ବାକି ରେଫରାଲ</Text>
          </View>
          <TouchableOpacity 
            style={styles.homeButton}
            onPress={handleGoHome}
          >
            <Home size={20} color="white" />
          </TouchableOpacity>
        </LinearGradient>

        {/* Content */}
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              colors={['#D2691E']}
              tintColor="#D2691E"
            />
          }
        >
          {/* Search Filter */}
          <View style={styles.searchContainer}>
            <Search size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by patient name, mobile, or DP name"
              value={searchQuery}
              onChangeText={handleSearchChange}
              placeholderTextColor="#999"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => handleSearchChange('')} style={styles.clearButton}>
                <AlertCircle size={20} color="#666" />
              </TouchableOpacity>
            )}
          </View>

          {!isOnline && (
            <LinearGradient
              colors={['#e0f2fe', '#f8fafc']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.offlineInfoBanner}
            >
              <View style={styles.offlineInfoIcon}>
                <WifiOff size={18} color="#0369a1" />
              </View>
              <View style={styles.offlineInfoContent}>
                <Text style={styles.offlineInfoTitle}>Offline mode</Text>
                <Text style={styles.offlineInfoText}>
                  Accepted or re-referred referrals are saved locally and will update the backend when internet returns.
                </Text>
                {offlineReferralActionCount > 0 && (
                  <Text style={styles.offlineInfoQueued}>
                    {offlineReferralActionCount} offline referral action{offlineReferralActionCount > 1 ? 's are' : ' is'} waiting to sync.
                  </Text>
                )}
              </View>
            </LinearGradient>
          )}

          {loading ? (
            <View style={styles.emptyStateContainer}>
              <ActivityIndicator size="large" color="#D2691E" />
              <Text style={styles.loadingText}>{t('loadingReferrals') || 'Loading pending referrals...'}</Text>
            </View>
          ) : filteredReferrals.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              {searchQuery.trim() !== '' ? (
                <>
                  <Search size={48} color="#d1d5db" />
                  <Text style={styles.noDataText}>No Matching Referrals</Text>
                  <Text style={styles.noDataSubtext}>Try a different search term</Text>
                </>
              ) : (
                <>
                  <AlertCircle size={48} color="#d1d5db" />
                  <Text style={styles.noDataText}>No Pending Referrals</Text>
                  <Text style={styles.noDataSubtext}>All referrals have been processed or none are available</Text>
                </>
              )}
            </View>
          ) : (
            <>
              {/* Priority Notice */}
              <LinearGradient
                colors={['#fef3c7', '#fff4e6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.priorityBanner}
              >
                <AlertCircle size={20} color="#D2691E" />
                  <Text style={styles.priorityText}>
                    <Text style={styles.priorityBold}>Priority Action Required:</Text> {totalCount} referral{totalCount > 1 ? 's' : ''} awaiting your decision.
                  </Text>
                </LinearGradient>

              {/* Referral Cards */}
              {paginatedReferrals.map((referral) => (
                <TouchableOpacity
                  key={referral.id}
                  style={styles.referralCard}
                  onPress={() => handleViewDetails(referral.id)}
                  activeOpacity={0.7}
                >
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
                      <Text style={styles.statusText}>PENDING</Text>
                    </View>
                  </View>

                  {/* Referral Info */}
                  <View style={styles.referralInfo}>
                    <Text style={styles.dpName}>Referred to: {getReferredToDPName(referral)}</Text>
                    <View style={styles.dateInfo}>
                      <Clock size={14} color="#6b7280" />
                      <Text style={styles.dateText}>
                        {formatDateDDMMYYYY(referral.created_at)}
                      </Text>
                    </View>
                  </View>

                  {referral.referral_chain_summary && (
                    <View style={styles.notesContainer}>
                      <Text style={styles.notesLabel}>Chain:</Text>
                      <Text style={styles.observationNotes} numberOfLines={2}>
                        {referral.referral_chain_summary}
                      </Text>
                    </View>
                  )}

                  {/* Time Since Creation */}
                  <View style={styles.timeInfo}>
                    <Text style={styles.timeLabel}>Pending since: </Text>
                    <Text style={styles.timeValue}>
                      {formatDateTimeDDMMYYYY(referral.created_at)}
                    </Text>
                  </View>

                  {/* Observation Notes */}
                  {referral.observation_notes && (
                    <View style={styles.notesContainer}>
                      <Text style={styles.notesLabel}>Notes:</Text>
                      <Text style={styles.observationNotes} numberOfLines={3}>
                        {referral.observation_notes}
                      </Text>
                    </View>
                  )}

                  {/* Action Buttons */}
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.acceptButton]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleAcceptReferral(referral.id);
                      }}
                    >
                      <UserCheck size={16} color="white" />
                      <Text style={styles.acceptButtonText}>Accept Referral</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.actionButton, styles.reReferButton]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleReRefer(referral.id);
                      }}
                    >
                      <RefreshCw size={16} color="#8B4513" />
                      <Text style={styles.reReferButtonText}>Re-refer</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Urgency Indicator */}
                  <View style={styles.urgencyIndicator}>
                    <View style={styles.urgencyDot} />
                    <Text style={styles.urgencyText}>Requires immediate attention</Text>
                  </View>
                </TouchableOpacity>
              ))}

              {/* Pagination */}
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalCount={totalCount}
                startIndex={startIndex}
                endIndex={endIndex}
                onPreviousPage={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                onNextPage={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                hasPreviousPage={hasPreviousPage}
                hasNextPage={hasNextPage}
                loading={loading}
              />

              {/* Guidelines */}
              <LinearGradient
                colors={['#fad5a5', '#fff4e6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.guidelinesBanner}
              >
                <Text style={styles.guidelinesText}>
                  <Text style={styles.guidelinesBold}>Guidelines:</Text> Review each referral carefully. Accept if you can handle the delivery, or re-refer to another appropriate DP.
                </Text>
              </LinearGradient>
            </>
          )}
          
          <Footer />
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'center',
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  countText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    marginBottom: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 4,
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  loadingText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
  },
  noDataText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 18,
    marginTop: 16,
    fontWeight: '600',
  },
  noDataSubtext: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 8,
    paddingHorizontal: 40,
  },
  priorityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#D2691E',
  },
  priorityText: {
    fontSize: 14,
    color: '#D2691E',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  priorityBold: {
    fontWeight: '600',
  },
  offlineInfoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  offlineInfoIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  offlineInfoContent: {
    flex: 1,
  },
  offlineInfoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  offlineInfoText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  offlineInfoQueued: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#0369a1',
  },
  referralCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderLeftWidth: 4,
    borderLeftColor: '#D2691E',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mobileNumber: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  statusBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D2691E',
  },
  referralInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dpName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#6b7280',
  },
  notesContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#d1d5db',
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  observationNotes: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  acceptButton: {
    backgroundColor: '#059669',
  },
  acceptButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  reReferButton: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  reReferButtonText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
  },
  urgencyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  urgencyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dc2626',
    marginRight: 8,
  },
  urgencyText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '500',
  },
  guidelinesBanner: {
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#8B4513',
  },
  guidelinesText: {
    fontSize: 13,
    color: '#8B4513',
    lineHeight: 18,
  },
  guidelinesBold: {
    fontWeight: '600',
  },
  networkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderRadius: 8,
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
    gap: 6,
  },
  onlineText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
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
    gap: 6,
  },
  offlineText: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '600',
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  timeLabel: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '500',
  },
  timeValue: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '600',
  },
});

export default PendingReferralsScreen;
