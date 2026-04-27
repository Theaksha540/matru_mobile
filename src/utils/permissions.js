import { Alert, Linking, Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as IntentLauncher from 'expo-intent-launcher';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MEDIA_PERMISSIONS = ['photo', 'video'];

export const requestStoragePermission = async () => {
  try {
    const { status, canAskAgain } = await MediaLibrary.requestPermissionsAsync(
      false,
      MEDIA_PERMISSIONS
    );
    
    if (status === 'granted') {
      await AsyncStorage.setItem('storage_permission_granted', 'true');
      return true;
    }
    
    if (status === 'denied' && !canAskAgain) {
      // Permission permanently denied
      return false;
    }
    
    return false;
  } catch (error) {
    console.error('Permission error:', error);
    return false;
  }
};

export const requestStoragePermissionSilent = async () => {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync(
      false,
      MEDIA_PERMISSIONS
    );
    if (status === 'granted') {
      await AsyncStorage.setItem('storage_permission_granted', 'true');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Silent permission error:', error);
    return false;
  }
};

export const openAppSettings = async () => {
  if (Platform.OS === 'android') {
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
        { data: 'package:com.akshay1998.NIRIKHYANAPURI' }
      );
    } catch (error) {
      console.error('Error opening settings:', error);
      // Fallback to general app settings
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.APPLICATION_SETTINGS
      );
    }
  } else {
    Linking.openSettings();
  }
};

export const checkStoragePermission = async () => {
  try {
    const { status } = await MediaLibrary.getPermissionsAsync(
      false,
      MEDIA_PERMISSIONS
    );
    return status === 'granted';
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
};

export const getPermissionStatus = async () => {
  try {
    const { status, canAskAgain } = await MediaLibrary.getPermissionsAsync(
      false,
      MEDIA_PERMISSIONS
    );
    return {
      granted: status === 'granted',
      canAskAgain,
      status
    };
  } catch (error) {
    console.error('Error getting permission status:', error);
    return {
      granted: false,
      canAskAgain: false,
      status: 'undetermined'
    };
  }
};
