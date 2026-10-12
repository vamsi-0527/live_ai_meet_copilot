/**
 * Utility functions for handling the Groq API key
 */

export const getApiKey = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  // Check localStorage first
  const key = localStorage.getItem('groqApiKey');
  if (key) return key;
  
  // Fallback to sessionStorage
  return sessionStorage.getItem('groqApiKey');
};

export const hasApiKey = (): boolean => {
  return !!getApiKey();
};

export const removeApiKey = () => {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem('groqApiKey');
  sessionStorage.removeItem('groqApiKey');
};