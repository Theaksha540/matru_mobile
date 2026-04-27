import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { switchLanguage } from '../i18n';

const LanguageToggle = ({ style }) => {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;

  const toggleLanguage = async () => {
    const newLang = currentLang === 'en' ? 'or' : 'en';
    await switchLanguage(newLang);
  };

  return (
    <TouchableOpacity 
      style={[styles.toggleButton, style]} 
      onPress={toggleLanguage}
    >
      <Text style={styles.toggleText}>
        {currentLang === 'en' ? 'ଓଡ଼ିଆ' : 'EN'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  toggleButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  toggleText: {
    color: '#8B4513',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default LanguageToggle;