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
  const { dishes = [], restaurants = [], userRatings = [], loading: dataLoading } = useRealTimeData(user);
  
  const [rankingMode, setRankingMode] = useState('global');
  
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
  
  // Fetch all ratings when component mounts or when dishes change
  React.useEffect(() => {
    const newCount = ratingsCallCount + 1;
    setRatingsCallCount(newCount);
    console.log(`🔢 allRatings useEffect called - COUNT: ${newCount}`);
    
    const fetchAllRatings = async () => {
      console.log('📊 fetchAllRatings starting...');
      setAllRatingsLoading(true);
      try {
        const { data, error } = await supabase
          .from('ratings')
          .select(`
            *,
            dish:dishes(*)
          `)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('❌ Error fetching all ratings:', error);
        } else {
          console.log('✅ Fetched', data?.length || 0, 'total ratings from all users');
          setAllRatings(data || []);
        }
      } catch (error) {
        console.error('❌ Error fetching all ratings:', error);
      } finally {
        setAllRatingsLoading(false);
      }
    };

    fetchAllRatings();
  }, [dishes]); // Refetch when dishes change
  
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

        // Fetch all public groups for discovery
        console.log('📡 Fetching public groups...');
        const { data: publicGroups, error: publicError } = await supabase
          .from('groups')
          .select('*')
          .eq('privacy', 'public')
          .order('created_at', { ascending: false })
          .limit(50);

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
  const [activeTab, setActiveTab] = useState('rankings');
  const [selectedDish, setSelectedDish] = useState(null);
  const [dishModalView, setDishModalView] = useState('scores'); // 'scores', 'photos', 'comments'
  const [restaurantModalView, setRestaurantModalView] = useState('scores'); // 'scores', 'photos', 'comments'
  const [rankingView, setRankingView] = useState('dishes');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ dishes: [], restaurants: [] });
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);
  const [exploreView, setExploreView] = useState('for-you');
  const [youView, setYouView] = useState('profile');
  const [isNewListModalOpen, setIsNewListModalOpen] = useState(false);
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false);
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
  const [selectedUser, setSelectedUser] = useState(null);
  const [isUserModalClosing, setIsUserModalClosing] = useState(false);
  const [modalStack, setModalStack] = useState([]);
  const [restaurant, setRestaurant] = useState('');
  const [dishName, setDishName] = useState('');
  const [dishCategory, setDishCategory] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [price, setPrice] = useState('');
  const [tasteScore, setTasteScore] = useState(50);
  const [portionScore, setPortionScore] = useState(50);
  const [priceScore, setPriceScore] = useState(50);
  const [comment, setComment] = useState('');
  
  // Photo upload state
  const [dishPhotos, setDishPhotos] = useState([]);
  const [photoPreview, setPhotoPreview] = useState([]);
  
  // Auth form states
  const [authMode, setAuthMode] = useState('signin'); // 'signin' or 'signup'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFormLoading, setAuthFormLoading] = useState(false);

  // Mock groups data (temporary - empty array until backend ready)
  const mockGroups = [];
  
  // Mock users for friend search (temporary - until backend ready)
  const mockUsers = [];
  
  // Friend search state
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState([]);
  const [showFriendSearch, setShowFriendSearch] = useState(false);
  
  // Phase 4: Social Features State
  const [userFollows, setUserFollows] = useState([]); // People user follows (friends)
  const [suggestedFriends, setSuggestedFriends] = useState([]);
  const [activityFeed, setActivityFeed] = useState([]);
  const [activityFilter, setActivityFilter] = useState('all');
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
      setIsMapLoaded(true);
    };
    script.onerror = (error) => {
      console.error('Failed to load Leaflet:', error);
      setIsMapLoaded(false);
    };
    document.head.appendChild(script);
  }, []);

  const getSRRColor = (score) => {
    if (score >= 96) return 'text-purple-600';
    if (score >= 89) return 'text-yellow-500';
    if (score >= 81) return 'text-gray-400';
    if (score >= 72) return 'text-green-500';
    return 'text-blue-500';
  };

  const getTierBadge = (score) => {
    if (score >= 96) return { label: '💎', color: 'bg-purple-100 text-purple-700' };
    if (score >= 89) return { label: '🥇', color: 'bg-yellow-100 text-yellow-700' };
    if (score >= 81) return { label: '🏆', color: 'bg-gray-100 text-gray-700' };
    return { label: '✅', color: 'bg-green-100 text-green-700' };
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
    if (rankingMode === 'personal' && user && userRatings) {
      // Personal mode: show only user's own ratings
      return userRatings.map(rating => {
        const calculatedSRR = rating.overall_score || Math.round((rating.taste_score + rating.portion_score + rating.price_score) / 3);
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
          comments: 0
        };
      });
    }
    
    // Global mode: Calculate averages from ALL users' ratings
    return (dishes || []).map(dish => {
      // Find ALL ratings for this dish (from all users)
      const dishRatings = allRatings.filter(r => r.dish_id === dish.id);
      
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
        
        avgTaste = Math.round(totalTaste / dishRatings.length);
        avgPortion = Math.round(totalPortion / dishRatings.length);
        avgPrice = Math.round(totalPrice / dishRatings.length);
        calculatedSRR = totalSRR > 0 ? Math.round(totalSRR / dishRatings.length) : Math.round((avgTaste + avgPortion + avgPrice) / 3);
      }
      
      return {
        id: dish.id,
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
        comments: 0
      };
    });
  };

  // Memoize allDishes to prevent re-calculation on every render
  const allDishes = React.useMemo(() => {
    return getAllDishes();
  }, [rankingMode, user, userRatings, dishes, allRatings]);
  
  // Generate restaurants dynamically from rated dishes
  const allRestaurants = React.useMemo(() => {
    const restaurantMap = {};
    
    // First, add restaurants from database
    (restaurants || []).forEach(restaurant => {
      restaurantMap[restaurant.name] = restaurant;
    });
    
    // Then, add/update restaurants from rated dishes
    allDishes.forEach(dish => {
      const restaurantName = dish.restaurantName;
      if (!restaurantMap[restaurantName]) {
        // Create new restaurant entry
        restaurantMap[restaurantName] = {
          id: `generated-${restaurantName}`,
          name: restaurantName,
          cuisine: dish.cuisine,
          avgSRR: dish.srr,
          dishCount: 1,
          topDishes: [dish]
        };
      } else {
        // Update existing restaurant
        const existing = restaurantMap[restaurantName];
        if (!existing.dishCount) existing.dishCount = 0;
        if (!existing.topDishes) existing.topDishes = [];
        
        existing.dishCount += 1;
        existing.topDishes.push(dish);
        
        // Recalculate average SRR
        const totalSRR = existing.topDishes.reduce((sum, d) => sum + d.srr, 0);
        existing.avgSRR = Math.round(totalSRR / existing.topDishes.length);
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
  
  // Search function - searches both dishes and restaurants
  const performSearch = (query) => {
    if (!query || query.length < 2) {
      setSearchResults({ dishes: [], restaurants: [] });
      setShowSearchDropdown(false);
      return;
    }

    const lowerQuery = query.toLowerCase();

    // Search dishes
    const matchingDishes = allDishes.filter(dish => 
      dish.name.toLowerCase().includes(lowerQuery) ||
      dish.restaurantName.toLowerCase().includes(lowerQuery) ||
      dish.cuisine.toLowerCase().includes(lowerQuery)
    ).slice(0, 5); // Limit to 5 results

    // Search restaurants
    const matchingRestaurants = (restaurants || []).filter(restaurant =>
      restaurant.name.toLowerCase().includes(lowerQuery) ||
      restaurant.cuisine.toLowerCase().includes(lowerQuery)
    ).slice(0, 5); // Limit to 5 results

    setSearchResults({ dishes: matchingDishes, restaurants: matchingRestaurants });
    setShowSearchDropdown(true);
  };

  // Live search effect
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(searchQuery);
    }, 300); // Debounce 300ms

    return () => clearTimeout(timeoutId);
  }, [searchQuery, allDishes, restaurants]);
  
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
  
  // Fetch follows when on friends tab
  React.useEffect(() => {
    if (user && youView === 'friends') {
      fetchUserFollows();
      fetchSuggestedFriends();
    }
  }, [user, youView]);
  
  // Fetch activity feed when on activity tab
  React.useEffect(() => {
    if (user && youView === 'activity') {
      fetchActivityFeed();
    }
  }, [user, youView, activityFilter]);
  
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
  
  const categorySuggestions = Object.keys(categoryAverages || {}).filter(cat =>
    cat.toLowerCase().includes(categoryInput.toLowerCase())
  );

  const handleCloseResults = () => {
    setIsResultsClosing(true);
    setTimeout(() => {
      setIsResultsModalOpen(false);
      setIsResultsClosing(false);
      setRestaurant('');
      setDishName('');
      setDishCategory('');
      setCategoryInput('');
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
    const finalSRR = Math.round((tasteScore + priceScore + portionScore) / 3);

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
      // Check if this exact dish already exists (using restaurant_name, not restaurant_id)
      const { data: existingDishes, error: dishCheckError } = await supabase
        .from('dishes')
        .select('id, name')
        .eq('restaurant_name', restaurant.trim())
        .ilike('name', dishName.trim());

      let dishId;

      if (existingDishes && existingDishes.length > 0) {
        // Dish already exists
        dishId = existingDishes[0].id;
        console.log('✅ Using existing dish:', dishName);
        
        // Check if user already rated this dish
        const { data: existingRating } = await supabase
          .from('ratings')
          .select('id')
          .eq('dish_id', dishId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (existingRating) {
          // User already rated this dish - ask if they want to update
          setErrorModal({
            show: true,
            title: 'Already Rated',
            message: `You already rated "${dishName}". Would you like to update your rating?`,
            confirmAction: async () => {
              // Update existing rating
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
        // Create new dish (using restaurant_name instead of restaurant_id)
        const { data: newDish, error: dishError } = await supabase
          .from('dishes')
          .insert([{
            name: dishName.trim(),
            restaurant_name: restaurant.trim(),
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
      const { data, error } = await supabase
        .from('groups')
        .insert([groupData])
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Group created:', data);
      
      // Refresh user groups using same approach as useEffect
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

  const handleCloseRestaurant = () => {
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
            placeholder="search restaurants or dishes..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#33a29b]"
            style={{ fontFamily: '"Courier New", monospace' }}
          />
          
          {/* Search Results Dropdown */}
          {showSearchDropdown && (searchResults.dishes.length > 0 || searchResults.restaurants.length > 0) && (
            <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
              {/* Dishes Section */}
              {searchResults.dishes.length > 0 && (
                <div className="p-2">
                  <div className="text-xs font-bold text-gray-500 px-2 py-1 uppercase" style={{ fontFamily: '"Courier New", monospace' }}>
                    dishes ({searchResults.dishes.length})
                  </div>
                  {searchResults.dishes.map((dish, idx) => (
                    <div
                      key={`dish-${idx}`}
                      onClick={() => {
                        setSelectedDish(dish);
                        setShowSearchDropdown(false);
                        setSearchQuery('');
                      }}
                      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer transition"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-semibold" style={{ fontFamily: '"Courier New", monospace' }}>
                          {dish.name}
                        </div>
                        <div className="text-xs text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>
                          {dish.restaurantName} • {dish.cuisine}
                        </div>
                      </div>
                      <div className={`text-lg font-bold ${getSRRColor(dish.srr)}`} style={{ fontFamily: '"Courier New", monospace' }}>
                        {dish.srr}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Restaurants Section */}
              {searchResults.restaurants.length > 0 && (
                <div className="p-2 border-t border-gray-100">
                  <div className="text-xs font-bold text-gray-500 px-2 py-1 uppercase" style={{ fontFamily: '"Courier New", monospace' }}>
                    restaurants ({searchResults.restaurants.length})
                  </div>
                  {searchResults.restaurants.map((restaurant, idx) => (
                    <div
                      key={`restaurant-${idx}`}
                      onClick={() => {
                        setSelectedRestaurant(restaurant);
                        setShowSearchDropdown(false);
                        setSearchQuery('');
                      }}
                      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer transition"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-semibold" style={{ fontFamily: '"Courier New", monospace' }}>
                          {restaurant.name}
                        </div>
                        <div className="text-xs text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>
                          {restaurant.cuisine}
                        </div>
                      </div>
                      <div className={`text-lg font-bold ${getSRRColor(restaurant.avgSRR)}`} style={{ fontFamily: '"Courier New", monospace' }}>
                        {restaurant.avgSRR}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* No Results */}
              {searchQuery.length >= 2 && searchResults.dishes.length === 0 && searchResults.restaurants.length === 0 && (
                <div className="p-4 text-center text-gray-500 text-sm" style={{ fontFamily: '"Courier New", monospace' }}>
                  No results found for "{searchQuery}"
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pb-16">
        {/* MAP TAB */}
        {activeTab === 'map' && (
          <div className="h-full relative">
            {isMapLoaded ? (
              <div className="h-full w-full relative">
                <div 
                  ref={(el) => {
                    if (el && window.L && !el.dataset.initialized) {
                      el.dataset.initialized = 'true';
                      
                      try {
                        // Initialize Leaflet map
                        const map = window.L.map(el, {
                          center: [37.8044, -122.2712],
                          zoom: 14,
                          zoomControl: true
                        });

                        // Add OpenStreetMap tile layer
                        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                          attribution: '© OpenStreetMap contributors',
                          maxZoom: 19
                        }).addTo(map);

                        // Add markers for each restaurant
                        (restaurants || []).forEach(restaurant => {
                          // Determine marker color based on SRR score
                          const markerColor = restaurant.avgSRR >= 90 ? '#a855f7' : 
                                            restaurant.avgSRR >= 85 ? '#eab308' : '#33a29b';
                          
                          // Create custom icon
                          const icon = window.L.divIcon({
                            className: 'custom-marker',
                            html: `
                              <div style="
                                width: 30px;
                                height: 30px;
                                background-color: ${markerColor};
                                border: 3px solid white;
                                border-radius: 50%;
                                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                font-weight: bold;
                                color: white;
                                font-size: 12px;
                                cursor: pointer;
                              ">${restaurant.avgSRR}</div>
                            `,
                            iconSize: [30, 30],
                            iconAnchor: [15, 15]
                          });

                          // Create marker
                          const marker = window.L.marker([restaurant.location.lat, restaurant.location.lng], {
                            icon: icon,
                            title: restaurant.name
                          }).addTo(map);

                          // Create popup content
                          const popupContent = `
                            <div style="font-family: 'Courier New', monospace; padding: 4px; min-width: 180px;">
                              <h3 style="font-weight: bold; margin: 0 0 4px 0; font-size: 14px;">${restaurant.name}</h3>
                              <p style="margin: 0 0 4px 0; font-size: 11px; color: #666;">${restaurant.cuisine}</p>
                              <p style="margin: 0 0 8px 0; font-size: 10px; color: #999;">${restaurant.location.address}</p>
                              <div style="display: flex; align-items: center; gap: 8px; padding-top: 8px; border-top: 1px solid #eee;">
                                <span style="font-size: 20px; font-weight: bold; color: ${markerColor};">${restaurant.avgSRR}</span>
                                <span style="font-size: 11px; color: #666;">SRR Score</span>
                              </div>
                            </div>
                          `;

                          marker.bindPopup(popupContent);

                          // Click marker to open restaurant modal
                          marker.on('click', () => {
                            setSelectedRestaurant(restaurant);
                          });
                        });
                        
                        console.log('Map initialized successfully');
                      } catch (error) {
                        console.error('Error initializing map:', error);
                      }
                    }
                  }}
                  className="w-full h-full"
                  style={{ zIndex: 0 }}
                />
                
                {/* Map Legend */}
                <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 z-10" style={{ fontFamily: '"Courier New", monospace' }}>
                  <h4 className="text-xs font-bold mb-2">Score Legend</h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-purple-500 border-2 border-white"></div>
                      <span>90+ (Elite)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500 border-2 border-white"></div>
                      <span>85-89 (Great)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#33a29b] border-2 border-white"></div>
                      <span>&lt;85 (Good)</span>
                    </div>
                  </div>
                </div>

                {/* Search Box */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-10">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search for restaurants or dishes..."
                      className="w-full pl-9 pr-3 py-2.5 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#33a29b] bg-white shadow-lg"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center bg-gray-100 p-4">
                <div className="text-center max-w-md">
                  <MapPin size={48} className="mx-auto mb-4 text-gray-400 animate-pulse" />
                  <p className="text-sm text-gray-600 mb-2" style={{ fontFamily: '"Courier New", monospace' }}>Loading map...</p>
                  <p className="text-xs text-gray-400" style={{ fontFamily: '"Courier New", monospace' }}>Using free OpenStreetMap (no API key needed)</p>
                  <p className="text-xs text-gray-400 mt-2" style={{ fontFamily: '"Courier New", monospace' }}>Check browser console for any errors</p>
                  <button 
                    onClick={() => {
                      console.log('Leaflet status:', window.L ? 'Loaded' : 'Not loaded');
                      console.log('Map state:', isMapLoaded);
                    }}
                    className="mt-4 px-4 py-2 bg-[#33a29b] text-white rounded text-xs hover:bg-[#2a8a84]"
                  >
                    Debug Map Status
                  </button>
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
                      {getFilteredDishes().map((dish, idx) => {
                        const badge = getTierBadge(dish.srr);
                        return (
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
                              </div>
                              <span className={`text-xs px-2 py-1 rounded float-badge ${badge.color}`}>{badge.label}</span>
                              <div className={`text-2xl font-bold ${getSRRColor(dish.srr)} ${dish.srr >= 90 ? 'score-shine' : ''}`}>{dish.srr}</div>
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
                  {getFilteredRestaurants().sort((a, b) => b.avgSRR - a.avgSRR).map((restaurant, idx) => {
                    const badge = getTierBadge(restaurant.avgSRR);
                    return (
                      <div key={idx} className="bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition cursor-pointer stagger-item" onClick={() => setSelectedRestaurant(restaurant)}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 text-center text-lg font-bold text-gray-400">#{idx + 1}</div>
                          <div className="flex-1">
                            <div className="font-semibold text-sm">{restaurant.name}</div>
                            <div className="text-xs text-gray-500">{restaurant.cuisine}</div>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded float-badge ${badge.color}`}>{badge.label}</span>
                          <div className={`text-2xl font-bold ${getSRRColor(restaurant.avgSRR)} ${restaurant.avgSRR >= 90 ? 'score-shine' : ''}`}>{restaurant.avgSRR}</div>
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
            <div className="bg-white border-b px-4 py-2 flex gap-2">
              <button onClick={() => setExploreView('for-you')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${exploreView === 'for-you' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>for you</button>
              <button onClick={() => setExploreView('people')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${exploreView === 'people' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>people</button>
              <button onClick={() => setExploreView('groups')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${exploreView === 'groups' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>groups</button>
            </div>

            <div className="max-w-4xl mx-auto p-4">
              {exploreView === 'for-you' && (
                <>
                  {userRatings.length < 3 ? (
                    <EmptyState
                      icon={Compass}
                      title="not enough data yet"
                      message="Rate more dishes to get personalized recommendations"
                      actionText="rate now"
                      onAction={() => setIsSubmissionModalOpen(true)}
                    />
                  ) : (() => {
                    const recommendations = getRecommendations();
                    
                    if (recommendations.length === 0) {
                      return (
                        <EmptyState
                          icon={Compass}
                          title="no recommendations yet"
                          message="Rate more diverse dishes to get personalized suggestions"
                          actionText="rate now"
                          onAction={() => setIsSubmissionModalOpen(true)}
                        />
                      );
                    }

                    return (
                      <div className="space-y-3">
                        <h2 className="text-lg font-bold mb-4" style={{ fontFamily: '"Courier New", monospace' }}>dishes you might like</h2>
                        {recommendations.map((dish, idx) => {
                          const badge = getTierBadge(dish.srr);
                          return (
                            <div 
                              key={dish.id}
                              onClick={() => setSelectedDish(dish)}
                              className="bg-white rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 text-center text-lg font-bold text-gray-400">#{idx + 1}</div>
                                <div className="flex-1">
                                  <h4 className="font-bold text-sm" style={{ fontFamily: '"Courier New", monospace' }}>{dish.name}</h4>
                                  <p className="text-xs text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>
                                    {dish.restaurantName} • {dish.cuisine} • ${dish.price?.toFixed(2)}
                                  </p>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded ${badge.color}`}>{badge.label}</span>
                                <div className={`text-2xl font-bold ${getSRRColor(dish.srr)}`} style={{ fontFamily: '"Courier New", monospace' }}>
                                  {dish.srr}
                                </div>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSaveItem(dish, 'dish');
                                  }}
                                  className={`px-2 py-1 rounded text-xs transition ${
                                    isItemSaved(dish.id, 'dish')
                                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                                >
                                  <Bookmark size={14} className={isItemSaved(dish.id, 'dish') ? 'fill-current inline' : 'inline'} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </>
              )}

              {exploreView === 'groups' && (
                <div className="space-y-3">
                  <h2 className="text-lg font-bold mb-4">explore groups</h2>
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
                onClick={() => setYouView('friends')} 
                disabled={!user}
                className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap font-medium transition relative ${
                  youView === 'friends' 
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
                    
                    <button
                      onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                      className="w-full text-sm text-gray-600 hover:text-[#33a29b] transition"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    >
                      {authMode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
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
                          setErrorModal({
                            show: true,
                            title: 'Coming Soon',
                            message: 'Edit profile will be available soon!'
                          });
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
                        <div className={`text-lg font-bold ${getSRRColor(dish.srr)}`}>{dish.srr}</div>
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
                      onClick={() => setSelectedDish(dish)}
                      className="bg-white rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Image size={24} className="text-gray-400" />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-sm" style={{ fontFamily: '"Courier New", monospace' }}>{dish.name}</div>
                          <div className="text-xs text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>{dish.restaurantName} • ${dish.price.toFixed(2)}</div>
                          <div className="text-xs text-gray-400 mt-1" style={{ fontFamily: '"Courier New", monospace' }}>rated 2 days ago</div>
                        </div>
                        <div className={`text-2xl font-bold ${getSRRColor(dish.srr)}`} style={{ fontFamily: '"Courier New", monospace' }}>{dish.srr}</div>
                      </div>
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
                  {[].map(group => (
                    <div 
                      key={group.id} 
                      onClick={() => {
                        const fullGroup = mockGroups.find(g => g.name === group.name) || mockGroups[0];
                        setSelectedGroup(fullGroup);
                      }}
                      className="bg-white rounded-lg p-4 shadow-sm cursor-pointer hover:shadow-md transition"
                    >
                      <h3 className="font-bold" style={{ fontFamily: '"Courier New", monospace' }}>{group.name}</h3>
                      <p className="text-xs text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>{group.members} members • {group.rankedItems} ranked items</p>
                    </div>
                  ))}
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

              {youView === 'friends' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold" style={{ fontFamily: '"Courier New", monospace' }}>friends</h2>
                  </div>
                  
                  {/* Friend Search Bar */}
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                      type="text"
                      value={friendSearchQuery}
                      onChange={(e) => setFriendSearchQuery(e.target.value)}
                      onFocus={() => setShowFriendSearch(true)}
                      placeholder="search by username..."
                      className="w-full pl-9 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#33a29b]"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    />
                    
                    {/* Friend Search Results Dropdown */}
                    {showFriendSearch && friendSearchQuery.length >= 2 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                        {friendSearchResults.length > 0 ? (
                          <div className="p-2">
                            <div className="text-xs font-bold text-gray-500 px-2 py-1 uppercase" style={{ fontFamily: '"Courier New", monospace' }}>
                              users found ({friendSearchResults.length})
                            </div>
                            {friendSearchResults.map((foundUser) => (
                              <div
                                key={foundUser.id}
                                className="p-3 hover:bg-gray-50 rounded cursor-pointer transition border-b last:border-b-0"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="font-bold text-sm" style={{ fontFamily: '"Courier New", monospace' }}>
                                      @{foundUser.username}
                                    </div>
                                    <div className="text-xs text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>
                                      {foundUser.email}
                                    </div>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFollowUser(foundUser);
                                      setShowFriendSearch(false);
                                      setFriendSearchQuery('');
                                    }}
                                    className="px-3 py-1 bg-[#33a29b] text-white text-xs rounded-lg font-semibold hover:bg-[#2a8a84] transition"
                                    style={{ fontFamily: '"Courier New", monospace' }}
                                  >
                                    follow
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 text-center text-gray-500 text-sm" style={{ fontFamily: '"Courier New", monospace' }}>
                            No users found for "{friendSearchQuery}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Suggested Friends Section */}
                  {user && suggestedFriends.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: '"Courier New", monospace' }}>
                        suggested for you
                      </h3>
                      <div className="space-y-2">
                        {suggestedFriends.slice(0, 3).map(suggested => (
                          <div 
                            key={suggested.id}
                            className="bg-white rounded-lg p-3 shadow-sm border border-gray-200"
                          >
                            <div className="flex justify-between items-center">
                              <div className="flex-1">
                                <div className="font-bold text-sm" style={{ fontFamily: '"Courier New", monospace' }}>
                                  @{suggested.username}
                                </div>
                                <div className="text-xs text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>
                                  {suggested.ratings_count} ratings • {suggested.suggestion_reason}
                                </div>
                              </div>
                              <button
                                onClick={() => handleFollowUser(suggested)}
                                className="px-3 py-1 bg-[#33a29b] text-white text-xs rounded-lg font-semibold hover:bg-[#2a8a84] transition"
                                style={{ fontFamily: '"Courier New", monospace' }}
                              >
                                follow
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Current Friends List */}
                  <h3 className="text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: '"Courier New", monospace' }}>
                    your friends
                  </h3>
                  {user ? (
                    userFollows.length > 0 ? (
                      userFollows.map(friend => (
                        <div 
                          key={friend.id}
                          onClick={() => setSelectedUser(friend)}
                          className="bg-white rounded-lg p-4 shadow-sm cursor-pointer hover:shadow-md transition mb-2"
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <h3 className="font-bold" style={{ fontFamily: '"Courier New", monospace' }}>@{friend.username}</h3>
                              <p className="text-xs text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>{friend.location}</p>
                              <p className="text-xs text-gray-400 mt-1" style={{ fontFamily: '"Courier New", monospace' }}>{friend.ratings} ratings • {friend.friends} friends</p>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-[#33a29b]" style={{ fontFamily: '"Courier New", monospace' }}>{friend.overlap}%</div>
                              <div className="text-xs text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>overlap</div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <EmptyState
                        icon={UserPlus}
                        title="no friends yet"
                        message="Search for users above to add your first friend!"
                      />
                    )
                  ) : (
                    <div className="bg-white rounded-lg p-6 shadow-sm text-center">
                      <p className="text-gray-600 mb-4" style={{ fontFamily: '"Courier New", monospace' }}>
                        Please log in to see your friends
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

              {youView === 'activity' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold" style={{ fontFamily: '"Courier New", monospace' }}>activity feed</h2>
                    <select 
                      value={activityFilter}
                      onChange={(e) => setActivityFilter(e.target.value)}
                      className="text-xs border-2 border-gray-200 rounded-lg px-2 py-1"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    >
                      <option value="all">all activity</option>
                      <option value="rating">ratings</option>
                      <option value="group_join">groups</option>
                      <option value="tag_add">tags</option>
                      <option value="save">saves</option>
                    </select>
                  </div>
                  
                  {user ? (
                    activityFeed.length > 0 ? (
                      <div className="space-y-2">
                        {activityFeed.map(activity => (
                          <div 
                            key={activity.id}
                            className="bg-white rounded-lg p-4 shadow-sm"
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#33a29b]/10 flex items-center justify-center flex-shrink-0">
                                {activity.activity_type === 'rating' && <Star size={16} className="text-[#33a29b]" />}
                                {activity.activity_type === 'group_join' && <Users size={16} className="text-[#33a29b]" />}
                                {activity.activity_type === 'tag_add' && <Tag size={16} className="text-[#33a29b]" />}
                                {activity.activity_type === 'save' && <Bookmark size={16} className="text-[#33a29b]" />}
                                {activity.activity_type === 'follow' && <UserPlus size={16} className="text-[#33a29b]" />}
                              </div>
                              <div className="flex-1">
                                <div className="font-bold text-sm" style={{ fontFamily: '"Courier New", monospace' }}>
                                  @{activity.username}
                                </div>
                                <div className="text-sm text-gray-600 mt-1" style={{ fontFamily: '"Courier New", monospace' }}>
                                  {activity.activity_type === 'rating' && `rated ${activity.content.dish_name} (${activity.content.score})`}
                                  {activity.activity_type === 'group_join' && `joined ${activity.content.group_name}`}
                                  {activity.activity_type === 'tag_add' && `added tags to ${activity.content.dish_name}`}
                                  {activity.activity_type === 'save' && `saved ${activity.content.item_name}`}
                                  {activity.activity_type === 'follow' && `started following @${activity.content.following_username}`}
                                </div>
                                <div className="text-xs text-gray-400 mt-1" style={{ fontFamily: '"Courier New", monospace' }}>
                                  {new Date(activity.created_at).toLocaleDateString()} at {new Date(activity.created_at).toLocaleTimeString()}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        icon={Activity}
                        title="no activity yet"
                        message="Follow friends to see their activity here!"
                      />
                    )
                  ) : (
                    <div className="bg-white rounded-lg p-6 shadow-sm text-center">
                      <p className="text-gray-600 mb-4" style={{ fontFamily: '"Courier New", monospace' }}>
                        Please log in to see activity
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
                            onClick={() => alert('Edit profile coming soon!')}
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
                          onClick={() => alert('Profile visibility settings coming soon!')}
                          className="w-full text-left text-sm py-2 hover:text-[#33a29b] transition" 
                          style={{ fontFamily: '"Courier New", monospace' }}
                        >
                          profile visibility
                        </button>
                        <button 
                          onClick={() => alert('Rating privacy settings coming soon!')}
                          className="w-full text-left text-sm py-2 hover:text-[#33a29b] transition" 
                          style={{ fontFamily: '"Courier New", monospace' }}
                        >
                          who can see my ratings
                        </button>
                      </div>

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
          <div onClick={handleCloseSubmission} className={`fixed inset-0 bg-black/40 z-50 ${isSubmissionClosing ? 'animate-fade-out' : 'animate-fade-in'}`} />
          <div className={`fixed left-1/2 -translate-x-1/2 z-50 bg-white rounded-2xl shadow-xl overflow-hidden ${isSubmissionClosing ? 'animate-slide-down-fade' : 'animate-slide-up-fade'}`} style={{ top: '15%', width: '80%', maxWidth: '1000px', maxHeight: '75vh' }}>
            <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex justify-center items-center relative">
              <h2 className="text-lg font-bold text-center" style={{ fontFamily: '"Courier New", monospace' }}>rate a dish</h2>
              <button onClick={handleCloseSubmission} className="absolute right-4"><X size={24} /></button>
            </div>
            <div className="overflow-y-auto h-full pb-4 p-4">
              <div className="max-w-xl mx-auto space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: '"Courier New", monospace' }}>restaurant</label>
                    <input 
                      type="text" 
                      value={restaurant} 
                      onChange={(e) => setRestaurant(e.target.value)} 
                      placeholder="e.g., taco palace" 
                      className="w-full px-2 py-1.5 text-xs border-2 border-gray-200 rounded-lg focus:border-[#33a29b] focus:outline-none"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: '"Courier New", monospace' }}>food</label>
                    <input 
                      type="text" 
                      value={dishName} 
                      onChange={(e) => setDishName(e.target.value)} 
                      placeholder="e.g., carne asada tacos" 
                      className="w-full px-2 py-1.5 text-xs border-2 border-gray-200 rounded-lg focus:border-[#33a29b] focus:outline-none"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: '"Courier New", monospace' }}>category</label>
                    <input
                      type="text"
                      value={categoryInput}
                      onChange={(e) => {
                        const inputValue = e.target.value;
                        setCategoryInput(inputValue);
                        setShowCategorySuggestions(true);
                        // ALWAYS accept category (existing or new) - no restrictions!
                        setDishCategory(inputValue.toLowerCase().trim());
                      }}
                      onFocus={() => setShowCategorySuggestions(true)}
                      placeholder="start typing..."
                      className="w-full px-2 py-1.5 text-xs border-2 border-gray-200 rounded-lg focus:border-[#33a29b] focus:outline-none"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    />
                    {showCategorySuggestions && categoryInput && categorySuggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {categorySuggestions.map((category) => (
                          <div 
                            key={category} 
                            onClick={() => handleCategorySelect(category)} 
                            className="px-2 py-1.5 hover:bg-orange-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium text-xs text-gray-800" style={{ fontFamily: '"Courier New", monospace' }}>{category}</div>
                            <div className="text-[10px] text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>avg: ${categoryAverages[category]}</div>
                          </div>
                        ))}
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

                <div className="border-t-2 border-gray-100 pt-3 mt-3">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3" style={{ fontFamily: '"Courier New", monospace' }}>rating scores</h3>

                  {/* Taste Slider */}
                  <div className="mb-3">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-gray-700" style={{ fontFamily: '"Courier New", monospace' }}>taste</label>
                      <span className="text-sm font-bold text-orange-600" style={{ fontFamily: '"Courier New", monospace' }}>{tasteScore}</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="100" 
                      value={tasteScore} 
                      onChange={(e) => setTasteScore(parseInt(e.target.value))} 
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #fb923c 0%, #fb923c ${tasteScore}%, #e5e7eb ${tasteScore}%, #e5e7eb 100%)`
                      }}
                    />
                  </div>

                  {/* Price Value Display */}
                  <div className="bg-green-50 border-2 border-green-200 rounded-lg p-2 mb-3">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-gray-700" style={{ fontFamily: '"Courier New", monospace' }}>price value (auto)</label>
                      <div className="text-right">
                        <span className="text-sm font-bold text-green-600" style={{ fontFamily: '"Courier New", monospace' }}>{priceScore}</span>
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
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${priceScore}%` }}></div>
                    </div>
                  </div>

                  {/* Portion Slider */}
                  <div className="mb-3">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-gray-700" style={{ fontFamily: '"Courier New", monospace' }}>portion</label>
                      <span className="text-sm font-bold text-blue-600" style={{ fontFamily: '"Courier New", monospace' }}>{portionScore}</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="100" 
                      value={portionScore} 
                      onChange={(e) => setPortionScore(parseInt(e.target.value))} 
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #60a5fa 0%, #60a5fa ${portionScore}%, #e5e7eb ${portionScore}%, #e5e7eb 100%)`
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

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: '"Courier New", monospace' }}>comment (optional)</label>
                  <textarea 
                    value={comment} 
                    onChange={(e) => setComment(e.target.value)} 
                    placeholder="share your thoughts..." 
                    rows="2" 
                    className="w-full px-2 py-1.5 text-xs border-2 border-gray-200 rounded-lg focus:border-[#33a29b] focus:outline-none resize-none" 
                    style={{ fontFamily: '"Courier New", monospace' }}
                  />
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
                    <p className="text-xs font-medium text-gray-700" style={{ fontFamily: '"Courier New", monospace' }}>{selectedDish.restaurantName}</p>
                    <p className="text-[10px] text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>${selectedDish.price.toFixed(2)} • {selectedDish.numRatings} ratings</p>
                  </div>
                </div>

                {/* Overall Score Display - Matching Restaurant Style */}
                <div className="bg-gradient-to-r from-[#33a29b]/10 to-[#2a8a84]/10 rounded-lg px-3 py-1.5 border border-[#33a29b]/30 mb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[8px] text-gray-600 uppercase" style={{ fontFamily: '"Courier New", monospace' }}>Overall Score</div>
                      <div className={`text-2xl font-bold leading-none ${getSRRColor(overallSRR)}`} style={{ fontFamily: '"Courier New", monospace' }}>{overallSRR}</div>
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
                    COMMENTS ({selectedDish.comments || 0})
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
                    {(!selectedDish.photos || selectedDish.photos === 0) ? (
                      <EmptyState
                        icon={Image}
                        title="no photos yet"
                        message="Be the first to add a photo of this dish!"
                        actionText="add photo"
                        onAction={() => {
                          setErrorModal({
                            show: true,
                            title: 'Coming Soon',
                            message: 'Photo uploads will be available soon!'
                          });
                        }}
                      />
                    ) : (
                      <div className="text-sm text-gray-500 text-center py-8" style={{ fontFamily: '"Courier New", monospace' }}>
                        Photo gallery coming soon!
                      </div>
                    )}
                  </div>
                )}

                {/* Comments View */}
                {dishModalView === 'comments' && (
                  <div className="space-y-3">
                    {(!selectedDish.comments || selectedDish.comments === 0) ? (
                      <EmptyState
                        icon={MessageSquare}
                        title="no comments yet"
                        message="Be the first to comment on this dish!"
                        actionText="add comment"
                        onAction={() => {
                          setErrorModal({
                            show: true,
                            title: 'Coming Soon',
                            message: 'Comments will be available soon!'
                          });
                        }}
                      />
                    ) : (
                      <div className="text-sm text-gray-500 text-center py-8" style={{ fontFamily: '"Courier New", monospace' }}>
                        Comments section coming soon!
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
        );
      })()}

      {/* User Profile Modal */}
      {/* User Profile Modal - Direct Access (not from nested navigation) */}
      {selectedUser && !hasModalInStack() && (
        <>
          <div onClick={handleCloseUser} className={`fixed inset-0 bg-black/40 z-50 ${isUserModalClosing ? 'animate-fade-out' : 'animate-fade-in'}`} style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />
          <div className={`fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none`}>
            <div className={`bg-white rounded-xl max-w-2xl w-full max-h-[70vh] overflow-y-auto pointer-events-auto ${isUserModalClosing ? 'animate-slide-down-fade-simple' : 'animate-slide-up-fade-simple'}`}>
              <div className="sticky top-0 bg-white border-b px-4 py-3 flex justify-between items-center">
                <h2 className="text-lg font-bold" style={{ fontFamily: '"Courier New", monospace' }}>@{selectedUser.username}</h2>
                <button onClick={handleCloseUser} className="text-gray-500 hover:text-gray-700">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                {/* Profile Stats */}
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex justify-between mb-3">
                    <div>
                      <h3 className="text-xl font-bold" style={{ fontFamily: '"Courier New", monospace' }}>@{selectedUser.username}</h3>
                      <p className="text-sm text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>{selectedUser.location}</p>
                    </div>
                    <button className="px-3 py-1.5 bg-[#33a29b] text-white rounded-lg text-sm hover:bg-[#2a8a84] transition">
                      <UserPlus size={14} className="inline mr-1" />add friend
                    </button>
                  </div>
                  <div className="flex gap-4 text-center py-3 border-t border-b">
                    <div className="flex-1">
                      <div className="font-bold text-lg" style={{ fontFamily: '"Courier New", monospace' }}>{selectedUser.ratings}</div>
                      <div className="text-xs text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>ratings</div>
                    </div>
                    <div className="flex-1 border-l">
                      <div className="font-bold text-lg" style={{ fontFamily: '"Courier New", monospace' }}>{selectedUser.friends}</div>
                      <div className="text-xs text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>friends</div>
                    </div>
                    <div className="flex-1 border-l">
                      <div className="font-bold text-lg text-[#33a29b]" style={{ fontFamily: '"Courier New", monospace' }}>{selectedUser.overlap}%</div>
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
                      onClick={() => {
                        pushModal('user', selectedUser);
                        pushModal('dish', dish);
                      }}
                      className="flex justify-between py-2 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 transition"
                    >
                      <div>
                        <div className="text-sm font-medium" style={{ fontFamily: '"Courier New", monospace' }}>#{idx + 1} {dish.name}</div>
                        <div className="text-xs text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>{dish.restaurantName}</div>
                      </div>
                      <div className={`text-lg font-bold ${getSRRColor(dish.srr)}`} style={{ fontFamily: '"Courier New", monospace' }}>{dish.srr}</div>
                    </div>
                  ))}
                </div>

                {/* Shared Groups */}
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: '"Courier New", monospace' }}>shared groups (2)</h3>
                  {mockGroups.slice(0, 2).map((group, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => {
                        pushModal('user', selectedUser);
                        pushModal('group', group);
                      }}
                      className="flex justify-between items-center py-2 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 transition"
                    >
                      <div>
                        <div className="text-sm font-medium" style={{ fontFamily: '"Courier New", monospace' }}>{group.name}</div>
                        <div className="text-xs text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>{group.members} members</div>
                      </div>
                      <div className={`text-base font-bold ${getSRRColor(group.score / 3)}`} style={{ fontFamily: '"Courier New", monospace' }}>{group.score}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Restaurant Detail Modal - Optimized Compact View */}
      {selectedRestaurant && (
        <>
          <div onClick={handleCloseRestaurant} className={`fixed inset-0 bg-black/40 z-60 ${isRestaurantModalClosing ? 'animate-fade-out' : 'animate-fade-in'}`} style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />
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
              
              
              <div className="p-3">
                {/* Restaurant Info */}
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-700" style={{ fontFamily: '"Courier New", monospace' }}>{selectedRestaurant.cuisine}</p>
                    <p className="text-[10px] text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>
                      {selectedRestaurant.dishCount || 0} dish{selectedRestaurant.dishCount !== 1 ? 'es' : ''} rated
                    </p>
                  </div>
                </div>

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
                                  {dish.srr}
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
      {isNewGroupModalOpen && (
        <>
          <div onClick={handleCloseNewGroup} className={`fixed inset-0 bg-black/40 z-50 ${isNewGroupModalClosing ? 'animate-fade-out' : 'animate-fade-in'}`} />
          <div className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-xl w-[90%] max-w-md max-h-[80vh] overflow-hidden ${isNewGroupModalClosing ? 'animate-slide-down-fade' : 'animate-slide-up-fade'}`} style={{ transform: isNewGroupModalClosing ? 'translate(-50%, calc(-50% + 30px))' : 'translate(-50%, -50%)' }}>
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex justify-between items-center">
              <h2 className="text-lg font-bold" style={{ fontFamily: '"Courier New", monospace' }}>create new group</h2>
              <button onClick={handleCloseNewGroup} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-60px)]">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: '"Courier New", monospace' }}>group name</label>
                  <input 
                    type="text" 
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g., oakland food lovers"
                    className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:border-[#33a29b] focus:outline-none"
                    style={{ fontFamily: '"Courier New", monospace' }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: '"Courier New", monospace' }}>add members</label>
                  <div className="relative">
                    <UserPlus size={16} className="absolute left-3 top-2.5 text-gray-400" />
                    <input 
                      type="text"
                      value={groupMemberSearch}
                      onChange={(e) => setGroupMemberSearch(e.target.value)}
                      placeholder="search friends..."
                      className="w-full pl-9 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:border-[#33a29b] focus:outline-none"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    />
                  </div>
                </div>

                {newGroupMembers.length > 0 && (
                  <div className="border-t pt-3">
                    <h3 className="text-xs font-semibold text-gray-700 mb-2" style={{ fontFamily: '"Courier New", monospace' }}>members ({newGroupMembers.length})</h3>
                    <div className="space-y-2">
                      {newGroupMembers.map((member, idx) => (
                        <div key={idx} className="bg-gray-50 rounded-lg p-2 text-xs flex items-center gap-2">
                          <User size={14} />
                          <span style={{ fontFamily: '"Courier New", monospace' }}>{member}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button 
                  onClick={() => {
                    handleCloseNewGroup();
                  }}
                  disabled={!newGroupName}
                  className="w-full bg-[#33a29b] text-white py-2.5 rounded-lg font-bold text-sm hover:bg-[#2a8a84] transition disabled:bg-gray-300"
                  style={{ fontFamily: '"Courier New", monospace' }}
                >
                  CREATE GROUP
                </button>
              </div>
            </div>
          </div>
        </>
      )}

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
                          <div className={`text-lg font-bold ${getSRRColor(dish.srr)}`} style={{ fontFamily: '"Courier New", monospace' }}>{dish.srr}</div>
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
                                <div className={`text-2xl font-bold ${getSRRColor(dish.srr)}`} style={{ fontFamily: '"Courier New", monospace' }}>{dish.srr}</div>
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
                      <span className="text-sm">👑</span>
                      <div>
                        <div className="text-[10px] text-gray-600" style={{ fontFamily: '"Courier New", monospace' }}>#1 ranked</div>
                        <div className="text-xs font-bold text-gray-800" style={{ fontFamily: '"Courier New", monospace' }}>{submittedRating.ranking.topRanked.name}</div>
                      </div>
                    </div>
                    <div className={`text-base font-bold ${getSRRColor(submittedRating.ranking.topRanked.srr)}`} style={{ fontFamily: '"Courier New", monospace' }}>
                      {submittedRating.ranking.topRanked.srr}
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
                        #{submittedRating.ranking.rank - 1} · {submittedRating.ranking.aboveItem.srr}
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
                        #{submittedRating.ranking.rank + 1} · {submittedRating.ranking.belowItem.srr}
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
                      cancel
                    </button>
                    <button
                      onClick={() => {
                        errorModal.confirmAction();
                        setErrorModal({ show: false, title: '', message: '' });
                      }}
                      className="flex-1 px-4 py-2 bg-[#33a29b] text-white rounded-lg font-semibold hover:bg-[#2a8a84] transition"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    >
                      confirm
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
      
    </div>
  );
};

export default HuntersFindsApp;