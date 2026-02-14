// src/components/LoadingSpinner.jsx
/**
 * LOADING SPINNER COMPONENT
 * 
 * Simple animated spinner shown while data is loading
 * 
 * USAGE:
 * <LoadingSpinner /> - Shows a spinning circle
 * <LoadingSpinner text="Loading dishes..." /> - Shows spinner with custom text
 */

import React from 'react';

const LoadingSpinner = ({ text = 'loading...' }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      {/* Animated spinner */}
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mb-4"></div>
      
      {/* Loading text */}
      <p 
        className="text-gray-600 text-sm"
        style={{ fontFamily: '"Courier New", monospace' }}
      >
        {text}
      </p>
    </div>
  );
};

export default LoadingSpinner;