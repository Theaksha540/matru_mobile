import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform, KeyboardAvoidingView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ArrowLeft, Calendar, Globe } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { switchLanguage, getCurrentLanguage } from '../../i18n';
import { adminAPI, pregnantWomenAPI } from '../../services/api';
import LanguageToggle from '../../components/LanguageToggle';
import KeyboardSafeModal from '../../components/KeyboardSafeModal';
import { formatDateDDMMYYYY } from '../../utils/dateFormat';
import '../../i18n';
const SelfRegisterScreen = ({
  navigation
}) => {
  const {
    t
  } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    husbandName: '',
    mobileNumber: '',
    age: '',
    date_of_birth: '',
    blockId: '',
    wardId: '',
    fullAddress: ''
  });
  const [blocks, setBlocks] = useState([]);
  const [wards, setWards] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('or');
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showWardModal, setShowWardModal] = useState(false);
  const [blockSearch, setBlockSearch] = useState('');
  const [wardSearch, setWardSearch] = useState('');
  const [mobileError, setMobileError] = useState('');
  const [isCheckingMobileDuplicate, setIsCheckingMobileDuplicate] = useState(false);
  const [mobileDuplicateExists, setMobileDuplicateExists] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const duplicateMobileAlertRef = React.useRef('');
  useEffect(() => {
    loadDistricts();
    loadBlocks();
    // Don't start sync service for guest users
  }, []);
  useEffect(() => {
    if (formData.blockId) {
      loadWards(formData.blockId);
    } else {
      setWards([]);
      setFormData(prev => ({
        ...prev,
        wardId: ''
      }));
    }
  }, [formData.blockId]);

  // Duplicate mobile number check
  useEffect(() => {
    let isCancelled = false;
    const checkDuplicateMobile = async () => {
      if (formData.mobileNumber.length === 0) {
        setMobileDuplicateExists(false);
        setIsCheckingMobileDuplicate(false);
        duplicateMobileAlertRef.current = '';
        return;
      }
      if (formData.mobileNumber.length !== 10) {
        setMobileDuplicateExists(false);
        setIsCheckingMobileDuplicate(false);
        duplicateMobileAlertRef.current = '';
        return;
      }

      // Skip validation check if there's already a format error
      const formatError = validateMobileNumber(formData.mobileNumber);
      if (formatError) {
        setMobileDuplicateExists(false);
        setIsCheckingMobileDuplicate(false);
        return;
      }
      setIsCheckingMobileDuplicate(true);
      try {
        const result = await pregnantWomenAPI.searchByMobile(formData.mobileNumber);
        if (!isCancelled) {
          // If API returns data, it means duplicate exists
          const hasDuplicate = result && (result.id || result.mobile_number);
          setMobileDuplicateExists(hasDuplicate);
          if (hasDuplicate && duplicateMobileAlertRef.current !== formData.mobileNumber) {
            duplicateMobileAlertRef.current = formData.mobileNumber;
            Alert.alert(t('error'), t('duplicateMobileNumber'));
          } else if (!hasDuplicate) {
            duplicateMobileAlertRef.current = '';
          }
        }
      } catch (error) {
        if (!isCancelled) {
          if (error?.response?.status === 404) {
            // 404 means mobile number not found - no duplicate

            setMobileDuplicateExists(false);
            duplicateMobileAlertRef.current = '';
          } else {
            // Network or other errors - don't block submission but log it

            setMobileDuplicateExists(false);
            duplicateMobileAlertRef.current = '';
          }
        }
      } finally {
        if (!isCancelled) {
          setIsCheckingMobileDuplicate(false);
        }
      }
    };
    const timeoutId = setTimeout(checkDuplicateMobile, 400);
    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [formData.mobileNumber]);
  const loadDistricts = async () => {
    try {
      const data = await adminAPI.getDistricts();
      setDistricts(data);
    } catch (error) {}
  };
  const loadBlocks = async () => {
    try {
      // Direct API call without sync service for guest users
      const data = await adminAPI.getBlocks();
      setBlocks(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load blocks. Please check your connection.');
    }
  };
  const loadWards = async blockId => {
    try {
      // Direct API call without sync service for guest users
      const data = await adminAPI.getWards({
        block_id: blockId
      });
      setWards(data);
    } catch (error) {}
  };
  const handleDateChange = (event, date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
      const formattedDate = formatDateDDMMYYYY(date); // DD-MM-YYYY format
      const isoDate = date.toISOString().split('T')[0]; // Keep ISO for API

      // Calculate age from date of birth
      const today = new Date();
      let age = today.getFullYear() - date.getFullYear();
      const monthDiff = today.getMonth() - date.getMonth();
      if (monthDiff < 0 || monthDiff === 0 && today.getDate() < date.getDate()) {
        age--;
      }
      setFormData({
        ...formData,
        date_of_birth: isoDate,
        date_of_birth_display: formattedDate,
        age: age.toString()
      });
      if (age < 18 || age > 49) {
        Alert.alert(t('error'), t('ageMustBe18To49'));
      }
    }
  };
  const isAgeValid = (() => {
    const ageNumber = parseInt(formData.age, 10);
    return !Number.isNaN(ageNumber) && ageNumber >= 18 && ageNumber <= 49;
  })();
  const showDatepicker = () => {
    setShowDatePicker(true);
  };
  const validateMobileNumber = mobile => {
    // Remove any non-digit characters
    const cleaned = mobile.replace(/\D/g, '');

    // Check if empty
    if (!cleaned) {
      return 'Mobile number is required';
    }

    // Check length
    if (cleaned.length !== 10) {
      return 'Mobile number must be exactly 10 digits';
    }

    // Check if it starts with valid digits (6-9)
    if (!/^[6-9]/.test(cleaned)) {
      return 'Mobile number must start with 6, 7, 8, or 9';
    }

    // Check for invalid patterns
    // All same digits (e.g., 9999999999)
    if (/^(\d)\1{9}$/.test(cleaned)) {
      return 'Invalid mobile number pattern';
    }

    // Sequential digits (e.g., 1234567890)
    const isSequential = cleaned.split('').every((digit, index) => {
      if (index === 0) return true;
      return parseInt(digit) === parseInt(cleaned[index - 1]) + 1;
    });
    if (isSequential) {
      return 'Invalid mobile number pattern';
    }
    return ''; // Valid
  };
  const handleMobileNumberChange = text => {
    // Only allow digits
    const cleaned = text.replace(/\D/g, '');

    // Limit to 10 digits
    const limited = cleaned.slice(0, 10);
    setFormData({
      ...formData,
      mobileNumber: limited
    });

    // Validate and show error
    if (limited.length > 0) {
      const error = validateMobileNumber(limited);
      setMobileError(error);
    } else {
      setMobileError('');
    }
  };
  const getRegistrationErrorMessage = error => {
    const responseData = error?.response?.data;
    const duplicateMobilePatterns = [responseData?.detail, responseData?.message, error?.message].filter(value => typeof value === 'string').map(value => value.toLowerCase());
    const hasDuplicateMobileError = duplicateMobilePatterns.some(value => value.includes('mobile') && (value.includes('already') || value.includes('duplicate') || value.includes('exists') || value.includes('registered')));
    if (hasDuplicateMobileError) {
      return t('duplicateMobileNumber');
    }
    if (typeof responseData === 'string' && responseData.trim()) {
      return responseData;
    }
    if (typeof responseData?.detail === 'string' && responseData.detail.trim()) {
      return responseData.detail;
    }
    if (Array.isArray(responseData?.detail) && responseData.detail.length > 0) {
      return responseData.detail.map(item => {
        if (typeof item === 'string') return item;
        if (typeof item?.msg === 'string' && item.msg.trim()) return item.msg;
        return null;
      }).filter(Boolean).join('\n');
    }
    if (Array.isArray(responseData?.errors) && responseData.errors.length > 0) {
      return responseData.errors.map(item => {
        if (typeof item === 'string') return item;
        if (typeof item?.msg === 'string' && item.msg.trim()) return item.msg;
        return null;
      }).filter(Boolean).join('\n');
    }
    if (responseData && typeof responseData === 'object') {
      const fieldErrors = Object.entries(responseData).map(([field, value]) => {
        if (field.toLowerCase().includes('mobile') && (Array.isArray(value) && value.some(item => String(item).toLowerCase().includes('duplicate') || String(item).toLowerCase().includes('already') || String(item).toLowerCase().includes('exists') || String(item).toLowerCase().includes('registered')) || typeof value === 'string' && ['duplicate', 'already', 'exists', 'registered'].some(pattern => value.toLowerCase().includes(pattern)))) {
          return t('duplicateMobileNumber');
        }
        if (Array.isArray(value)) {
          const joinedValue = value.filter(Boolean).join(', ');
          return joinedValue ? `${field}: ${joinedValue}` : null;
        }
        if (typeof value === 'string' && value.trim()) {
          return `${field}: ${value}`;
        }
        return null;
      }).filter(Boolean);
      if (fieldErrors.length > 0) {
        return fieldErrors.join('\n');
      }
    }
    if (typeof error?.message === 'string' && error.message.trim()) {
      return error.message;
    }
    return t('failedToSubmitRegistration');
  };
  const handleSubmit = async () => {
    if (!formData.name || !formData.mobileNumber || !formData.blockId || !formData.husbandName  || !formData.age || !formData.fullAddress || !formData.date_of_birth) {
      Alert.alert(t('error'), t('pleaseEnterMandatoryFields'));
      return;
    }

    // Ward validation: if block has wards, ward selection is mandatory
    if (formData.blockId && wards.length > 0 && !formData.wardId) {
      Alert.alert(t('error'), 'Ward selection is mandatory for this block');
      return;
    }

    // Validate mobile number
    const mobileValidationError = validateMobileNumber(formData.mobileNumber);
    if (mobileValidationError) {
      Alert.alert(t('error'), mobileValidationError);
      return;
    }

    // Check for duplicate mobile number
    if (mobileDuplicateExists) {
      Alert.alert(t('error'), t('duplicateMobileNumber'));
      return;
    }
    const ageNumber = parseInt(formData.age, 10);
    if (Number.isNaN(ageNumber) || ageNumber < 18 || ageNumber > 49) {
      Alert.alert(t('error'), t('ageMustBe18To49'));
      return;
    }
    setIsSubmitting(true);
    try {
      const submitData = {
        full_name: formData.name,
        husband_name: formData.husbandName,
        mobile_number: formData.mobileNumber,
        age: parseInt(formData.age) || 0,
        date_of_birth: formData.date_of_birth || null,
        block_id: parseInt(formData.blockId),
        district_id: districts.find(d => blocks.find(b => b.id === parseInt(formData.blockId))?.district_id === d.id)?.id || 1,
        full_address: formData.fullAddress
      };
      if (formData.wardId) {
        submitData.ward_id = parseInt(formData.wardId);
      }
      await pregnantWomenAPI.selfRegister(submitData);
      setShowSuccessModal(true);
    } catch (error) {
      const errorMessage = getRegistrationErrorMessage(error);
      Alert.alert(t('error'), errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };
  return <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('selfRegister')}</Text>
        <LanguageToggle style={styles.languageToggle} />
      </View>

      <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('fullName')} *</Text>
              <TextInput style={styles.input} placeholder={t('enterFullName')} value={formData.name} onChangeText={text => setFormData({
              ...formData,
              name: text
            })} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('mobileNumber')} *</Text>
              <TextInput style={[styles.input, mobileError && formData.mobileNumber.length > 0 || mobileDuplicateExists ? styles.inputError : null]} placeholder={t('mobile10Digit')} value={formData.mobileNumber} onChangeText={handleMobileNumberChange} keyboardType="phone-pad" maxLength={10} />
              {mobileError && formData.mobileNumber.length > 0 && <Text style={styles.errorText}>{mobileError}</Text>}
              {!mobileError && isCheckingMobileDuplicate && <Text style={styles.helperText}>Checking mobile number...</Text>}
              {!mobileError && mobileDuplicateExists && <Text style={styles.errorText}>{t('duplicateMobileNumber')}</Text>}
              {formData.mobileNumber.length === 10 && !mobileError && !mobileDuplicateExists && !isCheckingMobileDuplicate && <Text style={styles.successText}>✓ Valid mobile number</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('selectBlock')} *</Text>
              <TouchableOpacity style={styles.selectButton} onPress={() => setShowBlockModal(true)}>
                <Text style={formData.blockId ? styles.selectTextFilled : styles.selectText}>
                  {blocks.find(b => b.id === formData.blockId)?.name || t('selectBlock')}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('selectWard')} {wards.length > 0 ? '*' : ''}</Text>
              <TouchableOpacity style={styles.selectButton} onPress={() => wards.length > 0 && setShowWardModal(true)} disabled={!formData.blockId || wards.length === 0}>
                <Text style={formData.wardId ? styles.selectTextFilled : styles.selectText}>
                  {wards.find(w => w.id === formData.wardId)?.name || (formData.blockId ? wards.length > 0 ? t('selectWard') : 'No ward selection needed' : t('selectBlockFirst'))}
                </Text>
              </TouchableOpacity>
              {wards.length > 0 && !formData.wardId && <Text style={styles.noteText}>* Ward selection is mandatory for this block</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('husbandName')} *</Text>
              <TextInput style={styles.input} placeholder={t('enterHusbandName')} value={formData.husbandName} onChangeText={text => setFormData({
              ...formData,
              husbandName: text
            })} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('dateOfBirth')} *</Text>
              <TouchableOpacity style={styles.datePickerButton} onPress={showDatepicker}>
                <Calendar size={20} color="#6b7280" style={styles.calendarIcon} />
                <Text style={formData.date_of_birth_display ? styles.dateText : styles.datePlaceholder}>
                  {formData.date_of_birth_display || t('selectDate')}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('age')}</Text>
              <TextInput style={[styles.input, {
              backgroundColor: '#f3f4f6',
              color: '#6b7280'
            }]} placeholder={t('enterAge')} value={formData.age} editable={false} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('fullAddress')} *</Text>
              <TextInput style={[styles.input, styles.textArea]} placeholder={t('enterFullAddress')} value={formData.fullAddress} onChangeText={text => setFormData({
              ...formData,
              fullAddress: text
            })} multiline numberOfLines={3} textAlignVertical="top" />
            </View>

            <TouchableOpacity style={[styles.submitButton, (isSubmitting || !isAgeValid || !!mobileError || mobileDuplicateExists || isCheckingMobileDuplicate) && styles.disabledButton]} onPress={handleSubmit} disabled={isSubmitting || !!mobileError || mobileDuplicateExists || isCheckingMobileDuplicate}>
              <Text style={styles.submitText}>
                {isSubmitting ? t('submitting') : t('submitRegistration')}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <Modal visible={showSuccessModal} transparent={true} animationType="fade" onRequestClose={() => {
      setShowSuccessModal(false);
      navigation.navigate('Login');
    }}>
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalContent}>
            <View style={styles.successIconContainer}>
              <Text style={styles.successIcon}>✓</Text>
            </View>
            <Text style={styles.successModalTitle}>{t('registrationSuccessful')}</Text>
            <Text style={styles.successModalMessage}>
              {t('registrationReceivedSuccessfully')}
            </Text>
            <Text style={styles.successModalMessage}>
              {t('visitWebsiteForStatus')}
            </Text>
            <TouchableOpacity onPress={async () => {
            try {
              await WebBrowser.openBrowserAsync('https://www.nirikhyanapuri.in/', {
                toolbarColor: '#D2691E',
                controlsColor: '#ffffff',
                showTitle: true,
                enableBarCollapsing: false
              });
            } catch (error) {}
          }}>
              <Text style={styles.successModalWebsite}>www.nirikhyanapuri.in</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.successModalButton} onPress={async () => {
            try {
              await WebBrowser.openBrowserAsync('https://www.nirikhyanapuri.in/', {
                toolbarColor: '#D2691E',
                controlsColor: '#ffffff',
                showTitle: true,
                enableBarCollapsing: false
              });
              setShowSuccessModal(false);
              navigation.navigate('Login');
            } catch (error) {
              setShowSuccessModal(false);
              navigation.navigate('Login');
            }
          }}>
              <Text style={styles.successModalButtonText}>{t('visitWebsite')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.successModalCloseButton} onPress={() => {
            setShowSuccessModal(false);
            navigation.navigate('Login');
          }}>
              <Text style={styles.successModalCloseText}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {showDatePicker && <DateTimePicker testID="dateTimePicker" value={selectedDate} mode="date" is24Hour={true} display="default" onChange={handleDateChange} maximumDate={new Date()} />}

      {/* Block Modal */}
      <KeyboardSafeModal visible={showBlockModal} position="center" onRequestClose={() => {
      setShowBlockModal(false);
      setBlockSearch('');
    }} closeOnBackdropPress={true}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t('selectBlock')}</Text>
          <TouchableOpacity onPress={() => {
          setShowBlockModal(false);
          setBlockSearch('');
        }}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <TextInput style={styles.searchInput} placeholder="Search block..." value={blockSearch} onChangeText={setBlockSearch} />
        <ScrollView style={{
        maxHeight: 400
      }} keyboardShouldPersistTaps="handled">
          {blocks.filter(block => block.name.toLowerCase().includes(blockSearch.toLowerCase())).map(block => <TouchableOpacity key={block.id} style={styles.modalOption} onPress={() => {
          setFormData({
            ...formData,
            blockId: block.id,
            wardId: ''
          });
          setShowBlockModal(false);
          setBlockSearch('');
        }}>
                <Text style={styles.modalOptionText}>{block.name}</Text>
              </TouchableOpacity>)}
        </ScrollView>
      </KeyboardSafeModal>

      {/* Ward Modal */}
      <KeyboardSafeModal visible={showWardModal} position="center" onRequestClose={() => {
      setShowWardModal(false);
      setWardSearch('');
    }} closeOnBackdropPress={true}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t('selectWard')}</Text>
          <TouchableOpacity onPress={() => {
          setShowWardModal(false);
          setWardSearch('');
        }}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <TextInput style={styles.searchInput} placeholder="Search ward..." value={wardSearch} onChangeText={setWardSearch} />
        <ScrollView style={{
        maxHeight: 400
      }} keyboardShouldPersistTaps="handled">
          {wards.filter(ward => ward.name.toLowerCase().includes(wardSearch.toLowerCase())).map(ward => <TouchableOpacity key={ward.id} style={styles.modalOption} onPress={() => {
          setFormData({
            ...formData,
            wardId: ward.id
          });
          setShowWardModal(false);
          setWardSearch('');
        }}>
                <Text style={styles.modalOptionText}>{ward.name}</Text>
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
    backgroundColor: '#D2691E',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  backButton: {
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
    color: 'white'
  },
  keyboardAvoidingView: {
    flex: 1
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12
  },
  scrollContent: {
    paddingBottom: 10
  },
  form: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20
  },
  inputGroup: {
    marginBottom: 16
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6
  },
  input: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    fontSize: 16,
    backgroundColor: '#ffffff'
  },

  textArea: {
    minHeight: 80
  },
  pickerContainer: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: '#ffffff'
  },
  picker: {
    height: 60
  },
  datePickerButton: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginBottom: 16
  },
  calendarIcon: {
    marginRight: 12
  },
  dateText: {
    fontSize: 16,
    color: '#111827'
  },
  datePlaceholder: {
    fontSize: 16,
    color: '#9ca3af'
  },
  submitButton: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#8B4513',
    alignItems: 'center',
    marginTop: 20
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
    opacity: 0.6
  },
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 2
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
    marginBottom: 8
  },
  successText: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 4,
    marginBottom: 8
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 8
  },
  submitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600'
  },
  uploadButton: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginBottom: 16,
    gap: 8
  },
  uploadText: {
    fontSize: 14,
    color: '#6b7280'
  },
  comingSoon: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 16,
    marginTop: 40
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
    backgroundColor: '#8b4513',
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
  },
  languageToggle: {
    marginLeft: 'auto'
  },
  selectButton: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    marginBottom: 16,
    justifyContent: 'center'
  },
  selectText: {
    fontSize: 16,
    color: '#9ca3af'
  },
  selectTextFilled: {
    fontSize: 16,
    color: '#111827'
  },
  noteText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: -12,
    marginBottom: 16,
    fontStyle: 'italic'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937'
  },
  modalClose: {
    fontSize: 24,
    color: '#6B7280'
  },
  searchInput: {
    margin: 16,
    marginTop: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    fontSize: 14,
    backgroundColor: '#F9FAFB'
  },
  modalOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  modalOptionText: {
    fontSize: 16,
    color: '#374151'
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  successModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20
  },
  successIcon: {
    fontSize: 48,
    color: '#059669',
    fontWeight: 'bold'
  },
  successModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#059669',
    marginBottom: 16,
    textAlign: 'center'
  },
  successModalMessage: {
    fontSize: 15,
    color: '#4B5563',
    marginBottom: 12,
    textAlign: 'center',
    lineHeight: 22
  },
  successModalWebsite: {
    fontSize: 16,
    color: '#D2691E',
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 24,
    textAlign: 'center',
    textDecorationLine: 'underline'
  },
  successModalButton: {
    backgroundColor: '#D2691E',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12
  },
  successModalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600'
  },
  successModalCloseButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center'
  },
  successModalCloseText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600'
  }
});
export default SelfRegisterScreen;

