'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getClientBrowser } from './supabase';
import { User, Session, SupabaseClient } from '@supabase/supabase-js';

// Admin credentials
const ADMIN_IDS = ['8f7fe295-2df0-412d-ba91-8e6060f3ab08'];
const ADMIN_EMAILS = ['luxtradee@gmail.com', 'riskiakbarp123@gmail.com'];

// ============================================
// Updated Profile interface with affiliate fields
// ============================================
interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  subscription_status: 'FREE' | 'PRO' | 'active' | 'expired';
  is_pro: boolean;
  subscription_until: string | null;
  // Affiliate fields
  device_id?: string | null;
  my_referral_code?: string | null;
  referred_by_code?: string | null;
  affiliate_balance?: number;
  referral_code_changes?: number;
  referral_status?: string | null;
  has_ever_been_pro?: boolean;
  commission_paid?: boolean;
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
    const supabaseClient = getClientBrowser()
    if (!supabaseClient) return null;

    try {
      // Use API route with Prisma to bypass RLS (profiles.id is text type, auth.uid() is uuid)
      const response = await fetch('/api/profile/me');
      if (response.ok) {
        const result = await response.json();
        if (result.profile) {
          return result.profile as Profile;
        }
      }

      // Fallback to direct Supabase query
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Profile fetch error:', error.message);
        }

        // If profile doesn't exist, try to create it via API route
        if (error.code === 'PGRST116') {
          try {
            const response = await fetch('/api/auth/ensure-profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId,
                email: user?.email,
                fullName: user?.user_metadata?.full_name || user?.email?.split('@')[0],
              }),
            });

            const result = await response.json();
            if (result.profile) {
              return result.profile as Profile;
            }
          } catch (apiError) {
            console.error('❌ Failed to create profile via API:', apiError);
          }
        }
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
    const supabaseClient = getClientBrowser()
    if (!supabaseClient || !profileData || !profileData.subscription_until) return profileData;

    const isValid = isSubscriptionValid(profileData.subscription_until);

    // If marked as PRO but subscription expired, update to FREE
    if (profileData.is_pro && !isValid) {
      const { error } = await supabaseClient
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
    let mounted = true

    const initializeSupabase = async () => {
      try {
        const { getClientBrowserAsync } = await import('./supabase')
        const supabaseClient = await getClientBrowserAsync()

        if (!mounted) return

        // If Supabase is not configured, just set loading to false
        if (!supabaseClient) {
          console.error('[AuthContext] Failed to initialize Supabase client')
          setTimeout(() => {
            if (mounted) setLoading(false)
          }, 0)
          return
        }

        // Get initial session quickly - don't wait for profile
        supabaseClient.auth.getSession().then(({ data: { session } }) => {
          if (!mounted) return

          setSession(session)
          setUser(session?.user ?? null)
          // Set loading to false immediately so auth doesn't block
          setLoading(false)

          // Fetch profile in background (non-blocking)
          if (session?.user) {
            fetchProfile(session.user.id).then(async (profileData) => {
              if (mounted) {
                const checkedProfile = await checkAndLockExpired(profileData)
                setProfile(checkedProfile)
              }
            })
          }
        })

        // Listen for auth state changes
        const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
          (event, session) => {
            if (!mounted) return

            // Handle sign out - clear everything immediately
            if (event === 'SIGNED_OUT') {
              setSession(null)
              setUser(null)
              setProfile(null)
              setLoading(false)
              return
            }

            setSession(session)
            setUser(session?.user ?? null)
            setLoading(false)

            // Fetch profile in background for sign in
            if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
              fetchProfile(session.user.id).then(async (profileData) => {
                if (mounted) {
                  const checkedProfile = await checkAndLockExpired(profileData)
                  setProfile(checkedProfile)

                  // Update login streak when user signs in
                  if (event === 'SIGNED_IN') {
                    try {
                      const { updateLoginStreak, checkStreakAchievements } = await import('./streak-tracker')
                      const newStreak = await updateLoginStreak(session.user.id)
                      await checkStreakAchievements(session.user.id, newStreak)
                    } catch (error) {
                      console.error('[AuthContext] Error updating streak:', error)
                    }
                  }
                }
              })
            }
          }
        )

        return () => {
          subscription.unsubscribe()
        }
      } catch (error) {
        console.error('[AuthContext] Error initializing Supabase:', error)
        if (mounted) {
          setTimeout(() => setLoading(false), 0)
        }
      }
    }

    initializeSupabase()

    return () => {
      mounted = false
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { getClientBrowserAsync } = await import('./supabase')
    const supabaseClient = await getClientBrowserAsync()

    if (!supabaseClient) {
      return { error: new Error('Supabase not configured') };
    }

    try {
      const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { getClientBrowserAsync } = await import('./supabase')
    const supabaseClient = await getClientBrowserAsync()

    if (!supabaseClient) {
      return { error: new Error('Supabase not configured') };
    }

    try {
      const { error } = await supabaseClient.auth.signUp({
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
    const supabaseClient = getClientBrowser()
    if (supabaseClient) {
      await supabaseClient.auth.signOut();
    }
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
