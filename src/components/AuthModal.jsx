// src/components/AuthModal.jsx
/**
 * AUTHENTICATION MODAL (Simplified - Email & Phone Only)
 * 
 * This component provides a clean UI for:
 * - Email signup/login with verification
 * - Phone signup/login with OTP
 * 
 * BEGINNER GUIDE:
 * This modal appears when user clicks "Login" button
 * It handles authentication flows and shows appropriate forms
 */

import React, { useState } from 'react';
import { X, Mail, Phone } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

/**
 * PROPS:
 * - isOpen: boolean - whether modal is visible
 * - onClose: function - called when modal should close
 * - onSuccess: function - called after successful auth
 */
const AuthModal = ({ isOpen, onClose, onSuccess }) => {
  // Get authentication methods from our custom hook
  const {
    signUpWithEmail,
    signInWithEmail,
    signUpWithPhone,
    verifyOTP,
    error: authError,
  } = useAuth();

  // UI State Management
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [method, setMethod] = useState('email'); // 'email' or 'phone'
  const [step, setStep] = useState(1); // For multi-step flows (like phone OTP)
  
  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  /**
   * HANDLE EMAIL SIGNUP
   * Creates new account with email/password
   */
  const handleEmailSignup = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Validate inputs
      if (!email || !password || !username) {
        setError('All fields are required');
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        setLoading(false);
        return;
      }

      // Call signup function from useAuth hook
      const { error } = await signUpWithEmail(email, password, username);

      if (error) {
        setError(error.message || 'Signup failed');
        setLoading(false);
        return;
      }

      // Success!
      setSuccess('Check your email to verify your account!');
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);

    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  /**
   * HANDLE EMAIL LOGIN
   * Log in with existing email/password
   */
  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email || !password) {
        setError('Email and password are required');
        setLoading(false);
        return;
      }

      const { error } = await signInWithEmail(email, password);

      if (error) {
        setError(error.message || 'Login failed');
        setLoading(false);
        return;
      }

      // Success!
      onSuccess?.();
      onClose();

    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  /**
   * HANDLE PHONE SIGNUP - STEP 1
   * Send OTP to phone number
   */
  const handlePhoneSendOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!phone) {
        setError('Phone number is required');
        setLoading(false);
        return;
      }

      // Phone must be in international format: +14155551234
      if (!phone.startsWith('+')) {
        setError('Phone must include country code (e.g., +1...)');
        setLoading(false);
        return;
      }

      const { error } = await signUpWithPhone(phone);

      if (error) {
        setError(error.message || 'Failed to send OTP');
        setLoading(false);
        return;
      }

      // Move to OTP verification step
      setSuccess('OTP sent! Check your phone.');
      setStep(2);

    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  /**
   * HANDLE PHONE SIGNUP - STEP 2
   * Verify OTP code
   */
  const handlePhoneVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!otp) {
        setError('Please enter the OTP code');
        setLoading(false);
        return;
      }

      const { error } = await verifyOTP(phone, otp);

      if (error) {
        setError(error.message || 'Invalid OTP');
        setLoading(false);
        return;
      }

      // Success!
      onSuccess?.();
      onClose();

    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  /**
   * RESET FORM
   * Clear all fields and errors
   */
  const resetForm = () => {
    setEmail('');
    setPassword('');
    setUsername('');
    setPhone('');
    setOtp('');
    setError('');
    setSuccess('');
    setStep(1);
  };

  // Don't render if modal is not open
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold" style={{ fontFamily: '"Courier New", monospace' }}>
            {mode === 'login' ? 'login' : 'sign up'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Mode Toggle */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => {
                setMode('login');
                resetForm();
              }}
              className={`flex-1 py-2 px-4 rounded ${
                mode === 'login'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
              style={{ fontFamily: '"Courier New", monospace' }}
            >
              login
            </button>
            <button
              onClick={() => {
                setMode('signup');
                resetForm();
              }}
              className={`flex-1 py-2 px-4 rounded ${
                mode === 'signup'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
              style={{ fontFamily: '"Courier New", monospace' }}
            >
              sign up
            </button>
          </div>

          {/* Method Tabs - Only Email and Phone */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => {
                setMethod('email');
                resetForm();
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded ${
                method === 'email'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
              style={{ fontFamily: '"Courier New", monospace' }}
            >
              <Mail size={16} />
              email
            </button>
            <button
              onClick={() => {
                setMethod('phone');
                resetForm();
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded ${
                method === 'phone'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
              style={{ fontFamily: '"Courier New", monospace' }}
            >
              <Phone size={16} />
              phone
            </button>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">
              {success}
            </div>
          )}

          {/* EMAIL METHOD */}
          {method === 'email' && (
            <form onSubmit={mode === 'login' ? handleEmailLogin : handleEmailSignup}>
              {mode === 'signup' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full p-3 border rounded focus:ring-2 focus:ring-green-500 focus:outline-none"
                    placeholder="hunter123"
                    required
                  />
                </div>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 border rounded focus:ring-2 focus:ring-green-500 focus:outline-none"
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 border rounded focus:ring-2 focus:ring-green-500 focus:outline-none"
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-500 text-white py-3 rounded font-bold hover:bg-green-600 disabled:opacity-50 transition-colors"
                style={{ fontFamily: '"Courier New", monospace' }}
              >
                {loading ? 'loading...' : mode === 'login' ? 'login' : 'sign up'}
              </button>
            </form>
          )}

          {/* PHONE METHOD */}
          {method === 'phone' && (
            <>
              {step === 1 ? (
                <form onSubmit={handlePhoneSendOTP}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">phone number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full p-3 border rounded focus:ring-2 focus:ring-green-500 focus:outline-none"
                      placeholder="+14155551234"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Include country code (e.g., +1 for US)
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-green-500 text-white py-3 rounded font-bold hover:bg-green-600 disabled:opacity-50 transition-colors"
                    style={{ fontFamily: '"Courier New", monospace' }}
                  >
                    {loading ? 'sending...' : 'send otp'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handlePhoneVerifyOTP}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">enter otp code</label>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="w-full p-3 border rounded focus:ring-2 focus:ring-green-500 focus:outline-none text-center text-2xl tracking-widest"
                      placeholder="123456"
                      maxLength={6}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1 text-center">
                      Enter the 6-digit code sent to {phone}
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-green-500 text-white py-3 rounded font-bold hover:bg-green-600 disabled:opacity-50 transition-colors"
                    style={{ fontFamily: '"Courier New", monospace' }}
                  >
                    {loading ? 'verifying...' : 'verify'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setOtp('');
                      setError('');
                    }}
                    className="w-full mt-2 text-sm text-gray-600 hover:text-gray-800"
                  >
                    ← back
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;