import React, { useState, useEffect } from 'react';
import { X, Users, TrendingUp, MessageSquare, Settings, Crown, UserPlus, LogOut, Trash2, Send, Smile } from 'lucide-react';
import { supabase } from '../supabaseClient';

// Group Detail Modal Component
export const GroupDetailModal = ({ 
  group, 
  isOpen, 
  onClose, 
  user, 
  isUserMember,
  onLeave,
  onDelete,
  allDishes,
  allRatings
}) => {
  const [activeTab, setActiveTab] = useState('members');
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  
  // Check if user is admin/creator
  const isCreator = group?.creator_id === user?.id;
  const isBroadcast = group?.type === 'broadcast';
  const canPost = !isBroadcast || isCreator;

  // Fetch members
  useEffect(() => {
    if (!group || !isOpen) return;

    const fetchMembers = async () => {
      setMembersLoading(true);
      try {
        const { data: memberData, error } = await supabase
          .from('group_members')
          .select(`
            *,
            user:users(id, username, display_name)
          `)
          .eq('group_id', group.id)
          .order('joined_at', { ascending: true });

        if (error) throw error;
        setMembers(memberData || []);
      } catch (error) {
        console.error('Error fetching members:', error);
      } finally {
        setMembersLoading(false);
      }
    };

    fetchMembers();
  }, [group, isOpen]);

  // Fetch messages for chat
  useEffect(() => {
    if (!group || !isOpen || activeTab !== 'chat') return;

    const fetchMessages = async () => {
      setMessagesLoading(true);
      try {
        const { data, error } = await supabase
          .from('group_messages')
          .select(`
            *,
            user:users(id, username, display_name)
          `)
          .eq('group_id', group.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        setMessages(data?.reverse() || []);
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setMessagesLoading(false);
      }
    };

    fetchMessages();

    // Subscribe to real-time messages
    const subscription = supabase
      .channel(`group-${group.id}-messages`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'group_messages',
          filter: `group_id=eq.${group.id}`
        }, 
        async (payload) => {
          // Fetch user data for new message
          const { data: userData } = await supabase
            .from('users')
            .select('id, username, display_name')
            .eq('id', payload.new.user_id)
            .single();

          setMessages(prev => [...prev, { ...payload.new, user: userData }]);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [group, isOpen, activeTab]);

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user) return;

    setSendingMessage(true);
    try {
      const { error } = await supabase
        .from('group_messages')
        .insert([{
          group_id: group.id,
          user_id: user.id,
          message: newMessage.trim()
        }]);

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  // Calculate group rankings
  const getGroupRankings = () => {
    if (!members || !allDishes || !allRatings) return [];

    const memberIds = members.map(m => m.user_id);
    
    // Filter ratings to only group members
    const groupRatings = allRatings.filter(r => memberIds.includes(r.user_id));
    
    // Calculate average scores per dish
    const dishScores = {};
    groupRatings.forEach(rating => {
      if (!dishScores[rating.dish_id]) {
        dishScores[rating.dish_id] = {
          ratings: [],
          dish: allDishes.find(d => d.id === rating.dish_id)
        };
      }
      dishScores[rating.dish_id].ratings.push(rating);
    });

    // Calculate averages
    return Object.entries(dishScores)
      .map(([dishId, data]) => {
        const ratings = data.ratings;
        const avgScore = Math.round(
          ratings.reduce((sum, r) => sum + (r.overall_score || 0), 0) / ratings.length
        );
        
        const userRating = ratings.find(r => r.user_id === user?.id);
        
        return {
          dishId,
          dish: data.dish,
          groupScore: avgScore,
          userScore: userRating?.overall_score || null,
          numRated: ratings.length,
          totalMembers: members.length
        };
      })
      .filter(item => item.dish)
      .sort((a, b) => b.groupScore - a.groupScore);
  };

  if (!isOpen || !group) return null;

  const groupRankings = activeTab === 'rankings' ? getGroupRankings() : [];

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/40 z-50 animate-fade-in" style={{ backdropFilter: 'blur(4px)' }} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
        <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden pointer-events-auto animate-slide-up-fade-simple flex flex-col">
          
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-lg font-bold" style={{ fontFamily: '"Courier New", monospace' }}>
                  {group.name}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${
                    group.type === 'broadcast' 
                      ? 'bg-blue-100 text-blue-700 border-blue-200' 
                      : 'bg-green-100 text-green-700 border-green-200'
                  }`}>
                    {group.type}
                  </span>
                  <span className="text-xs text-gray-500">
                    {members.length} {members.length === 1 ? 'member' : 'members'}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 px-4 py-2 border-b bg-gray-50">
            <button
              onClick={() => setActiveTab('members')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                activeTab === 'members' ? 'bg-gray-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Users size={14} className="inline mr-1" />
              members
            </button>
            <button
              onClick={() => setActiveTab('rankings')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                activeTab === 'rankings' ? 'bg-gray-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <TrendingUp size={14} className="inline mr-1" />
              rankings
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                activeTab === 'chat' ? 'bg-gray-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <MessageSquare size={14} className="inline mr-1" />
              chat
            </button>
            {isCreator && (
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  activeTab === 'settings' ? 'bg-gray-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Settings size={14} className="inline mr-1" />
                settings
              </button>
            )}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4">
            
            {/* MEMBERS TAB */}
            {activeTab === 'members' && (
              <div className="space-y-2">
                {membersLoading ? (
                  <div className="text-center text-gray-500 py-8">Loading...</div>
                ) : (
                  members.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <span className="text-sm font-bold text-gray-600">
                            {member.user?.username?.[0]?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div>
                          <div className="font-semibold text-sm flex items-center gap-2">
                            {member.user?.display_name || member.user?.username || 'Unknown'}
                            {member.role === 'admin' && (
                              <Crown size={14} className="text-yellow-600" />
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            @{member.user?.username || 'unknown'}
                          </div>
                        </div>
                      </div>
                      {isCreator && member.user_id !== user.id && (
                        <button 
                          className="text-xs text-red-600 hover:text-red-700 font-semibold"
                          onClick={() => {
                            // TODO: Implement kick member
                            console.log('Kick member:', member.user_id);
                          }}
                        >
                          remove
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* RANKINGS TAB */}
            {activeTab === 'rankings' && (
              <div className="space-y-2">
                {groupRankings.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    No ratings yet in this group
                  </div>
                ) : (
                  groupRankings.map((item, idx) => (
                    <div key={item.dishId} className="bg-white rounded-lg p-3 shadow-sm border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 text-center text-lg font-bold text-gray-400">#{idx + 1}</div>
                        <div className="flex-1">
                          <div className="font-semibold text-sm">{item.dish.name}</div>
                          <div className="text-xs text-gray-500">
                            {item.dish.restaurantName} • {item.dish.cuisine}
                          </div>
                          <div className="text-xs text-[#33a29b] mt-1">
                            Group: {item.groupScore}
                            {item.userScore && `, You: ${item.userScore}`}
                            {' • '}{item.numRated}/{item.totalMembers} rated
                          </div>
                        </div>
                        <div className="text-2xl font-bold text-[#33a29b]">
                          {item.groupScore}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* CHAT TAB */}
            {activeTab === 'chat' && (
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                  {messagesLoading ? (
                    <div className="text-center text-gray-500 py-8">Loading messages...</div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      No messages yet. Start the conversation!
                    </div>
                  ) : (
                    messages.map(msg => (
                      <div key={msg.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">
                            {msg.user?.username || 'Unknown'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-sm" style={{ fontFamily: '"Courier New", monospace' }}>
                          {msg.message}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                {canPost && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Type a message..."
                      className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#33a29b] focus:outline-none text-sm"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || sendingMessage}
                      className="px-4 py-2 bg-[#33a29b] text-black rounded-lg hover:bg-[#2a8a84] transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                )}
                {!canPost && (
                  <div className="text-center text-xs text-gray-500 py-2">
                    Only admins can post in broadcast channels
                  </div>
                )}
              </div>
            )}

            {/* SETTINGS TAB */}
            {activeTab === 'settings' && isCreator && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm mb-2">Group Actions</h3>
                  <div className="space-y-2">
                    <button 
                      onClick={onLeave}
                      className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-semibold flex items-center justify-center gap-2"
                    >
                      <LogOut size={16} />
                      Leave Group
                    </button>
                    <button 
                      onClick={onDelete}
                      className="w-full px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition text-sm font-semibold flex items-center justify-center gap-2"
                    >
                      <Trash2 size={16} />
                      Delete Group
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
