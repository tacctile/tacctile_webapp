/**
 * Firebase Authentication Service
 * Handles Google OAuth and email/password authentication
 */

import { initializeApp, FirebaseApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  Auth,
  User as FirebaseUser,
  UserCredential,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  onAuthStateChanged,
  Unsubscribe,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
  deleteUser,
  linkWithPopup,
  linkWithCredential,
  fetchSignInMethodsForEmail,
  getIdToken,
  getIdTokenResult,
  IdTokenResult,
} from 'firebase/auth';
import { firebaseConfig } from '@/config';
import type { User, AuthCredentials, SignUpCredentials, AuthError as AuthErrorType } from '@/types';

/**
 * Convert Firebase User to Tacctile User
 */
function firebaseUserToUser(firebaseUser: FirebaseUser): User {
  const providerId = firebaseUser.providerData[0]?.providerId === 'google.com'
    ? 'google.com'
    : 'password';

  return {
    id: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    emailVerified: firebaseUser.emailVerified,
    providerId,
    createdAt: new Date(firebaseUser.metadata.creationTime || Date.now()),
    lastLoginAt: new Date(firebaseUser.metadata.lastSignInTime || Date.now()),
  };
}

/**
 * Firebase Authentication Service
 */
class FirebaseAuthService {
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private googleProvider: GoogleAuthProvider | null = null;
  private currentUser: User | null = null;
  private authStateListeners: Set<(user: User | null) => void> = new Set();
  private initialized = false;

