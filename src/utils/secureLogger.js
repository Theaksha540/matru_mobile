const sanitizeForLog = (obj) => {
  if (typeof obj !== 'object' || !obj) return obj;
  const sensitive = ['password', 'token', 'abha_id', 'mobile_number'];
  const result = { ...obj };
  Object.keys(result).forEach(key => {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      result[key] = '***';
    }
  });
  return result;
};

export const logger = {
  log: (msg, data) => {
    if (__DEV__) console.log(msg, data ? sanitizeForLog(data) : '');
  },
  error: (msg, error) => {
    if (__DEV__ && !msg.includes('API error')) {
      console.error(msg, error?.message || error);
    }
  }
};