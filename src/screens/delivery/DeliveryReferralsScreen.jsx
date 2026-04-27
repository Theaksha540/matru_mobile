import React, { useState, useEffect } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { 
  ArrowLeft, 
  UserCheck, 
  RefreshCw, 
  CheckCircle,
  Clock,
  Phone,
  User,
  Search,
  AlertCircle,
  WifiOff,
  Home
} from 'lucide-react-native';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { syncService } from '../../utils/syncService';
import { secureStorage } from '../../utils/secureStorage';
import { useTranslation } from 'react-i18next';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../../utils/dateFormat';
import Footer from '../../components/Footer';
import { useFocusEffect } from '@react-navigation/native';
import PaginationControls from '../../components/PaginationControls';

const { useRef } = React;

const DeliveryReferralsScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const isOnline = useNetworkStatus();
  const [allReferrals, setAllReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState(route.params?.filter || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [userInfo, setUserInfo] = useState(null);
  const [offlineReferralActionCount, setOfflineReferralActionCount] = useState(0);
  const hasHandledInitialFocus = useRef(false);
  const initialFilter = route.params?.filter;
  const initialSearchQuery = route.params?.initialSearchQuery;
  const mobileNumberFilter = String(route.params?.mobileNumber || '').trim();
  const referenceIdFilter = String(route.params?.referenceId || '').trim();
  const itemsPerPage = 10;

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'accepted', label: 'Accepted' },
    { key: 're_referred', label: 'Re-referred' },
    { key: 'completed', label: 'Completed' },
  ];

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

  const loadReferrals = async () => {
    try {
      setLoading(true);
      const [data, offlineReferralActions] = await Promise.all([
        syncService.getDeliveryReferrals(),
        syncService.getOfflineReferralActions(),
      ]);
      const dataArray = Array.isArray(data) ? data : [];
      setAllReferrals(dataArray);
      setOfflineReferralActionCount(Array.isArray(offlineReferralActions) ? offlineReferralActions.length : 0);
    } catch (error) {
      console.error('Error loading referrals:', error);
      Alert.alert('Error', 'Failed to load delivery referrals');
      setAllReferrals([]);
      setOfflineReferralActionCount(0);
    } finally {
      setLoading(false);
    }
  };

  const filterReferrals = () => {
    let filtered = allReferrals;

    if (filter !== 'all') {
      filtered = filtered.filter((ref) => ref.status === filter);
    }

    const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');
    const normalizedQuery = searchQuery.trim().toLowerCase();

    filtered = filtered.filter((referral) => {
      const referralMobile = normalizeDigits(referral?.mobile_number);
      const referralReferenceId = String(
        referral?.reference_id ?? referral?.id ?? ''
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
        referral.re_refer_reason,
        referral.referral_chain_summary,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });

    return filtered;
  };

  const filteredReferrals = filterReferrals();
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

  const getStatusCounts = () => {
    return {
      all: allReferrals.length,
      pending: allReferrals.filter(r => r.status === 'pending').length,
      accepted: allReferrals.filter(r => r.status === 'accepted').length,
      re_referred: allReferrals.filter(r => r.status === 're_referred').length,
      completed: allReferrals.filter(r => r.status === 'completed').length,
    };
  };

  const statusCounts = getStatusCounts();

  useEffect(() => {
    loadUserInfo();
    loadReferrals();
  }, []);

  useEffect(() => {
    if (initialFilter) {
      setFilter(initialFilter);
    }
  }, [initialFilter]);

  useEffect(() => {
    if (typeof initialSearchQuery === 'string' && initialSearchQuery.trim()) {
      setSearchQuery(initialSearchQuery.trim());
    }
  }, [initialSearchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  useFocusEffect(
    React.useCallback(() => {
      if (!hasHandledInitialFocus.current) {
        hasHandledInitialFocus.current = true;
        return;
      }
      loadReferrals();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReferrals();
    setRefreshing(false);
  };

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
  };

  const handleSearchChange = (text) => {
    setSearchQuery(text);
  };

  const handleAcceptReferral = async (referralId) => {
    try {
      const result = await syncService.acceptDeliveryReferral(referralId);
      Alert.alert('Success', result?.offline ? 'Referral accepted offline and will sync when online.' : 'Referral accepted successfully');
      loadReferrals();
    } catch (error) {
      Alert.alert('Error', 'Failed to accept referral');
    }
  };

  const handleReRefer = (referralId) => {
    navigation.navigate('ReReferScreen', { referralId });
  };

  const handleRecordOutcome = (referralId) => {
    navigation.navigate('RecordOutcomeScreen', { referralId });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return { bg: '#fef3c7', text: '#d97706' };
      case 'accepted': return { bg: '#d1fae5', text: '#059669' };
      case 're_referred': return { bg: '#fee2e2', text: '#dc2626' };
      case 'completed': return { bg: '#dbeafe', text: '#2563eb' };
      default: return { bg: '#f3f4f6', text: '#6b7280' };
    }
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

  const getReferredToDPName = (referral) => {
    const chain = Array.isArray(referral?.referral_chain) ? referral.referral_chain : [];
    const latestStep = chain[chain.length - 1];
    return latestStep?.dp_name || referral?.dp_name || 'N/A';
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
            <Text style={styles.headerTitle}>
              {initialFilter === 're_referred' ? 'Re-referred Cases' : 
               initialFilter === 'pending' ? 'Pending Referrals' :
               t('deliveryReferrals') || 'Delivery Referrals'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {initialFilter === 're_referred' ? 'ପୁନଃ ରେଫର କେସ' :
               initialFilter === 'pending' ? 'ବାକି ରେଫରାଲ' :
               'ଡେଲିଭରି ରେଫରାଲ'}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.homeButton}
            onPress={handleGoHome}
          >
            <Home size={20} color="white" />
          </TouchableOpacity>
        </LinearGradient>

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScrollContent}
          >
            {filters.map((filterItem) => (
              <TouchableOpacity
                key={filterItem.key}
                style={[
                  styles.filterTab,
                  filter === filterItem.key && styles.activeFilterTab
                ]}
                onPress={() => handleFilterChange(filterItem.key)}
              >
                <Text style={[
                  styles.filterTabText,
                  filter === filterItem.key && styles.activeFilterTabText
                ]}>
                  {filterItem.label} ({statusCounts[filterItem.key]})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Referrals List */}
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              colors={['#8B4513']}
              tintColor="#8B4513"
            />
          }
        >
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Search size={20} color="#6b7280" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by patient name, mobile, or DP..."
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={handleSearchChange}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity 
                onPress={() => handleSearchChange('')} 
                style={styles.clearSearchButton}
                activeOpacity={0.7}
              >
                <AlertCircle size={16} color="#6b7280" />
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
              <WifiOff size={18} color="#0369a1" />
              <View style={styles.offlineInfoContent}>
                <Text style={styles.offlineInfoTitle}>Offline mode</Text>
                <Text style={styles.offlineInfoText}>
                  Referral actions are being saved locally and will update the backend when internet returns.
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
              <Text style={styles.loadingText}>{t('loadingReferrals') || 'Loading referrals...'}</Text>
            </View>
          ) : paginatedReferrals.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <User size={48} color="#d1d5db" />
              <Text style={styles.noDataText}>{t('noReferralsFound') || 'No referrals found'}</Text>
              <Text style={styles.noDataSubtext}>Referrals will appear here when available</Text>
            </View>
          ) : (
            <>
              {paginatedReferrals.map((referral) => {
              const statusColors = getStatusColor(referral.status);
              return (
                <TouchableOpacity
                  key={referral.id}
                  style={styles.referralCard}
                  onPress={() => {
                    navigation.navigate('ReferralDetail', { referralId: referral.id });
                  }}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.patientInfo}>
                      <Text style={styles.patientName}>{referral.pregnant_woman_name}</Text>
                      <View style={styles.contactInfo}>
                        <Phone size={14} color="#6b7280" />
                        <Text style={styles.mobileNumber}>{referral.mobile_number}</Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
                      <Text style={[styles.statusText, { color: statusColors.text }]}>
                        {referral.status.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                  </View>

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
                    <Text style={styles.observationNotes} numberOfLines={2}>
                      Chain: {referral.referral_chain_summary}
                    </Text>
                  )}

                  {/* Re-referral specific information */}
                  {referral.status === 're_referred' && referral.re_refer_reason && (
                    <View style={styles.reReferInfo}>
                      <Text style={styles.reReferLabel}>Re-referral Reason:</Text>
                      <Text style={styles.reReferReason} numberOfLines={2}>
                        {referral.re_refer_reason}
                      </Text>
                    </View>
                  )}

                  {/* Additional Date Info for Status Updates */}
                  {referral.updated_at && referral.updated_at !== referral.created_at && (
                    <View style={styles.additionalDateInfo}>
                      <Text style={styles.updateLabel}>Last Updated: </Text>
                      <Text style={styles.updateDate}>
                        {formatDateTimeDDMMYYYY(referral.updated_at)}
                      </Text>
                    </View>
                  )}

                  {referral.observation_notes && (
                    <Text style={styles.observationNotes} numberOfLines={2}>
                      {referral.observation_notes}
                    </Text>
                  )}

                  {/* Action Buttons - Only for DP users */}
                  {userInfo?.role === 'dp' && (
                    <View style={styles.actionButtons}>
                      {referral.status === 'pending' && (
                        <>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.acceptButton]}
                            onPress={() => handleAcceptReferral(referral.id)}
                          >
                            <UserCheck size={16} color="white" />
                            <Text style={styles.acceptButtonText}>Accept</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity
                            style={[styles.actionButton, styles.reReferButton]}
                            onPress={() => handleReRefer(referral.id)}
                          >
                            <RefreshCw size={16} color="#dc2626" />
                            <Text style={styles.reReferButtonText}>Re-refer</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      
                      {referral.status === 'accepted' && (
                        <TouchableOpacity
                          style={[styles.actionButton, styles.outcomeButton]}
                          onPress={() => handleRecordOutcome(referral.id)}
                        >
                          <CheckCircle size={16} color="#059669" />
                          <Text style={styles.outcomeButtonText}>Record Outcome</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}

            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              startIndex={startIndex}
              endIndex={endIndex}
              onPreviousPage={previousPage}
              onNextPage={nextPage}
              hasPreviousPage={hasPreviousPage}
              hasNextPage={hasNextPage}
              loading={loading}
            />
            </>
          )}
        
        {/* Info Banner */}
        {paginatedReferrals.length > 0 && (
          <LinearGradient
            colors={['#fad5a5', '#fff4e6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.infoBanner}
          >
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>Real-time Updates:</Text> Referral status updates automatically when actions are taken.
            </Text>
          </LinearGradient>
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
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterContainer: {
    backgroundColor: 'white',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterScrollContent: {
    paddingHorizontal: 16,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  activeFilterTab: {
    backgroundColor: '#8B4513',
    borderColor: '#8B4513',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeFilterTabText: {
    color: 'white',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginBottom: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#374151',
    fontWeight: '400',
  },
  clearSearchButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginLeft: 8,
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
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
    fontSize: 16,
    marginTop: 16,
    fontWeight: '600',
  },
  noDataSubtext: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 8,
  },
  offlineInfoBanner: {
    marginBottom: 16,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bae6fd',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
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
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mobileNumber: {
    fontSize: 14,
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  referralInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  observationNotes: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
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
    fontSize: 13,
    fontWeight: '600',
  },
  reReferButton: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  reReferButtonText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '600',
  },
  outcomeButton: {
    backgroundColor: '#d1fae5',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  outcomeButtonText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '600',
  },
  infoBanner: {
    borderLeftWidth: 4,
    borderLeftColor: '#8B4513',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 13,
    color: '#8B4513',
    textAlign: 'center',
    lineHeight: 18,
  },
  infoBold: {
    fontWeight: '600',
  },
  additionalDateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  updateLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  updateDate: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  reReferInfo: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  reReferLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  reReferReason: {
    fontSize: 13,
    color: '#92400e',
    lineHeight: 18,
  },
});

export default DeliveryReferralsScreen;
