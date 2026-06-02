import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Platform, Modal } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CommonActions } from '@react-navigation/native';
import { ArrowLeft, CheckCircle, User, FileText, AlertCircle, Calendar, Activity, Home } from 'lucide-react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { syncService } from '../../utils/syncService';
import { secureStorage } from '../../utils/secureStorage';
import { authAPI } from '../../services/api';
import { formatDateTimeDDMMYYYY } from '../../utils/dateFormat';
import { useTranslation } from 'react-i18next';
import Footer from '../../components/Footer';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
const createBabyEntry = () => ({
  id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  gender: '',
  status: ''
});
const BABY_STATUS_OPTIONS = [{
  value: 'live_birth',
  label: 'Live Birth'
}, {
  value: 'still_birth',
  label: 'Still Birth'
}, {
  value: 'infant_death',
  label: 'Infant Death'
}];
const formatLocalDateTimeWithoutTimezone = date => {
  const pad = value => String(value).padStart(2, '0');
  return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-') + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};
const RecordOutcomeScreen = ({
  navigation,
  route
}) => {
  const {
    t
  } = useTranslation();
  const isOnline = useNetworkStatus();
  const {
    referralId
  } = route.params || {};
  const [referral, setReferral] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userInfo, setUserInfo] = useState(null);

  // Outcome form data
  const [deliveryDateTime, setDeliveryDateTime] = useState(new Date());
  const [deliveryType, setDeliveryType] = useState('');
  const [remarks, setRemarks] = useState('');
  const [babies, setBabies] = useState([createBabyEntry()]);
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [deliveryTypes, setDeliveryTypes] = useState([]);
  const [loadingDeliveryTypes, setLoadingDeliveryTypes] = useState(false);
  const getDashboardRouteForRole = async () => {
    const roleRouteMap = {
      dp: 'DPDashboard',
      sub_centre: 'SubCentreDashboard',
      district: 'DistrictDashboard',
      block: 'BlockDashboard',
      usg: 'USGDashboard',
      mother: 'MotherDashboard'
    };
    const currentRoutes = navigation.getState()?.routes || [];
    const knownDashboardRoute = [...currentRoutes].reverse().find(route => Object.values(roleRouteMap).includes(route?.name));
    if (knownDashboardRoute?.name) {
      return knownDashboardRoute.name;
    }
    let resolvedUserInfo = userInfo;
    if (!resolvedUserInfo && isOnline) {
      try {
        resolvedUserInfo = await authAPI.getCurrentUser();
        if (resolvedUserInfo) {
          await secureStorage.setItem('user_info', resolvedUserInfo);
          setUserInfo(resolvedUserInfo);
        }
      } catch (error) {}
    }
    if (!resolvedUserInfo) {
      resolvedUserInfo = await secureStorage.getItem('user_info');
    }
    return roleRouteMap[resolvedUserInfo?.role] || 'DPDashboard';
  };
  const handleGoHome = async () => {
    const dashboardRoute = await getDashboardRouteForRole();
    navigation.navigate(dashboardRoute);
  };
  const resetToDeliveryReferrals = async () => {
    const dashboardRoute = await getDashboardRouteForRole();
    navigation.dispatch(CommonActions.reset({
      index: 1,
      routes: [{
        name: dashboardRoute
      }, {
        name: 'DeliveryReferrals',
        params: {
          filter: 'completed',
          referenceId: String(referralId),
          refreshToken: Date.now()
        }
      }]
    }));
  };
  useEffect(() => {
    loadUserInfo();
    if (referralId) {
      loadReferralDetails();
      loadDeliveryTypes();
    } else {
      Alert.alert('Error', 'No referral ID provided');
      navigation.goBack();
    }
  }, [referralId]);
  const loadUserInfo = async () => {
    try {
      const userData = await secureStorage.getItem('user_info');
      if (userData) {
        setUserInfo(userData);
      }
    } catch (error) {}
  };
  const loadDeliveryTypes = async () => {
    try {
      setLoadingDeliveryTypes(true);
      const types = await authAPI.getDeliveryTypes();

      // Transform API response to match our option format
      const formattedTypes = Array.isArray(types) ? types.map(type => ({
        value: type.value || type.code || type.id,
        label: type.label || type.name || type.display_name || type.value
      })) : [];
      setDeliveryTypes(formattedTypes);
    } catch (error) {
      // Fallback to default types if API fails
      setDeliveryTypes([{
        value: 'safe_delivery',
        label: 'Safe Delivery'
      }, {
        value: 'normal_delivery',
        label: 'Normal Delivery'
      }, {
        value: 'cesarean_section',
        label: 'Cesarean Section'
      }, {
        value: 'assisted_delivery',
        label: 'Assisted Delivery'
      }, {
        value: 'emergency_delivery',
        label: 'Emergency Delivery'
      }]);
    } finally {
      setLoadingDeliveryTypes(false);
    }
  };
  const loadReferralDetails = async () => {
    try {
      setLoading(true);
      const referralData = await syncService.getDeliveryReferralById(referralId);
      if (referralData) {
        const flattenedData = {
          ...referralData.referral,
          pregnant_woman_name: referralData.pregnant_woman?.full_name,
          mobile_number: referralData.pregnant_woman?.mobile_number,
          age: referralData.pregnant_woman?.age,
          expected_delivery_date: referralData.pregnant_woman?.edd_date,
          _original: referralData
        };
        setReferral(flattenedData);

        // Set current date and time as default
        setDeliveryDateTime(new Date());
      } else {
        Alert.alert('Error', 'Referral data not found');
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load referral details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };
  const handleDateTimeConfirm = selectedDate => {
    setDeliveryDateTime(selectedDate);
    setShowDateTimePicker(false);
  };
  const handleDateTimeCancel = () => {
    setShowDateTimePicker(false);
  };
  const formatDateTimeForDisplay = date => {
    return formatDateTimeDDMMYYYY(date);
  };
  const validateForm = () => {
    if (!deliveryType) {
      Alert.alert('Validation Error', 'Please select delivery type');
      return false;
    }
    if (!babies.length) {
      Alert.alert('Validation Error', 'Please add at least one baby outcome');
      return false;
    }
    const invalidBaby = babies.find(baby => !baby.gender || !baby.status);
    if (invalidBaby) {
      Alert.alert('Validation Error', 'Please provide gender and status for each baby');
      return false;
    }
    return true;
  };
  const updateBaby = (id, field, value) => {
    setBabies(prev => prev.map(baby => baby.id === id ? {
      ...baby,
      [field]: value
    } : baby));
  };
  const addBaby = () => {
    setBabies(prev => [...prev, createBabyEntry()]);
  };
  const removeBaby = id => {
    setBabies(prev => {
      if (prev.length === 1) {
        return [createBabyEntry()];
      }
      return prev.filter(baby => baby.id !== id);
    });
  };
  const handleSubmitOutcome = async () => {
    if (!validateForm()) return;
    Alert.alert('Confirm Outcome', 'Are you sure you want to record this delivery outcome? This action cannot be undone.', [{
      text: 'Cancel',
      style: 'cancel'
    }, {
      text: 'Record Outcome',
      onPress: async () => {
        try {
          setSubmitting(true);
          const outcomeData = {
            delivery_type: deliveryType,
            delivery_date: formatLocalDateTimeWithoutTimezone(deliveryDateTime),
            babies: babies.map(baby => ({
              gender: baby.gender,
              status: baby.status.trim()
            })),
            remarks: remarks.trim() || null
          };
          const result = await syncService.recordOutcomeDeliveryReferral(referralId, outcomeData);
          Alert.alert('Success', result?.offline ? 'Delivery outcome saved offline and will sync when online.' : 'Delivery outcome recorded successfully', [{
            text: 'OK',
            onPress: () => {
              resetToDeliveryReferrals();
            }
          }]);
        } catch (error) {
          Alert.alert('Error', 'Failed to record delivery outcome. Please try again.');
        } finally {
          setSubmitting(false);
        }
      }
    }]);
  };
  const renderOptionSelector = (title, options, selectedValue, onSelect, isLoading = false) => <View style={styles.selectorContainer}>
      <Text style={styles.selectorLabel}>{title}:</Text>
      {isLoading ? <View style={styles.loadingContainer}>
          <Activity size={20} color="#D2691E" />
          <Text style={styles.loadingText}>Loading options...</Text>
        </View> : <View style={styles.optionsContainer}>
          {options.map(option => <TouchableOpacity key={option.value} style={[styles.optionButton, selectedValue === option.value && styles.optionButtonSelected]} onPress={() => onSelect(option.value)}>
              <Text style={[styles.optionText, selectedValue === option.value && styles.optionTextSelected]}>
                {option.label}
              </Text>
            </TouchableOpacity>)}
        </View>}
    </View>;
  if (loading) {
    return <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centerLoadingContainer}>
            <Activity size={48} color="#D2691E" />
            <Text style={styles.centerLoadingText}>Loading referral details...</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>;
  }
  if (!referral) {
    return <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <AlertCircle size={48} color="#dc2626" />
            <Text style={styles.errorText}>Referral not found</Text>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>;
  }
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
          <TouchableOpacity style={styles.headerBackButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={20} color="white" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Record Outcome</Text>
            <Text style={styles.headerSubtitle}>ଫଳାଫଳ ରେକର୍ଡ କରନ୍ତୁ</Text>
          </View>
          <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
            <Home size={20} color="white" />
          </TouchableOpacity>
        </LinearGradient>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {!isOnline && <View style={styles.offlineInfoBanner}>
              <AlertCircle size={18} color="#0369a1" />
              <Text style={styles.offlineInfoText}>
                Outcome updates are being saved locally and will update the backend when internet returns.
              </Text>
            </View>}
          {/* Patient Information Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <User size={24} color="#D2691E" />
              <Text style={styles.cardTitle}>Patient Information</Text>
            </View>
            <View style={styles.cardContent}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Name:</Text>
                <Text style={styles.infoValue}>{referral.pregnant_woman_name || 'Not specified'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Mobile:</Text>
                <Text style={styles.infoValue}>{referral.mobile_number || 'Not specified'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Age:</Text>
                <Text style={styles.infoValue}>{referral.age || 'Not specified'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Expected Delivery:</Text>
                <Text style={styles.infoValue}>
                  {referral.expected_delivery_date ? new Date(referral.expected_delivery_date).toLocaleDateString('en-IN') : 'Not specified'}
                </Text>
              </View>
            </View>
          </View>

          {/* Delivery Outcome Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Calendar size={24} color="#D2691E" />
              <Text style={styles.cardTitle}>Delivery Outcome</Text>
            </View>
            <View style={styles.cardContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Delivery Date & Time *</Text>
                <TouchableOpacity style={styles.dateTimeInput} onPress={() => setShowDateTimePicker(true)} activeOpacity={0.7}>
                  <Text style={styles.dateTimeText}>
                    {formatDateTimeForDisplay(deliveryDateTime)}
                  </Text>
                </TouchableOpacity>
              </View>

              {renderOptionSelector('Delivery Type', deliveryTypes, deliveryType, setDeliveryType, loadingDeliveryTypes)}
            </View>
          </View>

          {/* Baby Outcome Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Activity size={24} color="#D2691E" />
              <Text style={styles.cardTitle}>Baby Outcome</Text>
            </View>
            <View style={styles.cardContent}>
              {babies.map((baby, index) => <View key={baby.id} style={styles.babyCard}>
                  <View style={styles.babyCardHeader}>
                    <Text style={styles.babyCardTitle}>Baby {index + 1}</Text>
                    {babies.length > 1 && <TouchableOpacity style={styles.removeBabyButton} onPress={() => removeBaby(baby.id)}>
                        <Text style={styles.removeBabyButtonText}>Remove</Text>
                      </TouchableOpacity>}
                  </View>

                  {renderOptionSelector('Gender', [{
                value: 'male',
                label: 'Male'
              }, {
                value: 'female',
                label: 'Female'
              }, {
                value: 'other',
                label: 'Other'
              }], baby.gender, value => updateBaby(baby.id, 'gender', value))}

                  {renderOptionSelector('Baby Status', BABY_STATUS_OPTIONS, baby.status, value => updateBaby(baby.id, 'status', value))}
                </View>)}

              <TouchableOpacity style={styles.addBabyButton} onPress={addBaby}>
                <Text style={styles.addBabyButtonText}>+ Add Another Baby</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Remarks Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <FileText size={24} color="#D2691E" />
              <Text style={styles.cardTitle}>Remarks</Text>
            </View>
            <View style={styles.cardContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Delivery Remarks</Text>
                <TextInput style={styles.textAreaInput} multiline numberOfLines={5} value={remarks} onChangeText={setRemarks} placeholder="Enter any remarks about the delivery outcome, complications, observations, or additional notes..." placeholderTextColor="#9ca3af" textAlignVertical="top" />
              </View>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity style={[styles.submitButton, submitting && styles.submitButtonDisabled]} onPress={handleSubmitOutcome} disabled={submitting}>
            <CheckCircle size={20} color="white" />
            <Text style={styles.submitButtonText}>
              {submitting ? 'Recording...' : 'Record Delivery Outcome'}
            </Text>
          </TouchableOpacity>

          <Footer />
        </ScrollView>

        {/* Date Time Picker Modal - Works on both Android and iOS */}
        <DateTimePickerModal isVisible={showDateTimePicker} mode="datetime" date={deliveryDateTime} onConfirm={handleDateTimeConfirm} onCancel={handleDateTimeCancel} maximumDate={new Date()} is24Hour={true} />
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
  headerBackButton: {
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
  content: {
    flex: 1,
    padding: 16
  },
  centerLoadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  centerLoadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500'
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    color: '#dc2626',
    fontWeight: '600',
    textAlign: 'center'
  },
  backButton: {
    marginTop: 20,
    backgroundColor: '#D2691E',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  offlineInfoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 14,
    marginBottom: 16
  },
  offlineInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#1e3a8a',
    lineHeight: 18
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6'
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 12
  },
  cardContent: {
    padding: 16
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    flex: 1
  },
  infoValue: {
    fontSize: 14,
    color: '#6b7280',
    flex: 2,
    textAlign: 'right'
  },
  inputGroup: {
    marginBottom: 16
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#374151',
    backgroundColor: '#f9fafb'
  },
  dateTimeInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#f9fafb',
    justifyContent: 'center'
  },
  dateTimeText: {
    fontSize: 16,
    color: '#374151'
  },
  textAreaInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#374151',
    backgroundColor: '#f9fafb',
    minHeight: 100
  },
  selectorContainer: {
    marginBottom: 16
  },
  babyCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  babyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  babyCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827'
  },
  removeBabyButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fee2e2',
    borderRadius: 8
  },
  removeBabyButtonText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '700'
  },
  addBabyButton: {
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D2691E',
    backgroundColor: '#fff7ed',
    alignItems: 'center'
  },
  addBabyButtonText: {
    color: '#D2691E',
    fontSize: 14,
    fontWeight: '700'
  },
  selectorLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb'
  },
  optionButtonSelected: {
    backgroundColor: '#D2691E',
    borderColor: '#D2691E'
  },
  optionText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500'
  },
  optionTextSelected: {
    color: 'white',
    fontWeight: '600'
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 8
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500'
  },
  submitButton: {
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 12,
    marginTop: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0,
    elevation: 0
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700'
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)'
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb'
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827'
  },
  modalButton: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500'
  },
  modalButtonDone: {
    color: '#D2691E',
    fontWeight: '600'
  },
  iosDatePicker: {
    height: 200,
    backgroundColor: 'white'
  }
});
export default RecordOutcomeScreen;
