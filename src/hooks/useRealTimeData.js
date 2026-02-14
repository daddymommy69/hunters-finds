// src/hooks/useRealTimeData.js
/**
 * REAL-TIME DATA HOOK
 * 
 * Fetches dishes and restaurants from Supabase with real-time updates
 * Calculates averages from all users' ratings
 * 
 * USAGE:
 * const { dishes, restaurants, loading } = useRealTimeData(user);
 */

import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export const useRealTimeData = (user) => {
  const [dishes, setDishes] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [userRatings, setUserRatings] = useState([]);
  const [loading, setLoading] = useState(true);

  /**
   * Fetch all dishes with their ratings
   * Includes rating count and average scores
   */
  const fetchDishes = async () => {
    try {
      const { data, error } = await supabase
        .from('dishes')
        .select(`
          *,
          ratings (
            id,
            taste_score,
            portion_score,
            price_score,
            overall_score,
            user_id
          )
        `)
        .order('avg_srr', { ascending: false });

      if (error) {
        console.error('Error fetching dishes:', error);
        setDishes([]);
        return;
      }

      // Process dishes to ensure proper format
      const processedDishes = (data || []).map(dish => ({
        ...dish,
        total_ratings: dish.ratings?.length || 0,
        // Recalculate average if needed
        avg_srr: dish.total_ratings > 0
          ? Math.round(
              dish.ratings.reduce((sum, r) => sum + (r.overall_score || 0), 0) / dish.total_ratings
            )
          : dish.avg_srr || 0
      }));

      setDishes(processedDishes);
    } catch (error) {
      console.error('Unexpected error fetching dishes:', error);
      setDishes([]);
    }
  };

  /**
   * Fetch all restaurants with their ratings
   */
  const fetchRestaurants = async () => {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .order('avg_score', { ascending: false });

      if (error) {
        console.error('Error fetching restaurants:', error);
        setRestaurants([]);
        return;
      }

      setRestaurants(data || []);
    } catch (error) {
      console.error('Unexpected error fetching restaurants:', error);
      setRestaurants([]);
    }
  };

  /**
   * Fetch current user's ratings (for "My Ratings" view)
   */
  const fetchUserRatings = async () => {
    if (!user) {
      setUserRatings([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('ratings')
        .select(`
          *,
          dish:dishes (
            id,
            name,
            restaurant_name,
            cuisine_type,
            price
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user ratings:', error);
        setUserRatings([]);
        return;
      }

      setUserRatings(data || []);
    } catch (error) {
      console.error('Unexpected error fetching user ratings:', error);
      setUserRatings([]);
    }
  };

  /**
   * Initial data load
   */
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchDishes(),
        fetchRestaurants(),
        fetchUserRatings()
      ]);
      setLoading(false);
    };

    loadData();
  }, [user]); // Reload when user changes (login/logout)

  /**
   * Set up real-time subscriptions
   */
  useEffect(() => {
    // Subscribe to dishes changes
    const dishesSubscription = supabase
      .channel('dishes-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dishes' },
        (payload) => {
          console.log('Dishes updated:', payload);
          fetchDishes();
        }
      )
      .subscribe();

    // Subscribe to ratings changes
    const ratingsSubscription = supabase
      .channel('ratings-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ratings' },
        (payload) => {
          console.log('Ratings updated:', payload);
          fetchDishes(); // Refresh dishes when ratings change
          fetchUserRatings(); // Refresh user ratings
        }
      )
      .subscribe();

    // Subscribe to restaurants changes
    const restaurantsSubscription = supabase
      .channel('restaurants-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'restaurants' },
        (payload) => {
          console.log('Restaurants updated:', payload);
          fetchRestaurants();
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      dishesSubscription.unsubscribe();
      ratingsSubscription.unsubscribe();
      restaurantsSubscription.unsubscribe();
    };
  }, [user]);

  return {
    dishes,
    restaurants,
    userRatings,
    loading,
    refetch: async () => {
      await Promise.all([
        fetchDishes(),
        fetchRestaurants(),
        fetchUserRatings()
      ]);
    }
  };
};
