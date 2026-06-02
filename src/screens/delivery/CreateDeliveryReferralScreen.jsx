import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Home, Search, ChevronDown } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { secureStorage } from '../../utils/secureStorage';
import { syncService } from '../../utils/syncService';
import KeyboardSafeModal from '../../components/KeyboardSafeModal';
const CreateDeliveryReferralScreen = ({
  navigation,
  route
}) => {
  const {
    t
  } = useTranslation();
  const patientFromRoute = route?.params?.patient || {};
  const patientIdFromRoute = route?.params?.patientId || patientFromRoute?.id;
  const skipInitialActiveReferralCheck = route?.params?.skipInitialActiveReferralCheck === true;
  const [userInfo, setUserInfo] = useState(null);
  const [patient, setPatient] = useState(patientFromRoute);
  const [deliveryPoints, setDeliveryPoints] = useState([]);
  const [selectedDP, setSelectedDP] = useState(null);
  const [observationNotes, setObservationNotes] = useState('');
  const [dpSearchQuery, setDpSearchQuery] = useState('');
  const [showDPModal, setShowDPModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const currentDPDisplayName = userInfo?.dp_name || userInfo?.delivery_point_name || userInfo?.deliveryPointName || userInfo?.delivery_point?.name || userInfo?.deliveryPoint?.name || '';
  const isReferralFormValid = !!selectedDP && !!observationNotes.trim();
  useEffect(() => {
    initializeScreen();
  }, []);
  const initializeScreen = async () => {
    try {
      setLoading(true);
      const storedUser = await secureStorage.getItem('user_info');
      setUserInfo(storedUser || null);
      const resolvedCurrentDPId = storedUser?.dp_id || storedUser?.delivery_point_id || storedUser?.deliveryPointId || storedUser?.delivery_point?.id || storedUser?.deliveryPoint?.id || null;
      let resolvedPatient = patientFromRoute;
      if ((!resolvedPatient?.id || !resolvedPatient?.full_name) && patientIdFromRoute) {
        resolvedPatient = await syncService.getPatientById(patientIdFromRoute);
      }
      if (!resolvedPatient?.id) {
        Alert.alert(t('error'), t('patientInfoUnavailableRefresh'), [{
          text: 'OK',
          onPress: () => navigation.goBack()
        }]);
        return;
      }
      setPatient(resolvedPatient);
      if (!skipInitialActiveReferralCheck) {
        const existingReferrals = await syncService.getDeliveryReferrals();
        const activeReferrals = Array.isArray(existingReferrals) ? existingReferrals : existingReferrals?.items || [];
        const patientReferrals = activeReferrals.filter(ref => String(ref?.pregnant_woman_id) === String(resolvedPatient.id));
        const activeReferral = patientReferrals.find(ref => ['pending', 'accepted', 're_referred'].includes(ref?.status?.toLowerCase()));
        if (activeReferral) {
          Alert.alert(t('error'), t('activeDeliveryReferralAlreadyExists'), [{
            text: t('cancel'),
            onPress: () => navigation.goBack(),
            style: 'cancel'
          }, {
            text: t('viewReferral'),
            onPress: () => navigation.replace('ReferralDetail', {
              referralId: activeReferral.id,
              referralData: activeReferral
            })
          }]);
          return;
        }
      }
      const deliveryPointData = await loadDeliveryPoints(storedUser, resolvedPatient);
      if (storedUser?.role === 'dp' && resolvedCurrentDPId && !selectedDP) {
        const matchedCurrentDP = deliveryPointData.find(dp => {
          const dpId = dp?.id ?? dp?.dp_id;
          return dpId !== undefined && dpId !== null && String(dpId) === String(resolvedCurrentDPId);
        });
        if (matchedCurrentDP) {
          setSelectedDP(matchedCurrentDP.id ?? matchedCurrentDP.dp_id);
        }
      }
    } catch (error) {
      Alert.alert(t('error'), error?.message || 'Failed to load referral screen.');
    } finally {
      setLoading(false);
    }
  };
  const loadDeliveryPoints = async (resolvedUserInfo, resolvedPatient) => {
    try {
      const isSubCentreUser = resolvedUserInfo?.role === 'sub_centre';
      const isDPUser = resolvedUserInfo?.role === 'dp';
      const blockId = resolvedUserInfo?.block_id || resolvedUserInfo?.block?.id || resolvedPatient?.block_id || resolvedPatient?.block?.id;
      const districtId = resolvedUserInfo?.district_id || resolvedUserInfo?.district?.id || resolvedPatient?.district_id || resolvedPatient?.district?.id;
      let data = [];
      if (isSubCentreUser || isDPUser) {
        data = await syncService.getDeliveryPoints();
      } else if (blockId) {
        data = await syncService.getDeliveryPoints({
          block_id: blockId
        });
      }
      if ((!Array.isArray(data) || data.length === 0) && !isSubCentreUser && districtId) {
        data = await syncService.getDeliveryPoints({
          district_id: districtId
        });
      }
      if (!Array.isArray(data) || data.length === 0) {
        data = await syncService.getDeliveryPoints();
      }
      const normalizedDeliveryPoints = Array.isArray(data) ? data : [];
      setDeliveryPoints(normalizedDeliveryPoints);
      return normalizedDeliveryPoints;
    } catch (error) {
      setDeliveryPoints([]);
      return [];
    }
  };
  const filteredDeliveryPoints = useMemo(() => deliveryPoints.filter(dp => {
    const name = String(dp?.name || '').toLowerCase();
    const address = String(dp?.address || '').toLowerCase();
    const query = dpSearchQuery.toLowerCase();
    return name.includes(query) || address.includes(query);
  }), [deliveryPoints, dpSearchQuery]);
  const selectedDeliveryPoint = useMemo(() => deliveryPoints.find(dp => String(dp?.id ?? dp?.dp_id) === String(selectedDP)) || null, [deliveryPoints, selectedDP]);
  const handleGoHome = () => {
    const roleRouteMap = {
      dp: 'DPDashboard',
      sub_centre: 'SubCentreDashboard',
      district: 'DistrictDashboard',
      block: 'BlockDashboard',
      usg_centre: 'USGDashboard',
      mother: 'MotherDashboard'
    };
    navigation.navigate(roleRouteMap[userInfo?.role] || 'SubCentreDashboard');
  };
  const handleSubmitReferral = async () => {
    if (!selectedDP) {
      Alert.alert(t('error'), t('selectDeliveryPointRequired'));
      return;
    }
    if (!observationNotes.trim()) {
      Alert.alert(t('error'), t('observationNotesRequired'));
      return;
    }
    try {
      setSubmitting(true);
      const currentPatientId = patient?.id || patientIdFromRoute;
      if (!currentPatientId) {
        Alert.alert(t('error'), t('patientInfoUnavailableRefresh'));
        return;
      }
      if (typeof currentPatientId === 'string' && currentPatientId.trim().toLowerCase().startsWith('offline_')) {
        Alert.alert(t('error'), t('syncBeneficiaryBeforeReferral'));
        return;
      }
      const existingReferrals = await syncService.getDeliveryReferrals();
      const activeReferrals = Array.isArray(existingReferrals) ? existingReferrals : existingReferrals?.items || [];
      const patientReferrals = activeReferrals.filter(ref => String(ref?.pregnant_woman_id) === String(currentPatientId));
      const hasActiveReferral = patientReferrals.find(ref => ['pending', 'accepted', 're_referred'].includes(ref?.status?.toLowerCase()));
      if (hasActiveReferral) {
        Alert.alert(t('error'), t('activeReferralCreatedWhileEditing'));
        return;
      }
      const referralData = {
        pregnant_woman_id: currentPatientId,
        dp_id: selectedDP,
        observation_notes: observationNotes.trim()
      };
      const currentlyOnline = await syncService.isOnline();
      if (currentlyOnline) {
        const {
          deliveryReferralAPI
        } = await import('../../services/api');
        await deliveryReferralAPI.create(referralData);
      } else {
        await syncService.saveOfflineDeliveryReferral({
          ...referralData,
          id: `offline_delivery_referral_${Date.now()}`,
          status: 'pending',
          sync_status: 'pending',
          created_offline: true,
          created_at: new Date().toISOString(),
          dp_name: deliveryPoints.find(dp => String(dp.id) === String(selectedDP))?.name || null
        });
      }
      Alert.alert(t('success'), currentlyOnline ? t('deliveryReferralCreatedSuccessfully') : t('deliveryReferralSavedOffline'), [{
        text: 'OK',
        onPress: () => navigation.goBack()
      }]);
    } catch (error) {
      const errorStatus = error?.response?.status;
      const errorDetail = error?.response?.data?.detail;
      const errorMessage = errorDetail || error?.response?.data?.message || 'Failed to create delivery referral. Please try again.';
      if (errorStatus === 409 && typeof errorDetail === 'string' && errorDetail.toLowerCase().includes('active referral')) {
        Alert.alert(t('error'), t('activeDeliveryReferralAlreadyExists'));
        return;
      }
      Alert.alert(t('error'), errorMessage);
    } finally {
      setSubmitting(false);
    }
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
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={20} color="white" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{t('createDeliveryReferral')}</Text>
            <Text style={styles.headerSubtitle}>{t('deliveryReferralHeader')}</Text>
          </View>
          <TouchableOpacity style={styles.headerButton} onPress={handleGoHome}>
            <Home size={20} color="white" />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} showsVerticalScrollIndicator={false}>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t('patientInformation')}</Text>
              <View style={styles.patientInfoSection}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('name')}:</Text>
                  <Text style={styles.infoValue}>{patient?.full_name || 'N/A'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('age')}:</Text>
                  <Text style={styles.infoValue}>{patient?.age || 'N/A'} {t('years')}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('mobile')}:</Text>
                  <Text style={styles.infoValue}>{patient?.mobile_number || 'N/A'}</Text>
                </View>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formLabel}>{t('selectDeliveryPointRequiredLabel')}</Text>
                {currentDPDisplayName ? <Text style={styles.formHelperText}>
                    {t('currentDeliveryPointLabel', {
                  name: currentDPDisplayName
                })}
                  </Text> : null}

                <TouchableOpacity style={styles.selectorButton} onPress={() => setShowDPModal(true)} activeOpacity={0.7}>
                  <View style={styles.selectorContent}>
                    <Text style={styles.selectorLabel}>Selected DP Referral</Text>
                    <Text style={[styles.selectorValue, !selectedDeliveryPoint && styles.selectorPlaceholder]}>
                      {selectedDeliveryPoint?.name || 'Select DP referral'}
                    </Text>
                    {selectedDeliveryPoint?.address ? <Text style={styles.selectorSubtext}>{selectedDeliveryPoint.address}</Text> : null}
                  </View>
                  <ChevronDown size={20} color="#8B4513" />
                </TouchableOpacity>
                <Text style={styles.selectorHint}>
                  {deliveryPoints.length > 0 ? `${deliveryPoints.length} DP referral option${deliveryPoints.length > 1 ? 's' : ''} available` : t('noDeliveryPointsAvailable')}
                </Text>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formLabel}>{t('observationNotesRequiredLabel')}</Text>
                <TextInput style={styles.textArea} placeholder={t('observationNotesPlaceholder')} placeholderTextColor="#9ca3af" value={observationNotes} onChangeText={setObservationNotes} multiline numberOfLines={5} textAlignVertical="top" />
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()} disabled={submitting}>
              <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.submitButton, (!isReferralFormValid || submitting) && styles.submitButtonDisabled]} onPress={handleSubmitReferral} disabled={!isReferralFormValid || submitting}>
              {submitting ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.submitButtonText}>{t('createReferralButton')}</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
        <KeyboardSafeModal visible={showDPModal} position="center" onRequestClose={() => setShowDPModal(false)} closeOnBackdropPress={true} contentStyle={styles.modalCard}>
          <Text style={styles.modalTitle}>{t('selectDeliveryPointRequiredLabel')}</Text>
          <View style={styles.searchInputContainer}>
            <Search size={18} color="#6b7280" style={styles.searchIcon} />
            <TextInput style={styles.searchInput} placeholder={t('searchDeliveryPoints')} placeholderTextColor="#9ca3af" value={dpSearchQuery} onChangeText={setDpSearchQuery} returnKeyType="search" autoCorrect={false} autoCapitalize="none" />
          </View>
          <ScrollView style={styles.dpListModal} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {filteredDeliveryPoints.length === 0 ? <Text style={styles.noDPText}>
                {dpSearchQuery ? t('noDeliveryPointsMatchSearch') : t('noDeliveryPointsAvailable')}
              </Text> : filteredDeliveryPoints.map(dp => {
            const dpId = dp.id ?? dp.dp_id;
            const isSelected = String(selectedDP) === String(dpId);
            return <TouchableOpacity key={dpId} style={[styles.dpItem, isSelected && styles.dpItemSelected]} onPress={() => {
              setSelectedDP(dpId);
              setShowDPModal(false);
            }} activeOpacity={0.7}>
                    <View style={[styles.radioButton, isSelected && styles.radioButtonSelected]}>
                      {isSelected ? <View style={styles.radioButtonInner} /> : null}
                    </View>
                    <View style={styles.dpInfo}>
                      <Text style={styles.dpName}>{dp.name}</Text>
                      {dp.address ? <Text style={styles.dpAddress}>{dp.address}</Text> : null}
                    </View>
                  </TouchableOpacity>;
          })}
          </ScrollView>
          <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowDPModal(false)}>
            <Text style={styles.modalCloseButtonText}>{t('cancel')}</Text>
          </TouchableOpacity>
        </KeyboardSafeModal>
      </SafeAreaView>
    </SafeAreaProvider>;
};
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  keyboardAvoidingView: {
    flex: 1
  },
  header: {
    backgroundColor: '#D2691E',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerInfo: {
    flex: 1
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700'
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    marginTop: 2
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12
  },
  patientInfoSection: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8
  },
  infoLabel: {
    width: 80,
    fontSize: 14,
    color: '#6b7280'
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827'
  },
  formSection: {
    marginBottom: 20
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10
  },
  formHelperText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 10
  },
  selectorButton: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#f9fafb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  selectorContent: {
    flex: 1,
    paddingRight: 12
  },
  selectorLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4
  },
  selectorValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827'
  },
  selectorPlaceholder: {
    color: '#9ca3af',
    fontWeight: '500'
  },
  selectorSubtext: {
    marginTop: 4,
    fontSize: 12,
    color: '#6b7280'
  },
  selectorHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#6b7280'
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12
  },
  searchIcon: {
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    padding: 0
  },
  dpList: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 8
  },
  dpListModal: {
    maxHeight: 360,
    marginTop: 4
  },
  noDPText: {
    textAlign: 'center',
    color: '#6b7280',
    padding: 20
  },
  dpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ebe7e5'
  },
  dpItemSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6'
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  radioButtonSelected: {
    borderColor: '#3b82f6'
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b82f6'
  },
  dpInfo: {
    flex: 1
  },
  dpName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827'
  },
  dpAddress: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 120,
    backgroundColor: 'white'
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: 'white'
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center'
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151'
  },
  submitButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#dc2626',
    alignItems: 'center'
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af'
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    padding: 16
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 14
  },
  modalCloseButton: {
    marginTop: 14,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    alignItems: 'center'
  },
  modalCloseButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151'
  }
});
export default CreateDeliveryReferralScreen;
