// Enhanced logging for preview builds
const isDev = __DEV__;
const isPreview = process.env.APP_ENV === 'preview';

// Enhanced console logging for preview
if (isPreview || isDev) {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = (...args) => {
    originalLog('[PREVIEW-LOG]', new Date().toISOString(), ...args);
  };

  console.error = (...args) => {
    originalError('[PREVIEW-ERROR]', new Date().toISOString(), ...args);
  };

  console.warn = (...args) => {
    originalWarn('[PREVIEW-WARN]', new Date().toISOString(), ...args);
  };

  // Log app lifecycle
  console.log('App Environment:', process.env.APP_ENV);
  console.log('API URL:', process.env.EXPO_PUBLIC_API_URL);
}

export default {
  isDev,
  isPreview,
};