  /**
   * Initialize Firebase Auth
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize Firebase app (reuse existing if already initialized)
      this.app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      this.auth = getAuth(this.app);

      // Configure Google provider
      this.googleProvider = new GoogleAuthProvider();
      this.googleProvider.addScope('profile');
      this.googleProvider.addScope('email');
      this.googleProvider.setCustomParameters({
        prompt: 'select_account',
      });

      // Set up auth state listener
      onAuthStateChanged(this.auth, (firebaseUser) => {
        this.currentUser = firebaseUser ? firebaseUserToUser(firebaseUser) : null;
        this.notifyListeners();
      });

      this.initialized = true;
      console.log('[FirebaseAuth] Initialized successfully');
    } catch (error) {
      console.error('[FirebaseAuth] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Get Firebase user (for advanced operations)
   */
  getFirebaseUser(): FirebaseUser | null {
    return this.auth?.currentUser || null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (user: User | null) => void): Unsubscribe {
    this.authStateListeners.add(callback);

    // Immediately call with current state
    callback(this.currentUser);

    return () => {
      this.authStateListeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of auth state change
   */
  private notifyListeners(): void {
    this.authStateListeners.forEach((listener) => {
      listener(this.currentUser);
    });
  }

  // ============================================================================
  // GOOGLE OAUTH
  // ============================================================================

  /**
   * Sign in with Google OAuth
   */
  async signInWithGoogle(): Promise<User> {
    this.ensureInitialized();

    try {
      const result: UserCredential = await signInWithPopup(this.auth!, this.googleProvider!);
      const user = firebaseUserToUser(result.user);
      console.log('[FirebaseAuth] Google sign-in successful:', user.email);
      return user;
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      console.error('[FirebaseAuth] Google sign-in failed:', err);
      throw this.handleAuthError(err);
    }
  }

  /**
   * Link existing account with Google
   */
  async linkWithGoogle(): Promise<User> {
    this.ensureInitialized();
    this.ensureAuthenticated();

    try {
      const result = await linkWithPopup(this.auth!.currentUser!, this.googleProvider!);
      const user = firebaseUserToUser(result.user);
      console.log('[FirebaseAuth] Account linked with Google:', user.email);
      return user;
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      console.error('[FirebaseAuth] Link with Google failed:', err);
      throw this.handleAuthError(err);
    }
  }

  // ============================================================================
  // EMAIL/PASSWORD AUTHENTICATION
  // ============================================================================

  /**
   * Sign up with email and password
   */
  async signUpWithEmail(credentials: SignUpCredentials): Promise<User> {
    this.ensureInitialized();

    try {
      const result = await createUserWithEmailAndPassword(
        this.auth!,
        credentials.email,
        credentials.password
      );

      // Update display name if provided
      if (credentials.displayName) {
        await updateProfile(result.user, {
          displayName: credentials.displayName,
        });
      }

      // Send email verification
      await sendEmailVerification(result.user);

      const user = firebaseUserToUser(result.user);
      console.log('[FirebaseAuth] Email sign-up successful:', user.email);
      return user;
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      console.error('[FirebaseAuth] Email sign-up failed:', err);
      throw this.handleAuthError(err);
    }
  }

  /**
   * Sign in with email and password
   */
  async signInWithEmail(credentials: AuthCredentials): Promise<User> {
    this.ensureInitialized();

    try {
      const result = await signInWithEmailAndPassword(
        this.auth!,
        credentials.email,
        credentials.password
      );
      const user = firebaseUserToUser(result.user);
      console.log('[FirebaseAuth] Email sign-in successful:', user.email);
      return user;
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      console.error('[FirebaseAuth] Email sign-in failed:', err);
      throw this.handleAuthError(err);
    }
  }

  /**
   * Link existing account with email/password
   */
  async linkWithEmail(email: string, password: string): Promise<User> {
    this.ensureInitialized();
    this.ensureAuthenticated();

    try {
      const credential = EmailAuthProvider.credential(email, password);
      const result = await linkWithCredential(this.auth!.currentUser!, credential);
      const user = firebaseUserToUser(result.user);
      console.log('[FirebaseAuth] Account linked with email:', user.email);
      return user;
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      console.error('[FirebaseAuth] Link with email failed:', err);
      throw this.handleAuthError(err);
    }
  }

  // ============================================================================
  // PASSWORD MANAGEMENT
  // ============================================================================

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string): Promise<void> {
    this.ensureInitialized();

    try {
      await sendPasswordResetEmail(this.auth!, email);
      console.log('[FirebaseAuth] Password reset email sent to:', email);
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      console.error('[FirebaseAuth] Password reset failed:', err);
      throw this.handleAuthError(err);
    }
  }

  /**
   * Change password (requires recent authentication)
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    this.ensureInitialized();
    this.ensureAuthenticated();

    try {
      const user = this.auth!.currentUser!;

      // Re-authenticate first
      const credential = EmailAuthProvider.credential(user.email!, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);
      console.log('[FirebaseAuth] Password changed successfully');
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      console.error('[FirebaseAuth] Password change failed:', err);
      throw this.handleAuthError(err);
    }
  }

  // ============================================================================
  // EMAIL VERIFICATION
  // ============================================================================

  /**
   * Resend email verification
   */
  async resendEmailVerification(): Promise<void> {
    this.ensureInitialized();
    this.ensureAuthenticated();

    try {
      await sendEmailVerification(this.auth!.currentUser!);
      console.log('[FirebaseAuth] Verification email resent');
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      console.error('[FirebaseAuth] Resend verification failed:', err);
      throw this.handleAuthError(err);
    }
  }

  // ============================================================================
  // PROFILE MANAGEMENT
  // ============================================================================

  /**
   * Update user profile
   */
  async updateUserProfile(profile: { displayName?: string; photoURL?: string }): Promise<User> {
    this.ensureInitialized();
    this.ensureAuthenticated();

    try {
      await updateProfile(this.auth!.currentUser!, profile);

      // Refresh current user
      await this.auth!.currentUser!.reload();
      const user = firebaseUserToUser(this.auth!.currentUser!);
      this.currentUser = user;
      this.notifyListeners();

      console.log('[FirebaseAuth] Profile updated');
      return user;
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      console.error('[FirebaseAuth] Profile update failed:', err);
      throw this.handleAuthError(err);
    }
  }

  // ============================================================================
  // SIGN OUT & ACCOUNT DELETION
  // ============================================================================

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    this.ensureInitialized();

    try {
      await signOut(this.auth!);
      this.currentUser = null;
      console.log('[FirebaseAuth] Signed out successfully');
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      console.error('[FirebaseAuth] Sign out failed:', err);
      throw this.handleAuthError(err);
    }
  }

