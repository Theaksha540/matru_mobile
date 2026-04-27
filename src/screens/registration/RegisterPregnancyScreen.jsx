import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Home } from 'lucide-react-native';
import { secureStorage } from '../../utils/secureStorage';
import { syncService } from '../../utils/syncService';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { pregnantWomenAPI } from '../../services/api';
import KeyboardSafeModal from '../../components/KeyboardSafeModal';
import { formatDateDDMMYYYY } from '../../utils/dateFormat';
import '../../i18n';

const RegisterPregnancyScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    full_name: '',
    husband_name: '',
    age: '',
    mobile_number: '',
    aadhaar_number: '',
    abha_id: '',
    rch_id: '',
    hpr_id: '',
    block_id: '',
    ward_id: '',
    address: '',
    date_of_birth: '',
    lmp_date: '',
    edd_date: '',
    gravida: '',
    para: '',
    blood_group: '',
    is_high_risk: false,
    risk_factors: '',
  });

  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showWardModal, setShowWardModal] = useState(false);
  const [blocks, setBlocks] = useState([]);
  const [wards, setWards] = useState([]);
  const [blockSearch, setBlockSearch] = useState('');
  const [wardSearch, setWardSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [isCheckingMobileDuplicate, setIsCheckingMobileDuplicate] = useState(false);
  const [mobileDuplicateExists, setMobileDuplicateExists] = useState(false);
  
  // Date picker states
  const [showDOBPicker, setShowDOBPicker] = useState(false);
  const [showLMPPicker, setShowLMPPicker] = useState(false);
  const [showEDDPicker, setShowEDDPicker] = useState(false);
  
  // Risk factors modal
  const [showRiskFactorsModal, setShowRiskFactorsModal] = useState(false);
  const riskFactorsOptions = [
    'Diabetes', 'Hypertension', 'Heart Disease', 'Thyroid Disorder',
    'Asthma', 'Anemia', 'Previous C-section', 'Multiple Pregnancy',
    'Age > 35', 'Age < 18', 'HIV Positive', 'History of Miscarriage'
  ];
  const [selectedRiskFactors, setSelectedRiskFactors] = useState([]);
  
  const aadhaarRef1 = React.useRef(null);
  const aadhaarRef2 = React.useRef(null);
  const aadhaarRef3 = React.useRef(null);
  const duplicateMobileAlertRef = React.useRef('');

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
    loadData();
  }, []);

  useEffect(() => {
    if (formData.block_id) {
      loadWards(formData.block_id);
    }
  }, [formData.block_id]);

  useEffect(() => {
    let isCancelled = false;

    const checkDuplicateMobile = async () => {
      if (formData.mobile_number.length === 0) {
        setMobileDuplicateExists(false);
        setIsCheckingMobileDuplicate(false);
        duplicateMobileAlertRef.current = '';
        return;
      }

      if (formData.mobile_number.length !== 10) {
        setMobileDuplicateExists(false);
        setIsCheckingMobileDuplicate(false);
        duplicateMobileAlertRef.current = '';
        return;
      }

      setIsCheckingMobileDuplicate(true);

      try {
        const isOnline = await syncService.isOnline();
        if (!isOnline) {
          if (!isCancelled) {
            setMobileDuplicateExists(false);
            setIsCheckingMobileDuplicate(false);
          }
          return;
        }

        const result = await pregnantWomenAPI.searchByMobile(formData.mobile_number);
        if (!isCancelled) {
          const hasDuplicate = !!result;
          setMobileDuplicateExists(hasDuplicate);

          if (hasDuplicate && duplicateMobileAlertRef.current !== formData.mobile_number) {
            duplicateMobileAlertRef.current = formData.mobile_number;
            Alert.alert(t('error'), t('duplicateMobileNumber'));
          }
        }
      } catch (error) {
        if (!isCancelled) {
          if (error?.response?.status === 404) {
            setMobileDuplicateExists(false);
            duplicateMobileAlertRef.current = '';
          } else {
            setMobileDuplicateExists(false);
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
  }, [formData.mobile_number]);

  const loadData = async () => {
    try {
      const userData = await secureStorage.getItem('user_info');
      if (userData) {
        const user = userData;
        setUserInfo(user);
        
        // Auto-fetch block for sub-centre users
        if (user.role === 'sub_centre' && user.block_id) {
          const blocksData = await syncService.getBlocks();
          const userBlock = blocksData.find(b => b.id === user.block_id);
          if (userBlock) {
            setBlocks([userBlock]);
            setFormData(prev => ({ ...prev, block_id: user.block_id }));
          }
        } else if (user.district_id) {
          const blocksData = await syncService.getBlocks();
          setBlocks(blocksData);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWards = async (blockId) => {
    try {
      const wardsData = await syncService.getWards(blockId);
      setWards(wardsData);
    } catch (error) {
      console.error('Error loading wards:', error);
    }
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!formData.full_name || !formData.husband_name || !formData.age || !formData.mobile_number || !formData.address || !formData.aadhaar_number) {
        Alert.alert(t('error'), t('pleaseEnterAllRequiredFields'));
        return;
      }
      const ageNumber = parseInt(formData.age, 10);
      if (Number.isNaN(ageNumber) || ageNumber < 18 || ageNumber > 49) {
        Alert.alert(t('error'), t('ageMustBe18To49'));
        return;
      }
      if (formData.mobile_number.length !== 10) {
        Alert.alert(t('error'), t('mobileNumberMust10Digits'));
        return;
      }
      if (mobileDuplicateExists) {
        Alert.alert(t('error'), t('duplicateMobileNumber'));
        return;
      }
      if (formData.aadhaar_number.length !== 12) {
        Alert.alert(t('error'), 'Aadhaar number must be 12 digits');
        return;
      }
      
      // Ward validation: if block has wards, ward selection is mandatory
      if (formData.block_id && wards.length > 0 && !formData.ward_id) {
        Alert.alert(t('error'), 'Ward selection is mandatory for this block');
        return;
      }
      
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!formData.lmp_date || !formData.edd_date || !formData.blood_group) {
        Alert.alert(t('error'), 'LMP date, EDD date, and blood group are required');
        return;
      }
      setCurrentStep(3);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleRiskFactorToggle = (factor) => {
    if (selectedRiskFactors.includes(factor)) {
      setSelectedRiskFactors(selectedRiskFactors.filter(f => f !== factor));
    } else {
      setSelectedRiskFactors([...selectedRiskFactors, factor]);
    }
  };

  const calculateEDD = (lmpDate) => {
    if (!lmpDate) return { edd_date: '', edd_date_display: '' };
    const lmp = new Date(lmpDate);
    const edd = new Date(lmp);
    edd.setDate(edd.getDate() + 280); // Add 280 days (40 weeks)
    return {
      edd_date: edd.toISOString().split('T')[0],
      edd_date_display: formatDateDDMMYYYY(edd)
    };
  };

  const handleDateChange = (event, selectedDate, type) => {
    const currentDate = selectedDate || new Date();
    
    if (Platform.OS === 'android') {
      if (type === 'dob') setShowDOBPicker(false);
      if (type === 'lmp') setShowLMPPicker(false);
      if (type === 'edd') setShowEDDPicker(false);
    }

    const formattedDate = formatDateDDMMYYYY(currentDate); // DD-MM-YYYY format
    const isoDate = currentDate.toISOString().split('T')[0]; // Keep ISO for API
    
    if (type === 'dob') {
      // Calculate age from date of birth
      const today = new Date();
      const birthDate = new Date(currentDate);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
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
    } else if (type === 'lmp') {
      const eddResult = calculateEDD(isoDate);
      setFormData({ 
        ...formData, 
        lmp_date: isoDate,
        lmp_date_display: formattedDate,
        edd_date: eddResult.edd_date,
        edd_date_display: eddResult.edd_date_display
      });
    } else if (type === 'edd') {
      setFormData({ 
        ...formData, 
        edd_date: isoDate,
        edd_date_display: formattedDate
      });
    }
  };

  const isAgeValid = (() => {
    const ageNumber = parseInt(formData.age, 10);
    return !Number.isNaN(ageNumber) && ageNumber >= 18 && ageNumber <= 49;
  })();

  const isMobileValid = formData.mobile_number.length === 10;
  const shouldShowMobileError =
    currentStep === 1 &&
    formData.mobile_number.length > 0 &&
    !isMobileValid;
  const shouldShowDuplicateMobileError =
    currentStep === 1 &&
    isMobileValid &&
    mobileDuplicateExists;

  const handleSubmit = async () => {
    if (!formData.full_name || !formData.husband_name || !formData.age || !formData.mobile_number || !formData.address || !formData.aadhaar_number) {
      Alert.alert(t('error'), t('pleaseEnterAllRequiredFields'));
      return;
    }
    if (!formData.lmp_date || !formData.edd_date || !formData.blood_group) {
      Alert.alert(t('error'), 'LMP date, EDD date, and blood group are required');
      return;
    }
    const ageNumber = parseInt(formData.age, 10);
    if (Number.isNaN(ageNumber) || ageNumber < 18 || ageNumber > 49) {
      Alert.alert(t('error'), t('ageMustBe18To49'));
      return;
    }

    if (!isMobileValid) {
      Alert.alert(t('error'), t('mobileNumberMust10Digits'));
      return;
    }

    if (mobileDuplicateExists) {
      Alert.alert(t('error'), t('duplicateMobileNumber'));
      return;
    }
    
    if (formData.aadhaar_number.length !== 12) {
      Alert.alert(t('error'), 'Aadhaar number must be 12 digits');
      return;
    }
    
    // Ward validation for submit
    if (formData.block_id && wards.length > 0 && !formData.ward_id) {
      Alert.alert(t('error'), 'Ward selection is mandatory for this block');
      return;
    }

    setSubmitting(true);
    try {
      const submitData = {
        ...formData,
        age: parseInt(formData.age),
        gravida: formData.gravida ? parseInt(formData.gravida) : 0,
        para: formData.para ? parseInt(formData.para) : 0,
        district_id: parseInt(userInfo.district_id),
        block_id: parseInt(formData.block_id),
        ward_id: formData.ward_id ? parseInt(formData.ward_id) : null,
        sub_centre_id: userInfo.sub_centre_id ? parseInt(userInfo.sub_centre_id) : null,
        is_self_registered: false,
        is_high_risk: selectedRiskFactors.length > 0 || formData.is_high_risk,
        risk_factors: selectedRiskFactors.join(', ')
      };

      // Remove empty optional fields and ensure proper data types
      const optionalFields = [
        'date_of_birth',
        'aadhaar_number',
        'abha_id',
        'rch_id',
        'hpr_id',
        'blood_group',
        'risk_factors'
      ];
      
      optionalFields.forEach(field => {
        if (!submitData[field] || submitData[field] === '' || submitData[field] === 'null') {
          delete submitData[field];
        }
      });
      
      // Remove null values for sub_centre_id and ward_id if they are null
      if (submitData.sub_centre_id === null) {
        delete submitData.sub_centre_id;
      }
      if (submitData.ward_id === null) {
        delete submitData.ward_id;
      }

      const isOnline = await syncService.isOnline();
      
      if (isOnline) {
        // Online: Save to server
        await pregnantWomenAPI.register(submitData);
        Alert.alert(t('success'), t('pregnancyRegisteredSuccessfully'), [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        // Offline: Save to local database
        const offlineData = {
          ...submitData,
          id: `offline_${Date.now()}`,
          sync_status: 'pending',
          created_offline: true
        };
        
        await syncService.saveOfflinePregnancy(offlineData);
        Alert.alert(t('success'), 'Pregnancy registered offline - will sync when online', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (error) {
      console.error('Registration error:', error);
      
      // Check for duplicate errors
      const errorMessage = error.response?.data?.detail || error.message;
      if (errorMessage.includes('Duplicate entry') && errorMessage.includes('rch_id')) {
        Alert.alert(t('error'), t('duplicateRCHID'));
      } else if (errorMessage.includes('mobile_number')) {
        Alert.alert(t('error'), t('duplicateMobileNumber'));
      } else if (errorMessage.includes('abha_id')) {
        Alert.alert(t('error'), t('duplicateABHAID'));
      } else {
        Alert.alert(t('error'), errorMessage || t('registrationFailed'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <View>
      <Text style={styles.stepTitle}>{t('step1GeneralInfo')}</Text>
      <Text style={styles.stepSubtitle}>ସାଧାରଣ ସୂଚନା</Text>

      <View style={styles.formFields}>
        <View>
          <Text style={styles.label}>{t('name')} / ନାମ *</Text>
          <TextInput
            style={styles.input}
            placeholder={t('enterFullName')}
            value={formData.full_name}
            onChangeText={(value) => setFormData({ ...formData, full_name: value })}
          />
        </View>

        <View>
          <Text style={styles.label}>{t('husbandName')} / ସ୍ୱାମୀ ନାମ *</Text>
          <TextInput
            style={styles.input}
            placeholder={t('enterHusbandName')}
            value={formData.husband_name}
            onChangeText={(value) => setFormData({ ...formData, husband_name: value })}
          />
        </View>

        

        <View>
          <Text style={styles.label}>Date of Birth / ଜନ୍ମ ତାରିଖ *</Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowDOBPicker(true)}>
            <Text style={formData.date_of_birth_display ? styles.dateText : styles.placeholderText}>
              {formData.date_of_birth_display || 'Select Date (DD-MM-YYYY)'}
            </Text>
          </TouchableOpacity>
        </View>

        <View>
          <Text style={styles.label}>Age / ବୟସ</Text>
          <TextInput
            style={[styles.input, { backgroundColor: '#f9fafb', color: '#6b7280' }]}
            placeholder="Auto-calculated from DOB"
            value={formData.age}
            editable={false}
          />
        </View>

        <View>
          <Text style={styles.label}>Mobile No / ମୋବାଇଲ ନମ୍ବର *</Text>
          <TextInput
            style={[styles.input, (shouldShowMobileError || shouldShowDuplicateMobileError) && styles.inputError]}
            placeholder={t('mobile10Digit')}
            keyboardType="phone-pad"
            maxLength={10}
            value={formData.mobile_number}
            onChangeText={(value) => setFormData({ ...formData, mobile_number: value.replace(/[^0-9]/g, '') })}
          />
          {shouldShowMobileError && (
            <Text style={styles.errorText}>{t('mobileNumberMust10Digits')}</Text>
          )}
          {!shouldShowMobileError && isCheckingMobileDuplicate && (
            <Text style={styles.helperText}>Checking mobile number...</Text>
          )}
          {shouldShowDuplicateMobileError && (
            <Text style={styles.errorText}>{t('duplicateMobileNumber')}</Text>
          )}
        </View>

        <View>
          <Text style={styles.label}>Aadhar No / ଆଧାର ନମ୍ବର *</Text>
          <View style={styles.aadhaarBoxContainer}>
            <TextInput
              ref={aadhaarRef1}
              style={styles.aadhaarBox}
              placeholder="____"
              value={formData.aadhaar_number.slice(0, 4)}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9]/g, '');
                const full = cleaned + formData.aadhaar_number.slice(4);
                setFormData({ ...formData, aadhaar_number: full });
                if (cleaned.length === 4) aadhaarRef2.current?.focus();
              }}
              keyboardType="numeric"
              maxLength={4}
            />
            <TextInput
              ref={aadhaarRef2}
              style={styles.aadhaarBox}
              placeholder="____"
              value={formData.aadhaar_number.slice(4, 8)}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9]/g, '');
                const full = formData.aadhaar_number.slice(0, 4) + cleaned + formData.aadhaar_number.slice(8);
                setFormData({ ...formData, aadhaar_number: full });
                if (cleaned.length === 4) aadhaarRef3.current?.focus();
              }}
              keyboardType="numeric"
              maxLength={4}
            />
            <TextInput
              ref={aadhaarRef3}
              style={styles.aadhaarBox}
              placeholder="____"
              value={formData.aadhaar_number.slice(8, 12)}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9]/g, '');
                const full = formData.aadhaar_number.slice(0, 8) + cleaned;
                setFormData({ ...formData, aadhaar_number: full });
              }}
              keyboardType="numeric"
              maxLength={4}
            />
          </View>
        </View>

        <View>
          <Text style={styles.label}>ABHA ID</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter ABHA ID"
            value={formData.abha_id}
            onChangeText={(value) => setFormData({ ...formData, abha_id: value })}
          />
        </View>

        <View>
          <Text style={styles.label}>RCH ID</Text>
          <TextInput
            style={styles.input}
            placeholder={t('enterRCHID')}
            value={formData.rch_id}
            onChangeText={(value) => setFormData({ ...formData, rch_id: value })}
          />
          
        </View>

        <View>
          <Text style={styles.label}>HPR ID</Text>
          <TextInput
            style={styles.input}
            placeholder={t('enterHPRID')}
            value={formData.hpr_id}
            onChangeText={(value) => setFormData({ ...formData, hpr_id: value })}
          />
        </View>

        <View>
          <Text style={styles.label}>Block / ବ୍ଲକ *</Text>
          <TouchableOpacity 
            style={[styles.select, userInfo?.role === 'sub_centre' && styles.selectDisabled]} 
            onPress={() => userInfo?.role !== 'sub_centre' && setShowBlockModal(true)}
            disabled={userInfo?.role === 'sub_centre'}
          >
            <Text style={formData.block_id ? styles.selectTextFilled : styles.selectText}>
              {blocks.find(b => b.id === formData.block_id)?.name || t('selectBlock')}
            </Text>
          </TouchableOpacity>
          {userInfo?.role === 'sub_centre' && (
            <Text style={styles.autoFilledText}>✓ Auto-filled from your profile</Text>
          )}
        </View>

        <View>
          <Text style={styles.label}>Ward / ୱାର୍ଡ {wards.length > 0 ? '*' : ''}</Text>
          <TouchableOpacity 
            style={styles.select} 
            onPress={() => wards.length > 0 && setShowWardModal(true)}
            disabled={!formData.block_id || wards.length === 0}
          >
            <Text style={formData.ward_id ? styles.selectTextFilled : styles.selectText}>
              {wards.find(w => w.id === formData.ward_id)?.name || 
               (formData.block_id ? (wards.length > 0 ? t('selectWard') : 'No ward selection needed') : t('selectBlockFirst'))}
            </Text>
          </TouchableOpacity>
          {wards.length > 0 && !formData.ward_id && (
            <Text style={styles.noteText}>* Ward selection is mandatory for this block</Text>
          )}
        </View>

        <View>
          <Text style={styles.label}>Address / ଠିକଣା *</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder={t('enterFullAddress')}
            multiline
            numberOfLines={3}
            value={formData.address}
            onChangeText={(value) => setFormData({ ...formData, address: value })}
          />
        </View>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View>
      <Text style={styles.stepTitle}>{t('step2PregnancyDetails')}</Text>
      <Text style={styles.stepSubtitle}>ଗର୍ଭଧାରଣ ବିବରଣୀ</Text>

      <View style={styles.formFields}>
        <View>
          <Text style={styles.label}>{t('lastMenstrualPeriod')} / ଶେଷ ଋତୁସ୍ରାବ ତାରିଖ *</Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowLMPPicker(true)}>
            <Text style={formData.lmp_date_display ? styles.dateText : styles.placeholderText}>
              {formData.lmp_date_display || 'Select LMP Date (DD-MM-YYYY)'}
            </Text>
          </TouchableOpacity>
        </View>

        <View>
          <Text style={styles.label}>{t('expectedDeliveryDateEDD')} / ଅପେକ୍ଷିତ ପ୍ରସବ ତାରିଖ *</Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowEDDPicker(true)}>
            <Text style={formData.edd_date_display ? styles.dateText : styles.placeholderText}>
              {formData.edd_date_display || 'Select EDD Date (DD-MM-YYYY)'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>{t('gravida')} / ଗର୍ଭଧାରଣ ସଂଖ୍ୟା</Text>
            <TextInput
              style={styles.input}
              placeholder={t('noOfPregnancies')}
              keyboardType="numeric"
              value={formData.gravida}
              onChangeText={(value) => setFormData({ ...formData, gravida: value.replace(/[^0-9]/g, '') })}
            />
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.label}>{t('para')} / ଜୀବନ୍ତ ପ୍ରସବ ସଂଖ୍ୟା</Text>
            <TextInput
              style={styles.input}
              placeholder={t('noOfLiveBirths')}
              keyboardType="numeric"
              value={formData.para}
              onChangeText={(value) => setFormData({ ...formData, para: value.replace(/[^0-9]/g, '') })}
            />
          </View>
        </View>

        <View>
          <Text style={styles.label}>{t('bloodGroup')} / ରକ୍ତ ଗ୍ରୁପ୍ *</Text>
          <View style={styles.bloodGroupContainer}>
            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(group => (
              <TouchableOpacity
                key={group}
                style={[
                  styles.bloodGroupButton,
                  formData.blood_group === group && styles.bloodGroupSelected
                ]}
                onPress={() => setFormData({ ...formData, blood_group: group })}
              >
                <Text style={[
                  styles.bloodGroupText,
                  formData.blood_group === group && styles.bloodGroupTextSelected
                ]}>
                  {group}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.input, { marginTop: 8 }]}
            placeholder={t('orEnterBloodGroup')}
            value={formData.blood_group}
            onChangeText={(value) => setFormData({ ...formData, blood_group: value })}
          />
        </View>

        <View>
          <Text style={styles.label}>{t('riskFactors')} / ରିସ୍କ କାରକ</Text>
          <TouchableOpacity 
            style={styles.riskFactorsButton}
            onPress={() => setShowRiskFactorsModal(true)}
          >
            <Text style={styles.riskFactorsButtonText}>
              {selectedRiskFactors.length > 0 
                ? `${selectedRiskFactors.length} ${t('riskFactorsSelected')}` 
                : t('selectRiskFactors')}
            </Text>
          </TouchableOpacity>
          {selectedRiskFactors.length > 0 && (
            <Text style={styles.selectedRiskText}>
              Selected: {selectedRiskFactors.join(', ')}
            </Text>
          )}
        </View>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View>
      <Text style={styles.stepTitle}>{t('step3ReviewSubmit')}</Text>
      <Text style={styles.stepSubtitle}>ପରୀକ୍ଷା କରନ୍ତୁ ଏବଂ ଦାଖଲ କରନ୍ତୁ</Text>

      <View style={styles.reviewCard}>
        <View style={styles.reviewSection}>
          <Text style={styles.reviewSectionTitle}>{t('personalInformation')}</Text>
          <ReviewItem label="Name" value={formData.full_name} />
          <ReviewItem label="Husband Name" value={formData.husband_name} />
          <ReviewItem label="Age" value={formData.age} />
          <ReviewItem label="Date of Birth" value={formData.date_of_birth} />
          <ReviewItem label="Mobile" value={formData.mobile_number} />
          <ReviewItem label="Aadhaar" value={formData.aadhaar_number} />
          <ReviewItem label="ABHA ID" value={formData.abha_id} />
          <ReviewItem label="RCH ID" value={formData.rch_id} />
          <ReviewItem label="HPR ID" value={formData.hpr_id} />
        </View>

        <View style={styles.reviewSection}>
          <Text style={styles.reviewSectionTitle}>{t('addressDetails')}</Text>
          <ReviewItem 
            label="Block" 
            value={blocks.find(b => b.id === formData.block_id)?.name || 'Not selected'} 
          />
          <ReviewItem 
            label="Ward" 
            value={wards.find(w => w.id === formData.ward_id)?.name || 'Not selected'} 
          />
          <ReviewItem label="Address" value={formData.address} />
        </View>

        <View style={styles.reviewSection}>
          <Text style={styles.reviewSectionTitle}>{t('pregnancyDetails')}</Text>
          <ReviewItem label="LMP Date" value={formData.lmp_date} />
          <ReviewItem label="EDD Date" value={formData.edd_date} />
          <ReviewItem label="Gravida" value={formData.gravida || '0'} />
          <ReviewItem label="Para" value={formData.para || '0'} />
          <ReviewItem label="Blood Group" value={formData.blood_group} />
          <ReviewItem 
            label="High Risk" 
            value={selectedRiskFactors.length > 0 ? 'Yes' : 'No'} 
          />
          {selectedRiskFactors.length > 0 && (
            <ReviewItem 
              label="Risk Factors" 
              value={selectedRiskFactors.join(', ')} 
            />
          )}
        </View>

        <Text style={styles.reviewNote}>
          {t('reviewNote')}
        </Text>
      </View>
    </View>
  );

  const ReviewItem = ({ label, value }) => (
    <View style={styles.reviewItem}>
      <Text style={styles.reviewLabel}>{label}:</Text>
      <Text style={styles.reviewValue}>{value || t('notProvided')}</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#D2691E" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color="white" />
        </TouchableOpacity>
          
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{t('registerPregnancy')}</Text>
            <Text style={styles.headerSubtitle}>ଗର୍ଭଧାରଣ ପଞ୍ଜୀକରଣ</Text>
          </View>
          <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
            <Home size={20} color="white" />
          </TouchableOpacity>
        </View>

        {/* Step Indicator */}
        <View style={styles.stepContainer}>
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, currentStep >= 1 ? styles.stepActive : styles.stepInactive]}>
              <Text style={currentStep >= 1 ? styles.stepNumberActive : styles.stepNumberInactive}>1</Text>
            </View>
            <Text style={styles.stepLabel}>{t('general')}</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, currentStep >= 2 ? styles.stepActive : styles.stepInactive]}>
              <Text style={currentStep >= 2 ? styles.stepNumberActive : styles.stepNumberInactive}>2</Text>
            </View>
            <Text style={styles.stepLabel}>{t('pregnancy')}</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, currentStep >= 3 ? styles.stepActive : styles.stepInactive]}>
              <Text style={currentStep >= 3 ? styles.stepNumberActive : styles.stepNumberInactive}>3</Text>
            </View>
            <Text style={styles.stepLabel}>{t('review')}</Text>
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          <View style={styles.card}>
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}

            {/* Navigation Buttons */}
            <View style={styles.navigationButtons}>
              {currentStep > 1 && (
                <TouchableOpacity style={styles.backNavButton} onPress={handleBack}>
                  <Text style={styles.backNavButtonText}>{t('back')}</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity 
                style={[
                  styles.nextNavButton,
                  currentStep === 1 && styles.nextNavButtonFull,
                  currentStep === 1 && (!isAgeValid || !isMobileValid || mobileDuplicateExists || isCheckingMobileDuplicate) && styles.nextNavButtonDisabled
                ]}
                onPress={handleNext}
                disabled={submitting || (currentStep === 1 && isCheckingMobileDuplicate)}
              >
                {submitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.nextNavButtonText}>
                    {currentStep === 3 ? t('submit') : t('next')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Block Modal */}
      <KeyboardSafeModal
        visible={showBlockModal}
        position="center"
        keyboardGap={15}
        overlayStyle={styles.centeredModalOverlay}
        contentStyle={styles.centeredModalContent}
        onRequestClose={() => {
          setShowBlockModal(false);
          setBlockSearch('');
        }}
        closeOnBackdropPress={true}
      >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('selectBlock')}</Text>
              <TouchableOpacity onPress={() => {
                setShowBlockModal(false);
                setBlockSearch('');
              }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Search block..."
              value={blockSearch}
              onChangeText={setBlockSearch}
            />
            <ScrollView keyboardShouldPersistTaps="handled">
              {blocks
                .filter(block => block.name.toLowerCase().includes(blockSearch.toLowerCase()))
                .map(block => (
                  <TouchableOpacity
                    key={block.id}
                    style={styles.modalOption}
                    onPress={() => {
                      setFormData({ ...formData, block_id: block.id, ward_id: '' });
                      setShowBlockModal(false);
                      setBlockSearch('');
                    }}
                  >
                    <Text style={styles.modalOptionText}>{block.name}</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
      </KeyboardSafeModal>

      {/* Ward Modal - Center position */}
<KeyboardSafeModal
  visible={showWardModal}
  position="center"  // This won't add keyboard padding
  onRequestClose={() => {
    setShowWardModal(false);
    setWardSearch('');
  }}
  closeOnBackdropPress={true}
>
  <View style={styles.modalHeader}>
    <Text style={styles.modalTitle}>{t('selectWard')}</Text>
    <TouchableOpacity onPress={() => {
      setShowWardModal(false);
      setWardSearch('');
    }}>
      <Text style={styles.modalClose}>✕</Text>
    </TouchableOpacity>
  </View>
  <TextInput
    style={styles.searchInput}
    placeholder="Search ward..."
    value={wardSearch}
    onChangeText={setWardSearch}
    autoFocus={true}
  />
  <ScrollView 
    style={{ maxHeight: 400 }}
    keyboardShouldPersistTaps="handled"
  >
    {wards
      .filter(ward => ward.name.toLowerCase().includes(wardSearch.toLowerCase()))
      .map(ward => (
        <TouchableOpacity
          key={ward.id}
          style={styles.modalOption}
          onPress={() => {
            setFormData({ ...formData, ward_id: ward.id });
            setShowWardModal(false);
            setWardSearch('');
          }}
        >
          <Text style={styles.modalOptionText}>{ward.name}</Text>
        </TouchableOpacity>
      ))}
  </ScrollView>
</KeyboardSafeModal>

      {/* Risk Factors Modal */}
<KeyboardSafeModal
  visible={showRiskFactorsModal}
  position="center"
  onRequestClose={() => setShowRiskFactorsModal(false)}
  closeOnBackdropPress={false}
>
  <View style={styles.modalHeader}>
    <Text style={styles.modalTitle}>{t('selectRiskFactorsTitle')}</Text>
    <TouchableOpacity onPress={() => setShowRiskFactorsModal(false)}>
      <Text style={styles.modalClose}>✕</Text>
    </TouchableOpacity>
  </View>
  <ScrollView 
    style={{ maxHeight: 400 }}
    keyboardShouldPersistTaps="handled"
  >
    {riskFactorsOptions.map(factor => (
      <TouchableOpacity
        key={factor}
        style={[
          styles.modalOption,
          selectedRiskFactors.includes(factor) && styles.modalOptionSelected
        ]}
        onPress={() => handleRiskFactorToggle(factor)}
      >
        <Text style={[
          styles.modalOptionText,
          selectedRiskFactors.includes(factor) && styles.modalOptionTextSelected
        ]}>
          {factor}
        </Text>
        {selectedRiskFactors.includes(factor) && (
          <Text style={styles.checkmark}>✓</Text>
        )}
      </TouchableOpacity>
    ))}
  </ScrollView>
  <TouchableOpacity
    style={styles.modalDoneButton}
    onPress={() => setShowRiskFactorsModal(false)}
  >
    <Text style={styles.modalDoneButtonText}>{t('done')}</Text>
  </TouchableOpacity>
</KeyboardSafeModal>


      {/* Date Pickers */}
      {showDOBPicker && (
        <DateTimePicker
          value={formData.date_of_birth ? new Date(formData.date_of_birth) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => handleDateChange(event, date, 'dob')}
          maximumDate={new Date()}
        />
      )}
      {showLMPPicker && (
        <DateTimePicker
          value={formData.lmp_date ? new Date(formData.lmp_date) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => handleDateChange(event, date, 'lmp')}
          maximumDate={new Date()}
        />
      )}
      {showEDDPicker && (
        <DateTimePicker
          value={formData.edd_date ? new Date(formData.edd_date) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => handleDateChange(event, date, 'edd')}
          minimumDate={new Date()}
        />
      )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAD5A5',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#D2691E',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  homeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  headerInfo: {
    flex: 1,
  },
  backIcon: {
    color: 'white',
    fontSize: 18,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 11,
    color: 'white',
    opacity: 0.9,
  },
  stepContainer: {
    backgroundColor: '#D2691E',
    padding: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepActive: {
    backgroundColor: 'white',
  },
  stepInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  stepNumberActive: {
    color: '#D2691E',
    fontWeight: '600',
    fontSize: 16,
  },
  stepNumberInactive: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  stepLabel: {
    color: 'white',
    fontSize: 12,
    marginTop: 4,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginTop: -10,
  },
  mainContent: {
    padding: 20,
    backgroundColor: '#FAD5A5',
    minHeight: '100%',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 20,
  },
  formFields: {
    gap: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    fontSize: 14,
    backgroundColor: 'white',
  },
  aadhaarBoxContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  aadhaarBox: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    fontSize: 14,
    backgroundColor: 'white',
    textAlign: 'center',
  },
  textarea: {
    height: 80,
    textAlignVertical: 'top',
  },
  select: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: 'white',
    justifyContent: 'center',
  },
  selectText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  selectTextFilled: {
    fontSize: 14,
    color: '#374151',
  },
  selectDisabled: {
    backgroundColor: '#F3F4F6',
    opacity: 0.7,
  },
  autoFilledText: {
    fontSize: 11,
    color: '#10B981',
    marginTop: 4,
    fontStyle: 'italic',
  },
  noteText: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 4,
    fontStyle: 'italic',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 4,
  },
  helperText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  dateText: {
    fontSize: 14,
    color: '#374151',
  },
  placeholderText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  bloodGroupContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  bloodGroupButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    backgroundColor: 'white',
  },
  bloodGroupSelected: {
    backgroundColor: '#D2691E',
    borderColor: '#D2691E',
  },
  bloodGroupText: {
    fontSize: 12,
    color: '#374151',
  },
  bloodGroupTextSelected: {
    color: 'white',
  },
  riskFactorsButton: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: 'white',
    alignItems: 'center',
  },
  riskFactorsButtonText: {
    fontSize: 14,
    color: '#374151',
  },


  selectedRiskText: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 4,
    fontStyle: 'italic',
  },
  reviewCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
  },
  reviewSection: {
    marginBottom: 20,
  },
  reviewSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  reviewItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  reviewLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
    width: 120,
  },
  reviewValue: {
    fontSize: 13,
    color: '#374151',
    flex: 1,
  },
  reviewNote: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  navigationButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  backNavButton: {
    flex: 1,
    padding: 14,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    alignItems: 'center',
  },
  backNavButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  nextNavButton: {
    flex: 1,
    padding: 14,
    backgroundColor: '#8B4513',
    borderRadius: 8,
    alignItems: 'center',
  },
  nextNavButtonFull: {
    flex: 1,
  },
  nextNavButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  nextNavButtonDisabled: {
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  centeredModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  wardModalOverlay: {
    paddingBottom: 1,
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  riskModalContent: {
    marginBottom: 5,
  },
  centeredModalContent: {
  width: '90%',  // Changed from '100%' to '90%' for better responsiveness
  maxWidth: 500,  // Increased from 420 for larger screens
  maxHeight: '75%',
  minHeight: 320,
  backgroundColor: 'white',
  borderRadius: 20,
  overflow: 'hidden',
  alignSelf: 'center',  // Center the modal
},
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
 
modalScrollContent: {
  paddingBottom: 12,
},
  modalClose: {
    fontSize: 24,
    color: '#6B7280',
  },
  searchInput: {
    margin: 16,
    marginTop: 5,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    fontSize: 14,
    backgroundColor: '#F9FAFB',
  },
  modalOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalOptionSelected: {
    backgroundColor: '#FEF3C7',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#374151',
  },
  modalOptionTextSelected: {
    color: '#92400E',
    fontWeight: '500',
  },
  checkmark: {
    fontSize: 18,
    color: '#10B981',
  },
  modalDoneButton: {
    padding: 14,
    backgroundColor: '#D2691E',
    alignItems: 'center',
    margin: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  modalDoneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

});

export default RegisterPregnancyScreen;
