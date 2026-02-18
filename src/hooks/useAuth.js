// src/hooks/useAuth.js
/**
 * AUTHENTICATION HOOK (Simplified - Email & Phone Only)
 * 
 * This hook manages authentication state and provides methods for:
 * - Login/Signup with email
 * - Login/Signup with phone
 * - Session management
 * - User state
 * 
 * BEGINNER GUIDE:
 * Import this hook in any component that needs auth:
 * const { user, signIn, signUp, signOut } = useAuth();
 */

import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export const useAuth = () => {
  // State to store the current user (null if not logged in)
  const [user, setUser] = useState(null);
  
  // Loading state while checking authentication
  const [loading, setLoading] = useState(true);
  
  // Error state for authentication errors
  const [error, setError] = useState(null);

  /**
   * Check if user is already logged in when app loads
   * This runs once when the component mounts
   */
  useEffect(() => {
    // Get current session from Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth state changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Cleanup subscription when component unmounts
    return () => subscription.unsubscribe();
  }, []);

  /**
   * SIGN UP WITH EMAIL
   * 
   * HOW TO USE:
   * await signUpWithEmail('user@example.com', 'password123', 'JohnDoe');
   * 
   * WHAT HAPPENS:
   * 1. Creates user account in Supabase Auth
   * 2. Sends verification email
   * 3. Creates user profile in 'users' table
   * 4. User must verify email before logging in
   */
  const signUpWithEmail = async (email, password, username) => {
    try {
      setError(null);
      
      // Create auth user
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username,
          },
          // Optionally redirect after email confirmation
          emailRedirectTo: window.location.origin,
        }
      });

      if (signUpError) throw signUpError;

      // Create user profile in database
      if (data.user) {
        const { error: profileError } = await supabase
          .from('users')
          .insert([{
            id: data.user.id,
            username: username,
            email: email,
            display_name: username,
          }]);

        if (profileError) throw profileError;
      }

      return { data, error: null };
    } catch (error) {
      setError(error.message);
      return { data: null, error };
    }
  };

  /**
   * SIGN IN WITH EMAIL
   * 
   * HOW TO USE:
   * await signInWithEmail('user@example.com', 'password123');
   */
  const signInWithEmail = async (email, password) => {
    try {
      setError(null);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      setError(error.message);
      return { data: null, error };
    }
  };

  /**
   * SIGN UP WITH PHONE (SMS OTP)
   * 
   * HOW TO USE:
   * Step 1: await signUpWithPhone('+14155551234');
   * Step 2: User receives OTP via SMS
   * Step 3: await verifyOTP('+14155551234', '123456');
   * 
   * REQUIREMENTS:
   * - Phone auth must be enabled in Supabase
   * - SMS provider (Twilio) must be configured
   * - Phone number must be in international format (+1...)
   */
  const signUpWithPhone = async (phone) => {
    try {
      setError(null);
      
      const { data, error } = await supabase.auth.signInWithOtp({
        phone,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      setError(error.message);
      return { data: null, error };
    }
  };

  /**
   * VERIFY OTP (for phone authentication)
   * 
   * HOW TO USE:
   * await verifyOTP('+14155551234', '123456');
   * 
   * The 6-digit code is sent via SMS
   */
  const verifyOTP = async (phone, token) => {
    try {
      setError(null);
      
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: 'sms',
      });

      if (error) throw error;

      // Create user profile if doesn't exist
      if (data.user) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('id', data.user.id)
          .single();

        if (!existingUser) {
          await supabase
            .from('users')
            .insert([{
              id: data.user.id,
              username: phone,
              email: data.user.email,
              display_name: phone,
            }]);
        }
      }

      return { data, error: null };
    } catch (error) {
      setError(error.message);
      return { data: null, error };
    }
  };

  /**
   * SIGN OUT
   * 
   * HOW TO USE:
   * await signOut();
   */
  const signOut = async () => {
    try {
      setError(null);
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      return { error: null };
    } catch (error) {
      setError(error.message);
      return { error };
    }
  };

  /**
   * RESET PASSWORD (Email)
   * 
   * HOW TO USE:
   * await resetPassword('user@example.com');
   * User receives email with reset link
   */
  const resetPassword = async (email) => {
    try {
      setError(null);
      
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      setError(error.message);
      return { data: null, error };
    }
  };

  /**
   * UPDATE PASSWORD
   * 
   * HOW TO USE:
   * await updatePassword('newPassword123');
   */
  const updatePassword = async (newPassword) => {
    try {
      setError(null);
      
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      setError(error.message);
      return { data: null, error };
    }
  };

  // Return all auth methods and state
  return {
    user,
    loading,
    error,
    signUpWithEmail,
    signInWithEmail,
    signUpWithPhone,
    verifyOTP,
    signOut,
    resetPassword,
    updatePassword,
  };
};