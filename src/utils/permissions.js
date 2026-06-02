import { Alert, Linking, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import AsyncStorage from '@react-native-async-storage/async-storage';
export const requestStoragePermission = async () => {
  try {
    await AsyncStorage.setItem('storage_permission_granted', 'true');
    return true;
  } catch (error) {
    return false;
  }
};
export const requestStoragePermissionSilent = async () => {
  try {
    await AsyncStorage.setItem('storage_permission_granted', 'true');
    return true;
  } catch (error) {
    return false;
  }
};
export const openAppSettings = async () => {
  if (Platform.OS === 'android') {
    try {
      await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, {
        data: 'package:com.akshay1998.NIRIKHYANAPURI'
      });
    } catch (error) {
      // Fallback to general app settings
      await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APPLICATION_SETTINGS);
    }
  } else {
    Linking.openSettings();
  }
};
export const checkStoragePermission = async () => {
  try {
    const storedValue = await AsyncStorage.getItem('storage_permission_granted');
    return storedValue !== 'false';
  } catch (error) {
    return true;
  }
};
export const getPermissionStatus = async () => {
  try {
    const granted = await checkStoragePermission();
    return {
      granted,
      canAskAgain: true,
      status: granted ? 'granted' : 'undetermined'
    };
  } catch (error) {
    return {
      granted: true,
      canAskAgain: true,
      status: 'granted'
    };
  }
};
