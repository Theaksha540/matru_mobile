import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight, Download, Globe, Info, LogOut, MapPin, Phone, User } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorage } from '../../utils/secureStorage';
import { useTranslation } from 'react-i18next';
import { getCurrentLanguage, switchLanguage } from '../../i18n';
import { syncService } from '../../utils/syncService';
import { authAPI } from '../../services/api';
import Footer from '../../components/Footer';
import '../../i18n';
const ProfileSettingsScreen = ({
  navigation
}) => {
  const {
    t,
    i18n
  } = useTranslation();
  const [userInfo, setUserInfo] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [currentYear] = useState(new Date().getFullYear());
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateStatus, setUpdateStatus] = useState('');
  const appVersion = require('../../../app.json').expo.version;
  useEffect(() => {
    loadUserInfo();
    loadLanguage();
  }, []);
  useEffect(() => {
    const handleLanguageSelection = () => {
      setSelectedLanguage(getCurrentLanguage());
    };
    i18n.on('languageChanged', handleLanguageSelection);
    return () => {
      i18n.off('languageChanged', handleLanguageSelection);
    };
  }, [i18n]);
  const loadUserInfo = async () => {
    try {
      const storedUser = await secureStorage.getItem('user_info');
      if (storedUser) {
        setUserInfo(storedUser);
      }
    } catch (error) {}
  };
  const loadLanguage = async () => {
    try {
      setSelectedLanguage(getCurrentLanguage());
    } catch (error) {}
  };
  const handleLanguageChange = async language => {
    try {
      await switchLanguage(language);
      setSelectedLanguage(language);
      Alert.alert(t('success'), t(language === 'en' ? 'languageChangedEnglish' : 'languageChangedOdia'));
    } catch (error) {}
  };
  const handleLogout = () => {
    Alert.alert(t('logout'), t('logoutConfirmation'), [{
      text: t('cancel'),
      style: 'cancel'
    }, {
      text: t('logout'),
      onPress: async () => {
        try {
          await authAPI.logout();
        } catch (error) {}
        syncService.stopAutoSync();
        await secureStorage.removeItem('user_info');
        await secureStorage.removeItem('access_token');
        await secureStorage.removeItem('refresh_token');
        const keys = await AsyncStorage.getAllKeys();
        const keysToRemove = keys.filter(key => !key.startsWith('offline_'));
        await AsyncStorage.multiRemove(keysToRemove);
        navigation.reset({
          index: 0,
          routes: [{
            name: 'Login'
          }]
        });
      }
    }]);
  };
  const showAboutAlert = () => {
    Alert.alert(t('aboutAppTitle'), `${t('version')} ${appVersion}\n\n${t('maternalHealthTrackingSystem')}\n\n${t('developedFor')}\n${t('healthFamilyWelfareDept')}\n${t('governmentOfOdisha')}\n\n${t('puriDistrictImplementation')}\n\n© ${currentYear} ${t('governmentOfOdisha')}`, [{
      text: t('ok')
    }]);
  };
  const handleCheckForUpdates = async () => {
    if (__DEV__ || !Updates.isEnabled) {
      setUpdateStatus(t('updateCheckUnavailableDev'));
      Alert.alert(t('updatesUnavailable'), t('manualUpdateCheckUnavailable'));
      return;
    }
    try {
      setCheckingUpdates(true);
      setUpdateStatus(t('checkingForUpdates'));
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        setUpdateStatus(t('newUpdateAvailable'));
        await Updates.fetchUpdateAsync();
        Alert.alert(t('updateAvailable'), t('updateDownloadedRestart'), [{
          text: t('later'),
          style: 'cancel'
        }, {
          text: t('restartNow'),
          onPress: () => Updates.reloadAsync()
        }]);
        return;
      }
      setUpdateStatus(t('usingLatestVersion'));
      Alert.alert(t('appUpToDate'), t('alreadyUsingLatestVersion'));
    } catch (error) {
      setUpdateStatus(t('failedToCheckUpdates'));
      Alert.alert(t('updateCheckFailed'), t('unableToCheckUpdates'));
    } finally {
      setCheckingUpdates(false);
    }
  };
  const detailRows = [{
    key: 'mobile',
    icon: Phone,
    label: t('mobileNumber'),
    value: userInfo?.mobile_number
  }, {
    key: 'district',
    icon: MapPin,
    label: t('district'),
    value: userInfo?.district_name
  }, {
    key: 'block',
    icon: MapPin,
    label: t('selectBlock'),
    value: userInfo?.block_name
  }, {
    key: 'subCentre',
    icon: MapPin,
    label: t('subCentreLabel'),
    value: userInfo?.sub_centre_name
  }, {
    key: 'usgCentre',
    icon: MapPin,
    label: t('usgCentreLabel'),
    value: userInfo?.usg_centre_name
  }, {
    key: 'dp',
    icon: MapPin,
    label: t('dpLabel'),
    value: userInfo?.dp_name
  }, {
    key: 'username',
    icon: User,
    label: t('username'),
    value: userInfo?.username
  }].filter(item => item.value);
  return <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={20} color="white" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{t('profileSettings')}</Text>
            <Text style={styles.headerSubtitle}>{t('profileSettingsSubtitle')}</Text>
          </View>
        </View>

        <ScrollView style={styles.mainContent} showsVerticalScrollIndicator={false}>
          <View style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <View style={styles.avatar}>
                <User size={40} color="#8B4513" />
              </View>
              <View style={styles.profileBasicInfo}>
                <Text style={styles.profileName}>{userInfo?.full_name || t('loading')}</Text>
                <Text style={styles.profileRole}>
                  {userInfo?.role ? userInfo.role.replace(/_/g, ' ').toUpperCase() : t('loading')}
                </Text>
              </View>
            </View>

            <View style={styles.contactDetails}>
              {detailRows.map(item => {
              const Icon = item.icon;
              return <View style={styles.detailRow} key={item.key}>
                    <Icon size={16} color="#8B4513" style={styles.detailIcon} />
                    <Text style={styles.detailLabel}>{item.label}</Text>
                    <Text style={styles.detailValue}>{item.value}</Text>
                  </View>;
            })}
            </View>
          </View>

          <View style={styles.settingsSection}>
            <Text style={styles.sectionTitle}>{t('settings')}</Text>

            <View style={styles.settingItemStatic}>
              <Globe size={20} color="#8B4513" style={styles.settingIcon} />
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>{t('language')}</Text>
                <Text style={styles.settingSubtitle}>
                  {selectedLanguage === 'en' ? t('englishLabel') : t('odiaLabel')}
                </Text>
              </View>
            </View>

            <View style={styles.languageButtonsRow}>
              <TouchableOpacity style={[styles.languageButton, selectedLanguage === 'en' && styles.languageButtonActive]} onPress={() => handleLanguageChange('en')}>
                <Text style={[styles.languageButtonText, selectedLanguage === 'en' && styles.languageButtonTextActive]}>
                  {t('english')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.languageButton, selectedLanguage !== 'en' && styles.languageButtonActive]} onPress={() => handleLanguageChange('or')}>
                <Text style={[styles.languageButtonText, selectedLanguage !== 'en' && styles.languageButtonTextActive]}>
                  {t('odia')}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.settingItem} onPress={showAboutAlert}>
              <Info size={20} color="#8B4513" style={styles.settingIcon} />
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>{t('aboutApp')}</Text>
                <Text style={styles.settingSubtitle}>{t('version')} {appVersion}</Text>
              </View>
              <ChevronRight size={16} color="#cbd5e0" />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.settingItem, styles.updateItem, checkingUpdates && styles.updateItemDisabled]} onPress={handleCheckForUpdates} disabled={checkingUpdates}>
              <Download size={20} color="#8B4513" style={styles.settingIcon} />
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>{t('checkForUpdates')}</Text>
                <Text style={styles.settingSubtitle}>
                  {checkingUpdates ? t('checkingForUpdates') : `${t('version')} ${appVersion}`}
                </Text>
                {!!updateStatus && <Text style={styles.updateStatusText}>{updateStatus}</Text>}
              </View>
              <ChevronRight size={16} color="#cbd5e0" />
            </TouchableOpacity>
          </View>

          <LinearGradient colors={['#e6f2ff', '#fff4e6']} start={{
          x: 0,
          y: 0
        }} end={{
          x: 1,
          y: 1
        }} style={styles.infoFooter}>
            <View style={styles.infoFooterBorder} />
            <Text style={styles.footerTitle}>{t('technicalSupport')}</Text>
            <Text style={styles.footerText}>{t('technicalSupportContact')}</Text>
            <Text style={styles.footerText}>{t('stateHelpline')}</Text>
            <Text style={styles.footerText}>dpmupuri@gmail.com</Text>
            <Text style={styles.footerText}>{t('supportAvailability')}</Text>
          </LinearGradient>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogOut size={18} color="white" />
            <Text style={styles.logoutButtonText}>{t('logout')}</Text>
          </TouchableOpacity>

          <Footer />
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>;
};
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  header: {
    backgroundColor: '#D2691E',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center'
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
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
  mainContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16
  },
  profileCard: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14
  },
  profileBasicInfo: {
    flex: 1
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827'
  },
  profileRole: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4
  },
  contactDetails: {
    gap: 12
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  detailIcon: {
    marginRight: 10
  },
  detailLabel: {
    width: 120,
    fontSize: 13,
    color: '#6b7280'
  },
  detailValue: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
    fontWeight: '600'
  },
  settingsSection: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14
  },
  settingItemStatic: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12
  },
  updateItem: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 4,
    paddingTop: 16
  },
  updateItemDisabled: {
    opacity: 0.7
  },
  settingIcon: {
    marginRight: 12
  },
  settingContent: {
    flex: 1
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827'
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2
  },
  updateStatusText: {
    fontSize: 12,
    color: '#8B4513',
    marginTop: 4,
    fontWeight: '600'
  },
  languageButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8
  },
  languageButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#f9fafb'
  },
  languageButtonActive: {
    backgroundColor: '#8B4513',
    borderColor: '#8B4513'
  },
  languageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827'
  },
  languageButtonTextActive: {
    color: 'white'
  },
  infoFooter: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    overflow: 'hidden'
  },
  infoFooterBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#8B4513'
  },
  footerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6
  },
  footerText: {
    fontSize: 12,
    color: '#374151',
    marginBottom: 3
  },
  logoutButton: {
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700'
  }
});
export default ProfileSettingsScreen;
