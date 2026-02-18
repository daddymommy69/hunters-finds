import React, { useState } from 'react';
import { X, Users, Lock, Globe, Radio } from 'lucide-react';

// Create Group Modal Component
export const CreateGroupModal = ({ isOpen, onClose, onSubmit, user }) => {
  const [groupName, setGroupName] = useState('');
  const [groupType, setGroupType] = useState('regular'); // 'regular' or 'broadcast'
  const [privacy, setPrivacy] = useState('public'); // 'public', 'private', 'invite-only'
  const [description, setDescription] = useState('');

  const handleSubmit = async () => {
    if (!groupName.trim()) return;

    await onSubmit({
      name: groupName.trim(),
      type: groupType,
      privacy,
      description: description.trim() || null,
      creator_id: user.id
    });

    // Reset form
    setGroupName('');
    setGroupType('regular');
    setPrivacy('public');
    setDescription('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/40 z-50 animate-fade-in" style={{ backdropFilter: 'blur(4px)' }} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
        <div className="bg-white rounded-xl max-w-md w-full pointer-events-auto animate-slide-up-fade-simple">
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b">
            <h2 className="text-lg font-bold" style={{ fontFamily: '"Courier New", monospace' }}>
              create group
            </h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <div className="p-4 space-y-4">
            {/* Group Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: '"Courier New", monospace' }}>
                group name *
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Best Tacos in Oakland"
                className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:border-[#33a29b] focus:outline-none"
                style={{ fontFamily: '"Courier New", monospace' }}
                autoFocus
              />
            </div>

            {/* Group Type */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2" style={{ fontFamily: '"Courier New", monospace' }}>
                group type
              </label>
              <div className="space-y-2">
                <button
                  onClick={() => setGroupType('regular')}
                  className={`w-full p-3 rounded-lg border-2 text-left transition ${
                    groupType === 'regular' 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-green-600" />
                    <span className="text-sm font-semibold" style={{ fontFamily: '"Courier New", monospace' }}>
                      regular group
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 ml-6" style={{ fontFamily: '"Courier New", monospace' }}>
                    Everyone can post, chat, and rate. Has group rankings.
                  </p>
                </button>

                <button
                  onClick={() => setGroupType('broadcast')}
                  className={`w-full p-3 rounded-lg border-2 text-left transition ${
                    groupType === 'broadcast' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Radio size={16} className="text-blue-600" />
                    <span className="text-sm font-semibold" style={{ fontFamily: '"Courier New", monospace' }}>
                      broadcast channel
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 ml-6" style={{ fontFamily: '"Courier New", monospace' }}>
                    Only you can post. Members can react and comment.
                  </p>
                </button>
              </div>
            </div>

            {/* Privacy */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2" style={{ fontFamily: '"Courier New", monospace' }}>
                privacy
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setPrivacy('public')}
                  className={`p-2 rounded-lg border-2 text-center transition ${
                    privacy === 'public' 
                      ? 'border-[#33a29b] bg-[#33a29b]/10' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Globe size={16} className="mx-auto mb-1 text-[#33a29b]" />
                  <span className="text-xs font-semibold block" style={{ fontFamily: '"Courier New", monospace' }}>
                    public
                  </span>
                </button>

                <button
                  onClick={() => setPrivacy('private')}
                  className={`p-2 rounded-lg border-2 text-center transition ${
                    privacy === 'private' 
                      ? 'border-[#33a29b] bg-[#33a29b]/10' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Lock size={16} className="mx-auto mb-1 text-[#33a29b]" />
                  <span className="text-xs font-semibold block" style={{ fontFamily: '"Courier New", monospace' }}>
                    private
                  </span>
                </button>

                <button
                  onClick={() => setPrivacy('invite-only')}
                  className={`p-2 rounded-lg border-2 text-center transition ${
                    privacy === 'invite-only' 
                      ? 'border-[#33a29b] bg-[#33a29b]/10' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Users size={16} className="mx-auto mb-1 text-[#33a29b]" />
                  <span className="text-xs font-semibold block" style={{ fontFamily: '"Courier New", monospace' }}>
                    invite-only
                  </span>
                </button>
              </div>
            </div>

            {/* Description (Optional) */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: '"Courier New", monospace' }}>
                description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this group about?"
                rows="2"
                className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:border-[#33a29b] focus:outline-none resize-none"
                style={{ fontFamily: '"Courier New", monospace' }}
              />
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={!groupName.trim()}
              className="w-full py-3 rounded-lg font-bold text-base transition-all shadow-lg
                disabled:bg-gray-400 disabled:text-gray-600 disabled:cursor-not-allowed disabled:shadow-none
                enabled:bg-[#33a29b] enabled:text-black enabled:hover:bg-[#2a8a84] enabled:hover:shadow-xl enabled:hover:scale-[1.02]
                enabled:active:scale-[0.98]"
              style={{ fontFamily: '"Courier New", monospace' }}
            >
              CREATE GROUP
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// Group Card Component
export const GroupCard = ({ group, onClick, isUserMember }) => {
  const getGroupTypeColor = (type) => {
    if (type === 'broadcast') return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-green-100 text-green-700 border-green-200';
  };

  const getGroupTypeIcon = (type) => {
    if (type === 'broadcast') return <Radio size={12} />;
    return <Users size={12} />;
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition cursor-pointer"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="font-semibold text-sm" style={{ fontFamily: '"Courier New", monospace' }}>
            {group.name}
          </h3>
          {group.description && (
            <p className="text-xs text-gray-600 mt-1" style={{ fontFamily: '"Courier New", monospace' }}>
              {group.description}
            </p>
          )}
        </div>
        {isUserMember && (
          <span className="ml-2 px-2 py-0.5 bg-[#33a29b]/10 text-[#33a29b] text-xs rounded-full font-semibold">
            member
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className={`text-xs px-2 py-1 rounded border font-semibold flex items-center gap-1 ${getGroupTypeColor(group.type)}`}>
          {getGroupTypeIcon(group.type)}
          {group.type}
        </span>
        
        {group.privacy !== 'public' && (
          <span className="text-xs px-2 py-1 rounded border bg-gray-100 text-gray-700 border-gray-200 font-semibold flex items-center gap-1">
            <Lock size={10} />
            {group.privacy}
          </span>
        )}
      </div>
    </div>
  );
};
