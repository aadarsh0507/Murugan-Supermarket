/**
 * Generates a descriptive error message based on the error object
 * @param {Error} error - The error object from API calls
 * @param {string} defaultMessage - Default message if error type can't be determined
 * @param {string} dataType - Type of data being loaded (e.g., "credit collection data", "purchase orders")
 * @returns {string} Descriptive error message
 */
export const getErrorMessage = (error, defaultMessage, dataType = "data") => {
  // Check if error has response data with a message
  if (error?.response?.data?.message) {
    const serverMessage = error.response.data.message;
    
    // Check for authorization/permission related messages
    if (
      serverMessage.toLowerCase().includes('permission') ||
      serverMessage.toLowerCase().includes('authorization') ||
      serverMessage.toLowerCase().includes('access denied') ||
      serverMessage.toLowerCase().includes('not authorized') ||
      serverMessage.toLowerCase().includes('forbidden')
    ) {
      return `You don't have permission to access ${dataType}. Please contact your administrator to grant access.`;
    }
    
    // Check for authentication errors
    if (
      serverMessage.toLowerCase().includes('unauthorized') ||
      serverMessage.toLowerCase().includes('authentication') ||
      serverMessage.toLowerCase().includes('token') ||
      serverMessage.toLowerCase().includes('login')
    ) {
      return `Your session has expired. Please log in again to access ${dataType}.`;
    }
    
    // Return server message if it's descriptive
    return serverMessage;
  }
  
  // Check HTTP status codes
  const status = error?.status || error?.response?.status;
  
  if (status === 403) {
    return `You don't have permission to access ${dataType}. Please contact your administrator to grant access.`;
  }
  
  if (status === 401) {
    return `Your session has expired. Please log in again to access ${dataType}.`;
  }
  
  if (status === 404) {
    return `${dataType.charAt(0).toUpperCase() + dataType.slice(1)} not found. The requested information may not exist or has been removed.`;
  }
  
  if (status === 500 || status === 502 || status === 503) {
    return `Server error occurred while loading ${dataType}. Please try again later or contact support if the problem persists.`;
  }
  
  if (status === 400) {
    return `Invalid request. Please check your filters and try again.`;
  }
  
  // Check for network errors
  if (error?.message?.includes('fetch') || error?.message?.includes('network') || error?.message?.includes('Failed to fetch')) {
    return `Network connection error. Please check your internet connection and try again.`;
  }
  
  // Check for timeout errors
  if (error?.message?.includes('timeout') || error?.message?.includes('aborted')) {
    return `Request timed out while loading ${dataType}. Please try again.`;
  }
  
  // Return default message with context
  return defaultMessage || `Unable to load ${dataType}. Please try again or contact support if the problem persists.`;
};

/**
 * Gets a user-friendly title for the error
 * @param {Error} error - The error object
 * @returns {string} Error title
 */
export const getErrorTitle = (error) => {
  const status = error?.status || error?.response?.status;
  
  if (status === 403) {
    return "Access Denied";
  }
  
  if (status === 401) {
    return "Authentication Required";
  }
  
  if (status === 404) {
    return "Not Found";
  }
  
  if (status >= 500) {
    return "Server Error";
  }
  
  if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
    return "Connection Error";
  }
  
  return "Error";
};

