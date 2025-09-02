import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@proj-airi/stage-ui/stores/auth';
import { authService, LoginCredentials, SignupData } from '@/services/auth.service';
import { userService } from '@/services/user.service';
import { useApi } from './useApi';
import { toast } from 'vue-sonner';

/**
 * Composable for authentication operations
 */
export function useAuth() {
  const router = useRouter();
  const authStore = useAuthStore();
  const { user, isAuthenticated, loading: storeLoading } = storeToRefs(authStore);
  
  // Login
  const {
    loading: loginLoading,
    error: loginError,
    execute: executeLogin,
  } = useApi(async (credentials: LoginCredentials) => {
    const response = await authService.login(credentials);
    
    // Update auth store with user data
    authStore.setUser(response.user);
    
    // Fetch full user profile
    const profile = await userService.getProfile();
    authStore.updateProfile(profile as any);
    
    toast.success('Welcome back!');
    return response;
  });
  
  const login = async (credentials: LoginCredentials) => {
    const result = await executeLogin(credentials);
    if (result) {
      // Redirect to dashboard or previous page
      const redirect = router.currentRoute.value.query.redirect as string;
      await router.push(redirect || '/stage');
    }
    return result;
  };
  
  // Signup
  const {
    loading: signupLoading,
    error: signupError,
    execute: executeSignup,
  } = useApi(async (data: SignupData) => {
    const response = await authService.signup(data);
    
    // Update auth store with user data
    authStore.setUser(response.user);
    
    // Fetch full user profile
    const profile = await userService.getProfile();
    authStore.updateProfile(profile as any);
    
    toast.success('Account created successfully!');
    return response;
  });
  
  const signup = async (data: SignupData) => {
    const result = await executeSignup(data);
    if (result) {
      // Redirect to onboarding or dashboard
      await router.push('/onboarding');
    }
    return result;
  };
  
  // Logout
  const {
    loading: logoutLoading,
    execute: executeLogout,
  } = useApi(async () => {
    await authService.logout();
    authStore.clearUser();
    toast.success('Logged out successfully');
  });
  
  const logout = async () => {
    await executeLogout();
    await router.push('/');
  };
  
  // Check session
  const checkSession = async () => {
    try {
      const session = await authService.getSession();
      if (session.isAuthenticated && session.user) {
        authStore.setUser(session.user);
        
        // Fetch full profile
        const profile = await userService.getProfile();
        authStore.updateProfile(profile as any);
        
        return true;
      }
    } catch (error) {
      console.error('Session check failed:', error);
    }
    return false;
  };
  
  // Password reset
  const {
    loading: resetLoading,
    error: resetError,
    execute: executeForgotPassword,
  } = useApi(async (email: string) => {
    const result = await authService.forgotPassword(email);
    toast.success('Password reset link sent to your email');
    return result;
  });
  
  const forgotPassword = async (email: string) => {
    return executeForgotPassword(email);
  };
  
  // Reset password with token
  const resetPassword = async (token: string, password: string) => {
    const result = await authService.resetPassword(token, password);
    toast.success('Password reset successfully');
    await router.push('/auth/login');
    return result;
  };
  
  // OAuth login
  const oauthLogin = async (provider: string) => {
    // Construct OAuth URL
    const redirectUrl = `${window.location.origin}/auth/callback/${provider}`;
    const oauthUrl = `${import.meta.env.VITE_API_URL}/api/v1/auth/oauth/${provider}?redirect_uri=${encodeURIComponent(redirectUrl)}`;
    
    // Redirect to OAuth provider
    window.location.href = oauthUrl;
  };
  
  // Handle OAuth callback
  const handleOAuthCallback = async (provider: string, code: string, state?: string) => {
    try {
      const response = await authService.oauthCallback(provider, code, state);
      
      // Update auth store
      authStore.setUser(response.user);
      
      // Fetch full profile
      const profile = await userService.getProfile();
      authStore.updateProfile(profile as any);
      
      toast.success('Logged in successfully!');
      
      // Redirect to dashboard
      await router.push('/stage');
      
      return response;
    } catch (error) {
      toast.error('OAuth login failed');
      await router.push('/auth/login');
      throw error;
    }
  };
  
  // Computed properties
  const isLoading = computed(() => 
    storeLoading.value || 
    loginLoading.value || 
    signupLoading.value || 
    logoutLoading.value || 
    resetLoading.value
  );
  
  return {
    // State
    user,
    isAuthenticated,
    isLoading,
    loginError,
    signupError,
    resetError,
    
    // Methods
    login,
    signup,
    logout,
    checkSession,
    forgotPassword,
    resetPassword,
    oauthLogin,
    handleOAuthCallback,
  };
}

/**
 * Composable for protected routes
 */
export function useRequireAuth(redirectTo: string = '/auth/login') {
  const router = useRouter();
  const { isAuthenticated, checkSession } = useAuth();
  const checking = ref(true);
  
  const verify = async () => {
    checking.value = true;
    
    try {
      if (!isAuthenticated.value) {
        const hasSession = await checkSession();
        
        if (!hasSession) {
          // Save current route for redirect after login
          const currentRoute = router.currentRoute.value;
          await router.push({
            path: redirectTo,
            query: { redirect: currentRoute.fullPath },
          });
        }
      }
    } finally {
      checking.value = false;
    }
  };
  
  // Check on mount
  verify();
  
  return {
    isAuthenticated,
    checking,
    verify,
  };
}

/**
 * Composable for guest-only routes
 */
export function useGuestOnly(redirectTo: string = '/stage') {
  const router = useRouter();
  const { isAuthenticated, checkSession } = useAuth();
  const checking = ref(true);
  
  const verify = async () => {
    checking.value = true;
    
    try {
      const hasSession = await checkSession();
      
      if (hasSession) {
        await router.push(redirectTo);
      }
    } finally {
      checking.value = false;
    }
  };
  
  // Check on mount
  verify();
  
  return {
    isAuthenticated,
    checking,
  };
}