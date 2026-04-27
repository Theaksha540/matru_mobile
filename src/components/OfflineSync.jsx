import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react-native';
import { useNetworkStatus } from '../hooks/useNetworkStatus';


const OfflineSync = ({ onSync }) => {
  const isOnline = useNetworkStatus();

  const handleSync = async () => {
    if (isOnline && onSync) {
      await onSync();
    }
  };

  if (isOnline) {
    return (
      <View style={styles.syncBar}>
        <Wifi size={16} color="#22c55e" />
        <Text style={styles.syncText}>Data synced</Text>
      </View>
    );
  }

  return (
    <View style={[styles.syncBar, styles.offlineBar]}>
      <WifiOff size={16} color="#ef4444" />
      <Text style={styles.offlineText}>Offline - Using cached data</Text>
      <TouchableOpacity onPress={handleSync} style={styles.syncButton}>
        <RefreshCw size={14} color="#6b7280" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  syncBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 6,
  },
  offlineBar: {
    backgroundColor: '#fef2f2',
  },
  syncText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#166534',
    flex: 1,
  },
  offlineText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#991b1b',
    flex: 1,
  },
  syncButton: {
    padding: 4,
  },
});

export default OfflineSync;