  /**
   * Delete user account (requires recent authentication)
   */
  async deleteAccount(password?: string): Promise<void> {
    this.ensureInitialized();
    this.ensureAuthenticated();

    try {
      const user = this.auth!.currentUser!;

      // Re-authenticate if password is provided (for email accounts)
      if (password && user.email) {
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);
      }

      await deleteUser(user);
      this.currentUser = null;
      console.log('[FirebaseAuth] Account deleted');
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      console.error('[FirebaseAuth] Account deletion failed:', err);
      throw this.handleAuthError(err);
    }
  }

  // ============================================================================
  // TOKEN MANAGEMENT
  // ============================================================================

  /**
   * Get ID token for API requests
   */
  async getIdToken(forceRefresh = false): Promise<string | null> {
    this.ensureInitialized();

    if (!this.auth?.currentUser) return null;

    try {
      return await getIdToken(this.auth.currentUser, forceRefresh);
    } catch (error) {
      console.error('[FirebaseAuth] Get ID token failed:', error);
      return null;
    }
  }

  /**
   * Get ID token result with claims
   */
  async getIdTokenResult(forceRefresh = false): Promise<IdTokenResult | null> {
    this.ensureInitialized();

    if (!this.auth?.currentUser) return null;

    try {
      return await getIdTokenResult(this.auth.currentUser, forceRefresh);
    } catch (error) {
      console.error('[FirebaseAuth] Get ID token result failed:', error);
      return null;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Check sign-in methods for an email
   */
  async getSignInMethodsForEmail(email: string): Promise<string[]> {
    this.ensureInitialized();

    try {
      return await fetchSignInMethodsForEmail(this.auth!, email);
    } catch (error) {
      console.error('[FirebaseAuth] Fetch sign-in methods failed:', error);
      return [];
    }
  }

  /**
   * Wait for auth state to be determined
   */
  waitForAuthState(): Promise<User | null> {
    return new Promise((resolve) => {
      if (this.initialized && this.auth) {
        const unsubscribe = onAuthStateChanged(this.auth, (firebaseUser) => {
          unsubscribe();
          resolve(firebaseUser ? firebaseUserToUser(firebaseUser) : null);
        });
      } else {
        resolve(null);
      }
    });
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private ensureInitialized(): void {
    if (!this.initialized || !this.auth) {
      throw new Error('FirebaseAuthService not initialized. Call init() first.');
    }
  }

  private ensureAuthenticated(): void {
    if (!this.auth?.currentUser) {
      throw new Error('User not authenticated');
    }
  }

  private handleAuthError(error: { code?: string; message?: string }): AuthErrorType {
    const errorMessages: Record<string, string> = {
      'auth/email-already-in-use': 'This email is already registered. Please sign in instead.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/operation-not-allowed': 'This sign-in method is not enabled. Please contact support.',
      'auth/weak-password': 'Password is too weak. Please use at least 6 characters.',
      'auth/user-disabled': 'This account has been disabled. Please contact support.',
      'auth/user-not-found': 'No account found with this email. Please sign up.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/invalid-credential': 'Invalid credentials. Please try again.',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      'auth/popup-blocked': 'Pop-up blocked. Please allow pop-ups for this site.',
      'auth/popup-closed-by-user': 'Sign-in cancelled. Please try again.',
      'auth/account-exists-with-different-credential':
        'An account already exists with a different sign-in method.',
      'auth/requires-recent-login': 'Please sign in again to complete this action.',
      'auth/credential-already-in-use': 'This credential is already associated with another account.',
    };

    const message = errorMessages[error.code || ''] || error.message || 'An authentication error occurred';

    // Create error object matching our AuthError type
    const authError = new Error(message) as AuthErrorType;
    authError.name = 'AuthError';
    (authError as unknown as { code: string }).code = error.code || 'auth/unknown';
    return authError;
  }
}

// Export singleton instance
export const firebaseAuthService = new FirebaseAuthService();

// Export class for testing
export { FirebaseAuthService };
