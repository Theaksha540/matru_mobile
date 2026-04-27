import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Calendar, ChevronDown, Check, X, Home, WifiOff } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { pregnantWomenAPI, adminAPI } from '../../services/api';
import { syncService } from '../../utils/syncService';
import { offlineDB } from '../../utils/offlineDatabase';
import { secureStorage } from '../../utils/secureStorage';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import KeyboardSafeModal from '../../components/KeyboardSafeModal';
import { formatDateDDMMYYYY } from '../../utils/dateFormat';
import { useTranslation } from 'react-i18next';

const riskFactorsOptions = [
  'Diabetes',
  'Hypertension',
  'Heart Disease',
  'Thyroid Disorder',
  'Asthma',
  'Anemia',
  'Previous C-section',
  'Multiple Pregnancy',
  'Age > 35',
  'Age < 18',
  'HIV Positive',
  'History of Miscarriage',
];

const bloodGroupOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const BeneficiaryEditScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const isOnline = useNetworkStatus();
  const { patientId } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState(null);
  const [editedData, setEditedData] = useState({});
  const [districtName, setDistrictName] = useState('');
  const [blockName, setBlockName] = useState('');
  const [wardName, setWardName] = useState('');
  const [subCentreName, setSubCentreName] = useState('');
  const [selectedRiskFactors, setSelectedRiskFactors] = useState([]);
  const [userInfo, setUserInfo] = useState(null);

  const [showDobPicker, setShowDobPicker] = useState(false);
  const [showLmpPicker, setShowLmpPicker] = useState(false);
  const [showEddPicker, setShowEddPicker] = useState(false);
  const [showRiskFactorsModal, setShowRiskFactorsModal] = useState(false);
  const [showBloodGroupModal, setShowBloodGroupModal] = useState(false);

  const currentDateOfBirth = editedData?.date_of_birth || patient?.date_of_birth || '';

  const handleGoHome = () => {
    const roleRouteMap = {
      dp: 'DPDashboard',
      sub_centre: 'SubCentreDashboard',
      district: 'DistrictDashboard',
      block: 'BlockDashboard',
      usg_centre: 'USGDashboard',
      mother: 'MotherDashboard',
    };
    const dashboardRoute = roleRouteMap[userInfo?.role] || 'SubCentreDashboard';
    navigation.navigate(dashboardRoute);
  };


  useEffect(() => {
    loadUserInfo();
    loadPatientDetails();
  }, [patientId]);

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

  const loadPatientDetails = async () => {
    try {
      setLoading(true);
      const data = await syncService.getPatientById(patientId);
      setPatient(data);
      setEditedData(data || {});

      const factors = data?.risk_factors
        ? data.risk_factors.split(',').map((f) => f.trim()).filter(Boolean)
        : [];
      setSelectedRiskFactors(factors);

      // Load district name - wrapped in try-catch
      if (data?.district_id) {
        try {
          const districts = await syncService.getDistricts();
          const district = districts.find((d) => d.id === data.district_id);
          setDistrictName(district?.name || data.district_id);
        } catch (error) {
          console.log('Failed to load district name:', error.message);
          setDistrictName(data.district_id || 'N/A');
        }
      }
      
      // Load block name - wrapped in try-catch
      if (data?.block_id) {
        try {
          const blocks = await syncService.getBlocks();
          const block = blocks.find((b) => b.id === data.block_id);
          setBlockName(block?.name || data.block_id);
        } catch (error) {
          console.log('Failed to load block name:', error.message);
          setBlockName(data.block_id || 'N/A');
        }
      }
      
      // Load ward name - wrapped in try-catch
      if (data?.ward_id && data?.block_id) {
        try {
          const wards = await syncService.getWards(data.block_id);
          const ward = wards.find((w) => w.id === data.ward_id);
          setWardName(ward?.name || data.ward_id);
        } catch (error) {
          console.log('Failed to load ward name:', error.message);
          setWardName(data.ward_id || 'N/A');
        }
      }
      
      // Load sub-centre name - wrapped in try-catch
      if (data?.sub_centre_id) {
        try {
          const subCentres = await adminAPI.getSubCentres();
          const subCentre = subCentres.find((s) => s.id === data.sub_centre_id);
          setSubCentreName(subCentre?.name || data.sub_centre_id);
        } catch (error) {
          console.log('Failed to load sub-centre name:', error.message);
          setSubCentreName(data.sub_centre_id || 'N/A');
        }
      }
    } catch (error) {
      console.error('Error loading beneficiary details:', error);
      Alert.alert(
        t('warning'),
        'Some details could not be loaded, but you can still edit the beneficiary.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const calculateAgeFromDate = (selectedDate) => {
    const today = new Date();
    const birthDate = new Date(selectedDate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  };

  const handleDateChange = (field, event, selectedDate) => {
    if (field === 'date_of_birth') setShowDobPicker(false);
    if (field === 'lmp_date') setShowLmpPicker(false);
    if (field === 'edd_date') setShowEddPicker(false);

    if (event.type === 'set' && selectedDate) {
      const formattedDate = selectedDate.toISOString().split('T')[0];

      if (field === 'date_of_birth') {
        const age = calculateAgeFromDate(selectedDate);
        setEditedData((prev) => ({
          ...prev,
          date_of_birth: formattedDate,
          age: age >= 0 ? String(age) : '',
        }));
        return;
      }

      if (field === 'lmp_date') {
        const eddDate = new Date(selectedDate);
        eddDate.setDate(eddDate.getDate() + 280);
        const formattedEdd = eddDate.toISOString().split('T')[0];

        setEditedData((prev) => ({
          ...prev,
          lmp_date: formattedDate,
          edd_date: formattedEdd,
        }));
        return;
      }

      setEditedData((prev) => ({ ...prev, [field]: formattedDate }));
    }
  };

  const handleRiskFactorToggle = (factor) => {
    setSelectedRiskFactors((prev) => {
      if (prev.includes(factor)) {
        return prev.filter((item) => item !== factor);
      }
      return [...prev, factor];
    });
  };

  const validateData = () => {
    const missing = [];
    const invalid = [];
    const isEmpty = (value) =>
      value === null ||
      value === undefined ||
      String(value).trim() === '' ||
      String(value).trim().toLowerCase() === 'n/a';

    if (isEmpty(editedData?.full_name)) missing.push('Full Name');
    if (isEmpty(editedData?.husband_name)) missing.push('Husband Name');
    if (isEmpty(editedData?.mobile_number)) missing.push('Mobile Number');
    if (isEmpty(editedData?.age)) missing.push('Age');
    if (isEmpty(editedData?.address)) missing.push('Address');
    if (isEmpty(editedData?.date_of_birth)) missing.push('Date of Birth');
    if (isEmpty(editedData?.lmp_date)) missing.push('LMP Date');
    if (isEmpty(editedData?.edd_date)) missing.push('EDD Date');
    if (isEmpty(editedData?.block_id)) missing.push('Block');

    const mobileDigits = String(editedData.mobile_number || '').replace(/\D/g, '');
    if (!isEmpty(editedData?.mobile_number) && mobileDigits.length !== 10) {
      invalid.push('Mobile Number must be 10 digits');
    }

    const age = parseInt(editedData.age, 10);
    if (Number.isNaN(age) || age < 18 || age > 49) {
      invalid.push('Age must be between 18 and 49');
    }

    if (missing.length || invalid.length) {
      const missingText = missing.length ? `Missing:\n• ${missing.join('\n• ')}` : '';
      const invalidText = invalid.length ? `Invalid:\n• ${invalid.join('\n• ')}` : '';
      Alert.alert(t('completeRequiredDetails'), [missingText, invalidText].filter(Boolean).join('\n\n'));
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!patient) return;
    if (!validateData()) return;

    try {
      setSaving(true);
      const updateData = {};

      Object.keys(editedData).forEach((key) => {
        if (editedData[key] !== patient[key]) {
          updateData[key] = editedData[key];
        }
      });

      if (editedData?.is_high_risk) {
        updateData.risk_factors = selectedRiskFactors.join(', ');
        updateData.is_high_risk = true;
      } else {
        updateData.risk_factors = '';
        updateData.is_high_risk = false;
      }

      if (Object.keys(updateData).length === 0) {
        Alert.alert(t('info'), t('noChangesToSave'));
        return;
      }

      // Create full updated patient object
      const updatedPatient = {
        ...patient,
        ...editedData,
        risk_factors: editedData?.is_high_risk ? selectedRiskFactors.join(', ') : '',
        is_high_risk: !!editedData?.is_high_risk
      };

      // Check network status
      if (!isOnline) {
        console.log('[BENEFICIARY-EDIT] Offline mode - saving to local cache');
        
        // Update patient in main cache
        const allPatients = await offlineDB.getPatients();
        const updatedPatients = allPatients.map(p => 
          p.id === patientId ? updatedPatient : p
        );
        await offlineDB.savePatients(updatedPatients);
        console.log('[BENEFICIARY-EDIT] Updated patient in cache');
        
        // Queue update for sync
        await syncService.saveOfflinePatientUpdate(patientId, updatedPatient);
        console.log('[BENEFICIARY-EDIT] Queued update for sync');
        
        Alert.alert(
          t('saved'),
          'Changes saved offline. Will sync when online.',
          [{ text: t('ok'), onPress: () => navigation.goBack() }]
        );
        return;
      }

      // Online mode - update via API
      console.log('[BENEFICIARY-EDIT] Online mode - updating via API');
      await pregnantWomenAPI.update(patientId, updateData);
      console.log('[BENEFICIARY-EDIT] API update successful');
      
      // Update local cache in background
      setTimeout(async () => {
        try {
          const allPatients = await offlineDB.getPatients();
          const updatedPatients = allPatients.map(p => 
            p.id === patientId ? updatedPatient : p
          );
          await offlineDB.savePatients(updatedPatients);
          console.log('[BENEFICIARY-EDIT] Updated cache after API success');
        } catch (cacheError) {
          console.error('[BENEFICIARY-EDIT] Failed to update cache:', cacheError);
        }
      }, 0);
      
      Alert.alert(t('success'), t('beneficiaryDetailsUpdatedSuccessfully'), [
        { text: t('ok'), onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('[BENEFICIARY-EDIT] Error updating beneficiary:', error);
      Alert.alert(t('error'), t('failedToUpdateBeneficiaryDetails'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <Text style={styles.loadingText}>{t('loading')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('editBeneficiary')}</Text>
        <TouchableOpacity onPress={handleGoHome} style={styles.homeButton}>
          <Home size={24} color="white" />
        </TouchableOpacity>
      </View>

      {!isOnline && (
        <View style={styles.offlineBanner}>
          <WifiOff size={16} color="#dc2626" />
          <Text style={styles.offlineBannerText}>
            Offline Mode - Changes will sync when online
          </Text>
        </View>
      )}

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('personalInformation')}</Text>

          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('fullName')}:</Text>
            <TextInput
              style={styles.input}
              value={editedData?.full_name || ''}
              onChangeText={(text) => setEditedData((prev) => ({ ...prev, full_name: text }))}
              placeholder={t('enterFullName')}
            />
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('husbandName')}:</Text>
            <TextInput
              style={styles.input}
              value={editedData?.husband_name || ''}
              onChangeText={(text) => setEditedData((prev) => ({ ...prev, husband_name: text }))}
              placeholder={t('enterHusbandName')}
            />
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('mobile')}:</Text>
            <TextInput
              style={styles.input}
              value={editedData?.mobile_number || ''}
              onChangeText={(text) =>
                setEditedData((prev) => ({
                  ...prev,
                  mobile_number: text.replace(/[^0-9]/g, '').slice(0, 10),
                }))
              }
              placeholder={t('enterMobileNumber')}
              keyboardType="numeric"
              maxLength={10}
            />
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('age')}:</Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput]}
              value={String(editedData?.age ?? '')}
              placeholder="Auto-calculated from DOB"
              editable={false}
            />
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('dateOfBirth')}:</Text>
            <View style={styles.datePickerContainer}>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowDobPicker(true)}>
                <Text style={styles.dateButtonText}>
                  {currentDateOfBirth
                    ? formatDateDDMMYYYY(currentDateOfBirth)
                    : t('selectDateDashFormat')}
                </Text>
                <Calendar size={16} color="#D2691E" />
              </TouchableOpacity>
              {showDobPicker && (
                <DateTimePicker
                  value={currentDateOfBirth ? new Date(currentDateOfBirth) : new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, date) => handleDateChange('date_of_birth', event, date)}
                  maximumDate={new Date()}
                />
              )}
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('aadhaarNumber')}:</Text>
            <Text style={styles.value}>{editedData?.aadhaar_masked || patient?.aadhaar_masked || 'N/A'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('address')}:</Text>
            <TextInput
              style={styles.input}
              value={editedData?.address || ''}
              onChangeText={(text) => setEditedData((prev) => ({ ...prev, address: text }))}
              placeholder={t('enterAddress')}
            />
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('abhaId')}:</Text>
            <TextInput
              style={styles.input}
              value={editedData?.abha_id || ''}
              onChangeText={(text) => setEditedData((prev) => ({ ...prev, abha_id: text }))}
              placeholder={t('enterABHAID')}
            />
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('rchId')}:</Text>
            <TextInput
              style={styles.input}
              value={editedData?.rch_id || ''}
              onChangeText={(text) => setEditedData((prev) => ({ ...prev, rch_id: text }))}
              placeholder={t('enterRCHID')}
            />
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('hprId')}:</Text>
            <TextInput
              style={styles.input}
              value={editedData?.hpr_id || ''}
              onChangeText={(text) => setEditedData((prev) => ({ ...prev, hpr_id: text }))}
              placeholder={t('enterHPRID')}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('medicalInformation')}</Text>

          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('lmpDate')} *</Text>
            <View style={styles.datePickerContainer}>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowLmpPicker(true)}>
                <Text style={styles.dateButtonText}>
                  {editedData?.lmp_date
                    ? formatDateDDMMYYYY(editedData.lmp_date)
                    : t('selectDateDashFormat')}
                </Text>
                <Calendar size={16} color="#D2691E" />
              </TouchableOpacity>
              {showLmpPicker && (
                <DateTimePicker
                  value={editedData?.lmp_date ? new Date(editedData.lmp_date) : new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, date) => handleDateChange('lmp_date', event, date)}
                  maximumDate={new Date()}
                />
              )}
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('eddDate')}:</Text>
            <View style={styles.datePickerContainer}>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowEddPicker(true)}>
                <Text style={styles.dateButtonText}>
                  {editedData?.edd_date
                    ? formatDateDDMMYYYY(editedData.edd_date)
                    : t('selectDateDashFormat')}
                </Text>
                <Calendar size={16} color="#D2691E" />
              </TouchableOpacity>
              {showEddPicker && (
                <DateTimePicker
                  value={editedData?.edd_date ? new Date(editedData.edd_date) : new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, date) => handleDateChange('edd_date', event, date)}
                />
              )}
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('gravida')}:</Text>
            <TextInput
              style={styles.input}
              value={String(editedData?.gravida ?? '')}
              onChangeText={(text) =>
                setEditedData((prev) => ({
                  ...prev,
                  gravida: text.replace(/[^0-9]/g, '').slice(0, 2),
                }))
              }
              placeholder={t('enterGravida')}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('para')}:</Text>
            <TextInput
              style={styles.input}
              value={String(editedData?.para ?? '')}
              onChangeText={(text) =>
                setEditedData((prev) => ({
                  ...prev,
                  para: text.replace(/[^0-9]/g, '').slice(0, 2),
                }))
              }
              placeholder={t('enterPara')}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('bloodGroup')} *</Text>
            <View style={{ flex: 1 }}>
              <TouchableOpacity style={styles.selectorButton} onPress={() => setShowBloodGroupModal(true)}>
                <Text style={styles.selectorButtonText}>{editedData?.blood_group || t('selectBloodGroup')}</Text>
                <ChevronDown size={16} color="#6b7280" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('highRisk')}:</Text>
            <TouchableOpacity
              style={styles.highRiskToggle}
              onPress={() => setEditedData((prev) => ({ ...prev, is_high_risk: !prev.is_high_risk }))}
            >
              <View style={[styles.toggleSwitch, editedData?.is_high_risk && styles.toggleSwitchActive]}>
                <View style={styles.toggleCircle} />
              </View>
              <Text style={styles.value}>{editedData?.is_high_risk ? t('yes') : t('no')}</Text>
            </TouchableOpacity>
          </View>

          {editedData?.is_high_risk && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>{t('riskFactors')}:</Text>
              <View style={{ flex: 1 }}>
                <TouchableOpacity style={styles.selectorButton} onPress={() => setShowRiskFactorsModal(true)}>
                  <Text style={styles.selectorButtonText}>
                    {selectedRiskFactors.length > 0
                      ? `${selectedRiskFactors.length} ${t('riskFactorsSelected')}`
                      : t('selectRiskFactors')}
                  </Text>
                  <ChevronDown size={16} color="#6b7280" />
                </TouchableOpacity>
                {selectedRiskFactors.length > 0 && (
                  <Text style={styles.selectedRiskText}>{selectedRiskFactors.join(', ')}</Text>
                )}
              </View>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('administrative')}</Text>
          <View style={styles.adminInfoRow}>
            <Text style={styles.adminLabel}>{t('district')}:</Text>
            <Text style={styles.adminValue}>{districtName || 'N/A'}</Text>
          </View>
          <View style={styles.adminInfoRow}>
            <Text style={styles.adminLabel}>{t('block')}:</Text>
            <Text style={styles.adminValue}>{blockName || 'N/A'}</Text>
          </View>
          <View style={styles.adminInfoRow}>
            <Text style={styles.adminLabel}>{t('ward')}:</Text>
            <Text style={styles.adminValue}>{wardName || 'N/A'}</Text>
          </View>
          <View style={styles.adminInfoRow}>
            <Text style={styles.adminLabel}>{t('subCentre')}:</Text>
            <Text style={styles.adminValue}>{subCentreName || 'N/A'}</Text>
          </View>
          <View style={styles.adminInfoRow}>
            <Text style={styles.adminLabel}>{t('registrationDate')}:</Text>
            <Text style={styles.adminValue}>{formatDateDDMMYYYY(patient?.pregnancy_registration_date)}</Text>
          </View>
          <View style={styles.adminInfoRow}>
            <Text style={styles.adminLabel}>{t('selfRegistered')}:</Text>
            <Text style={styles.adminValue}>{patient?.is_self_registered ? t('yes') : t('no')}</Text>
          </View>
          <View style={styles.adminInfoRow}>
            <Text style={styles.adminLabel}>{t('createdAt')}:</Text>
            <Text style={styles.adminValue}>{formatDateDDMMYYYY(patient?.created_at)}</Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? t('saving') : t('saveChanges')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <KeyboardSafeModal
        visible={showRiskFactorsModal}
        position="center"
        onRequestClose={() => setShowRiskFactorsModal(false)}
        closeOnBackdropPress={false}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t('selectRiskFactorsTitle')}</Text>
          <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowRiskFactorsModal(false)}>
            <X size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <ScrollView style={{ maxHeight: 400 }} keyboardShouldPersistTaps="handled">
          {riskFactorsOptions.map((factor) => (
            <TouchableOpacity
              key={factor}
              style={[styles.modalOption, selectedRiskFactors.includes(factor) && styles.modalOptionSelected]}
              onPress={() => handleRiskFactorToggle(factor)}
            >
              <Text
                style={[
                  styles.modalOptionText,
                  selectedRiskFactors.includes(factor) && styles.modalOptionTextSelected,
                ]}
              >
                {factor}
              </Text>
              {selectedRiskFactors.includes(factor) && <Check size={18} color="#10B981" />}
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.modalDoneButton} onPress={() => setShowRiskFactorsModal(false)}>
            <Text style={styles.modalDoneButtonText}>{t('done')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardSafeModal>

      <KeyboardSafeModal
        visible={showBloodGroupModal}
        position="center"
        onRequestClose={() => setShowBloodGroupModal(false)}
        closeOnBackdropPress={true}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t('selectBloodGroup')}</Text>
          <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowBloodGroupModal(false)}>
            <X size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <ScrollView style={{ maxHeight: 400 }} keyboardShouldPersistTaps="handled">
          {bloodGroupOptions.map((group) => (
            <TouchableOpacity
              key={group}
              style={[styles.modalOption, editedData?.blood_group === group && styles.modalOptionSelected]}
              onPress={() => {
                setEditedData((prev) => ({ ...prev, blood_group: group }));
                setShowBloodGroupModal(false);
              }}
            >
              <Text
                style={[
                  styles.modalOptionText,
                  editedData?.blood_group === group && styles.modalOptionTextSelected,
                ]}
              >
                {group}
              </Text>
              {editedData?.blood_group === group && <Check size={18} color="#10B981" />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </KeyboardSafeModal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fad5a5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#D2691E',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  homeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: 'white', flex: 1 },
  content: { flex: 1, padding: 16 },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 12 },
  infoRow: { flexDirection: 'row', marginBottom: 10 },
  label: { width: 120, fontSize: 14, color: '#6b7280', paddingTop: 8 },
  value: { fontSize: 14, color: '#1f2937', fontWeight: '500' },
  adminInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  adminLabel: {
    width: 128,
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    paddingTop: 2,
    paddingRight: 12,
  },
  adminValue: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
    lineHeight: 20,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1f2937',
    backgroundColor: 'white',
  },
  readOnlyInput: { backgroundColor: '#f9fafb', color: '#6b7280' },
  loadingText: { textAlign: 'center', padding: 20, fontSize: 16, color: '#6b7280' },
  datePickerContainer: { flex: 1 },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 38,
  },
  dateButtonText: { fontSize: 14, color: '#1f2937', flex: 1, marginRight: 8 },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 38,
  },
  selectorButtonText: { fontSize: 14, color: '#1f2937', flex: 1, marginRight: 8 },
  highRiskToggle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 8 },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#d1d5db',
    justifyContent: 'center',
    padding: 2,
  },
  toggleSwitchActive: {
    backgroundColor: '#10B981',
    alignItems: 'flex-end',
  },
  toggleCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'white' },
  selectedRiskText: { fontSize: 12, color: '#10B981', marginTop: 6, fontStyle: 'italic' },
  saveButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 24,
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { color: 'white', fontSize: 16, fontWeight: '700' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  modalOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalOptionSelected: { backgroundColor: '#fef3c7' },
  modalOptionText: { fontSize: 16, color: '#374151' },
  modalOptionTextSelected: { color: '#92400e', fontWeight: '500' },
  modalFooter: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  modalDoneButton: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#D2691E',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    width: '40%',
    alignSelf: 'center',
  },
  modalDoneButtonText: { fontSize: 18, fontWeight: '600', color: 'white' },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  offlineBannerText: {
    fontSize: 13,
    color: '#dc2626',
    fontWeight: '500',
  },
});

export default BeneficiaryEditScreen;
