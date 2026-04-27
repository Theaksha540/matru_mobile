import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 2000; // Leave buffer below 2048 limit

export const secureStorage = {
  setItem: async (key, value) => {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    
    // Check if value exceeds SecureStore limit
    if (stringValue.length > CHUNK_SIZE) {
      // Store in chunks
      const chunks = [];
      for (let i = 0; i < stringValue.length; i += CHUNK_SIZE) {
        chunks.push(stringValue.slice(i, i + CHUNK_SIZE));
      }
      
      // Store chunk count
      await SecureStore.setItemAsync(`${key}_chunks`, chunks.length.toString());
      
      // Store each chunk
      for (let i = 0; i < chunks.length; i++) {
        await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunks[i]);
      }
    } else {
      // Store directly if small enough
      await SecureStore.setItemAsync(`${key}_chunks`, '0');
      await SecureStore.setItemAsync(key, stringValue);
    }
  },
  
  getItem: async (key) => {
    try {
      const chunkCount = await SecureStore.getItemAsync(`${key}_chunks`);
      
      if (!chunkCount) {
        // Old format or doesn't exist
        const value = await SecureStore.getItemAsync(key);
        if (!value) return null;
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      
      const chunks = parseInt(chunkCount);
      
      if (chunks === 0) {
        // Stored directly
        const value = await SecureStore.getItemAsync(key);
        if (!value) return null;
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      } else {
        // Reconstruct from chunks
        let reconstructed = '';
        for (let i = 0; i < chunks; i++) {
          const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
          if (chunk) {
            reconstructed += chunk;
          }
        }
        
        if (!reconstructed) return null;
        try {
          return JSON.parse(reconstructed);
        } catch {
          return reconstructed;
        }
      }
    } catch (error) {
      console.error(`Error getting item ${key}:`, error);
      return null;
    }
  },
  
  removeItem: async (key) => {
    try {
      const chunkCount = await SecureStore.getItemAsync(`${key}_chunks`);
      
      if (chunkCount) {
        const chunks = parseInt(chunkCount);
        
        // Remove all chunks
        for (let i = 0; i < chunks; i++) {
          await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
        }
        
        await SecureStore.deleteItemAsync(`${key}_chunks`);
      }
      
      // Remove main key
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error(`Error removing item ${key}:`, error);
    }
  }
};