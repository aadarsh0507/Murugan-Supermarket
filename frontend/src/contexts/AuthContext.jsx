import { createContext, useContext, useReducer, useEffect } from 'react';
import { authAPI, getAuthToken, removeAuthToken } from '../services/api';
import { SCREEN_ID_LOOKUP, SCREEN_ID_TO_KEY, SCREEN_KEY_TO_ID, SCREEN_LOOKUP } from '@/constants/screens';

// Initial state
const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  showLoginSuccess: false,
};

// Action types
const AUTH_ACTIONS = {
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  REGISTER_START: 'REGISTER_START',
  REGISTER_SUCCESS: 'REGISTER_SUCCESS',
  REGISTER_FAILURE: 'REGISTER_FAILURE',
  LOAD_USER_START: 'LOAD_USER_START',
  LOAD_USER_SUCCESS: 'LOAD_USER_SUCCESS',
  LOAD_USER_FAILURE: 'LOAD_USER_FAILURE',
  UPDATE_USER: 'UPDATE_USER',
  UPDATE_SELECTED_STORE: 'UPDATE_SELECTED_STORE',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_SHOW_LOGIN_SUCCESS: 'SET_SHOW_LOGIN_SUCCESS',
  CLEAR_LOGIN_SUCCESS: 'CLEAR_LOGIN_SUCCESS',
};

const resolveScreenId = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") {
    if (value.id !== undefined || value.screenId !== undefined || value.screen_id !== undefined) {
      const candidate = value.id ?? value.screenId ?? value.screen_id;
      if (candidate !== undefined && candidate !== null && typeof candidate !== "object") {
        const resolvedFromCandidate = resolveScreenId(candidate);
        if (resolvedFromCandidate !== null) {
          return resolvedFromCandidate;
        }
      }
    }
    const keyCandidate = value.key ?? value.screenKey ?? value.screen_key;
    if (keyCandidate && SCREEN_KEY_TO_ID[keyCandidate]) {
      return SCREEN_KEY_TO_ID[keyCandidate];
    }
    const labelCandidate = value.label ?? value.name;
    if (typeof labelCandidate === "string" && SCREEN_KEY_TO_ID[labelCandidate]) {
      return SCREEN_KEY_TO_ID[labelCandidate];
    }
  }
  if (SCREEN_ID_LOOKUP[value]) {
    return SCREEN_ID_LOOKUP[value].id;
  }

  const numeric = Number(value);
  if (!Number.isNaN(numeric) && SCREEN_ID_LOOKUP[numeric]) {
    return SCREEN_ID_LOOKUP[numeric].id;
  }

  const stringValue = String(value).trim();
  if (!stringValue) return null;
  if (SCREEN_ID_LOOKUP[stringValue]) {
    return SCREEN_ID_LOOKUP[stringValue].id;
  }
  if (SCREEN_KEY_TO_ID[stringValue]) {
    return SCREEN_KEY_TO_ID[stringValue];
  }

  return null;
};

const normalizeScreenRights = (user = {}) => {
  if (!user || typeof user !== "object") {
    return user;
  }

  const isAdmin = Boolean(user.isAdmin ?? user.is_admin);
  const normalizedUser = { ...user, isAdmin };

  const candidates = [
    normalizedUser.screenIds,
    normalizedUser.screenRights,
    normalizedUser.permissions?.screenIds,
    normalizedUser.permissions?.screens,
    normalizedUser.access?.screens,
    normalizedUser.allowedScreens,
  ];

  const arrayCandidate = candidates.find(Array.isArray);
  const normalizedIds = Array.isArray(arrayCandidate)
    ? Array.from(
        new Set(
          arrayCandidate
            .map(resolveScreenId)
            .filter((id) => typeof id === "number")
        )
      )
    : arrayCandidate === undefined
      ? undefined
      : [];

  if (normalizedIds === undefined) {
    return normalizedUser;
  }

  const normalizedKeys =
    normalizedIds === undefined
      ? undefined
      : normalizedIds.map((id) => SCREEN_ID_TO_KEY[id]).filter(Boolean);

  return {
    ...normalizedUser,
    screenIds: normalizedIds,
    screenRights: normalizedKeys,
  };
};

