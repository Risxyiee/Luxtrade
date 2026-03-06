'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from './supabase';
import { User, Session } from '@supabase/supabase-js';

// Admin credentials
const ADMIN_IDS = ['8f7fe295-2df0-412d-ba91-8e6060f3ab08'];
const ADMIN_EMAILS = ['luxtradee@gmail.com'];

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  subscription_status: 'FREE' | 'PRO' | 'active' | 'expired';
  is_pro: boolean;
  subscription_until: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  isPro: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Check if subscription is still valid
function isSubscriptionValid(subscriptionUntil: string | null): boolean {
  if (!subscriptionUntil) return false;
  const now = new Date();
  const until = new Date(subscriptionUntil);
  return until > now;
}

// Check admin status
function checkIsAdmin(userId: string | undefined, email: string | undefined): boolean {
  if (userId && ADMIN_IDS.includes(userId)) return true;
  if (email && ADMIN_EMAILS.includes(email.toLowerCase())) return true;
  return false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.log('Profile fetch error:', error.message);
        return null;
      }
      return data as Profile;
    } catch {
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  // Auto-lock expired subscriptions
  const checkAndLockExpired = async (profileData: Profile | null) => {
    if (!profileData || !profileData.subscription_until) return profileData;
    
    const isValid = isSubscriptionValid(profileData.subscription_until);
    
    // If marked as PRO but subscription expired, update to FREE
    if (profileData.is_pro && !isValid) {
      console.log('Subscription expired, auto-locking...');
      const { error } = await supabase
        .from('profiles')
        .update({
          is_pro: false,
          subscription_status: 'expired',
          updated_at: new Date().toISOString()
        })
        .eq('id', profileData.id);
      
      if (!error) {
        return {
          ...profileData,
          is_pro: false,
          subscription_status: 'expired' as const
        };
      }
    }
    
    return profileData;
  };

  useEffect(() => {
    // Get initial session quickly - don't wait for profile
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      // Set loading to false immediately so auth doesn't block
      setLoading(false);
      
      // Fetch profile in background (non-blocking)
      if (session?.user) {
        fetchProfile(session.user.id).then(async (profileData) => {
          const checkedProfile = await checkAndLockExpired(profileData);
          setProfile(checkedProfile);
        });
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event);
        
        // Handle sign out - clear everything immediately
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Fetch profile in background for sign in
        if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
          fetchProfile(session.user.id).then(async (profileData) => {
            const checkedProfile = await checkAndLockExpired(profileData);
            setProfile(checkedProfile);
          });
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });
      return { error };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  // Computed values
  const isAdmin = checkIsAdmin(user?.id, user?.email);
  
  // isPro logic: check subscription_until validity
  const isPro = (() => {
    // Admin always has PRO access
    if (isAdmin) return true;
    
    // Check profile
    if (!profile) return false;
    
    // If is_pro is true, check if subscription is still valid
    if (profile.is_pro) {
      return isSubscriptionValid(profile.subscription_until);
    }
    
    return false;
  })();

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        isPro,
        isAdmin,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
