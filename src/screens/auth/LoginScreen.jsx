import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, Image, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as WebBrowser from 'expo-web-browser';
import { secureStorage } from '../../utils/secureStorage';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useTranslation } from 'react-i18next';
import { authAPI } from '../../services/api';
import { syncService } from '../../utils/syncService';
import LanguageToggle from '../../components/LanguageToggle';
import '../../../src/i18n';
const LoginScreen = ({
  navigation
}) => {
  const {
    t
  } = useTranslation();
  const isOnline = useNetworkStatus();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginStatus, setLoginStatus] = useState('');
  const handleOpenWebsite = async () => {
    const url = 'https://www.nirikhyanapuri.in/';
    try {
      await WebBrowser.openBrowserAsync(url, {
        toolbarColor: '#D2691E',
        controlsColor: '#ffffff',
        showTitle: true,
        enableBarCollapsing: false
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to open website');
    }
  };
  const handleLogin = async () => {
    if (!isOnline) {
      Alert.alert(t('error'), 'No internet connection');
      return;
    }
    if (!username || !password) {
      Alert.alert(t('error'), t('pleaseEnterCredentials'));
      return;
    }
    setIsLoading(true);
    setLoginStatus(t('loginStepAuthenticating'));
    try {
      const response = await authAPI.login(username, password);
      setLoginStatus(t('loginStepLoadingProfile'));
      await secureStorage.setItem('access_token', response.access_token);
      const userInfo = await authAPI.getCurrentUser();
      setLoginStatus(t('loginStepSavingSession'));
      await secureStorage.setItem('user_info', userInfo);

      // Capture device info
      const deviceInfo = {
        deviceId: Device.osBuildId || Device.osInternalBuildId || 'unknown',
        deviceModel: Device.modelName || 'unknown',
        deviceBrand: Device.brand || 'unknown',
        osName: Device.osName || 'unknown',
        osVersion: Device.osVersion || 'unknown'
      };
      await secureStorage.setItem('device_info', deviceInfo);
      // Start sync service with error handling
      try {
        setLoginStatus(t('loginStepSyncingData'));
        syncService.startAutoSync();
        await syncService.syncOfflineData();
        await syncService.syncAll();
        if (['dp', 'sub_centre', 'block', 'district'].includes(userInfo?.role)) {
          setLoginStatus('Preparing referral data for offline use');
          await syncService.ensureDeliveryReferralCaches();
        }
      } catch (syncError) {
        // Sync failed but continue
      }
      setLoginStatus(t('loginStepOpeningDashboard'));
      const roleNavigation = {
        district: 'DistrictDashboard',
        dp: 'DPDashboard',
        block: 'BlockDashboard',
        sub_centre: 'SubCentreDashboard',
        usg_centre: 'USGDashboard',
        mother: 'MotherDashboard'
      };
      const targetScreen = roleNavigation[userInfo.role] || 'DistrictDashboard';
      navigation.replace(targetScreen);
    } catch (error) {
      Alert.alert(t('loginFailed'), error.response?.data?.detail || t('invalidCredentials'));
    } finally {
      setIsLoading(false);
      setLoginStatus('');
    }
  };
  return <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.modernAuthContainer}>
              <View style={styles.modernAuthCard}>
                {/* Language Toggle - Moved outside brand section for better positioning */}
                <View style={styles.languageToggleWrapper}>
                  <LanguageToggle />
                </View>

                {/* Brand Section */}
                <View style={styles.authBrand}>
                  <Image source={require('../../../assets/image/Nirikhyana_puri.png')} style={styles.brandLogo} resizeMode="contain" />
                </View>

                {/* Form Section */}
                <View style={styles.authFormSection}>
                  <Text style={styles.welcomeTitle}>{t('welcomeBack')}</Text>
                  <Text style={styles.formSubtitle}>{t('signInToContinue')}</Text>

                  <View style={styles.modernForm}>
                    {/* Username Input */}
                    <View style={styles.inputGroup}>
                      {/* User Icon SVG */}
                      <View style={styles.svgIcon}>
                        <Text style={styles.iconText}>👤</Text>
                      </View>
                      <TextInput style={styles.modernInput} placeholder={t('username')} placeholderTextColor="#9ca3af" value={username} onChangeText={setUsername} autoCapitalize="none" autoFocus={true} />
                    </View>

                    {/* Password Input */}
                    <View style={styles.inputGroup}>
                      {/* Lock Icon SVG */}
                      <View style={styles.svgIcon}>
                        <Text style={styles.iconText}>🔒</Text>
                      </View>
                      <TextInput style={styles.modernInput} placeholder={t('password')} placeholderTextColor="#9ca3af" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
                      <TouchableOpacity style={styles.togglePassword} onPress={() => setShowPassword(!showPassword)}>
                        {/* Eye Icon SVG */}
                        <Text style={styles.iconText}>
                          {showPassword ? '👁️' : '👁️‍🗨️'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Forgot Password Link */}
                    <View style={styles.forgotPasswordContainer}>
                      <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                        <Text style={styles.forgotPasswordText}>{t('forgotPassword')}</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Sign In Button */}
                    <TouchableOpacity style={[styles.modernBtn, styles.primaryBtn, (!username || !password || isLoading) && styles.disabledBtn]} onPress={handleLogin} disabled={!username || !password || isLoading}>
                      <Text style={styles.btnText}>
                        {isLoading ? t('signingIn') : t('signIn')}
                      </Text>
                    </TouchableOpacity>
                    {isLoading ? <View style={styles.loadingStatusContainer}>
                        <ActivityIndicator size="small" color="#8b4513" />
                        <Text style={styles.loadingStatusText}>
                          {loginStatus || t('signingIn')}
                        </Text>
                      </View> : null}
                  </View>

                  {/* Guest Services Section */}
                  <View style={styles.guestSection}>
                    <View style={styles.divider}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>For Beneficiaries</Text>
                      <View style={styles.dividerLine} />
                    </View>
                    
                    <TouchableOpacity style={styles.guestButton} onPress={() => navigation.navigate('InformedConsent')}>
                      <Text style={styles.guestButtonText}>{t('selfRegister')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.guestButton} onPress={() => navigation.navigate('SubmitGrievance')}>
                      <Text style={styles.guestButtonText}>{t('submitGrievance')}</Text>
                    </TouchableOpacity>

                    {/* Website Link */}
                    <TouchableOpacity style={styles.websiteLink} onPress={handleOpenWebsite}>
                      <Text style={styles.websiteLinkIcon}>🌐</Text>
                      <Text style={styles.websiteLinkText}>www.nirikhyanapuri.in</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>;
};
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fad5a5'
  },
  container: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingBottom: 30,
    minHeight: '100%'
  },
  modernAuthContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1
  },
  modernAuthCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 32,
    paddingTop: 20,
    // Reduced top padding to accommodate language toggle
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    position: 'relative' // Added for absolute positioning context
  },
  languageToggleWrapper: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 10,
    backgroundColor: '#fff7ed',
    // Added background
    borderRadius: 20,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  authBrand: {
    alignItems: 'center',
    marginTop: 10,
    // Added margin to push content down
    marginBottom: 10
  },
  brandLogo: {
    width: 100,
    height: 100,
    borderRadius: 60,
    // 👈 makes it circular
    marginBottom: 0
  },
  authFormSection: {
    width: '100%'
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 4
  },
  formSubtitle: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 12
  },
  modernForm: {
    width: '100%'
  },
  inputGroup: {
    position: 'relative',
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 2
  },
  svgIcon: {
    marginRight: 12,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  iconText: {
    fontSize: 16
  },
  modernInput: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    paddingVertical: 12,
    paddingHorizontal: 0
  },
  togglePassword: {
    padding: 8,
    marginLeft: 8
  },
  modernBtn: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24
  },
  primaryBtn: {
    backgroundColor: '#8b4513'
  },
  disabledBtn: {
    backgroundColor: '#9ca3af',
    opacity: 0.6
  },
  btnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  loadingStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -12,
    marginBottom: 20,
    paddingHorizontal: 8
  },
  loadingStatusText: {
    color: '#6b7280',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginLeft: 8,
    flexShrink: 1
  },
  authSwitch: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16
  },
  linkBtn: {
    fontSize: 15,
    color: '#0B1C8C',
    fontWeight: '600',
    textDecorationLine: 'underline'
  },
  forgotPasswordContainer: {
    alignItems: 'center'
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#8b4513',
    fontWeight: '500'
  },
  guestSection: {
    alignItems: 'center'
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    width: '100%'
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#d1d5db'
  },
  dividerText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginHorizontal: 16
  },
  guestButton: {
    backgroundColor: '#fff7ed',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginBottom: 10,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fed7aa',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  guestButtonText: {
    fontSize: 15,
    color: '#8B4513',
    fontWeight: '600'
  },
  websiteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd'
  },
  websiteLinkIcon: {
    fontSize: 18,
    marginRight: 8
  },
  websiteLinkText: {
    fontSize: 14,
    color: '#0369a1',
    fontWeight: '600',
    textDecorationLine: 'underline'
  }
});
export default LoginScreen;
