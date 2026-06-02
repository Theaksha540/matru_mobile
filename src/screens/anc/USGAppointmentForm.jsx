import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, TextInput, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Upload, Home } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { syncService } from '../../utils/syncService';
import { adminAPI, usgAppointmentAPI } from '../../services/api';
import { secureStorage } from '../../utils/secureStorage';
import { requestStoragePermission } from '../../utils/permissions';
import { formatDateDDMMYYYY } from '../../utils/dateFormat';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import '../../i18n';
const USGAppointmentForm = ({
  navigation,
  route
}) => {
  const {
    t
  } = useTranslation();
  const {
    patientId,
    patientName,
    appointmentToReschedule
  } = route?.params || {};
  const [patient, setPatient] = useState(null);
  const [usgCentres, setUsgCentres] = useState([]);
  const [selectedCentre, setSelectedCentre] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(new Date());
  const [appointmentTime, setAppointmentTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [prescriptionFiles, setPrescriptionFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const isReschedule = !!appointmentToReschedule;
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
  const isPatientApproved = patientData => {
    if (patientData?.is_self_registered === false) {
      return true;
    }
    const approvalValue = patientData?.registration_approved ?? patientData?.is_registration_approved;
    if (typeof approvalValue === 'boolean') return approvalValue;
    if (typeof approvalValue === 'number') return approvalValue === 1;
    if (typeof approvalValue === 'string') {
      const normalized = approvalValue.trim().toLowerCase();
      return normalized === 'true' || normalized === '1' || normalized === 'approved';
    }
    return false;
  };
  useEffect(() => {
    loadUserInfo();
    loadPatientData();
    loadUSGCentres();
  }, []);
  const loadUserInfo = async () => {
    try {
      const userData = await secureStorage.getItem('user_info');
      if (userData) {
        setUserInfo(userData);
      }
    } catch (error) {}
  };
  const isSameCalendarDay = (firstDate, secondDate) => {
    return firstDate.getFullYear() === secondDate.getFullYear() && firstDate.getMonth() === secondDate.getMonth() && firstDate.getDate() === secondDate.getDate();
  };
  const buildAppointmentDateTime = (date, time) => {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.getHours(), time.getMinutes(), 0, 0);
  };
  const loadPatientData = async () => {
    try {
      if (patientId) {
        const data = await syncService.getPatientById(patientId);
        if (data) {
          setPatient(data);
        } else {
          // Fallback to route params if available
          if (patientName) {
            setPatient({
              full_name: patientName,
              id: patientId
            });
          }
        }
      }
    } catch (error) {
      // Fallback to route params
      if (patientName) {
        setPatient({
          full_name: patientName,
          id: patientId
        });
      }
    }
  };
  const loadUSGCentres = async () => {
    try {
      const userData = await secureStorage.getItem('user_info');
      if (userData) {
        const params = {};
        if (userData.block_id) {
          params.block_id = userData.block_id;
        } else if (userData.district_id) {
          params.district_id = userData.district_id;
        }
        const centres = await syncService.getUSGCentres(params);
        setUsgCentres(centres);
      }
    } catch (error) {}
  };
  const handleDateChange = (event, date) => {
    setShowDatePicker(false);
    if (date) {
      setAppointmentDate(date);
      const now = new Date();
      if (isSameCalendarDay(date, now)) {
        const selectedDateTime = buildAppointmentDateTime(date, appointmentTime);
        if (selectedDateTime <= now) {
          setAppointmentTime(now);
        }
      }
    }
  };
  const handleTimeChange = (event, time) => {
    setShowTimePicker(false);
    if (time) {
      const now = new Date();
      const selectedDateTime = buildAppointmentDateTime(appointmentDate, time);
      if (isSameCalendarDay(appointmentDate, now) && selectedDateTime <= now) {
        Alert.alert(t('error'), t('selectFutureTimeForToday'));
        return;
      }
      setAppointmentTime(time);
    }
  };
  const handlePickFile = async () => {
    setShowUploadModal(true);
  };
  const appendPrescriptionFiles = files => {
    const validFiles = (Array.isArray(files) ? files : [files]).filter(Boolean);
    if (validFiles.length === 0) return;
    setPrescriptionFiles(prev => {
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
  const removePrescriptionFile = targetIndex => {
    setPrescriptionFiles(prev => prev.filter((_, index) => index !== targetIndex));
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
            Alert.alert(t('error'), 'File too large. Maximum size: 10MB');
            return;
          }
          normalizedFiles.push({
            uri: file.uri,
            name: file.fileName || `image_${Date.now()}_${normalizedFiles.length + 1}.jpg`,
            type: file.mimeType || 'image/jpeg',
            mimeType: file.mimeType || 'image/jpeg'
          });
        }
        appendPrescriptionFiles(normalizedFiles);
      }
    } catch (error) {
      Alert.alert(t('error'), 'Failed to pick image');
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
          Alert.alert(t('error'), 'File too large. Maximum size: 10MB');
          return;
        }
        appendPrescriptionFiles({
          uri: file.uri,
          name: file.fileName || `camera_${Date.now()}.jpg`,
          type: file.mimeType || 'image/jpeg',
          mimeType: file.mimeType || 'image/jpeg'
        });
      }
    } catch (error) {
      Alert.alert(t('error'), 'Failed to take photo');
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
        type: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
        copyToCacheDirectory: true,
        multiple: true
      });
      if (!result.canceled && result.assets?.length > 0) {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        const normalizedFiles = [];
        for (const file of result.assets) {
          if (file.size && file.size > 10 * 1024 * 1024) {
            Alert.alert(t('error'), 'File too large. Maximum size: 10MB');
            return;
          }
          if (file.mimeType && !allowedTypes.includes(file.mimeType.toLowerCase())) {
            Alert.alert(t('error'), 'Invalid file type. Allowed types: PDF, JPG, JPEG, PNG');
            return;
          }
          normalizedFiles.push({
            uri: file.uri,
            name: file.name || `document_${Date.now()}_${normalizedFiles.length + 1}`,
            type: file.mimeType || 'application/pdf',
            mimeType: file.mimeType || 'application/pdf'
          });
        }
        appendPrescriptionFiles(normalizedFiles);
      }
    } catch (error) {
      Alert.alert(t('error'), 'Failed to select file. Please check permissions.');
    }
  };
  const handleScheduleAppointment = async () => {
    if (!isPatientApproved(patient)) {
      Alert.alert(t('error'), t('approveBeforeUSG'));
      return;
    }
    if (!selectedCentre) {
      Alert.alert(t('error'), t('pleaseSelectUSGCentre'));
      return;
    }
    if (prescriptionFiles.length === 0 && !isReschedule) {
      Alert.alert(t('error'), t('pleaseUploadPrescription'));
      return;
    }
    if (isReschedule) {
      if (appointmentToReschedule.reschedule_count >= 1) {
        Alert.alert(t('error'), 'Appointment can only be rescheduled once');
        return;
      }
      if (appointmentToReschedule.appointment_type === 'emergency') {
        Alert.alert(t('error'), 'Emergency appointments cannot be rescheduled');
        return;
      }
      const originalDate = new Date(appointmentToReschedule.scheduled_date);
      const today = new Date();
      const daysSinceOriginal = Math.ceil((today - originalDate) / (1000 * 60 * 60 * 24));
      if (daysSinceOriginal > 7) {
        Alert.alert(t('error'), 'Reschedule must be done within 7 days of original appointment date');
        return;
      }
    }
    const selectedDateTime = buildAppointmentDateTime(appointmentDate, appointmentTime);
    if (selectedDateTime <= new Date()) {
      Alert.alert(t('error'), t('appointmentDateTimeMustBeFuture'));
      return;
    }
    setLoading(true);
    try {
      const formatDateForAPI = (date, time) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(time.getHours()).padStart(2, '0');
        const minutes = String(time.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}:00`;
      };
      const appointmentData = {
        pregnant_woman_id: parseInt(patientId),
        usg_centre_id: parseInt(selectedCentre),
        scheduled_date: formatDateForAPI(appointmentDate, appointmentTime),
        appointment_type: isEmergency ? 'emergency' : 'regular'
      };
      if (prescriptionFiles.length > 0) {
        appointmentData.prescription_files = prescriptionFiles.map((file, index) => ({
          uri: file.uri,
          type: file.mimeType || file.type || 'image/jpeg',
          name: file.name || `prescription_${index + 1}.jpg`
        }));
      }
      const isOnline = await syncService.isOnline();
      if (isOnline) {
        // Online: Save to server
        await usgAppointmentAPI.schedule(appointmentData);
        Alert.alert(t('success'), t('usgAppointmentBookedSuccessfully'), [{
          text: 'OK',
          onPress: () => navigation.goBack()
        }]);
      } else {
        // Offline: Save to local database
        const offlineData = {
          ...appointmentData,
          id: `offline_${Date.now()}`,
          sync_status: 'pending',
          created_offline: true
        };
        await syncService.saveOfflineUSGAppointment(offlineData);
        Alert.alert(t('success'), 'USG appointment scheduled offline - will sync when online', [{
          text: 'OK',
          onPress: () => navigation.goBack()
        }]);
      }
    } catch (error) {
      const errorDetail = error.response?.data?.detail;
      const errorText = typeof errorDetail === 'string' ? errorDetail : Array.isArray(errorDetail) ? JSON.stringify(errorDetail) : null;
      if (errorText) {
        if (errorText.includes('Invalid file type')) {
          Alert.alert(t('error'), 'Invalid file type. Allowed types: PDF, JPG, JPEG, PNG');
        } else if (errorText.includes('File too large')) {
          Alert.alert(t('error'), 'File too large. Maximum size: 10MB');
        } else if (errorText.includes('File content does not match')) {
          Alert.alert(t('error'), 'File content mismatch. Please check the file.');
        } else {
          Alert.alert(t('error'), errorText);
        }
      } else {
        Alert.alert(t('error'), t('failedToBookAppointment'));
      }
    } finally {
      setLoading(false);
    }
  };
  return <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={20} color="white" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>{t('bookUSG')} - {patientName}</Text>
            <Text style={styles.headerSubtitle}>USG ବୁକିଂ</Text>
          </View>
          <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
            <Home size={20} color="white" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Patient Details */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('patientDetails')}</Text>
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>{t('name')}:</Text>
                <Text style={styles.detailValue}>{patient?.full_name}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>{t('age')}:</Text>
                <Text style={styles.detailValue}>{patient?.age} {t('years')}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>{t('mobile')}:</Text>
                <Text style={styles.detailValue}>{patient?.mobile_number}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>RCH ID:</Text>
                <Text style={styles.detailValue}>{patient?.rch_id || 'N/A'}</Text>
              </View>
              <View style={[styles.detailItem, styles.fullWidth]}>
                <Text style={styles.detailLabel}>EDD:</Text>
                <Text style={styles.detailValue}>{patient?.edd_date}</Text>
              </View>
              <View style={[styles.detailItem, styles.fullWidth]}>
                <Text style={styles.detailLabel}>Approval:</Text>
                <Text style={[styles.detailValue, isPatientApproved(patient) ? styles.approvedText : styles.notApprovedText]}>
                  {isPatientApproved(patient) ? 'Approved' : 'Not Approved'}
                </Text>
              </View>
            </View>
          </View>

          {/* USG Booking Details */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('usgBookingDetails')}</Text>
            
            {/* USG Centre */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('selectUSGCentre')} *</Text>
              <View style={styles.pickerContainer}>
                <Picker selectedValue={selectedCentre} onValueChange={setSelectedCentre} style={styles.picker}>
                  <Picker.Item label={t('selectUSGCentre')} value="" />
                  {usgCentres.map(centre => <Picker.Item key={centre.id} label={centre.name} value={centre.id} />)}
                </Picker>
              </View>
            </View>

            {/* USG Date */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('usgDate')} *</Text>
              <TouchableOpacity style={styles.dateInput} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.dateText}>{formatDateDDMMYYYY(appointmentDate)}</Text>
              </TouchableOpacity>
              {showDatePicker && <DateTimePicker value={appointmentDate} mode="date" display="default" onChange={handleDateChange} minimumDate={new Date()} />}
            </View>

            {/* USG Time */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('usgTimeLabel')} *</Text>
              <TouchableOpacity style={styles.dateInput} onPress={() => setShowTimePicker(true)}>
                <Text style={styles.dateText}>{appointmentTime.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</Text>
              </TouchableOpacity>
              {showTimePicker && <DateTimePicker value={appointmentTime} mode="time" display="default" onChange={handleTimeChange} />}
            </View>

            {/* Prescription Upload */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('doctorsPrescription')} *</Text>
              <TouchableOpacity style={styles.uploadBox} onPress={handlePickFile}>
                <Upload size={32} color="#9ca3af" />
                <Text style={styles.uploadText}>
                  {prescriptionFiles.length > 0 ? 'Add more' : t('clickToUploadPrescription')}
                </Text>
                <Text style={styles.uploadHint}>PDF, JPG, JPEG, PNG (Max 10MB)</Text>
              </TouchableOpacity>
              {prescriptionFiles.map((file, index) => <View key={`${file.uri}_${index}`} style={styles.selectedFileRow}>
                  <Text style={styles.selectedFileText} numberOfLines={1}>
                    {file.name || `Prescription ${index + 1}`}
                  </Text>
                  <TouchableOpacity onPress={() => removePrescriptionFile(index)}>
                    <Text style={styles.removeFileText}>{t('remove') || 'Remove'}</Text>
                  </TouchableOpacity>
                </View>)}
            </View>

            {/* Emergency Checkbox */}
            <TouchableOpacity style={styles.emergencyBox} onPress={() => setIsEmergency(!isEmergency)}>
              <View style={[styles.checkbox, isEmergency && styles.checkboxChecked]}>
                {isEmergency && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <View style={styles.emergencyText}>
                <Text style={styles.emergencyTitle}>{t('markAsEmergency')}</Text>
                <Text style={styles.emergencySubtitle}>{t('cannotBeRescheduled')}</Text>
              </View>
            </TouchableOpacity>

            {/* Book Button */}
            <TouchableOpacity style={[styles.bookButton, (!selectedCentre || (!isReschedule && prescriptionFiles.length === 0) || loading || !isPatientApproved(patient)) && styles.bookButtonDisabled]} onPress={handleScheduleAppointment} disabled={!selectedCentre || !isReschedule && prescriptionFiles.length === 0 || loading || !isPatientApproved(patient)}>
              <Text style={styles.bookButtonText}>
                {loading ? t('booking') : t('bookUSGAppointment')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>      {/* Upload Modal */}
      <Modal visible={showUploadModal} transparent animationType="fade">
        <View style={styles.uploadModalOverlay}>
          <View style={styles.uploadModalContent}>
            <Text style={styles.uploadModalTitle}>{t('uploadPrescriptionTitle')}</Text>
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
              <Text style={styles.uploadCancelText}>{t('cancelLabel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>;
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fad5a5'
  },
  keyboardAvoidingView: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 50
  },
  header: {
    backgroundColor: '#D2691E',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  backButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitleContainer: {
    flex: 1
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginBottom: 2
  },
  headerSubtitle: {
    fontSize: 11,
    color: 'white',
    opacity: 0.9
  },
  homeButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  content: {
    padding: 20
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1f2937'
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  detailItem: {
    width: '48%',
    fontSize: 13,
    color: '#6b7280'
  },
  fullWidth: {
    width: '100%'
  },
  detailLabel: {
    fontWeight: '600',
    color: '#1f2937'
  },
  detailValue: {
    color: '#6b7280'
  },
  approvedText: {
    color: '#166534',
    fontWeight: '600'
  },
  notApprovedText: {
    color: '#991b1b',
    fontWeight: '600'
  },
  inputGroup: {
    marginBottom: 16
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: 'white'
  },
  picker: {
    height: 50
  },
  dateInput: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: 'white'
  },
  dateText: {
    fontSize: 14,
    color: '#1f2937'
  },
  uploadBox: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#f9fafb'
  },
  uploadText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8
  },
  uploadHint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4
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
  emergencyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fbbf24',
    borderRadius: 8,
    marginBottom: 16
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: '#92400e',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxChecked: {
    backgroundColor: '#92400e'
  },
  checkmark: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600'
  },
  emergencyText: {
    flex: 1
  },
  emergencyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e'
  },
  emergencySubtitle: {
    fontSize: 12,
    color: '#92400e',
    marginTop: 2
  },
  bookButton: {
    width: '100%',
    padding: 14,
    backgroundColor: '#D2691E',
    borderRadius: 8,
    alignItems: 'center'
  },
  bookButtonDisabled: {
    backgroundColor: '#d1d5db'
  },
  bookButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600'
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
    backgroundColor: '#D2691E',
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
export default USGAppointmentForm;