const getStoreIdValue = (storeLike) => {
  if (storeLike === null || storeLike === undefined) return null;
  if (typeof storeLike === "object") {
    return (
      storeLike.id ??
      storeLike._id ??
      storeLike.storeId ??
      storeLike.store_id ??
      null
    );
  }
  return storeLike;
};

const normalizeStoreId = (storeLike) => {
  const value = getStoreIdValue(storeLike);
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const getAccessibleStoreIds = (user = {}) => {
  if (!user || typeof user !== "object") {
    return [];
  }

  const storeCandidates = [
    ...(Array.isArray(user.stores) ? user.stores : []),
    user.primaryStore,
    user.store,
    user.storeId,
    user.store_id,
  ];

  return Array.from(
    new Set(storeCandidates.map(normalizeStoreId).filter(Boolean))
  );
};

const normalizeStoreAccess = (user = {}) => {
  if (!user || typeof user !== "object") {
    return user;
  }

  const isAdmin = Boolean(user.isAdmin ?? user.is_admin);
  if (isAdmin) {
    return user;
  }

  const accessibleStoreIds = getAccessibleStoreIds(user);
  const selectedStoreId = normalizeStoreId(user.selectedStore);

  return {
    ...user,
    selectedStore:
      selectedStoreId && accessibleStoreIds.includes(selectedStoreId)
        ? user.selectedStore
        : null,
  };
};

const mapPayloadUser = (payload = {}) => {
  if (!payload || typeof payload !== "object") return payload;
  if (!payload.user) return payload;
  return {
    ...payload,
    user: normalizeStoreAccess(normalizeScreenRights(payload.user)),
  };
};

// Reducer function
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.LOGIN_START:
    case AUTH_ACTIONS.REGISTER_START:
    case AUTH_ACTIONS.LOAD_USER_START:
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case AUTH_ACTIONS.LOGIN_SUCCESS:
    case AUTH_ACTIONS.REGISTER_SUCCESS:
      const loginPayload = mapPayloadUser(action.payload);
      return {
        ...state,
        user: loginPayload.user,
        token: loginPayload.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        showLoginSuccess: true,
      };

    case AUTH_ACTIONS.LOGIN_FAILURE:
    case AUTH_ACTIONS.REGISTER_FAILURE:
    case AUTH_ACTIONS.LOAD_USER_FAILURE:
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };

    case AUTH_ACTIONS.LOAD_USER_SUCCESS:
      const loadedPayload = mapPayloadUser(action.payload);
      return {
        ...state,
        user: loadedPayload.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };

    case AUTH_ACTIONS.UPDATE_SELECTED_STORE:
      const selectedStoreUser = normalizeStoreAccess({
        ...state.user,
        selectedStore: action.payload.selectedStore
      });
      return {
        ...state,
        user: selectedStoreUser,
        error: null,
      };

    case AUTH_ACTIONS.LOGOUT:
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        showLoginSuccess: false,
      };

    case AUTH_ACTIONS.UPDATE_USER:
      const updatedUser = normalizeScreenRights(action.payload);
      const mergedUser = normalizeStoreAccess({ ...state.user, ...updatedUser });
      return {
        ...state,
        user: mergedUser,
        error: null,
      };

    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };

    case AUTH_ACTIONS.SET_SHOW_LOGIN_SUCCESS:
      return { ...state, showLoginSuccess: true };

    case AUTH_ACTIONS.CLEAR_LOGIN_SUCCESS:
      return { ...state, showLoginSuccess: false };

    default:
      return state;
  }
};

