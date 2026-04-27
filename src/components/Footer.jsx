import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const Footer = () => {
  const insets = useSafeAreaInsets();
  const currentYear = new Date().getFullYear();
  
  return (
    <View style={[styles.appFooter, { marginBottom: insets.bottom + 8 }]}>
                <Text style={styles.appFooterTitle}>ନିରୀକ୍ଷଣ NIRIKHYANA</Text>
                <Text style={styles.appFooterText}>Puri District, Odisha</Text>
                <Text style={styles.appFooterText}>Health & Family Welfare Department</Text>
                <Text style={styles.appFooterText}>Government of Odisha © {currentYear}</Text>
              </View>
  );
};

const styles = StyleSheet.create({
  appFooter: {
    backgroundColor: '#D2691E',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  appFooterTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#0B1C8C',
    marginBottom: 4,
    textAlign: 'center',
  },
  appFooterText: {
    fontSize: 14,
    color: 'white',
    marginBottom: 4,
    textAlign: 'center',
  },
});

export default Footer;