import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  ArrowLeft,
  Search,
  User,
  Phone,
  MapPin,
  Calendar,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { pregnantWomenAPI } from '../../services/api';
import { formatDateDDMMYYYY } from '../../utils/dateFormat';
import '../../i18n';

const DeduplicationCheckScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('Mobile');
  const [searchValue, setSearchValue] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchValue.trim()) {
      Alert.alert(t('error'), t('pleaseEnterSearchValue'));
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const result = await pregnantWomenAPI.searchByMobile(searchValue.trim());
      setSearchResult(result);
    } catch (error) {
      if (error.response?.status === 404) {
        setSearchResult(null);
      } else {
        Alert.alert(t('error'), t('failedToSearchTryAgain'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSearchValue('');
    setSearchResult(null);
    setSearched(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return formatDateDDMMYYYY(dateString);
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <ArrowLeft size={20} color="white" />
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>{t('deduplicationCheck')}</Text>
              <Text style={styles.headerSubtitle}>{t('searchByABHAIDMobile')} / ଖୋଜ ଦ୍ୱାରା</Text>
            </View>
          </View>

          {/* Main Content */}
          <View style={styles.mainContent}>
            <View style={styles.contentContainer}>
              {/* Search Card */}
              <LinearGradient
                colors={['#f8fafc', '#e2e8f0']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.dedupCard}
              >
                <View style={styles.cardHeader}>
                  <Search size={20} color="#8B4513" style={styles.headerIcon} />
                  <Text style={styles.cardTitle}>{t('searchForDuplicates')}</Text>
                </View>
                <Text style={styles.cardSubtitle}>{t('checkIfBeneficiaryRegistered')}</Text>

                {/* Search Tabs */}
                <View style={styles.searchTabs}>
                  <Text style={styles.tabsLabel}>{t('searchBy')} / ଖୋଜିବା:</Text>
                  <View style={styles.tabButtons}>
                    <TouchableOpacity
                      style={[styles.tabButton, activeTab === 'Mobile' && styles.tabButtonActive]}
                      onPress={() => setActiveTab('Mobile')}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.tabButtonText, activeTab === 'Mobile' && styles.tabButtonTextActive]}>
                        {t('mobileNumber')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Search Input */}
                <View style={styles.searchInputSection}>
                  <Text style={styles.inputLabel}>{t('enterMobileNumber')}</Text>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="e.g. 9876543210"
                    value={searchValue}
                    onChangeText={setSearchValue}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>

                {/* Action Buttons */}
                <View style={styles.searchActions}>
                  <TouchableOpacity
                    style={styles.btnSecondary}
                    onPress={handleClear}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.btnSecondaryText}>{t('clear')} / ସଫା କରନ୍ତୁ</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnPrimary, loading && styles.btnDisabled]}
                    onPress={handleSearch}
                    disabled={loading}
                    activeOpacity={0.7}
                  >
                    {loading ? (
                      <ActivityIndicator size={16} color="white" />
                    ) : (
                      <Search size={16} color="white" style={styles.btnIcon} />
                    )}
                    <Text style={styles.btnPrimaryText}>
                      {loading ? t('searching') : `${t('search')} / ଖୋଜନ୍ତୁ`}
                    </Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>

              {/* Search Results */}
              {searched && (
                <View style={styles.resultsCard}>
                  <Text style={styles.resultsTitle}>{t('searchResults')}</Text>
                  {searchResult ? (
                    <View style={styles.resultItem}>
                      <View style={styles.resultHeader}>
                        <User size={16} color="#dc2626" />
                        <Text style={styles.duplicateLabel}>{t('duplicateFound')}</Text>
                      </View>
                      <Text style={styles.resultName}>{searchResult.full_name}</Text>
                      <View style={styles.resultDetails}>
                        <View style={styles.resultRow}>
                          <Phone size={14} color="#6b7280" />
                          <Text style={styles.resultText}>{t('mobile')}: {searchResult.mobile_number}</Text>
                        </View>
                        <View style={styles.resultRow}>
                          <User size={14} color="#6b7280" />
                          <Text style={styles.resultText}>{t('husband')}: {searchResult.husband_name}</Text>
                        </View>
                        <View style={styles.resultRow}>
                          <MapPin size={14} color="#6b7280" />
                          <Text style={styles.resultText}>{t('address')}: {searchResult.address}</Text>
                        </View>
                        <View style={styles.resultRow}>
                          <Calendar size={14} color="#6b7280" />
                          <Text style={styles.resultText}>EDD: {formatDate(searchResult.edd_date)}</Text>
                        </View>
                        {searchResult.abha_id && (
                          <View style={styles.resultRow}>
                            <Text style={styles.resultText}>ABHA ID: {searchResult.abha_id}</Text>
                          </View>
                        )}
                        {searchResult.rch_id && (
                          <View style={styles.resultRow}>
                            <Text style={styles.resultText}>RCH ID: {searchResult.rch_id}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ) : (
                    <View style={styles.noResultItem}>
                      <Text style={styles.noResultLabel}>{t('noDuplicateFound')}</Text>
                      <Text style={styles.noResultText}>{t('mobileNumberNotRegistered', { number: searchValue })}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Info Footer */}
              <LinearGradient
                colors={['#e6f2ff', '#fff4e6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.infoFooter}
              >
                <View style={styles.infoFooterBorder} />
                <Text style={styles.infoFooterTitle}>{t('howItWorks')} / ଏହା କିପରି କାମ କରେ:</Text>
                <Text style={styles.infoFooterText}>{t('searchByABHAIDMobileToCheck')}</Text>
                <Text style={styles.infoFooterText}>{t('systemSearchesAcrossDistrict')}</Text>
                <Text style={styles.infoFooterText}>{t('preventsDuplicateRegistrations')}</Text>
                <Text style={styles.infoFooterText}>{t('showsAllMatchingRecords')}</Text>
              </LinearGradient>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    backgroundColor: '#D2691E',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
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
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  contentContainer: {
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  dedupCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerIcon: {
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 16,
  },
  searchTabs: {
    marginBottom: 16,
  },
  tabsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  tabButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: 'white',
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#8B4513',
    borderColor: '#8B4513',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabButtonTextActive: {
    color: 'white',
  },
  searchInputSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1f2937',
    backgroundColor: 'white',
  },
  searchActions: {
    flexDirection: 'row',
    gap: 8,
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: 'white',
    alignItems: 'center',
  },
  btnSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  btnPrimary: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#8B4513',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnIcon: {
    marginRight: 4,
  },
  btnPrimaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'white',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  resultsCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  resultItem: {
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  duplicateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  resultDetails: {
    gap: 4,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultText: {
    fontSize: 12,
    color: '#6b7280',
  },
  noResultItem: {
    borderWidth: 1,
    borderColor: '#d1fae5',
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  noResultLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#22c55e',
    marginBottom: 4,
  },
  noResultText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  infoFooter: {
    borderRadius: 8,
    padding: 10,
    paddingLeft: 14,
    position: 'relative',
  },
  infoFooterBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#0B1C8C',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  infoFooterTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0B1C8C',
    marginBottom: 8,
  },
  infoFooterText: {
    fontSize: 12,
    color: '#0B1C8C',
    marginBottom: 4,
    lineHeight: 18,
  },
});

export default DeduplicationCheckScreen;