// Create context
const AuthContext = createContext();

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Load user on app start
  useEffect(() => {
    const loadUser = async () => {
      const token = getAuthToken();
      if (!token) {
        dispatch({ type: AUTH_ACTIONS.LOAD_USER_FAILURE });
        return;
      }

      try {
        dispatch({ type: AUTH_ACTIONS.LOAD_USER_START });
        const response = await authAPI.getProfile();

        dispatch({
          type: AUTH_ACTIONS.LOAD_USER_SUCCESS,
          payload: { user: response.data.user },
        });
      } catch (error) {
        if (error.status !== 401) {
          console.error('Failed to load user:', error);
        }
        removeAuthToken();
        dispatch({
          type: AUTH_ACTIONS.LOAD_USER_FAILURE,
          payload: error.status === 401 ? null : error.message,
        });
      }
    };

    loadUser();
  }, []);

  // Login function
  const login = async (email, password, rememberMe = false) => {
    try {
      dispatch({ type: AUTH_ACTIONS.LOGIN_START });

      const response = await authAPI.login(email, password, rememberMe);
      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: {
          user: response.data.user,
          token: response.data.token,
        },
      });

      return { success: true, data: response.data };
    } catch (error) {
      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILURE,
        payload: error.message,
      });
      return { success: false, error: error.message };
    }
  };

  // Register function
  const register = async (userData) => {
    try {
      dispatch({ type: AUTH_ACTIONS.REGISTER_START });

      const response = await authAPI.register(userData);
      dispatch({
        type: AUTH_ACTIONS.REGISTER_SUCCESS,
        payload: {
          user: response.data.user,
          token: response.data.token,
        },
      });

      return { success: true, data: response.data };
    } catch (error) {
      dispatch({
        type: AUTH_ACTIONS.REGISTER_FAILURE,
        payload: error.message,
      });
      return { success: false, error: error.message };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
    }
  };

  // Update user profile
  const updateProfile = async (profileData) => {
    try {
      const response = await authAPI.updateProfile(profileData);

      dispatch({
        type: AUTH_ACTIONS.UPDATE_USER,
        payload: response.data.user,
      });

      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Change password
  const changePassword = async (currentPassword, newPassword) => {
    try {
      const response = await authAPI.changePassword(currentPassword, newPassword);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Clear error
  const clearError = () => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  };

  // Update selected store
  const updateSelectedStore = (selectedStore) => {
    dispatch({
      type: AUTH_ACTIONS.UPDATE_SELECTED_STORE,
      payload: { selectedStore }
    });
  };

  const refreshUser = async () => {
    try {
      const response = await authAPI.getProfile();
      const normalized = normalizeScreenRights(response.data.user);
      dispatch({
        type: AUTH_ACTIONS.UPDATE_USER,
        payload: normalized,
      });
      return normalized;
    } catch (error) {
      console.error("Failed to refresh user profile", error);
      return null;
    }
  };

  const hasScreenAccess = (screenRef) => {
    if (!screenRef) return true;
    if (state.user?.isAdmin) return true;
    const ids = state.user?.screenIds;
    if (ids === undefined || ids === null) {
      return true;
    }
    if (!Array.isArray(ids)) {
      return true;
    }
    if (ids.length === 0) {
      return false;
    }
    const resolvedId = resolveScreenId(screenRef);
    if (resolvedId === null) {
      return false;
    }
    return ids.includes(resolvedId);
  };

  const hasEditRight = (screenRef) => {
    if (!screenRef) return true;
    if (state.user?.isAdmin) return true;
    const screenIds = state.user?.screenIds;
    const editRights = state.user?.editRights;
    
    // Must have screen access first
    if (!hasScreenAccess(screenRef)) {
      return false;
    }
    
    // If no editRights array, default to false (no edit permission)
    if (!Array.isArray(editRights)) {
      return false;
    }
    
    const resolvedId = resolveScreenId(screenRef);
    if (resolvedId === null) {
      return false;
    }
    
    return editRights.includes(resolvedId);
  };

  const clearLoginSuccess = () => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_LOGIN_SUCCESS });
  };

  const value = {
    // State
    user: state.user,
    token: state.token,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
    selectedStore: state.user?.selectedStore || null,
    showLoginSuccess: state.showLoginSuccess,

    // Actions
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    updateSelectedStore,
    refreshUser,
    clearError,
    clearLoginSuccess,

    // Utility functions
    hasScreenAccess,
    hasEditRight,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};

export default AuthContext;
