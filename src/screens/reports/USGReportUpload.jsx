import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { ArrowLeft, Upload, CheckCircle, ChevronDown, Home } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncService } from '../../utils/syncService';
import { secureStorage } from '../../utils/secureStorage';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { usgAppointmentAPI, pregnantWomenAPI, authAPI } from '../../services/api';
import { requestStoragePermission } from '../../utils/permissions';
import { useTranslation } from 'react-i18next';
const USGReportUpload = ({
  route,
  navigation
}) => {
  const {
    t
  } = useTranslation();
  const {
    patientId,
    appointmentId
  } = route.params || {};
  const isOnline = useNetworkStatus();
  const [formData, setFormData] = useState({
    doctorName: '',
    technicianName: '',
    scanType: '',
    trimester: '1st',
    findings: '',
    gestationalAge: '',
    abnormalFindings: '',
    additionalNotes: '',
    isHighRisk: false,
    scanDate: new Date().toISOString().split('T')[0] // Auto-filled with today's date
  });
  const [reportFiles, setReportFiles] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [abnormalOptions, setAbnormalOptions] = useState({});
  const [scanTypeOptions, setScanTypeOptions] = useState([]);
  const [selectedAbnormalFindings, setSelectedAbnormalFindings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [patientInfo, setPatientInfo] = useState(null);
  const [appointmentInfo, setAppointmentInfo] = useState(null);
  const [showScanTypeDropdown, setShowScanTypeDropdown] = useState(false);
  const supportedExtensions = ['pdf', 'jpg', 'jpeg', 'png'];
  const logFileDebug = (...args) => {};
  const [userInfo, setUserInfo] = useState(null);
  const handleGoHome = () => {
    const roleRouteMap = {
      dp: 'DPDashboard',
      sub_centre: 'SubCentreDashboard',
      district: 'DistrictDashboard',
      block: 'BlockDashboard',
      usg_centre: 'USGDashboard',
      mother: 'MotherDashboard'
    };
    const dashboardRoute = roleRouteMap[userInfo?.role] || 'USGDashboard';
    navigation.navigate(dashboardRoute);
  };
  useEffect(() => {
    loadUserInfo();
    if (patientId) {
      loadPatientInfo();
    }
    if (appointmentId) {
      loadAppointmentInfo();
    }
    loadAbnormalOptions();
    loadScanTypeOptions();
  }, [patientId, appointmentId]);
  const loadUserInfo = async () => {
    try {
      const userData = await secureStorage.getItem('user_info');
      if (userData) {
        setUserInfo(userData);
      }
    } catch (error) {}
  };
  const loadAbnormalOptions = async () => {
    try {
      // Try to get from offline database first
      const cachedOptions = await syncService.getOfflineData('abnormal_options', 'all');
      if (cachedOptions) {
        setAbnormalOptions(cachedOptions);
        return;
      }

      // Fallback to API call
      const options = await authAPI.getAbnormalFindingsOptions();
      setAbnormalOptions(options);
    } catch (error) {}
  };
  const loadScanTypeOptions = async () => {
    try {
      // Try to get from offline database first
      const cachedTypes = await syncService.getOfflineData('scan_type_options', 'all');
      if (cachedTypes) {
        const scanTypes = cachedTypes.scan_types || cachedTypes;
        if (Array.isArray(scanTypes) && scanTypes.length > 0) {
          setScanTypeOptions(scanTypes);
          return;
        }
      }

      // Fallback to API call
      const options = await authAPI.getScanTypesOptions();
      const scanTypes = options.scan_types || options;
      if (Array.isArray(scanTypes) && scanTypes.length > 0) {
        setScanTypeOptions(scanTypes);
      }
    } catch (error) {}
  };
  const selectReportFile = async () => {
    setShowUploadModal(true);
  };
  const appendReportFiles = files => {
    const validFiles = (Array.isArray(files) ? files : [files]).filter(Boolean);
    if (validFiles.length === 0) return;
    setReportFiles(prev => {
      const nextFiles = [...prev];
      validFiles.forEach(file => {
        const fileKey = `${file.uri || ''}_${file.name || ''}`;
        const exists = nextFiles.some(existing => `${existing.uri || ''}_${existing.name || ''}` === fileKey);
        if (!exists) {
          nextFiles.push(file);
        }
      });
      return nextFiles;
    });
  };
  const removeReportFile = targetIndex => {
    setReportFiles(prev => prev.filter((_, index) => index !== targetIndex));
  };
  const handleImagePick = async () => {
    setShowUploadModal(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        allowsMultipleSelection: true,
        quality: 0.8
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const normalizedFiles = [];
        for (const file of result.assets) {
          if (file.fileSize && file.fileSize > 10 * 1024 * 1024) {
            Alert.alert(t('error'), t('fileTooLarge10MB'));
            return;
          }
          normalizedFiles.push({
            uri: file.uri,
            name: file.fileName || `report_${Date.now()}_${normalizedFiles.length + 1}.jpg`,
            mimeType: file.mimeType || 'image/jpeg'
          });
        }
        appendReportFiles(normalizedFiles);
      }
    } catch (error) {
      Alert.alert(t('error'), t('failedToPickImage'));
    }
  };
  const handleCameraPick = async () => {
    setShowUploadModal(false);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 0.8
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        if (file.fileSize && file.fileSize > 10 * 1024 * 1024) {
          Alert.alert(t('error'), t('fileTooLarge10MB'));
          return;
        }
        appendReportFiles({
          uri: file.uri,
          name: file.fileName || `camera_report_${Date.now()}.jpg`,
          mimeType: file.mimeType || 'image/jpeg'
        });
      }
    } catch (error) {
      Alert.alert(t('error'), t('failedToTakePhoto'));
    }
  };
  const handleDocumentPick = async () => {
    setShowUploadModal(false);
    try {
      const hasPermission = await requestStoragePermission();
      if (!hasPermission) {
        return;
      }
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: true
      });
      if (!result.canceled && result.assets?.length > 0) {
        const normalizedFiles = [];
        for (const file of result.assets) {
          if (file.size && file.size > 10 * 1024 * 1024) {
            Alert.alert(t('error'), t('fileTooLarge10MB'));
            return;
          }
          if (file.mimeType && file.mimeType !== 'application/pdf') {
            Alert.alert(t('error'), t('invalidFileTypePdfOnly'));
            return;
          }
          normalizedFiles.push(file);
        }
        appendReportFiles(normalizedFiles);
      }
    } catch (error) {
      Alert.alert(t('error'), t('failedToSelectFileCheckPermissions'));
    }
  };
  const loadPatientInfo = async () => {
    try {
      const patient = await syncService.getPatientById(patientId);
      if (patient) {
        setPatientInfo(patient);
      }
    } catch (error) {}
  };
  const loadAppointmentInfo = async () => {
    try {
      const appointment = await syncService.getAppointmentById(appointmentId);
      if (appointment) {
        setAppointmentInfo(appointment);
      }
    } catch (error) {}
  };
  const toggleAbnormalFinding = finding => {
    setSelectedAbnormalFindings(prev => prev.includes(finding) ? prev.filter(f => f !== finding) : [...prev, finding]);
  };
  const getAbnormalOptionsForTrimester = () => {
    const trimesterMap = {
      '1st': 'first_trimester',
      '2nd': 'second_trimester',
      '3rd': 'third_trimester'
    };
    const trimesterKey = trimesterMap[formData.trimester];
    return abnormalOptions[trimesterKey] || [];
  };
  useEffect(() => {
    // Clear selected abnormal findings when trimester changes
    setSelectedAbnormalFindings([]);
  }, [formData.trimester]);
  const handleInputChange = (field, value) => {
    setFormData({
      ...formData,
      [field]: value
    });
  };
  const parseDate = dateValue => {
    if (!dateValue) return null;
    const value = String(dateValue).trim();
    if (!value) return null;

    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const date = new Date(`${value}T00:00:00`);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    // DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      const [day, month, year] = value.split('/').map(Number);
      const date = new Date(year, month - 1, day);
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return null;
      }
      return date;
    }
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  };
  const formatDateDDMMYYYY = dateValue => {
    const date = parseDate(dateValue);
    if (!date) return t('notAvailable');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear());
    return `${day}-${month}-${year}`;
  };
  const calculateGestationalAgeFromLmp = (lmpDate, referenceDate) => {
    const lmp = parseDate(lmpDate);
    const refDate = parseDate(referenceDate);
    if (!lmp || !refDate) return null;
    const diffDays = Math.floor((refDate.getTime() - lmp.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return null;
    return Math.floor(diffDays / 7);
  };
  const getTrimesterFromGestationalWeek = weekNum => {
    if (!Number.isFinite(weekNum) || weekNum < 1) return null;
    if (weekNum <= 12) return '1st';
    if (weekNum <= 26) return '2nd';
    if (weekNum <= 40) return '3rd';
    // Keep 41-42 in 3rd trimester for clinical continuity with validation range.
    if (weekNum <= 42) return '3rd';
    return null;
  };
  const calculateGestationalAgeBreakdown = (lmpDate, referenceDate) => {
    const lmp = parseDate(lmpDate);
    const refDate = parseDate(referenceDate);
    if (!lmp || !refDate) return null;
    const diffDays = Math.floor((refDate.getTime() - lmp.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return null;
    return {
      totalDays: diffDays,
      weeks: Math.floor(diffDays / 7),
      days: diffDays % 7
    };
  };
  useEffect(() => {
    const calculatedWeeks = calculateGestationalAgeFromLmp(patientInfo?.lmp_date, formData.scanDate);
    setFormData(prev => {
      const nextValue = calculatedWeeks === null ? '' : String(calculatedWeeks);
      const autoTrimester = getTrimesterFromGestationalWeek(calculatedWeeks);
      if (prev.gestationalAge === nextValue && (!autoTrimester || prev.trimester === autoTrimester)) {
        return prev;
      }
      return {
        ...prev,
        gestationalAge: nextValue,
        ...(autoTrimester ? {
          trimester: autoTrimester
        } : {})
      };
    });
  }, [patientInfo?.lmp_date, formData.scanDate]);
  const handleUpload = async () => {
    if (!formData.doctorName || !formData.technicianName || !formData.scanType || !formData.findings || !formData.scanDate || reportFiles.length === 0) {
      Alert.alert(t('error'), t('fillRequiredFieldsAndSelectReport'));
      return;
    }
    const gestationalAgeWeeks = parseInt(String(formData.gestationalAge || '').trim(), 10);
    if (Number.isNaN(gestationalAgeWeeks) || gestationalAgeWeeks < 1 || gestationalAgeWeeks > 42) {
      Alert.alert(t('error'), t('validGestationalAgeRange'));
      return;
    }
    setLoading(true);
    try {
      const submitData = {
        completed_date: new Date().toISOString().split('T')[0],
        scan_date: formData.scanDate,
        trimester: formData.trimester,
        scan_type: formData.scanType,
        findings: formData.findings,
        doctor_name: formData.doctorName,
        technician_name: formData.technicianName,
        is_high_risk: formData.isHighRisk
      };

      // Add optional fields only if they have values
      submitData.gestational_age = String(gestationalAgeWeeks);
      if (selectedAbnormalFindings.length > 0) submitData.abnormal_findings = selectedAbnormalFindings.join(', ');
      if (formData.additionalNotes) submitData.additional_notes = formData.additionalNotes;
      if (formData.findings) submitData.usg_findings = formData.findings;
      submitData.report_files = reportFiles.map((file, index) => ({
        uri: file.uri,
        type: file.mimeType || file.type || 'image/jpeg',
        name: file.name || `report_${index + 1}.jpg`
      }));
      const isOnline = await syncService.isOnline();
      if (isOnline) {
        // Online: Save to server
        await usgAppointmentAPI.complete(appointmentId, submitData);
        Alert.alert(t('success'), t('reportUploadedSuccessfully'), [{
          text: t('ok'),
          onPress: () => navigation.navigate('USGDashboard')
        }]);
      } else {
        // Offline: Copy file to permanent location and save metadata
        const fileInfos = [];
        for (let index = 0; index < reportFiles.length; index++) {
          const reportFile = reportFiles[index];
          const fileExtension = reportFile.name?.split('.').pop() || 'jpg';
          const fileName = `usg_report_${Date.now()}_${index + 1}.${fileExtension}`;
          const permanentUri = `${FileSystem.documentDirectory}${fileName}`;
          await FileSystem.copyAsync({
            from: reportFile.uri,
            to: permanentUri
          });
          fileInfos.push({
            original_name: reportFile.name,
            local_uri: permanentUri,
            mime_type: reportFile.mimeType || reportFile.type || 'image/jpeg',
            upload_status: 'pending'
          });
        }
        const offlineData = {
          ...submitData,
          appointment_id: appointmentId,
          id: `offline_${Date.now()}`,
          sync_status: 'pending',
          created_offline: true,
          file_infos: fileInfos
        };
        await syncService.saveOfflineUSGReport(offlineData);
        Alert.alert(t('success'), t('reportSavedOfflineWillSync'), [{
          text: t('ok'),
          onPress: () => navigation.navigate('USGDashboard')
        }]);
      }
    } catch (error) {
      const errorDetail = error.response?.data?.detail;
      if (errorDetail) {
        if (errorDetail.includes('Invalid file type')) {
          Alert.alert(t('error'), t('invalidFileTypePdfOnly'));
        } else if (errorDetail.includes('File too large')) {
          Alert.alert(t('error'), t('fileTooLarge10MB'));
        } else if (errorDetail.includes('File content does not match')) {
          Alert.alert(t('error'), t('fileContentMismatch'));
        } else {
          Alert.alert(t('error'), errorDetail);
        }
      } else {
        Alert.alert(t('error'), t('failedToUploadReport'));
      }
    } finally {
      setLoading(false);
    }
  };
  const getFileExtensionFromUrl = fileUrl => {
    if (!fileUrl) return 'pdf';
    const cleanUrl = String(fileUrl).split('?')[0].split('#')[0];
    const match = cleanUrl.match(/\.([a-zA-Z0-9]+)$/);
    const ext = match?.[1]?.toLowerCase();
    return supportedExtensions.includes(ext) ? ext : 'pdf';
  };
  const hasExplicitSupportedExtension = fileUrl => {
    if (!fileUrl) return false;
    const cleanUrl = String(fileUrl).split('?')[0].split('#')[0];
    const match = cleanUrl.match(/\.([a-zA-Z0-9]+)$/);
    const ext = match?.[1]?.toLowerCase();
    return supportedExtensions.includes(ext);
  };
  const getMimeTypeFromExtension = extension => {
    const normalized = String(extension || '').toLowerCase();
    if (normalized === 'pdf') return 'application/pdf';
    if (normalized === 'png') return 'image/png';
    if (normalized === 'jpg' || normalized === 'jpeg') return 'image/jpeg';
    return 'application/octet-stream';
  };
  const getPrescriptionUrls = appointmentData => {
    const multipleUrls = Array.isArray(appointmentData?.prescription_file_urls) ? appointmentData.prescription_file_urls.filter(Boolean) : [];
    if (multipleUrls.length > 1) {
      return multipleUrls;
    }
    if (appointmentData?.prescription_file_url) {
      return [appointmentData.prescription_file_url];
    }
    return multipleUrls;
  };
  const getCachePath = (extension, fileIndex = 0) => `${FileSystem.cacheDirectory}prescription_${appointmentId}_${fileIndex}.${extension}`;
  const findCachedPrescriptionPath = async (preferredExtension, strictExtension = false, fileIndex = 0) => {
    const orderedExtensions = [preferredExtension, ...(strictExtension ? [] : supportedExtensions.filter(ext => ext !== preferredExtension))].filter(Boolean);
    for (const extension of orderedExtensions) {
      const path = getCachePath(extension, fileIndex);
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) return path;
    }
    return null;
  };
  const openPrescriptionFile = async (fileUrl, fileIndex = 0) => {
    try {
      if (!fileUrl) {
        Alert.alert(t('error'), t('prescriptionFileNotAvailable'));
        return;
      }
      const detectedExtension = getFileExtensionFromUrl(fileUrl);
      const strictExtension = hasExplicitSupportedExtension(fileUrl);
      let cachedPath = await findCachedPrescriptionPath(detectedExtension, strictExtension, fileIndex);
      if (cachedPath) {
        const contentUri = await FileSystem.getContentUriAsync(cachedPath);
        const mimeType = getMimeTypeFromExtension(cachedPath.split('.').pop());
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: mimeType
        });
        return;
      }
      if (!isOnline) {
        Alert.alert(t('offlineMode'), t('prescriptionNotCachedConnectInternet'));
        return;
      }
      const BASE_URL = process.env.EXPO_PUBLIC_API_URL;
      const fullURL = fileUrl.startsWith('http') ? fileUrl : `${BASE_URL}${fileUrl}`;
      const downloadPath = getCachePath(detectedExtension, fileIndex);
      const result = await FileSystem.downloadAsync(fullURL, downloadPath);
      cachedPath = downloadPath;
      const contentUri = await FileSystem.getContentUriAsync(cachedPath);
      const mimeType = getMimeTypeFromExtension(detectedExtension);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1,
        type: mimeType
      });
    } catch (error) {
      Alert.alert(t('error'), t('unableToOpenPrescriptionFile'));
    }
  };
  const gestationalAgeBreakdown = calculateGestationalAgeBreakdown(patientInfo?.lmp_date, formData.scanDate);
  return <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={20} color="white" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{t('uploadUSGReport')}</Text>
            <Text style={styles.headerSubtitle}>{t('completeAppointment')}</Text>
          </View>
          <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
            <Home size={20} color="white" />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={styles.mainContent} contentContainerStyle={styles.mainContentContainer} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} showsVerticalScrollIndicator={false}>
            {/* Patient Info */}
            {patientInfo && <View style={styles.card}>
                <View style={styles.patientGrid}>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>{t('name')}</Text>
                    <Text style={styles.gridValue}>{patientInfo.full_name}</Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>{t('mobile')}</Text>
                    <Text style={styles.gridValue}>{patientInfo.mobile_number || t('notAvailable')}</Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>{t('age')}</Text>
                    <Text style={styles.gridValue}>{patientInfo.age || t('notAvailable')} {t('years')}</Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>{t('eddDate')}</Text>
                    <Text style={styles.gridValue}>{formatDateDDMMYYYY(patientInfo.edd_date)}</Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>{t('lmpDate')}</Text>
                    <Text style={styles.gridValue}>{formatDateDDMMYYYY(patientInfo.lmp_date)}</Text>
                  </View>
                </View>
              </View>}

            {/* Prescription File */}
            {getPrescriptionUrls(appointmentInfo).length > 0 && <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('prescriptionFile')}</Text>
                {getPrescriptionUrls(appointmentInfo).map((fileUrl, index) => <TouchableOpacity key={`${fileUrl}_${index}`} style={styles.prescriptionBox} onPress={() => openPrescriptionFile(fileUrl, index)}>
                    <Text style={styles.prescriptionText}>{`${t('viewPrescriptionFile')} ${index + 1}`}</Text>
                  </TouchableOpacity>)}
              </View>}

            {/* Report Upload */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('usgReportRequired')}</Text>
              <TouchableOpacity style={styles.uploadBox} onPress={selectReportFile}>
                <Upload size={24} color="#8B4513" />
                <Text style={styles.uploadText}>
                  {reportFiles.length > 0 ? 'Add more' : t('selectReportFileMax10MB')}
                </Text>
              </TouchableOpacity>
                {reportFiles.map((file, index) => <View key={`${file.uri}_${index}`} style={styles.selectedFileRow}>
                    <Text style={styles.selectedFileText} numberOfLines={1}>
                      {file.name || `Report ${index + 1}`}
                    </Text>
                    <TouchableOpacity onPress={() => removeReportFile(index)}>
                      <Text style={styles.removeFileText}>{t('remove') || 'Remove'}</Text>
                    </TouchableOpacity>
                  </View>)}
            </View>

            {/* Upload Modal */}
            <Modal visible={showUploadModal} transparent animationType="fade">
              <View style={styles.uploadModalOverlay}>
                <View style={styles.uploadModalContent}>
                  <Text style={styles.uploadModalTitle}>{t('uploadReport')}</Text>
                  <Text style={styles.uploadModalSubtitle}>{t('chooseFileType')}</Text>
                  
                  <TouchableOpacity style={styles.uploadOptionButton} onPress={handleCameraPick}>
                    <Text style={styles.uploadOptionText}>{t('takePhoto')}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.uploadOptionButton} onPress={handleImagePick}>
                    <Text style={styles.uploadOptionText}>{t('gallery')}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.uploadOptionButton} onPress={handleDocumentPick}>
                    <Text style={styles.uploadOptionText}>{t('documentPdf')}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.uploadCancelButton} onPress={() => setShowUploadModal(false)}>
                    <Text style={styles.uploadCancelText}>{t('cancel')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            {/* Medical Details */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('medicalDetails')}</Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('scanTypeRequired')}</Text>
              <TouchableOpacity style={styles.dropdown} onPress={() => setShowScanTypeDropdown(true)}>
                <Text style={styles.dropdownText}>
                  {formData.scanType || t('selectScanType')}
                </Text>
                <ChevronDown size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('scanDateRequired')}</Text>
              <View style={[styles.input, styles.readOnlyInput]}>
                <Text style={styles.readOnlyInputText}>{formatDateDDMMYYYY(formData.scanDate)}</Text>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('gestationalAgeWeeks')}</Text>
              <View style={[styles.input, styles.readOnlyInput]}>
                <Text style={styles.readOnlyInputText}>
                  {formData.gestationalAge ? `${formData.gestationalAge} ${t('weeks')}` : t('notAvailable')}
                </Text>
              </View>
              {!!gestationalAgeBreakdown && <Text style={styles.helperText}>
                  {t('gestationalAge')}: {gestationalAgeBreakdown.weeks} {t('weeks')} {gestationalAgeBreakdown.days} {t('days')}
                </Text>}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('trimesterRequired')}</Text>
              <View style={styles.radioGroup}>
                {['1st', '2nd', '3rd'].map(tri => <TouchableOpacity key={tri} style={styles.radioOption} onPress={() => handleInputChange('trimester', tri)}>
                    <View style={styles.radioCircle}>
                      {formData.trimester === tri && <View style={styles.radioInner} />}
                    </View>
                    <Text style={styles.radioText}>{tri}</Text>
                  </TouchableOpacity>)}
              </View>
            </View>
            </View>

            {/* Staff Details */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('staffDetails')}</Text>
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('doctorNameRequired')}</Text>
              <TextInput style={styles.input} placeholder={t('enterDoctorName')} value={formData.doctorName} onChangeText={value => handleInputChange('doctorName', value)} />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('technicianNameRequired')}</Text>
              <TextInput style={styles.input} placeholder={t('enterTechnicianName')} value={formData.technicianName} onChangeText={value => handleInputChange('technicianName', value)} />
            </View>
            </View>

            {/* Findings */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('findingsRequired')}</Text>
              <TextInput style={styles.textArea} placeholder={t('enterScanFindings')} multiline numberOfLines={4} value={formData.findings} onChangeText={value => handleInputChange('findings', value)} />
            </View>

            {/* Abnormal Findings */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('abnormalFindings')}</Text>
              {getAbnormalOptionsForTrimester().length > 0 ? getAbnormalOptionsForTrimester().map(finding => <TouchableOpacity key={finding} style={[styles.checkboxItem, selectedAbnormalFindings.includes(finding) && styles.checkboxItemSelected]} onPress={() => toggleAbnormalFinding(finding)}>
                    <View style={styles.checkbox}>
                      {selectedAbnormalFindings.includes(finding) && <View style={styles.checkboxInner} />}
                    </View>
                    <Text style={styles.checkboxLabel}>{finding}</Text>
                  </TouchableOpacity>) : <Text style={styles.noOptionsText}>{t('noAbnormalFindingsOptions')}</Text>}
            </View>

            {/* High Risk Assessment */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('riskAssessment')}</Text>
              <TouchableOpacity style={styles.checkboxItem} onPress={() => handleInputChange('isHighRisk', !formData.isHighRisk)}>
                <View style={styles.checkbox}>
                  {formData.isHighRisk && <View style={styles.checkboxInner} />}
                </View>
                <Text style={styles.checkboxLabel}>{t('highRiskPregnancy')}</Text>
              </TouchableOpacity>
            </View>

            {/* Additional Notes */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('additionalNotes')}</Text>
              <TextInput style={styles.textArea} placeholder={t('enterAdditionalNotes')} multiline numberOfLines={3} value={formData.additionalNotes} onChangeText={value => handleInputChange('additionalNotes', value)} />
            </View>

          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()} disabled={loading}>
              <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.submitButton, loading && styles.disabledButton]} onPress={handleUpload} disabled={loading}>
              <View style={styles.submitButtonContent}>
                <CheckCircle size={16} color="white" />
                <Text style={styles.submitButtonText}>
                  {loading ? t('uploading') : t('uploadReport')}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* Scan Type Dropdown Modal */}
        <Modal visible={showScanTypeDropdown} transparent={true} animationType="fade" onRequestClose={() => setShowScanTypeDropdown(false)}>
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowScanTypeDropdown(false)}>
            <View style={styles.dropdownModal}>
              <Text style={styles.dropdownTitle}>{t('selectScanType')}</Text>
              <ScrollView style={styles.dropdownList}>
                {scanTypeOptions.map(type => <TouchableOpacity key={type} style={styles.dropdownItem} onPress={() => {
                handleInputChange('scanType', type);
                setShowScanTypeDropdown(false);
              }}>
                    <Text style={styles.dropdownItemText}>{type}</Text>
                  </TouchableOpacity>)}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>;
};
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f0f4f8'
  },
  keyboardAvoidingView: {
    flex: 1
  },
  header: {
    backgroundColor: '#D2691E',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center'
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  homeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12
  },
  headerInfo: {
    flex: 1
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 2
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)'
  },
  mainContent: {
    flex: 1,
    padding: 12
  },
  mainContentContainer: {
    paddingBottom: 24
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12
  },
  patientGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  gridItem: {
    width: '48%'
  },
  gridLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 4
  },
  gridValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '600'
  },
  formGroup: {
    marginBottom: 12
  },
  label: {
    fontSize: 13,
    color: '#1f2937',
    fontWeight: '600',
    marginBottom: 6
  },
  input: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1f2937'
  },
  readOnlyInput: {
    backgroundColor: '#f9fafb',
    justifyContent: 'center'
  },
  readOnlyInputText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500'
  },
  helperText: {
    marginTop: 6,
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500'
  },
  uploadBox: {
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#f9fafb'
  },
  uploadText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8
  },
  selectedFileRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  selectedFileText: {
    flex: 1,
    fontSize: 13,
    color: '#374151'
  },
  removeFileText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#dc2626'
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#8B4513',
    alignItems: 'center',
    justifyContent: 'center'
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#8B4513'
  },
  radioText: {
    fontSize: 14,
    color: '#374151'
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: 'white'
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: '#8B4513',
    borderRadius: 3,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkboxInner: {
    width: 10,
    height: 10,
    backgroundColor: '#8B4513',
    borderRadius: 2
  },
  checkboxLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937'
  },
  textArea: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1f2937',
    height: 100,
    textAlignVertical: 'top'
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
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#8B4513',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B4513'
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#8B4513',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white'
  },
  checkboxItemSelected: {
    backgroundColor: 'rgba(139, 69, 19, 0.1)'
  },
  noOptionsText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16
  },
  disabledButton: {
    opacity: 0.6
  },
  prescriptionBox: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#0ea5e9',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center'
  },
  prescriptionText: {
    fontSize: 14,
    color: '#0ea5e9',
    fontWeight: '600'
  },
  dropdown: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white'
  },
  dropdownText: {
    fontSize: 14,
    color: '#1f2937'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  dropdownModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '100%',
    maxHeight: '70%',
    padding: 16
  },
  dropdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
    textAlign: 'center'
  },
  dropdownList: {
    maxHeight: 300
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6'
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#1f2937'
  },
  uploadModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  uploadModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400
  },
  uploadModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center'
  },
  uploadModalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
    textAlign: 'center'
  },
  uploadOptionButton: {
    backgroundColor: '#8B4513',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center'
  },
  uploadOptionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  uploadCancelButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
    alignItems: 'center'
  },
  uploadCancelText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600'
  }
});
export default USGReportUpload;
