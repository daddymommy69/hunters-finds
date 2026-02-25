import { supabase } from './supabaseClient'
import React, { useState, useEffect } from 'react';
import { MapPin, TrendingUp, Plus, Search, X, Image, MessageSquare, Users, Compass, User, UserPlus, Bookmark, Star, List, Settings, Lock, Activity, Bell, AtSign, MessageCircle, Tag, Heart } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import LoadingSpinner from './components/LoadingSpinner';
import EmptyState from './components/EmptyState';
import { useRealTimeData } from './hooks/useRealTimeData';
import { CreateGroupModal, GroupCard } from './components/GroupsComponents';
import { GroupDetailModal } from './components/GroupDetailModal';
import { TagPill, TagFilter, AddTagsModal } from './components/TagComponents';


/*
 * MAP IMPLEMENTATION:
 * Uses Leaflet + OpenStreetMap (completely free, no API key needed!)
 * - Interactive map with restaurant markers
 * - Color-coded by SRR score
 * - Click markers to view restaurant details
 * 
 * CONSISTENT MODAL PATTERNS:
 * 
 * 1. USER PROFILE MODAL (setSelectedUser)
 *    Triggered by clicking on:
 *    - Explore > People subtab > User cards
 *    - You > Friends subtab > Friend cards
 *    - Rankings > Groups > Members sub-tab > Member cards
 *    - User Profile Modal > Top Rated dishes (shows restaurant name)
 *    
 * 2. DISH DETAIL MODAL (setSelectedDish)
 *    Triggered by clicking on:
 *    - Rankings > Top Dishes subtab > Dish cards
 *    - You > Profile subtab > Your Top Rated dishes
 *    - You > Ratings subtab > All rated dishes
 *    - You > Saved subtab > Saved dishes
 *    - User Profile Modal > Their Top Rated dishes
 *    - Group Modal > Dishes sub-tab > Dish cards
 *    - Explore > For You subtab > Recommended dishes (opens restaurant)
 *    
 * 3. RESTAURANT DETAIL MODAL (setSelectedRestaurant)
 *    Triggered by clicking on:
 *    - Rankings > Top Restaurants subtab > Restaurant cards
 *    - You > Saved subtab > Saved restaurants
 *    - Explore > For You subtab > Dish recommendations (opens parent restaurant)
 *    - Explore > Groups subtab > Group cards
 *    
 * 4. GROUP DETAIL MODAL (setSelectedGroup)
 *    Triggered by clicking on:
 *    - Rankings > Groups subtab > Group cards
 *    - You > Groups subtab > Your group cards
 *    - Explore > Groups subtab > Group cards
 *    - User Profile Modal > Shared Groups
 */





const categoryAverages = {
  'mexican': 10,
  'italian': 12,
  'american': 11,
  'various': 10
};

// Count-up animation component for scores
const CountUpScore = ({ value, duration = 800, className = "" }) => {
  const [count, setCount] = React.useState(0);
  const [hasAnimated, setHasAnimated] = React.useState(false);

  React.useEffect(() => {
    if (hasAnimated) return;
    
    setHasAnimated(true);
    const startValue = Math.max(0, value - 20);
    const increment = (value - startValue) / (duration / 16);
    let current = startValue;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value, duration, hasAnimated]);

  return <span className={className}>{count}</span>;
};

const HuntersFindsApp = () => {
  // ===== AUTHENTICATION =====
  const { user, loading: authLoading, signOut, signUpWithEmail, signInWithEmail, error: authError } = useAuth();
  
  // Real-time data
  const { dishes = [], restaurants = [], userRatings = [], loading: dataLoading, refetch: refetchData } = useRealTimeData(user);
  
  // Filter out deleted ratings from dishes
  const activeDishes = dishes.filter(dish => !dish.is_deleted);
  const activeUserRatings = userRatings.filter(rating => !rating.is_deleted);
  
  const [rankingMode, setRankingMode] = useState(() => {
    return localStorage.getItem('rankingMode') || 'global';
  });
  
  React.useEffect(() => {
    localStorage.setItem('rankingMode', rankingMode);
  }, [rankingMode]);
  
  // Fetch ALL ratings from ALL users for global rankings
  const [allRatings, setAllRatings] = useState([]);
  const [allRatingsLoading, setAllRatingsLoading] = useState(false);
  const [ratingsCallCount, setRatingsCallCount] = useState(0);
  
  // Groups state
  const [userGroups, setUserGroups] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  
  // Tags state
  const [allTags, setAllTags] = useState([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [selectedTagFilters, setSelectedTagFilters] = useState([]);
  const [expandedTagCategories, setExpandedTagCategories] = useState([]); // Track which categories are expanded
  const [isAddTagsModalOpen, setIsAddTagsModalOpen] = useState(false);
  const [tagModalItem, setTagModalItem] = useState(null); // {id, type, name}
  
  // Dish and restaurant tags (fetched when viewing item)
  const [dishTags, setDishTags] = useState({}); // { dishId: [tags with counts] }
  const [userDishTags, setUserDishTags] = useState({}); // { dishId: [tagIds user voted for] }
  
  // Location state
  const [userLocation, setUserLocation] = useState(null); // { lat, lng }
  const [nearMeEnabled, setNearMeEnabled] = useState(false);
  
  // Detect password reset redirect using Supabase's auth state listener
  React.useEffect(() => {
    console.log('Setting up password reset detection...');
    
    // IMMEDIATE CHECK: See if we're on a password reset link RIGHT NOW
    const immediateCheck = async () => {
      const hash = window.location.hash;
      console.log('Current URL hash:', hash);
      
      if (hash && hash.includes('type=recovery')) {
        console.log('RECOVERY LINK DETECTED! Checking session...');
        
        // Give Supabase a moment to process the hash
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check for existing session
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log('Current session:', session?.user?.email || 'No session');
        console.log('Session error:', error);
        
        if (session) {
          console.log('Session exists! Opening password reset modal NOW...');
          setShowNewPasswordModal(true);
        } else {
          console.log('No session found, waiting for PASSWORD_RECOVERY event...');
        }
      }
    };
    
    immediateCheck();
    
    // ALSO set up the event listener for future events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change event:', event);
      console.log('Session from event:', session?.user?.email);
      
      if (event === 'PASSWORD_RECOVERY') {
        console.log('PASSWORD_RECOVERY event fired! Opening modal...');
        setShowNewPasswordModal(true);
      }
    });
    
    // Cleanup subscription
    return () => {
      console.log('Cleaning up password reset listener');
      subscription?.unsubscribe();
    };
  }, []);
  
  // Fetch all ratings - lifted out so it can be called directly after delete
  const fetchAllRatings = React.useCallback(async () => {
    setAllRatingsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ratings')
        .select(`
          *,
          dish:dishes(*),
          rater:users!ratings_user_id_fkey(id, username, email)
        `)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching all ratings:', error);
      } else {
        // Attach username directly to each rating for easy access
        const enriched = (data || []).map(r => ({
          ...r,
          username: r.rater?.username || r.rater?.email?.split('@')[0] || null,
        }));
        setAllRatings(enriched);
      }
    } catch (error) {
      console.error('❌ Error fetching all ratings:', error);
    } finally {
      setAllRatingsLoading(false);
    }
  }, []);

  // Re-fetch when dish count changes (not on every render)
  const prevDishCountRef = React.useRef(0);
  React.useEffect(() => {
    const currentCount = dishes.length;
    if (currentCount !== prevDishCountRef.current) {
      prevDishCountRef.current = currentCount;
      fetchAllRatings();
    }
  }, [dishes]);
  
  // Fetch user's groups and all public groups
  const [hasAttemptedGroupFetch, setHasAttemptedGroupFetch] = React.useState(false);
  
  React.useEffect(() => {
    // Prevent multiple fetches
    if (!user || hasAttemptedGroupFetch) {
      return;
    }
    
    const fetchGroups = async () => {
      console.log('🔄 Starting fetchGroups...');
      setGroupsLoading(true);
      setHasAttemptedGroupFetch(true); // Set immediately to prevent re-entry
      
      try {
        // First, get group IDs the user is a member of
        console.log('📡 Fetching group_members for user:', user.id);
        const { data: memberData, error: memberError } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('user_id', user.id);

        if (memberError) {
          console.error('❌ Error fetching member data:', memberError);
          setUserGroups([]);
        } else {
          console.log('✅ Member data received:', memberData);
          const groupIds = memberData?.map(m => m.group_id) || [];
          
          // Then fetch the actual group details
          if (groupIds.length > 0) {
            console.log('📡 Fetching groups for IDs:', groupIds);
            const { data: userGroupsData, error: groupsError } = await supabase
              .from('groups')
              .select('*')
              .in('id', groupIds)
              .order('created_at', { ascending: false });

            if (groupsError) {
              console.error('❌ Error fetching user groups:', groupsError);
              setUserGroups([]);
            } else {
              console.log('✅ User groups fetched:', userGroupsData);
              setUserGroups(userGroupsData || []);
            }
          } else {
            console.log('ℹ️ User is not in any groups');
            setUserGroups([]);
          }
        }

        // Fetch all groups for discovery (public + private visible in explore)
        console.log('📡 Fetching all groups...');
        const { data: publicGroups, error: publicError } = await supabase
          .from('groups')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (publicError) {
          console.error('❌ Error fetching public groups:', publicError);
          setAllGroups([]);
        } else {
          console.log('✅ Public groups fetched:', publicGroups?.length || 0);
          setAllGroups(publicGroups || []);
        }
        
        console.log('✅ fetchGroups complete');
      } catch (error) {
        console.error('❌ Critical error in fetchGroups:', error);
      } finally {
        setGroupsLoading(false);
      }
    };

    fetchGroups();
  }, [user, hasAttemptedGroupFetch]);
  
  // Fetch all tags
  React.useEffect(() => {
    const fetchTags = async () => {
      setTagsLoading(true);
      try {
        const { data, error } = await supabase
          .from('tags')
          .select('*')
          .order('category', { ascending: true })
          .order('name', { ascending: true });

        if (error) throw error;
        setAllTags(data || []);
        console.log('✅ Fetched', data?.length || 0, 'tags');
      } catch (error) {
        console.error('❌ Error fetching tags:', error);
      } finally {
        setTagsLoading(false);
      }
    };

    fetchTags();
  }, []);
  
  // Logout confirmation modal
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  // Error modal state
  const [errorModal, setErrorModal] = useState({ show: false, title: '', message: '' });
  
  const [isMapLoaded, setIsMapLoaded] = React.useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'rankings';
  });
  
  // Save tab changes to localStorage
  React.useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);
  const [selectedDish, setSelectedDish] = useState(null);
  const [userHasRatedDish, setUserHasRatedDish] = useState(false);
  const [dishModalView, setDishModalView] = useState('scores'); // 'scores', 'photos', 'comments'
  const [restaurantModalView, setRestaurantModalView] = useState('scores'); // 'scores', 'photos', 'comments'
  const [rankingView, setRankingView] = useState(() => {
    return localStorage.getItem('rankingView') || 'dishes';
  });
  
  React.useEffect(() => {
    localStorage.setItem('rankingView', rankingView);
  }, [rankingView]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ dishes: [], restaurants: [] });
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [googlePlacesSearchResults, setGooglePlacesSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [googleSearchError, setGoogleSearchError] = useState(false);
  
  // Google Places optimization state
  const [showNearbyToggle, setShowNearbyToggle] = useState(false);
  const [includeNearby, setIncludeNearby] = useState(false);
  const [showMapFindNearby, setShowMapFindNearby] = useState(true);
  
  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);
  const [exploreView, setExploreView] = useState(() => {
    return localStorage.getItem('exploreView') || 'for-you';
  });
  const [exploreForYouTab, setExploreForYouTab] = useState('recommended');
  const [exploreNearMe, setExploreNearMe] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [allUsersLoading, setAllUsersLoading] = useState(false);
  const [selectedExploreUser, setSelectedExploreUser] = useState(null);
  const [followingIds, setFollowingIds] = useState(new Set());

  React.useEffect(() => {
    localStorage.setItem('exploreView', exploreView);
  }, [exploreView]);
  const [youView, setYouView] = useState(() => {
    return localStorage.getItem('youView') || 'profile';
  });
  
  // Save youView changes
  React.useEffect(() => {
    localStorage.setItem('youView', youView);
  }, [youView]);
  const [isNewListModalOpen, setIsNewListModalOpen] = useState(false);
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [newListName, setNewListName] = useState('');
  const [newListItems, setNewListItems] = useState([]);
  const [newListCollaborators, setNewListCollaborators] = useState([]);
  const [listItemSearch, setListItemSearch] = useState('');
  const [collaboratorSearch, setCollaboratorSearch] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState([]);
  const [groupMemberSearch, setGroupMemberSearch] = useState('');
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [submittedRating, setSubmittedRating] = useState(null);
  const [isResultsClosing, setIsResultsClosing] = useState(false);
  const [isSubmissionClosing, setIsSubmissionClosing] = useState(false);
  const [isDishModalClosing, setIsDishModalClosing] = useState(false);
  const [isNewListModalClosing, setIsNewListModalClosing] = useState(false);
  const [isNewGroupModalClosing, setIsNewGroupModalClosing] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [isRestaurantModalClosing, setIsRestaurantModalClosing] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [isGroupModalClosing, setIsGroupModalClosing] = useState(false);
  const [groupModalView, setGroupModalView] = useState('members');
  const [savedItems, setSavedItems] = useState([]);
  const [userLists, setUserLists] = useState([]);
  const [selectedUser, setSelectedUserRaw] = useState(null);
  const setSelectedUser = (u) => { setSelectedUserRaw(u); setProfileModalTab('stats'); };
  const [isUserModalClosing, setIsUserModalClosing] = useState(false);
  const [modalStack, setModalStack] = useState([]);
  const [restaurant, setRestaurant] = useState('');
  const [dishName, setDishName] = useState('');
  const [dishCategory, setDishCategory] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const categoryDropdownRef = React.useRef(null);
  const [categoryShowAll, setCategoryShowAll] = useState(false);
  const [categoryConfirmNew, setCategoryConfirmNew] = useState(null); // string to confirm adding
  const [categoryLocked, setCategoryLocked] = useState(false); // true once a valid category is selected
  const [price, setPrice] = useState('');
  const [tasteScore, setTasteScore] = useState(50);
  const [portionScore, setPortionScore] = useState(50);
  const [priceScore, setPriceScore] = useState(50);
  const [comment, setComment] = useState('');
  
  // Google Places search for rating modal
  const [showRestaurantSearch, setShowRestaurantSearch] = useState(false);
  const [restaurantSearchResults, setRestaurantSearchResults] = useState([]);
  const [restaurantSearchLoading, setRestaurantSearchLoading] = useState(false);
  const [selectedGooglePlace, setSelectedGooglePlace] = useState(null);
  
  
  // Photo upload state
  const [dishPhotos, setDishPhotos] = useState([]);
  const [photoPreview, setPhotoPreview] = useState([]);
  
  // Enhanced Map State
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [mapInstance, setMapInstance] = useState(null);
  const [mapFilterCuisine, setMapFilterCuisine] = useState('all');
  const [mapShowHighRatedOnly, setMapShowHighRatedOnly] = useState(false);
  const [showMapFilters, setShowMapFilters] = useState(false);
  const [mapFilters, setMapFilters] = useState({
    popularity: [],
    quality: [],
    recency: [],
    social: [],
    distance: []
  });
  const [googlePlacesResults, setGooglePlacesResults] = useState([]);
  
  // Phase 5: Photo Gallery State
  const [selectedDishPhotos, setSelectedDishPhotos] = useState([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  // Auth form states
  const [authMode, setAuthMode] = useState('signin'); // 'signin' or 'signup'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFormLoading, setAuthFormLoading] = useState(false);
  
  // Password reset states
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [showNewPasswordModal, setShowNewPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  
  // Success toast
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Mock groups data (temporary - empty array until backend ready)
  const mockGroups = [];
  
  // Mock users for friend search (temporary - until backend ready)
  const mockUsers = [];
  
  // ADMIN SYSTEM STATES
  const [userRole, setUserRole] = useState('user'); // 'admin', 'moderator', or 'user'
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [showDeletedItems, setShowDeletedItems] = useState(false);
  const [showMergeRestaurants, setShowMergeRestaurants] = useState(false);
  const [deletedItemsCount, setDeletedItemsCount] = useState(0);
  
  // Merge Restaurants states
  const [mergeFromRestaurant, setMergeFromRestaurant] = useState('');
  const [mergeToRestaurant, setMergeToRestaurant] = useState('');
  const [mergeLoading, setMergeLoading] = useState(false);
  const [mergePreview, setMergePreview] = useState(null);
  
  // Deleted Items states
  const [deletedItems, setDeletedItems] = useState([]);
  const [deletedItemsLoading, setDeletedItemsLoading] = useState(false);
  
  // Restaurant Linking states
  const [showLinkRestaurants, setShowLinkRestaurants] = useState(false);
  const [unlinkedRestaurants, setUnlinkedRestaurants] = useState([]);
  const [linkingRestaurant, setLinkingRestaurant] = useState(null);
  const [placeSearchResults, setPlaceSearchResults] = useState([]);
  const [placeSearchLoading, setPlaceSearchLoading] = useState(false);
  
  // Edit/Delete states
  const [editingRating, setEditingRating] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDishName, setEditDishName] = useState('');
  const [editRestaurant, setEditRestaurant] = useState('');
  const [showEditRestaurantSearch, setShowEditRestaurantSearch] = useState(false);
  const [editRestaurantSearchResults, setEditRestaurantSearchResults] = useState([]);
  const [editTaste, setEditTaste] = useState(50);
  const [editPortion, setEditPortion] = useState(50);
  const [editPriceValue, setEditPriceValue] = useState(50);
  const [editPrice, setEditPrice] = useState('');
  const [editComment, setEditComment] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingRating, setDeletingRating] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Fetch user role (admin, moderator, or user)
  React.useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        console.log('No user logged in, defaulting to user role');
        setUserRole('user');
        return;
      }
      
      console.log('🔍 Fetching role for user:', user.email);
      
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();
        
        if (data) {
          console.log('✅ User role found:', data.role);
          setUserRole(data.role);
        } else {
          console.log('ℹ️ No role found in database, defaulting to user');
          setUserRole('user');
        }
        
        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error('❌ Error fetching user role:', error);
        }
      } catch (error) {
        console.error('❌ Error in fetchUserRole:', error);
        setUserRole('user');
      }
    };
    
    fetchUserRole();
  }, [user]);
  
  // Fetch deleted items count for admin
  React.useEffect(() => {
    const fetchDeletedCount = async () => {
      if (!user || userRole !== 'admin') return;
      
      const { count } = await supabase
        .from('deleted_ratings')
        .select('*', { count: 'exact', head: true })
        .gte('can_restore_until', new Date().toISOString());
      
      setDeletedItemsCount(count || 0);
    };
    
    fetchDeletedCount();
  }, [user, userRole]);
  
  // PASSWORD RESET FUNCTIONS
  const handlePasswordReset = async () => {
    if (!resetEmail) {
      setErrorModal({
        show: true,
        title: 'Email Required',
        message: 'Please enter your email address.'
      });
      return;
    }
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        resetEmail,
        { redirectTo: window.location.origin }
      );
      
      if (error) {
        // Check for rate limiting
        if (error.message && error.message.includes('seconds')) {
          throw new Error('Please wait a moment before requesting another reset link.');
        }
        throw error;
      }
      
      setResetSent(true);
      setTimeout(() => {
        setShowPasswordReset(false);
        setResetSent(false);
        setResetEmail('');
      }, 3000);
    } catch (error) {
      console.error('Password reset error:', error);
      setErrorModal({
        show: true,
        title: 'Reset Failed',
        message: error.message || 'Unable to send reset email. Please try again.'
      });
    }
  };
  
  const handleSetNewPassword = async () => {
    console.log('===== PASSWORD RESET FUNCTION CALLED =====');
    console.log('newPassword:', newPassword);
    console.log('confirmPassword:', confirmPassword);
    
    // Validation
    if (newPassword !== confirmPassword) {
      console.log('ERROR: Passwords do not match');
      setErrorModal({
        show: true,
        title: 'Passwords Don\'t Match',
        message: 'Please make sure both passwords match.'
      });
      return;
    }
    
    if (newPassword.length < 6) {
      console.log('ERROR: Password too short');
      setErrorModal({
        show: true,
        title: 'Password Too Short',
        message: 'Password must be at least 6 characters long.'
      });
      return;
    }
    
    console.log('Validation passed. Starting password update...');
    
    // Start loading
    setPasswordResetLoading(true);
    console.log('Loading state set to true');
    
    try {
      console.log('Calling supabase.auth.updateUser...');
      
      // Update password
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) {
        console.error('SUPABASE ERROR:', error);
        throw error;
      }
      
      console.log('SUCCESS! Password updated:', data);
      
      // Close modal
      console.log('Closing modal...');
      setShowNewPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
      setPasswordResetLoading(false);
      
      // Clear hash from URL
      window.location.hash = '';
      console.log('Hash cleared from URL');
      
      // Wait a moment for modal to close
      console.log('Waiting 300ms before redirect...');
      setTimeout(() => {
        console.log('Switching to rankings tab...');
        setActiveTab('rankings');
        
        // Show success toast
        console.log('Showing success toast...');
        setSuccessMessage('Password updated! You are now logged in.');
        setShowSuccessToast(true);
        
        // Hide toast after 2 seconds
        setTimeout(() => {
          console.log('Hiding toast...');
          setShowSuccessToast(false);
        }, 2000);
      }, 300);
      
    } catch (error) {
      console.error('CATCH BLOCK - Error in handleSetNewPassword:', error);
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);
      setPasswordResetLoading(false);
      
      // Better error messages
      let errorMessage = 'Unable to update password. Please try again.';
      
      if (error.message && error.message.includes('same')) {
        errorMessage = 'New password must be different from your current password.';
      } else if (error.message && error.message.includes('session')) {
        errorMessage = 'Session expired. Please request a new reset link.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      console.log('Showing error modal:', errorMessage);
      setErrorModal({
        show: true,
        title: 'Update Failed',
        message: errorMessage
      });
    }
    
    console.log('===== PASSWORD RESET FUNCTION COMPLETE =====');
  };
  
  // SOCIAL LOGIN FUNCTION
  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      
      if (error) throw error;
    } catch (error) {
      setErrorModal({
        show: true,
        title: 'Login Error',
        message: error.message
      });
    }
  };
  
  // ADMIN PERMISSION FUNCTIONS
  const canEditRating = (rating) => {
    // Admin and moderator can edit anything
    if (userRole === 'admin' || userRole === 'moderator') return true;
    
    // User can edit their own ratings
    return rating.user_id === user?.id;
  };
  
  const canDeleteRating = (rating) => {
    // Admin can delete anything
    if (userRole === 'admin') return true;
    
    // Moderator can delete any rating
    if (userRole === 'moderator') return true;
    
    // User can delete own rating within 24 hours
    if (rating.user_id === user?.id) {
      const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
      const ratingTime = new Date(rating.created_at).getTime();
      return ratingTime > twentyFourHoursAgo;
    }
    
    return false;
  };
  
  // EDIT RATING HANDLER
  const handleEditRating = (rating) => {
    console.log('Editing rating:', rating);
    setEditingRating(rating);
    setEditDishName(rating.dish?.name || rating.dish_name || '');
    setEditRestaurant(rating.restaurant_name || '');
    setEditTaste(rating.taste_score || 50);
    setEditPortion(rating.portion_score || 50);
    setEditPriceValue(rating.price_value_score || 50);
    setEditPrice(rating.price?.toString() || '');
    setEditComment(rating.comment || '');
    setShowEditModal(true);
  };
  
  // SAVE EDITED RATING
  const saveEditedRating = async () => {
    if (!editingRating) return;
    
    try {
      console.log('Saving edited rating (complex mode)...');
      console.log('Original rating:', editingRating);
      console.log('New values:', {
        dishName: editDishName,
        restaurant: editRestaurant,
        taste: editTaste,
        portion: editPortion,
        priceValue: editPriceValue,
        price: editPrice,
        comment: editComment
      });
      
      // Step 1: Check if dish name or restaurant changed
      const dishNameChanged = editDishName !== (editingRating.dish?.name || editingRating.dish_name);
      const restaurantChanged = editRestaurant !== editingRating.restaurantName;
      const priceChanged = parseFloat(editPrice) !== editingRating.price;
      
      let dishId = editingRating.dish_id || editingRating.id;
      
      // Step 2: If dish name, restaurant, or price changed, update or create dish
      if (dishNameChanged || restaurantChanged || priceChanged) {
        console.log('Dish/Restaurant/Price changed, updating dishes table...');
        
        // Find the restaurant ID - use raw DB restaurants, not computed allRestaurants
        // This ensures we can find restaurants even if they have no active ratings
        const targetRestaurant = restaurants.find(r => 
          r.name.toLowerCase() === editRestaurant.toLowerCase()
        );
        const restaurantId = targetRestaurant?.id;
        
        if (!restaurantId) {
          console.error('Restaurant not found in DB. Available:', restaurants.map(r => r.name));
          console.error('Looking for:', editRestaurant);
          throw new Error(`Restaurant "${editRestaurant}" not found in database.`);
        }
        
        // Update the dish
        const { error: dishError } = await supabase
          .from('dishes')
          .update({
            name: editDishName,
            restaurant_id: restaurantId,
            price: parseFloat(editPrice) || null
          })
          .eq('id', dishId);
        
        if (dishError) {
          console.error('Error updating dish:', dishError);
          throw dishError;
        }
        
        console.log('Dish updated successfully!');
      }
      
      // Step 3: Update the rating (scores and comment only)
      const { error: ratingError } = await supabase
        .from('ratings')
        .update({
          taste_score: editTaste,
          portion_score: editPortion,
          price_score: editPriceValue,
          comment: editComment,
          edited_at: new Date().toISOString(),
          edit_count: (editingRating.edit_count || 0) + 1
        })
        .eq('id', editingRating.id);
      
      if (ratingError) {
        console.error('Error updating rating:', ratingError);
        throw ratingError;
      }
      
      console.log('Rating updated successfully!');
      
      // Close modal
      setShowEditModal(false);
      setEditingRating(null);
      
      // Show success
      setErrorModal({
        show: true,
        title: 'Rating Updated',
        message: 'Your changes have been saved!'
      });
      
      // Immediately remove from allRatings state
      setAllRatings(prev => prev.filter(r => r.id !== deletingRating.id));
      // Refetch all data to sync
      if (refetchData) refetchData();
      
    } catch (error) {
      console.error('Error saving rating:', error);
      setErrorModal({
        show: true,
        title: 'Edit Failed',
        message: error.message || 'Failed to save changes'
      });
    }
  };
  
  // DELETE RATING HANDLER
  const handleDeleteRating = (rating) => {
    console.log('Delete requested for:', rating);
    setDeletingRating(rating);
    setShowDeleteConfirm(true);
  };
  
  // CONFIRM DELETE (PERMANENT)
  const confirmDeleteRating = async () => {
    if (!deletingRating || isDeleting) return;
    setIsDeleting(true);
    
    try {
      // Capture before clearing state
      const deletedId = deletingRating.id;
      const deletedDishName = deletingRating.dish?.name || deletingRating.dish_name;
      const deletedDishId = deletingRating.dish_id;

      // Permanently delete the rating
      const { error: deleteError } = await supabase
        .from('ratings')
        .delete()
        .eq('id', deletedId);
      
      if (deleteError) {
        console.error('Delete error:', deleteError);
        throw deleteError;
      }
      
      console.log('Rating permanently deleted!');
      
      // Close modal and clear state
      setShowDeleteConfirm(false);
      setDeletingRating(null);
      setIsDeleting(false);
      
      // Immediately remove from state
      setAllRatings(prev => prev.filter(r => r.id !== deletedId));
      if (refetchData) await refetchData();
      await fetchAllRatings();
      
      // Offer to re-rate
      setErrorModal({
        show: true,
        title: 'Rating Deleted',
        message: `Your rating for "${deletedDishName}" has been removed. Want to re-rate it?`,
        confirmLabel: 'Re-rate now',
        cancelLabel: 'No thanks',
        confirmAction: () => {
          setErrorModal({ show: false });
          // Pre-fill the rating modal with the dish info
          setRestaurant('');
          setDishName(deletedDishName || '');
          setSelectedGooglePlace(null);
          setIsSubmissionModalOpen(true);
        }
      });
      
    } catch (error) {
      setIsDeleting(false);
      console.error('Error deleting rating:', error);
      setErrorModal({
        show: true,
        title: 'Delete Failed',
        message: error.message || 'Failed to delete rating'
      });
    }
  };
  
  // MERGE RESTAURANTS FUNCTIONS
  const previewMerge = () => {
    if (!mergeFromRestaurant || !mergeToRestaurant) {
      setErrorModal({
        show: true,
        title: 'Missing Information',
        message: 'Please select both restaurants to merge'
      });
      return;
    }
    
    if (mergeFromRestaurant === mergeToRestaurant) {
      setErrorModal({
        show: true,
        title: 'Invalid Merge',
        message: 'Cannot merge a restaurant with itself'
      });
      return;
    }
    
    // Count ratings that will be moved
    const ratingsToMove = allRatings.filter(r => {
      // Check if rating's restaurant matches the "from" restaurant
      const ratingRestaurant = restaurants.find(rest => rest.id === r.restaurant_id)?.name;
      return ratingRestaurant === mergeFromRestaurant;
    });
    
    setMergePreview({
      from: mergeFromRestaurant,
      to: mergeToRestaurant,
      ratingsCount: ratingsToMove.length
    });
  };
  
  const confirmMerge = async () => {
    if (!mergePreview) return;
    
    setMergeLoading(true);
    
    try {
      console.log('Merging restaurants:', mergePreview);
      
      // Get the restaurant IDs
      const fromRestaurant = restaurants.find(r => r.name === mergePreview.from);
      const toRestaurant = restaurants.find(r => r.name === mergePreview.to);
      
      if (!fromRestaurant || !toRestaurant) {
        throw new Error('Restaurant not found');
      }
      
      // Update all DISHES from old restaurant to new restaurant
      // (Ratings are linked to dishes, dishes are linked to restaurants)
      const { error: updateError } = await supabase
        .from('dishes')
        .update({ restaurant_id: toRestaurant.id })
        .eq('restaurant_id', fromRestaurant.id);
      
      if (updateError) {
        console.error('Error updating dishes:', updateError);
        throw updateError;
      }
      
      console.log(`Moved all dishes from "${mergePreview.from}" to "${mergePreview.to}"`);
      
      // Log the merge in a merge history table (if it exists)
      try {
        await supabase.from('restaurant_merges').insert({
          from_restaurant_id: fromRestaurant.id,
          from_restaurant_name: mergePreview.from,
          to_restaurant_id: toRestaurant.id,
          to_restaurant_name: mergePreview.to,
          merged_by: user.id,
          dishes_moved: mergePreview.ratingsCount,
          merged_at: new Date().toISOString()
        });
      } catch (logError) {
        console.log('Could not log merge (table may not exist):', logError);
      }
      
      console.log('Merge successful!');
      
      // Close modal and reset
      setShowMergeRestaurants(false);
      setMergePreview(null);
      setMergeFromRestaurant('');
      setMergeToRestaurant('');
      
      // Show success
      setErrorModal({
        show: true,
        title: 'Merge Complete',
        message: `Successfully moved all dishes from "${mergePreview.from}" to "${mergePreview.to}". All ratings will now appear under the correct restaurant!`
      });
      
      // Refresh
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      console.error('Error merging restaurants:', error);
      setErrorModal({
        show: true,
        title: 'Merge Failed',
        message: error.message || 'Failed to merge restaurants'
      });
    } finally {
      setMergeLoading(false);
    }
  };
  
  // FETCH DELETED ITEMS
  const fetchDeletedItems = async () => {
    if (!user || userRole === 'user') return;
    
    setDeletedItemsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('deleted_ratings')
        .select('*')
        .gte('can_restore_until', new Date().toISOString())
        .order('deleted_at', { ascending: false });
      
      if (error) throw error;
      
      console.log('Fetched deleted items:', data);
      setDeletedItems(data || []);
      
    } catch (error) {
      console.error('Error fetching deleted items:', error);
      setErrorModal({
        show: true,
        title: 'Error',
        message: 'Failed to load deleted items'
      });
    } finally {
      setDeletedItemsLoading(false);
    }
  };
  
  // RESTORE DELETED ITEM
  const restoreDeletedItem = async (deletedItem) => {
    try {
      console.log('Restoring item:', deletedItem);
      
      // 1. Unmark as deleted in ratings table
      const { error: restoreError } = await supabase
        .from('ratings')
        .update({
          is_deleted: false,
          deleted_at: null,
          deleted_by: null
        })
        .eq('id', deletedItem.original_rating_id);
      
      if (restoreError) throw restoreError;
      
      // 2. Remove from deleted_ratings table
      const { error: deleteError } = await supabase
        .from('deleted_ratings')
        .delete()
        .eq('id', deletedItem.id);
      
      if (deleteError) throw deleteError;
      
      console.log('Item restored successfully!');
      
      // Show success
      setErrorModal({
        show: true,
        title: 'Restored!',
        message: `"${deletedItem.dish_name}" has been restored`
      });
      
      // Refresh deleted items list
      fetchDeletedItems();
      
      // Update count
      setDeletedItemsCount(prev => Math.max(0, prev - 1));
      
    } catch (error) {
      console.error('Error restoring item:', error);
      setErrorModal({
        show: true,
        title: 'Restore Failed',
        message: error.message || 'Failed to restore item'
      });
    }
  };
  
  // PERMANENTLY DELETE ITEM
  const permanentlyDeleteItem = async (deletedItem) => {
    if (!window.confirm(`Permanently delete "${deletedItem.dish_name}"? This cannot be undone!`)) {
      return;
    }
    
    try {
      // Remove from deleted_ratings table
      const { error } = await supabase
        .from('deleted_ratings')
        .delete()
        .eq('id', deletedItem.id);
      
      if (error) throw error;
      
      console.log('Item permanently deleted');
      
      setErrorModal({
        show: true,
        title: 'Deleted Permanently',
        message: `"${deletedItem.dish_name}" has been permanently removed`
      });
      
      // Refresh list
      fetchDeletedItems();
      setDeletedItemsCount(prev => Math.max(0, prev - 1));
      
    } catch (error) {
      console.error('Error permanently deleting:', error);
      setErrorModal({
        show: true,
        title: 'Delete Failed',
        message: error.message || 'Failed to delete permanently'
      });
    }
  };
  
  // Fetch deleted items when modal opens
  React.useEffect(() => {
    if (showDeletedItems) {
      fetchDeletedItems();
    }
  }, [showDeletedItems]);
  
  // RESTAURANT LINKING FUNCTIONS
  // Fetch unlinked restaurants when modal opens
  React.useEffect(() => {
    if (showLinkRestaurants) {
      fetchUnlinkedRestaurants();
    }
  }, [showLinkRestaurants]);
  
  const fetchUnlinkedRestaurants = async () => {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .is('google_place_id', null)
        .order('name');
      
      if (error) throw error;
      
      console.log('Unlinked restaurants:', data);
      setUnlinkedRestaurants(data || []);
      
    } catch (error) {
      console.error('Error fetching restaurants:', error);
    }
  };
  
  const searchGooglePlaces = async (restaurantName) => {
    setPlaceSearchLoading(true);
    setPlaceSearchResults([]);
    
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(restaurantName)}&key=${GOOGLE_PLACES_API_KEY}`
      );
      
      const data = await response.json();
      
      if (data.results) {
        console.log('Found places:', data.results);
        setPlaceSearchResults(data.results.slice(0, 5)); // Top 5 results
      }
      
    } catch (error) {
      console.error('Error searching places:', error);
      setErrorModal({
        show: true,
        title: 'Search Failed',
        message: 'Could not search Google Places'
      });
    } finally {
      setPlaceSearchLoading(false);
    }
  };
  
  const linkRestaurantToPlace = async (restaurant, place) => {
    try {
      console.log('Linking restaurant:', restaurant.name, 'to place:', place.name);
      
      const { error } = await supabase
        .from('restaurants')
        .update({
          google_place_id: place.place_id,
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
          address: place.formatted_address,
          google_data: place
        })
        .eq('id', restaurant.id);
      
      if (error) throw error;
      
      console.log('Restaurant linked successfully!');
      
      setErrorModal({
        show: true,
        title: 'Linked!',
        message: `"${restaurant.name}" is now linked to Google Places and will appear on the map!`
      });
      
      // Refresh list
      fetchUnlinkedRestaurants();
      setLinkingRestaurant(null);
      setPlaceSearchResults([]);
      
    } catch (error) {
      console.error('Error linking restaurant:', error);
      setErrorModal({
        show: true,
        title: 'Link Failed',
        message: error.message || 'Failed to link restaurant'
      });
    }
  };
  
  // Search Google Places for rating modal
  const searchRestaurantForRating = async (query) => {
    if (!query || query.length < 3) {
      setRestaurantSearchResults([]);
      setShowRestaurantSearch(false);
      return;
    }
    
    setRestaurantSearchLoading(true);
    
    // Search database
    const matchingRestaurants = (restaurants || []).filter(restaurant =>
      restaurant.name.toLowerCase().includes(query.toLowerCase())
    );
    
    let results = matchingRestaurants.map(r => ({
      name: r.name,
      formatted_address: r.address || 'No address',
      rating: null,
      place_id: r.google_place_id,
      geometry: r.latitude && r.longitude ? {
        location: { lat: r.latitude, lng: r.longitude }
      } : null,
      isDatabase: true
    }));
    
    // Search Google Places API via Vercel serverless function
    try {
      const location = userLocation || { lat: 37.8044, lng: -122.2712 };
      const apiUrl = `/api/places/search?query=${encodeURIComponent(query)}&lat=${location.lat}&lng=${location.lng}`;
      
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results) {
        const googleResults = data.results.slice(0, 5).map(r => {
          // Normalize lat/lng — API returns plain numbers, not functions
          const lat = r.geometry?.location?.lat;
          const lng = r.geometry?.location?.lng;
          const latVal = typeof lat === 'function' ? lat() : lat;
          const lngVal = typeof lng === 'function' ? lng() : lng;
          return {
            name: r.name,
            formatted_address: r.formatted_address || r.vicinity,
            rating: r.rating,
            user_ratings_total: r.user_ratings_total,
            place_id: r.place_id,
            geometry: latVal && lngVal ? { location: { lat: latVal, lng: lngVal } } : r.geometry,
            isDatabase: false
          };
        });
        results = [...results, ...googleResults];
      }
    } catch (error) {
      console.log('Google search skipped (proxy offline)');
    }
    
    setRestaurantSearchResults(results.slice(0, 8));
    setRestaurantSearchLoading(false);
  };
  
  // Normalize any Google place object into consistent format with geometry.location.lat/lng
  const normalizeGooglePlace = (place) => {
    // Handle flat lat/lng (from searchGooglePlacesAPI)
    if (place.lat && place.lng && !place.geometry) {
      return {
        ...place,
        geometry: { location: { lat: place.lat, lng: place.lng } },
        formatted_address: place.formatted_address || place.address,
      };
    }
    // Handle geometry with function-style lat/lng (from Google JS SDK)
    const lat = place.geometry?.location?.lat;
    const lng = place.geometry?.location?.lng;
    return {
      ...place,
      formatted_address: place.formatted_address || place.address,
      geometry: {
        location: {
          lat: typeof lat === 'function' ? lat() : lat,
          lng: typeof lng === 'function' ? lng() : lng,
        }
      }
    };
  };

  const selectGooglePlaceForRating = (place) => {
    const normalizedPlace = normalizeGooglePlace(place);
    console.log('✅ Selected Google place:', normalizedPlace.name, 'lat:', normalizedPlace.geometry.location.lat, 'lng:', normalizedPlace.geometry.location.lng);
    setSelectedGooglePlace(normalizedPlace);
    setRestaurant(normalizedPlace.name);
    setShowRestaurantSearch(false);
    setRestaurantSearchResults([]);
  };
  
  // Friend search state
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState([]);
  const [showFriendSearch, setShowFriendSearch] = useState(false);
  
  // Phase 4: Social Features State
  const [userFollows, setUserFollows] = useState([]); // People user follows (friends)
  const [suggestedFriends, setSuggestedFriends] = useState([]);
  const [activityFeed, setActivityFeed] = useState([]);
  const [activityFilter, setActivityFilter] = useState('all');
  const [youActivityFilter, setYouActivityFilter] = useState('all'); // all | ratings | following | groups | likes
  const [globalActivityFeed, setGlobalActivityFeed] = useState([]);
  const [globalActivityLoading, setGlobalActivityLoading] = useState(false);
  const [exploreActivityNearMe, setExploreActivityNearMe] = useState(false);
  const [userFollowers, setUserFollowers] = useState([]);
  const [ratingLikes, setRatingLikes] = useState({});
  const [selectedRatingDetail, setSelectedRatingDetail] = useState(null);
  const [ratingComments, setRatingComments] = useState({}); // { ratingId: { comments, loading, loaded } }
  const [expandedComments, setExpandedComments] = useState(new Set()); // ratingIds with open comment threads
  const [commentInputs, setCommentInputs] = useState({}); // { ratingId: text }
  const [replyingTo, setReplyingTo] = useState({}); // { ratingId: { commentId, username } }
  const [commentShowAll, setCommentShowAll] = useState({}); // { ratingId: bool }
  const [commentLikes, setCommentLikes] = useState({}); // { commentId: { count, likedByMe } }
  const [expandedReplies, setExpandedReplies] = useState(new Set()); // commentIds with expanded replies
  const [dishComments, setDishComments] = useState([]); // unified comments for dish modal
  const [dishCommentsLoading, setDishCommentsLoading] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState('stats');
  const [selectedUserActivity, setSelectedUserActivity] = useState([]);
  const [likesModalRatingId, setLikesModalRatingId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Filter states
  const [selectedCuisine, setSelectedCuisine] = useState('all');
  const [selectedPriceRange, setSelectedPriceRange] = useState('all');
  const [selectedRating, setSelectedRating] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch tags when dish modal opens
  React.useEffect(() => {
    if (selectedDish) {
      fetchTagsForItem(selectedDish.id, 'dish');
    }
  }, [selectedDish]);


  

  React.useEffect(() => {
    // Load Leaflet CSS and JS (free OpenStreetMap alternative)
    if (window.L) {
      setIsMapLoaded(true);
      return;
    }

    // Load Leaflet CSS
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    cssLink.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    cssLink.crossOrigin = '';
    document.head.appendChild(cssLink);

    // Load Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = '';
    script.async = false; // Load synchronously to ensure it's available
    script.onload = () => {
      console.log('Leaflet loaded successfully');
      
      // Load Leaflet MarkerCluster plugin
      const clusterCSS = document.createElement('link');
      clusterCSS.rel = 'stylesheet';
      clusterCSS.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css';
      document.head.appendChild(clusterCSS);

      const clusterDefaultCSS = document.createElement('link');
      clusterDefaultCSS.rel = 'stylesheet';
      clusterDefaultCSS.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css';
      document.head.appendChild(clusterDefaultCSS);

      const clusterScript = document.createElement('script');
      clusterScript.src = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js';
      clusterScript.onload = () => {
        console.log('Leaflet MarkerCluster loaded successfully');
      };
      document.head.appendChild(clusterScript);
      
      setIsMapLoaded(true);
    };
    script.onerror = (error) => {
      console.error('Failed to load Leaflet:', error);
      setIsMapLoaded(false);
    };
    document.head.appendChild(script);
  }, []);

  // ============================================
  // INLINE COMMENT THREAD RENDERER
  // ============================================
  const renderCommentThread = (ratingId, ratingNote, ratingUsername, bgClass = 'bg-white') => {
    const state = ratingComments[ratingId] || { comments: [], loading: false, loaded: false };
    const allComments = state.comments || [];
    const topLevel = allComments.filter(c => !c.parent_id);
    const replies = (parentId) => allComments.filter(c => c.parent_id === parentId);
    const showAll = commentShowAll[ratingId];
    const SHOW_COUNT = 3;
    const visibleTop = showAll ? topLevel : topLevel.slice(0, SHOW_COUNT);
    const myUsername = user?.user_metadata?.username || user?.email?.split('@')[0] || '';

    const timeAgo = (ts) => {
      const h = (Date.now() - new Date(ts)) / 3600000;
      if (h < 1) return 'just now';
      if (h < 24) return `${Math.floor(h)}h ago`;
      return `${Math.floor(h / 24)}d ago`;
    };

    const CommentRow = ({ c, isReply = false }) => {
      const cLikes = commentLikes[c.id] || { count: 0, likedByMe: false };
      const isOwn = user && c.user_id === user.id;
      const childReplies = replies(c.id);
      const repliesExpanded = expandedReplies.has(c.id);
      return (
        <div className={`${isReply ? 'ml-7 mt-1.5' : 'mt-2'}`}>
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#33a29b] to-[#2a8a84] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
              {(c.username || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold" style={{ fontFamily: '"Courier New", monospace' }}>@{c.username}</span>
                <span className="text-[10px] text-gray-400" style={{ fontFamily: '"Courier New", monospace' }}>{timeAgo(c.created_at)}</span>
                {isOwn && (
                  <button
                    onClick={(e) => handleDeleteComment(c.id, ratingId, e)}
                    className="text-[10px] text-gray-400 hover:text-red-400 transition"
                    style={{ fontFamily: '"Courier New", monospace' }}
                  >delete</button>
                )}
              </div>
              <p className="text-xs text-gray-700 mt-0.5 leading-relaxed" style={{ fontFamily: '"Courier New", monospace' }}>{c.content}</p>
              <div className="flex items-center gap-3 mt-1">
                <button
                  onClick={(e) => { e.stopPropagation(); setReplyingTo(prev => ({ ...prev, [ratingId]: { commentId: c.id, username: c.username } })); setCommentInputs(prev => ({ ...prev, [ratingId]: `@${c.username} ` })); }}
                  className="text-[10px] text-gray-400 hover:text-[#33a29b] font-medium transition"
                  style={{ fontFamily: '"Courier New", monospace' }}
                >reply</button>
                <button
                  onClick={(e) => handleToggleCommentLike(c.id, e)}
                  className={`flex items-center gap-0.5 text-[10px] transition ${cLikes.likedByMe ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`}
                >
                  <Heart size={11} className={cLikes.likedByMe ? 'fill-current' : ''} />
                  {cLikes.count > 0 && <span style={{ fontFamily: '"Courier New", monospace' }}>{cLikes.count}</span>}
                </button>
              </div>
            </div>
          </div>
          {/* Replies */}
          {childReplies.length > 0 && (
            <div className="ml-7 mt-1">
              <button
                onClick={(e) => { e.stopPropagation(); setExpandedReplies(prev => { const n = new Set(prev); repliesExpanded ? n.delete(c.id) : n.add(c.id); return n; }); }}
                className="text-[10px] text-[#33a29b] font-medium"
                style={{ fontFamily: '"Courier New", monospace' }}
              >
                {repliesExpanded ? '▲ hide replies' : `▼ ${childReplies.length} ${childReplies.length === 1 ? 'reply' : 'replies'}`}
              </button>
              {repliesExpanded && childReplies.map(r => <CommentRow key={r.id} c={r} isReply />)}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className={`${bgClass} rounded-b-xl border-t border-gray-100 px-3 pb-3 pt-2`} onClick={e => e.stopPropagation()}>
        {/* Pinned note (original rating comment) */}
        {ratingNote && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-2 flex items-start gap-2">
            <Star size={11} className="text-yellow-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold text-yellow-700" style={{ fontFamily: '"Courier New", monospace' }}>@{ratingUsername}</span>
              <p className="text-xs text-gray-700 italic mt-0.5" style={{ fontFamily: '"Courier New", monospace' }}>"{ratingNote}"</p>
            </div>
          </div>
        )}

        {/* Comments */}
        {state.loading ? (
          <div className="text-xs text-gray-400 text-center py-2" style={{ fontFamily: '"Courier New", monospace' }}>loading...</div>
        ) : topLevel.length === 0 ? (
          <div className="text-xs text-gray-400 text-center py-2" style={{ fontFamily: '"Courier New", monospace' }}>no comments yet — be first!</div>
        ) : (
          <>
            {visibleTop.map(c => <CommentRow key={c.id} c={c} />)}
            {topLevel.length > SHOW_COUNT && (
              <button
                onClick={(e) => { e.stopPropagation(); setCommentShowAll(prev => ({ ...prev, [ratingId]: !showAll })); }}
                className="text-[10px] text-[#33a29b] font-medium mt-2 block"
                style={{ fontFamily: '"Courier New", monospace' }}
              >
                {showAll ? '▲ show less' : `▼ show ${topLevel.length - SHOW_COUNT} more comments`}
              </button>
            )}
          </>
        )}

        {/* Comment input */}
        {user ? (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#33a29b] to-[#2a8a84] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
              {(myUsername || '?')[0].toUpperCase()}
            </div>
            {replyingTo[ratingId] && (
              <button
                onClick={(e) => { e.stopPropagation(); setReplyingTo(prev => { const n = {...prev}; delete n[ratingId]; return n; }); setCommentInputs(prev => ({ ...prev, [ratingId]: '' })); }}
                className="text-[10px] text-[#33a29b] whitespace-nowrap"
                style={{ fontFamily: '"Courier New", monospace' }}
              >↩ {replyingTo[ratingId].username}</button>
            )}
            <input
              type="text"
              value={commentInputs[ratingId] || ''}
              onChange={(e) => setCommentInputs(prev => ({ ...prev, [ratingId]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitComment(ratingId, e); }}
              placeholder="add a comment..."
              className="flex-1 text-xs px-2 py-1 border border-gray-200 rounded-full focus:outline-none focus:border-[#33a29b]"
              style={{ fontFamily: '"Courier New", monospace' }}
            />
            <button
              onClick={(e) => handleSubmitComment(ratingId, e)}
              disabled={!(commentInputs[ratingId] || '').trim()}
              className="text-[10px] font-bold text-[#33a29b] disabled:text-gray-300 transition"
              style={{ fontFamily: '"Courier New", monospace' }}
            >post</button>
          </div>
        ) : (
          <p className="text-[10px] text-gray-400 text-center mt-2 pt-2 border-t border-gray-100" style={{ fontFamily: '"Courier New", monospace' }}>log in to comment</p>
        )}
      </div>
    );
  };

  const getSRRColor = (score) => {
    if (score >= 96) return 'text-purple-600';
    if (score >= 89) return 'text-yellow-500';
    if (score >= 81) return 'text-gray-400';
    if (score >= 72) return 'text-green-500';
    return 'text-blue-500';
  };

  const getTierBadge = (score) => {
    if (score >= 96) return { label: '💎', color: 'bg-purple-100 text-purple-700' };
    if (score >= 89) return { label: 'A+', color: 'bg-yellow-100 text-yellow-700' };
    if (score >= 81) return { label: 'A', color: 'bg-gray-100 text-gray-700' };
    return { label: 'B+', color: 'bg-green-100 text-green-700' };
  };

  // Dynamic Price Score Calculation
  const calculatePriceScore = (dishPrice, dishName, cuisine, allDishesData) => {
    // 1. Find dishes with exact same name (case-insensitive, trimmed)
    const sameDishes = allDishesData.filter(d => 
      d.name.toLowerCase().trim() === dishName.toLowerCase().trim()
    );
    
    // 2. Choose comparison group based on threshold
    const compareGroup = sameDishes.length >= 3
      ? sameDishes  // Use exact dish matches if ≥3
      : allDishesData.filter(d => d.cuisine === cuisine); // Fall back to cuisine
    
    // 3. If no comparison group, default to 50 (average)
    if (compareGroup.length === 0) return { score: 50, avgPrice: dishPrice };
    
    // 4. Calculate average price in comparison group
    const avgPrice = compareGroup.reduce((sum, d) => sum + (d.price || 0), 0) / compareGroup.length;
    
    // 5. Apply formula with β = 0.6 (less dramatic changes)
    const beta = 0.6;
    const ratio = dishPrice / avgPrice;
    const rawScore = 50 + (50 * (1 - ratio)) / beta;
    
    // 6. Clip to 0-100 range
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));
    
    return { score, avgPrice };
  };

  const getAllDishes = () => {
    if (rankingMode === 'personal' && user && activeUserRatings) {
      // Personal mode: show only user's own non-deleted ratings
      return activeUserRatings.map(rating => {
        const calculatedSRR = rating.overall_score ? parseFloat(rating.overall_score.toFixed(2)) : parseFloat(((rating.taste_score + rating.portion_score + rating.price_score) / 3).toFixed(2));
        return {
          id: rating.dish?.id || rating.id,
          name: rating.dish?.name || 'Unknown',
          restaurantName: rating.dish?.restaurant_name || 'Unknown',
          cuisine: rating.dish?.cuisine_type || 'various',
          price: rating.dish?.price || 0,
          srr: calculatedSRR,
          taste_score: rating.taste_score,
          portion_score: rating.portion_score,
          price_score: rating.price_score,
          numRatings: 1,
          photos: 0,
          comments: 0,
          created_at: rating.created_at,
          edit_count: rating.edit_count,
          edited_at: rating.edited_at
        };
      });
    }
    
    // Global mode: Calculate averages from ALL users' non-deleted ratings
    return (activeDishes || []).map(dish => {
      // Find ALL non-deleted ratings for this dish (from all users)
      const dishRatings = allRatings.filter(r => r.dish_id === dish.id && !r.is_deleted);
      
      let calculatedSRR = 0;
      let avgTaste = 0;
      let avgPortion = 0;
      let avgPrice = 0;
      
      if (dishRatings.length > 0) {
        // Calculate averages from ALL users' ratings
        const totalTaste = dishRatings.reduce((sum, r) => sum + (r.taste_score || 0), 0);
        const totalPortion = dishRatings.reduce((sum, r) => sum + (r.portion_score || 0), 0);
        const totalPrice = dishRatings.reduce((sum, r) => sum + (r.price_score || 0), 0);
        const totalSRR = dishRatings.reduce((sum, r) => sum + (r.overall_score || 0), 0);
        
        avgTaste = parseFloat((totalTaste / dishRatings.length).toFixed(2));
        avgPortion = parseFloat((totalPortion / dishRatings.length).toFixed(2));
        avgPrice = parseFloat((totalPrice / dishRatings.length).toFixed(2));
        calculatedSRR = totalSRR > 0 ? parseFloat((totalSRR / dishRatings.length).toFixed(2)) : parseFloat(((avgTaste + avgPortion + avgPrice) / 3).toFixed(2));
      }
      
      // Find user's own rating for this dish (for delete/edit)
      const userRatingForDish = dishRatings.find(r => r.user_id === user?.id);
      return {
        id: dish.id,
        ratingId: userRatingForDish?.id || null,
        name: dish.name,
        restaurantName: dish.restaurant_name,
        cuisine: dish.cuisine_type || 'various',
        price: dish.price || 0,
        srr: calculatedSRR,
        taste_score: avgTaste,
        portion_score: avgPortion,
        price_score: avgPrice,
        numRatings: dishRatings.length,
        photos: 0,
        comments: 0,
        created_at: userRatingForDish?.created_at || dish.created_at,
        edit_count: dish.edit_count,
        edited_at: dish.edited_at
      };
    }).filter(dish => dish.numRatings > 0) // ✅ FILTER OUT DISHES WITH 0 ACTIVE RATINGS!
     .sort((a, b) => b.srr - a.srr); // Sort highest score first
  };

  // Memoize allDishes to prevent re-calculation on every render
  const allDishes = React.useMemo(() => {
    return getAllDishes();
  }, [rankingMode, user, activeUserRatings, activeDishes, allRatings]);
  
  // Generate restaurants dynamically from rated dishes
  const allRestaurants = React.useMemo(() => {
    const restaurantMap = {};
    // Case-insensitive lookup: lowercased name -> canonical DB name
    const nameLookup = {};
    
    // First, add restaurants from database
    (restaurants || []).forEach(restaurant => {
      restaurantMap[restaurant.name] = {
        ...restaurant,
        location: restaurant.latitude && restaurant.longitude ? {
          lat: restaurant.latitude,
          lng: restaurant.longitude,
          address: restaurant.address
        } : null,
        googleData: restaurant.google_data || null
      };
      nameLookup[restaurant.name.toLowerCase()] = restaurant.name;
    });
    
    // Then, add/update restaurants from rated dishes
    allDishes.forEach(dish => {
      const restaurantName = dish.restaurantName;
      // Try exact match first, then case-insensitive DB lookup
      const canonicalName = restaurantMap[restaurantName]
        ? restaurantName
        : nameLookup[restaurantName?.toLowerCase()];
      
      const keyToUse = canonicalName || restaurantName;
      
      if (!restaurantMap[keyToUse]) {
        // No DB match - create entry without location
        restaurantMap[keyToUse] = {
          id: `generated-${restaurantName}`,
          name: restaurantName,
          cuisine: dish.cuisine,
          avgSRR: dish.srr,
          dishCount: 1,
          topDishes: [dish],
          location: null
        };
      } else {
        // Update existing restaurant (DB or previously created)
        const existing = restaurantMap[keyToUse];
        if (!existing.dishCount) existing.dishCount = 0;
        if (!existing.topDishes) existing.topDishes = [];
        
        existing.dishCount += 1;
        existing.topDishes.push(dish);
        
        // Recalculate average SRR
        const totalSRR = existing.topDishes.reduce((sum, d) => sum + d.srr, 0);
        existing.avgSRR = parseFloat((totalSRR / existing.topDishes.length).toFixed(2));
      }
    });
    
    return Object.values(restaurantMap);
  }, [restaurants, allDishes]);
  
  // Fetch tags for dishes when they're displayed
  React.useEffect(() => {
    if (allDishes.length > 0 && allTags.length > 0) {
      const dishesToFetch = allDishes.slice(0, 20);
      dishesToFetch.forEach(dish => {
        if (!dishTags[dish.id]) {
          fetchTagsForItem(dish.id, 'dish');
        }
      });
    }
  }, [allDishes, allTags]);
  
  // Dynamically calculate price score when dish details change
  React.useEffect(() => {
    if (price && dishName && dishCategory && allDishes) {
      const priceNum = parseFloat(price);
      if (!isNaN(priceNum) && priceNum > 0) {
        const { score } = calculatePriceScore(priceNum, dishName, dishCategory, allDishes);
        setPriceScore(score);
      }
    }
  }, [price, dishName, dishCategory, allDishes]);
  
  // Filter dishes based on selected filters
  const getFilteredDishes = () => {
    let filtered = allDishes;
    
    // Filter by cuisine
    if (selectedCuisine !== 'all') {
      filtered = filtered.filter(dish => dish.cuisine.toLowerCase() === selectedCuisine.toLowerCase());
    }
    
    // Filter by price range
    if (selectedPriceRange !== 'all') {
      if (selectedPriceRange === 'low') {
        filtered = filtered.filter(dish => dish.price < 10);
      } else if (selectedPriceRange === 'medium') {
        filtered = filtered.filter(dish => dish.price >= 10 && dish.price < 20);
      } else if (selectedPriceRange === 'high') {
        filtered = filtered.filter(dish => dish.price >= 20);
      }
    }
    
    // Filter by rating
    if (selectedRating !== 'all') {
      const minRating = parseInt(selectedRating);
      filtered = filtered.filter(dish => dish.srr >= minRating);
    }
    
    // Filter by tags (AND logic - dish must have ALL selected tags)
    if (selectedTagFilters.length > 0) {
      filtered = filtered.filter(dish => {
        const dishTagsList = dishTags[dish.id] || [];
        const dishTagIds = dishTagsList.map(t => t.tag_id);
        // Check if dish has ALL selected tags
        return selectedTagFilters.every(tagId => dishTagIds.includes(tagId));
      });
    }
    
    return filtered;
  };
  
  // Filter restaurants based on selected filters
  const getFilteredRestaurants = () => {
    let filtered = allRestaurants || [];
    
    // Filter out restaurants with no active ratings
    filtered = filtered.filter(restaurant => {
      // Check if restaurant has any active (non-deleted) ratings
      const hasActiveRatings = allRatings.some(rating => 
        rating.dish?.restaurant_id === restaurant.id && !rating.is_deleted
      );
      return hasActiveRatings;
    });
    
    // Filter by cuisine
    if (selectedCuisine !== 'all') {
      filtered = filtered.filter(restaurant => restaurant.cuisine.toLowerCase() === selectedCuisine.toLowerCase());
    }
    
    // Filter by rating
    if (selectedRating !== 'all') {
      const minRating = parseInt(selectedRating);
      filtered = filtered.filter(restaurant => restaurant.avgSRR >= minRating);
    }
    
    return filtered;
  };
  
  // Get unique cuisines from all dishes and restaurants
  const getAvailableCuisines = () => {
    const cuisines = new Set();
    allDishes.forEach(dish => cuisines.add(dish.cuisine));
    (allRestaurants || []).forEach(restaurant => cuisines.add(restaurant.cuisine));
    return Array.from(cuisines).sort();
  };
  
  const availableCuisines = getAvailableCuisines();
  
  // Search Google Places API
  const searchGooglePlacesAPI = async (query, location, options = {}) => {
    try {
      const searchLocation = location || userLocation || { lat: 37.8044, lng: -122.2712 };
      const limit = options.limit || 3; // Limit to 3 results (cost optimization)
      
      // Check cache first (COST OPTIMIZATION #1)
      const cached = getCachedResults(query, searchLocation);
      if (cached) {
        return cached.slice(0, limit);
      }
      
      console.log('🔎 Searching Google Places:', query, 'near', searchLocation);
      
      // Call Vercel serverless function proxy
      const apiUrl = `/api/places/search?query=${encodeURIComponent(query)}&lat=${searchLocation.lat}&lng=${searchLocation.lng}&radius=5000`;
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error('Google Places API request failed');
      }
      
      const data = await response.json();
      
      if (data.status === 'REQUEST_DENIED') {
        console.error('Google Places API: Request denied. Check API key and billing.');
        setGoogleSearchError(true);
        return [];
      }
      
      if (data.status === 'OK' && data.results) {
        console.log('✅ Found', data.results.length, 'Google Places results');
        
        const results = data.results.map(place => ({
          place_id: place.place_id,
          name: place.name,
          address: place.formatted_address || place.vicinity,
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
          rating: place.rating,
          types: place.types,
          opening_hours: place.opening_hours,
          user_ratings_total: place.user_ratings_total,
          photo: place.photos?.[0] ? 
            `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${GOOGLE_PLACES_API_KEY}` 
            : null
        }));
        
        // Cache results
        setCachedResults(query, searchLocation, results);
        
        return results.slice(0, limit);
      }
      
      console.log('ℹ️ No Google Places results found');
      return [];
      
    } catch (error) {
      console.error('Google Places search error:', error);
      
      // Proxy server not running
      if (error.message.includes('Failed to fetch')) {
        console.warn('⚠️ Proxy server not running. Start it with: node proxy-server.js');
        setGoogleSearchError(true);
      }
      
      return [];
    }
  };
  
  // Merge and deduplicate results
  const mergeSearchResults = (dbRestaurants, dbDishes, googlePlaces) => {
    const merged = [];
    const seenNames = new Set();
    
    // Add database dishes first (with restaurant context)
    dbDishes.forEach(dish => {
      const key = `${dish.restaurantName}-${dish.name}`.toLowerCase();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        merged.push({
          type: 'dish',
          id: dish.id,
          name: dish.name,
          restaurantName: dish.restaurantName,
          address: '',
          yourRating: user && dish.user_id === user.id ? dish.srr : null,
          communityRating: dish.srr,
          distance: null,
          photo: null,
          source: 'database'
        });
      }
    });
    
    // Add database restaurants
    dbRestaurants.forEach(restaurant => {
      const key = restaurant.name.toLowerCase();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        
        // Check if Google has additional info
        const googleMatch = googlePlaces.find(g => 
          g.name.toLowerCase() === key
        );
        
        merged.push({
          type: 'restaurant',
          id: restaurant.id,
          name: restaurant.name,
          address: restaurant.location?.address || '',
          yourRating: null,
          communityRating: restaurant.avgSRR,
          distance: userLocation && restaurant.location ? calculateDistance(
            userLocation.lat,
            userLocation.lng,
            restaurant.location.lat,
            restaurant.location.lng
          ) : null,
          photo: googleMatch?.photo || restaurant.photo,
          googleRating: googleMatch?.rating,
          source: 'database'
        });
      }
    });
    
    // Add Google Places not in database
    googlePlaces.forEach(place => {
      const key = place.name.toLowerCase();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        merged.push({
          type: 'restaurant',
          id: place.place_id,
          name: place.name,
          address: place.address,
          googleRating: place.rating,
          distance: userLocation ? calculateDistance(
            userLocation.lat,
            userLocation.lng,
            place.lat,
            place.lng
          ) : null,
          photo: place.photo,
          source: 'google',
          googlePlaceData: place
        });
      }
    });
    
    // Sort by relevance: your ratings > community ratings > distance
    merged.sort((a, b) => {
      if (a.yourRating && !b.yourRating) return -1;
      if (!a.yourRating && b.yourRating) return 1;
      if (a.yourRating && b.yourRating) return b.yourRating - a.yourRating;
      if (a.communityRating && !b.communityRating) return -1;
      if (!a.communityRating && b.communityRating) return 1;
      if (a.communityRating && b.communityRating) return b.communityRating - a.communityRating;
      if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
      return 0;
    });
    
    return merged.slice(0, 10); // Top 10 results
  };

  // Enhanced search function - searches dishes, restaurants, AND Google Places
  const performSearch = async (query) => {
    if (!query || query.length < 3) {
      setSearchResults({ dishes: [], restaurants: [], merged: [] });
      setGooglePlacesSearchResults([]);
      setShowSearchDropdown(false);
      setSearchLoading(false);
      setShowNearbyToggle(false);
      return;
    }

    setSearchLoading(true);
    setGoogleSearchError(false);
    const lowerQuery = query.toLowerCase();

    // Search database first
    const matchingDishes = allDishes.filter(dish => 
      dish.name.toLowerCase().includes(lowerQuery) ||
      dish.restaurantName.toLowerCase().includes(lowerQuery) ||
      dish.cuisine.toLowerCase().includes(lowerQuery)
    );

    const matchingRestaurants = (allRestaurants || []).filter(restaurant =>
      restaurant.name.toLowerCase().includes(lowerQuery) ||
      restaurant.cuisine?.toLowerCase().includes(lowerQuery)
    );
    
    const totalDbResults = matchingDishes.length + matchingRestaurants.length;
    
    // Determine if this is a cuisine search
    const cuisineKeywords = ['italian', 'japanese', 'chinese', 'mexican', 'thai', 'indian', 
                            'american', 'french', 'korean', 'vietnamese', 'sushi', 'pizza', 
                            'burger', 'taco', 'pho', 'ramen', 'bbq', 'seafood', 'steak'];
    const isCuisineSearch = cuisineKeywords.some(c => lowerQuery.includes(c));
    
    let googleResults = [];
    
    // SMART GOOGLE SEARCH LOGIC (COST OPTIMIZATION)
    if (totalDbResults === 0) {
      // No database results - search Google immediately
      console.log('📊 No database results - searching Google');
      googleResults = await searchGooglePlacesAPI(query, userLocation, { limit: 3 });
    } else if (isCuisineSearch && totalDbResults < 5) {
      // Cuisine search with < 5 results - show toggle
      console.log('📊 Cuisine search with', totalDbResults, 'results - showing nearby toggle');
      setShowNearbyToggle(true);
      
      if (includeNearby) {
        googleResults = await searchGooglePlacesAPI(query, userLocation, { limit: 3 });
      }
    } else if (!isCuisineSearch && totalDbResults < 3) {
      // Restaurant name search with few results - 1 second delay
      console.log('📊 Restaurant search - waiting 1 second before Google');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      googleResults = await searchGooglePlacesAPI(query, userLocation, { limit: 3 });
    } else {
      // Enough database results - don't search Google (SAVE MONEY!)
      console.log('📊 Sufficient database results (', totalDbResults, ') - skipping Google ✅');
      setShowNearbyToggle(false);
    }
    
    // Merge results
    const mergedResults = mergeSearchResults(matchingRestaurants, matchingDishes, googleResults);
    
    setSearchResults({ 
      dishes: matchingDishes, 
      restaurants: matchingRestaurants,
      merged: mergedResults
    });
    setGooglePlacesSearchResults(googleResults);
    setShowSearchDropdown(true);
    setSearchLoading(false);
  };

  // Live search effect with debounce
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.length >= 3) {
        performSearch(searchQuery);
      } else if (searchQuery.length === 0) {
        setSearchResults({ dishes: [], restaurants: [], merged: [] });
        setGooglePlacesSearchResults([]);
        setShowSearchDropdown(false);
      }
    }, 300); // Debounce 300ms

    return () => clearTimeout(timeoutId);
  }, [searchQuery, userLocation, activeTab]); // Intentionally excludes allDishes/allRestaurants to prevent infinite search loops
  
  // Fetch all users for explore/people tab
  React.useEffect(() => {
    if (activeTab !== 'explore' || (exploreView !== 'people' && exploreView !== 'activity')) return;
    const fetchAllUsers = async () => {
      setAllUsersLoading(true);
      try {
        const { data: usersData, error } = await supabase
          .from('users')
          .select('id, username, email')
          .order('username');
        if (error) throw error;

        // Get following IDs for current user
        let myFollowingIds = new Set();
        if (user) {
          const { data: followData } = await supabase
            .from('user_follows')
            .select('following_id')
            .eq('follower_id', user.id);
          myFollowingIds = new Set((followData || []).map(f => f.following_id));
          setFollowingIds(myFollowingIds);
        }

        // Get my rated dish IDs
        const myDishIds = new Set(userRatings.map(r => r.dish_id));
        const myRestaurantIds = new Set(userRatings.map(r => r.restaurant_id).filter(Boolean));

        // Enrich each user with stats from allRatings
        const enriched = (usersData || [])
          .filter(u => !user || u.id !== user.id) // exclude self
          .map(u => {
            const theirRatings = allRatings.filter(r => r.user_id === u.id && !r.is_deleted);
            const theirDishIds = new Set(theirRatings.map(r => r.dish_id));
            const theirRestaurantIds = new Set(theirRatings.map(r => r.restaurant_id).filter(Boolean));
            const dishOverlap = [...theirDishIds].filter(id => myDishIds.has(id)).length;
            const restaurantOverlap = [...theirRestaurantIds].filter(id => myRestaurantIds.has(id)).length;
            const avgScore = theirRatings.length > 0
              ? theirRatings.reduce((sum, r) => sum + (r.srr || 0), 0) / theirRatings.length
              : 0;
            return {
              ...u,
              ratingsCount: theirRatings.length,
              dishOverlap,
              restaurantOverlap,
              avgScore,
              isFollowing: myFollowingIds.has(u.id),
            };
          })
          .sort((a, b) => (b.dishOverlap + b.restaurantOverlap) - (a.dishOverlap + a.restaurantOverlap));

        setAllUsers(enriched);
      } catch (err) {
        console.error('Error fetching users:', err);
      } finally {
        setAllUsersLoading(false);
      }
    };
    fetchAllUsers();
  }, [activeTab, exploreView, user, allRatings, userRatings]);

  // Friend search function
  const searchFriends = async (query) => {
    if (!query || query.length < 2) {
      setFriendSearchResults([]);
      return;
    }

    try {
      // Search users in Supabase by username
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .ilike('username', `%${query}%`)
        .limit(10);

      if (error) throw error;
      
      setFriendSearchResults(data || []);
    } catch (error) {
      console.error('Error searching friends:', error);
      setFriendSearchResults([]);
    }
  };

  // Friend search effect
  React.useEffect(() => {
    if (showFriendSearch) {
      const timeoutId = setTimeout(() => {
        searchFriends(friendSearchQuery);
      }, 300); // Debounce 300ms

      return () => clearTimeout(timeoutId);
    }
  }, [friendSearchQuery, showFriendSearch]);
  
  // ============================================
  // PHASE 4: SOCIAL FEATURES FUNCTIONS
  // ============================================
  
  // Fetch user's follows (friends)
  const fetchUserFollows = async () => {
    if (!user) return;
    
    try {
      // Get people user follows with their stats
      const { data: follows, error } = await supabase
        .rpc('get_user_follows_with_stats', { target_user_id: user.id });
      
      if (error) {
        // Fallback to manual query if function doesn't exist yet
        const { data: followData } = await supabase
          .from('user_follows')
          .select('following_id')
          .eq('follower_id', user.id);
        
        if (!followData || followData.length === 0) {
          setUserFollows([]);
          return;
        }
        
        const followingIds = followData.map(f => f.following_id);
        
        // Get user details for each followed user
        const friendsWithStats = await Promise.all(
          followingIds.map(async (friendId) => {
            // Get user data from auth.users
            const { data: userData } = await supabase.auth.admin.getUserById(friendId);
            if (!userData) return null;
            
            // Get ratings count
            const { count: ratingsCount } = await supabase
              .from('ratings')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', friendId);
            
            // Get followers count
            const { count: followersCount } = await supabase
              .from('user_follows')
              .select('*', { count: 'exact', head: true })
              .eq('following_id', friendId);
            
            // Calculate overlap
            const { data: myRatings } = await supabase
              .from('ratings')
              .select('dish_id')
              .eq('user_id', user.id);
            
            const { data: theirRatings } = await supabase
              .from('ratings')
              .select('dish_id')
              .eq('user_id', friendId);
            
            const myDishIds = new Set(myRatings?.map(r => r.dish_id) || []);
            const theirDishIds = theirRatings?.map(r => r.dish_id) || [];
            const overlap = theirDishIds.filter(id => myDishIds.has(id)).length;
            const overlapPercent = theirRatings.length > 0 
              ? Math.round((overlap / theirRatings.length) * 100) 
              : 0;
            
            return {
              id: friendId,
              username: userData.user.user_metadata?.username || userData.user.email?.split('@')[0] || 'user',
              email: userData.user.email,
              location: userData.user.user_metadata?.location || 'Unknown',
              ratings: ratingsCount || 0,
              friends: followersCount || 0,
              overlap: overlapPercent
            };
          })
        );
        
        setUserFollows(friendsWithStats.filter(f => f !== null));
      } else {
        setUserFollows(follows || []);
      }
    } catch (error) {
      console.error('Error fetching follows:', error);
      setUserFollows([]);
    }
  };
  
  // Fetch suggested friends
  const fetchSuggestedFriends = async () => {
    if (!user) return;
    
    // Skip for now - function may not exist
    setSuggestedFriends([]);
    return;
    
    try {
      const { data, error } = await supabase
        .rpc('get_suggested_friends', { 
          target_user_id: user.id,
          limit_count: 10
        });
      
      if (error) throw error;
      setSuggestedFriends(data || []);
    } catch (error) {
      console.error('Error fetching suggested friends:', error);
      setSuggestedFriends([]);
    }
  };
  
  // Follow/Unfollow user
  const handleFollowUser = async (userToFollow) => {
    if (!user) return;
    
    try {
      // Check if already following
      const { data: existing } = await supabase
        .from('user_follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', userToFollow.id)
        .single();
      
      if (existing) {
        // Unfollow
        await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', userToFollow.id);
        
        setErrorModal({
          show: true,
          title: 'Unfollowed',
          message: `You unfollowed @${userToFollow.username}`
        });
      } else {
        // Follow
        await supabase
          .from('user_follows')
          .insert({
            follower_id: user.id,
            following_id: userToFollow.id
          });
        
        // Create notification
        await supabase
          .from('notifications')
          .insert({
            user_id: userToFollow.id,
            type: 'follow',
            content: {
              follower: user.user_metadata?.username || user.email?.split('@')[0],
              follower_id: user.id
            }
          });
        
        // Create activity
        await supabase
          .from('activity_feed')
          .insert({
            user_id: user.id,
            activity_type: 'follow',
            content: {
              following_username: userToFollow.username,
              following_id: userToFollow.id
            }
          });
        
        setErrorModal({
          show: true,
          title: 'Following!',
          message: `You're now following @${userToFollow.username}`
        });
      }
      
      // Refresh follows list
      fetchUserFollows();
      
    } catch (error) {
      console.error('Error following user:', error);
      setErrorModal({
        show: true,
        title: 'Error',
        message: 'Could not follow user. Please try again.'
      });
    }
  };
  
  // Fetch activity feed
  const fetchActivityFeed = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .rpc('get_user_activity_feed', {
          target_user_id: user.id,
          filter_type: activityFilter,
          limit_count: 50
        });
      
      if (error) throw error;
      setActivityFeed(data || []);
    } catch (error) {
      console.error('Error fetching activity feed:', error);
      setActivityFeed([]);
    }
  };
  
  // Build global activity feed from allRatings + follows data
  const buildGlobalActivityFeed = React.useCallback(() => {
    const items = [];
    const myUsername = user?.user_metadata?.username || user?.email?.split('@')[0] || '';
    const followingIdSet = new Set(userFollows.map(f => f.id));
    const groupMemberIds = new Set(); // could expand later

    // Ratings as activity items
    allRatings.filter(r => !r.is_deleted).forEach(r => {
      const username = r.username || (user && r.user_id === user.id ? (user.user_metadata?.username || user.email?.split('@')[0]) : null) || 'user';
      const isOwn = user && r.user_id === user.id;
      const isFollowing = followingIdSet.has(r.user_id);
      const isGroup = r.group_id != null;
      // Compute srr from raw scores since allRatings doesn't have srr pre-computed
      const computedSrr = r.overall_score
        ? parseFloat(r.overall_score.toFixed(2))
        : (r.taste_score != null && r.portion_score != null && r.price_score != null)
          ? parseFloat(((r.taste_score + r.portion_score + r.price_score) / 3).toFixed(2))
          : null;
      items.push({
        id: `rating-${r.id}`,
        rating_id: r.id,
        activity_type: isGroup ? 'group_rating' : 'rating',
        username,
        user_id: r.user_id,
        isOwn,
        isFollowing,
        content: {
          dish_name: r.dish?.name || r.dish_name,
          restaurant_name: r.dish?.restaurant_name || r.restaurant_name,
          score: computedSrr,
          comment: r.comment,
        },
        created_at: r.created_at,
        _rawRating: r,
      });
    });

    // Popularity score: (likes*1 + comments*2) / decay
    const scored = items.map(item => {
      const likes = ratingLikes[item.rating_id] || { count: 0 };
      const hoursAgo = (Date.now() - new Date(item.created_at)) / 3600000;
      const popularity = (likes.count + 0) / Math.pow(hoursAgo / 24 + 1, 1.5);
      return { ...item, popularity, hoursAgo };
    });

    // Sort: blend recency + popularity (70% recency, 30% popularity)
    scored.sort((a, b) => {
      const aScore = (1 / (a.hoursAgo + 1)) * 0.7 + a.popularity * 0.3;
      const bScore = (1 / (b.hoursAgo + 1)) * 0.7 + b.popularity * 0.3;
      return bScore - aScore;
    });

    return scored;
  }, [allRatings, userFollows, ratingLikes, user]);

  // Fetch activity for explore global feed
  React.useEffect(() => {
    if (activeTab === 'explore' && exploreView === 'activity') {
      setGlobalActivityLoading(true);
      const feed = buildGlobalActivityFeed();
      setGlobalActivityFeed(feed);
      const ratingIds = feed.filter(a => a.rating_id).map(a => a.rating_id);
      if (ratingIds.length > 0) fetchLikesForRatings(ratingIds);
      setGlobalActivityLoading(false);
    }
  }, [activeTab, exploreView, allRatings, userFollows, ratingLikes]);

  // Refresh you activity feed without filter dropdown
  React.useEffect(() => {
    if (user && youView === 'activity') fetchActivityFeed();
  }, [user, youView]);

  // Fetch followers (people who follow current user)
  const fetchUserFollowers = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('user_follows')
        .select('follower_id')
        .eq('following_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const followerIds = (data || []).map(f => f.follower_id);
      if (followerIds.length === 0) { setUserFollowers([]); return; }
      const { data: usersData } = await supabase
        .from('users')
        .select('id, username, email')
        .in('id', followerIds);
      const myDishIds = new Set(userRatings.map(r => r.dish_id));
      const enriched = (usersData || []).map(u => {
        const theirRatings = allRatings.filter(r => r.user_id === u.id && !r.is_deleted);
        const dishOverlap = theirRatings.filter(r => myDishIds.has(r.dish_id)).length;
        return { ...u, ratingsCount: theirRatings.length, dishOverlap };
      });
      setUserFollowers(enriched);
    } catch (err) {
      console.error('Error fetching followers:', err);
      setUserFollowers([]);
    }
  };

  // Fetch likes for a list of rating IDs
  const fetchLikesForRatings = async (ratingIds) => {
    if (!ratingIds.length) return;
    try {
      const { data, error } = await supabase
        .from('rating_likes')
        .select('rating_id, user_id, users:user_id(username)')
        .in('rating_id', ratingIds);
      if (error) throw error;
      const likesMap = {};
      (data || []).forEach(like => {
        if (!likesMap[like.rating_id]) likesMap[like.rating_id] = { count: 0, likedByMe: false, users: [] };
        likesMap[like.rating_id].count++;
        likesMap[like.rating_id].users.push(like.users?.username || 'user');
        if (user && like.user_id === user.id) likesMap[like.rating_id].likedByMe = true;
      });
      setRatingLikes(prev => ({ ...prev, ...likesMap }));
    } catch (err) {
      console.error('Error fetching likes:', err);
    }
  };

  // ============================================
  // COMMENT SYSTEM FUNCTIONS
  // ============================================

  // Fetch comments for a rating (lazy - only on expand)
  const fetchCommentsForRating = async (ratingId) => {
    if (ratingComments[ratingId]?.loaded) return;
    setRatingComments(prev => ({ ...prev, [ratingId]: { ...prev[ratingId], loading: true } }));
    try {
      const { data, error } = await supabase
        .from('rating_comments')
        .select(`*, author:users!rating_comments_user_id_fkey(id, username, email)`)
        .eq('rating_id', ratingId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const enriched = (data || []).map(c => ({
        ...c,
        username: c.author?.username || c.author?.email?.split('@')[0] || 'user',
      }));
      setRatingComments(prev => ({ ...prev, [ratingId]: { comments: enriched, loading: false, loaded: true } }));
      // Fetch comment likes
      if (enriched.length > 0) {
        const ids = enriched.map(c => c.id);
        const { data: likesData } = await supabase
          .from('comment_likes')
          .select('comment_id, user_id')
          .in('comment_id', ids);
        const likesMap = {};
        (likesData || []).forEach(l => {
          if (!likesMap[l.comment_id]) likesMap[l.comment_id] = { count: 0, likedByMe: false };
          likesMap[l.comment_id].count++;
          if (user && l.user_id === user.id) likesMap[l.comment_id].likedByMe = true;
        });
        setCommentLikes(prev => ({ ...prev, ...likesMap }));
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
      setRatingComments(prev => ({ ...prev, [ratingId]: { comments: [], loading: false, loaded: true } }));
    }
  };

  // Fetch all comments for a dish (unified modal view)
  const fetchDishComments = async (dishId) => {
    if (!dishId) return;
    setDishCommentsLoading(true);
    try {
      // Get all ratings for this dish
      const dishRatingIds = allRatings.filter(r => r.dish_id === dishId && !r.is_deleted).map(r => r.id);
      if (dishRatingIds.length === 0) { setDishComments([]); setDishCommentsLoading(false); return; }
      const { data, error } = await supabase
        .from('rating_comments')
        .select(`*, author:users!rating_comments_user_id_fkey(id, username, email)`)
        .in('rating_id', dishRatingIds)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const enriched = (data || []).map(c => ({
        ...c,
        username: c.author?.username || c.author?.email?.split('@')[0] || 'user',
      }));
      setDishComments(enriched);
      // Also update ratingComments cache
      dishRatingIds.forEach(rid => {
        const forRating = enriched.filter(c => c.rating_id === rid);
        setRatingComments(prev => ({ ...prev, [rid]: { comments: forRating, loading: false, loaded: true } }));
      });
    } catch (err) {
      console.error('Error fetching dish comments:', err);
      setDishComments([]);
    } finally {
      setDishCommentsLoading(false);
    }
  };

  // Toggle comment section open/closed
  const handleToggleComments = async (ratingId, e) => {
    if (e) e.stopPropagation();
    const isOpen = expandedComments.has(ratingId);
    setExpandedComments(prev => {
      const next = new Set(prev);
      isOpen ? next.delete(ratingId) : next.add(ratingId);
      return next;
    });
    if (!isOpen) await fetchCommentsForRating(ratingId);
  };

  // Submit a comment or reply
  const handleSubmitComment = async (ratingId, e) => {
    if (e) e.stopPropagation();
    if (!user) return;
    const text = (commentInputs[ratingId] || '').trim();
    if (!text) return;
    const reply = replyingTo[ratingId];
    const myUsername = user.user_metadata?.username || user.email?.split('@')[0] || 'user';
    const optimisticId = `temp-${Date.now()}`;
    const optimistic = {
      id: optimisticId,
      rating_id: ratingId,
      user_id: user.id,
      parent_id: reply?.commentId || null,
      content: text,
      created_at: new Date().toISOString(),
      username: myUsername,
    };
    // Optimistic update
    setRatingComments(prev => ({
      ...prev,
      [ratingId]: {
        ...prev[ratingId],
        comments: [...(prev[ratingId]?.comments || []), optimistic],
      }
    }));
    setCommentInputs(prev => ({ ...prev, [ratingId]: '' }));
    setReplyingTo(prev => { const n = { ...prev }; delete n[ratingId]; return n; });
    try {
      const { data, error } = await supabase
        .from('rating_comments')
        .insert({
          rating_id: ratingId,
          user_id: user.id,
          parent_id: reply?.commentId || null,
          content: text,
        })
        .select(`*, author:users!rating_comments_user_id_fkey(id, username, email)`)
        .single();
      if (error) throw error;
      const inserted = { ...data, username: data.author?.username || data.author?.email?.split('@')[0] || myUsername };
      // Replace optimistic with real
      setRatingComments(prev => ({
        ...prev,
        [ratingId]: {
          ...prev[ratingId],
          comments: prev[ratingId].comments.map(c => c.id === optimisticId ? inserted : c),
        }
      }));
      // Notify the rating owner (if not commenting on own rating)
      const rating = allRatings.find(r => r.id === ratingId);
      if (rating && rating.user_id !== user.id) {
        await supabase.from('notifications').insert({
          user_id: rating.user_id,
          type: 'comment',
          content: {
            commenter: myUsername,
            commenter_id: user.id,
            comment_text: text.slice(0, 80),
            dish_name: rating.dish?.name || '',
            rating_id: ratingId,
            dish_id: rating.dish_id,
          }
        });
      }
      // Notify parent comment owner if this is a reply
      if (reply?.commentId) {
        const parentComment = ratingComments[ratingId]?.comments?.find(c => c.id === reply.commentId);
        if (parentComment && parentComment.user_id !== user.id) {
          await supabase.from('notifications').insert({
            user_id: parentComment.user_id,
            type: 'comment_reply',
            content: {
              replier: myUsername,
              replier_id: user.id,
              comment_text: text.slice(0, 80),
              rating_id: ratingId,
            }
          });
        }
      }
      if (expandedReplies.has(reply?.commentId)) {
        setExpandedReplies(prev => new Set([...prev, reply.commentId]));
      }
    } catch (err) {
      console.error('Error submitting comment:', err);
      setRatingComments(prev => ({
        ...prev,
        [ratingId]: { ...prev[ratingId], comments: prev[ratingId].comments.filter(c => c.id !== optimisticId) }
      }));
    }
  };

  // Toggle like on a comment
  const handleToggleCommentLike = async (commentId, e) => {
    if (e) e.stopPropagation();
    if (!user) return;
    const current = commentLikes[commentId] || { count: 0, likedByMe: false };
    const optimistic = { count: current.likedByMe ? current.count - 1 : current.count + 1, likedByMe: !current.likedByMe };
    setCommentLikes(prev => ({ ...prev, [commentId]: optimistic }));
    try {
      if (current.likedByMe) {
        await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', user.id);
      } else {
        await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: user.id });
      }
    } catch (err) {
      setCommentLikes(prev => ({ ...prev, [commentId]: current }));
    }
  };

  // Delete a comment
  const handleDeleteComment = async (commentId, ratingId, e) => {
    if (e) e.stopPropagation();
    if (!user) return;
    setRatingComments(prev => ({
      ...prev,
      [ratingId]: { ...prev[ratingId], comments: prev[ratingId].comments.filter(c => c.id !== commentId) }
    }));
    try {
      await supabase.from('rating_comments').delete().eq('id', commentId).eq('user_id', user.id);
    } catch (err) { console.error('Error deleting comment:', err); }
  };

  // Toggle like on a rating
  const handleToggleLike = async (ratingId, e) => {
    if (e) e.stopPropagation();
    if (!user) return;
    const current = ratingLikes[ratingId] || { count: 0, likedByMe: false, users: [] };
    const optimistic = {
      ...current,
      likedByMe: !current.likedByMe,
      count: current.likedByMe ? current.count - 1 : current.count + 1,
      users: current.likedByMe
        ? current.users.filter(u => u !== (user.user_metadata?.username || user.email?.split('@')[0]))
        : [...current.users, user.user_metadata?.username || user.email?.split('@')[0]]
    };
    setRatingLikes(prev => ({ ...prev, [ratingId]: optimistic }));
    try {
      if (current.likedByMe) {
        await supabase.from('rating_likes').delete().eq('rating_id', ratingId).eq('user_id', user.id);
      } else {
        await supabase.from('rating_likes').insert({ rating_id: ratingId, user_id: user.id });
      }
    } catch (err) {
      console.error('Error toggling like:', err);
      setRatingLikes(prev => ({ ...prev, [ratingId]: current }));
    }
  };

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      setNotifications(data || []);
      setUnreadNotificationsCount(data?.filter(n => !n.read).length || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };
  
  // Mark notification as read
  const markNotificationAsRead = async (notificationId) => {
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);
      
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadNotificationsCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };
  
  // Mark all notifications as read
  const markAllNotificationsAsRead = async () => {
    if (!user) return;
    
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadNotificationsCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };
  
  // ============================================
  // PHASE 4: USEEFFECTS
  // ============================================
  
  // Fetch follows/followers when on people tab
  React.useEffect(() => {
    if (user && youView === 'people') {
      fetchUserFollows();
      fetchUserFollowers();
      fetchSuggestedFriends();
    }
  }, [user, youView]);
  
  // activityFilter kept for RPC compat (unused in UI now)

  // Fetch likes when activity feed loads
  React.useEffect(() => {
    const ratingIds = activityFeed.filter(a => a.activity_type === 'rating' && a.rating_id).map(a => a.rating_id);
    if (ratingIds.length > 0) fetchLikesForRatings(ratingIds);
  }, [activityFeed]);
  
  // Fetch notifications periodically
  React.useEffect(() => {
    if (user) {
      fetchNotifications();
      
      // Poll every 30 seconds
      const interval = setInterval(() => {
        fetchNotifications();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [user]);
  
  // Load comments when dish modal comments tab is opened
  React.useEffect(() => {
    if (selectedDish && dishModalView === 'comments') {
      fetchDishComments(selectedDish.id);
    }
  }, [selectedDish, dishModalView]);

  // Phase 5: Load photos when PHOTOS tab is opened
  React.useEffect(() => {
    if (selectedDish && dishModalView === 'photos') {
      fetchDishPhotos(selectedDish.id);
    }
  }, [selectedDish, dishModalView]);
  
  // Fetch user lists
  React.useEffect(() => {
    const fetchUserLists = async () => {
      if (!user) {
        setUserLists([]);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('lists')
          .select('*')
          .eq('creator_id', user.id)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setUserLists(data || []);
      } catch (error) {
        console.error('Error fetching lists:', error);
        setUserLists([]);
      }
    };
    
    if (user && youView === 'lists') {
      fetchUserLists();
    }
  }, [user, youView]);
  
  // Refresh groups when groups tab is opened
  React.useEffect(() => {
    const refreshGroups = async () => {
      if (!user) return;
      
      try {
        const { data: memberData, error: memberError } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('user_id', user.id);

        if (memberError) throw memberError;
        
        const groupIds = memberData?.map(m => m.group_id) || [];
        
        if (groupIds.length > 0) {
          const { data: groupsData, error: groupsError } = await supabase
            .from('groups')
            .select('*')
            .in('id', groupIds)
            .order('created_at', { ascending: false });

          if (groupsError) throw groupsError;
          setUserGroups(groupsData || []);
        } else {
          setUserGroups([]);
        }
      } catch (error) {
        console.error('Error refreshing groups:', error);
      }
    };
    
    if (user && youView === 'groups') {
      refreshGroups();
    }
  }, [user, youView]);
  
  // ============================================
  // PHASE 4B: @ MENTIONS
  // ============================================
  
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionResults, setMentionResults] = useState([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionCursorPosition, setMentionCursorPosition] = useState(0);
  const [activeMentionField, setActiveMentionField] = useState(null); // 'message', 'comment', 'rating'
  
  // Search users for mentions
  const searchUsersForMention = async (query) => {
    if (!query || query.length < 1) {
      setMentionResults([]);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, username')
        .ilike('username', `%${query}%`)
        .limit(5);
      
      if (error) throw error;
      
      setMentionResults(data || []);
    } catch (error) {
      console.error('Error searching for mentions:', error);
      setMentionResults([]);
    }
  };
  
  // Handle text input for mentions
  const handleMentionInput = (text, cursorPosition, fieldType) => {
    setActiveMentionField(fieldType);
    setMentionCursorPosition(cursorPosition);
    
    // Find last @ symbol before cursor
    const lastAtSymbol = text.lastIndexOf('@', cursorPosition - 1);
    
    if (lastAtSymbol !== -1) {
      const textAfterAt = text.substring(lastAtSymbol + 1, cursorPosition);
      
      // Check if there's a space after @ (means mention is finished)
      if (textAfterAt.includes(' ')) {
        setShowMentionDropdown(false);
        return;
      }
      
      // Search for users
      if (textAfterAt.length >= 1) {
        setMentionQuery(textAfterAt);
        searchUsersForMention(textAfterAt);
        setShowMentionDropdown(true);
      } else if (textAfterAt.length === 0) {
        // Just typed @, show all recent users
        searchUsersForMention('');
        setShowMentionDropdown(true);
      }
    } else {
      setShowMentionDropdown(false);
    }
  };
  
  // Insert mention into text
  const insertMention = (username, currentText, fieldSetter) => {
    const lastAtSymbol = currentText.lastIndexOf('@', mentionCursorPosition - 1);
    const beforeMention = currentText.substring(0, lastAtSymbol);
    const afterMention = currentText.substring(mentionCursorPosition);
    const newText = `${beforeMention}@${username} ${afterMention}`;
    
    fieldSetter(newText);
    setShowMentionDropdown(false);
    setMentionQuery('');
  };
  
  // Create mention notification
  const createMentionNotification = async (mentionedUsername, contextType, contextId) => {
    if (!user) return;
    
    try {
      // Get mentioned user ID
      const { data: mentionedUser } = await supabase
        .from('users')
        .select('id')
        .eq('username', mentionedUsername)
        .single();
      
      if (!mentionedUser) return;
      
      // Create mention record
      await supabase
        .from('mentions')
        .insert({
          mention_by: user.id,
          mention_to: mentionedUser.id,
          context_type: contextType,
          context_id: contextId
        });
      
      // Create notification
      await supabase
        .from('notifications')
        .insert({
          user_id: mentionedUser.id,
          type: 'mention',
          content: {
            mentioner: user.user_metadata?.username || user.email?.split('@')[0],
            mentioner_id: user.id,
            context_type: contextType,
            context_id: contextId
          }
        });
    } catch (error) {
      console.error('Error creating mention:', error);
    }
  };
  
  // Extract mentions from text
  const extractMentions = (text) => {
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]); // Username without @
    }
    
    return mentions;
  };
  
  // ============================================
  // PHASE 5: PHOTO UPLOAD & MANAGEMENT
  // ============================================
  
  // Compress image to reduce file size
  const compressImage = async (file, maxSizeMB = 5) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Max dimensions
          const MAX_WIDTH = 1920;
          const MAX_HEIGHT = 1080;
          
          // Calculate new dimensions
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to blob with quality 0.85
          canvas.toBlob((blob) => {
            resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
          }, 'image/jpeg', 0.85);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };
  
  // Upload photo to Supabase Storage
  const uploadPhotoToStorage = async (file, dishId) => {
    if (!user) return null;
    
    try {
      // Check file size and compress if needed
      let fileToUpload = file;
      const sizeMB = file.size / (1024 * 1024);
      
      if (sizeMB > 5) {
        setErrorModal({
          show: true,
          title: 'File Too Large',
          message: 'Compressing image...'
        });
        fileToUpload = await compressImage(file);
      }
      
      // Create unique filename: userId/dishId/timestamp_filename
      const fileExt = fileToUpload.name.split('.').pop();
      const fileName = `${user.id}/${dishId}/${Date.now()}.${fileExt}`;
      
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, fileToUpload, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);
      
      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading photo:', error);
      throw error;
    }
  };
  
  // Save photo metadata to database
  const savePhotoToDatabase = async (url, dishId, caption = null) => {
    if (!user) return null;
    
    try {
      const { data, error } = await supabase
        .from('photos')
        .insert({
          user_id: user.id,
          dish_id: dishId,
          url: url,
          caption: caption
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('Error saving photo to database:', error);
      throw error;
    }
  };
  
  // Handle photo upload (complete flow)
  const handlePhotoUpload = async (file, dishId) => {
    if (!user) {
      setErrorModal({
        show: true,
        title: 'Login Required',
        message: 'Please log in to upload photos.'
      });
      return;
    }
    
    setUploadingPhoto(true);
    
    try {
      // Upload to storage
      const photoUrl = await uploadPhotoToStorage(file, dishId);
      if (!photoUrl) throw new Error('Upload failed');
      
      // Save to database
      await savePhotoToDatabase(photoUrl, dishId);
      
      // Refresh dish photos
      if (selectedDish?.id === dishId) {
        await fetchDishPhotos(dishId);
      }
      
      setErrorModal({
        show: true,
        title: 'Photo Uploaded!',
        message: 'Your photo has been added to this dish.'
      });
      
    } catch (error) {
      console.error('Error uploading photo:', error);
      setErrorModal({
        show: true,
        title: 'Upload Failed',
        message: 'Could not upload photo. Please try again.'
      });
    } finally {
      setUploadingPhoto(false);
    }
  };
  
  // Fetch photos for a dish
  const fetchDishPhotos = async (dishId) => {
    setLoadingPhotos(true);
    try {
      const { data, error } = await supabase
        .rpc('get_dish_photos', {
          target_dish_id: dishId,
          limit_count: 20
        });
      
      if (error) throw error;
      setSelectedDishPhotos(data || []);
      setCurrentPhotoIndex(0);
    } catch (error) {
      console.error('Error fetching photos:', error);
      setSelectedDishPhotos([]);
    } finally {
      setLoadingPhotos(false);
    }
  };
  
  // Like/unlike photo
  const handlePhotoLike = async (photoId) => {
    if (!user) {
      setErrorModal({
        show: true,
        title: 'Login Required',
        message: 'Please log in to like photos.'
      });
      return;
    }
    
    try {
      // Check if already liked
      const { data: existingLike } = await supabase
        .from('photo_likes')
        .select('id')
        .eq('photo_id', photoId)
        .eq('user_id', user.id)
        .single();
      
      if (existingLike) {
        // Unlike
        await supabase
          .from('photo_likes')
          .delete()
          .eq('id', existingLike.id);
      } else {
        // Like
        await supabase
          .from('photo_likes')
          .insert({
            photo_id: photoId,
            user_id: user.id
          });
      }
      
      // Refresh photos
      if (selectedDish) {
        await fetchDishPhotos(selectedDish.id);
      }
      
    } catch (error) {
      console.error('Error liking photo:', error);
    }
  };
  
  // Upload profile picture
  const uploadProfilePicture = async (file) => {
    if (!user) return;
    
    try {
      // Compress if needed
      let fileToUpload = file;
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > 5) {
        fileToUpload = await compressImage(file);
      }
      
      // Upload to storage (overwrite existing)
      const fileName = `profiles/${user.id}`;
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, fileToUpload, {
          cacheControl: '3600',
          upsert: true // Overwrite existing
        });
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);
      
      // Update user metadata
      await supabase.auth.updateUser({
        data: { 
          profile_picture_url: urlData.publicUrl + '?t=' + Date.now() // Cache bust
        }
      });
      
      setErrorModal({
        show: true,
        title: 'Profile Picture Updated!',
        message: 'Your new profile picture has been saved.'
      });
      
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      setErrorModal({
        show: true,
        title: 'Upload Failed',
        message: 'Could not upload profile picture. Please try again.'
      });
    }
  };
  
  // ============================================
  // ENHANCED MAP FUNCTIONS
  // ============================================
  
  const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
  
  // Debug: Log API key status (first 10 chars only for security)
  React.useEffect(() => {
    console.log('🔑 Google API Key status:', GOOGLE_PLACES_API_KEY ? `${GOOGLE_PLACES_API_KEY.substring(0, 10)}...` : 'MISSING');
  }, []);
  
  // Cache management (24 hour cache)
  const CACHE_DURATION = 24 * 60 * 60 * 1000;
  
  const getCachedResults = (query, location) => {
    try {
      const cacheKey = `google-${query}-${location.lat.toFixed(2)}-${location.lng.toFixed(2)}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        const data = JSON.parse(cached);
        const age = Date.now() - data.timestamp;
        
        if (age < CACHE_DURATION) {
          console.log('✅ Using cached results (age:', Math.floor(age / 1000 / 60), 'min)');
          return data.results;
        } else {
          localStorage.removeItem(cacheKey);
        }
      }
    } catch (error) {
      console.error('Cache read error:', error);
    }
    return null;
  };
  
  const setCachedResults = (query, location, results) => {
    try {
      const cacheKey = `google-${query}-${location.lat.toFixed(2)}-${location.lng.toFixed(2)}`;
      localStorage.setItem(cacheKey, JSON.stringify({
        results,
        timestamp: Date.now(),
        query
      }));
      console.log('💾 Cached results for:', query);
    } catch (error) {
      console.error('Cache write error:', error);
    }
  };
  
  const trackGooglePlaceView = (placeId, placeName) => {
    try {
      const viewsKey = `views-${placeId}`;
      const views = JSON.parse(localStorage.getItem(viewsKey) || '{"count": 0, "name": ""}');
      views.count++;
      views.name = placeName;
      localStorage.setItem(viewsKey, JSON.stringify(views));
      
      if (views.count >= 3) {
        console.log('🔥 Popular place:', placeName, '- Auto-add to database');
      }
    } catch (error) {
      console.error('View tracking error:', error);
    }
  };
  
  // Create castle-shaped pin SVG
  const createCastlePin = (color, size) => {
    const shadowId = `shadow-${color.replace('#', '')}`;
    return `
      <svg width="${size}" height="${size * 1.2}" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="${shadowId}">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.4"/>
          </filter>
        </defs>
        <g filter="url(#${shadowId})">
          <path d="M 30,90 L 30,40 L 25,40 L 25,30 L 20,30 L 20,20 L 30,20 L 30,30 L 40,30 L 40,20 L 50,20 L 50,30 L 60,30 L 60,20 L 70,20 L 70,30 L 75,30 L 75,40 L 70,40 L 70,90 Z" 
                fill="${color}" stroke="white" stroke-width="4"/>
          <rect x="42" y="65" width="16" height="25" fill="white" opacity="0.3" rx="2"/>
          <circle cx="50" cy="105" r="8" fill="${color}" stroke="white" stroke-width="3"/>
        </g>
      </svg>
    `;
  };
  
  // Determine restaurant category
  const getRestaurantCategory = (restaurant) => {
    if (user && restaurant.rated_by_user) return 'user';
    if (restaurant.avgSRR >= 85) return 'high_rated';
    if (restaurant.avgSRR) return 'others';
    return 'google';
  };
  
  // Pin styles configuration
  const pinConfig = {
    user: { color: '#10b981', size: 40 },
    high_rated: { color: '#f59e0b', size: 36 },
    others: { color: '#3b82f6', size: 32 },
    google: { color: '#9ca3af', size: 28 }
  };
  
  // Get user's current location
  const getUserLocation = () => {
    return new Promise((resolve) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const location = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            setUserLocation(location);
            resolve(location);
          },
          (error) => {
            console.log('Location permission denied or error:', error.message);
            const defaultLocation = { lat: 37.8044, lng: -122.2712 };
            setUserLocation(defaultLocation);
            resolve(defaultLocation);
          }
        );
      } else {
        const defaultLocation = { lat: 37.8044, lng: -122.2712 };
        setUserLocation(defaultLocation);
        resolve(defaultLocation);
      }
    });
  };
  
  // Update map markers
  // Distance helper
  const getDistanceInMiles = (lat1, lon1, lat2, lon2) => {
    const R = 3959; // Earth radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };
  
  // Update map markers - with popup protection to prevent closing open popups
  const mapUpdateTimerRef = React.useRef(null);
  
  React.useEffect(() => {
    if (!mapInstance || activeTab !== 'map') return;
    
    // If a popup is open, skip this update entirely
    if (mapInstance._popup && mapInstance._popup.isOpen && mapInstance._popup.isOpen()) return;
    
    if (mapUpdateTimerRef.current) clearTimeout(mapUpdateTimerRef.current);
    mapUpdateTimerRef.current = setTimeout(() => {
      // Final check before redrawing
      if (!mapInstance._popup || !mapInstance._popup.isOpen || !mapInstance._popup.isOpen()) {
        updateMapMarkers(allRestaurants);
      }
    }, 200);
    
    return () => { if (mapUpdateTimerRef.current) clearTimeout(mapUpdateTimerRef.current); };
  }, [mapFilters, mapInstance, activeTab, allRestaurants]);
  
  const updateMapMarkers = (restaurants) => {
    if (!mapInstance || !window.L) return;
    
    // Clear existing marker layers
    mapInstance.eachLayer(layer => {
      if (layer instanceof window.L.Marker) {
        mapInstance.removeLayer(layer);
      }
      // Check for marker cluster group safely
      if (window.L.MarkerClusterGroup && layer instanceof window.L.MarkerClusterGroup) {
        mapInstance.removeLayer(layer);
      }
      // Also check by class name as fallback
      if (layer.options?.className === 'marker-cluster') {
        mapInstance.removeLayer(layer);
      }
    });
    
    // Create marker cluster group
    const markers = window.L.markerClusterGroup ? window.L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        return window.L.divIcon({
          html: `<div style="
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #33a29b 0%, #2a8a84 100%);
            border: 3px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 14px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
          ">${count}</div>`,
          className: 'marker-cluster',
          iconSize: [40, 40]
        });
      }
    }) : window.L.layerGroup();
    
    // Filter restaurants
    let filteredRestaurants = restaurants;
    
    // Apply new filters
    const filters = mapFilters;
    
    // Popularity filters
    if (filters.popularity.length > 0) {
      filteredRestaurants = filteredRestaurants.filter(r => {
        const ratingCount = r.ratingCount || 0;
        return filters.popularity.some(f => {
          if (f === '3+') return ratingCount >= 3;
          if (f === '5+') return ratingCount >= 5;
          if (f === '10+') return ratingCount >= 10;
          return false;
        });
      });
    }
    
    // Quality filters
    if (filters.quality.length > 0) {
      filteredRestaurants = filteredRestaurants.filter(r => {
        const score = r.avgSRR || 0;
        return filters.quality.some(f => {
          if (f === '80+') return score >= 80;
          if (f === '90+') return score >= 90;
          if (f === 'top') {
            // Your top rated - check if user rated this
            const userRating = userRatings.find(rating => 
              rating.dish?.restaurant_id === r.id
            );
            return userRating && userRating.overall_score >= 85;
          }
          return false;
        });
      });
    }
    
    // Social filters
    if (filters.social.length > 0) {
      filteredRestaurants = filteredRestaurants.filter(r => {
        return filters.social.some(f => {
          if (f === 'you') {
            // Check if you rated this restaurant
            return userRatings.some(rating => 
              rating.dish?.restaurant_id === r.id
            );
          }
          if (f === 'friends') {
            // Check if friends rated (would need friends data)
            return false; // TODO: implement when friends data available
          }
          if (f === 'groups') {
            // Check if group members rated
            return false; // TODO: implement when group data available
          }
          return false;
        });
      });
    }
    
    // Distance filters
    if (filters.distance.length > 0 && userLocation) {
      filteredRestaurants = filteredRestaurants.filter(r => {
        if (!r.location?.lat || !r.location?.lng) return false;
        
        const distance = getDistanceInMiles(
          userLocation.lat, userLocation.lng,
          r.location.lat, r.location.lng
        );
        
        return filters.distance.some(f => {
          if (f === '1mi') return distance <= 1;
          if (f === '5mi') return distance <= 5;
          if (f === '10mi') return distance <= 10;
          return false;
        });
      });
    }
    
    // Legacy filters (keep for compatibility)
    if (mapFilterCuisine !== 'all') {
      filteredRestaurants = filteredRestaurants.filter(r => 
        r.cuisine?.toLowerCase() === mapFilterCuisine.toLowerCase()
      );
    }
    if (mapShowHighRatedOnly) {
      filteredRestaurants = filteredRestaurants.filter(r => r.avgSRR >= 85);
    }
    
    // Add markers
    filteredRestaurants.forEach(restaurant => {
      if (!restaurant.location || !restaurant.location.lat || !restaurant.location.lng) return;
      
      const category = getRestaurantCategory(restaurant);
      const config = pinConfig[category];
      
      const icon = window.L.divIcon({
        className: 'custom-castle-marker',
        html: createCastlePin(config.color, config.size),
        iconSize: [config.size, config.size * 1.2],
        iconAnchor: [config.size / 2, config.size * 1.2]
      });
      
      const marker = window.L.marker(
        [restaurant.location.lat, restaurant.location.lng],
        { icon, title: restaurant.name }
      );
      
      // Create rich popup with Google Places data
      const popupContent = `
        <div style="font-family: 'Courier New', monospace; min-width: 240px; max-width: 320px;">
          ${restaurant.googleData?.photo || restaurant.photo ? `
            <img 
              src="${restaurant.googleData?.photo || restaurant.photo}" 
              style="width: 100%; height: 140px; object-fit: cover; border-radius: 8px; margin-bottom: 10px;"
              onerror="this.style.display='none'"
            />
          ` : ''}
          
          <h3 style="font-weight: bold; margin: 0 0 8px 0; font-size: 15px;">${restaurant.name}</h3>
          
          ${restaurant.avgSRR ? `
            <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 8px; border-radius: 6px; margin-bottom: 8px;">
              <div style="font-size: 10px; color: #666; text-transform: uppercase; margin-bottom: 6px;">Hunters Finds Rating</div>
              <div style="font-weight: bold; font-size: 18px; color: #10b981; margin-bottom: 8px;">${typeof restaurant.avgSRR === "number" ? restaurant.avgSRR.toFixed(2) : restaurant.avgSRR}</div>
              ${(restaurant.topDishes && restaurant.topDishes.length > 0) ? `
                <div style="font-size: 10px; color: #666; text-transform: uppercase; margin-bottom: 4px; border-top: 1px solid #d1fae5; padding-top: 6px;">Top Rated Dishes</div>
                ${restaurant.topDishes.slice(0, 3).map(dish => `
                  <div style="font-size: 11px; padding: 3px 0; display: flex; justify-content: space-between;">
                    <span>${dish.name}</span>
                    <span style="font-weight: bold; color: #10b981;">${typeof dish.srr === "number" ? dish.srr.toFixed(2) : dish.srr}</span>
                  </div>
                `).join('')}
              ` : ''}
            </div>
          ` : `
            <div style="background: #f9fafb; padding: 10px; border-radius: 6px; margin-bottom: 8px; text-align: center;">
              <span style="font-size: 11px; color: #9ca3af;">Nothing rated yet</span>
            </div>
          `}
          
          ${restaurant.googleData?.rating ? `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding: 6px; background: #fef3c7; border-radius: 6px;">
              <span style="font-weight: bold; font-size: 15px;">${restaurant.googleData.rating}</span>
              <span style="font-size: 10px; color: #666;">(${restaurant.googleData.user_ratings_total || 0} Google reviews)</span>
            </div>
          ` : ''}
          
          ${restaurant.googleData?.opening_hours ? `
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px; font-size: 11px;">
              <span style="font-weight: bold; color: ${restaurant.googleData.opening_hours.open_now ? '#10b981' : '#ef4444'};">
                ${restaurant.googleData.opening_hours.open_now ? 'Open now' : 'Closed'}
              </span>
            </div>
          ` : ''}
          
          <button 
            onclick="event.stopPropagation(); window.openRestaurantFromMap('${restaurant.id}')" 
            style="width: 100%; padding: 10px; background: #33a29b; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top: 8px; font-size: 12px;"
          >
            ${!restaurant.avgSRR ? 'Rate a Dish' : 'View Details'}
          </button>
        </div>
      `;
      
      marker.bindPopup(popupContent, { maxWidth: 320 });
      markers.addLayer(marker);
    });
    
    mapInstance.addLayer(markers);
  };
  
  // Add window function for popup buttons
  if (typeof window !== 'undefined') {
    window.openRestaurantFromMap = (restaurantId) => {
      const restaurant = allRestaurants.find(r => r.id === restaurantId);
      if (restaurant) {
        // Close any open Leaflet popups first
        if (window._mapInstance) window._mapInstance.closePopup();
        restaurantModalJustOpenedRef.current = true;
        setSelectedRestaurant(restaurant);
        setTimeout(() => { restaurantModalJustOpenedRef.current = false; }, 600);
      }
    };
  }
  
  // Close search dropdown when clicking outside
  React.useEffect(() => {
    if (!showSearchDropdown) return; // Only add listener when dropdown is showing
    
    const handleClickOutside = (event) => {
      const searchContainer = event.target.closest('.search-container');
      if (!searchContainer) {
        setShowSearchDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSearchDropdown]);
  
  // Close category dropdown when clicking outside
  React.useEffect(() => {
    if (!showCategorySuggestions) return;
    const handleClickOutside = (event) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
        setShowCategorySuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCategorySuggestions]);

  // Build dynamic category list from all dishes + ratings, lowercase, deduped, with usage counts
  const allCategoriesWithCount = React.useMemo(() => {
    const counts = {};
    allDishes.forEach(d => {
      const cat = (d.cuisine || d.category || '').toLowerCase().trim();
      if (cat) counts[cat] = (counts[cat] || 0) + 1;
    });
    allRatings.forEach(r => {
      const cat = (r.dish?.cuisine_type || r.dish?.category || r.category || '').toLowerCase().trim();
      if (cat) counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([cat, count]) => ({ cat, count }))
      .sort((a, b) => b.count - a.count); // most used first by default
  }, [allDishes, allRatings]);

  const categorySuggestions = React.useMemo(() => {
    const query = categoryInput.toLowerCase().trim();
    let list = query
      ? [...allCategoriesWithCount].sort((a, b) => a.cat.localeCompare(b.cat)) // alphabetical when typing
          .filter(({ cat }) => cat.includes(query))
      : allCategoriesWithCount; // most used when empty
    return list;
  }, [allCategoriesWithCount, categoryInput]);

  const CATEGORY_INITIAL_SHOW = 6;
  const visibleCategories = categoryShowAll ? categorySuggestions : categorySuggestions.slice(0, CATEGORY_INITIAL_SHOW);
  const hasMoreCategories = categorySuggestions.length > CATEGORY_INITIAL_SHOW;

  const handleCloseResults = () => {
    setIsResultsClosing(true);
    setTimeout(() => {
      setIsResultsModalOpen(false);
      setIsResultsClosing(false);
      setRestaurant('');
      setDishName('');
      setDishCategory('');
      setCategoryInput('');
      setCategoryShowAll(false);
      setCategoryConfirmNew(null);
      setCategoryLocked(false);
      setPrice('');
      setTasteScore(50);
      setPortionScore(50);
      setPriceScore(50);
      setComment('');
    }, 300); // Match animation duration
  };

  const calculateRankingPosition = (score) => {
    const allDishesWithNew = [...getAllDishes(), { 
      name: dishName,
      restaurantName: restaurant,
      srr: score,
      cuisine: dishCategory,
      price: parseFloat(price)
    }].sort((a, b) => b.srr - a.srr);
    
    const currentIndex = allDishesWithNew.findIndex(d => d.name === dishName && d.srr === score);
    const rank = currentIndex + 1;
    const topRanked = allDishesWithNew[0];
    const aboveItem = currentIndex > 0 ? allDishesWithNew[currentIndex - 1] : null;
    const belowItem = currentIndex < allDishesWithNew.length - 1 ? allDishesWithNew[currentIndex + 1] : null;
    
    return { rank, total: allDishesWithNew.length, topRanked, aboveItem, belowItem };
  };

  const handleSubmit = async () => {
    // Check if user is logged in
    if (!user) {
      setErrorModal({
        show: true,
        title: 'Login Required',
        message: 'Please log in to submit a rating.'
      });
      setActiveTab('you');
      setYouView('login');
      return;
    }

    // Calculate final SRR score
    const finalSRR = parseFloat(((tasteScore + priceScore + portionScore) / 3).toFixed(2));

    const rating = {
      restaurant,
      dishName,
      dishCategory,
      price: parseFloat(price),
      tasteScore,
      priceScore,
      portionScore,
      finalSRR,
      ranking: calculateRankingPosition(finalSRR)
    };
    
    // Save to Supabase database
    try {
      // NOTE: The 'dishes' table uses 'restaurant_name' as a text field, not a foreign key
      // So we don't need to create/check restaurants table at all
      
      // PART 6: DUPLICATE HANDLING FOR DISHES
      // First, create or find restaurant (with Google Places data if selected)
      let restaurantId;
      
      if (selectedGooglePlace) {
        // User selected from Google Places - create/update restaurant with full data
        const googleData = {
          name: selectedGooglePlace.name,
          google_place_id: selectedGooglePlace.place_id,
          latitude: typeof selectedGooglePlace.geometry?.location?.lat === 'function' 
            ? selectedGooglePlace.geometry.location.lat() 
            : selectedGooglePlace.geometry?.location?.lat,
          longitude: typeof selectedGooglePlace.geometry?.location?.lng === 'function'
            ? selectedGooglePlace.geometry.location.lng()
            : selectedGooglePlace.geometry?.location?.lng,
          address: selectedGooglePlace.formatted_address,
          google_data: selectedGooglePlace
        };

        // Try to find by google_place_id first, then by name
        let { data: existingRestaurant } = await supabase
          .from('restaurants')
          .select('id, latitude')
          .eq('google_place_id', selectedGooglePlace.place_id)
          .maybeSingle();

        if (!existingRestaurant) {
          // Also check by name in case it was created without a place_id
          const { data: byName } = await supabase
            .from('restaurants')
            .select('id, latitude')
            .ilike('name', selectedGooglePlace.name.trim())
            .maybeSingle();
          existingRestaurant = byName;
        }

        if (existingRestaurant) {
          restaurantId = existingRestaurant.id;
          // Always update with Google data to fill in any missing fields
          await supabase
            .from('restaurants')
            .update(googleData)
            .eq('id', restaurantId);
          console.log('✅ Updated existing restaurant with Google data');
        } else {
          // Create new restaurant with Google data
          const { data: newRestaurant, error: restaurantError } = await supabase
            .from('restaurants')
            .insert([googleData])
            .select()
            .single();
          
          if (restaurantError) {
            console.error('Error creating restaurant:', restaurantError);
            throw restaurantError;
          }
          
          restaurantId = newRestaurant.id;
          console.log('✅ New Google-linked restaurant created');
        }
      } else {
        // Manual entry or DB restaurant - try to find existing, then auto-link Google if missing coords
        const { data: existingRestaurant } = await supabase
          .from('restaurants')
          .select('id, latitude, longitude, google_place_id')
          .ilike('name', restaurant.trim())
          .maybeSingle();
        
        if (existingRestaurant) {
          restaurantId = existingRestaurant.id;
          
          // If missing coordinates, try to fetch from Google Places automatically
          if (!existingRestaurant.latitude || !existingRestaurant.longitude) {
            console.log('🔍 Restaurant missing coordinates, attempting Google lookup...');
            try {
              const loc = userLocation || { lat: 37.8044, lng: -122.2712 };
              const apiUrl = `/api/places/search?query=${encodeURIComponent(restaurant.trim())}&lat=${loc.lat}&lng=${loc.lng}`;
              const response = await fetch(apiUrl);
              const data = await response.json();
              if (data.status === 'OK' && data.results?.[0]) {
                const place = data.results[0];
                await supabase.from('restaurants').update({
                  google_place_id: place.place_id,
                  latitude: place.geometry.location.lat,
                  longitude: place.geometry.location.lng,
                  address: place.formatted_address || place.vicinity,
                  google_data: place
                }).eq('id', existingRestaurant.id);
                console.log('✅ Auto-linked existing restaurant to Google Places');
              }
            } catch (e) {
              console.log('Could not auto-link to Google Places:', e.message);
            }
          } else {
            console.log('✅ Using existing restaurant with coordinates');
          }
        } else {
          // Try Google Places before creating a bare restaurant
          let newRestaurantData = { name: restaurant.trim() };
          try {
            const loc = userLocation || { lat: 37.8044, lng: -122.2712 };
            const apiUrl = `/api/places/search?query=${encodeURIComponent(restaurant.trim())}&lat=${loc.lat}&lng=${loc.lng}`;
            const response = await fetch(apiUrl);
            const data = await response.json();
            if (data.status === 'OK' && data.results?.[0]) {
              const place = data.results[0];
              newRestaurantData = {
                name: restaurant.trim(),
                google_place_id: place.place_id,
                latitude: place.geometry.location.lat,
                longitude: place.geometry.location.lng,
                address: place.formatted_address || place.vicinity,
                google_data: place
              };
              console.log('✅ New restaurant auto-linked to Google Places');
            }
          } catch (e) {
            console.log('Could not fetch Google data for new restaurant:', e.message);
          }

          const { data: newRestaurant, error: restaurantError } = await supabase
            .from('restaurants')
            .insert([newRestaurantData])
            .select()
            .single();
          
          if (restaurantError) {
            console.error('Error creating restaurant:', restaurantError);
            throw restaurantError;
          }
          
          restaurantId = newRestaurant.id;
          console.log('✅ New restaurant created');
        }
      }
      
      // Now check if this exact dish already exists
      const { data: existingDishes, error: dishCheckError } = await supabase
        .from('dishes')
        .select('id, name')
        .eq('restaurant_id', restaurantId)
        .ilike('name', dishName.trim());

      let dishId;

      if (existingDishes && existingDishes.length > 0) {
        // Dish already exists
        dishId = existingDishes[0].id;
        console.log('✅ Using existing dish:', dishName);
        
        // Check if user already has an ACTIVE (non-deleted) rating for this dish
        const { data: existingRating } = await supabase
          .from('ratings')
          .select('id')
          .eq('dish_id', dishId)
          .eq('user_id', user.id)
          .eq('is_deleted', false)
          .maybeSingle();

        if (existingRating) {
          // User already has an active rating - ask if they want to update
          setErrorModal({
            show: true,
            title: 'Already Rated',
            message: `You already rated "${dishName}". Would you like to update your rating?`,
            confirmLabel: 'Update rating',
            cancelLabel: 'Keep old rating',
            confirmAction: async () => {
              // Update the existing active rating
              const { error: updateError } = await supabase
                .from('ratings')
                .update({
                  taste_score: tasteScore,
                  portion_score: portionScore,
                  price_score: priceScore,
                  overall_score: finalSRR,
                  comment: comment || null
                })
                .eq('id', existingRating.id);

              if (updateError) {
                console.error('Error updating rating:', updateError);
                setErrorModal({
                  show: true,
                  title: 'Update Failed',
                  message: 'Could not update your rating. Please try again.'
                });
                return;
              }
              
              console.log('✅ Rating updated!');
              setSubmittedRating(rating);
              setIsSubmissionModalOpen(false);
              setIsResultsModalOpen(true);
            }
          });
          return;
        }
      } else {
        // Create new dish (linked to restaurant via restaurant_id)
        const { data: newDish, error: dishError } = await supabase
          .from('dishes')
          .insert([{
            name: dishName.trim(),
            restaurant_id: restaurantId,
            restaurant_name: restaurant.trim(), // Backward compatibility
            cuisine_type: dishCategory,
            price: parseFloat(price)
          }])
          .select()
          .single();

        if (dishError) {
          console.error('Error creating dish:', dishError);
          setErrorModal({
            show: true,
            title: 'Error Saving Dish',
            message: `Could not save dish "${dishName}". ${dishError.message || 'Please try again.'}`
          });
          return;
        }
        dishId = newDish.id;
        console.log('✅ New dish created:', dishName);
      }

      // Save the rating
      const { error: ratingError } = await supabase
        .from('ratings')
        .insert([{
          dish_id: dishId,
          user_id: user.id,
          taste_score: tasteScore,
          portion_score: portionScore,
          price_score: priceScore,
          overall_score: finalSRR,
          comment: comment || null
        }]);

      if (ratingError) {
        console.error('Error saving rating:', ratingError);
        setErrorModal({
          show: true,
          title: 'Error Saving Rating',
          message: 'Could not save your rating. Please try again.'
        });
        return;
      }

      console.log('✅ Rating saved to database!');
      
      // PHASE 4B: Handle mentions in comment
      if (comment) {
        const mentions = extractMentions(comment);
        if (mentions.length > 0) {
          // Create mention notifications for each mentioned user
          for (const mentionedUsername of mentions) {
            await createMentionNotification(mentionedUsername, 'rating', ratingData[0].id);
          }
        }
      }
      
      // Create activity feed entry
      await supabase
        .from('activity_feed')
        .insert({
          user_id: user.id,
          activity_type: 'rating',
          content: {
            dish_name: dishName,
            restaurant_name: restaurant,
            score: finalSRR
          }
        });
      
    } catch (error) {
      console.error('Unexpected error:', error);
      setErrorModal({
        show: true,
        title: 'Unexpected Error',
        message: 'Something went wrong. Please try again.'
      });
      return;
    }
    
    setSubmittedRating(rating);
    setIsSubmissionModalOpen(false);
    setIsResultsModalOpen(true);
  };

  const handleCloseSubmission = () => {
    setIsSubmissionClosing(true);
    setTimeout(() => {
      setIsSubmissionModalOpen(false);
      setIsSubmissionClosing(false);
      // Reset Google Places selection
      setSelectedGooglePlace(null);
      setShowRestaurantSearch(false);
      setRestaurantSearchResults([]);
    }, 300); // Match animation duration
  };

  const handleCloseDish = () => {
    setIsDishModalClosing(true);
    setTimeout(() => {
      setSelectedDish(null);
      setIsDishModalClosing(false);
      setDishModalView('scores'); // Reset to scores view
    }, 300);
  };

  const handleCloseNewList = () => {
    setIsNewListModalClosing(true);
    setTimeout(() => {
      setIsNewListModalOpen(false);
      setIsNewListModalClosing(false);
      setNewListName('');
      setListItemSearch('');
      setCollaboratorSearch('');
    }, 300);
  };

  const handleCloseNewGroup = () => {
    setIsNewGroupModalClosing(true);
    setTimeout(() => {
      setIsNewGroupModalOpen(false);
      setIsNewGroupModalClosing(false);
      setNewGroupName('');
      setGroupMemberSearch('');
    }, 300);
  };

  // Group creation handler
  const handleCreateGroup = async (groupData) => {
    try {
      console.log('🔍 DEBUG - Current user:', user);
      console.log('🔍 DEBUG - User ID:', user?.id);
      console.log('🔍 DEBUG - User ID type:', typeof user?.id);
      console.log('🔍 DEBUG - Group data received:', groupData);
      console.log('🔍 DEBUG - creator_id in groupData:', groupData.creator_id);
      console.log('🔍 DEBUG - creator_id type:', typeof groupData.creator_id);
      console.log('🔍 DEBUG - Are they equal?', user?.id === groupData.creator_id);
      
      // Try manual test first
      console.log('🧪 Testing if user exists in public.users...');
      const { data: userCheck, error: userCheckError } = await supabase
        .from('users')
        .select('id, email')
        .eq('id', user.id)
        .single();
      
      if (userCheckError) {
        console.error('❌ USER CHECK FAILED:', userCheckError);
      } else {
        console.log('✅ User exists in public.users:', userCheck);
      }
      
      console.log('🔍 Attempting insert with data:', JSON.stringify(groupData, null, 2));
      
      const { data, error } = await supabase
        .from('groups')
        .insert([groupData])
        .select()
        .single();

      if (error) {
        console.error('❌ INSERT ERROR:', error);
        console.error('❌ ERROR DETAILS:', JSON.stringify(error, null, 2));
        throw error;
      }

      console.log('✅ Group created:', data);
      
      // Add creator as member
      const { error: memberError } = await supabase
        .from('group_members')
        .insert([{
          group_id: data.id,
          user_id: user.id,
          role: 'admin'
        }]);
      
      if (memberError) {
        console.error('Error adding creator as member:', memberError);
      }
      
      // Refresh user groups
      const { data: memberData } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);

      const groupIds = memberData?.map(m => m.group_id) || [];
      
      if (groupIds.length > 0) {
        const { data: userGroupsData } = await supabase
          .from('groups')
          .select('*')
          .in('id', groupIds);

        setUserGroups(userGroupsData || []);
      }

      // Show success
      setErrorModal({
        show: true,
        title: 'Group Created!',
        message: `"${data.name}" has been created successfully.`
      });
    } catch (error) {
      console.error('Error creating group:', error);
      setErrorModal({
        show: true,
        title: 'Error Creating Group',
        message: error.message || 'Could not create group. Please try again.'
      });
    }
  };

  const handleLeaveGroup = async () => {
    if (!selectedGroup || !user) return;
    
    if (!confirm(`Are you sure you want to leave "${selectedGroup.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', selectedGroup.id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Refresh user groups
      const updatedGroups = userGroups.filter(g => g.id !== selectedGroup.id);
      setUserGroups(updatedGroups);
      setSelectedGroup(null);

      setErrorModal({
        show: true,
        title: 'Left Group',
        message: `You have left "${selectedGroup.name}".`
      });
    } catch (error) {
      console.error('Error leaving group:', error);
      setErrorModal({
        show: true,
        title: 'Error',
        message: 'Could not leave group. Please try again.'
      });
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup || !user) return;
    
    if (!confirm(`Are you sure you want to DELETE "${selectedGroup.name}"? This cannot be undone!`)) return;

    try {
      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', selectedGroup.id)
        .eq('creator_id', user.id); // Only creator can delete

      if (error) throw error;

      // Refresh groups lists
      const updatedUserGroups = userGroups.filter(g => g.id !== selectedGroup.id);
      const updatedAllGroups = allGroups.filter(g => g.id !== selectedGroup.id);
      setUserGroups(updatedUserGroups);
      setAllGroups(updatedAllGroups);
      setSelectedGroup(null);

      setErrorModal({
        show: true,
        title: 'Group Deleted',
        message: `"${selectedGroup.name}" has been deleted.`
      });
    } catch (error) {
      console.error('Error deleting group:', error);
      setErrorModal({
        show: true,
        title: 'Error',
        message: 'Could not delete group. Please try again.'
      });
    }
  };

  // Tag handlers
  const fetchTagsForItem = async (itemId, itemType) => {
    if (!itemId) return;

    try {
      const tableName = itemType === 'dish' ? 'dish_tags' : 'restaurant_tags';
      const viewName = itemType === 'dish' ? 'dish_tags_with_counts' : 'restaurant_tags_with_counts';
      const idColumn = itemType === 'dish' ? 'dish_id' : 'restaurant_id';

      // Fetch tags with 3+ votes (visible to everyone)
      const { data: publicTags, error: publicError } = await supabase
        .from(viewName)
        .select('*')
        .eq(idColumn, itemId);

      if (publicError) throw publicError;

      // Fetch user's own tags for this item (to show immediately, even if <3 votes)
      let userOwnTags = [];
      if (user) {
        const { data: userTags, error: userError } = await supabase
          .from(tableName)
          .select('tag_id')
          .eq(idColumn, itemId)
          .eq('user_id', user.id);

        if (userError) throw userError;
        
        // Convert user tags to same format as public tags
        userOwnTags = userTags?.map(t => ({
          tag_id: t.tag_id,
          vote_count: 1 // User's own vote
        })) || [];
        
        // Store user's tag IDs
        if (itemType === 'dish') {
          setUserDishTags(prev => ({ ...prev, [itemId]: userTags?.map(t => t.tag_id) || [] }));
        }
      }

      // Merge public tags with user's own tags (avoid duplicates)
      const publicTagIds = publicTags?.map(t => t.tag_id) || [];
      const userUniqueTagIds = userOwnTags.filter(t => !publicTagIds.includes(t.tag_id));
      const allTagsForItem = [...(publicTags || []), ...userUniqueTagIds];
      
      // Store combined tags
      if (itemType === 'dish') {
        setDishTags(prev => ({ ...prev, [itemId]: allTagsForItem }));
      }

      console.log(`✅ Fetched tags for ${itemType}:`, publicTags?.length || 0, 'public,', userUniqueTagIds.length, 'user-only');
    } catch (error) {
      console.error(`❌ Error fetching tags for ${itemType}:`, error);
    }
  };

  const handleSaveTags = async (selectedTagIds) => {
    if (!tagModalItem || !user) return;

    try {
      const tableName = tagModalItem.type === 'dish' ? 'dish_tags' : 'restaurant_tags';
      const idColumn = tagModalItem.type === 'dish' ? 'dish_id' : 'restaurant_id';

      // Get user's current tags for this item
      const { data: currentTags } = await supabase
        .from(tableName)
        .select('tag_id')
        .eq(idColumn, tagModalItem.id)
        .eq('user_id', user.id);

      const currentTagIds = currentTags?.map(t => t.tag_id) || [];

      // Tags to add
      const tagsToAdd = selectedTagIds.filter(id => !currentTagIds.includes(id));

      // Tags to remove
      const tagsToRemove = currentTagIds.filter(id => !selectedTagIds.includes(id));

      // Add new tags
      if (tagsToAdd.length > 0) {
        const insertData = tagsToAdd.map(tag_id => ({
          [idColumn]: tagModalItem.id,
          tag_id,
          user_id: user.id
        }));

        const { error: insertError } = await supabase
          .from(tableName)
          .insert(insertData);

        if (insertError) throw insertError;
      }

      // Remove unchecked tags
      if (tagsToRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from(tableName)
          .delete()
          .eq(idColumn, tagModalItem.id)
          .eq('user_id', user.id)
          .in('tag_id', tagsToRemove);

        if (deleteError) throw deleteError;
      }

      console.log('✅ Tags saved:', tagsToAdd.length, 'added,', tagsToRemove.length, 'removed');
      
      // Refresh tags for this item
      await fetchTagsForItem(tagModalItem.id, tagModalItem.type);
      
      // Success - no modal needed, tags will update visually
    } catch (error) {
      console.error('❌ Error saving tags:', error);
      setErrorModal({
        show: true,
        title: 'Error',
        message: 'Could not save tags. Please try again.'
      });
    }
  };

  const handleOpenTagsModal = (itemId, itemType, itemName) => {
    setTagModalItem({ id: itemId, type: itemType, name: itemName });
    setIsAddTagsModalOpen(true);
  };

  // Recommendation engine - "Dishes you might like"
  const getRecommendations = () => {
    if (!user || !userRatings || userRatings.length === 0) return [];

    // Get user's top-rated dishes (score >= 85)
    const topRatedDishes = userRatings
      .filter(r => r.overall_score >= 85)
      .sort((a, b) => b.overall_score - a.overall_score)
      .slice(0, 5);

    if (topRatedDishes.length === 0) return [];

    // Get cuisines and tags from top-rated dishes
    const favoriteCuisines = {};
    const favoriteTags = {};

    topRatedDishes.forEach(rating => {
      const dish = allDishes.find(d => d.id === rating.dish_id);
      if (dish) {
        // Count cuisines
        favoriteCuisines[dish.cuisine] = (favoriteCuisines[dish.cuisine] || 0) + 1;
        
        // Count tags
        const tags = dishTags[dish.id] || [];
        tags.forEach(tag => {
          favoriteTags[tag.tag_id] = (favoriteTags[tag.tag_id] || 0) + 1;
        });
      }
    });

    // Get dishes user hasn't rated
    const ratedDishIds = userRatings.map(r => r.dish_id);
    const unratedDishes = allDishes.filter(d => !ratedDishIds.includes(d.id));

    // Score each unrated dish based on similarity
    const scoredDishes = unratedDishes.map(dish => {
      let score = 0;

      // +3 points for matching cuisine
      if (favoriteCuisines[dish.cuisine]) {
        score += 3 * favoriteCuisines[dish.cuisine];
      }

      // +2 points per matching tag
      const tags = dishTags[dish.id] || [];
      tags.forEach(tag => {
        if (favoriteTags[tag.tag_id]) {
          score += 2 * favoriteTags[tag.tag_id];
        }
      });

      // +1 point per 10 SRR points (boost highly-rated dishes)
      score += dish.srr / 10;

      return { ...dish, recommendationScore: score };
    });

    // Return top 10 recommendations
    return scoredDishes
      .filter(d => d.recommendationScore > 0)
      .sort((a, b) => b.recommendationScore - a.recommendationScore)
      .slice(0, 10);
  };

  // Location functions
  const requestLocation = async () => {
    if (!navigator.geolocation) {
      setErrorModal({
        show: true,
        title: 'Location Not Supported',
        message: 'Your browser does not support location services.'
      });
      return;
    }

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });

      setUserLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude
      });
      setNearMeEnabled(true);
      console.log('✅ Location granted:', position.coords.latitude, position.coords.longitude);
    } catch (error) {
      console.error('❌ Location denied:', error);
      setNearMeEnabled(false);
      setErrorModal({
        show: true,
        title: 'Location Access Denied',
        message: 'Please enable location access in your browser settings to use "Near Me" features.'
      });
    }
  };

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in miles
  };

  const restaurantModalJustOpenedRef = React.useRef(false);

  // Lock body scroll when any modal is open (prevents mobile scroll bleed)
  React.useEffect(() => {
    const anyModalOpen = isSubmissionModalOpen || isResultsModalOpen || selectedDish || selectedRestaurant || showDeleteConfirm;
    if (anyModalOpen) {
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.dataset.scrollY = scrollY;
    } else {
      const scrollY = document.body.dataset.scrollY || 0;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, parseInt(scrollY));
    }
    return () => {
      const scrollY = document.body.dataset.scrollY || 0;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, parseInt(scrollY));
    };
  }, [isSubmissionModalOpen, isResultsModalOpen, selectedDish, selectedRestaurant, showDeleteConfirm]);

  // Check if current user has rated the selected dish
  React.useEffect(() => {
    if (!selectedDish || !user) { setUserHasRatedDish(false); return; }
    if (userRole === 'admin' || userRole === 'moderator') { setUserHasRatedDish(true); return; }
    supabase
      .from('ratings')
      .select('id')
      .eq('dish_id', selectedDish.id)
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .maybeSingle()
      .then(({ data }) => setUserHasRatedDish(!!data));
  }, [selectedDish, user]);

  const handleCloseRestaurant = () => {
    if (restaurantModalJustOpenedRef.current) return; // Ignore clicks right after opening
    setIsRestaurantModalClosing(true);
    setTimeout(() => {
      setSelectedRestaurant(null);
      setIsRestaurantModalClosing(false);
      setRestaurantModalView('scores'); // Reset to scores view
    }, 300);
  };

  const handleCloseGroup = () => {
    setIsGroupModalClosing(true);
    setTimeout(() => {
      setSelectedGroup(null);
      setIsGroupModalClosing(false);
      setGroupModalView('members');
    }, 300);
  };

  const handleCloseUser = () => {
    setIsUserModalClosing(true);
    setTimeout(() => {
      setSelectedUser(null);
      setIsUserModalClosing(false);
    }, 300);
  };

  // Modal Stack Management Functions
  const pushModal = (type, data) => {
    setModalStack(prev => [...prev, { type, data }]);
  };

  const popModal = () => {
    setModalStack(prev => {
      if (prev.length <= 1) {
        return [];
      }
      return prev.slice(0, -1);
    });
  };

  const clearModalStack = () => {
    setModalStack([]);
  };

  const getTopModal = () => {
    if (modalStack.length === 0) return null;
    return modalStack[modalStack.length - 1];
  };

  const hasModalInStack = () => modalStack.length > 0;
  const canGoBack = () => modalStack.length > 1;

  // Enhanced modal handlers with stack support
  const openUserFromGroup = (user) => {
    pushModal('user', user);
  };

  const openDishFromGroup = (dish) => {
    pushModal('dish', dish);
  };

  const handleBackInModal = () => {
    popModal();
  };

  const handleCloseModalStack = () => {
    clearModalStack();
  };

  const handleSaveItem = (item, type) => {
    const savedItem = { ...item, type, savedAt: new Date().toISOString() };
    setSavedItems(prev => {
      const exists = prev.find(i => i.id === item.id && i.type === type);
      if (exists) {
        return prev.filter(i => !(i.id === item.id && i.type === type));
      }
      return [...prev, savedItem];
    });
  };

  const isItemSaved = (itemId, type) => {
    return savedItems.some(i => i.id === itemId && i.type === type);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50" style={{ fontFamily: '"Courier New", monospace' }}>
      <style>{`
        .leaflet-control-attribution {
          font-size: 7px !important;
          opacity: 0.3 !important;
          background: transparent !important;
          box-shadow: none !important;
        }
        .leaflet-control-attribution:hover {
          opacity: 0.6 !important;
        }
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          height: 8px;
          border-radius: 4px;
          outline: none;
        }
        
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          cursor: grab;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          border: 3px solid #33a29b;
        }
        
        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.15);
          box-shadow: 0 3px 10px rgba(0,0,0,0.4);
        }
        
        input[type="range"]::-webkit-slider-thumb:active {
          cursor: grabbing;
          transform: scale(1.1);
        }
        
        input[type="range"]::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          cursor: grab;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          border: 3px solid #33a29b;
        }
        
        input[type="range"]::-moz-range-thumb:hover {
          transform: scale(1.15);
          box-shadow: 0 3px 10px rgba(0,0,0,0.4);
        }
        
        input[type="range"]::-moz-range-thumb:active {
          cursor: grabbing;
          transform: scale(1.1);
        }

        /* Smaller slider thumb on mobile */
        @media (max-width: 768px) {
          input[type="range"]::-webkit-slider-thumb {
            width: 16px;
            height: 16px;
            border-width: 2px;
          }
          input[type="range"]::-moz-range-thumb {
            width: 16px;
            height: 16px;
            border-width: 2px;
          }
        }

        /* PHASE 1 ANIMATIONS - Quick Wins */
        
        /* Enhanced button micro-interactions with scale and shadow */
        button, .clickable-card {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        button:hover:not(:disabled) {
          transform: scale(1.02);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        button:active:not(:disabled) {
          transform: scale(0.98);
        }
        
        /* Gradient shift on hover for cards */
        .gradient-card {
          background-size: 200% 200%;
          transition: background-position 0.6s ease, transform 0.2s ease;
        }
        
        .gradient-card:hover {
          background-position: right center;
        }
        
        /* PHASE 2 ANIMATIONS - Polish */
        
        /* Staggered list animations */
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .stagger-item {
          animation: fadeInUp 0.4s ease-out forwards;
          opacity: 0;
        }
        
        .stagger-item:nth-child(1) { animation-delay: 0.05s; }
        .stagger-item:nth-child(2) { animation-delay: 0.10s; }
        .stagger-item:nth-child(3) { animation-delay: 0.15s; }
        .stagger-item:nth-child(4) { animation-delay: 0.20s; }
        .stagger-item:nth-child(5) { animation-delay: 0.25s; }
        .stagger-item:nth-child(6) { animation-delay: 0.30s; }
        
        /* Tab content transitions */
        .tab-content-enter {
          animation: fadeSlideIn 0.3s ease-out forwards;
        }
        
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        /* PHASE 3 ANIMATIONS - Delight */
        
        /* Floating animation for badges */
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-3px); }
        }
        
        @keyframes fadeInScale {
          0% { 
            opacity: 0;
            transform: scale(0.8);
          }
          100% { 
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .animate-fade-in-scale {
          animation: fadeInScale 0.3s ease-out;
        }
        
        .float-badge {
          animation: float 3s ease-in-out infinite;
        }
        
        /* Score badge shine effect */
        @keyframes shine {
          0% { 
            background-position: -200% center;
          }
          100% { 
            background-position: 200% center;
          }
        }
        
        .score-shine {
          position: relative;
          overflow: hidden;
        }
        
        .score-shine::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.3) 50%,
            transparent 100%
          );
          background-size: 200% 100%;
          animation: shine 3s infinite;
          pointer-events: none;
        }
        
        /* Skeleton loading shimmer */
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        
        .skeleton {
          background: linear-gradient(
            90deg,
            #f0f0f0 25%,
            #e0e0e0 50%,
            #f0f0f0 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 8px;
        }
        
        /* Pulse animation for loading */
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes slideUpFade {
          from {
            opacity: 0;
            transform: translate(-50%, 30px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }

        @keyframes slideDownFade {
          from {
            opacity: 1;
            transform: translate(-50%, 0);
          }
          to {
            opacity: 0;
            transform: translate(-50%, 30px);
          }
        }

        @keyframes slideUpFadeCentered {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) translateY(30px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) translateY(0);
          }
        }

        @keyframes slideDownFadeCentered {
          from {
            opacity: 1;
            transform: translate(-50%, -50%) translateY(0);
          }
          to {
            opacity: 0;
            transform: translate(-50%, -50%) translateY(30px);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }

        .animate-slide-up-fade {
          animation: slideUpFade 0.3s ease-out forwards;
        }

        .animate-slide-down-fade {
          animation: slideDownFade 0.3s ease-in forwards;
        }

        .animate-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }

        .animate-fade-out {
          animation: fadeOut 0.3s ease-in forwards;
        }

        @keyframes slideUpFadeSimple {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideDownFadeSimple {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(30px);
          }
        }

        .animate-slide-up-fade-simple {
          animation: slideUpFadeSimple 0.3s ease-out forwards;
        }

        .animate-slide-down-fade-simple {
          animation: slideDownFadeSimple 0.3s ease-in forwards;
        }
      `}</style>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="w-10"></div> {/* Spacer for centering */}
          <h1 className="text-xl font-bold text-gray-800">hunters finds</h1>
          {user && (
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 hover:bg-gray-100 rounded-full transition"
              >
                <Bell size={20} className="text-gray-700" />
                {unreadNotificationsCount > 0 && (
                  <div className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </div>
                )}
              </button>
              
              {/* Notifications Dropdown */}
              {showNotifications && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowNotifications(false)}
                  />
                  <div className="absolute right-0 top-12 w-80 bg-white rounded-lg shadow-xl border z-50 max-h-96 overflow-y-auto">
                    <div className="sticky top-0 bg-white border-b p-3 flex justify-between items-center">
                      <h3 className="font-bold text-sm" style={{ fontFamily: '"Courier New", monospace' }}>notifications</h3>
                      {unreadNotificationsCount > 0 && (
                        <button 
                          onClick={markAllNotificationsAsRead}
                          className="text-xs text-[#33a29b] hover:text-[#2a8a84] font-semibold"
                          style={{ fontFamily: '"Courier New", monospace' }}
                        >
                          mark all read
                        </button>
                      )}
                    </div>
                    
                    {notifications.length > 0 ? (
                      notifications.map(notif => (
                        <div 
                          key={notif.id}
                          onClick={() => {
                            markNotificationAsRead(notif.id);
                            setShowNotifications(false);
                          }}
                          className={`p-3 border-b hover:bg-gray-50 cursor-pointer transition ${
                            !notif.read ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="w-8 h-8 rounded-full bg-[#33a29b]/10 flex items-center justify-center flex-shrink-0">
                              {notif.type === 'follow' && <UserPlus size={14} className="text-[#33a29b]" />}
                              {notif.type === 'comment' && <MessageSquare size={14} className="text-[#33a29b]" />}
                              {notif.type === 'reaction' && <Heart size={14} className="text-[#33a29b]" />}
                              {notif.type === 'mention' && <AtSign size={14} className="text-[#33a29b]" />}
                              {notif.type === 'group_message' && <MessageCircle size={14} className="text-[#33a29b]" />}
                              {notif.type === 'group_invite' && <Users size={14} className="text-[#33a29b]" />}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-gray-800" style={{ fontFamily: '"Courier New", monospace' }}>
                                {notif.type === 'follow' && `@${notif.content.follower} started following you`}
                                {notif.type === 'comment' && `@${notif.content.commenter} commented on your rating`}
                                {notif.type === 'reaction' && `@${notif.content.reactor} reacted to your rating`}
                                {notif.type === 'mention' && `@${notif.content.mentioner} mentioned you`}
                                {notif.type === 'group_message' && `New message in ${notif.content.group_name}`}
                                {notif.type === 'group_invite' && `@${notif.content.inviter} invited you to ${notif.content.group_name}`}
                              </p>
                              <p className="text-xs text-gray-500 mt-1" style={{ fontFamily: '"Courier New", monospace' }}>
                                {new Date(notif.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            {!notif.read && (
                              <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center">
                        <Bell size={32} className="text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>
                          No notifications yet
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          {!user && <div className="w-10"></div>}
        </div>
        <div className="relative search-container">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchQuery.length >= 2) setShowSearchDropdown(true);
            }}
            onBlur={() => {
              setTimeout(() => setShowSearchDropdown(false), 200);
            }}
            placeholder="search restaurants or dishes..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#33a29b]"
            style={{ fontFamily: '"Courier New", monospace' }}
          />
          
          {/* Search Results Dropdown - Enhanced with Google Places */}
          {showSearchDropdown && (
            <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
              {searchLoading ? (
                <div className="p-4 text-center text-gray-500 text-sm" style={{ fontFamily: '"Courier New", monospace' }}>
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#33a29b] mx-auto mb-2"></div>
                  Searching...
                </div>
              ) : googleSearchError ? (
                <div className="p-4 text-center" style={{ fontFamily: '"Courier New", monospace' }}>
                  <div className="text-yellow-600 text-sm mb-2">⚠️ Google search unavailable</div>
                  <div className="text-xs text-gray-500">Showing database results only</div>
                </div>
              ) : searchResults.merged && searchResults.merged.length > 0 ? (
                <div className="p-2">
                  {searchResults.merged.map((result, idx) => (
                    <div
                      key={`result-${idx}`}
                      onClick={() => {
                        // Always open rating modal pre-filled with this restaurant
                        const placeData = result.googlePlaceData || {
                          place_id: result.id,
                          name: result.name,
                          address: result.address,
                          lat: result.lat,
                          lng: result.lng,
                        };
                        const normalized = normalizeGooglePlace(placeData);
                        setSelectedGooglePlace(normalized);
                        setRestaurant(result.name);
                        setDishName('');
                        setIsSubmissionModalOpen(true);
                        setShowSearchDropdown(false);
                        setSearchQuery('');
                      }}
                      className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer transition"
                    >
                      {/* Photo Thumbnail */}
                      <div className="w-12 h-12 flex-shrink-0 bg-gray-200 rounded overflow-hidden">
                        {result.photo ? (
                          <img src={result.photo} alt={result.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <MapPin size={20} />
                          </div>
                        )}
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate" style={{ fontFamily: '"Courier New", monospace' }}>
                              {result.name}
                              {result.type === 'dish' && (
                                <span className="text-xs font-normal text-gray-500 ml-1">
                                  @ {result.restaurantName}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 truncate" style={{ fontFamily: '"Courier New", monospace' }}>
                              {result.address}
                              {result.distance !== null && (
                                <span className="ml-1">• {result.distance.toFixed(1)} mi</span>
                              )}
                            </div>
                          </div>
                          
                          {/* Ratings */}
                          <div className="flex-shrink-0 text-right">
                            {result.yourRating && (
                              <div className="text-xs font-bold text-green-600" style={{ fontFamily: '"Courier New", monospace' }}>
                                ✓ {result.yourRating}
                              </div>
                            )}
                            {result.communityRating && (
                              <div className={`text-sm font-bold ${getSRRColor(result.communityRating)}`} style={{ fontFamily: '"Courier New", monospace' }}>
                                {result.communityRating}
                              </div>
                            )}
                            {result.source === 'google' && result.googleRating && (
                              <div className="text-xs text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>
                                ⭐ {result.googleRating}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Source badge */}
                        {result.source === 'google' && (
                          <div className="text-xs text-blue-600 mt-1" style={{ fontFamily: '"Courier New", monospace' }}>
                            🔎 Google Places (not rated yet)
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {/* Show Nearby Toggle */}
                  {showNearbyToggle && (
                    <div className="p-2 border-t border-gray-100 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ fontFamily: '"Courier New", monospace' }}>
                        <input
                          type="checkbox"
                          checked={includeNearby}
                          onChange={(e) => {
                            setIncludeNearby(e.target.checked);
                            if (e.target.checked) {
                              performSearch(searchQuery);
                            }
                          }}
                          className="cursor-pointer"
                        />
                        <span className="text-gray-700">🔎 Include nearby restaurants</span>
                      </label>
                    </div>
                  )}
                </div>
              ) : searchQuery.length >= 3 ? (
                <div className="p-4 text-center text-gray-500 text-sm" style={{ fontFamily: '"Courier New", monospace' }}>
                  No results found for "{searchQuery}"
                </div>
              ) : searchQuery.length > 0 && searchQuery.length < 3 ? (
                <div className="p-4 text-center text-gray-400 text-xs" style={{ fontFamily: '"Courier New", monospace' }}>
                  Type at least 3 characters to search...
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pb-16">
        {/* MAP TAB - ENHANCED */}
        {activeTab === 'map' && (
          <div className="h-full relative">
            {isMapLoaded ? (
              <div className="h-full w-full relative">
                {/* Map Container */}
                <div 
                  ref={(el) => {
                    if (el && window.L && !el.dataset.initialized) {
                      el.dataset.initialized = 'true';
                      
                      try {
                        // Get user location first
                        getUserLocation().then(location => {
                          // Initialize map with CartoDB Voyager tiles (Apple Maps style)
                          const map = window.L.map(el, {
                            center: [location.lat, location.lng],
                            zoom: 14,
                            zoomControl: true
                          });

                          // Add CartoDB Voyager tile layer (clean, modern, muted colors)
                          window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                            attribution: '© CartoDB © OpenStreetMap',
                            maxZoom: 19,
                            tileSize: 512,
                            zoomOffset: -1,
                            detectRetina: true
                          }).addTo(map);

                          setMapInstance(map);
                          window._mapInstance = map; // Store globally for popup close
                          
                          // Initial load: show nearby restaurants
                          const initialRestaurants = allRestaurants.filter(r => 
                            r.location && r.location.lat && r.location.lng &&
                            Math.abs(r.location.lat - location.lat) < 0.1 &&
                            Math.abs(r.location.lng - location.lng) < 0.1
                          );
                          
                          updateMapMarkers(initialRestaurants);
                          
                          console.log('✨ Enhanced map initialized successfully');
                        });
                      } catch (error) {
                        console.error('Error initializing map:', error);
                      }
                    }
                  }}
                  className="w-full h-full"
                  style={{ zIndex: 0 }}
                />
                
                {/* Find Nearby Button - Top Center */}
                {showMapFindNearby && (
                  <button
                    onClick={async () => {
                      if (!mapInstance) return;
                      const center = mapInstance.getCenter();
                      const location = { lat: center.lat, lng: center.lng };
                      setShowMapFindNearby(false);
                      const results = await searchGooglePlacesAPI('restaurants', location, { limit: 5 });
                      if (results.length > 0) {
                        const googleRestaurants = results.map(r => ({
                          id: r.place_id,
                          name: r.name,
                          location: { lat: r.lat, lng: r.lng, address: r.address },
                          avgSRR: null,
                          cuisine: r.types?.join(', ') || '',
                          isGooglePlace: true,
                          googleData: r
                        }));
                        updateMapMarkers([...allRestaurants, ...googleRestaurants]);
                      }
                      setTimeout(() => setShowMapFindNearby(true), 10000);
                    }}
                    className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2.5 bg-[#33a29b] text-white rounded-lg font-bold hover:bg-[#2a8a84] transition shadow-lg z-10 text-sm"
                    style={{ fontFamily: '"Courier New", monospace' }}
                  >
                    Find Nearby Restaurants
                  </button>
                )}
                
                {/* Filters Panel */}
                <div className="absolute top-20 right-4 z-10">
                  <button
                    onClick={() => setShowMapFilters(!showMapFilters)}
                    className="bg-white rounded-lg shadow-lg px-4 py-2 text-sm font-bold hover:bg-gray-50 flex items-center gap-2"
                    style={{ fontFamily: '"Courier New", monospace' }}
                  >
                    Filters
                    <span className="text-xs">▾</span>
                  </button>
                  
                  {showMapFilters && (
                    <div className="absolute right-0 mt-2 bg-white rounded-lg shadow-xl p-4 w-72 max-h-96 overflow-y-auto" style={{ fontFamily: '"Courier New", monospace' }}>
                      {/* Popularity */}
                      <div className="mb-4">
                        <h5 className="text-xs font-bold mb-2 text-gray-700">Popularity</h5>
                        <label className="flex items-center gap-2 text-xs mb-1">
                          <input type="checkbox" checked={mapFilters.popularity.includes('3+')} 
                            onChange={(e) => {
                              const val = '3+';
                              setMapFilters(prev => ({
                                ...prev,
                                popularity: e.target.checked ? [...prev.popularity, val] : prev.popularity.filter(v => v !== val)
                              }));
                            }} />
                          <span>3+ ratings</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs mb-1">
                          <input type="checkbox" checked={mapFilters.popularity.includes('5+')}
                            onChange={(e) => {
                              const val = '5+';
                              setMapFilters(prev => ({
                                ...prev,
                                popularity: e.target.checked ? [...prev.popularity, val] : prev.popularity.filter(v => v !== val)
                              }));
                            }} />
                          <span>5+ ratings</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs">
                          <input type="checkbox" checked={mapFilters.popularity.includes('10+')}
                            onChange={(e) => {
                              const val = '10+';
                              setMapFilters(prev => ({
                                ...prev,
                                popularity: e.target.checked ? [...prev.popularity, val] : prev.popularity.filter(v => v !== val)
                              }));
                            }} />
                          <span>10+ ratings</span>
                        </label>
                      </div>
                      
                      {/* Quality */}
                      <div className="mb-4 border-t pt-3">
                        <h5 className="text-xs font-bold mb-2 text-gray-700">Quality</h5>
                        <label className="flex items-center gap-2 text-xs mb-1">
                          <input type="checkbox" checked={mapFilters.quality.includes('80+')}
                            onChange={(e) => {
                              const val = '80+';
                              setMapFilters(prev => ({
                                ...prev,
                                quality: e.target.checked ? [...prev.quality, val] : prev.quality.filter(v => v !== val)
                              }));
                            }} />
                          <span>80+ score</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs mb-1">
                          <input type="checkbox" checked={mapFilters.quality.includes('90+')}
                            onChange={(e) => {
                              const val = '90+';
                              setMapFilters(prev => ({
                                ...prev,
                                quality: e.target.checked ? [...prev.quality, val] : prev.quality.filter(v => v !== val)
                              }));
                            }} />
                          <span>90+ score</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs">
                          <input type="checkbox" checked={mapFilters.quality.includes('top')}
                            onChange={(e) => {
                              const val = 'top';
                              setMapFilters(prev => ({
                                ...prev,
                                quality: e.target.checked ? [...prev.quality, val] : prev.quality.filter(v => v !== val)
                              }));
                            }} />
                          <span>Your top rated</span>
                        </label>
                      </div>
                      
                      {/* Social */}
                      <div className="mb-4 border-t pt-3">
                        <h5 className="text-xs font-bold mb-2 text-gray-700">Social</h5>
                        <label className="flex items-center gap-2 text-xs mb-1">
                          <input type="checkbox" checked={mapFilters.social.includes('you')}
                            onChange={(e) => {
                              const val = 'you';
                              setMapFilters(prev => ({
                                ...prev,
                                social: e.target.checked ? [...prev.social, val] : prev.social.filter(v => v !== val)
                              }));
                            }} />
                          <span>You rated</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs mb-1">
                          <input type="checkbox" checked={mapFilters.social.includes('friends')}
                            onChange={(e) => {
                              const val = 'friends';
                              setMapFilters(prev => ({
                                ...prev,
                                social: e.target.checked ? [...prev.social, val] : prev.social.filter(v => v !== val)
                              }));
                            }} />
                          <span>Friends rated</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs">
                          <input type="checkbox" checked={mapFilters.social.includes('groups')}
                            onChange={(e) => {
                              const val = 'groups';
                              setMapFilters(prev => ({
                                ...prev,
                                social: e.target.checked ? [...prev.social, val] : prev.social.filter(v => v !== val)
                              }));
                            }} />
                          <span>Group members rated</span>
                        </label>
                      </div>
                      
                      {/* Distance */}
                      <div className="border-t pt-3">
                        <h5 className="text-xs font-bold mb-2 text-gray-700">Distance</h5>
                        <label className="flex items-center gap-2 text-xs mb-1">
                          <input type="checkbox" checked={mapFilters.distance.includes('1mi')}
                            onChange={(e) => {
                              const val = '1mi';
                              setMapFilters(prev => ({
                                ...prev,
                                distance: e.target.checked ? [...prev.distance, val] : prev.distance.filter(v => v !== val)
                              }));
                            }} />
                          <span>Within 1 mile</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs mb-1">
                          <input type="checkbox" checked={mapFilters.distance.includes('5mi')}
                            onChange={(e) => {
                              const val = '5mi';
                              setMapFilters(prev => ({
                                ...prev,
                                distance: e.target.checked ? [...prev.distance, val] : prev.distance.filter(v => v !== val)
                              }));
                            }} />
                          <span>Within 5 miles</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs">
                          <input type="checkbox" checked={mapFilters.distance.includes('10mi')}
                            onChange={(e) => {
                              const val = '10mi';
                              setMapFilters(prev => ({
                                ...prev,
                                distance: e.target.checked ? [...prev.distance, val] : prev.distance.filter(v => v !== val)
                              }));
                            }} />
                          <span>Within 10 miles</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Legend */}
                <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 z-10" style={{ fontFamily: '"Courier New", monospace' }}>
                  <h4 className="text-xs font-bold mb-2">Legend</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div style={{
                        width: 16,
                        height: 16,
                        background: '#10b981',
                        borderRadius: '50%',
                        border: '2px solid white',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                      }}></div>
                      <span>Your Restaurants</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div style={{
                        width: 16,
                        height: 16,
                        background: '#f59e0b',
                        borderRadius: '50%',
                        border: '2px solid white',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                      }}></div>
                      <span>High Rated (85+)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div style={{
                        width: 16,
                        height: 16,
                        background: '#3b82f6',
                        borderRadius: '50%',
                        border: '2px solid white',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                      }}></div>
                      <span>Community Rated</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div style={{
                        width: 16,
                        height: 16,
                        background: '#9ca3af',
                        borderRadius: '50%',
                        border: '2px solid white',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                      }}></div>
                      <span>Unrated</span>
                    </div>
                  </div>
                </div>
                

              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center bg-gray-100 p-4">
                <div className="text-center max-w-md">
                  <MapPin size={48} className="mx-auto mb-4 text-gray-400 animate-pulse" />
                  <p className="text-sm text-gray-600 mb-2" style={{ fontFamily: '"Courier New", monospace' }}>Loading enhanced map...</p>
                  <p className="text-xs text-gray-400 mt-2" style={{ fontFamily: '"Courier New", monospace' }}>
                    ✨ Modern tiles, custom castle pins, clustering!
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* RANKINGS TAB */}
        {activeTab === 'rankings' && (
          <div>
            <div className="bg-white border-b px-4 py-2 flex gap-2 items-center">
              <button
                onClick={() => setRankingView('dishes')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  rankingView === 'dishes' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                top dishes
              </button>
              <button
                onClick={() => setRankingView('restaurants')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  rankingView === 'restaurants' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                top restaurants
              </button>
              <button
                onClick={() => setRankingView('groups')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  rankingView === 'groups' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                groups
              </button>
              
              {/* Near Me Button - show in all ranking tabs */}
              {(rankingView === 'dishes' || rankingView === 'restaurants' || rankingView === 'groups') && (
                <button
                  onClick={() => {
                    if (!nearMeEnabled) {
                      requestLocation();
                    } else {
                      setNearMeEnabled(false);
                      setUserLocation(null);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1 ${
                    nearMeEnabled
                      ? 'bg-[#33a29b] text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  style={{ fontFamily: '"Courier New", monospace' }}
                >
                  <MapPin size={16} />
                  near me
                </button>
              )}
              
              {/* Filter Button - only show for dishes/restaurants */}
              {(rankingView === 'dishes' || rankingView === 'restaurants') && (
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`ml-auto px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1 ${
                    showFilters || selectedCuisine !== 'all' || selectedPriceRange !== 'all' || selectedRating !== 'all'
                      ? 'bg-[#33a29b] text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  style={{ fontFamily: '"Courier New", monospace' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="4" y1="6" x2="20" y2="6"/>
                    <line x1="4" y1="12" x2="20" y2="12"/>
                    <line x1="4" y1="18" x2="20" y2="18"/>
                    <circle cx="7" cy="6" r="2" fill="currentColor"/>
                    <circle cx="14" cy="12" r="2" fill="currentColor"/>
                    <circle cx="10" cy="18" r="2" fill="currentColor"/>
                  </svg>
                  filters
                  {(selectedCuisine !== 'all' || selectedPriceRange !== 'all' || selectedRating !== 'all') && (
                    <span className="bg-white text-[#33a29b] px-1.5 py-0.5 rounded-full text-xs font-bold">
                      {[selectedCuisine, selectedPriceRange, selectedRating].filter(f => f !== 'all').length}
                    </span>
                  )}
                </button>
              )}
            </div>
            
            {/* Filter Panel */}
            {showFilters && (rankingView === 'dishes' || rankingView === 'restaurants') && (
              <div className="bg-gray-50 border-b px-4 py-3">
                <div className="max-w-4xl mx-auto space-y-3">
                  {/* Cuisine Filter */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-gray-700" style={{ fontFamily: '"Courier New", monospace' }}>
                      cuisine
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedCuisine('all')}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                          selectedCuisine === 'all'
                            ? 'bg-[#33a29b] text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                        style={{ fontFamily: '"Courier New", monospace' }}
                      >
                        all
                      </button>
                      {availableCuisines.map(cuisine => (
                        <button
                          key={cuisine}
                          onClick={() => setSelectedCuisine(cuisine)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                            selectedCuisine === cuisine
                              ? 'bg-[#33a29b] text-white'
                              : 'bg-white text-gray-700 hover:bg-gray-100'
                          }`}
                          style={{ fontFamily: '"Courier New", monospace' }}
                        >
                          {cuisine}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Price Range Filter - only for dishes */}
                  {rankingView === 'dishes' && (
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 text-gray-700" style={{ fontFamily: '"Courier New", monospace' }}>
                        price range
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedPriceRange('all')}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                            selectedPriceRange === 'all'
                              ? 'bg-[#33a29b] text-white'
                              : 'bg-white text-gray-700 hover:bg-gray-100'
                          }`}
                          style={{ fontFamily: '"Courier New", monospace' }}
                        >
                          all
                        </button>
                        <button
                          onClick={() => setSelectedPriceRange('low')}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                            selectedPriceRange === 'low'
                              ? 'bg-[#33a29b] text-white'
                              : 'bg-white text-gray-700 hover:bg-gray-100'
                          }`}
                          style={{ fontFamily: '"Courier New", monospace' }}
                        >
                          $ (under $10)
                        </button>
                        <button
                          onClick={() => setSelectedPriceRange('medium')}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                            selectedPriceRange === 'medium'
                              ? 'bg-[#33a29b] text-white'
                              : 'bg-white text-gray-700 hover:bg-gray-100'
                          }`}
                          style={{ fontFamily: '"Courier New", monospace' }}
                        >
                          $$ ($10-$20)
                        </button>
                        <button
                          onClick={() => setSelectedPriceRange('high')}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                            selectedPriceRange === 'high'
                              ? 'bg-[#33a29b] text-white'
                              : 'bg-white text-gray-700 hover:bg-gray-100'
                          }`}
                          style={{ fontFamily: '"Courier New", monospace' }}
                        >
                          $$$ ($20+)
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Rating Filter */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-gray-700" style={{ fontFamily: '"Courier New", monospace' }}>
                      minimum rating
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedRating('all')}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                          selectedRating === 'all'
                            ? 'bg-[#33a29b] text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                        style={{ fontFamily: '"Courier New", monospace' }}
                      >
                        all
                      </button>
                      <button
                        onClick={() => setSelectedRating('90')}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                          selectedRating === '90'
                            ? 'bg-[#33a29b] text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                        style={{ fontFamily: '"Courier New", monospace' }}
                      >
                        90+
                      </button>
                      <button
                        onClick={() => setSelectedRating('80')}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                          selectedRating === '80'
                            ? 'bg-[#33a29b] text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                        style={{ fontFamily: '"Courier New", monospace' }}
                      >
                        80+
                      </button>
                      <button
                        onClick={() => setSelectedRating('70')}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                          selectedRating === '70'
                            ? 'bg-[#33a29b] text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                        style={{ fontFamily: '"Courier New", monospace' }}
                      >
                        70+
                      </button>
                    </div>
                  </div>
                  
                  {/* Clear Filters Button */}
                  {(selectedCuisine !== 'all' || selectedPriceRange !== 'all' || selectedRating !== 'all' || selectedTagFilters.length > 0) && (
                    <button
                      onClick={() => {
                        setSelectedCuisine('all');
                        setSelectedPriceRange('all');
                        setSelectedRating('all');
                        setSelectedTagFilters([]);
                      }}
                      className="text-xs text-gray-600 hover:text-[#33a29b] font-semibold transition"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    >
                      clear all filters
                    </button>
                  )}
                  
                  {/* Tag Categories - Collapsible */}
                  <div className="mt-3">
                    <div className="flex flex-wrap gap-2">
                      {['dietary', 'experience', 'meal_time', 'practical', 'special'].map(category => {
                        const isExpanded = expandedTagCategories.includes(category);
                        const categoryTags = allTags.filter(t => t.category === category);
                        const selectedCount = categoryTags.filter(t => selectedTagFilters.includes(t.id)).length;
                        
                        const categoryLabels = {
                          dietary: '🥗 Dietary',
                          experience: '✨ Experience',
                          meal_time: '🍽️ Meal Time',
                          practical: '🔧 Practical',
                          special: '⭐ Special'
                        };
                        
                        return (
                          <div key={category} className="w-full">
                            <button
                              onClick={() => {
                                setExpandedTagCategories(prev =>
                                  prev.includes(category)
                                    ? prev.filter(c => c !== category)
                                    : [...prev, category]
                                );
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                selectedCount > 0
                                  ? 'bg-[#33a29b] text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                              style={{ fontFamily: '"Courier New", monospace' }}
                            >
                              {categoryLabels[category]} {selectedCount > 0 && `(${selectedCount})`}
                            </button>
                            
                            {isExpanded && (
                              <div className="mt-2 ml-4 flex flex-wrap gap-1.5">
                                {categoryTags.map(tag => (
                                  <button
                                    key={tag.id}
                                    onClick={() => {
                                      setSelectedTagFilters(prev =>
                                        prev.includes(tag.id)
                                          ? prev.filter(id => id !== tag.id)
                                          : [...prev, tag.id]
                                      );
                                    }}
                                    className={`px-2 py-1 rounded text-xs transition ${
                                      selectedTagFilters.includes(tag.id)
                                        ? 'bg-[#33a29b] text-white'
                                        : 'bg-white border border-gray-200 text-gray-700 hover:border-[#33a29b]'
                                    }`}
                                    style={{ fontFamily: '"Courier New", monospace' }}
                                  >
                                    {tag.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    {selectedTagFilters.length > 0 && (
                      <button
                        onClick={() => {
                          setSelectedTagFilters([]);
                          setExpandedTagCategories([]);
                        }}
                        className="mt-2 text-xs text-gray-600 hover:text-[#33a29b] font-semibold transition"
                        style={{ fontFamily: '"Courier New", monospace' }}
                      >
                        clear all tags
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="max-w-4xl mx-auto p-4">
              {rankingView === 'dishes' && (
                <>
                  {allDishes.length === 0 ? (
                    <EmptyState
                      icon={TrendingUp}
                      title="no dishes rated yet"
                      message="Be the first to rate a dish and set the standard!"
                      actionText="rate now"
                      onAction={() => setIsSubmissionModalOpen(true)}
                    />
                  ) : (
                    <div className="space-y-2">
                      {getFilteredDishes().map((dish, idx) => {                        return (
                          <div key={idx} className="bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition cursor-pointer stagger-item" onClick={() => setSelectedDish(dish)}>
                            <div className="flex items-center gap-3">
                              <div className="w-8 text-center text-lg font-bold text-gray-400">#{idx + 1}</div>
                              <div className="flex-1">
                                <div className="font-semibold text-sm">{dish.name}</div>
                                <div className="text-xs text-gray-500">{dish.restaurantName} • {dish.cuisine} • ${dish.price.toFixed(2)}</div>
                              </div>
                              {/* Tag circles */}
                              <div className="flex gap-1">
                                {(dishTags[dish.id] || []).slice(0, 3).map(tag => {
                                  const tagData = allTags.find(t => t.id === tag.tag_id);
                                  if (!tagData) return null;
                                  return (
                                    <div
                                      key={tag.tag_id}
                                      className="w-4 h-4 rounded-full"
                                      style={{ backgroundColor: tagData.color }}
                                      title={tagData.name}
                                    />
                                  );
                                })}
                              </div>                              <div className={`text-2xl font-bold ${getSRRColor(dish.srr)} ${dish.srr >= 90 ? 'score-shine' : ''}`}>{typeof dish.srr === "number" ? dish.srr.toFixed(2) : dish.srr}</div>
                              <div className="text-[10px] text-gray-500 text-center mt-0.5" style={{ fontFamily: '"Courier New", monospace' }}>
                                {dish.numRatings} rating{dish.numRatings !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {rankingView === 'restaurants' && (
                <div className="space-y-2">
                  {getFilteredRestaurants().sort((a, b) => b.avgSRR - a.avgSRR).map((restaurant, idx) => {                    return (
                      <div key={idx} className="bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition cursor-pointer stagger-item" onClick={() => setSelectedRestaurant(restaurant)}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 text-center text-lg font-bold text-gray-400">#{idx + 1}</div>
                          <div className="flex-1">
                            <div className="font-semibold text-sm">{restaurant.name}</div>
                            <div className="text-xs text-gray-500">{restaurant.cuisine}</div>
                          </div>                          <div className={`text-2xl font-bold ${getSRRColor(restaurant.avgSRR)} ${restaurant.avgSRR >= 90 ? 'score-shine' : ''}`}>{typeof restaurant.avgSRR === "number" ? restaurant.avgSRR.toFixed(2) : restaurant.avgSRR}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {rankingView === 'groups' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold">group rankings</h2>
                    <button
                      onClick={() => setIsCreateGroupModalOpen(true)}
                      className="px-3 py-1.5 bg-[#33a29b] text-black rounded-lg text-sm font-semibold hover:bg-[#2a8a84] transition flex items-center gap-1"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    >
                      <Plus size={16} />
                      create
                    </button>
                  </div>
                  
                  {groupsLoading ? (
                    <LoadingSpinner />
                  ) : userGroups.length === 0 ? (
                    <EmptyState
                      icon={Users}
                      title="No groups yet"
                      message="Create or join a group to see rankings"
                      actionLabel="Create Group"
                      onAction={() => setIsCreateGroupModalOpen(true)}
                    />
                  ) : (
                    userGroups.map((group, idx) => (
                      <GroupCard
                        key={group.id}
                        group={group}
                        onClick={() => setSelectedGroup(group)}
                        isUserMember={true}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* EXPLORE TAB */}
        {activeTab === 'explore' && (
          <div>
            {/* Top-level tabs */}
            <div className="bg-white border-b px-4 py-2 flex gap-2 items-center justify-between">
              <div className="flex gap-2">
                <button onClick={() => setExploreView('for-you')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${exploreView === 'for-you' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`} style={{ fontFamily: '"Courier New", monospace' }}>for you</button>
                <button onClick={() => setExploreView('activity')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${exploreView === 'activity' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`} style={{ fontFamily: '"Courier New", monospace' }}>activity</button>
                <button onClick={() => setExploreView('people')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${exploreView === 'people' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`} style={{ fontFamily: '"Courier New", monospace' }}>people</button>
                <button onClick={() => setExploreView('groups')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${exploreView === 'groups' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`} style={{ fontFamily: '"Courier New", monospace' }}>groups</button>
              </div>
              {/* Near me toggle */}
              <button
                onClick={() => setExploreNearMe(v => !v)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition ${exploreNearMe ? 'bg-[#33a29b] text-white' : 'bg-gray-100 text-gray-600'}`}
                style={{ fontFamily: '"Courier New", monospace' }}
              >
                <MapPin size={12} />
                {exploreNearMe ? 'near me' : 'everywhere'}
              </button>
            </div>

            <div className="max-w-4xl mx-auto p-4">

              {/* FOR YOU TAB */}
              {exploreView === 'for-you' && (() => {
                // Get dishes I've already rated
                const myRatedDishIds = new Set(userRatings.map(r => r.dish_id));

                // Get all other users' ratings for dishes I haven't rated
                const otherRatings = allRatings.filter(r =>
                  !r.is_deleted &&
                  (!user || r.user_id !== user.id) &&
                  !myRatedDishIds.has(r.dish_id)
                );

                // Group by dish and compute avg score
                const dishScoreMap = {};
                otherRatings.forEach(r => {
                  if (!dishScoreMap[r.dish_id]) {
                    dishScoreMap[r.dish_id] = { scores: [], rating: r };
                  }
                  const computedSrr = r.overall_score
                    ? parseFloat(r.overall_score)
                    : (r.taste_score != null && r.portion_score != null && r.price_score != null)
                      ? (r.taste_score + r.portion_score + r.price_score) / 3
                      : null;
                  if (computedSrr != null) dishScoreMap[r.dish_id].scores.push(computedSrr);
                });

                const communityDishes = Object.entries(dishScoreMap).map(([dishId, val]) => {
                  const avg = val.scores.reduce((a, b) => a + b, 0) / val.scores.length;
                  const dish = allDishes.find(d => d.id === dishId) || val.rating.dish;
                  return { ...dish, communityScore: avg, ratingCount: val.scores.length };
                }).sort((a, b) => b.communityScore - a.communityScore);

                // Recommended = from people you follow, else fall back to community
                const followingIdSet = new Set(userFollows.map(f => f.id));
                const friendRatings = allRatings.filter(r =>
                  !r.is_deleted &&
                  followingIdSet.has(r.user_id) &&
                  !myRatedDishIds.has(r.dish_id)
                );
                const friendDishMap = {};
                friendRatings.forEach(r => {
                  if (!friendDishMap[r.dish_id]) friendDishMap[r.dish_id] = { scores: [], rating: r };
                  const computedSrr = r.overall_score
                    ? parseFloat(r.overall_score)
                    : (r.taste_score != null && r.portion_score != null && r.price_score != null)
                      ? (r.taste_score + r.portion_score + r.price_score) / 3
                      : null;
                  if (computedSrr != null) friendDishMap[r.dish_id].scores.push(computedSrr);
                });
                const recommendedDishes = Object.entries(friendDishMap).map(([dishId, val]) => {
                  const avg = val.scores.reduce((a, b) => a + b, 0) / val.scores.length;
                  const dish = allDishes.find(d => d.id === dishId) || val.rating.dish;
                  return { ...dish, communityScore: avg, ratingCount: val.scores.length };
                }).sort((a, b) => b.communityScore - a.communityScore);

                // If no friend recs, fall back to community for recommended tab too
                const finalRecommended = recommendedDishes.length > 0 ? recommendedDishes : communityDishes;

                const renderDishCard = (dish, idx) => (
                  <div
                    key={dish.id || idx}
                    onClick={() => setSelectedDish(dish)}
                    className="bg-white rounded-xl p-3 shadow-sm cursor-pointer hover:shadow-md transition flex items-center gap-3"
                  >
                    <div className="w-7 text-center text-sm font-bold text-gray-400" style={{ fontFamily: '"Courier New", monospace' }}>#{idx + 1}</div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm truncate" style={{ fontFamily: '"Courier New", monospace' }}>{dish.name}</h4>
                      <p className="text-xs text-gray-500 truncate" style={{ fontFamily: '"Courier New", monospace' }}>
                        {dish.restaurantName || dish.restaurant_name} • {dish.cuisine || dish.category}
                        {dish.price ? ` • $${parseFloat(dish.price).toFixed(2)}` : ''}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5" style={{ fontFamily: '"Courier New", monospace' }}>
                        {dish.ratingCount} {dish.ratingCount === 1 ? 'rating' : 'ratings'} from community
                      </p>
                    </div>
                    <div className={`text-xl font-bold ${getSRRColor(dish.communityScore)}`} style={{ fontFamily: '"Courier New", monospace' }}>
                      {dish.communityScore?.toFixed(2)}
                    </div>
                  </div>
                );

                return (
                  <>
                    {/* For You subtabs */}
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => setExploreForYouTab('recommended')}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition ${exploreForYouTab === 'recommended' ? 'bg-[#33a29b] text-white' : 'bg-gray-100 text-gray-600'}`}
                        style={{ fontFamily: '"Courier New", monospace' }}
                      >recommended</button>
                      <button
                        onClick={() => setExploreForYouTab('community')}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition ${exploreForYouTab === 'community' ? 'bg-[#33a29b] text-white' : 'bg-gray-100 text-gray-600'}`}
                        style={{ fontFamily: '"Courier New", monospace' }}
                      >community</button>
                    </div>

                    {exploreForYouTab === 'recommended' && (
                      <div className="space-y-2">
                        {recommendedDishes.length === 0 && (
                          <p className="text-xs text-gray-400 mb-3 italic" style={{ fontFamily: '"Courier New", monospace' }}>
                            no friend recommendations yet — showing top community dishes
                          </p>
                        )}
                        {finalRecommended.length === 0 ? (
                          <EmptyState icon={Compass} title="no dishes yet" message="No community ratings found" actionText="rate now" onAction={() => setIsSubmissionModalOpen(true)} />
                        ) : (
                          finalRecommended.map((dish, idx) => renderDishCard(dish, idx))
                        )}
                      </div>
                    )}

                    {exploreForYouTab === 'community' && (
                      <div className="space-y-2">
                        {communityDishes.length === 0 ? (
                          <EmptyState icon={Compass} title="no community ratings yet" message="Be the first to rate dishes!" actionText="rate now" onAction={() => setIsSubmissionModalOpen(true)} />
                        ) : (
                          communityDishes.map((dish, idx) => renderDishCard(dish, idx))
                        )}
                      </div>
                    )}
                  </>
                );
              })()}

              {/* ACTIVITY TAB - global feed */}
              {exploreView === 'activity' && (() => {
                // Color + icon config per type
                const activityStyle = (item) => {
                  if (item.isOwn) return { bg: 'bg-green-50', dot: 'bg-green-400', label: 'you' };
                  if (item.activity_type === 'group_rating' || item.activity_type === 'group_join') return { bg: 'bg-[#33a29b]/5', dot: 'bg-[#33a29b]', label: 'group' };
                  if (item.activity_type === 'follow') return { bg: 'bg-red-50', dot: 'bg-red-300', label: 'follow' };
                  if (item.activity_type === 'like') return { bg: 'bg-pink-50', dot: 'bg-pink-400', label: 'like' };
                  if (item.activity_type === 'new_user') return { bg: 'bg-gray-50', dot: 'bg-gray-300', label: 'new' };
                  if (item.isFollowing) return { bg: 'bg-yellow-50', dot: 'bg-yellow-400', label: 'following' };
                  return { bg: 'bg-white', dot: 'bg-gray-200', label: '' };
                };

                const feed = exploreActivityNearMe
                  ? globalActivityFeed.filter(item => {
                      const r = item._rawRating;
                      if (!userLocation || !r) return false;
                      const lat = r.dish?.latitude || r.latitude;
                      const lng = r.dish?.longitude || r.longitude;
                      if (!lat || !lng) return false;
                      const dist = Math.sqrt(Math.pow(lat - userLocation.lat, 2) + Math.pow(lng - userLocation.lng, 2)) * 111;
                      return dist < 25;
                    })
                  : globalActivityFeed;

                return (
                  <div className="space-y-2">
                    {/* Near me toggle */}
                    <div className="flex justify-end mb-1">
                      <button
                        onClick={() => setExploreActivityNearMe(v => !v)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition ${exploreActivityNearMe ? 'bg-[#33a29b] text-white' : 'bg-gray-100 text-gray-600'}`}
                        style={{ fontFamily: '"Courier New", monospace' }}
                      >
                        <MapPin size={11} />
                        {exploreActivityNearMe ? 'near me' : 'everywhere'}
                      </button>
                    </div>

                    {/* Color legend */}
                    <div className="flex flex-wrap gap-2 mb-2">
                      {[
                        { color: 'bg-green-400', label: 'you' },
                        { color: 'bg-yellow-400', label: 'following' },
                        { color: 'bg-[#33a29b]', label: 'groups' },
                        { color: 'bg-red-300', label: 'follow' },
                        { color: 'bg-pink-400', label: 'like' },
                        { color: 'bg-gray-300', label: 'new user' },
                      ].map(({ color, label }) => (
                        <div key={label} className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${color}`} />
                          <span className="text-[10px] text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>{label}</span>
                        </div>
                      ))}
                    </div>

                    {globalActivityLoading ? (
                      <LoadingSpinner />
                    ) : feed.length === 0 ? (
                      <EmptyState icon={Activity} title="no activity yet" message="Be the first to rate something!" actionText="rate now" onAction={() => setIsSubmissionModalOpen(true)} />
                    ) : (
                      feed.map(item => {
                        const style = activityStyle(item);
                        const likes = ratingLikes[item.rating_id] || { count: 0, likedByMe: false, users: [] };
                        return (
                          <div
                            key={item.id}
                            className={`${style.bg} rounded-xl p-3 shadow-sm cursor-pointer hover:shadow-md transition border border-transparent`}
                            onClick={() => {
                              if (item.activity_type === 'rating' || item.activity_type === 'group_rating') {
                                const dish = allDishes.find(d => d.id === item._rawRating?.dish_id);
                                if (dish) setSelectedDish(dish);
                              }
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <div className="relative flex-shrink-0">
                                <div className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-xs font-bold text-gray-600">
                                  {(item.username || '?')[0].toUpperCase()}
                                </div>
                                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-white ${style.dot}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm" style={{ fontFamily: '"Courier New", monospace' }}>
                                  @{item.username}
                                </div>
                                <div className="text-xs text-gray-600 mt-0.5" style={{ fontFamily: '"Courier New", monospace' }}>
                                  {(item.activity_type === 'rating' || item.activity_type === 'group_rating') && (
                                    <span>rated <span className="font-semibold">{item.content.dish_name}</span> {item.content.score != null && <span className={`font-bold ${getSRRColor(item.content.score)}`}>({typeof item.content.score === 'number' ? item.content.score.toFixed(1) : item.content.score})</span>}</span>
                                  )}
                                  {item.activity_type === 'follow' && `followed @${item.content.following_username}`}
                                  {item.activity_type === 'new_user' && 'joined hunters finds'}
                                  {item.activity_type === 'like' && `liked a rating`}
                                </div>
                                {item.content?.comment && (
                                  <div className="text-[10px] text-gray-500 mt-0.5 italic truncate" style={{ fontFamily: '"Courier New", monospace' }}>"{item.content.comment}"</div>
                                )}
                                <div className="text-[10px] text-gray-400 mt-0.5" style={{ fontFamily: '"Courier New", monospace' }}>
                                  {(() => {
                                    const h = Math.floor(item.hoursAgo);
                                    if (h < 1) return 'just now';
                                    if (h < 24) return `${h}h ago`;
                                    return `${Math.floor(h / 24)}d ago`;
                                  })()}
                                </div>
                              </div>
                              {(item.activity_type === 'rating' || item.activity_type === 'group_rating') && item.rating_id && (
                                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                                  <button onClick={(e) => handleToggleLike(item.rating_id, e)} className={`transition ${likes.likedByMe ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}`}>
                                    <Heart size={15} className={likes.likedByMe ? 'fill-current' : ''} />
                                  </button>
                                  {likes.count > 0 && (
                                    <button onClick={(e) => { e.stopPropagation(); setLikesModalRatingId(item.rating_id); }} className="text-[10px] text-gray-500 hover:text-[#33a29b]" style={{ fontFamily: '"Courier New", monospace' }}>
                                      {likes.count}
                                    </button>
                                  )}
                                  <button onClick={(e) => handleToggleComments(item.rating_id, e)} className={`transition mt-0.5 ${expandedComments.has(item.rating_id) ? 'text-[#33a29b]' : 'text-gray-300 hover:text-[#33a29b]'}`}>
                                    <MessageSquare size={15} />
                                  </button>
                                  {(ratingComments[item.rating_id]?.comments?.filter(c => !c.parent_id).length || 0) > 0 && (
                                    <span className="text-[10px] text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>
                                      {ratingComments[item.rating_id].comments.filter(c => !c.parent_id).length}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Inline comment thread */}
                          {(item.activity_type === 'rating' || item.activity_type === 'group_rating') && item.rating_id && expandedComments.has(item.rating_id) && (
                            renderCommentThread(item.rating_id, item.content?.comment, item.username, style.bg)
                          )}
                        </div>
                      );
                      })
                    )}
                  </div>
                );
              })()}

              {/* PEOPLE TAB */}
              {exploreView === 'people' && (
                <div className="space-y-3">
                  {allUsersLoading ? (
                    <LoadingSpinner />
                  ) : allUsers.length === 0 ? (
                    <EmptyState icon={Users} title="no other users yet" message="Invite friends to join hunters finds!" />
                  ) : (
                    allUsers.map(u => (
                      <div
                        key={u.id}
                        className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3 cursor-pointer hover:shadow-md transition"
                        onClick={() => setSelectedExploreUser(u)}
                      >
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#33a29b] to-[#2a8a84] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {(u.username || u.email || '?')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm truncate" style={{ fontFamily: '"Courier New", monospace' }}>
                            @{u.username || u.email?.split('@')[0]}
                          </div>
                          <div className="text-[10px] text-gray-500 flex gap-2 mt-0.5" style={{ fontFamily: '"Courier New", monospace' }}>
                            <span>{u.ratingsCount} ratings</span>
                            {u.dishOverlap > 0 && <span className="text-[#33a29b]">• {u.dishOverlap} dishes in common</span>}
                            {u.restaurantOverlap > 0 && <span className="text-[#33a29b]">• {u.restaurantOverlap} restaurants in common</span>}
                          </div>
                        </div>
                        {user && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await handleFollowUser(u);
                              setAllUsers(prev => prev.map(p => p.id === u.id ? { ...p, isFollowing: !p.isFollowing } : p));
                            }}
                            className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition ${u.isFollowing ? 'bg-gray-200 text-gray-700 hover:bg-red-100 hover:text-red-600' : 'bg-[#33a29b] text-white hover:bg-[#2a8a84]'}`}
                            style={{ fontFamily: '"Courier New", monospace' }}
                          >
                            {u.isFollowing ? 'following' : 'follow'}
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* GROUPS TAB */}
              {exploreView === 'groups' && (
                <div className="space-y-3">
                  <h2 className="text-lg font-bold mb-4" style={{ fontFamily: '"Courier New", monospace' }}>explore groups</h2>
                  {groupsLoading ? (
                    <LoadingSpinner />
                  ) : allGroups.length === 0 ? (
                    <EmptyState
                      icon={Users}
                      title="No public groups yet"
                      message="Be the first to create a group!"
                      actionLabel="Create Group"
                      onAction={() => setIsCreateGroupModalOpen(true)}
                    />
                  ) : (
                    allGroups.map(group => {
                      const isUserMember = userGroups.some(ug => ug.id === group.id);
                      return (
                        <GroupCard
                          key={group.id}
                          group={group}
                          onClick={() => setSelectedGroup(group)}
                          isUserMember={isUserMember}
                        />
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* User Profile Modal */}
            {selectedExploreUser && (() => {
              const u = selectedExploreUser;
              const theirRatings = allRatings.filter(r => r.user_id === u.id && !r.is_deleted);
              const topDishes = [...theirRatings].sort((a, b) => (b.srr || 0) - (a.srr || 0)).slice(0, 5);
              const avgScore = theirRatings.length > 0 ? theirRatings.reduce((s, r) => s + (r.srr || 0), 0) / theirRatings.length : 0;
              const categories = theirRatings.map(r => r.dish?.category || r.category).filter(Boolean);
              const favCategory = categories.length > 0
                ? Object.entries(categories.reduce((acc, c) => { acc[c] = (acc[c] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1])[0][0]
                : null;

              return (
                <>
                  <div onClick={() => setSelectedExploreUser(null)} className="fixed inset-0 bg-black/40 z-[46]" />
                  <div className="fixed z-[47] bg-white rounded-2xl shadow-xl flex flex-col"
                    style={{ top: '10%', left: '50%', transform: 'translateX(-50%)', width: 'min(92vw, 500px)', maxHeight: '80vh' }}>
                    <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between rounded-t-2xl flex-shrink-0">
                      <h2 className="font-bold text-base" style={{ fontFamily: '"Courier New", monospace' }}>
                        @{u.username || u.email?.split('@')[0]}
                      </h2>
                      <button onClick={() => setSelectedExploreUser(null)}><X size={20} /></button>
                    </div>
                    <div className="overflow-y-auto p-4 space-y-4">
                      {/* Stats row */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-gray-50 rounded-lg p-2">
                          <div className="text-lg font-bold" style={{ fontFamily: '"Courier New", monospace' }}>{theirRatings.length}</div>
                          <div className="text-[10px] text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>ratings</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <div className={`text-lg font-bold ${getSRRColor(avgScore)}`} style={{ fontFamily: '"Courier New", monospace' }}>{avgScore.toFixed(1)}</div>
                          <div className="text-[10px] text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>avg score</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <div className="text-lg font-bold truncate" style={{ fontFamily: '"Courier New", monospace' }}>{favCategory || '—'}</div>
                          <div className="text-[10px] text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>fav category</div>
                        </div>
                      </div>

                      {/* Overlap */}
                      {(u.dishOverlap > 0 || u.restaurantOverlap > 0) && (
                        <div className="bg-[#33a29b]/10 rounded-lg p-2 text-xs text-[#33a29b]" style={{ fontFamily: '"Courier New", monospace' }}>
                          you share {u.dishOverlap} dishes and {u.restaurantOverlap} restaurants in common
                        </div>
                      )}

                      {/* Top dishes */}
                      <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2" style={{ fontFamily: '"Courier New", monospace' }}>top dishes</h3>
                        {topDishes.length === 0 ? (
                          <p className="text-xs text-gray-400 italic" style={{ fontFamily: '"Courier New", monospace' }}>no ratings yet</p>
                        ) : (
                          <div className="space-y-2">
                            {topDishes.map((r, idx) => (
                              <div key={r.id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                                <span className="text-xs text-gray-400 w-5" style={{ fontFamily: '"Courier New", monospace' }}>#{idx + 1}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-bold truncate" style={{ fontFamily: '"Courier New", monospace' }}>{r.dish?.name || r.dish_name}</div>
                                  <div className="text-[10px] text-gray-500 truncate" style={{ fontFamily: '"Courier New", monospace' }}>{r.dish?.restaurant_name || r.restaurant_name}</div>
                                </div>
                                <div className={`text-sm font-bold ${getSRRColor(r.srr)}`} style={{ fontFamily: '"Courier New", monospace' }}>{r.srr?.toFixed(2)}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Follow button */}
                      {user && (
                        <button
                          onClick={async () => {
                            await handleFollowUser(u);
                            setSelectedExploreUser(prev => ({ ...prev, isFollowing: !prev.isFollowing }));
                            setAllUsers(prev => prev.map(p => p.id === u.id ? { ...p, isFollowing: !p.isFollowing } : p));
                          }}
                          className={`w-full py-2 rounded-lg text-sm font-bold transition ${u.isFollowing ? 'bg-gray-200 text-gray-700 hover:bg-red-100 hover:text-red-600' : 'bg-[#33a29b] text-white hover:bg-[#2a8a84]'}`}
                          style={{ fontFamily: '"Courier New", monospace' }}
                        >
                          {u.isFollowing ? 'unfollow' : 'follow'}
                        </button>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* YOU TAB */}
        {activeTab === 'you' && (
          <div>
            <div className="bg-white border-b px-4 py-2 flex gap-2 overflow-x-auto">
              
              {!user && (
                <button 
                  onClick={() => setYouView('login')} 
                  className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap font-medium transition relative ${
                    youView === 'login' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`} 
                  style={{ fontFamily: '"Courier New", monospace' }}
                >
                  <User size={18} className="opacity-70" />
                </button>
              )}
              <button 
                onClick={() => setYouView('profile')} 
                disabled={!user}
                className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap font-medium transition relative ${
                  youView === 'profile' 
                    ? 'bg-gray-700 text-white' 
                    : !user
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`} 
                style={{ fontFamily: '"Courier New", monospace' }}
              >
                <User size={18} />
                {!user && <Lock size={10} className="absolute top-1 right-1 text-gray-500" />}
              </button>
              <button 
                onClick={() => setYouView('ratings')} 
                disabled={!user}
                className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap font-medium transition relative ${
                  youView === 'ratings' 
                    ? 'bg-gray-700 text-white' 
                    : !user
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`} 
                style={{ fontFamily: '"Courier New", monospace' }}
              >
                <Star size={18} />
                {!user && <Lock size={10} className="absolute top-1 right-1 text-gray-500" />}
              </button>
              <button 
                onClick={() => setYouView('groups')} 
                disabled={!user}
                className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap font-medium transition relative ${
                  youView === 'groups' 
                    ? 'bg-gray-700 text-white' 
                    : !user
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`} 
                style={{ fontFamily: '"Courier New", monospace' }}
              >
                <Users size={18} />
                {!user && <Lock size={10} className="absolute top-1 right-1 text-gray-500" />}
              </button>
              <button 
                onClick={() => setYouView('saved')} 
                disabled={!user}
                className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap font-medium transition relative ${
                  youView === 'saved' 
                    ? 'bg-gray-700 text-white' 
                    : !user
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`} 
                style={{ fontFamily: '"Courier New", monospace' }}
              >
                <Bookmark size={18} />
                {!user && <Lock size={10} className="absolute top-1 right-1 text-gray-500" />}
              </button>
              <button 
                onClick={() => setYouView('lists')} 
                disabled={!user}
                className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap font-medium transition relative ${
                  youView === 'lists' 
                    ? 'bg-gray-700 text-white' 
                    : !user
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`} 
                style={{ fontFamily: '"Courier New", monospace' }}
              >
                <List size={18} />
                {!user && <Lock size={10} className="absolute top-1 right-1 text-gray-500" />}
              </button>
              <button 
                onClick={() => setYouView('people')} 
                disabled={!user}
                className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap font-medium transition relative ${
                  youView === 'people' 
                    ? 'bg-gray-700 text-white' 
                    : !user
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`} 
                style={{ fontFamily: '"Courier New", monospace' }}
              >
                <UserPlus size={18} />
                {!user && <Lock size={10} className="absolute top-1 right-1 text-gray-500" />}
              </button>
              <button 
                onClick={() => setYouView('activity')} 
                disabled={!user}
                className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap font-medium transition relative ${
                  youView === 'activity' 
                    ? 'bg-gray-700 text-white' 
                    : !user
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`} 
                style={{ fontFamily: '"Courier New", monospace' }}
              >
                <Activity size={18} />
                {unreadNotificationsCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </div>
                )}
                {!user && <Lock size={10} className="absolute top-1 right-1 text-gray-500" />}
              </button>
              <button onClick={() => setYouView('settings')} className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap font-medium transition ${youView === 'settings' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`} style={{ fontFamily: '"Courier New", monospace' }}>
                <Settings size={18} />
              </button>
            </div>

            <div className="max-w-4xl mx-auto p-4">
              {youView === 'login' && !user && (
                <div className="space-y-4 max-w-md mx-auto">
                  <h3 className="text-lg font-bold mb-4" style={{ fontFamily: '"Courier New", monospace' }}>
                    {authMode === 'signin' ? 'sign in' : 'create account'}
                  </h3>
                  
                  <div className="bg-white rounded-lg p-6 shadow-sm space-y-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2" style={{ fontFamily: '"Courier New", monospace' }}>
                        email
                      </label>
                      <input
                        type="email"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#33a29b]"
                        style={{ fontFamily: '"Courier New", monospace' }}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold mb-2" style={{ fontFamily: '"Courier New", monospace' }}>
                        password
                      </label>
                      <input
                        type="password"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#33a29b]"
                        style={{ fontFamily: '"Courier New", monospace' }}
                      />
                    </div>
                    
                    {/* Forgot Password Link */}
                    {authMode === 'signin' && (
                      <div className="text-right">
                        <button
                          onClick={() => setShowPasswordReset(true)}
                          className="text-sm text-blue-600 hover:text-blue-700"
                          style={{ fontFamily: '"Courier New", monospace' }}
                        >
                          forgot password?
                        </button>
                      </div>
                    )}
                    
                    {authError && (
                      <p className="text-sm text-red-500" style={{ fontFamily: '"Courier New", monospace' }}>
                        {authError}
                      </p>
                    )}
                    
                    <button
                      onClick={async () => {
                        setAuthFormLoading(true);
                        const result = authMode === 'signin' 
                          ? await signInWithEmail(authEmail, authPassword)
                          : await signUpWithEmail(authEmail, authPassword);
                        
                        setAuthFormLoading(false);
                        if (result.data && !result.error) {
                          setYouView('profile');
                          setAuthEmail('');
                          setAuthPassword('');
                        }
                      }}
                      disabled={authFormLoading || !authEmail || !authPassword}
                      className="w-full bg-[#33a29b] text-white py-3 rounded-lg font-bold hover:bg-[#2a8a84] transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    >
                      {authFormLoading ? 'loading...' : (authMode === 'signin' ? 'sign in' : 'sign up')}
                    </button>
                    
                    {/* OR Divider */}
                    <div className="flex items-center my-4">
                      <div className="flex-1 border-t border-gray-300"></div>
                      <span className="px-4 text-xs text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>
                        or continue with
                      </span>
                      <div className="flex-1 border-t border-gray-300"></div>
                    </div>
                    
                    {/* Google Login Button */}
                    <button
                      onClick={handleGoogleLogin}
                      className="w-full py-3 bg-white border-2 border-gray-300 rounded-lg flex items-center justify-center gap-3 hover:bg-gray-50 transition"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      <span className="font-medium text-sm">Continue with Google</span>
                    </button>
                    
                    <button
                      onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                      className="w-full text-sm text-gray-600 hover:text-[#33a29b] transition mt-4"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    >
                      {authMode === 'signin' ? "don't have an account? sign up" : 'already have an account? sign in'}
                    </button>
                  </div>
                </div>
              )}

              {youView === 'profile' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="flex justify-between mb-3">
                      <h2 className="text-xl font-bold">@{user?.user_metadata?.username || user?.email?.split('@')[0] || 'user'}</h2>
                      <button 
                        onClick={() => {
                          setEditUsername(user?.user_metadata?.username || '');
                          setEditLocation(user?.user_metadata?.location || '');
                          setIsEditProfileModalOpen(true);
                        }}
                        className="text-sm text-[#33a29b] hover:text-[#2a8a84] font-semibold"
                        style={{ fontFamily: '"Courier New", monospace' }}
                      >
                        edit
                      </button>
                    </div>
                    <div className="flex gap-4 text-center py-3 border-t border-b">
                      <div className="flex-1">
                        <div className="font-bold" style={{ fontFamily: '"Courier New", monospace' }}>{userRatings?.length || 0}</div>
                        <div className="text-xs text-gray-600">ratings</div>
                      </div>
                      <div className="flex-1 border-l">
                        <div className="font-bold" style={{ fontFamily: '"Courier New", monospace' }}>0</div>
                        <div className="text-xs text-gray-600">friends</div>
                      </div>
                      <div className="flex-1 border-l">
                        <div className="font-bold" style={{ fontFamily: '"Courier New", monospace' }}>{userGroups?.length || 0}</div>
                        <div className="text-xs text-gray-600">groups</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <h3 className="text-sm font-semibold mb-3">your top rated</h3>
                    {allDishes.slice(0, 3).map((dish, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => setSelectedDish(dish)}
                        className="flex justify-between py-2 cursor-pointer hover:bg-gray-50 rounded transition"
                      >
                        <div>
                          <div className="text-sm font-medium">#{idx + 1} {dish.name}</div>
                          <div className="text-xs text-gray-500">{dish.restaurantName}</div>
                        </div>
                        <div className={`text-lg font-bold ${getSRRColor(dish.srr)}`}>{typeof dish.srr === "number" ? dish.srr.toFixed(2) : dish.srr}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {youView === 'ratings' && (
                <div className="space-y-3">
                  <h2 className="text-lg font-bold mb-4" style={{ fontFamily: '"Courier New", monospace' }}>your ratings</h2>
                  {allDishes.map((dish, idx) => (
                    <div 
                      key={idx} 
                      className="bg-white rounded-lg p-3 shadow-sm"
                    >
                      <div 
                        onClick={() => setSelectedDish(dish)}
                        className="cursor-pointer hover:bg-gray-50 -m-3 p-3 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Image size={24} className="text-gray-400" />
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-sm" style={{ fontFamily: '"Courier New", monospace' }}>{dish.name}</div>
                            <div className="text-xs text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>
                              {dish.restaurantName} • ${dish.price.toFixed(2)}
                              {dish.edited_at && (
                                <span className="text-gray-400 ml-2">(edited)</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 mt-1" style={{ fontFamily: '"Courier New", monospace' }}>rated 2 days ago</div>
                          </div>
                          <div className={`text-2xl font-bold ${getSRRColor(dish.srr)}`} style={{ fontFamily: '"Courier New", monospace' }}>{typeof dish.srr === "number" ? dish.srr.toFixed(2) : dish.srr}</div>
                        </div>
                      </div>
                      
                      {/* Edit/Delete Buttons */}
                      {user && canEditRating({user_id: user.id, created_at: dish.created_at || new Date().toISOString()}) && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditRating({
                                id: dish.id,
                                dish_name: dish.name,
                                dish: {name: dish.name},
                                restaurant_name: dish.restaurantName,
                                taste_score: dish.taste,
                                portion_score: dish.portion,
                                price_value_score: dish.priceValue,
                                price: dish.price,
                                comment: dish.comment || '',
                                created_at: dish.created_at,
                                edit_count: dish.edit_count || 0
                              });
                            }}
                            className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 border border-blue-200 font-medium"
                            style={{ fontFamily: '"Courier New", monospace' }}
                          >
                            Edit
                          </button>
                          
                          {canDeleteRating({user_id: user.id, created_at: dish.created_at || new Date().toISOString()}) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRating({
                                  id: dish.id,
                                  dish_name: dish.name,
                                  dish: {name: dish.name},
                                  restaurant_name: dish.restaurantName,
                                  user_id: user.id,
                                  taste_score: dish.taste,
                                  portion_score: dish.portion,
                                  price_value_score: dish.priceValue,
                                  price: dish.price,
                                  comment: dish.comment || '',
                                  created_at: dish.created_at
                                });
                              }}
                              className="px-3 py-1.5 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 border border-red-200 font-medium"
                              style={{ fontFamily: '"Courier New", monospace' }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {youView === 'groups' && (
                <div className="space-y-3">
                  <div className="flex justify-between mb-4">
                    <h2 className="text-lg font-bold" style={{ fontFamily: '"Courier New", monospace' }}>groups</h2>
                    <button 
                      onClick={() => setIsNewGroupModalOpen(true)}
                      className="text-sm text-[#33a29b] font-semibold hover:text-[#2a8a84]"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    >
                      + create group
                    </button>
                  </div>
                  
                  {user ? (
                    userGroups.length === 0 ? (
                      <EmptyState
                        icon={Users}
                        title="no groups yet"
                        message="Create or join a group to share rankings with friends!"
                        actionText="create group"
                        onAction={() => setIsNewGroupModalOpen(true)}
                      />
                    ) : (
                      <div className="space-y-2">
                        {userGroups.map(group => (
                          <div 
                            key={group.id} 
                            onClick={() => setSelectedGroup(group)}
                            className="bg-white rounded-lg p-4 shadow-sm cursor-pointer hover:shadow-md transition"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h3 className="font-bold text-sm" style={{ fontFamily: '"Courier New", monospace' }}>{group.name}</h3>
                                <p className="text-xs text-gray-500 mt-1" style={{ fontFamily: '"Courier New", monospace' }}>
                                  {group.member_count || 0} members
                                  {group.type === 'broadcast' && ' • broadcast channel'}
                                </p>
                              </div>
                              <div className="text-right">
                                <Users size={20} className="text-gray-400" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="bg-white rounded-lg p-6 shadow-sm text-center">
                      <p className="text-gray-600 mb-4" style={{ fontFamily: '"Courier New", monospace' }}>
                        Please log in to see your groups
                      </p>
                      <button
                        onClick={() => setYouView('login')}
                        className="bg-[#33a29b] text-white px-6 py-2 rounded-lg font-semibold hover:bg-[#2a8a84] transition"
                        style={{ fontFamily: '"Courier New", monospace' }}
                      >
                        go to login
                      </button>
                    </div>
                  )}
                </div>
              )}

              {youView === 'saved' && (
                <div className="space-y-3">
                  <h2 className="text-lg font-bold mb-4" style={{ fontFamily: '"Courier New", monospace' }}>saved items</h2>
                  {savedItems.length === 0 ? (
                    <div className="bg-white rounded-lg p-4 shadow-sm text-center text-gray-500">
                      <Bookmark size={48} className="mx-auto mb-2 text-gray-300" />
                      <p className="text-sm" style={{ fontFamily: '"Courier New", monospace' }}>no saved items yet</p>
                      <p className="text-xs mt-1" style={{ fontFamily: '"Courier New", monospace' }}>tap the bookmark icon on dishes or restaurants to save them here</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {savedItems.map((item, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => {
                            if (item.type === 'dish') {
                              setSelectedDish(item);
                            } else if (item.type === 'restaurant') {
                              setSelectedRestaurant(item);
                            }
                          }}
                          className="bg-white rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-bold text-sm" style={{ fontFamily: '"Courier New", monospace' }}>{item.name}</div>
                              <div className="text-xs text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>
                                {item.type === 'dish' ? `${item.restaurantName} • $${item.price.toFixed(2)}` : item.cuisine}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {item.srr && <div className={`text-xl font-bold ${getSRRColor(item.srr || item.avgSRR)}`} style={{ fontFamily: '"Courier New", monospace' }}>{item.srr || item.avgSRR}</div>}
                              {item.avgSRR && !item.srr && <div className={`text-xl font-bold ${getSRRColor(item.avgSRR)}`} style={{ fontFamily: '"Courier New", monospace' }}>{item.avgSRR}</div>}
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveItem(item, item.type);
                                }}
                                className="p-1 hover:bg-gray-100 rounded transition"
                              >
                                <Bookmark size={18} className="fill-[#33a29b] text-[#33a29b]" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {youView === 'lists' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold" style={{ fontFamily: '"Courier New", monospace' }}>my lists</h2>
                    <button
                      onClick={() => setIsNewListModalOpen(true)}
                      className="px-3 py-1.5 bg-[#33a29b] text-white text-sm rounded-lg font-semibold hover:bg-[#2a8a84] transition"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    >
                      + new list
                    </button>
                  </div>
                  
                  {user ? (
                    userLists.length === 0 ? (
                      <EmptyState
                        icon={List}
                        title="no lists yet"
                        message="Create your first list to organize dishes and restaurants!"
                        actionText="create list"
                        onAction={() => setIsNewListModalOpen(true)}
                      />
                    ) : (
                      <div className="space-y-2">
                        {userLists.map((list) => (
                          <div 
                            key={list.id}
                            className="bg-white rounded-lg p-4 shadow-sm cursor-pointer hover:shadow-md transition"
                            onClick={() => {
                              // TODO: Open list detail view
                              setErrorModal({
                                show: true,
                                title: list.name,
                                message: `This list has ${list.items?.length || 0} items`
                              });
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-bold text-sm" style={{ fontFamily: '"Courier New", monospace' }}>
                                  {list.name}
                                </div>
                                <div className="text-xs text-gray-500 mt-1" style={{ fontFamily: '"Courier New", monospace' }}>
                                  {list.items?.length || 0} items
                                  {list.is_shared && ' • shared'}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Users size={16} className="text-gray-400" />
                                <span className="text-xs text-gray-500">{list.collaborators?.length || 1}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="bg-white rounded-lg p-6 shadow-sm text-center">
                      <p className="text-gray-600 mb-4" style={{ fontFamily: '"Courier New", monospace' }}>
                        Please log in to see your lists
                      </p>
                      <button
                        onClick={() => setYouView('login')}
                        className="bg-[#33a29b] text-white px-6 py-2 rounded-lg font-semibold hover:bg-[#2a8a84] transition"
                        style={{ fontFamily: '"Courier New", monospace' }}
                      >
                        go to login
                      </button>
                    </div>
                  )}
                </div>
              )}

              {youView === 'people' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold" style={{ fontFamily: '"Courier New", monospace' }}>people</h2>
                  </div>

                  {/* Search bar */}
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                      type="text"
                      value={friendSearchQuery}
                      onChange={(e) => setFriendSearchQuery(e.target.value)}
                      onFocus={() => setShowFriendSearch(true)}
                      placeholder="find people by username..."
                      className="w-full pl-9 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#33a29b]"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    />
                    {showFriendSearch && friendSearchQuery.length >= 2 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                        {friendSearchResults.length > 0 ? (
                          <div className="p-2">
                            {friendSearchResults.map((foundUser) => (
                              <div key={foundUser.id} className="p-3 hover:bg-gray-50 rounded cursor-pointer transition border-b last:border-b-0">
                                <div className="flex items-center justify-between">
                                  <div className="font-bold text-sm" style={{ fontFamily: '"Courier New", monospace' }}>@{foundUser.username}</div>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleFollowUser(foundUser); setShowFriendSearch(false); setFriendSearchQuery(''); }}
                                    className="px-3 py-1 bg-[#33a29b] text-white text-xs rounded-lg font-semibold hover:bg-[#2a8a84] transition"
                                    style={{ fontFamily: '"Courier New", monospace' }}
                                  >follow</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 text-center text-gray-500 text-sm" style={{ fontFamily: '"Courier New", monospace' }}>no users found</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Following section */}
                  <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2" style={{ fontFamily: '"Courier New", monospace' }}>
                      following ({userFollows.length})
                    </h3>
                    {userFollows.length === 0 ? (
                      <div className="bg-gray-50 rounded-xl p-4 text-center">
                        <p className="text-sm text-gray-400" style={{ fontFamily: '"Courier New", monospace' }}>you're not following anyone yet</p>
                        <button onClick={() => setExploreView('people') || setActiveTab('explore')} className="mt-2 text-xs text-[#33a29b] font-medium" style={{ fontFamily: '"Courier New", monospace' }}>find people in explore →</button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {userFollows.map(u => (
                          <div key={u.id} onClick={() => setSelectedUser(u)} className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3 cursor-pointer hover:shadow-md transition">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#33a29b] to-[#2a8a84] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                              {(u.username || u.email || '?')[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm truncate" style={{ fontFamily: '"Courier New", monospace' }}>@{u.username || u.email?.split('@')[0]}</div>
                              <div className="text-[10px] text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>{u.ratings} ratings{u.overlap > 0 ? ` • ${u.overlap}% overlap` : ''}</div>
                            </div>
                            <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Followers section */}
                  <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2" style={{ fontFamily: '"Courier New", monospace' }}>
                      followers ({userFollowers.length})
                    </h3>
                    {userFollowers.length === 0 ? (
                      <div className="bg-gray-50 rounded-xl p-4 text-center">
                        <p className="text-sm text-gray-400" style={{ fontFamily: '"Courier New", monospace' }}>no followers yet</p>
                        <p className="text-xs text-gray-400 mt-1" style={{ fontFamily: '"Courier New", monospace' }}>share hunters finds with friends to get followers</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {userFollowers.map(u => (
                          <div key={u.id} onClick={() => setSelectedUser(u)} className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3 cursor-pointer hover:shadow-md transition">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                              {(u.username || u.email || '?')[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm truncate" style={{ fontFamily: '"Courier New", monospace' }}>@{u.username || u.email?.split('@')[0]}</div>
                              <div className="text-[10px] text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>{u.ratingsCount} ratings{u.dishOverlap > 0 ? ` • ${u.dishOverlap} dishes in common` : ''}</div>
                            </div>
                            <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

                            {youView === 'activity' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-lg font-bold" style={{ fontFamily: '"Courier New", monospace' }}>activity feed</h2>
                  </div>

                  {/* Filter buttons */}
                  <div className="flex gap-1.5 flex-wrap mb-3">
                    {[
                      { key: 'all', label: 'all' },
                      { key: 'ratings', label: 'ratings' },
                      { key: 'following', label: 'following' },
                      { key: 'groups', label: 'groups' },
                      { key: 'likes', label: 'likes' },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setYouActivityFilter(key)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${youActivityFilter === key ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        style={{ fontFamily: '"Courier New", monospace' }}
                      >{label}</button>
                    ))}
                  </div>

                  {user ? (() => {
                    // Build personal feed from allRatings + activityFeed RPC data
                    const followingIdSet = new Set(userFollows.map(f => f.id));
                    
                    // Filter activityFeed based on youActivityFilter
                    let filtered = activityFeed;
                    if (youActivityFilter === 'ratings') filtered = activityFeed.filter(a => a.activity_type === 'rating');
                    else if (youActivityFilter === 'following') filtered = activityFeed.filter(a => followingIdSet.has(a.user_id) && a.activity_type === 'rating');
                    else if (youActivityFilter === 'groups') filtered = activityFeed.filter(a => a.activity_type === 'group_join' || a.activity_type === 'group_rating');
                    else if (youActivityFilter === 'likes') filtered = activityFeed.filter(a => a.activity_type === 'like');

                    const getCardStyle = (activity) => {
                      const isOwn = user && activity.user_id === user.id;
                      const isFollowingUser = followingIdSet.has(activity.user_id);
                      if (isOwn) return { bg: 'bg-green-50', dot: 'bg-green-400' };
                      if (activity.activity_type === 'group_join' || activity.activity_type === 'group_rating') return { bg: 'bg-[#33a29b]/5', dot: 'bg-[#33a29b]' };
                      if (activity.activity_type === 'follow') return { bg: 'bg-red-50', dot: 'bg-red-300' };
                      if (activity.activity_type === 'like') return { bg: 'bg-pink-50', dot: 'bg-pink-400' };
                      if (isFollowingUser) return { bg: 'bg-yellow-50', dot: 'bg-yellow-400' };
                      return { bg: 'bg-white', dot: 'bg-gray-200' };
                    };

                    return filtered.length > 0 ? (
                      <div className="space-y-2">
                        {filtered.map(activity => {
                          const likes = ratingLikes[activity.rating_id] || { count: 0, likedByMe: false, users: [] };
                          const style = getCardStyle(activity);
                          const hoursAgo = (Date.now() - new Date(activity.created_at)) / 3600000;
                          const timeLabel = hoursAgo < 1 ? 'just now' : hoursAgo < 24 ? `${Math.floor(hoursAgo)}h ago` : `${Math.floor(hoursAgo/24)}d ago`;
                          return (
                            <div
                              key={activity.id}
                              className={`${style.bg} rounded-xl p-3 shadow-sm cursor-pointer hover:shadow-md transition`}
                              onClick={() => {
                                if (activity.activity_type === 'rating' || activity.activity_type === 'group_rating') {
                                  const dish = allDishes.find(d => d.name?.toLowerCase() === activity.content?.dish_name?.toLowerCase());
                                  if (dish) setSelectedDish(dish);
                                }
                              }}
                            >
                              <div className="flex items-start gap-3">
                                <div className="relative flex-shrink-0">
                                  <div className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-xs font-bold text-gray-600">
                                    {(activity.username || '?')[0].toUpperCase()}
                                  </div>
                                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-white ${style.dot}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-bold text-sm" style={{ fontFamily: '"Courier New", monospace' }}>@{activity.username}</div>
                                  <div className="text-xs text-gray-600 mt-0.5" style={{ fontFamily: '"Courier New", monospace' }}>
                                    {(activity.activity_type === 'rating' || activity.activity_type === 'group_rating') && (
                                      <span>rated <span className="font-semibold">{activity.content.dish_name}</span> {activity.content.score != null && <span className={`font-bold ${getSRRColor(activity.content.score)}`}>({activity.content.score})</span>}</span>
                                    )}
                                    {activity.activity_type === 'group_join' && `joined ${activity.content.group_name}`}
                                    {activity.activity_type === 'follow' && `started following @${activity.content.following_username}`}
                                    {activity.activity_type === 'like' && `liked a rating`}
                                  </div>
                                  {activity.content?.comment && (
                                    <div className="text-[10px] text-gray-500 mt-0.5 italic truncate" style={{ fontFamily: '"Courier New", monospace' }}>"{activity.content.comment}"</div>
                                  )}
                                  <div className="text-[10px] text-gray-400 mt-0.5" style={{ fontFamily: '"Courier New", monospace' }}>{timeLabel}</div>
                                </div>
                                {(activity.activity_type === 'rating' || activity.activity_type === 'group_rating') && activity.rating_id && (
                                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                                    <button onClick={(e) => handleToggleLike(activity.rating_id, e)} className={`transition ${likes.likedByMe ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}`}>
                                      <Heart size={15} className={likes.likedByMe ? 'fill-current' : ''} />
                                    </button>
                                    {likes.count > 0 && (
                                      <button onClick={(e) => { e.stopPropagation(); setLikesModalRatingId(activity.rating_id); }} className="text-[10px] text-gray-500 hover:text-[#33a29b]" style={{ fontFamily: '"Courier New", monospace' }}>
                                        {likes.count}
                                      </button>
                                    )}
                                    <button onClick={(e) => handleToggleComments(activity.rating_id, e)} className={`transition mt-0.5 ${expandedComments.has(activity.rating_id) ? 'text-[#33a29b]' : 'text-gray-300 hover:text-[#33a29b]'}`}>
                                      <MessageSquare size={15} />
                                    </button>
                                    {(ratingComments[activity.rating_id]?.comments?.filter(c => !c.parent_id).length || 0) > 0 && (
                                      <span className="text-[10px] text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>
                                        {ratingComments[activity.rating_id].comments.filter(c => !c.parent_id).length}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            {/* Inline comment thread */}
                            {(activity.activity_type === 'rating' || activity.activity_type === 'group_rating') && activity.rating_id && expandedComments.has(activity.rating_id) && (
                              renderCommentThread(activity.rating_id, activity.content?.comment, activity.username, style.bg)
                            )}
                          </div>
                        );
                        })}
                      </div>
                    ) : (
                      <EmptyState icon={Activity} title="no activity yet" message="Follow people and join groups to see activity here!" />
                    );
                  })() : (
                    <div className="bg-white rounded-lg p-6 shadow-sm text-center">
                      <p className="text-gray-600 mb-4" style={{ fontFamily: '"Courier New", monospace' }}>please log in to see activity</p>
                      <button onClick={() => setYouView('login')} className="bg-[#33a29b] text-white px-6 py-2 rounded-lg font-semibold hover:bg-[#2a8a84] transition" style={{ fontFamily: '"Courier New", monospace' }}>go to login</button>
                    </div>
                  )}
                </div>
              )}

              {youView === 'settings' && (
                <div className="space-y-3">
                  <h2 className="text-lg font-bold mb-4" style={{ fontFamily: '"Courier New", monospace' }}>settings</h2>
                  
                  {user ? (
                    <>
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: '"Courier New", monospace' }}>account</h3>
                        <div className="space-y-2">
                          <div className="text-sm py-2 text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>
                            <span className="text-gray-500">email:</span> {user.email}
                          </div>
                          <div className="text-sm py-2 text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>
                            <span className="text-gray-500">username:</span> {user.user_metadata?.username || 'Not set'}
                          </div>
                          <button 
                            onClick={() => {
                              setEditUsername(user?.user_metadata?.username || '');
                              setEditLocation(user?.user_metadata?.location || '');
                              setIsEditProfileModalOpen(true);
                            }}
                            className="w-full text-left text-sm py-2 hover:text-[#33a29b] transition" 
                            style={{ fontFamily: '"Courier New", monospace' }}
                          >
                            edit profile
                          </button>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: '"Courier New", monospace' }}>privacy</h3>
                        <button 
                          onClick={() => {
                            setErrorModal({
                              show: true,
                              title: 'Coming Soon',
                              message: 'Profile visibility settings will be available soon!'
                            });
                          }}
                          className="w-full text-left text-sm py-2 hover:text-[#33a29b] transition" 
                          style={{ fontFamily: '"Courier New", monospace' }}
                        >
                          profile visibility
                        </button>
                        <button 
                          onClick={() => {
                            setErrorModal({
                              show: true,
                              title: 'Coming Soon',
                              message: 'Rating privacy settings will be available soon!'
                            });
                          }}
                          className="w-full text-left text-sm py-2 hover:text-[#33a29b] transition" 
                          style={{ fontFamily: '"Courier New", monospace' }}
                        >
                          who can see my ratings
                        </button>
                      </div>

                      {/* ADMIN TOOLS SECTION */}
                      {(userRole === 'admin' || userRole === 'moderator') && (
                        <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-lg p-4 shadow-sm border-2 border-red-200">
                          <h3 className="text-sm font-bold mb-3 text-red-700 flex items-center gap-2" style={{ fontFamily: '"Courier New", monospace' }}>
                            {userRole === 'admin' ? 'ADMIN TOOLS' : 'MODERATOR TOOLS'}
                          </h3>
                          
                          <div className="space-y-2">
                            <button
                              onClick={() => {
                                console.log('Admin Dashboard clicked - coming soon!');
                                setErrorModal({
                                  show: true,
                                  title: 'Admin Dashboard',
                                  message: 'Dashboard with stats and analytics coming soon!'
                                });
                              }}
                              className="w-full text-left text-sm py-3 px-3 bg-white hover:bg-red-50 rounded-lg transition border border-red-200 font-medium"
                              style={{ fontFamily: '"Courier New", monospace' }}
                            >
                              Admin Dashboard
                            </button>
                            
                            <button
                              onClick={() => {
                                console.log('Deleted Items clicked');
                                setShowDeletedItems(true);
                              }}
                              className="w-full text-left text-sm py-3 px-3 bg-white hover:bg-yellow-50 rounded-lg transition border border-yellow-200 font-medium flex justify-between items-center"
                              style={{ fontFamily: '"Courier New", monospace' }}
                            >
                              <span>Deleted Items</span>
                              {deletedItemsCount > 0 && (
                                <span className="bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full text-xs font-bold">
                                  {deletedItemsCount}
                                </span>
                              )}
                            </button>
                            
                            <button
                              onClick={() => {
                                console.log('Merge Restaurants clicked');
                                setShowMergeRestaurants(true);
                              }}
                              className="w-full text-left text-sm py-3 px-3 bg-white hover:bg-blue-50 rounded-lg transition border border-blue-200 font-medium"
                              style={{ fontFamily: '"Courier New", monospace' }}
                            >
                              Merge Restaurants
                            </button>
                            
                            <button
                              onClick={() => {
                                console.log('Link Restaurants clicked');
                                setShowLinkRestaurants(true);
                              }}
                              className="w-full text-left text-sm py-3 px-3 bg-white hover:bg-green-50 rounded-lg transition border border-green-200 font-medium"
                              style={{ fontFamily: '"Courier New", monospace' }}
                            >
                              Link Restaurants to Map
                            </button>
                            
                            {userRole === 'admin' && (
                              <>
                                <button
                                  onClick={() => {
                                    console.log('Manage Moderators clicked - coming soon!');
                                    setErrorModal({
                                      show: true,
                                      title: 'Manage Moderators',
                                      message: 'Assign and manage moderator roles coming soon!'
                                    });
                                  }}
                                  className="w-full text-left text-sm py-3 px-3 bg-white hover:bg-purple-50 rounded-lg transition border border-purple-200 font-medium"
                                  style={{ fontFamily: '"Courier New", monospace' }}
                                >
                                  Manage Moderators
                                </button>
                                
                                <button
                                  onClick={() => {
                                    console.log('All Ratings clicked - coming soon!');
                                    setErrorModal({
                                      show: true,
                                      title: 'All Ratings',
                                      message: 'View and manage all ratings from all users coming soon!'
                                    });
                                  }}
                                  className="w-full text-left text-sm py-3 px-3 bg-white hover:bg-green-50 rounded-lg transition border border-green-200 font-medium"
                                  style={{ fontFamily: '"Courier New", monospace' }}
                                >
                                  All Ratings
                                </button>
                              </>
                            )}
                            
                            {/* Admin Mode Indicator */}
                            <div className="mt-3 pt-3 border-t border-red-200">
                              <div className="flex items-center justify-between text-xs" style={{ fontFamily: '"Courier New", monospace' }}>
                                <span className="text-gray-600">
                                  {userRole === 'admin' ? 'Admin Mode' : 'Moderator Mode'}
                                </span>
                                <span className={`px-2 py-1 rounded-full font-bold ${userRole === 'admin' ? 'bg-red-500 text-white' : 'bg-yellow-500 text-white'}`}>
                                  {userRole === 'admin' ? 'ADMIN' : 'MOD'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <button
                          onClick={() => setShowLogoutConfirm(true)}
                          className="w-full bg-red-500 text-white py-3 rounded-lg font-bold hover:bg-red-600 transition"
                          style={{ fontFamily: '"Courier New", monospace' }}
                        >
                          log out
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="bg-white rounded-lg p-6 shadow-sm text-center">
                      <p className="text-gray-600 mb-4" style={{ fontFamily: '"Courier New", monospace' }}>
                        Please log in to access settings
                      </p>
                      <button
                        onClick={() => setYouView('login')}
                        className="bg-[#33a29b] text-white px-6 py-2 rounded-lg font-semibold hover:bg-[#2a8a84] transition"
                        style={{ fontFamily: '"Courier New", monospace' }}
                      >
                        go to login
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        
        )}

      </div>
      {/* Bottom Nav - Updated per requirements */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200">
        <div className="flex justify-around items-center h-16 px-2">
          {[
            { id: 'map', icon: MapPin, label: 'map' },
            { id: 'rankings', icon: TrendingUp, label: 'rankings' },
            { id: 'add', icon: Plus, label: '', isAction: true },
            { id: 'explore', icon: Compass, label: 'explore' },
          { id: 'you', icon: User, label: 'you' },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isActionButton = tab.id === 'add';
            
            if (isActionButton) {
              // Special rendering for '+' button - no button wrapper, just icon on oval
              return (
                <div
                  key={tab.id}
                  onClick={() => setIsSubmissionModalOpen(true)}
                  className="flex flex-col items-center justify-center relative flex-1 py-2 cursor-pointer group"
                >
                  <div className="relative">
                    <Icon size={24} strokeWidth={2.5} className="text-white relative z-10" />
                    <div className="absolute inset-0 -m-3 rounded-full bg-[rgba(51,162,155,0.8)] group-hover:scale-90 transition-transform duration-200" />
                  </div>
                </div>
              );
            }
            
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'you') {
                    if (user) {
                      setActiveTab('you');
                    } else {
                      setActiveTab('you');
                      setYouView('login');
                    }
                  } else {
                    setActiveTab(tab.id);
                  }
                }}
                className={`flex flex-col items-center justify-center gap-1 relative flex-1 py-2 transition-all hover:bg-gray-50 ${
                  isActive ? 'text-[#33a29b]' : 'text-gray-500/60'
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                {tab.label && <span className="text-[10px]">{tab.label}</span>}
                {isActive && (
                  <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#33a29b] rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Submission Modal */}
      {isSubmissionModalOpen && (
        <>
          <>
              <div onClick={handleCloseSubmission} className={`fixed inset-0 z-[46] bg-black/40 ${isSubmissionClosing ? 'animate-fade-out' : 'animate-fade-in'}`} />
              <div className={`fixed z-[47] bg-white shadow-xl flex flex-col ${isSubmissionClosing ? 'animate-slide-down-fade' : 'animate-slide-up-fade'}`}
                style={{
                  top: '200px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 'min(92vw, 600px)',
                  borderRadius: '1rem',
                  maxHeight: 'calc(100vh - 200px - 80px)',
                  overflowY: 'auto',
                }}>
            <div className="sticky top-0 z-10 bg-white border-b px-3 py-2 flex justify-center items-center relative rounded-t-2xl flex-shrink-0">
              <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-gray-300 rounded-full md:hidden" />
              <h2 className="text-sm font-bold text-center mt-1 md:mt-0 md:text-lg" style={{ fontFamily: '"Courier New", monospace' }}>hunter rater</h2>
              <button onClick={handleCloseSubmission} className="absolute right-3"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto pb-4 px-3 pt-2" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
              <div className="max-w-xl mx-auto space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="relative">
                    <label className="block text-[10px] font-semibold text-gray-700 mb-0.5" style={{ fontFamily: '"Courier New", monospace' }}>restaurant</label>
                    <input 
                      type="text" 
                      value={restaurant} 
                      onChange={(e) => {
                        setRestaurant(e.target.value);
                        // Clear Google Place link if user manually types
                        setSelectedGooglePlace(null);
                        if (e.target.value.length >= 3) {
                          searchRestaurantForRating(e.target.value);
                          setShowRestaurantSearch(true);
                        } else {
                          setShowRestaurantSearch(false);
                        }
                      }}
                      onFocus={() => {
                        if (restaurant.length >= 3) {
                          setShowRestaurantSearch(true);
                        }
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowRestaurantSearch(false), 300);
                      }}
                      placeholder="e.g., taco palace" 
                      className="w-full px-2 py-1.5 text-xs border-2 border-gray-200 rounded-lg focus:border-[#33a29b] focus:outline-none"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    />
                    {selectedGooglePlace && (
                      <div className="absolute right-2 top-7 bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                        📍 Linked
                      </div>
                    )}
                    
                    {/* Restaurant Search Results */}
                    {showRestaurantSearch && (
                      <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {restaurantSearchLoading ? (
                          <div className="px-3 py-2 text-xs text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>
                            Searching...
                          </div>
                        ) : restaurantSearchResults.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>
                            No results. Enter manually.
                          </div>
                        ) : (
                          <>
                            {restaurantSearchResults.map((place, idx) => (
                              <button
                                key={idx}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  selectGooglePlaceForRating(place);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-green-50 transition border-b"
                              >
                                <div className="flex items-start gap-2">
                                  {!place.isDatabase && (
                                    <div className="text-lg mt-0.5">📍</div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="font-bold text-xs truncate" style={{ fontFamily: '"Courier New", monospace' }}>
                                      {place.name}
                                    </div>
                                    <div className="text-[10px] text-gray-600 truncate" style={{ fontFamily: '"Courier New", monospace' }}>
                                      {place.formatted_address || 'No address'}
                                    </div>
                                    {place.rating && (
                                      <div className="text-[10px] text-gray-500 mt-0.5" style={{ fontFamily: '"Courier New", monospace' }}>
                                        ⭐ {place.rating} ({place.user_ratings_total})
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </button>
                            ))}
                            <button
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setShowRestaurantSearch(false);
                                setSelectedGooglePlace(null);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 transition border-t-2 border-gray-300"
                            >
                              <div className="flex items-center gap-2">
                                <div className="text-lg">➕</div>
                                <div className="text-xs font-bold text-gray-700" style={{ fontFamily: '"Courier New", monospace' }}>
                                  Add "{restaurant}" manually
                                </div>
                              </div>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-gray-700 mb-0.5" style={{ fontFamily: '"Courier New", monospace' }}>food</label>
                    <input 
                      type="text" 
                      value={dishName} 
                      onChange={(e) => setDishName(e.target.value)} 
                      placeholder="e.g., carne asada tacos" 
                      className="w-full px-2 py-1 text-xs border-2 border-gray-200 rounded-lg focus:border-[#33a29b] focus:outline-none"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <label className="block text-[10px] font-semibold text-gray-700 mb-0.5" style={{ fontFamily: '"Courier New", monospace' }}>category</label>

                    {/* Confirm new category prompt */}
                    {categoryConfirmNew && (
                      <div className="absolute z-20 w-full mt-0 bg-white border-2 border-[#33a29b] rounded-lg shadow-lg p-2" style={{ top: '100%' }}>
                        <p className="text-xs text-gray-700 mb-2" style={{ fontFamily: '"Courier New", monospace' }}>
                          add <span className="font-bold text-[#33a29b]">"{categoryConfirmNew}"</span> as a new category?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setDishCategory(categoryConfirmNew);
                              setCategoryInput(categoryConfirmNew);
                              setCategoryLocked(true);
                              setCategoryConfirmNew(null);
                              setShowCategorySuggestions(false);
                            }}
                            className="flex-1 py-1 bg-[#33a29b] text-white text-xs rounded-lg font-bold"
                            style={{ fontFamily: '"Courier New", monospace' }}
                          >yes, add it</button>
                          <button
                            onClick={() => setCategoryConfirmNew(null)}
                            className="flex-1 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg font-bold"
                            style={{ fontFamily: '"Courier New", monospace' }}
                          >cancel</button>
                        </div>
                      </div>
                    )}

                    <div className="relative">
                      <input
                        type="text"
                        value={categoryInput}
                        onChange={(e) => {
                          const val = e.target.value.toLowerCase();
                          setCategoryInput(val);
                          setCategoryLocked(false);
                          setDishCategory(''); // require explicit selection
                          setShowCategorySuggestions(true);
                          setCategoryShowAll(false);
                          setCategoryConfirmNew(null);
                        }}
                        onFocus={() => { setShowCategorySuggestions(true); setCategoryShowAll(false); setCategoryConfirmNew(null); }}
                        onBlur={() => setTimeout(() => setShowCategorySuggestions(false), 150)}
                        placeholder="start typing or pick below..."
                        className={`w-full px-2 py-1.5 text-xs border-2 rounded-lg focus:outline-none ${categoryLocked ? 'border-[#33a29b] bg-[#33a29b]/5' : 'border-gray-200 focus:border-[#33a29b]'}`}
                        style={{ fontFamily: '"Courier New", monospace' }}
                        readOnly={categoryLocked}
                      />
                      {categoryLocked && (
                        <button
                          onClick={() => { setCategoryLocked(false); setCategoryInput(''); setDishCategory(''); setShowCategorySuggestions(true); }}
                          className="absolute right-2 top-1.5 text-gray-400 hover:text-gray-600"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    {showCategorySuggestions && !categoryLocked && (
                      <div ref={categoryDropdownRef} className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg">
                        {visibleCategories.length === 0 && !categoryInput && (
                          <div className="px-2 py-2 text-[10px] text-gray-400 italic" style={{ fontFamily: '"Courier New", monospace' }}>no categories yet</div>
                        )}
                        {visibleCategories.map(({ cat, count }) => (
                          <div
                            key={cat}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setCategoryInput(cat);
                              setDishCategory(cat);
                              setCategoryLocked(true);
                              setShowCategorySuggestions(false);
                              setCategoryShowAll(false);
                            }}
                            className="px-2 py-1.5 hover:bg-[#33a29b]/10 cursor-pointer border-b border-gray-100 flex justify-between items-center"
                          >
                            <span className="text-xs font-medium text-gray-800" style={{ fontFamily: '"Courier New", monospace' }}>{cat}</span>
                            <span className="text-[10px] text-gray-400 ml-2 flex-shrink-0" style={{ fontFamily: '"Courier New", monospace' }}>{count} {count === 1 ? 'dish' : 'dishes'}</span>
                          </div>
                        ))}

                        {/* Show more / collapse */}
                        {hasMoreCategories && (
                          <button
                            onMouseDown={(e) => { e.preventDefault(); setCategoryShowAll(v => !v); }}
                            className="w-full px-2 py-1.5 text-[10px] text-[#33a29b] font-semibold hover:bg-gray-50 border-b border-gray-100 text-left"
                            style={{ fontFamily: '"Courier New", monospace' }}
                          >
                            {categoryShowAll ? '▲ show less' : `▼ find more (${categorySuggestions.length - CATEGORY_INITIAL_SHOW} more)`}
                          </button>
                        )}

                        {/* Add new — only show if typed something not in list */}
                        {categoryInput && !categorySuggestions.some(({ cat }) => cat === categoryInput.trim()) && (
                          <button
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setCategoryConfirmNew(categoryInput.trim());
                              setShowCategorySuggestions(false);
                            }}
                            className="w-full px-2 py-1.5 text-[10px] text-gray-500 hover:bg-gray-50 text-left flex items-center gap-1"
                            style={{ fontFamily: '"Courier New", monospace' }}
                          >
                            <span className="text-[#33a29b] font-bold">+ add new:</span> "{categoryInput.trim()}"
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: '"Courier New", monospace' }}>price</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1 text-gray-500 text-xs" style={{ fontFamily: '"Courier New", monospace' }}>$</span>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={price} 
                        onChange={(e) => setPrice(e.target.value)} 
                        placeholder="0.00" 
                        className="w-full pl-5 pr-2 py-1.5 text-xs border-2 border-gray-200 rounded-lg focus:border-[#33a29b] focus:outline-none"
                        style={{ fontFamily: '"Courier New", monospace' }}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-2 mt-1">
                  <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2" style={{ fontFamily: '"Courier New", monospace' }}>rating scores</h3>

                  {/* Taste Slider */}
                  <div className="mb-2">
                    <div className="flex justify-between items-center mb-0.5">
                      <label className="text-[10px] font-semibold text-gray-700" style={{ fontFamily: '"Courier New", monospace' }}>taste</label>
                      <span className="text-xs font-bold text-orange-600" style={{ fontFamily: '"Courier New", monospace' }}>{tasteScore}</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="100" 
                      value={tasteScore} 
                      onChange={(e) => setTasteScore(parseInt(e.target.value))} 
                      className="w-full appearance-none cursor-pointer"
                      style={{
                        height: '4px',
                        borderRadius: '2px',
                        background: `linear-gradient(to right, #fb923c 0%, #fb923c ${tasteScore}%, #e5e7eb ${tasteScore}%, #e5e7eb 100%)`,
                        WebkitAppearance: 'none',
                      }}
                    />
                  </div>

                  {/* Price Value Display */}
                  <div className="bg-green-50 border border-green-200 rounded-lg px-2 py-1.5 mb-2">
                    <div className="flex justify-between items-center mb-0.5">
                      <label className="text-[10px] font-semibold text-gray-700" style={{ fontFamily: '"Courier New", monospace' }}>price value (auto)</label>
                      <div className="text-right">
                        <span className="text-xs font-bold text-green-600" style={{ fontFamily: '"Courier New", monospace' }}>{priceScore}</span>
                        {price && dishName && dishCategory && (() => {
                          const priceNum = parseFloat(price);
                          if (!isNaN(priceNum) && priceNum > 0) {
                            const { avgPrice } = calculatePriceScore(priceNum, dishName, dishCategory, allDishes);
                            return (
                              <div className="text-[9px] text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>
                                ${priceNum.toFixed(2)} vs ${avgPrice.toFixed(2)} avg
                              </div>
                            );
                          }
                        })()}
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full" style={{ height: '4px' }}>
                      <div className="bg-green-500 rounded-full transition-all" style={{ width: `${priceScore}%`, height: '4px' }}></div>
                    </div>
                  </div>

                  {/* Portion Slider */}
                  <div className="mb-2">
                    <div className="flex justify-between items-center mb-0.5">
                      <label className="text-[10px] font-semibold text-gray-700" style={{ fontFamily: '"Courier New", monospace' }}>portion</label>
                      <span className="text-xs font-bold text-blue-600" style={{ fontFamily: '"Courier New", monospace' }}>{portionScore}</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="100" 
                      value={portionScore} 
                      onChange={(e) => setPortionScore(parseInt(e.target.value))} 
                      className="w-full appearance-none cursor-pointer"
                      style={{
                        height: '4px',
                        borderRadius: '2px',
                        background: `linear-gradient(to right, #60a5fa 0%, #60a5fa ${portionScore}%, #e5e7eb ${portionScore}%, #e5e7eb 100%)`,
                        WebkitAppearance: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Photo Upload */}
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5" style={{ fontFamily: '"Courier New", monospace' }}>
                    photos (optional)
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 hover:border-[#33a29b] transition">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files);
                        setDishPhotos(files);
                        
                        // Create preview URLs
                        const previews = files.map(file => URL.createObjectURL(file));
                        setPhotoPreview(previews);
                      }}
                      className="hidden"
                      id="photo-upload"
                    />
                    <label
                      htmlFor="photo-upload"
                      className="flex flex-col items-center cursor-pointer"
                    >
                      <Image size={24} className="text-gray-400 mb-1" />
                      <span className="text-xs text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>
                        {dishPhotos.length > 0 ? `${dishPhotos.length} photo${dishPhotos.length > 1 ? 's' : ''} selected` : 'Click to upload photos'}
                      </span>
                    </label>
                  </div>
                  
                  {/* Photo Previews */}
                  {photoPreview.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {photoPreview.map((preview, idx) => (
                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                          <img src={preview} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              const newPhotos = dishPhotos.filter((_, i) => i !== idx);
                              const newPreviews = photoPreview.filter((_, i) => i !== idx);
                              setDishPhotos(newPhotos);
                              setPhotoPreview(newPreviews);
                              URL.revokeObjectURL(preview);
                            }}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: '"Courier New", monospace' }}>comment (optional)</label>
                  <textarea 
                    value={comment} 
                    onChange={(e) => {
                      setComment(e.target.value);
                      handleMentionInput(e.target.value, e.target.selectionStart, 'rating');
                    }}
                    onKeyUp={(e) => {
                      handleMentionInput(e.target.value, e.target.selectionStart, 'rating');
                    }}
                    placeholder="share your thoughts... (use @ to mention friends)" 
                    rows="2" 
                    className="w-full px-2 py-1.5 text-xs border-2 border-gray-200 rounded-lg focus:border-[#33a29b] focus:outline-none resize-none" 
                    style={{ fontFamily: '"Courier New", monospace' }}
                  />
                  
                  {/* Mention Dropdown */}
                  {showMentionDropdown && activeMentionField === 'rating' && (
                    <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {mentionResults.length > 0 ? (
                        mentionResults.map((user) => (
                          <button
                            key={user.id}
                            onClick={() => insertMention(user.username || user.email?.split('@')[0], comment, setComment)}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 transition border-b last:border-b-0"
                          >
                            <div className="font-bold text-xs" style={{ fontFamily: '"Courier New", monospace' }}>
                              @{user.username || user.email?.split('@')[0]}
                            </div>
                            <div className="text-xs text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>
                              {user.email}
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-xs text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>
                          No users found for "@{mentionQuery}"
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button 
                  onClick={handleSubmit} 
                  disabled={!restaurant || !dishName || !dishCategory || !price} 
                  className="w-full py-3 rounded-lg font-bold text-base transition-all shadow-lg relative overflow-hidden
                    disabled:bg-gray-400 disabled:text-gray-600 disabled:cursor-not-allowed disabled:shadow-none
                    enabled:bg-[#33a29b] enabled:text-black enabled:hover:bg-[#2a8a84] enabled:hover:shadow-xl enabled:hover:scale-[1.02]
                    enabled:active:scale-[0.98] enabled:active:shadow-inner enabled:active:translate-y-0.5"
                  style={{ fontFamily: '"Courier New", monospace' }}
                >
                  <span className="relative z-10">SUBMIT</span>
                  {(!restaurant || !dishName || !dishCategory || !price) && (
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-300/30 to-transparent animate-pulse"></span>
                  )}
                </button>
              </div>
            </div>
          </div>
          </>
        </>
      )}

      {/* Dish Modal - Optimized Compact View with Score Breakdown */}
      {selectedDish && (() => {
        // Get actual user ratings for this dish if available
        const userRating = userRatings?.find(r => r.dish_id === selectedDish.id);
        
        // Use actual user scores if they exist, otherwise use averages from dish data
        const tasteScore = userRating?.taste_score || selectedDish.taste_score || Math.round(selectedDish.srr * 0.85);
        const portionScore = userRating?.portion_score || selectedDish.portion_score || Math.round(selectedDish.srr * 0.9);
        
        // Calculate dynamic price score using ALL dishes for comparison
        const { score: calculatedPriceScore, avgPrice } = calculatePriceScore(
          selectedDish.price, 
          selectedDish.name, 
          selectedDish.cuisine, 
          allDishes  // Use processed allDishes array, not raw dishes from DB
        );
        // ALWAYS use dynamic price score (don't use stored price_score as it's outdated)
        const priceScore = calculatedPriceScore;
        
        // Calculate overall SRR from the three scores
        const overallSRR = selectedDish.srr || Math.round((tasteScore + portionScore + priceScore) / 3);
        
        return (
        <>
          <div onClick={handleCloseDish} className={`fixed inset-0 bg-black/40 z-50 ${isDishModalClosing ? 'animate-fade-out' : 'animate-fade-in'}`} style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />
          <div className={`fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none`}>
            <div className={`bg-white rounded-xl w-full overflow-y-auto pointer-events-auto ${isDishModalClosing ? 'animate-slide-down-fade-simple' : 'animate-slide-up-fade-simple'}`} style={{ maxWidth: '614px', maxHeight: '55vh' }}>
              {/* Compact Header */}
              <div className="sticky top-0 bg-white border-b px-3 py-2 flex justify-between items-center">
                <div className="flex items-center gap-2 flex-1">
                  <h2 className="text-base font-bold truncate" style={{ fontFamily: '"Courier New", monospace' }}>{selectedDish.name}</h2>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveItem(selectedDish, 'dish');
                    }}
                    className="p-1 hover:bg-gray-100 rounded-full transition flex-shrink-0"
                  >
                    <Bookmark size={16} className={isItemSaved(selectedDish.id, 'dish') ? 'fill-[#33a29b] text-[#33a29b]' : 'text-gray-400'} />
                  </button>
                  
                  {/* Edit/Delete Buttons in Modal */}
                  {user && canEditRating({user_id: user.id, created_at: selectedDish.created_at || new Date().toISOString()}) && (
                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditRating({
                            id: selectedDish.id,
                            dish_name: selectedDish.name,
                            dish: {name: selectedDish.name},
                            restaurant_name: selectedDish.restaurantName,
                            taste_score: selectedDish.taste,
                            portion_score: selectedDish.portion,
                            price_value_score: selectedDish.priceValue,
                            price: selectedDish.price,
                            comment: selectedDish.comment || '',
                            created_at: selectedDish.created_at,
                            edit_count: selectedDish.edit_count || 0
                          });
                          handleCloseDish();
                        }}
                        className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 border border-blue-200 font-medium"
                        style={{ fontFamily: '"Courier New", monospace' }}
                      >
                        Edit
                      </button>
                      
                      {userHasRatedDish && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            // Query DB directly for the rating to delete
                            // Admins/mods can delete any rating; regular users only their own
                            let ratingQuery = supabase
                              .from('ratings')
                              .select('id, taste_score, portion_score, price_score, overall_score, comment, created_at, user_id')
                              .eq('dish_id', selectedDish.id)
                              .eq('is_deleted', false);
                            
                            // Regular users can only delete their own
                            if (userRole !== 'admin' && userRole !== 'moderator') {
                              ratingQuery = ratingQuery.eq('user_id', user.id);
                            }
                            
                            const { data: ratingRow } = await ratingQuery.maybeSingle();
                            
                            if (!ratingRow) {
                              console.error('No active rating found for dish:', selectedDish.name);
                              return;
                            }
                            
                            handleDeleteRating({
                              id: ratingRow.id,
                              dish_id: selectedDish.id,
                              dish_name: selectedDish.name,
                              dish: {name: selectedDish.name},
                              restaurant_name: selectedDish.restaurantName,
                              user_id: user.id,
                              taste_score: ratingRow.taste_score,
                              portion_score: ratingRow.portion_score,
                              price_value_score: ratingRow.price_score,
                              price: selectedDish.price,
                              comment: ratingRow.comment || '',
                              created_at: ratingRow.created_at
                            });
                            handleCloseDish();
                          }}
                          className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 border border-red-200 font-medium"
                          style={{ fontFamily: '"Courier New", monospace' }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <button onClick={handleCloseDish} className="text-gray-500 hover:text-gray-700 flex-shrink-0">
                  <X size={18} />
                </button>
              </div>

              {/* Compact Content */}
              <div className="p-3">
                {/* Restaurant & Price Info */}
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-gray-700" style={{ fontFamily: '"Courier New", monospace' }}>{selectedDish.restaurantName}</p>
                      {(() => {
                        const dishRestaurant = allRestaurants.find(r => r.name === selectedDish.restaurantName);
                        const address = dishRestaurant?.address || dishRestaurant?.location?.address || dishRestaurant?.googleData?.vicinity || dishRestaurant?.google_data?.vicinity;
                        return address ? (
                          <p className="text-[10px] text-gray-400 truncate max-w-[160px]" style={{ fontFamily: '"Courier New", monospace' }}>{address}</p>
                        ) : null;
                      })()}
                    </div>
                    <p className="text-[10px] text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>${selectedDish.price.toFixed(2)} • {selectedDish.numRatings} ratings</p>
                  </div>
                </div>
                {/* Rate this Dish button */}
                <button
                  onClick={() => {
                    setRestaurant(selectedDish.restaurantName);
                    setDishName(selectedDish.name);
                    setIsSubmissionModalOpen(true);
                    handleCloseDish();
                  }}
                  className="w-full py-2 bg-[#33a29b] text-white rounded-lg font-bold hover:bg-[#2a8a84] transition text-sm mb-2"
                  style={{ fontFamily: '"Courier New", monospace' }}
                >
                  Rate this Dish
                </button>

                {/* Overall Score Display - Matching Restaurant Style */}
                <div className="bg-gradient-to-r from-[#33a29b]/10 to-[#2a8a84]/10 rounded-lg px-3 py-1.5 border border-[#33a29b]/30 mb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[8px] text-gray-600 uppercase" style={{ fontFamily: '"Courier New", monospace' }}>Overall Score</div>
                      <div className={`text-2xl font-bold leading-none ${getSRRColor(overallSRR)}`} style={{ fontFamily: '"Courier New", monospace' }}>{typeof overallSRR === "number" ? overallSRR.toFixed(2) : overallSRR}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDishModalView('photos');
                        }}
                        className="flex items-center gap-1 hover:bg-gray-100 px-1 py-0.5 rounded transition"
                      >
                        <Image size={14} className="text-gray-400" />
                        <span className="text-xs font-bold" style={{ fontFamily: '"Courier New", monospace' }}>{selectedDish.photos || 0}</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDishModalView('comments');
                        }}
                        className="flex items-center gap-1 hover:bg-gray-100 px-1 py-0.5 rounded transition ml-1"
                      >
                        <MessageSquare size={14} className="text-gray-400" />
                        <span className="text-xs font-bold" style={{ fontFamily: '"Courier New", monospace' }}>{selectedDish.comments || 0}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tab Buttons */}
                <div className="flex gap-2 mb-3 border-b">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDishModalView('scores');
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold transition ${
                      dishModalView === 'scores'
                        ? 'text-[#33a29b] border-b-2 border-[#33a29b]'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    style={{ fontFamily: '"Courier New", monospace' }}
                  >
                    SCORES
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDishModalView('photos');
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold transition ${
                      dishModalView === 'photos'
                        ? 'text-[#33a29b] border-b-2 border-[#33a29b]'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    style={{ fontFamily: '"Courier New", monospace' }}
                  >
                    PHOTOS ({selectedDish.photos || 0})
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDishModalView('comments');
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold transition ${
                      dishModalView === 'comments'
                        ? 'text-[#33a29b] border-b-2 border-[#33a29b]'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    style={{ fontFamily: '"Courier New", monospace' }}
                  >
                    COMMENTS ({dishComments.filter(c => c.dish_id === selectedDish?.id || allRatings.some(r => r.id === c.rating_id && r.dish_id === selectedDish?.id)).length || selectedDish.comments || 0})
                  </button>
                </div>

                {/* Scores View */}
                {dishModalView === 'scores' && (
                  <>
                    {/* Score Breakdown - 3 Scores Like Restaurant */}
                <div>
                  <h3 className="text-[9px] font-bold mb-1.5 text-gray-700" style={{ fontFamily: '"Courier New", monospace' }}>SCORE BREAKDOWN</h3>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="bg-orange-50 rounded p-1.5 text-center border border-orange-100">
                      <div className="text-[7px] text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>taste</div>
                      <div className="text-base font-bold text-orange-600" style={{ fontFamily: '"Courier New", monospace' }}>
                        {tasteScore}
                      </div>
                    </div>
                    <div className="bg-blue-50 rounded p-1.5 text-center border border-blue-100">
                      <div className="text-[7px] text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>portion</div>
                      <div className="text-base font-bold text-blue-600" style={{ fontFamily: '"Courier New", monospace' }}>
                        {portionScore}
                      </div>
                    </div>
                    <div className="bg-green-50 rounded p-1.5 text-center border border-green-100">
                      <div className="text-[7px] text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>price</div>
                      <div className="text-base font-bold text-green-600" style={{ fontFamily: '"Courier New", monospace' }}>
                        {priceScore}
                      </div>
                      <div className="text-[6px] text-gray-500 mt-0.5" style={{ fontFamily: '"Courier New", monospace' }}>
                        ${selectedDish.price.toFixed(2)} vs ${avgPrice.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Tags Section */}
                  <div className="mt-2 pt-2 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-gray-600 font-semibold" style={{ fontFamily: '"Courier New", monospace' }}>
                        TAGS
                      </div>
                      {user && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenTagsModal(selectedDish.id, 'dish', selectedDish.name);
                          }}
                          className="text-xs text-[#33a29b] hover:text-[#2a8a84] font-semibold px-2 py-1 rounded hover:bg-teal-50 transition"
                          style={{ fontFamily: '"Courier New", monospace' }}
                        >
                          + add tags
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {dishTags[selectedDish.id]?.length > 0 ? (
                        dishTags[selectedDish.id].map(tag => {
                          const tagData = allTags.find(t => t.id === tag.tag_id);
                          if (!tagData) return null;
                          
                          // Public tags (3+ votes) get shiny effect
                          const isPublic = tag.vote_count >= 3;
                          
                          return (
                            <div
                              key={tag.tag_id}
                              className="group relative"
                              title={`${tagData.name} (${tag.vote_count})`}
                            >
                              <div 
                                className="w-6 h-6 rounded-full cursor-pointer hover:ring-2 ring-offset-1 transition"
                                style={{ 
                                  backgroundColor: tagData.color,
                                  ringColor: tagData.color,
                                  boxShadow: isPublic ? `0 2px 8px ${tagData.color}80, inset 0 1px 2px rgba(255,255,255,0.5)` : 'none',
                                  background: isPublic 
                                    ? `linear-gradient(135deg, ${tagData.color} 0%, ${tagData.color}dd 50%, ${tagData.color} 100%)`
                                    : tagData.color
                                }}
                              />
                              {/* Tooltip */}
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                {tagData.name} ({tag.vote_count}) {isPublic && '✨'}
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-xs text-gray-400" style={{ fontFamily: '"Courier New", monospace' }}>
                          no tags yet
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                </>
              )}

              {/* Photos View */}
                {dishModalView === 'photos' && (
                  <div className="space-y-3">
                    {/* Photo Upload Button */}
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-bold text-gray-700" style={{ fontFamily: '"Courier New", monospace' }}>
                        PHOTO GALLERY
                      </h3>
                      <label className="px-3 py-1 bg-[#33a29b] text-white text-xs rounded-lg font-semibold hover:bg-[#2a8a84] transition cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file && selectedDish) {
                              handlePhotoUpload(file, selectedDish.id);
                            }
                          }}
                        />
                        {uploadingPhoto ? 'uploading...' : '+ add photo'}
                      </label>
                    </div>
                    
                    {loadingPhotos ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#33a29b] mx-auto"></div>
                      </div>
                    ) : selectedDishPhotos.length > 0 ? (
                      <div className="space-y-3">
                        {/* Carousel */}
                        <div className="relative bg-gray-100 rounded-lg overflow-hidden">
                          <img 
                            src={selectedDishPhotos[currentPhotoIndex]?.url} 
                            alt="Dish"
                            className="w-full h-64 object-cover"
                          />
                          
                          {/* Photo Info Overlay */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                            <div className="flex items-center justify-between text-white">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                                  {selectedDishPhotos[currentPhotoIndex]?.username?.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-xs font-semibold" style={{ fontFamily: '"Courier New", monospace' }}>
                                  @{selectedDishPhotos[currentPhotoIndex]?.username}
                                </span>
                              </div>
                              <button
                                onClick={() => handlePhotoLike(selectedDishPhotos[currentPhotoIndex]?.id)}
                                className="flex items-center gap-1 px-2 py-1 bg-white/20 rounded-full hover:bg-white/30 transition"
                              >
                                <Heart 
                                  size={14} 
                                  className={selectedDishPhotos[currentPhotoIndex]?.user_liked ? 'fill-red-500 text-red-500' : ''} 
                                />
                                <span className="text-xs font-bold">{selectedDishPhotos[currentPhotoIndex]?.likes_count || 0}</span>
                              </button>
                            </div>
                          </div>
                          
                          {/* Navigation Arrows */}
                          {selectedDishPhotos.length > 1 && (
                            <>
                              <button 
                                onClick={() => setCurrentPhotoIndex(i => (i - 1 + selectedDishPhotos.length) % selectedDishPhotos.length)}
                                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center hover:bg-white transition shadow-lg"
                              >
                                ←
                              </button>
                              <button 
                                onClick={() => setCurrentPhotoIndex(i => (i + 1) % selectedDishPhotos.length)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center hover:bg-white transition shadow-lg"
                              >
                                →
                              </button>
                            </>
                          )}
                          
                          {/* Photo Counter */}
                          <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 text-white text-xs rounded-full font-semibold">
                            {currentPhotoIndex + 1} / {selectedDishPhotos.length}
                          </div>
                        </div>
                        
                        {/* Thumbnail Strip */}
                        {selectedDishPhotos.length > 1 && (
                          <div className="flex gap-2 overflow-x-auto pb-2">
                            {selectedDishPhotos.map((photo, idx) => (
                              <button
                                key={photo.id}
                                onClick={() => setCurrentPhotoIndex(idx)}
                                className={`flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition ${
                                  idx === currentPhotoIndex ? 'border-[#33a29b]' : 'border-transparent'
                                }`}
                              >
                                <img 
                                  src={photo.url} 
                                  alt={`Photo ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        )}
                        
                        {/* Photo Date */}
                        <div className="text-xs text-gray-500 text-center" style={{ fontFamily: '"Courier New", monospace' }}>
                          Uploaded {new Date(selectedDishPhotos[currentPhotoIndex]?.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ) : (
                      <EmptyState
                        icon={Image}
                        title="no photos yet"
                        message="Be the first to add a photo of this dish!"
                        actionText="add photo"
                        onAction={() => {
                          document.querySelector('input[type="file"][accept="image/*"]').click();
                        }}
                      />
                    )}
                  </div>
                )}

                {/* Comments View */}
                {dishModalView === 'comments' && (() => {
                  // Group comments by rating
                  const dishRatings = allRatings.filter(r => r.dish_id === selectedDish.id && !r.is_deleted);
                  const totalComments = dishComments.filter(c => !c.parent_id).length;

                  return (
                    <div className="space-y-3">
                      {dishCommentsLoading ? (
                        <LoadingSpinner />
                      ) : dishRatings.length === 0 ? (
                        <EmptyState icon={MessageSquare} title="no ratings yet" message="Rate this dish to start the conversation!" />
                      ) : (
                        <>
                          {dishRatings.map(rating => {
                            const ratingUsername = rating.username || (user && rating.user_id === user.id ? (user.user_metadata?.username || user.email?.split('@')[0]) : 'user');
                            const computedSrr = rating.overall_score
                              ? parseFloat(rating.overall_score.toFixed(2))
                              : rating.taste_score != null ? parseFloat(((rating.taste_score + rating.portion_score + rating.price_score) / 3).toFixed(2)) : null;
                            const isExpanded = expandedComments.has(rating.id);
                            const commentsForRating = ratingComments[rating.id]?.comments?.filter(c => !c.parent_id) || [];
                            return (
                              <div key={rating.id} className="bg-gray-50 rounded-xl overflow-hidden">
                                {/* Rating header */}
                                <div
                                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-100 transition"
                                  onClick={() => handleToggleComments(rating.id)}
                                >
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#33a29b] to-[#2a8a84] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                    {(ratingUsername || '?')[0].toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-bold" style={{ fontFamily: '"Courier New", monospace' }}>@{ratingUsername}</span>
                                      {computedSrr != null && (
                                        <span className={`text-sm font-bold ${getSRRColor(computedSrr)}`} style={{ fontFamily: '"Courier New", monospace' }}>({computedSrr.toFixed(2)})</span>
                                      )}
                                    </div>
                                    {rating.comment && (
                                      <p className="text-xs text-gray-500 italic truncate" style={{ fontFamily: '"Courier New", monospace' }}>"{rating.comment}"</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-[10px] text-gray-400" style={{ fontFamily: '"Courier New", monospace' }}>
                                      {commentsForRating.length > 0 ? `${commentsForRating.length} comment${commentsForRating.length !== 1 ? 's' : ''}` : 'no comments'}
                                    </span>
                                    <MessageSquare size={14} className={isExpanded ? 'text-[#33a29b]' : 'text-gray-300'} />
                                  </div>
                                </div>
                                {/* Thread */}
                                {isExpanded && renderCommentThread(rating.id, rating.comment, ratingUsername, 'bg-gray-50')}
                              </div>
                            );
                          })}
                          {totalComments === 0 && !dishCommentsLoading && (
                            <p className="text-xs text-gray-400 text-center py-4" style={{ fontFamily: '"Courier New", monospace' }}>no comments yet — tap a rating above to start!</p>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </>
        );
      })()}

      {/* User Profile Modal */}
      {/* User Profile Modal - Direct Access (not from nested navigation) */}
      {/* Likes modal - who liked a rating */}
      {likesModalRatingId && (
        <>
          <div onClick={() => setLikesModalRatingId(null)} className="fixed inset-0 bg-black/40 z-[60]" />
          <div className="fixed z-[61] bg-white rounded-2xl shadow-xl" style={{ top: '30%', left: '50%', transform: 'translateX(-50%)', width: 'min(90vw, 360px)', maxHeight: '50vh' }}>
            <div className="border-b px-4 py-3 flex justify-between items-center">
              <h3 className="font-bold text-sm" style={{ fontFamily: '"Courier New", monospace' }}>liked by</h3>
              <button onClick={() => setLikesModalRatingId(null)}><X size={18} /></button>
            </div>
            <div className="overflow-y-auto p-3 space-y-2">
              {(ratingLikes[likesModalRatingId]?.users || []).map((username, idx) => (
                <div key={idx} className="flex items-center gap-2 py-1">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#33a29b] to-[#2a8a84] flex items-center justify-center text-white text-xs font-bold">
                    {username[0].toUpperCase()}
                  </div>
                  <span className="text-sm" style={{ fontFamily: '"Courier New", monospace' }}>@{username}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {selectedUser && !hasModalInStack() && (() => {
        const u = selectedUser;
        const theirRatings = allRatings.filter(r => r.user_id === u.id && !r.is_deleted);
        const topDishes = [...theirRatings].sort((a, b) => (b.srr || 0) - (a.srr || 0)).slice(0, 5);
        const avgScore = theirRatings.length > 0 ? theirRatings.reduce((s, r) => s + (r.srr || 0), 0) / theirRatings.length : 0;
        const cats = theirRatings.map(r => r.dish?.category || r.category).filter(Boolean);
        const favCat = cats.length > 0 ? Object.entries(cats.reduce((acc, c) => { acc[c] = (acc[c] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1])[0][0] : null;
        const myDishIds = new Set(userRatings.map(r => r.dish_id));
        const dishOverlap = theirRatings.filter(r => myDishIds.has(r.dish_id)).length;
        const isFollowingThem = userFollows.some(f => f.id === u.id) || (allUsers.find(au => au.id === u.id)?.isFollowing);
        return (
          <>
            <div onClick={handleCloseUser} className={`fixed inset-0 bg-black/40 z-50 ${isUserModalClosing ? 'animate-fade-out' : 'animate-fade-in'}`} style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />
            <div className={`fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none`}>
              <div className={`bg-white rounded-2xl w-full pointer-events-auto flex flex-col ${isUserModalClosing ? 'animate-slide-down-fade-simple' : 'animate-slide-up-fade-simple'}`} style={{ maxWidth: '520px', maxHeight: '82vh' }}>
                
                {/* Header */}
                <div className="sticky top-0 bg-white border-b px-4 py-3 flex justify-between items-center rounded-t-2xl flex-shrink-0">
                  <h2 className="font-bold text-base" style={{ fontFamily: '"Courier New", monospace' }}>@{u.username || u.email?.split('@')[0]}</h2>
                  <button onClick={handleCloseUser}><X size={20} /></button>
                </div>

                <div className="overflow-y-auto flex-1 p-4 space-y-4">
                  {/* Avatar + stats row */}
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#33a29b] to-[#2a8a84] flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                      {(u.username || u.email || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex gap-4 flex-1 text-center">
                      <div className="flex-1">
                        <div className="font-bold text-base" style={{ fontFamily: '"Courier New", monospace' }}>{theirRatings.length}</div>
                        <div className="text-[10px] text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>ratings</div>
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-base" style={{ fontFamily: '"Courier New", monospace' }}>{u.friends || u.ratingsCount || 0}</div>
                        <div className="text-[10px] text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>followers</div>
                      </div>
                      <div className="flex-1">
                        <div className={`font-bold text-base ${getSRRColor(avgScore)}`} style={{ fontFamily: '"Courier New", monospace' }}>{avgScore.toFixed(1)}</div>
                        <div className="text-[10px] text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>avg score</div>
                      </div>
                    </div>
                  </div>

                  {/* Overlap badge */}
                  {dishOverlap > 0 && (
                    <div className="bg-[#33a29b]/10 rounded-lg px-3 py-1.5 text-xs text-[#33a29b]" style={{ fontFamily: '"Courier New", monospace' }}>
                      {dishOverlap} dishes in common
                    </div>
                  )}

                  {/* Follow button */}
                  {user && u.id !== user.id && (
                    <button
                      onClick={async () => {
                        await handleFollowUser(u);
                        setAllUsers(prev => prev.map(p => p.id === u.id ? { ...p, isFollowing: !p.isFollowing } : p));
                      }}
                      className={`w-full py-2 rounded-xl text-sm font-bold transition ${isFollowingThem ? 'bg-gray-200 text-gray-700 hover:bg-red-100 hover:text-red-600' : 'bg-[#33a29b] text-white hover:bg-[#2a8a84]'}`}
                      style={{ fontFamily: '"Courier New", monospace' }}
                    >
                      {isFollowingThem ? 'following' : 'follow'}
                    </button>
                  )}

                  {/* Profile subtabs */}
                  <div className="flex gap-2 border-b pb-2">
                    {['stats', 'activity', 'lists'].map(tab => (
                      <button key={tab} onClick={() => setProfileModalTab(tab)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition ${profileModalTab === tab ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600'}`}
                        style={{ fontFamily: '"Courier New", monospace' }}
                      >{tab}</button>
                    ))}
                  </div>

                  {/* Stats tab */}
                  {profileModalTab === 'stats' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-gray-50 rounded-xl p-3 text-center">
                          <div className="text-sm font-bold" style={{ fontFamily: '"Courier New", monospace' }}>{favCat || '—'}</div>
                          <div className="text-[10px] text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>fav category</div>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 text-center">
                          <div className={`text-sm font-bold ${getSRRColor(avgScore)}`} style={{ fontFamily: '"Courier New", monospace' }}>{avgScore.toFixed(2)}</div>
                          <div className="text-[10px] text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>avg score</div>
                        </div>
                      </div>
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide" style={{ fontFamily: '"Courier New", monospace' }}>top dishes</h3>
                      {topDishes.length === 0 ? (
                        <p className="text-xs text-gray-400 italic" style={{ fontFamily: '"Courier New", monospace' }}>no ratings yet</p>
                      ) : topDishes.map((r, idx) => (
                        <div key={r.id} onClick={() => { const d = allDishes.find(d => d.id === r.dish_id); if (d) { handleCloseUser(); setSelectedDish(d); }}}
                          className="flex items-center gap-2 bg-gray-50 rounded-xl p-2 cursor-pointer hover:bg-gray-100 transition">
                          <span className="text-xs text-gray-400 w-5" style={{ fontFamily: '"Courier New", monospace' }}>#{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold truncate" style={{ fontFamily: '"Courier New", monospace' }}>{r.dish?.name || r.dish_name}</div>
                            <div className="text-[10px] text-gray-500 truncate" style={{ fontFamily: '"Courier New", monospace' }}>{r.dish?.restaurant_name || r.restaurant_name}</div>
                          </div>
                          <div className={`text-sm font-bold ${getSRRColor(r.srr)}`} style={{ fontFamily: '"Courier New", monospace' }}>{r.srr?.toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Activity tab */}
                  {profileModalTab === 'activity' && (
                    <div className="space-y-2">
                      {theirRatings.length === 0 ? (
                        <p className="text-xs text-gray-400 italic text-center py-4" style={{ fontFamily: '"Courier New", monospace' }}>no activity yet</p>
                      ) : [...theirRatings].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20).map(r => (
                        <div key={r.id} onClick={() => { const d = allDishes.find(d => d.id === r.dish_id); if (d) { handleCloseUser(); setSelectedDish(d); }}}
                          className="flex items-center gap-2 bg-gray-50 rounded-xl p-2 cursor-pointer hover:bg-gray-100 transition">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold truncate" style={{ fontFamily: '"Courier New", monospace' }}>{r.dish?.name || r.dish_name}</div>
                            <div className="text-[10px] text-gray-400" style={{ fontFamily: '"Courier New", monospace' }}>{new Date(r.created_at).toLocaleDateString()}</div>
                          </div>
                          <div className={`text-sm font-bold ${getSRRColor(r.srr)}`} style={{ fontFamily: '"Courier New", monospace' }}>{r.srr?.toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Lists tab */}
                  {profileModalTab === 'lists' && (
                    <div className="text-center py-6">
                      <List size={32} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-400" style={{ fontFamily: '"Courier New", monospace' }}>lists coming soon</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* Restaurant Detail Modal - Optimized Compact View */}
      {selectedRestaurant && (
        <>
          <div 
            onClick={handleCloseRestaurant} 
            className={`fixed inset-0 bg-black/40 z-60 ${isRestaurantModalClosing ? 'animate-fade-out' : 'animate-fade-in'}`} 
            style={{ 
              backdropFilter: 'blur(4px)', 
              WebkitBackdropFilter: 'blur(4px)',
              pointerEvents: 'auto'
            }} 
          />
          <div className={`fixed inset-0 flex items-center justify-center z-60 p-4 pointer-events-none`}>
            <div className={`bg-white rounded-xl max-w-lg w-full overflow-y-auto pointer-events-auto ${isRestaurantModalClosing ? 'animate-slide-down-fade-simple' : 'animate-slide-up-fade-simple'}`} style={{ maxHeight: '32vh' }}>
              {/* Compact Header */}
              <div className="sticky top-0 bg-white border-b px-3 py-2 flex justify-between items-center">
                <div className="flex items-center gap-2 flex-1">
                  <h2 className="text-base font-bold truncate" style={{ fontFamily: '"Courier New", monospace' }}>{selectedRestaurant.name}</h2>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveItem(selectedRestaurant, 'restaurant');
                    }}
                    className="p-1 hover:bg-gray-100 rounded-full transition flex-shrink-0"
                  >
                    <Bookmark size={16} className={isItemSaved(selectedRestaurant.id, 'restaurant') ? 'fill-[#33a29b] text-[#33a29b]' : 'text-gray-400'} />
                  </button>
                </div>
                <button onClick={handleCloseRestaurant} className="text-gray-500 hover:text-gray-700 flex-shrink-0">
                  <X size={18} />
                </button>
              </div>
              
              {/* Google Places Info (if applicable) */}
              {selectedRestaurant?.isGooglePlace && (
                <div className="p-3 bg-blue-50 border-b space-y-2">
                  {/* Google Rating */}
                  {selectedRestaurant.googleData?.rating && (
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-500">⭐</span>
                      <span className="font-bold text-lg">{selectedRestaurant.googleData.rating}</span>
                      <span className="text-xs text-gray-500">
                        ({selectedRestaurant.googleData.user_ratings_total || 0} reviews)
                      </span>
                    </div>
                  )}
                  
                  {/* Address */}
                  {selectedRestaurant.location?.address && (
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 mt-0.5">📍</span>
                      <span className="text-xs text-gray-700">{selectedRestaurant.location.address}</span>
                    </div>
                  )}
                  
                  {/* Hours */}
                  {selectedRestaurant.googleData?.opening_hours && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">🕐</span>
                      <span className={`text-xs font-semibold ${
                        selectedRestaurant.googleData.opening_hours.open_now ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {selectedRestaurant.googleData.opening_hours.open_now ? 'Open now' : 'Closed'}
                      </span>
                    </div>
                  )}
                  
                  {/* Rate Now Button */}
                  <button
                    onClick={() => {
                      // Track view
                      trackGooglePlaceView(selectedRestaurant.id, selectedRestaurant.name);
                      
                      // Pre-fill submission modal
                      setRestaurant(selectedRestaurant.name);
                      setIsSubmissionModalOpen(true);
                      setSelectedRestaurant(null);
                    }}
                    className="w-full py-2 bg-[#33a29b] text-white rounded-lg font-bold hover:bg-[#2a8a84] transition text-sm"
                    style={{ fontFamily: '"Courier New", monospace' }}
                  >
                    🍽️ Rate a Dish Here
                  </button>
                </div>
              )}
              
              <div className="p-3">
                {/* Restaurant Info */}
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-700" style={{ fontFamily: '"Courier New", monospace' }}>{selectedRestaurant.cuisine}</p>
                    <p className="text-[10px] text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>
                      {selectedRestaurant.dishCount || 0} dish{selectedRestaurant.dishCount !== 1 ? 'es' : ''} rated
                    </p>
                    {/* Address - show for all restaurants */}
                    {(selectedRestaurant.address || selectedRestaurant.location?.address || selectedRestaurant.googleData?.vicinity || selectedRestaurant.google_data?.vicinity) && (
                      <p className="text-[10px] text-gray-500 mt-0.5" style={{ fontFamily: '"Courier New", monospace' }}>
                        {selectedRestaurant.address || selectedRestaurant.location?.address || selectedRestaurant.googleData?.vicinity || selectedRestaurant.google_data?.vicinity}
                      </p>
                    )}
                  </div>
                </div>
                {/* Rate a Dish button for DB restaurants (Google Place ones already have it above) */}
                {!selectedRestaurant.isGooglePlace && (
                  <button
                    onClick={() => {
                      setRestaurant(selectedRestaurant.name);
                      setDishName('');
                      setIsSubmissionModalOpen(true);
                      setSelectedRestaurant(null);
                    }}
                    className="w-full py-2 bg-[#33a29b] text-white rounded-lg font-bold hover:bg-[#2a8a84] transition text-sm mb-2"
                    style={{ fontFamily: '"Courier New", monospace' }}
                  >
                    Rate a Dish Here
                  </button>
                )}

                {/* Overall Score Display */}
                <div className="bg-gradient-to-r from-[#33a29b]/10 to-[#2a8a84]/10 rounded-lg px-3 py-1.5 border border-[#33a29b]/30 mb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[8px] text-gray-600 uppercase" style={{ fontFamily: '"Courier New", monospace' }}>Average Score</div>
                      <div className={`text-2xl font-bold leading-none ${getSRRColor(selectedRestaurant.avgSRR)}`} style={{ fontFamily: '"Courier New", monospace' }}>{selectedRestaurant.avgSRR}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRestaurantModalView('photos');
                        }}
                        className="flex items-center gap-1 hover:bg-gray-100 px-1 py-0.5 rounded transition"
                      >
                        <Image size={14} className="text-gray-400" />
                        <span className="text-xs font-bold" style={{ fontFamily: '"Courier New", monospace' }}>0</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRestaurantModalView('comments');
                        }}
                        className="flex items-center gap-1 hover:bg-gray-100 px-1 py-0.5 rounded transition ml-1"
                      >
                        <MessageSquare size={14} className="text-gray-400" />
                        <span className="text-xs font-bold" style={{ fontFamily: '"Courier New", monospace' }}>0</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tab Buttons */}
                <div className="flex gap-2 mb-3 border-b">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRestaurantModalView('scores');
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold transition ${
                      restaurantModalView === 'scores'
                        ? 'text-[#33a29b] border-b-2 border-[#33a29b]'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    style={{ fontFamily: '"Courier New", monospace' }}
                  >
                    TOP DISHES
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRestaurantModalView('photos');
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold transition ${
                      restaurantModalView === 'photos'
                        ? 'text-[#33a29b] border-b-2 border-[#33a29b]'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    style={{ fontFamily: '"Courier New", monospace' }}
                  >
                    PHOTOS (0)
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRestaurantModalView('comments');
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold transition ${
                      restaurantModalView === 'comments'
                        ? 'text-[#33a29b] border-b-2 border-[#33a29b]'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    style={{ fontFamily: '"Courier New", monospace' }}
                  >
                    COMMENTS (0)
                  </button>
                </div>

                {/* Top Dishes View */}
                {restaurantModalView === 'scores' && (
                  <>
                    <div>
                      <h3 className="text-[9px] font-bold mb-1.5 text-gray-700" style={{ fontFamily: '"Courier New", monospace' }}>TOP RATED DISHES</h3>
                      <div className="space-y-2">
                        {selectedRestaurant.topDishes && selectedRestaurant.topDishes.length > 0 ? (
                          selectedRestaurant.topDishes.slice(0, 5).map((dish, idx) => (
                            <div 
                              key={idx} 
                              onClick={() => setSelectedDish(dish)}
                              className="bg-gray-50 rounded p-2 border border-gray-100 cursor-pointer hover:bg-gray-100 transition"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="text-sm font-bold" style={{ fontFamily: '"Courier New", monospace' }}>
                                    {dish.name}
                                  </div>
                                  <div className="text-xs text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>
                                    ${dish.price?.toFixed(2)} • {dish.cuisine}
                                  </div>
                                </div>
                                <div className={`text-xl font-bold ${getSRRColor(dish.srr)}`} style={{ fontFamily: '"Courier New", monospace' }}>
                                  {typeof dish.srr === "number" ? dish.srr.toFixed(2) : dish.srr}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-gray-400 text-center py-4" style={{ fontFamily: '"Courier New", monospace' }}>
                            No rated dishes yet
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Photos View */}
                {restaurantModalView === 'photos' && (
                  <div className="space-y-3">
                    <EmptyState
                      icon={Image}
                      title="no photos yet"
                      message="Be the first to add a photo of this restaurant!"
                      actionText="add photo"
                      onAction={() => {
                        setErrorModal({
                          show: true,
                          title: 'Coming Soon',
                          message: 'Photo uploads will be available soon!'
                        });
                      }}
                    />
                  </div>
                )}

                {/* Comments View */}
                {restaurantModalView === 'comments' && (
                  <div className="space-y-3">
                    <EmptyState
                      icon={MessageSquare}
                      title="no comments yet"
                      message="Be the first to comment on this restaurant!"
                      actionText="add comment"
                      onAction={() => {
                        setErrorModal({
                          show: true,
                          title: 'Coming Soon',
                          message: 'Comments will be available soon!'
                        });
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}


      {/* New List Modal */}
      {isNewListModalOpen && (
        <>
          <div onClick={handleCloseNewList} className={`fixed inset-0 bg-black/40 z-50 ${isNewListModalClosing ? 'animate-fade-out' : 'animate-fade-in'}`} />
          <div className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-xl w-[90%] max-w-md max-h-[80vh] overflow-hidden ${isNewListModalClosing ? 'animate-slide-down-fade' : 'animate-slide-up-fade'}`} style={{ transform: isNewListModalClosing ? 'translate(-50%, calc(-50% + 30px))' : 'translate(-50%, -50%)' }}>
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex justify-between items-center">
              <h2 className="text-lg font-bold" style={{ fontFamily: '"Courier New", monospace' }}>create new list</h2>
              <button onClick={handleCloseNewList} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-60px)]">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: '"Courier New", monospace' }}>name</label>
                  <input 
                    type="text" 
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="e.g., weekend brunch spots"
                    className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:border-[#33a29b] focus:outline-none"
                    style={{ fontFamily: '"Courier New", monospace' }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: '"Courier New", monospace' }}>item/restaurant search</label>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                    <input 
                      type="text"
                      value={listItemSearch}
                      onChange={(e) => setListItemSearch(e.target.value)}
                      placeholder="search dishes or restaurants..."
                      className="w-full pl-9 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:border-[#33a29b] focus:outline-none"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: '"Courier New", monospace' }}>add collaborators</label>
                  <div className="relative">
                    <UserPlus size={16} className="absolute left-3 top-2.5 text-gray-400" />
                    <input 
                      type="text"
                      value={collaboratorSearch}
                      onChange={(e) => setCollaboratorSearch(e.target.value)}
                      placeholder="search friends..."
                      className="w-full pl-9 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:border-[#33a29b] focus:outline-none"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    />
                  </div>
                </div>

                {newListItems.length > 0 && (
                  <div className="border-t pt-3">
                    <h3 className="text-xs font-semibold text-gray-700 mb-2" style={{ fontFamily: '"Courier New", monospace' }}>items in list ({newListItems.length})</h3>
                    <div className="space-y-2">
                      {newListItems.map((item, idx) => (
                        <div key={idx} className="bg-gray-50 rounded-lg p-2 text-xs" style={{ fontFamily: '"Courier New", monospace' }}>
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {newListCollaborators.length > 0 && (
                  <div className="border-t pt-3">
                    <h3 className="text-xs font-semibold text-gray-700 mb-2" style={{ fontFamily: '"Courier New", monospace' }}>collaborators ({newListCollaborators.length})</h3>
                    <div className="space-y-2">
                      {newListCollaborators.map((collab, idx) => (
                        <div key={idx} className="bg-gray-50 rounded-lg p-2 text-xs flex items-center gap-2">
                          <User size={14} />
                          <span style={{ fontFamily: '"Courier New", monospace' }}>{collab}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button 
                  onClick={() => {
                    handleCloseNewList();
                  }}
                  disabled={!newListName}
                  className="w-full bg-[#33a29b] text-white py-2.5 rounded-lg font-bold text-sm hover:bg-[#2a8a84] transition disabled:bg-gray-300"
                  style={{ fontFamily: '"Courier New", monospace' }}
                >
                  CREATE LIST
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* New Group Modal */}
      {/* You Tab - Create Group Modal (use same as Rankings tab) */}
      <CreateGroupModal
        isOpen={isNewGroupModalOpen}
        onClose={() => setIsNewGroupModalOpen(false)}
        onSubmit={handleCreateGroup}
        user={user}
      />

      {/* Group Detail Modal with Modal Stack Support */}
      {/* Modal Stack Renderer - Single Active Modal with Back Navigation */}
      {hasModalInStack() && (() => {
        const topModal = getTopModal();
        const showBackButton = canGoBack();

        if (topModal.type === 'user') {
          return (
            <>
              <div onClick={handleCloseModalStack} className="fixed inset-0 bg-black/50 z-[60] animate-fade-in" />
              <div className="fixed inset-0 flex items-center justify-center z-[60] p-4 pointer-events-none">
                <div className="bg-white rounded-xl max-w-2xl w-full max-h-[70vh] overflow-y-auto pointer-events-auto animate-slide-up-fade-simple">
                  {/* Header with Back Button */}
                  <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center gap-3 z-10">
                    {showBackButton && (
                      <button
                        onClick={handleBackInModal}
                        className="p-1 hover:bg-gray-100 rounded-full transition"
                        title="Go back"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                      </button>
                    )}
                    <h2 className="text-lg font-bold flex-1" style={{ fontFamily: '"Courier New", monospace' }}>@{topModal.data.username}</h2>
                    <button onClick={handleCloseModalStack} className="text-gray-500 hover:text-gray-700">
                      <X size={20} />
                    </button>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Profile Stats */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="flex justify-between mb-3">
                        <div>
                          <h3 className="text-xl font-bold" style={{ fontFamily: '"Courier New", monospace' }}>@{topModal.data.username}</h3>
                          <p className="text-sm text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>{topModal.data.location}</p>
                        </div>
                        <button className="px-3 py-1.5 bg-[#33a29b] text-white rounded-lg text-sm hover:bg-[#2a8a84] transition">
                          <UserPlus size={14} className="inline mr-1" />add friend
                        </button>
                      </div>
                      <div className="flex gap-4 text-center py-3 border-t border-b">
                        <div className="flex-1">
                          <div className="font-bold text-lg" style={{ fontFamily: '"Courier New", monospace' }}>{topModal.data.ratings}</div>
                          <div className="text-xs text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>ratings</div>
                        </div>
                        <div className="flex-1 border-l">
                          <div className="font-bold text-lg" style={{ fontFamily: '"Courier New", monospace' }}>{topModal.data.friends}</div>
                          <div className="text-xs text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>friends</div>
                        </div>
                        <div className="flex-1 border-l">
                          <div className="font-bold text-lg text-[#33a29b]" style={{ fontFamily: '"Courier New", monospace' }}>{topModal.data.overlap}%</div>
                          <div className="text-xs text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>overlap</div>
                        </div>
                      </div>
                    </div>

                    {/* Top Rated Dishes */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: '"Courier New", monospace' }}>their top rated</h3>
                      {allDishes.slice(0, 3).map((dish, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => pushModal('dish', dish)}
                          className="flex justify-between py-2 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 transition"
                        >
                          <div>
                            <div className="text-sm font-medium" style={{ fontFamily: '"Courier New", monospace' }}>#{idx + 1} {dish.name}</div>
                            <div className="text-xs text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>{dish.restaurantName}</div>
                          </div>
                          <div className={`text-lg font-bold ${getSRRColor(dish.srr)}`} style={{ fontFamily: '"Courier New", monospace' }}>{typeof dish.srr === "number" ? dish.srr.toFixed(2) : dish.srr}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          );
        } else if (topModal.type === 'dish') {
          // Generate stable scores based on dish ID (won't change on re-render)
          const seed = topModal.data.id.toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const dishTasteScore = Math.floor(topModal.data.srr * 0.85 + (seed % 10));
          const dishPortionScore = Math.floor(topModal.data.srr * 0.9 + ((seed * 3) % 8));
          const dishPriceScore = Math.floor(topModal.data.srr * 0.95 + ((seed * 7) % 6));
          
          return (
            <>
              <div onClick={handleCloseModalStack} className="fixed inset-0 bg-black/50 z-[60] animate-fade-in" />
              <div className="fixed inset-0 flex items-center justify-center z-[60] p-4 pointer-events-none">
                <div className="bg-white rounded-xl max-w-lg w-full overflow-y-auto pointer-events-auto animate-slide-up-fade-simple" style={{ maxHeight: '32vh' }}>
                  {/* Header with Back Button */}
                  <div className="sticky top-0 bg-white border-b px-3 py-2 flex items-center gap-2">
                    {showBackButton && (
                      <button
                        onClick={handleBackInModal}
                        className="p-1 hover:bg-gray-100 rounded-full transition flex-shrink-0"
                        title="Go back"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                      </button>
                    )}
                    <h2 className="text-base font-bold truncate flex-1" style={{ fontFamily: '"Courier New", monospace' }}>{topModal.data.name}</h2>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveItem(topModal.data, 'dish');
                      }}
                      className="p-1 hover:bg-gray-100 rounded-full transition flex-shrink-0"
                    >
                      <Bookmark size={16} className={isItemSaved(topModal.data.id, 'dish') ? 'fill-[#33a29b] text-[#33a29b]' : 'text-gray-400'} />
                    </button>
                    <button onClick={handleCloseModalStack} className="text-gray-500 hover:text-gray-700 flex-shrink-0">
                      <X size={18} />
                    </button>
                  </div>

                  <div className="p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-700" style={{ fontFamily: '"Courier New", monospace' }}>{topModal.data.restaurantName}</p>
                        <p className="text-[10px] text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>${topModal.data.price.toFixed(2)} • {topModal.data.numRatings} ratings</p>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-[#33a29b]/10 to-[#2a8a84]/10 rounded-lg px-3 py-1.5 border border-[#33a29b]/30 mb-2 gradient-card">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[8px] text-gray-600 uppercase" style={{ fontFamily: '"Courier New", monospace' }}>Overall Score</div>
                          <div className={`text-2xl font-bold leading-none ${getSRRColor(topModal.data.srr)}`} style={{ fontFamily: '"Courier New", monospace' }}>{topModal.data.srr}</div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Image size={14} className="text-gray-400" />
                          <span className="text-xs font-bold" style={{ fontFamily: '"Courier New", monospace' }}>{topModal.data.photos}</span>
                          <MessageSquare size={14} className="text-gray-400 ml-1" />
                          <span className="text-xs font-bold" style={{ fontFamily: '"Courier New", monospace' }}>{topModal.data.comments}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-[9px] font-bold mb-1.5 text-gray-700" style={{ fontFamily: '"Courier New", monospace' }}>SCORE BREAKDOWN</h3>
                      <div className="grid grid-cols-3 gap-1.5">
                        <div className="bg-orange-50 rounded p-1.5 text-center border border-orange-100">
                          <div className="text-[7px] text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>taste</div>
                          <div className="text-base font-bold text-orange-600" style={{ fontFamily: '"Courier New", monospace' }}>
                            {dishTasteScore}
                          </div>
                        </div>
                        <div className="bg-blue-50 rounded p-1.5 text-center border border-blue-100">
                          <div className="text-[7px] text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>portion</div>
                          <div className="text-base font-bold text-blue-600" style={{ fontFamily: '"Courier New", monospace' }}>
                            {dishPortionScore}
                          </div>
                        </div>
                        <div className="bg-green-50 rounded p-1.5 text-center border border-green-100">
                          <div className="text-[7px] text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>price</div>
                          <div className="text-base font-bold text-green-600" style={{ fontFamily: '"Courier New", monospace' }}>
                            {dishPriceScore}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          );
        } else if (topModal.type === 'group') {
          return (
            <>
              <div onClick={handleCloseModalStack} className="fixed inset-0 bg-black/50 z-[60] animate-fade-in" style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />
              <div className="fixed inset-0 flex items-center justify-center z-[60] p-4 pointer-events-none">
                <div className="bg-white rounded-xl max-w-2xl w-full overflow-hidden pointer-events-auto animate-slide-up-fade-simple" style={{ height: '70vh' }}>
                  <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center gap-3 z-10">
                    {showBackButton && (
                      <button
                        onClick={handleBackInModal}
                        className="p-1 hover:bg-gray-100 rounded-full transition"
                        title="Go back"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                      </button>
                    )}
                    <h2 className="text-lg font-bold flex-1" style={{ fontFamily: '"Courier New", monospace' }}>{topModal.data.name}</h2>
                    <button onClick={handleCloseModalStack} className="text-gray-500 hover:text-gray-700">
                      <X size={20} />
                    </button>
                  </div>

                  {/* Tab Navigation */}
                  <div className="bg-gray-50 border-b px-4 py-2 flex gap-2">
                    <button
                      onClick={() => setGroupModalView('members')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                        groupModalView === 'members' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      style={{ fontFamily: '"Courier New", monospace' }}
                    >
                      members ({topModal.data.membersList.length})
                    </button>
                    <button
                      onClick={() => setGroupModalView('dishes')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                        groupModalView === 'dishes' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      style={{ fontFamily: '"Courier New", monospace' }}
                    >
                      dishes ({topModal.data.dishes.length})
                    </button>
                  </div>

                  <div className="p-4 overflow-y-auto" style={{ height: 'calc(70vh - 120px)' }}>
                    {groupModalView === 'members' && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-bold mb-3" style={{ fontFamily: '"Courier New", monospace' }}>group members</h3>
                        {topModal.data.membersList.map((member, idx) => {
                          const fullUser = mockUsers.find(u => u.username === member.username) || {
                            id: idx,
                            username: member.username,
                            location: 'Oakland, CA',
                            ratings: member.dishes,
                            friends: 8,
                            overlap: Math.floor(60 + Math.random() * 30)
                          };
                          return (
                            <div 
                              key={idx} 
                              onClick={() => pushModal('user', fullUser)}
                              className="bg-gray-50 rounded-lg p-3 border border-gray-200 cursor-pointer hover:bg-gray-100 transition"
                            >
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <User size={18} className="text-gray-500" />
                                  <span className="font-bold text-sm" style={{ fontFamily: '"Courier New", monospace' }}>@{member.username}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <div className="text-xs text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>{member.dishes} dishes</div>
                                    <div className={`text-xl font-bold ${getSRRColor(member.score)}`} style={{ fontFamily: '"Courier New", monospace' }}>{member.score}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {groupModalView === 'dishes' && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-bold mb-3" style={{ fontFamily: '"Courier New", monospace' }}>group dishes & restaurants</h3>
                        {topModal.data.dishes.map((dish, idx) => {
                          const fullDish = allDishes.find(d => d.name === dish.name) || {
                            id: `dish-${idx}`,
                            name: dish.name,
                            restaurantName: dish.restaurant,
                            srr: dish.srr,
                            price: 10 + Math.random() * 10,
                            numRatings: Math.floor(20 + Math.random() * 40),
                            photos: Math.floor(10 + Math.random() * 30),
                            comments: Math.floor(10 + Math.random() * 30),
                            cuisine: 'various'
                          };
                          return (
                            <div 
                              key={idx} 
                              onClick={() => pushModal('dish', fullDish)}
                              className="bg-gray-50 rounded-lg p-3 border border-gray-200 cursor-pointer hover:bg-gray-100 transition"
                            >
                              <div className="flex justify-between items-center">
                                <div className="flex-1">
                                  <div className="font-bold text-sm" style={{ fontFamily: '"Courier New", monospace' }}>{dish.name}</div>
                                  <div className="text-xs text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>{dish.restaurant}</div>
                                </div>
                                <div className={`text-2xl font-bold ${getSRRColor(dish.srr)}`} style={{ fontFamily: '"Courier New", monospace' }}>{typeof dish.srr === "number" ? dish.srr.toFixed(2) : dish.srr}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          );
        }
        return null;
      })()}

      {/* Results Modal - Overall Score Display */}
      {isResultsModalOpen && submittedRating && (
        <>
          <div onClick={handleCloseResults} className={`fixed inset-0 bg-black/50 z-50 ${isResultsClosing ? 'animate-fade-out' : 'animate-fade-in'}`} />
          <div className={`fixed left-1/2 -translate-x-1/2 z-50 bg-white rounded-2xl shadow-2xl overflow-hidden ${isResultsClosing ? 'animate-slide-down-fade' : 'animate-slide-up-fade'}`} style={{ top: '15%', width: '80%', maxWidth: '1000px', maxHeight: '70vh' }}>
            <div className="bg-gradient-to-br from-[#33a29b] to-[#2a8a84] px-4 py-3 text-center">
              <h2 className="text-white text-sm font-semibold mb-1" style={{ fontFamily: '"Courier New", monospace' }}>RATING SUBMITTED!</h2>
              <div className="text-white text-xs mb-2" style={{ fontFamily: '"Courier New", monospace' }}>{submittedRating.dishName}</div>
              
              {/* Large Overall Score */}
              <div className="bg-white rounded-xl p-3 shadow-lg">
                <div className="text-gray-600 text-xs font-semibold mb-1" style={{ fontFamily: '"Courier New", monospace' }}>OVERALL SCORE</div>
                <div className={`text-5xl font-bold ${getSRRColor(submittedRating.finalSRR)}`} style={{ fontFamily: '"Courier New", monospace' }}>
                  {submittedRating.finalSRR.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="p-3">
              {/* Score Breakdown */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center p-1.5 bg-orange-50 rounded-lg">
                  <div className="text-[10px] text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>taste</div>
                  <div className="text-lg font-bold text-orange-600" style={{ fontFamily: '"Courier New", monospace' }}>{submittedRating.tasteScore}</div>
                </div>
                <div className="text-center p-1.5 bg-green-50 rounded-lg">
                  <div className="text-[10px] text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>price</div>
                  <div className="text-lg font-bold text-green-600" style={{ fontFamily: '"Courier New", monospace' }}>{submittedRating.priceScore}</div>
                </div>
                <div className="text-center p-1.5 bg-blue-50 rounded-lg">
                  <div className="text-[10px] text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>portion</div>
                  <div className="text-lg font-bold text-blue-600" style={{ fontFamily: '"Courier New", monospace' }}>{submittedRating.portionScore}</div>
                </div>
              </div>

              {/* Ranking Information */}
              <div className="border-t border-gray-100 pt-2">
                <h3 className="text-xs font-bold text-gray-800 mb-2" style={{ fontFamily: '"Courier New", monospace' }}>RANKING POSITION</h3>
                
                {/* Current Rank */}
                <div className="bg-gradient-to-r from-[#33a29b]/10 to-[#2a8a84]/10 rounded-lg p-2 mb-1.5 border-2 border-[#33a29b]">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>your rank</div>
                      <div className="font-bold text-xs text-gray-800" style={{ fontFamily: '"Courier New", monospace' }}>{submittedRating.dishName}</div>
                      <div className="text-[10px] text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>{submittedRating.restaurant}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-[#33a29b]" style={{ fontFamily: '"Courier New", monospace' }}>#{submittedRating.ranking.rank}</div>
                      <div className="text-[10px] text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>of {submittedRating.ranking.total}</div>
                    </div>
                  </div>
                </div>

                {/* Top Ranked */}
                <div className="bg-yellow-50 rounded-lg p-1.5 mb-1.5 border border-yellow-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold">#1</span>
                      <div>
                        <div className="text-[10px] text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>#1 ranked</div>
                        <div className="text-xs font-bold text-gray-800" style={{ fontFamily: '"Courier New", monospace' }}>{submittedRating.ranking.topRanked.name}</div>
                      </div>
                    </div>
                    <div className={`text-base font-bold ${getSRRColor(submittedRating.ranking.topRanked.srr)}`} style={{ fontFamily: '"Courier New", monospace' }}>
                      {typeof submittedRating.ranking.topRanked.srr === "number" ? submittedRating.ranking.topRanked.srr.toFixed(2) : submittedRating.ranking.topRanked.srr}
                    </div>
                  </div>
                </div>

                {/* Above Item */}
                {submittedRating.ranking.aboveItem && (
                  <div className="bg-gray-50 rounded-lg p-1.5 mb-1.5 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>ranked above ↑</div>
                        <div className="text-xs font-semibold text-gray-700" style={{ fontFamily: '"Courier New", monospace' }}>{submittedRating.ranking.aboveItem.name}</div>
                      </div>
                      <div className="text-xs font-bold text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>
                        #{submittedRating.ranking.rank - 1} · {typeof submittedRating.ranking.aboveItem.srr === "number" ? submittedRating.ranking.aboveItem.srr.toFixed(2) : submittedRating.ranking.aboveItem.srr}
                      </div>
                    </div>
                  </div>
                )}

                {/* Below Item */}
                {submittedRating.ranking.belowItem && (
                  <div className="bg-gray-50 rounded-lg p-1.5 mb-1.5 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>ranked below ↓</div>
                        <div className="text-xs font-semibold text-gray-700" style={{ fontFamily: '"Courier New", monospace' }}>{submittedRating.ranking.belowItem.name}</div>
                      </div>
                      <div className="text-xs font-bold text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>
                        #{submittedRating.ranking.rank + 1} · {typeof submittedRating.ranking.belowItem.srr === "number" ? submittedRating.ranking.belowItem.srr.toFixed(2) : submittedRating.ranking.belowItem.srr}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button 
                onClick={handleCloseResults}
                className="w-full mt-2 bg-[#33a29b] text-black py-2 rounded-lg font-bold text-sm hover:bg-[#2a8a84] transition-all shadow-lg"
                style={{ fontFamily: '"Courier New", monospace' }}
              >
                CLOSE
              </button>
            </div>
          </div>
        </>
      )}
      
      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={isCreateGroupModalOpen}
        onClose={() => setIsCreateGroupModalOpen(false)}
        onSubmit={handleCreateGroup}
        user={user}
      />
      
      {/* Group Detail Modal */}
      <GroupDetailModal
        group={selectedGroup}
        isOpen={!!selectedGroup}
        onClose={() => setSelectedGroup(null)}
        user={user}
        isUserMember={userGroups.some(g => g.id === selectedGroup?.id)}
        onLeave={handleLeaveGroup}
        onDelete={handleDeleteGroup}
        allDishes={allDishes}
        allRatings={allRatings}
        handleMentionInput={handleMentionInput}
        insertMention={insertMention}
        showMentionDropdown={showMentionDropdown}
        activeMentionField={activeMentionField}
        mentionResults={mentionResults}
        mentionQuery={mentionQuery}
        createMentionNotification={createMentionNotification}
        extractMentions={extractMentions}
      />
      
      {/* Add Tags Modal */}
      {tagModalItem && (
        <AddTagsModal
          isOpen={isAddTagsModalOpen}
          onClose={() => {
            setIsAddTagsModalOpen(false);
            setTagModalItem(null);
          }}
          itemId={tagModalItem.id}
          itemType={tagModalItem.type}
          itemName={tagModalItem.name}
          availableTags={allTags}
          currentTags={(userDishTags[tagModalItem.id] || []).map(tagId => ({ tag_id: tagId }))}
          onSave={handleSaveTags}
          userHasRated={userRatings?.some(r => r.dish_id === tagModalItem.id)}
        />
      )}
      
      {/* Error Modal */}
      {errorModal.show && (
        <>
          <div onClick={() => setErrorModal({ show: false, title: '', message: '' })} className="fixed inset-0 bg-black/50 z-50 animate-fade-in" />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <div className="bg-white rounded-xl max-w-sm w-full p-6 pointer-events-auto animate-slide-up-fade-simple">
              <div className="flex items-start gap-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold mb-2" style={{ fontFamily: '"Courier New", monospace' }}>
                    {errorModal.title}
                  </h3>
                  <p className="text-sm text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>
                    {errorModal.message}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                {errorModal.confirmAction ? (
                  <>
                    <button
                      onClick={() => setErrorModal({ show: false, title: '', message: '' })}
                      className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    >
                      {errorModal.cancelLabel || 'cancel'}
                    </button>
                    <button
                      onClick={() => {
                        errorModal.confirmAction();
                        setErrorModal({ show: false, title: '', message: '' });
                      }}
                      className="flex-1 px-4 py-2 bg-[#33a29b] text-white rounded-lg font-semibold hover:bg-[#2a8a84] transition"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    >
                      {errorModal.confirmLabel || 'confirm'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setErrorModal({ show: false, title: '', message: '' })}
                    className="flex-1 px-4 py-2 bg-[#33a29b] text-white rounded-lg font-semibold hover:bg-[#2a8a84] transition"
                    style={{ fontFamily: '"Courier New", monospace' }}
                  >
                    ok
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
      
      {/* Edit Profile Modal */}
      {isEditProfileModalOpen && (
        <>
          <div onClick={() => setIsEditProfileModalOpen(false)} className="fixed inset-0 bg-black/50 z-50 animate-fade-in" />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <div className="bg-white rounded-xl max-w-md w-full p-6 pointer-events-auto animate-slide-up-fade-simple max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold" style={{ fontFamily: '"Courier New", monospace' }}>
                  edit profile
                </h3>
                <button onClick={() => setIsEditProfileModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Profile Picture */}
                <div className="text-center">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#33a29b] to-[#2a8a84] mx-auto mb-3 flex items-center justify-center text-white text-3xl font-bold overflow-hidden">
                    {user?.user_metadata?.profile_picture_url ? (
                      <img 
                        src={user.user_metadata.profile_picture_url} 
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      (user?.user_metadata?.username || user?.email?.split('@')[0] || 'U').charAt(0).toUpperCase()
                    )}
                  </div>
                  <label className="inline-block px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg font-semibold hover:bg-gray-200 transition cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (file) {
                          await uploadProfilePicture(file);
                          // Force refresh to show new picture
                          window.location.reload();
                        }
                      }}
                    />
                    change photo
                  </label>
                </div>
                
                {/* Username */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: '"Courier New", monospace' }}>
                    username
                  </label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    placeholder="your username"
                    className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:border-[#33a29b] focus:outline-none"
                    style={{ fontFamily: '"Courier New", monospace' }}
                  />
                </div>
                
                {/* Location */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: '"Courier New", monospace' }}>
                    location (optional)
                  </label>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="e.g., San Francisco, CA"
                    className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:border-[#33a29b] focus:outline-none"
                    style={{ fontFamily: '"Courier New", monospace' }}
                  />
                </div>
                
                {/* Email (read-only) */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: '"Courier New", monospace' }}>
                    email
                  </label>
                  <div className="w-full px-3 py-2 text-sm bg-gray-100 text-gray-600 rounded-lg" style={{ fontFamily: '"Courier New", monospace' }}>
                    {user?.email}
                  </div>
                  <p className="text-xs text-gray-500 mt-1" style={{ fontFamily: '"Courier New", monospace' }}>
                    email cannot be changed
                  </p>
                </div>
                
                {/* Save Button */}
                <button
                  onClick={async () => {
                    try {
                      await supabase.auth.updateUser({
                        data: {
                          username: editUsername,
                          location: editLocation
                        }
                      });
                      
                      setErrorModal({
                        show: true,
                        title: 'Profile Updated!',
                        message: 'Your profile changes have been saved.'
                      });
                      
                      setIsEditProfileModalOpen(false);
                    } catch (error) {
                      console.error('Error updating profile:', error);
                      setErrorModal({
                        show: true,
                        title: 'Update Failed',
                        message: 'Could not update profile. Please try again.'
                      });
                    }
                  }}
                  className="w-full py-3 bg-[#33a29b] text-black rounded-lg font-bold hover:bg-[#2a8a84] transition"
                  style={{ fontFamily: '"Courier New", monospace' }}
                >
                  save changes
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      
      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <>
          <div onClick={() => setShowLogoutConfirm(false)} className="fixed inset-0 bg-black/50 z-50 animate-fade-in" />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <div className="bg-white rounded-xl max-w-sm w-full p-6 pointer-events-auto animate-slide-up-fade-simple">
              <h3 className="text-lg font-bold mb-2" style={{ fontFamily: '"Courier New", monospace' }}>
                log out?
              </h3>
              <p className="text-sm text-gray-600 mb-6" style={{ fontFamily: '"Courier New", monospace' }}>
                Are you sure you want to log out of your account?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition"
                  style={{ fontFamily: '"Courier New", monospace' }}
                >
                  cancel
                </button>
                <button
                  onClick={async () => {
                    await signOut();
                    setShowLogoutConfirm(false);
                    setYouView('login');
                    setActiveTab('you');
                  }}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition"
                  style={{ fontFamily: '"Courier New", monospace' }}
                >
                  log out
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      
      {/* Password Reset Modal */}
      {showPasswordReset && (
        <>
          <div onClick={() => !resetSent && setShowPasswordReset(false)} className="fixed inset-0 bg-black/50 z-50 animate-fade-in" />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <div className="bg-white rounded-xl max-w-md w-full p-6 pointer-events-auto animate-slide-up-fade-simple">
              {resetSent ? (
                <div className="text-center">
                  <div className="text-5xl mb-4">✅</div>
                  <h3 className="text-lg font-bold mb-2" style={{ fontFamily: '"Courier New", monospace' }}>
                    check your email
                  </h3>
                  <p className="text-sm text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>
                    We've sent a password reset link to <strong>{resetEmail}</strong>
                  </p>
                  <p className="text-xs text-gray-500 mt-2" style={{ fontFamily: '"Courier New", monospace' }}>
                    (check spam folder if you don't see it)
                  </p>
                </div>
              ) : (
                <>
                  <h3 className="text-lg font-bold mb-2" style={{ fontFamily: '"Courier New", monospace' }}>
                    reset password
                  </h3>
                  <p className="text-sm text-gray-600 mb-4" style={{ fontFamily: '"Courier New", monospace' }}>
                    Enter your email address and we'll send you a link to reset your password.
                  </p>
                  
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg mb-4 focus:outline-none focus:border-[#33a29b]"
                    style={{ fontFamily: '"Courier New", monospace' }}
                  />
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowPasswordReset(false)}
                      className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    >
                      cancel
                    </button>
                    <button
                      onClick={handlePasswordReset}
                      className="flex-1 px-4 py-3 bg-[#33a29b] text-white rounded-lg hover:bg-[#2a8a84]"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    >
                      send reset link
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Set New Password Modal */}
      {showNewPasswordModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <h3 className="text-lg font-bold mb-2" style={{ fontFamily: '"Courier New", monospace' }}>
                set new password
              </h3>
              <p className="text-sm text-gray-600 mb-2" style={{ fontFamily: '"Courier New", monospace' }}>
                Choose a new password for your account.
              </p>
              <p className="text-xs text-gray-500 mb-4" style={{ fontFamily: '"Courier New", monospace' }}>
                Must be at least 6 characters
              </p>
              
              <input
                type="password"
                placeholder="new password (min 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg mb-3 focus:outline-none focus:border-[#33a29b]"
                style={{ fontFamily: '"Courier New", monospace' }}
              />
              
              <input
                type="password"
                placeholder="confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg mb-2 focus:outline-none focus:border-[#33a29b]"
                style={{ fontFamily: '"Courier New", monospace' }}
                disabled={passwordResetLoading}
              />
              
              {/* Password match indicator */}
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500 mb-2" style={{ fontFamily: '"Courier New", monospace' }}>
                  Passwords don't match
                </p>
              )}
              {newPassword && confirmPassword && newPassword === confirmPassword && (
                <p className="text-xs text-green-600 mb-2" style={{ fontFamily: '"Courier New", monospace' }}>
                  Passwords match
                </p>
              )}
              
              {/* Stay logged in checkbox */}
              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stayLoggedIn}
                  onChange={(e) => setStayLoggedIn(e.target.checked)}
                  className="cursor-pointer"
                  disabled={passwordResetLoading}
                />
                <span className="text-sm text-gray-700" style={{ fontFamily: '"Courier New", monospace' }}>
                  Stay logged in on this device
                </span>
              </label>
              
              <button
                onClick={handleSetNewPassword}
                disabled={!newPassword || !confirmPassword || newPassword.length < 6 || passwordResetLoading}
                className="w-full px-4 py-3 bg-[#33a29b] text-white rounded-lg hover:bg-[#2a8a84] disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ fontFamily: '"Courier New", monospace' }}
              >
                {passwordResetLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    updating...
                  </>
                ) : (
                  'update password'
                )}
              </button>
            </div>
          </div>
        </>
      )}
      
      {/* Success Toast - Center of Screen */}
      {showSuccessToast && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] pointer-events-none">
          <div className="bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg animate-fade-in-scale" style={{ fontFamily: '"Courier New", monospace' }}>
            <p className="text-center font-bold">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Edit Rating Modal - Matches Rate Modal Design */}
      {showEditModal && editingRating && (
        <>
          <div onClick={() => setShowEditModal(false)} className={`fixed inset-0 bg-black/40 z-50 animate-fade-in`} />
          <div className={`fixed left-1/2 -translate-x-1/2 z-50 bg-white rounded-2xl shadow-xl overflow-hidden animate-slide-up-fade`} style={{ top: '15%', width: '80%', maxWidth: '1000px', maxHeight: '75vh' }}>
            <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex justify-center items-center relative">
              <h2 className="text-lg font-bold text-center" style={{ fontFamily: '"Courier New", monospace' }}>edit rating</h2>
              <button onClick={() => setShowEditModal(false)} className="absolute right-4"><X size={24} /></button>
            </div>
            <div className="overflow-y-auto h-full pb-4 p-4">
              <div className="max-w-xl mx-auto space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: '"Courier New", monospace' }}>restaurant</label>
                    <input 
                      type="text" 
                      value={editRestaurant} 
                      onChange={(e) => {
                        setEditRestaurant(e.target.value);
                        if (e.target.value.length >= 2) {
                          const matches = restaurants.filter(r => 
                            r.name.toLowerCase().includes(e.target.value.toLowerCase())
                          );
                          setEditRestaurantSearchResults(matches.slice(0, 8));
                          setShowEditRestaurantSearch(true);
                        } else {
                          setShowEditRestaurantSearch(false);
                        }
                      }}
                      onFocus={() => {
                        if (editRestaurant.length >= 2) {
                          const matches = restaurants.filter(r => 
                            r.name.toLowerCase().includes(editRestaurant.toLowerCase())
                          );
                          setEditRestaurantSearchResults(matches.slice(0, 8));
                          setShowEditRestaurantSearch(true);
                        }
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowEditRestaurantSearch(false), 200);
                      }}
                      placeholder="e.g., taco palace" 
                      className="w-full px-2 py-1.5 text-xs border-2 border-gray-200 rounded-lg focus:border-[#33a29b] focus:outline-none"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    />
                    
                    {/* Search Dropdown */}
                    {showEditRestaurantSearch && editRestaurantSearchResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {editRestaurantSearchResults.map((r, idx) => (
                          <button
                            key={idx}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setEditRestaurant(r.name);
                              setShowEditRestaurantSearch(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-green-50 transition border-b last:border-b-0"
                          >
                            <div className="font-bold text-xs" style={{ fontFamily: '"Courier New", monospace' }}>
                              {r.name}
                            </div>
                            <div className="text-[10px] text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>
                              {r.address || r.cuisine || 'Restaurant'}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: '"Courier New", monospace' }}>food</label>
                    <input 
                      type="text" 
                      value={editDishName} 
                      onChange={(e) => setEditDishName(e.target.value)} 
                      placeholder="e.g., carne asada tacos" 
                      className="w-full px-2 py-1.5 text-xs border-2 border-gray-200 rounded-lg focus:border-[#33a29b] focus:outline-none"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: '"Courier New", monospace' }}>category</label>
                    <input
                      type="text"
                      value={editingRating.dish?.cuisine_type || 'various'}
                      readOnly
                      className="w-full px-2 py-1.5 text-xs border-2 border-gray-200 rounded-lg bg-gray-50"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: '"Courier New", monospace' }}>price</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1 text-gray-500 text-xs" style={{ fontFamily: '"Courier New", monospace' }}>$</span>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={editPrice} 
                        onChange={(e) => setEditPrice(e.target.value)} 
                        placeholder="0.00" 
                        className="w-full pl-5 pr-2 py-1.5 text-xs border-2 border-gray-200 rounded-lg focus:border-[#33a29b] focus:outline-none"
                        style={{ fontFamily: '"Courier New", monospace' }}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t-2 border-gray-100 pt-3 mt-3">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3" style={{ fontFamily: '"Courier New", monospace' }}>rating scores</h3>

                  {/* Taste Slider */}
                  <div className="mb-3">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-gray-700" style={{ fontFamily: '"Courier New", monospace' }}>taste</label>
                      <span className="text-sm font-bold text-orange-600" style={{ fontFamily: '"Courier New", monospace' }}>{editTaste}</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="100" 
                      value={editTaste} 
                      onChange={(e) => setEditTaste(parseInt(e.target.value))} 
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #fb923c 0%, #fb923c ${editTaste}%, #e5e7eb ${editTaste}%, #e5e7eb 100%)`
                      }}
                    />
                  </div>

                  {/* Price Value Display */}
                  <div className="bg-green-50 border-2 border-green-200 rounded-lg p-2 mb-3">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-gray-700" style={{ fontFamily: '"Courier New", monospace' }}>price value</label>
                      <div className="text-right">
                        <span className="text-sm font-bold text-green-600" style={{ fontFamily: '"Courier New", monospace' }}>{editPriceValue}</span>
                      </div>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="100" 
                      value={editPriceValue} 
                      onChange={(e) => setEditPriceValue(parseInt(e.target.value))} 
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #22c55e 0%, #22c55e ${editPriceValue}%, #e5e7eb ${editPriceValue}%, #e5e7eb 100%)`
                      }}
                    />
                  </div>

                  {/* Portion Slider */}
                  <div className="mb-3">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-gray-700" style={{ fontFamily: '"Courier New", monospace' }}>portion</label>
                      <span className="text-sm font-bold text-blue-600" style={{ fontFamily: '"Courier New", monospace' }}>{editPortion}</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="100" 
                      value={editPortion} 
                      onChange={(e) => setEditPortion(parseInt(e.target.value))} 
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #60a5fa 0%, #60a5fa ${editPortion}%, #e5e7eb ${editPortion}%, #e5e7eb 100%)`
                      }}
                    />
                  </div>
                </div>

                <div className="relative">
                  <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: '"Courier New", monospace' }}>comment (optional)</label>
                  <textarea 
                    value={editComment} 
                    onChange={(e) => setEditComment(e.target.value)}
                    placeholder="share your thoughts..." 
                    rows="2" 
                    className="w-full px-2 py-1.5 text-xs border-2 border-gray-200 rounded-lg focus:border-[#33a29b] focus:outline-none resize-none" 
                    style={{ fontFamily: '"Courier New", monospace' }}
                  />
                </div>

                <button 
                  onClick={saveEditedRating} 
                  className="w-full py-3 rounded-lg font-bold text-base transition-all shadow-lg relative overflow-hidden
                    bg-[#33a29b] text-black hover:bg-[#2a8a84] hover:shadow-xl hover:scale-[1.02]
                    active:scale-[0.98] active:shadow-inner active:translate-y-0.5"
                  style={{ fontFamily: '"Courier New", monospace' }}
                >
                  <span className="relative z-10">SAVE CHANGES</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deletingRating && (
        <>
          <div onClick={() => setShowDeleteConfirm(false)} className="fixed inset-0 bg-black/50 z-50" />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <h3 className="text-lg font-bold mb-2 text-red-700" style={{ fontFamily: '"Courier New", monospace' }}>
                Delete Rating?
              </h3>
              
              <p className="text-sm text-gray-600 mb-2" style={{ fontFamily: '"Courier New", monospace' }}>
                Delete rating for <strong>{deletingRating.dish?.name || deletingRating.dish_name}</strong>?
              </p>
              
              <p className="text-xs text-gray-500 mb-4" style={{ fontFamily: '"Courier New", monospace' }}>
                This rating will be moved to trash and can be restored within 30 days.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg hover:bg-gray-50"
                  style={{ fontFamily: '"Courier New", monospace' }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteRating}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ fontFamily: '"Courier New", monospace' }}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Merge Restaurants Modal */}
      {showMergeRestaurants && (
        <>
          <div onClick={() => !mergeLoading && setShowMergeRestaurants(false)} className="fixed inset-0 bg-black/50 z-50" />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-2" style={{ fontFamily: '"Courier New", monospace' }}>
                Merge Restaurants
              </h3>
              
              <p className="text-sm text-gray-600 mb-4" style={{ fontFamily: '"Courier New", monospace' }}>
                Combine duplicate restaurant entries. All ratings from the first restaurant will be moved to the second.
              </p>
              
              {!mergePreview ? (
                <>
                  {/* From Restaurant */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold mb-2" style={{ fontFamily: '"Courier New", monospace' }}>
                      From (will be removed):
                    </label>
                    <select
                      value={mergeFromRestaurant}
                      onChange={(e) => setMergeFromRestaurant(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#33a29b]"
                      style={{ fontFamily: '"Courier New", monospace' }}
                      disabled={mergeLoading}
                    >
                      <option value="">Select restaurant to merge from...</option>
                      {allRestaurants.sort((a, b) => a.name.localeCompare(b.name)).map(r => (
                        <option key={r.name} value={r.name}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* To Restaurant */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold mb-2" style={{ fontFamily: '"Courier New", monospace' }}>
                      To (will keep):
                    </label>
                    <select
                      value={mergeToRestaurant}
                      onChange={(e) => setMergeToRestaurant(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#33a29b]"
                      style={{ fontFamily: '"Courier New", monospace' }}
                      disabled={mergeLoading}
                    >
                      <option value="">Select restaurant to merge into...</option>
                      {allRestaurants.sort((a, b) => a.name.localeCompare(b.name)).map(r => (
                        <option key={r.name} value={r.name}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Example */}
                  {mergeFromRestaurant && mergeToRestaurant && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <p className="text-xs text-gray-700" style={{ fontFamily: '"Courier New", monospace' }}>
                        Example: "{mergeFromRestaurant}" → "{mergeToRestaurant}"
                      </p>
                      <p className="text-xs text-gray-600 mt-1" style={{ fontFamily: '"Courier New", monospace' }}>
                        All ratings will show under "{mergeToRestaurant}"
                      </p>
                    </div>
                  )}
                  
                  {/* Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowMergeRestaurants(false)}
                      className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg hover:bg-gray-50"
                      style={{ fontFamily: '"Courier New", monospace' }}
                      disabled={mergeLoading}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={previewMerge}
                      className="flex-1 px-4 py-2 bg-[#33a29b] text-white rounded-lg hover:bg-[#2a8a84]"
                      style={{ fontFamily: '"Courier New", monospace' }}
                      disabled={mergeLoading || !mergeFromRestaurant || !mergeToRestaurant}
                    >
                      Preview Merge
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Preview */}
                  <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-4">
                    <h4 className="text-sm font-bold text-yellow-800 mb-2" style={{ fontFamily: '"Courier New", monospace' }}>
                      Confirm Merge:
                    </h4>
                    <p className="text-sm text-gray-700 mb-1" style={{ fontFamily: '"Courier New", monospace' }}>
                      From: <strong>{mergePreview.from}</strong>
                    </p>
                    <p className="text-sm text-gray-700 mb-1" style={{ fontFamily: '"Courier New", monospace' }}>
                      To: <strong>{mergePreview.to}</strong>
                    </p>
                    <p className="text-sm text-gray-700 font-bold mt-2" style={{ fontFamily: '"Courier New", monospace' }}>
                      {mergePreview.ratingsCount} ratings will be moved
                    </p>
                  </div>
                  
                  <p className="text-xs text-red-600 mb-4" style={{ fontFamily: '"Courier New", monospace' }}>
                    Warning: This action cannot be undone!
                  </p>
                  
                  {/* Confirm Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setMergePreview(null);
                        setMergeFromRestaurant('');
                        setMergeToRestaurant('');
                      }}
                      className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg hover:bg-gray-50"
                      style={{ fontFamily: '"Courier New", monospace' }}
                      disabled={mergeLoading}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmMerge}
                      className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-bold"
                      style={{ fontFamily: '"Courier New", monospace' }}
                      disabled={mergeLoading}
                    >
                      {mergeLoading ? 'Merging...' : 'Confirm Merge'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Deleted Items Modal */}
      {showDeletedItems && (
        <>
          <div onClick={() => setShowDeletedItems(false)} className="fixed inset-0 bg-black/50 z-50" />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold" style={{ fontFamily: '"Courier New", monospace' }}>
                  Deleted Items (Trash)
                </h3>
                <button onClick={() => setShowDeletedItems(false)} className="text-gray-500 hover:text-gray-700">
                  <X size={24} />
                </button>
              </div>
              
              <p className="text-sm text-gray-600 mb-4" style={{ fontFamily: '"Courier New", monospace' }}>
                Items can be restored within 30 days of deletion.
              </p>
              
              {deletedItemsLoading ? (
                <div className="text-center py-8">
                  <div className="text-gray-500">Loading...</div>
                </div>
              ) : deletedItems.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-500 mb-2">🗑️</div>
                  <div className="text-sm text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>
                    No deleted items
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {deletedItems.map((item) => {
                    const daysLeft = Math.ceil((new Date(item.can_restore_until) - new Date()) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <div key={item.id} className="border-2 border-gray-200 rounded-lg p-3 hover:border-yellow-300 transition">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-bold text-sm" style={{ fontFamily: '"Courier New", monospace' }}>
                              {item.dish_name}
                            </h4>
                            <p className="text-xs text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>
                              Deleted: {new Date(item.deleted_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className={`text-xs px-2 py-1 rounded ${
                            daysLeft > 7 ? 'bg-green-100 text-green-700' :
                            daysLeft > 3 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`} style={{ fontFamily: '"Courier New", monospace' }}>
                            {daysLeft} days left
                          </div>
                        </div>
                        
                        <div className="flex gap-2 text-xs mb-2" style={{ fontFamily: '"Courier New", monospace' }}>
                          <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                            Taste: {item.taste_score}
                          </span>
                          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            Portion: {item.portion_score}
                          </span>
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">
                            Price Value: {item.price_value_score}
                          </span>
                        </div>
                        
                        {item.comment && (
                          <p className="text-xs text-gray-600 mb-2 italic" style={{ fontFamily: '"Courier New", monospace' }}>
                            "{item.comment}"
                          </p>
                        )}
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => restoreDeletedItem(item)}
                            className="flex-1 px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 text-xs font-bold"
                            style={{ fontFamily: '"Courier New", monospace' }}
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => permanentlyDeleteItem(item)}
                            className="flex-1 px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 text-xs font-bold"
                            style={{ fontFamily: '"Courier New", monospace' }}
                          >
                            Delete Forever
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Link Restaurants to Google Places Modal */}
      {showLinkRestaurants && (
        <>
          <div onClick={() => setShowLinkRestaurants(false)} className="fixed inset-0 bg-black/50 z-50" />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold" style={{ fontFamily: '"Courier New", monospace' }}>
                  Link Restaurants to Map
                </h3>
                <button onClick={() => {
                  setShowLinkRestaurants(false);
                  setLinkingRestaurant(null);
                  setPlaceSearchResults([]);
                }} className="text-gray-500 hover:text-gray-700">
                  <X size={24} />
                </button>
              </div>
              
              <p className="text-sm text-gray-600 mb-4" style={{ fontFamily: '"Courier New", monospace' }}>
                Link your restaurants to Google Places so they appear on the map with correct locations.
              </p>
              
              {!linkingRestaurant ? (
                /* List of unlinked restaurants */
                <div className="space-y-2">
                  {unlinkedRestaurants.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-2">🎉</div>
                      <div className="text-sm text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>
                        All restaurants are linked!
                      </div>
                    </div>
                  ) : (
                    unlinkedRestaurants.map((restaurant) => (
                      <div key={restaurant.id} className="border-2 border-gray-200 rounded-lg p-3 hover:border-green-300 transition flex justify-between items-center">
                        <div>
                          <h4 className="font-bold text-sm" style={{ fontFamily: '"Courier New", monospace' }}>
                            {restaurant.name}
                          </h4>
                          <p className="text-xs text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>
                            Not linked to map
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setLinkingRestaurant(restaurant);
                            searchGooglePlaces(restaurant.name);
                          }}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-bold"
                          style={{ fontFamily: '"Courier New", monospace' }}
                        >
                          Link
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                /* Google Places search results */
                <div>
                  <button
                    onClick={() => {
                      setLinkingRestaurant(null);
                      setPlaceSearchResults([]);
                    }}
                    className="mb-4 text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
                    style={{ fontFamily: '"Courier New", monospace' }}
                  >
                    ← Back to list
                  </button>
                  
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3 mb-4">
                    <h4 className="font-bold text-sm mb-1" style={{ fontFamily: '"Courier New", monospace' }}>
                      Linking: {linkingRestaurant.name}
                    </h4>
                    <p className="text-xs text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>
                      Select the correct location from Google Places:
                    </p>
                  </div>
                  
                  {placeSearchLoading ? (
                    <div className="text-center py-8">
                      <div className="text-gray-500">Searching Google Places...</div>
                    </div>
                  ) : placeSearchResults.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-gray-500 mb-2">No results found</div>
                      <button
                        onClick={() => searchGooglePlaces(linkingRestaurant.name)}
                        className="text-sm text-blue-600 hover:underline"
                        style={{ fontFamily: '"Courier New", monospace' }}
                      >
                        Try again
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {placeSearchResults.map((place, idx) => (
                        <div key={idx} className="border-2 border-gray-200 rounded-lg p-3 hover:border-green-300 transition">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <h4 className="font-bold text-sm" style={{ fontFamily: '"Courier New", monospace' }}>
                                {place.name}
                              </h4>
                              <p className="text-xs text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>
                                {place.formatted_address}
                              </p>
                              {place.rating && (
                                <p className="text-xs text-gray-500 mt-1" style={{ fontFamily: '"Courier New", monospace' }}>
                                  ⭐ {place.rating} ({place.user_ratings_total} reviews)
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => linkRestaurantToPlace(linkingRestaurant, place)}
                              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-bold ml-3"
                              style={{ fontFamily: '"Courier New", monospace' }}
                            >
                              Link This
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HuntersFindsApp;
