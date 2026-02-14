// src/components/EmptyState.jsx
/**
 * EMPTY STATE COMPONENT
 * 
 * Reusable component shown when there's no data to display
 * 
 * USAGE:
 * <EmptyState
 *   icon={TrendingUp}
 *   title="No dishes yet"
 *   message="Be the first to rate!"
 *   actionText="Rate Now"
 *   onAction={() => console.log('clicked')}
 * />
 */

import React from 'react';

const EmptyState = ({ 
  icon: Icon, 
  title, 
  message, 
  actionText, 
  onAction 
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {/* Icon */}
      {Icon && (
        <div className="mb-6">
          <Icon size={64} className="text-gray-300" strokeWidth={1.5} />
        </div>
      )}
      
      {/* Title */}
      <h3 
        className="text-xl font-bold text-gray-800 mb-3"
        style={{ fontFamily: '"Courier New", monospace' }}
      >
        {title}
      </h3>
      
      {/* Message */}
      <p 
        className="text-gray-600 mb-6 max-w-sm"
        style={{ fontFamily: '"Courier New", monospace' }}
      >
        {message}
      </p>
      
      {/* Action Button (optional) */}
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="bg-[#33a29b] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#2a8a84] transition-colors shadow-md"
          style={{ fontFamily: '"Courier New", monospace' }}
        >
          {actionText}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
