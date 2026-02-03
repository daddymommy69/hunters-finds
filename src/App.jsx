import React, { useState, useEffect } from 'react';
import { MapPin, TrendingUp, Plus, Search, X, Image, MessageSquare, Users, Compass, User, UserPlus, Bookmark, Star, List, Settings } from 'lucide-react';

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


const mockRestaurants = [
  { id: 1, name: "taco palace", cuisine: "mexican", avgSRR: 87,
    location: { lat: 37.8044, lng: -122.2712, address: "123 Telegraph Ave, Oakland, CA" },
    photos: ['🌮', '🌯', '🥑'],
    recentScores: [
      { user: 'alice', date: '2026-01-28', taste: 85, portion: 90, overall: 87 },
      { user: 'bob', date: '2026-01-27', taste: 88, portion: 85, overall: 86 },
      { user: 'charlie', date: '2026-01-26', taste: 90, portion: 88, overall: 89 },
      { user: 'diana', date: '2026-01-25', taste: 82, portion: 87, overall: 84 },
      { user: 'evan', date: '2026-01-24', taste: 87, portion: 89, overall: 88 }
    ],
    topDishes: [
      { id: 'd1', name: "carne asada tacos", srr: 92, price: 8.50, numRatings: 24, photos: 15, comments: 18 },
      { id: 'd2', name: "california burrito", srr: 89, price: 11.00, numRatings: 18, photos: 12, comments: 14 }
    ]
  },
  { id: 2, name: "joe's diner", cuisine: "american", avgSRR: 82,
    location: { lat: 37.8088, lng: -122.2690, address: "456 Broadway, Oakland, CA" },
    photos: ['🍔', '🍟', '🥤'],
    recentScores: [
      { user: 'frank', date: '2026-01-29', taste: 80, portion: 85, overall: 82 },
      { user: 'grace', date: '2026-01-28', taste: 82, portion: 83, overall: 82 },
      { user: 'henry', date: '2026-01-27', taste: 78, portion: 84, overall: 81 },
      { user: 'iris', date: '2026-01-26', taste: 84, portion: 82, overall: 83 },
      { user: 'jack', date: '2026-01-25', taste: 81, portion: 80, overall: 80 }
    ],
    topDishes: [
      { id: 'd4', name: "classic cheeseburger", srr: 88, price: 12.00, numRatings: 42, photos: 28, comments: 35 }
    ]
  },
  { id: 3, name: "pizza haven", cuisine: "italian", avgSRR: 91,
    location: { lat: 37.8100, lng: -122.2620, address: "789 College Ave, Oakland, CA" },
    photos: ['🍕', '🍝', '🥗'],
    recentScores: [
      { user: 'kate', date: '2026-01-30', taste: 92, portion: 90, overall: 91 },
      { user: 'leo', date: '2026-01-29', taste: 90, portion: 91, overall: 90 },
      { user: 'mia', date: '2026-01-28', taste: 93, portion: 89, overall: 91 },
      { user: 'noah', date: '2026-01-27', taste: 89, portion: 92, overall: 90 },
      { user: 'olivia', date: '2026-01-26', taste: 91, portion: 90, overall: 90 }
    ],
    topDishes: [
      { id: 'd7', name: "margherita pizza", srr: 95, price: 14.00, numRatings: 56, photos: 41, comments: 48 }
    ]
  }
];

const mockGroups = [
  { 
    id: 1, 
    name: "foodie squad", 
    members: 45, 
    score: 247, 
    uniqueDishes: 156,
    membersList: [
      { username: 'alice', score: 89, dishes: 32 },
      { username: 'bob', score: 85, dishes: 28 },
      { username: 'charlie', score: 92, dishes: 41 },
      { username: 'diana', score: 81, dishes: 25 },
      { username: 'evan', score: 88, dishes: 30 }
    ],
    dishes: [
      { name: "carne asada tacos", restaurant: "taco palace", srr: 92 },
      { name: "margherita pizza", restaurant: "pizza haven", srr: 95 },
      { name: "classic cheeseburger", restaurant: "joe's diner", srr: 88 }
    ]
  },
  { 
    id: 2, 
    name: "bay area eats", 
    members: 38, 
    score: 231, 
    uniqueDishes: 142,
    membersList: [
      { username: 'frank', score: 87, dishes: 29 },
      { username: 'grace', score: 90, dishes: 35 },
      { username: 'henry', score: 83, dishes: 27 },
      { username: 'iris', score: 86, dishes: 31 }
    ],
    dishes: [
      { name: "california burrito", restaurant: "taco palace", srr: 89 },
      { name: "margherita pizza", restaurant: "pizza haven", srr: 95 }
    ]
  }
];

