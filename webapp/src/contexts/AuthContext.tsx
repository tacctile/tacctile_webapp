/**
 * Authentication Context
 * Provides Firebase authentication state and methods throughout the app
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { firebaseAuthService } from '@/services/auth/FirebaseAuthService';
import { supabaseService } from '@/services/supabase/SupabaseService';
import { stripeService } from '@/services/billing/StripeService';
import type {
  User,
  AuthState,
  AuthCredentials,
  SignUpCredentials,
  Subscription,
} from '@/types';

// ============================================================================
// CONTEXT TYPES
// ============================================================================

interface AuthContextType extends AuthState {
  // Auth methods
  signInWithGoogle: () => Promise<User>;
  signInWithEmail: (credentials: AuthCredentials) => Promise<User>;
  signUpWithEmail: (credentials: SignUpCredentials) => Promise<User>;
  signOut: () => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  resendEmailVerification: () => Promise<void>;
  updateProfile: (profile: { displayName?: string; photoURL?: string }) => Promise<User>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: (password?: string) => Promise<void>;

  // Subscription
  subscription: Subscription | null;
  refreshSubscription: () => Promise<void>;

  // Token
  getIdToken: () => Promise<string | null>;
}

// ============================================================================
// CONTEXT
// ============================================================================

const AuthContext = createContext<AuthContextType | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
    initialized: false,
  });

  const [subscription, setSubscription] = useState<Subscription | null>(null);

  // Initialize auth services
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        await firebaseAuthService.init();
        await supabaseService.init();
        await stripeService.init();

        // Listen for auth state changes
        firebaseAuthService.onAuthStateChange(async (user) => {
          if (!mounted) return;

          if (user) {
            // Sync user to Supabase
            await supabaseService.upsertUser(user);

            // Load subscription
            let sub = await supabaseService.getSubscription(user.id);
            if (!sub) {
              // Create default free subscription
              sub = stripeService.createMockFreeSubscription(user.id);
              await supabaseService.upsertSubscription(sub);
            }
            setSubscription(sub);
          } else {
            setSubscription(null);
          }

          setState({
            user,
            loading: false,
            error: null,
            initialized: true,
          });
        });
      } catch (error) {
        if (!mounted) return;
        console.error('[AuthContext] Initialization failed:', error);
        setState({
          user: null,
          loading: false,
          error: (error as Error).message,
          initialized: true,
        });
      }
    };

    initAuth();

    return () => {
      mounted = false;
    };
  }, []);

  // Auth methods
  const signInWithGoogle = useCallback(async (): Promise<User> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const user = await firebaseAuthService.signInWithGoogle();
      return user;
    } catch (error) {
      setState((prev) => ({ ...prev, error: (error as Error).message }));
      throw error;
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  const signInWithEmail = useCallback(async (credentials: AuthCredentials): Promise<User> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const user = await firebaseAuthService.signInWithEmail(credentials);
      return user;
    } catch (error) {
      setState((prev) => ({ ...prev, error: (error as Error).message }));
      throw error;
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  const signUpWithEmail = useCallback(async (credentials: SignUpCredentials): Promise<User> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const user = await firebaseAuthService.signUpWithEmail(credentials);
      return user;
    } catch (error) {
      setState((prev) => ({ ...prev, error: (error as Error).message }));
      throw error;
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      await firebaseAuthService.signOut();
    } catch (error) {
      setState((prev) => ({ ...prev, error: (error as Error).message }));
      throw error;
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  const sendPasswordResetEmail = useCallback(async (email: string): Promise<void> => {
    try {
      await firebaseAuthService.sendPasswordResetEmail(email);
    } catch (error) {
      setState((prev) => ({ ...prev, error: (error as Error).message }));
      throw error;
    }
  }, []);

  const resendEmailVerification = useCallback(async (): Promise<void> => {
    try {
      await firebaseAuthService.resendEmailVerification();
    } catch (error) {
      setState((prev) => ({ ...prev, error: (error as Error).message }));
      throw error;
    }
  }, []);

  const updateProfile = useCallback(
    async (profile: { displayName?: string; photoURL?: string }): Promise<User> => {
      try {
        const user = await firebaseAuthService.updateUserProfile(profile);
        await supabaseService.upsertUser(user);
        return user;
      } catch (error) {
        setState((prev) => ({ ...prev, error: (error as Error).message }));
        throw error;
      }
    },
    []
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<void> => {
      try {
        await firebaseAuthService.changePassword(currentPassword, newPassword);
      } catch (error) {
        setState((prev) => ({ ...prev, error: (error as Error).message }));
        throw error;
      }
    },
    []
  );

  const deleteAccount = useCallback(async (password?: string): Promise<void> => {
    try {
      await firebaseAuthService.deleteAccount(password);
    } catch (error) {
      setState((prev) => ({ ...prev, error: (error as Error).message }));
      throw error;
    }
  }, []);

  const refreshSubscription = useCallback(async (): Promise<void> => {
    if (!state.user) return;

    const sub = await supabaseService.getSubscription(state.user.id);
    setSubscription(sub);
  }, [state.user]);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    return firebaseAuthService.getIdToken();
  }, []);

  const value: AuthContextType = {
    ...state,
    subscription,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    sendPasswordResetEmail,
    resendEmailVerification,
    updateProfile,
    changePassword,
    deleteAccount,
    refreshSubscription,
    getIdToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook to require authentication
 * Returns null while loading, redirects to login if not authenticated
 */
export function useRequireAuth(): User | null {
  const { user, loading, initialized } = useAuth();

  useEffect(() => {
    if (initialized && !loading && !user) {
      // In a real app, redirect to login page
      console.log('[useRequireAuth] User not authenticated');
    }
  }, [user, loading, initialized]);

  if (loading || !initialized) return null;
  return user;
}

/**
 * Hook to check if user has required subscription tier
 */
export function useRequireTier(requiredTier: 'pro'): boolean {
  const { subscription } = useAuth();

  if (!subscription) return false;
  if (requiredTier === 'pro') {
    return subscription.tier === 'pro';
  }
  return true;
}
