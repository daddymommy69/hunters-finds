import React, { useState, useEffect } from 'react';
import { Plus, X, Check } from 'lucide-react';

// Tag Pill Component (displays a tag)
export const TagPill = ({ tag, count, onRemove, small = false }) => {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold border ${
        small ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
      }`}
      style={{
        backgroundColor: `${tag.color}15`,
        borderColor: tag.color,
        color: tag.color
      }}
    >
      {tag.name}
      {count && count > 1 && (
        <span className="opacity-70">({count})</span>
      )}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="hover:opacity-70"
        >
          <X size={small ? 12 : 14} />
        </button>
      )}
    </span>
  );
};

// Tag Selector Component (for adding tags)
export const TagSelector = ({ 
  availableTags, 
  selectedTags, 
  onToggleTag,
  itemType = 'dish', // 'dish' or 'restaurant'
  userHasRated = true
}) => {
  const [expandedCategory, setExpandedCategory] = useState(null);

  // Filter tags by what applies to this item type
  const applicableTags = availableTags.filter(
    tag => tag.applies_to === itemType || tag.applies_to === 'both'
  );

  // Group tags by category
  const tagsByCategory = applicableTags.reduce((acc, tag) => {
    if (!acc[tag.category]) acc[tag.category] = [];
    acc[tag.category].push(tag);
    return acc;
  }, {});

  const categoryLabels = {
    dietary: '🥗 Dietary',
    meal: '🍽️ Meal Time',
    experience: '✨ Experience',
    practical: '📍 Practical',
    special: '⭐ Special'
  };

  if (!userHasRated && itemType === 'dish') {
    return (
      <div className="text-sm text-gray-500 text-center py-4">
        Rate this dish to add tags
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {Object.entries(tagsByCategory).map(([category, tags]) => (
        <div key={category}>
          <button
            onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
            className="w-full flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
          >
            <span className="text-sm font-semibold" style={{ fontFamily: '"Courier New", monospace' }}>
              {categoryLabels[category]}
            </span>
            <span className="text-xs text-gray-500">
              {tags.filter(t => selectedTags.includes(t.id)).length}/{tags.length}
            </span>
          </button>
          
          {expandedCategory === category && (
            <div className="mt-2 flex flex-wrap gap-2 p-2">
              {tags.map(tag => {
                const isSelected = selectedTags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => onToggleTag(tag.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition ${
                      isSelected ? 'ring-2 ring-offset-1' : ''
                    }`}
                    style={{
                      backgroundColor: isSelected ? tag.color : `${tag.color}15`,
                      borderColor: tag.color,
                      color: isSelected ? 'white' : tag.color,
                      ringColor: tag.color
                    }}
                  >
                    {isSelected && <Check size={14} className="inline mr-1" />}
                    {tag.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// Tag Filter Component (for search/filtering)
export const TagFilter = ({ 
  availableTags, 
  selectedTagIds, 
  onToggleTag,
  onClearAll,
  itemType = 'dish'
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter tags by what applies to this item type
  const applicableTags = availableTags.filter(
    tag => tag.applies_to === itemType || tag.applies_to === 'both'
  );

  // Get selected tags
  const selectedTags = applicableTags.filter(t => selectedTagIds.includes(t.id));

  return (
    <div className="space-y-2">
      {/* Selected Tags Display */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          {selectedTags.map(tag => (
            <TagPill
              key={tag.id}
              tag={tag}
              small
              onRemove={() => onToggleTag(tag.id)}
            />
          ))}
          <button
            onClick={onClearAll}
            className="text-xs text-gray-600 hover:text-[#33a29b] font-semibold"
            style={{ fontFamily: '"Courier New", monospace' }}
          >
            clear all
          </button>
        </div>
      )}

      {/* Expand Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-sm text-[#33a29b] hover:text-[#2a8a84] font-semibold flex items-center gap-1"
        style={{ fontFamily: '"Courier New", monospace' }}
      >
        <Plus size={14} />
        {isExpanded ? 'hide filters' : 'filter by tags'}
      </button>

      {/* Tag Selection */}
      {isExpanded && (
        <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg">
          {applicableTags.map(tag => {
            const isSelected = selectedTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => onToggleTag(tag.id)}
                className={`px-2 py-1 rounded-full text-xs font-semibold border transition ${
                  isSelected ? 'ring-2 ring-offset-1' : ''
                }`}
                style={{
                  backgroundColor: isSelected ? tag.color : `${tag.color}15`,
                  borderColor: tag.color,
                  color: isSelected ? 'white' : tag.color,
                  ringColor: tag.color
                }}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Add Tags Modal Component
export const AddTagsModal = ({ 
  isOpen, 
  onClose, 
  itemId,
  itemType, // 'dish' or 'restaurant'
  itemName,
  availableTags,
  currentTags = [],
  onSave,
  userHasRated = true
}) => {
  const [selectedTagIds, setSelectedTagIds] = useState([]);

  useEffect(() => {
    if (isOpen) {
      // Pre-select tags user has already voted for
      setSelectedTagIds(currentTags.map(t => t.tag_id));
    }
  }, [isOpen, currentTags]);

  const handleToggleTag = (tagId) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSave = async () => {
    await onSave(selectedTagIds);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/40 z-50 animate-fade-in" style={{ backdropFilter: 'blur(4px)' }} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
        <div className="bg-white rounded-xl max-w-md w-full max-h-[80vh] overflow-hidden pointer-events-auto animate-slide-up-fade-simple flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b">
            <h2 className="text-lg font-bold" style={{ fontFamily: '"Courier New", monospace' }}>
              add tags
            </h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X size={20} />
            </button>
          </div>

          {/* Item Info */}
          <div className="px-4 py-2 bg-gray-50 border-b">
            <div className="text-sm font-semibold" style={{ fontFamily: '"Courier New", monospace' }}>
              {itemName}
            </div>
            <div className="text-xs text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>
              {itemType === 'dish' ? 'dish' : 'restaurant'}
            </div>
          </div>

          {/* Tag Selector */}
          <div className="flex-1 overflow-y-auto p-4">
            <TagSelector
              availableTags={availableTags}
              selectedTags={selectedTagIds}
              onToggleTag={handleToggleTag}
              itemType={itemType}
              userHasRated={userHasRated}
            />
          </div>

          {/* Footer */}
          <div className="p-4 border-t flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-semibold"
              style={{ fontFamily: '"Courier New", monospace' }}
            >
              CANCEL
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-[#33a29b] text-black rounded-lg hover:bg-[#2a8a84] transition text-sm font-semibold"
              style={{ fontFamily: '"Courier New", monospace' }}
            >
              SAVE TAGS
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