const mockUsers = [
  { id: 1, username: "alice", ratings: 47, location: "oakland, ca", overlap: 78 },
  { id: 2, username: "bob", ratings: 32, location: "san francisco, ca", overlap: 65 }
];

const mockMyGroups = [
  { id: 1, name: "oakland food crew", members: 12, rankedItems: 47 }
];

const mockMyLists = [
  { id: 1, name: "places to try", items: 12, isPublic: false },
  { id: 2, name: "favorite pizzas", items: 8, isPublic: true, saves: 3 }
];

const categoryAverages = {
  'carne asada tacos': 8.50,
  'cheeseburger': 12.00,
  'margherita pizza': 14.00,
  'california burrito': 11.00
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
  const [isMapLoaded, setIsMapLoaded] = React.useState(false);

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

  const getAllDishes = () => {
    const dishes = [];
    mockRestaurants.forEach(restaurant => {
      restaurant.topDishes.forEach(dish => {
        dishes.push({
          ...dish,
          restaurantName: restaurant.name,
          cuisine: restaurant.cuisine
        });
      });
    });
    return dishes.sort((a, b) => b.srr - a.srr);
  };

  const [activeTab, setActiveTab] = useState('rankings');
  const [selectedDish, setSelectedDish] = useState(null);
  const [rankingView, setRankingView] = useState('dishes');
  const [searchQuery, setSearchQuery] = useState('');
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
  
  // Modal Stack System for nested navigation
  const [modalStack, setModalStack] = useState([]);
  // modalStack structure: [{ type: 'group', data: groupObj }, { type: 'user', data: userObj }]
  
  // Submission form state
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

  const allDishes = getAllDishes();
  
  const categorySuggestions = Object.keys(categoryAverages).filter(cat =>
    cat.toLowerCase().includes(categoryInput.toLowerCase())
  );

  const handleCategorySelect = (category) => {
    setDishCategory(category);
    setCategoryInput(category);
    setShowCategorySuggestions(false);
  };

  useEffect(() => {
    if (price && dishCategory && categoryAverages[dishCategory.toLowerCase()]) {
      const avgPrice = categoryAverages[dishCategory.toLowerCase()];
      const actualPrice = parseFloat(price);
      const beta = 0.5;
      const r = actualPrice / avgPrice;
      let calculatedScore = 50 + (50 * (1 - r)) / beta;
      calculatedScore = Math.max(1, Math.min(100, calculatedScore));
      setPriceScore(Math.round(calculatedScore));
    }
  }, [price, dishCategory]);

  const finalSRR = Math.round(((tasteScore * 0.33) + (priceScore * 0.33) + (portionScore * 0.33)) * 10) / 10;

  const calculateRankingPosition = (score) => {
    const allDishesWithNew = [...getAllDishes(), { 
      name: dishName, 
      srr: score, 
      restaurantName: restaurant,
      price: parseFloat(price),
      cuisine: dishCategory
    }].sort((a, b) => b.srr - a.srr);
    
    const currentIndex = allDishesWithNew.findIndex(d => d.name === dishName && d.srr === score);
    const rank = currentIndex + 1;
    const topRanked = allDishesWithNew[0];
    const aboveItem = currentIndex > 0 ? allDishesWithNew[currentIndex - 1] : null;
    const belowItem = currentIndex < allDishesWithNew.length - 1 ? allDishesWithNew[currentIndex + 1] : null;
    
    return { rank, total: allDishesWithNew.length, topRanked, aboveItem, belowItem };
  };

  const handleSubmit = () => {
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
    
    setSubmittedRating(rating);
    setIsSubmissionModalOpen(false);
    setIsResultsModalOpen(true);
  };

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

  const handleCloseRestaurant = () => {
    setIsRestaurantModalClosing(true);
    setTimeout(() => {
      setSelectedRestaurant(null);
      setIsRestaurantModalClosing(false);
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
          <h1 className="text-xl font-bold text-gray-800 mx-auto">hunters finds</h1>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="search restaurants or dishes..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#33a29b]"
            style={{ fontFamily: '"Courier New", monospace' }}
          />
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
                        mockRestaurants.forEach(restaurant => {
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
            <div className="bg-white border-b px-4 py-2 flex gap-2">
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
            </div>

            <div className="max-w-4xl mx-auto p-4">
              {rankingView === 'dishes' && (
                <div className="space-y-2">
                  {allDishes.map((dish, idx) => {
                    const badge = getTierBadge(dish.srr);
                    return (
                      <div key={idx} className="bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition cursor-pointer stagger-item" onClick={() => setSelectedDish(dish)}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 text-center text-lg font-bold text-gray-400">#{idx + 1}</div>
                          <div className="flex-1">
                            <div className="font-semibold text-sm">{dish.name}</div>
                            <div className="text-xs text-gray-500">{dish.restaurantName} • {dish.cuisine} • ${dish.price.toFixed(2)}</div>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded float-badge ${badge.color}`}>{badge.label}</span>
                          <div className={`text-2xl font-bold ${getSRRColor(dish.srr)} ${dish.srr >= 90 ? 'score-shine' : ''}`}>{dish.srr}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {rankingView === 'restaurants' && (
                <div className="space-y-2">
                  {[...mockRestaurants].sort((a, b) => b.avgSRR - a.avgSRR).map((restaurant, idx) => {
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
                  <h2 className="text-lg font-bold mb-4">group rankings</h2>
                  {mockGroups.map((group, idx) => (
                    <div key={idx} onClick={() => setSelectedGroup(group)} className="bg-white rounded-lg p-4 shadow-sm cursor-pointer hover:shadow-md transition">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl font-bold text-gray-400">#{idx + 1}</div>
                        <div className="flex-1">
                          <h3 className="font-bold">{group.name}</h3>
                          <p className="text-xs text-gray-500">{group.members} members</p>
                        </div>
                        <div className={`text-3xl font-bold ${getSRRColor(group.score / 3)}`}>{group.score}</div>
                      </div>
                    </div>
                  ))}
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
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold mb-3">because you loved carne asada tacos...</h3>
                  <div 
                    onClick={() => setSelectedRestaurant(mockRestaurants[0])}
                    className="bg-white rounded-lg p-3 shadow-sm flex gap-2 cursor-pointer hover:shadow-md transition"
                  >
                    <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Image size={20} className="text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold mb-0.5 text-sm">carne asada tacos</h4>
                      <p className="text-[10px] text-gray-600 mb-1">taco palace • mexican • $8.50</p>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`text-xl font-bold ${getSRRColor(92)}`}>92</div>
                        <span className="text-[9px] text-gray-500">SRR Score</span>
                      </div>
                      <div className="flex gap-1.5">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveItem(mockRestaurants[0].topDishes[0], 'dish');
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] transition ${
                            isItemSaved(mockRestaurants[0].topDishes[0].id, 'dish')
                              ? 'bg-blue-500 text-white hover:bg-blue-600'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <Bookmark size={10} className="inline" /> {isItemSaved(mockRestaurants[0].topDishes[0].id, 'dish') ? 'saved' : 'save'}
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsSubmissionModalOpen(true);
                          }}
                          className="px-2 py-0.5 bg-[#33a29b] text-white rounded text-[10px] hover:bg-[#2a8a84] transition"
                        >
                          rate now
                        </button>
                      </div>
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold mb-3 mt-6">trending in oakland...</h3>
                  <div 
                    onClick={() => setSelectedRestaurant(mockRestaurants[2])}
                    className="bg-white rounded-lg p-3 shadow-sm flex gap-2 cursor-pointer hover:shadow-md transition"
                  >
                    <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Image size={20} className="text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold mb-0.5 text-sm">margherita pizza</h4>
                      <p className="text-[10px] text-gray-600 mb-1">pizza haven • italian • $14.00</p>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`text-xl font-bold ${getSRRColor(95)}`}>95</div>
                        <span className="text-[9px] text-gray-500">SRR Score</span>
                      </div>
                      <div className="flex gap-1.5">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveItem(mockRestaurants[2].topDishes[0], 'dish');
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] transition ${
                            isItemSaved(mockRestaurants[2].topDishes[0].id, 'dish')
                              ? 'bg-blue-500 text-white hover:bg-blue-600'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <Bookmark size={10} className="inline" /> {isItemSaved(mockRestaurants[2].topDishes[0].id, 'dish') ? 'saved' : 'save'}
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsSubmissionModalOpen(true);
                          }}
                          className="px-2 py-0.5 bg-[#33a29b] text-white rounded text-[10px] hover:bg-[#2a8a84] transition"
                        >
                          rate now
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {exploreView === 'people' && (
                <div className="space-y-3">
                  <h2 className="text-lg font-bold mb-4">explore people</h2>
                  {mockUsers.map(user => (
                    <div 
                      key={user.id} 
                      onClick={() => pushModal('user', user)}
                      className="bg-white rounded-lg p-4 shadow-sm cursor-pointer hover:shadow-md transition"
                    >
                      <div className="flex justify-between mb-3">
                        <div>
                          <h3 className="font-bold">@{user.username}</h3>
                          <p className="text-xs text-gray-500">{user.location}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-[#33a29b]">{user.overlap}%</div>
                          <div className="text-xs text-gray-500">overlap</div>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          // Add friend logic
                        }}
                        className="w-full bg-[#33a29b] text-white py-2 rounded-lg text-sm hover:bg-[#2a8a84] transition"
                      >
                        <UserPlus size={14} className="inline mr-1" />add friend
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {exploreView === 'groups' && (
                <div className="space-y-3">
                  <h2 className="text-lg font-bold mb-4">explore groups</h2>
                  {mockGroups.map(group => (
                    <div 
                      key={group.id} 
                      onClick={() => setSelectedGroup(group)}
                      className="bg-white rounded-lg p-4 shadow-sm cursor-pointer hover:shadow-md transition"
                    >
                      <div className="flex justify-between mb-2">
                        <div>
                          <h3 className="font-bold">{group.name}</h3>
                          <p className="text-xs text-gray-500">{group.members} members</p>
                        </div>
                        <div className={`text-2xl font-bold ${getSRRColor(group.score / 3)}`}>{group.score}</div>
                      </div>
                      <div className="text-xs text-[#33a29b] mb-2">2 dishes in common</div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          // Join group logic here
                        }}
                        className="w-full bg-[#33a29b] text-white py-2 rounded-lg text-sm hover:bg-[#2a8a84] transition"
                      >
                        join group
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* YOU TAB */}
        {activeTab === 'you' && (
          <div>
            <div className="bg-white border-b px-4 py-2 flex gap-2 overflow-x-auto">
              <button onClick={() => setYouView('profile')} className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap font-medium transition ${youView === 'profile' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`} style={{ fontFamily: '"Courier New", monospace' }}>
                <User size={18} />
              </button>
              <button onClick={() => setYouView('ratings')} className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap font-medium transition ${youView === 'ratings' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`} style={{ fontFamily: '"Courier New", monospace' }}>
                <Star size={18} />
              </button>
              <button onClick={() => setYouView('lists')} className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap font-medium transition ${youView === 'lists' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`} style={{ fontFamily: '"Courier New", monospace' }}>
                <List size={18} />
              </button>
              <button onClick={() => setYouView('groups')} className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap font-medium transition ${youView === 'groups' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`} style={{ fontFamily: '"Courier New", monospace' }}>
                <Users size={18} />
              </button>
              <button onClick={() => setYouView('saved')} className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap font-medium transition ${youView === 'saved' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`} style={{ fontFamily: '"Courier New", monospace' }}>
                <Bookmark size={18} />
              </button>
              <button onClick={() => setYouView('friends')} className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap font-medium transition ${youView === 'friends' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`} style={{ fontFamily: '"Courier New", monospace' }}>
                <UserPlus size={18} />
              </button>
              <button onClick={() => setYouView('settings')} className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap font-medium transition ${youView === 'settings' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`} style={{ fontFamily: '"Courier New", monospace' }}>
                <Settings size={18} />
              </button>
            </div>

            <div className="max-w-4xl mx-auto p-4">
              {youView === 'profile' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="flex justify-between mb-3">
                      <h2 className="text-xl font-bold">@yourusername</h2>
                      <button className="text-sm text-[#33a29b]">edit</button>
                    </div>
                    <div className="flex gap-4 text-center py-3 border-t border-b">
                      <div className="flex-1"><div className="font-bold">47</div><div className="text-xs text-gray-600">ratings</div></div>
                      <div className="flex-1 border-l"><div className="font-bold">12</div><div className="text-xs text-gray-600">friends</div></div>
                      <div className="flex-1 border-l"><div className="font-bold">3</div><div className="text-xs text-gray-600">groups</div></div>
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

              {youView === 'lists' && (
                <div className="space-y-3">
                  <div className="flex justify-between mb-4">
                    <h2 className="text-lg font-bold" style={{ fontFamily: '"Courier New", monospace' }}>lists</h2>
                    <button 
                      onClick={() => setIsNewListModalOpen(true)}
                      className="text-sm text-[#33a29b] font-semibold hover:text-[#2a8a84]"
                      style={{ fontFamily: '"Courier New", monospace' }}
                    >
                      + new list
                    </button>
                  </div>
                  {mockMyLists.map(list => (
                    <div key={list.id} className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{list.isPublic ? '🌐' : '🔒'}</span>
                        <h3 className="font-bold" style={{ fontFamily: '"Courier New", monospace' }}>{list.name}</h3>
                      </div>
                      <p className="text-xs text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>{list.isPublic ? 'public' : 'private'} • {list.items} items</p>
                      <button className="text-xs text-[#33a29b] mt-2" style={{ fontFamily: '"Courier New", monospace' }}>export to maps ↗</button>
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
                  {mockMyGroups.map(group => (
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
                  <h2 className="text-lg font-bold mb-4" style={{ fontFamily: '"Courier New", monospace' }}>friends</h2>
                  {mockUsers.slice(0, 5).map(user => (
                    <div 
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className="bg-white rounded-lg p-4 shadow-sm cursor-pointer hover:shadow-md transition"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-bold" style={{ fontFamily: '"Courier New", monospace' }}>@{user.username}</h3>
                          <p className="text-xs text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>{user.location}</p>
                          <p className="text-xs text-gray-400 mt-1" style={{ fontFamily: '"Courier New", monospace' }}>{user.ratings} ratings • {user.friends} friends</p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-[#33a29b]" style={{ fontFamily: '"Courier New", monospace' }}>{user.overlap}%</div>
                          <div className="text-xs text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>overlap</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {youView === 'settings' && (
                <div className="space-y-3">
                  <h2 className="text-lg font-bold mb-4">settings</h2>
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <h3 className="text-sm font-semibold mb-3">account</h3>
                    <button className="w-full text-left text-sm py-2 hover:text-[#33a29b]">edit profile</button>
                    <button className="w-full text-left text-sm py-2 hover:text-[#33a29b]">change password</button>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <h3 className="text-sm font-semibold mb-3">privacy</h3>
                    <button className="w-full text-left text-sm py-2 hover:text-[#33a29b]">profile visibility</button>
                    <button className="w-full text-left text-sm py-2 hover:text-[#33a29b]">who can see my ratings</button>
                  </div>
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
            
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (isActionButton) {
                    setIsSubmissionModalOpen(true);
                  } else {
                    setActiveTab(tab.id);
                  }
                }}
                className={`flex flex-col items-center justify-center gap-1 relative flex-1 py-2 transition-all ${
                  isActionButton ? 'text-[#33a29b] scale-110' : isActive ? 'text-[#33a29b]' : 'text-gray-500/60'
                }`}
              >
                <Icon size={isActionButton ? 24 : 20} strokeWidth={isActive || isActionButton ? 2.5 : 2} />
                {tab.label && <span className="text-[10px]">{tab.label}</span>}
                {isActive && !isActionButton && (
                  <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#33a29b] rounded-full" />
                )}
                {isActionButton && (
                  <div className="absolute inset-0 -z-10 rounded-full bg-[rgba(51,162,155,0.1)] scale-150" />
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
                    <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: '"Courier New", monospace' }}>place</label>
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
                        setCategoryInput(e.target.value);
                        setShowCategorySuggestions(true);
                        if (categoryAverages[e.target.value.toLowerCase()]) {
                          setDishCategory(e.target.value.toLowerCase());
                        } else {
                          setDishCategory('');
                        }
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
                      <span className="text-sm font-bold text-green-600" style={{ fontFamily: '"Courier New", monospace' }}>{priceScore}</span>
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
        // Generate stable scores based on dish ID (won't change on re-render)
        const seed = selectedDish.id.toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const tasteScore = Math.floor(selectedDish.srr * 0.85 + (seed % 10));
        const portionScore = Math.floor(selectedDish.srr * 0.9 + ((seed * 3) % 8));
        const priceScore = Math.floor(selectedDish.srr * 0.95 + ((seed * 7) % 6));
        
        return (
        <>
          <div onClick={handleCloseDish} className={`fixed inset-0 bg-black/40 z-50 ${isDishModalClosing ? 'animate-fade-out' : 'animate-fade-in'}`} style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />
          <div className={`fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none`}>
            <div className={`bg-white rounded-xl max-w-lg w-full overflow-y-auto pointer-events-auto ${isDishModalClosing ? 'animate-slide-down-fade-simple' : 'animate-slide-up-fade-simple'}`} style={{ maxHeight: '32vh' }}>
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
                      <div className={`text-2xl font-bold leading-none ${getSRRColor(selectedDish.srr)}`} style={{ fontFamily: '"Courier New", monospace' }}>{selectedDish.srr}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Image size={14} className="text-gray-400" />
                      <span className="text-xs font-bold" style={{ fontFamily: '"Courier New", monospace' }}>{selectedDish.photos}</span>
                      <MessageSquare size={14} className="text-gray-400 ml-1" />
                      <span className="text-xs font-bold" style={{ fontFamily: '"Courier New", monospace' }}>{selectedDish.comments}</span>
                    </div>
                  </div>
                </div>

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
                    </div>
                  </div>
                </div>
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
          <div onClick={handleCloseRestaurant} className={`fixed inset-0 bg-black/40 z-50 ${isRestaurantModalClosing ? 'animate-fade-out' : 'animate-fade-in'}`} style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />
          <div className={`fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none`}>
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
                {/* Compact Info Row */}
                <div className="flex items-center gap-3 mb-2">
                  {/* Mini Photo Gallery */}
                  <div className="flex gap-1">
                    {selectedRestaurant.photos.slice(0, 3).map((photo, idx) => (
                      <div key={idx} className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded flex items-center justify-center text-lg">
                        {photo}
                      </div>
                    ))}
                  </div>

                  {/* Score Display */}
                  <div className="flex-1 bg-gradient-to-r from-[#33a29b]/10 to-[#2a8a84]/10 rounded-lg px-3 py-1.5 border border-[#33a29b]/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[8px] text-gray-600 uppercase" style={{ fontFamily: '"Courier New", monospace' }}>Score</div>
                        <div className={`text-2xl font-bold leading-none ${getSRRColor(selectedRestaurant.avgSRR)}`} style={{ fontFamily: '"Courier New", monospace' }}>{selectedRestaurant.avgSRR}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[8px] text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>{selectedRestaurant.cuisine}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Compact Recent Scores */}
                <div>
                  <h3 className="text-[9px] font-bold mb-1.5 text-gray-700" style={{ fontFamily: '"Courier New", monospace' }}>RECENT RATINGS</h3>
                  <div className="space-y-1">
                    {selectedRestaurant.recentScores.slice(0, 3).map((score, idx) => (
                      <div key={idx} className="bg-gray-50 rounded p-1.5 border border-gray-100">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1">
                            <User size={10} className="text-gray-400" />
                            <span className="font-bold text-[9px]" style={{ fontFamily: '"Courier New", monospace' }}>@{score.user}</span>
                          </div>
                          <span className="text-[8px] text-gray-400" style={{ fontFamily: '"Courier New", monospace' }}>{score.date.slice(5)}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          <div className="bg-orange-50 rounded px-1 py-0.5 text-center">
                            <div className="text-[7px] text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>taste</div>
                            <div className="text-xs font-bold text-orange-600" style={{ fontFamily: '"Courier New", monospace' }}>{score.taste}</div>
                          </div>
                          <div className="bg-blue-50 rounded px-1 py-0.5 text-center">
                            <div className="text-[7px] text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>portion</div>
                            <div className="text-xs font-bold text-blue-600" style={{ fontFamily: '"Courier New", monospace' }}>{score.portion}</div>
                          </div>
                          <div className="bg-green-50 rounded px-1 py-0.5 text-center">
                            <div className="text-[7px] text-gray-500" style={{ fontFamily: '"Courier New", monospace' }}>overall</div>
                            <div className={`text-xs font-bold ${getSRRColor(score.overall)}`} style={{ fontFamily: '"Courier New", monospace' }}>{score.overall}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
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
      {selectedGroup && !hasModalInStack() && (
        <>
          <div onClick={handleCloseGroup} className={`fixed inset-0 bg-black/40 z-50 ${isGroupModalClosing ? 'animate-fade-out' : 'animate-fade-in'}`} style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />
          <div className={`fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none`}>
            <div className={`bg-white rounded-xl max-w-2xl w-full overflow-hidden pointer-events-auto ${isGroupModalClosing ? 'animate-slide-down-fade-simple' : 'animate-slide-up-fade-simple'}`} style={{ height: '70vh' }}>
              <div className="sticky top-0 bg-white border-b px-4 py-3 flex justify-between items-center z-10">
                <h2 className="text-lg font-bold" style={{ fontFamily: '"Courier New", monospace' }}>{selectedGroup.name}</h2>
                <button onClick={handleCloseGroup} className="text-gray-500 hover:text-gray-700">
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
                  members ({selectedGroup.membersList.length})
                </button>
                <button
                  onClick={() => setGroupModalView('dishes')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    groupModalView === 'dishes' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  style={{ fontFamily: '"Courier New", monospace' }}
                >
                  dishes ({selectedGroup.dishes.length})
                </button>
              </div>
              
              <div className="p-4 overflow-y-auto" style={{ height: 'calc(70vh - 120px)' }}>
                {/* Members View */}
                {groupModalView === 'members' && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold mb-3" style={{ fontFamily: '"Courier New", monospace' }}>group members</h3>
                    {selectedGroup.membersList.map((member, idx) => {
                      // Find full user data from mockUsers
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
                          onClick={() => {
                            pushModal('group', selectedGroup);
                            pushModal('user', fullUser);
                          }}
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

                {/* Dishes View */}
                {groupModalView === 'dishes' && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold mb-3" style={{ fontFamily: '"Courier New", monospace' }}>group dishes & restaurants</h3>
                    {selectedGroup.dishes.map((dish, idx) => {
                      // Find full dish data from allDishes
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
                          onClick={() => {
                            pushModal('group', selectedGroup);
                            pushModal('dish', fullDish);
                          }}
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
      )}

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
                  {submittedRating.finalSRR}
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
    </div>
  );
};

export default HuntersFindsApp;
