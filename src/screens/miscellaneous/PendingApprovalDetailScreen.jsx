import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, TextInput, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Check, X, Edit, Calendar, ChevronDown, Home } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { pregnantWomenAPI, adminAPI } from '../../services/api';
import { syncService } from '../../utils/syncService';
import { offlineDB } from '../../utils/offlineDatabase';
import { secureStorage } from '../../utils/secureStorage';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import KeyboardSafeModal from '../../components/KeyboardSafeModal';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../../utils/dateFormat';
import { useTranslation } from 'react-i18next';
const PendingApprovalDetailScreen = ({
  route,
  navigation
}) => {
  const {
    t
  } = useTranslation();
  const {
    patientId
  } = route.params;
  const isOnline = useNetworkStatus();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState({});
  const [districtName, setDistrictName] = useState('');
  const [blockName, setBlockName] = useState('');
  const [wardName, setWardName] = useState('');
  const [subCentreName, setSubCentreName] = useState('');
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [showLmpPicker, setShowLmpPicker] = useState(false);
  const [showEddPicker, setShowEddPicker] = useState(false);
  const [showRiskFactorsModal, setShowRiskFactorsModal] = useState(false);
  const [showBloodGroupModal, setShowBloodGroupModal] = useState(false);
  const [selectedRiskFactors, setSelectedRiskFactors] = useState([]);
  const [userInfo, setUserInfo] = useState(null);
  const riskFactorsOptions = ['Diabetes', 'Hypertension', 'Heart Disease', 'Thyroid Disorder', 'Asthma', 'Anemia', 'Previous C-section', 'Multiple Pregnancy', 'Age > 35', 'Age < 18', 'HIV Positive', 'History of Miscarriage'];
  const bloodGroupOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
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
  useEffect(() => {
    loadUserInfo();
    loadPatientDetails();
  }, []);
  const loadUserInfo = async () => {
    try {
      const userData = await secureStorage.getItem('user_info');
      if (userData) {
        setUserInfo(userData);
      }
    } catch (error) {}
  };
  useEffect(() => {
    // Parse existing risk factors when patient data loads
    if (patient?.risk_factors) {
      const factors = patient.risk_factors.split(',').map(f => f.trim()).filter(f => f);
      setSelectedRiskFactors(factors);
    }
  }, [patient]);
  const loadPatientDetails = async () => {
    try {
      // Use syncService which handles online/offline automatically
      const data = await syncService.getPatientById(patientId);
      if (!data) {
        Alert.alert(t('error'), t('failedToLoadPatientDetails'));
        setLoading(false);
        return;
      }
      setPatient(data);
      setEditedData(data);

      // Fetch names - wrap in try-catch to prevent errors from blocking the UI
      try {
        if (data.district_id) {
          const districts = await syncService.getDistricts();
          const district = districts.find(d => d.id === data.district_id);
          setDistrictName(district?.name || data.district_id);
        }
      } catch (error) {
        setDistrictName(data.district_id || 'N/A');
      }
      try {
        if (data.block_id) {
          const blocks = await syncService.getBlocks();
          const block = blocks.find(b => b.id === data.block_id);
          setBlockName(block?.name || data.block_id);
        }
      } catch (error) {
        setBlockName(data.block_id || 'N/A');
      }
      try {
        if (data.ward_id) {
          const wards = await syncService.getWards(data.block_id);
          const ward = wards.find(w => w.id === data.ward_id);
          setWardName(ward?.name || data.ward_id);
        }
      } catch (error) {
        setWardName(data.ward_id || 'N/A');
      }
      try {
        if (data.sub_centre_id) {
          const subCentres = await adminAPI.getSubCentres();
          const subCentre = subCentres.find(s => s.id === data.sub_centre_id);
          setSubCentreName(subCentre?.name || data.sub_centre_id);
        }
      } catch (error) {
        setSubCentreName(data.sub_centre_id || 'N/A');
      }
    } catch (error) {
      Alert.alert(t('error'), t('failedToLoadPatientDetails'));
    } finally {
      setLoading(false);
    }
  };
  const handleRiskFactorToggle = factor => {
    if (selectedRiskFactors.includes(factor)) {
      setSelectedRiskFactors(selectedRiskFactors.filter(f => f !== factor));
    } else {
      setSelectedRiskFactors([...selectedRiskFactors, factor]);
    }
  };
  const calculateAgeFromDate = selectedDate => {
    const today = new Date();
    const birthDate = new Date(selectedDate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || monthDiff === 0 && today.getDate() < birthDate.getDate()) {
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
        setEditedData({
          ...editedData,
          date_of_birth: formattedDate,
          age: age >= 0 ? String(age) : ''
        });
        return;
      }
      if (field === 'lmp_date') {
        const eddDate = new Date(selectedDate);
        eddDate.setDate(eddDate.getDate() + 280);
        const formattedEdd = eddDate.toISOString().split('T')[0];
        setEditedData({
          ...editedData,
          lmp_date: formattedDate,
          edd_date: formattedEdd
        });
        return;
      }
      setEditedData({
        ...editedData,
        [field]: formattedDate
      });
    }
  };
  const handleStartEdit = () => {
    setEditedData(patient || {});
    const factors = patient?.risk_factors ? patient.risk_factors.split(',').map(f => f.trim()).filter(f => f) : [];
    setSelectedRiskFactors(factors);
    setEditMode(true);
  };
  const handleCancelEdit = () => {
    setEditedData(patient || {});
    const factors = patient?.risk_factors ? patient.risk_factors.split(',').map(f => f.trim()).filter(f => f) : [];
    setSelectedRiskFactors(factors);
    setShowDobPicker(false);
    setShowLmpPicker(false);
    setShowEddPicker(false);
    setShowRiskFactorsModal(false);
    setShowBloodGroupModal(false);
    setEditMode(false);
  };
  const handleSave = async (shouldApprove = false) => {
    try {
      const updatedPatient = {
        ...patient,
        ...editedData,
        is_high_risk: !!editedData?.is_high_risk,
        risk_factors: editedData?.is_high_risk ? selectedRiskFactors.join(', ') : ''
      };
      if (shouldApprove) {
        const validationMessage = getApprovalValidationMessage(updatedPatient);
        if (validationMessage) {
          Alert.alert(t('completeRequiredDetails'), `${validationMessage}\n\n${t('updateDetailsBeforeApproval')}`);
          return;
        }
      }
      const updateData = {};
      Object.keys(editedData).forEach(key => {
        if (editedData[key] !== patient[key]) {
          updateData[key] = editedData[key];
        }
      });

      // Add risk factors from modal
      if (editedData?.is_high_risk) {
        updateData.risk_factors = selectedRiskFactors.join(', ');
        updateData.is_high_risk = true;
      } else {
        updateData.risk_factors = '';
        updateData.is_high_risk = false;
      }
      if (!isOnline) {
        if (shouldApprove) {
          Alert.alert(t('offlineMode'), 'Approval is only available while online. Please connect to the internet and try again.');
          return;
        }

        // Offline mode - save edits to local database only
        try {
          // Update local patient data in offline DB
          await syncService.saveOfflinePatientUpdate(patientId, updatedPatient);

          // Update patient in main cache
          const allPatients = await offlineDB.getPatients();
          const updatedPatients = allPatients.map(p => p.id === patientId ? updatedPatient : p);
          await offlineDB.savePatients(updatedPatients);
          setPatient(updatedPatient);
          setEditMode(false);
          Alert.alert(t('saved'), 'Changes saved offline. Will sync when online.', [{
            text: t('ok')
          }]);
        } catch (offlineError) {
          Alert.alert(t('error'), 'Failed to save changes offline');
        }
        return;
      }

      // Online mode - update via API
      await pregnantWomenAPI.update(patientId, updateData);
      setPatient(updatedPatient);
      setEditMode(false);
      if (shouldApprove) {
        const approved = await approveRecord(updatedPatient);
        if (!approved) {
          Alert.alert(t('saved'), t('detailsSavedApprovalPending'));
        }
        return;
      }
      Alert.alert(t('success'), t('detailsUpdatedSuccessfully'));
    } catch (error) {
      Alert.alert(t('error'), t('failedToUpdateDetails'));
    }
  };
  const getMissingOrInvalidFields = record => {
    const missing = [];
    const invalid = [];
    const isEmpty = value => value === null || value === undefined || String(value).trim() === '' || String(value).trim().toLowerCase() === 'n/a';
    if (isEmpty(record?.full_name)) missing.push('Full Name');
    if (isEmpty(record?.husband_name)) missing.push('Husband Name');
    if (isEmpty(record?.mobile_number)) missing.push('Mobile Number');
    if (isEmpty(record?.age)) missing.push('Age');
    if (isEmpty(record?.address)) missing.push('Address');
    if (isEmpty(record?.date_of_birth)) missing.push('Date of Birth');
    if (isEmpty(record?.lmp_date)) missing.push('LMP Date');
    if (isEmpty(record?.edd_date)) missing.push('EDD Date');
    if (isEmpty(record?.blood_group)) missing.push('Blood Group');
    if (isEmpty(record?.block_id)) missing.push('Block');
    const mobileDigits = String(record?.mobile_number || '').replace(/\D/g, '');
    if (!isEmpty(record?.mobile_number) && mobileDigits.length !== 10) {
      invalid.push('Mobile Number must be 10 digits');
    }
    const ageNum = parseInt(record?.age, 10);
    if (!isEmpty(record?.age) && (Number.isNaN(ageNum) || ageNum < 18 || ageNum > 49)) {
      invalid.push('Age must be between 18 and 49');
    }
    return {
      missing,
      invalid
    };
  };
  const getApprovalValidationMessage = record => {
    const {
      missing,
      invalid
    } = getMissingOrInvalidFields(record);
    if (missing.length === 0 && invalid.length === 0) return null;
    const missingText = missing.length ? `Missing:\n• ${missing.join('\n• ')}` : '';
    const invalidText = invalid.length ? `Invalid:\n• ${invalid.join('\n• ')}` : '';
    return [missingText, invalidText].filter(Boolean).join('\n\n');
  };
  const approveRecord = async record => {
    const validationMessage = getApprovalValidationMessage(record);
    if (validationMessage) {
      Alert.alert(t('completeRequiredDetails'), `${validationMessage}\n\n${t('updateDetailsBeforeApproval')}`);
      return false;
    }
    await pregnantWomenAPI.approve(patientId);
    Alert.alert(t('success'), t('patientApprovedSuccessfully'), [{
      text: t('ok'),
      onPress: () => navigation.goBack()
    }]);
    return true;
  };
  const handleApprove = async () => {
    try {
      if (!isOnline) {
        Alert.alert(t('offlineMode'), 'Approval is only available while online. Please connect to the internet and try again.');
        return;
      }
      if (!editMode) {
        handleStartEdit();
        return;
      }
      await handleSave(true);
    } catch (error) {
      Alert.alert(t('error'), t('failedToApprovePatient'));
    }
  };
  const handleReject = () => {
    Alert.alert(t('rejectPatient'), t('areYouSureRejectRegistration'), [{
      text: t('cancel'),
      style: 'cancel'
    }, {
      text: t('reject'),
      style: 'destructive',
      onPress: () => {
        Alert.alert(t('info'), t('rejectionApiWillBeImplemented'));
      }
    }]);
  };
  if (loading) {
    return <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('approvalDetails')}</Text>
          <TouchableOpacity onPress={handleGoHome} style={styles.homeButton}>
            <Home size={24} color="white" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#D2691E" />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </SafeAreaView>;
  }
  return <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('approvalDetails')}</Text>
        <TouchableOpacity onPress={handleGoHome} style={styles.homeButton}>
          <Home size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('personalInformation')}</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('fullName')}:</Text>
            {editMode ? <TextInput style={styles.input} value={editedData?.full_name || ''} onChangeText={text => setEditedData({
            ...editedData,
            full_name: text
          })} placeholder={t('enterFullName')} /> : <Text style={styles.value}>{patient?.full_name || t('notAvailable')}</Text>}
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('husbandName')}:</Text>
            {editMode ? <TextInput style={styles.input} value={editedData?.husband_name || ''} onChangeText={text => setEditedData({
            ...editedData,
            husband_name: text
          })} placeholder={t('enterHusbandName')} /> : <Text style={styles.value}>{patient?.husband_name || t('notAvailable')}</Text>}
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('mobile')}:</Text>
            {editMode ? <TextInput style={styles.input} value={editedData?.mobile_number || ''} onChangeText={text => setEditedData({
            ...editedData,
            mobile_number: text.replace(/[^0-9]/g, '').slice(0, 10)
          })} placeholder={t('enterMobileNumber')} keyboardType="numeric" maxLength={10} /> : <Text style={styles.value}>{patient?.mobile_number || t('notAvailable')}</Text>}
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('age')}:</Text>
            {editMode ? <TextInput style={[styles.input, styles.readOnlyInput]} value={String(editedData?.age ?? '')} placeholder="Auto-calculated from DOB" editable={false} /> : <Text style={styles.value}>{patient?.age || t('notAvailable')}</Text>}
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('dateOfBirth')}:</Text>
            {editMode ? <View style={styles.datePickerContainer}>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowDobPicker(true)}>
                  <Text style={styles.dateButtonText}>
                    {editedData?.date_of_birth ? formatDateDDMMYYYY(editedData.date_of_birth) : t('selectDateDashFormat')}
                  </Text>
                  <Calendar size={16} color="#D2691E" />
                </TouchableOpacity>
                {showDobPicker && <DateTimePicker value={editedData?.date_of_birth ? new Date(editedData.date_of_birth) : new Date()} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(event, date) => handleDateChange('date_of_birth', event, date)} maximumDate={new Date()} />}
              </View> : <Text style={styles.value}>{formatDateDDMMYYYY(patient?.date_of_birth)}</Text>}
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('address')}:</Text>
            {editMode ? <TextInput style={styles.input} value={editedData?.address || ''} onChangeText={text => setEditedData({
            ...editedData,
            address: text
          })} placeholder={t('enterAddress')} /> : <Text style={styles.value}>{patient?.address || t('notAvailable')}</Text>}
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('abhaId')}:</Text>
            {editMode ? <TextInput style={styles.input} value={editedData?.abha_id || ''} onChangeText={text => setEditedData({
            ...editedData,
            abha_id: text
          })} placeholder={t('enterABHAID')} /> : <Text style={styles.value}>{patient?.abha_id || t('notAvailable')}</Text>}
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('rchId')}:</Text>
            {editMode ? <TextInput style={styles.input} value={editedData?.rch_id || ''} onChangeText={text => setEditedData({
            ...editedData,
            rch_id: text
          })} placeholder={t('enterRCHID')} /> : <Text style={styles.value}>{patient?.rch_id || t('notAvailable')}</Text>}
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('hprId')}:</Text>
            {editMode ? <TextInput style={styles.input} value={editedData?.hpr_id || ''} onChangeText={text => setEditedData({
            ...editedData,
            hpr_id: text
          })} placeholder={t('enterHPRID')} /> : <Text style={styles.value}>{patient?.hpr_id || t('notAvailable')}</Text>}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('medicalInformation')}</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('lmpDate')} *</Text>
            {editMode ? <View style={styles.datePickerContainer}>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowLmpPicker(true)}>
                  <Text style={styles.dateButtonText}>
                    {editedData?.lmp_date ? formatDateDDMMYYYY(editedData.lmp_date) : t('selectDateDashFormat')}
                  </Text>
                  <Calendar size={16} color="#D2691E" />
                </TouchableOpacity>
                {showLmpPicker && <DateTimePicker value={editedData?.lmp_date ? new Date(editedData.lmp_date) : new Date()} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(event, date) => handleDateChange('lmp_date', event, date)} maximumDate={new Date()} />}
              </View> : <Text style={styles.value}>{formatDateDDMMYYYY(patient?.lmp_date)}</Text>}
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('eddDate')}:</Text>
            {editMode ? <View style={styles.datePickerContainer}>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowEddPicker(true)}>
                  <Text style={styles.dateButtonText}>
                    {editedData?.edd_date ? formatDateDDMMYYYY(editedData.edd_date) : t('selectDateDashFormat')}
                  </Text>
                  <Calendar size={16} color="#D2691E" />
                </TouchableOpacity>
                {showEddPicker && <DateTimePicker value={editedData?.edd_date ? new Date(editedData.edd_date) : new Date()} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(event, date) => handleDateChange('edd_date', event, date)} />}
              </View> : <Text style={styles.value}>{formatDateDDMMYYYY(patient?.edd_date)}</Text>}
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('gravida')}:</Text>
            {editMode ? <TextInput style={styles.input} value={String(editedData?.gravida ?? '')} onChangeText={text => setEditedData({
            ...editedData,
            gravida: text
          })} placeholder={t('enterGravida')} keyboardType="numeric" /> : <Text style={styles.value}>{patient?.gravida || t('notAvailable')}</Text>}
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('para')}:</Text>
            {editMode ? <TextInput style={styles.input} value={String(editedData?.para ?? '')} onChangeText={text => setEditedData({
            ...editedData,
            para: text
          })} placeholder={t('enterPara')} keyboardType="numeric" /> : <Text style={styles.value}>{patient?.para || t('notAvailable')}</Text>}
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('bloodGroup')} *</Text>
            {editMode ? <View style={{
            flex: 1
          }}>
                <TouchableOpacity style={styles.riskFactorsButton} onPress={() => setShowBloodGroupModal(true)}>
                  <Text style={styles.riskFactorsButtonText}>
                    {editedData?.blood_group || t('selectBloodGroup')}
                  </Text>
                  <ChevronDown size={16} color="#6b7280" />
                </TouchableOpacity>
              </View> : <Text style={styles.value}>{patient?.blood_group || t('notAvailable')}</Text>}
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('highRisk')}:</Text>
            {editMode ? <TouchableOpacity style={styles.highRiskToggle} onPress={() => setEditedData({
            ...editedData,
            is_high_risk: !editedData.is_high_risk
          })}>
                <View style={[styles.toggleSwitch, editedData.is_high_risk && styles.toggleSwitchActive]}>
                  <View style={[styles.toggleCircle, editedData.is_high_risk && styles.toggleCircleActive]} />
                </View>
                <Text style={styles.value}>{editedData.is_high_risk ? t('yes') : t('no')}</Text>
              </TouchableOpacity> : <Text style={styles.value}>{patient?.is_high_risk ? t('yes') : t('no')}</Text>}
          </View>
          {(editMode && editedData.is_high_risk || !editMode && patient?.is_high_risk) && <View style={styles.infoRow}>
              <Text style={styles.label}>{t('riskFactors')}:</Text>
              {editMode ? <View style={{
            flex: 1
          }}>
                  <TouchableOpacity style={styles.riskFactorsButton} onPress={() => setShowRiskFactorsModal(true)}>
                    <Text style={styles.riskFactorsButtonText}>
                      {selectedRiskFactors.length > 0 ? `${selectedRiskFactors.length} ${t('riskFactorsSelected')}` : t('selectRiskFactors')}
                    </Text>
                    <ChevronDown size={16} color="#6b7280" />
                  </TouchableOpacity>
                  {selectedRiskFactors.length > 0 && <Text style={styles.selectedRiskText}>
                      {selectedRiskFactors.join(', ')}
                    </Text>}
                </View> : <Text style={styles.value}>{patient?.risk_factors || t('notAvailable')}</Text>}
            </View>}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('administrative')}</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('district')}:</Text>
            <Text style={styles.value}>{districtName || t('notAvailable')}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('block')}:</Text>
            <Text style={styles.value}>{blockName || t('notAvailable')}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('ward')}:</Text>
            <Text style={styles.value}>{wardName || t('notAvailable')}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('subCentre')}:</Text>
            <Text style={styles.value}>{subCentreName || t('notAvailable')}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('registrationDate')}:</Text>
            <Text style={styles.value}>{formatDateDDMMYYYY(patient?.pregnancy_registration_date)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('selfRegistered')}:</Text>
            <Text style={styles.value}>{patient?.is_self_registered ? t('yes') : t('no')}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('createdAt')}:</Text>
            <Text style={styles.value}>{formatDateTimeDDMMYYYY(patient?.created_at)}</Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          {editMode ? <>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancelEdit}>
                <Text style={styles.buttonText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.approveButton} onPress={handleApprove}>
                <Check size={20} color="white" />
                <Text style={styles.buttonText}>{t('saveAndApprove')}</Text>
              </TouchableOpacity>
            </> : <>
              <TouchableOpacity style={styles.rejectButton} onPress={handleReject}>
                <X size={20} color="white" />
                <Text style={styles.buttonText}>{t('reject')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.approveButton} onPress={handleApprove}>
                <Edit size={20} color="white" />
                <Text style={styles.buttonText}>{t('edit')}</Text>
              </TouchableOpacity>
            </>}
        </View>
      </ScrollView>

      {/* Risk Factors Modal */}
      <KeyboardSafeModal visible={showRiskFactorsModal} position="center" onRequestClose={() => setShowRiskFactorsModal(false)} closeOnBackdropPress={false}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t('selectRiskFactorsTitle')}</Text>
          <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowRiskFactorsModal(false)}>
            <X size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <ScrollView style={{
        maxHeight: 400
      }} keyboardShouldPersistTaps="handled">
          {riskFactorsOptions.map(factor => <TouchableOpacity key={factor} style={[styles.modalOption, selectedRiskFactors.includes(factor) && styles.modalOptionSelected]} onPress={() => handleRiskFactorToggle(factor)}>
              <Text style={[styles.modalOptionText, selectedRiskFactors.includes(factor) && styles.modalOptionTextSelected]}>
                {factor}
              </Text>
              {selectedRiskFactors.includes(factor) && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>)}
        </ScrollView>
        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.modalDoneButton} onPress={() => setShowRiskFactorsModal(false)}>
            <Text style={styles.modalDoneButtonText}>{t('done')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardSafeModal>

      {/* Blood Group Modal */}
      <KeyboardSafeModal visible={showBloodGroupModal} position="center" onRequestClose={() => setShowBloodGroupModal(false)} closeOnBackdropPress={true}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t('selectBloodGroup')}</Text>
          <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowBloodGroupModal(false)}>
            <X size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <ScrollView style={{
        maxHeight: 400
      }} keyboardShouldPersistTaps="handled">
          {bloodGroupOptions.map(group => <TouchableOpacity key={group} style={[styles.modalOption, editedData?.blood_group === group && styles.modalOptionSelected]} onPress={() => {
          setEditedData({
            ...editedData,
            blood_group: group
          });
          setShowBloodGroupModal(false);
        }}>
              <Text style={[styles.modalOptionText, editedData?.blood_group === group && styles.modalOptionTextSelected]}>
                {group}
              </Text>
              {editedData?.blood_group === group && <Check size={18} color="#10B981" />}
            </TouchableOpacity>)}
        </ScrollView>
      </KeyboardSafeModal>
    </SafeAreaView>;
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fad5a5'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#D2691E',
    gap: 12
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  homeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    flex: 1
  },
  content: {
    flex: 1,
    padding: 16
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8
  },
  label: {
    fontSize: 14,
    color: '#6b7280',
    width: 120
  },
  value: {
    fontSize: 14,
    color: '#1f2937',
    flex: 1,
    fontWeight: '500'
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 24
  },
  approveButton: {
    flex: 1,
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    gap: 8
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#dc2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    gap: 8
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#6b7280',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    gap: 8
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    color: '#1f2937'
  },
  readOnlyInput: {
    backgroundColor: '#f9fafb',
    color: '#6b7280'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fad5a5'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500'
  },
  datePickerContainer: {
    flex: 1
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 8,
    minHeight: 36
  },
  dateButtonText: {
    fontSize: 14,
    color: '#1f2937',
    flex: 1,
    marginRight: 8
  },
  riskFactorsButton: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  riskFactorsButtonText: {
    fontSize: 14,
    color: '#1f2937'
  },
  selectedRiskText: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 4,
    fontStyle: 'italic'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb'
  },
  modalFooter: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937'
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6'
  },
  modalOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  modalOptionSelected: {
    backgroundColor: '#fef3c7'
  },
  modalOptionText: {
    fontSize: 16,
    color: '#374151'
  },
  modalOptionTextSelected: {
    color: '#92400e',
    fontWeight: '500'
  },
  checkmark: {
    fontSize: 18,
    color: '#10B981'
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
    alignSelf: 'center'
  },
  modalDoneButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white'
  },
  highRiskToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#d1d5db',
    padding: 2,
    justifyContent: 'center'
  },
  toggleSwitchActive: {
    backgroundColor: '#10B981',
    alignItems: 'flex-end'
  },
  toggleCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'white'
  },
  toggleCircleActive: {
    backgroundColor: 'white'
  }
});
export default PendingApprovalDetailScreen;
