import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorage } from './secureStorage';
const REPORTS_DIRECTORY = `${FileSystem.documentDirectory}reports/`;
const DOWNLOADS_DIRECTORY_URI_KEY = 'documents_directory_uri';
const ensureReportsDirectory = async () => {
  const dirInfo = await FileSystem.getInfoAsync(REPORTS_DIRECTORY);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(REPORTS_DIRECTORY, {
      intermediates: true
    });
  }
};
const getDownloadsDirectoryUri = async () => {
  // Check if we already have permission
  const savedUri = await AsyncStorage.getItem(DOWNLOADS_DIRECTORY_URI_KEY);
  if (savedUri) {
    try {
      // Verify it's still valid
      await FileSystem.StorageAccessFramework.readDirectoryAsync(savedUri);
      return savedUri;
    } catch (error) {
      // Permission revoked, clear it
      await AsyncStorage.removeItem(DOWNLOADS_DIRECTORY_URI_KEY);
    }
  }

  // Show instruction to user before opening picker
  return new Promise((resolve, reject) => {
    Alert.alert('Select Documents Folder', 'In the next screen:\n\n1. Tap the menu icon (☰) at top-left\n2. Select "Documents"\n3. Tap "Use this folder"\n4. Tap "Allow"', [{
      text: 'Cancel',
      style: 'cancel',
      onPress: () => reject(new Error('Permission denied'))
    }, {
      text: 'Continue',
      onPress: async () => {
        try {
          const initialUri = FileSystem.StorageAccessFramework.getUriForDirectoryInRoot('Documents');
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(initialUri);
          if (!permissions.granted) {
            reject(new Error('Permission denied'));
            return;
          }

          // Save the URI for future use
          await AsyncStorage.setItem(DOWNLOADS_DIRECTORY_URI_KEY, permissions.directoryUri);
          resolve(permissions.directoryUri);
        } catch (error) {
          reject(new Error('Documents folder access was not granted'));
        }
      }
    }]);
  });
};
const saveToDownloadsFolder = async ({
  content,
  fileName,
  mimeType,
  encoding
}) => {
  try {
    const downloadsUri = await getDownloadsDirectoryUri();

    // Create file in Downloads folder
    const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(downloadsUri, fileName, mimeType);

    // Write content to file
    await FileSystem.StorageAccessFramework.writeAsStringAsync(fileUri, content, {
      encoding
    });
    return {
      success: true,
      fileUri,
      fileName
    };
  } catch (error) {
    throw error;
  }
};
const blobToBase64 = blob => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const result = String(reader.result || '');
      const base64Data = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64Data);
    } catch (error) {
      reject(error);
    }
  };
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});
const arrayBufferToBase64 = buffer => {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return globalThis.btoa(binary);
};
const dataToBase64 = async data => {
  if (!data) {
    throw new Error('No report data received.');
  }
  if (data instanceof ArrayBuffer) {
    return arrayBufferToBase64(data);
  }
  if (ArrayBuffer.isView(data)) {
    return arrayBufferToBase64(data);
  }
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return blobToBase64(data);
  }
  if (typeof data === 'string') {
    return data;
  }
  if (data?.data && (data.data instanceof ArrayBuffer || ArrayBuffer.isView(data.data))) {
    return arrayBufferToBase64(data.data);
  }
  throw new Error('Unsupported report format received from server.');
};
const persistReport = async ({
  content,
  fileName,
  mimeType,
  encoding
}) => {
  if (Platform.OS !== 'android') {
    // For iOS, save to app directory and share
    await ensureReportsDirectory();
    const localPath = `${REPORTS_DIRECTORY}${fileName}`;
    await FileSystem.writeAsStringAsync(localPath, content, {
      encoding
    });
    const sharingAvailable = await Sharing.isAvailableAsync();
    if (sharingAvailable) {
      await Sharing.shareAsync(localPath, {
        mimeType
      });
    }
    return localPath;
  }

  // For Android, save directly to Downloads folder
  try {
    const result = await saveToDownloadsFolder({
      content,
      fileName,
      mimeType,
      encoding
    });
    Alert.alert('Download Complete', `Report saved to Documents folder:\n${result.fileName}`, [{
      text: 'Open Folder',
      onPress: async () => {
        try {
          // Open Documents folder
          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: 'content://com.android.externalstorage.documents/document/primary:Documents',
            type: 'vnd.android.document/directory',
            flags: 1
          });
        } catch (error) {
          Alert.alert('Info', 'File saved in Documents folder. Open your file manager to view it.');
        }
      }
    }, {
      text: 'OK'
    }]);
    return result.fileUri;
  } catch (error) {
    if (error.message.includes('Permission denied') || error.message.includes('not granted')) {
      throw new Error('Download cancelled');
    }
    throw error;
  }
};
export const downloadBlobReport = async ({
  blob,
  fileName,
  mimeType
}) => {
  const base64Data = await dataToBase64(blob);
  return persistReport({
    content: base64Data,
    fileName,
    mimeType,
    encoding: 'base64'
  });
};
export const downloadRemoteReport = async ({
  url,
  fileName,
  mimeType
}) => {
  try {
    const token = await secureStorage.getItem('access_token');
    const response = await fetch(url, {
      headers: {
        Accept: '*/*',
        ...(token ? {
          Authorization: `Bearer ${token}`
        } : {})
      }
    });
    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}`);
    }
    const blob = await response.blob();
    return downloadBlobReport({
      blob,
      fileName,
      mimeType
    });
  } catch (error) {
    if (error.message.includes('cancelled')) {
      throw new Error('Download cancelled');
    }
    throw error;
  }
};
export const downloadTextReport = async ({
  content,
  fileName,
  mimeType,
  encoding = 'utf8'
}) => {
  return persistReport({
    content,
    fileName,
    mimeType,
    encoding
  });
};
export const resetDownloadPermissions = async () => {
  await AsyncStorage.removeItem(DOWNLOADS_DIRECTORY_URI_KEY);
  Alert.alert('Permissions Reset', 'Download folder permission has been reset. You will be asked to select it again on your next download.', [{
    text: 'OK'
  }]);
};
