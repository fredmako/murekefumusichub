import { auth } from '@/lib/firebase';
import { supabase } from '@/lib/supabase';
import type { User as FirebaseUser } from 'firebase/auth';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7071/api';

// Helper to get Firebase ID token
async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return await user.getIdToken();
}

// Helper for API requests with authentication
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getIdToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || 'API request failed');
  }
  
  return response.json();
}

// ============================================
// Auth Service
// ============================================
export const authService = {
  /**
   * Sync user with backend after Firebase authentication
   */
  async syncUser(firebaseUser: FirebaseUser, role: string) {
    try {
      // Get Firebase ID token
      const token = await firebaseUser.getIdToken();
      
      // Call sync endpoint (can be Azure Function or direct Supabase)
      // For now, we'll handle this client-side with Supabase
      const { data: existingUser, error: findError } = await supabase
        .from('users')
        .select('*, user_roles(role_id, roles(name))')
        .eq('firebase_uid', firebaseUser.uid)
        .single();
      
      if (findError && findError.code !== 'PGRST116') {
        throw findError;
      }
      
      let userId: string;
      
      if (!existingUser) {
        // Create new user
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            firebase_uid: firebaseUser.uid,
            email: firebaseUser.email,
            display_name: firebaseUser.displayName,
            phone: firebaseUser.phoneNumber,
            avatar_url: firebaseUser.photoURL,
          })
          .select()
          .single();
        
        if (createError) throw createError;
        userId = newUser.id;
        
        // Get role ID
        const { data: roleData, error: roleError } = await supabase
          .from('roles')
          .select('id')
          .eq('name', role)
          .single();
        
        if (roleError) throw roleError;
        
        // Assign role
        const { error: roleAssignError } = await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role_id: roleData.id,
          });
        
        if (roleAssignError) throw roleAssignError;
        
        // Create buyer or composer record
        if (role === 'buyer') {
          await supabase.from('buyers').insert({ user_id: userId });
        } else if (role === 'composer') {
          await supabase.from('composers').insert({ user_id: userId });
        }
      } else {
        userId = existingUser.id;
      }
      
      // Fetch complete user data with roles
      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select(`
          *,
          user_roles(
            role_id,
            roles(name)
          )
        `)
        .eq('id', userId)
        .single();
      
      if (fetchError) throw fetchError;
      
      return {
        id: userData.id,
        firebaseUid: userData.firebase_uid,
        email: userData.email,
        displayName: userData.display_name,
        roles: userData.user_roles.map((ur: any) => ur.roles.name),
      };
    } catch (error) {
      console.error('Error syncing user:', error);
      throw error;
    }
  },
  
  /**
   * Log audit action
   */
  async logAudit(userId: string, action: string, payload: any) {
    try {
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action,
        payload,
      });
    } catch (error) {
      console.error('Error logging audit:', error);
    }
  },
};

// ============================================
// Composition Service
// ============================================
export const compositionService = {
  /**
   * Get all compositions
   */
  async getAll(filters?: {
    category?: string;
    search?: string;
    sortBy?: string;
  }) {
    try {
      let query = supabase
        .from('compositions')
        .select(`
          *,
          composers(id, users(display_name)),
          categories(name),
          composition_stats(views, purchases)
        `)
        .eq('is_published', true)
        .eq('deleted', false);
      
      if (filters?.category) {
        query = query.eq('category_id', filters.category);
      }
      
      if (filters?.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching compositions:', error);
      throw error;
    }
  },
  
  /**
   * Get composition by ID
   */
  async getById(id: string) {
    try {
      const { data, error } = await supabase
        .from('compositions')
        .select(`
          *,
          composers(id, users(display_name, email)),
          categories(name),
          composition_stats(views, purchases)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      // Increment view count
      await supabase.rpc('increment_views', { composition_id: id });
      
      return data;
    } catch (error) {
      console.error('Error fetching composition:', error);
      throw error;
    }
  },
  
  /**
   * Create new composition
   */
  async create(compositionData: {
    title: string;
    description: string;
    category_id: number;
    price: number;
    file_url: string;
    thumbnail_url?: string;
    duration_seconds?: number;
    composer_id: string;
  }) {
    try {
      const { data, error } = await supabase
        .from('compositions')
        .insert(compositionData)
        .select()
        .single();
      
      if (error) throw error;
      
      // Initialize stats
      await supabase.from('composition_stats').insert({
        composition_id: data.id,
      });
      
      return data;
    } catch (error) {
      console.error('Error creating composition:', error);
      throw error;
    }
  },
  
  /**
   * Update composition
   */
  async update(id: string, updates: Partial<{
    title: string;
    description: string;
    category_id: number;
    price: number;
    is_published: boolean;
  }>) {
    try {
      const { data, error } = await supabase
        .from('compositions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating composition:', error);
      throw error;
    }
  },
  
  /**
   * Delete composition (soft delete)
   */
  async delete(id: string) {
    try {
      const { error } = await supabase
        .from('compositions')
        .update({ deleted: true, is_published: false })
        .eq('id', id);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting composition:', error);
      throw error;
    }
  },
  
  /**
   * Get composer's compositions
   */
  async getByComposer(composerId: string) {
    try {
      const { data, error } = await supabase
        .from('compositions')
        .select(`
          *,
          categories(name),
          composition_stats(views, purchases)
        `)
        .eq('composer_id', composerId)
        .eq('deleted', false)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching composer compositions:', error);
      throw error;
    }
  },
};

// ============================================
// Purchase Service
// ============================================
export const purchaseService = {
  /**
   * Create a purchase
   */
  async create(purchaseData: {
    buyer_id: string;
    composition_id: string;
    price_paid: number;
    payment_ref: string;
  }) {
    try {
      const { data, error } = await supabase.rpc('purchase_composition', {
        p_buyer_id: purchaseData.buyer_id,
        p_composition_id: purchaseData.composition_id,
        p_price_paid: purchaseData.price_paid,
        p_payment_ref: purchaseData.payment_ref,
      });
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating purchase:', error);
      throw error;
    }
  },
  
  /**
   * Get buyer's purchases
   */
  async getByBuyer(buyerId: string) {
    try {
      const { data, error } = await supabase
        .from('purchases')
        .select(`
          *,
          compositions(
            *,
            composers(users(display_name)),
            categories(name)
          )
        `)
        .eq('buyer_id', buyerId)
        .eq('is_active', true)
        .order('purchased_at', { ascending: false });
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching purchases:', error);
      throw error;
    }
  },
  
  /**
   * Discard/refund a purchase
   */
  async discard(purchaseId: string) {
    try {
      const { error } = await supabase.rpc('discard_purchase', {
        p_purchase_id: purchaseId,
      });
      
      if (error) throw error;
    } catch (error) {
      console.error('Error discarding purchase:', error);
      throw error;
    }
  },
};

// ============================================
// FYP (For You Page) Service
// ============================================
export const fypService = {
  /**
   * Get personalized recommendations
   */
  async getRecommendations(buyerId: string, limit: number = 20) {
    try {
      const { data, error } = await supabase.rpc('get_fyp_recommendations', {
        p_buyer_id: buyerId,
        p_limit: limit,
      });
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      throw error;
    }
  },
  
  /**
   * Update buyer preferences
   */
  async updatePreferences(buyerId: string, categoryId: number, weight: number) {
    try {
      const { error } = await supabase
        .from('buyer_preferences')
        .upsert({
          buyer_id: buyerId,
          category_id: categoryId,
          weight,
        });
      
      if (error) throw error;
    } catch (error) {
      console.error('Error updating preferences:', error);
      throw error;
    }
  },
};

// ============================================
// Category Service
// ============================================
export const categoryService = {
  /**
   * Get all categories
   */
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }
  },
  
  /**
   * Create category
   */
  async create(name: string, description?: string) {
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({ name, description })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  },
};

// ============================================
// Report Service
// ============================================
export const reportService = {
  /**
   * Create a report
   */
  async create(reportData: {
    reported_by: string;
    composition_id: string;
    reason: string;
    details?: string;
  }) {
    try {
      const { data, error } = await supabase
        .from('reports')
        .insert(reportData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating report:', error);
      throw error;
    }
  },
  
  /**
   * Get all reports (admin)
   */
  async getAll(status?: string) {
    try {
      let query = supabase
        .from('reports')
        .select(`
          *,
          users!reported_by(display_name, email),
          compositions(title, composer_id)
        `)
        .order('created_at', { ascending: false });
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching reports:', error);
      throw error;
    }
  },
  
  /**
   * Resolve a report
   */
  async resolve(reportId: string, adminNotes: string, deleteComposition: boolean = false) {
    try {
      // Update report status
      const { error: updateError } = await supabase
        .from('reports')
        .update({
          status: 'resolved',
          admin_notes: adminNotes,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', reportId);
      
      if (updateError) throw updateError;
      
      // Optionally delete composition
      if (deleteComposition) {
        const { data: report } = await supabase
          .from('reports')
          .select('composition_id')
          .eq('id', reportId)
          .single();
        
        if (report) {
          await compositionService.delete(report.composition_id);
        }
      }
    } catch (error) {
      console.error('Error resolving report:', error);
      throw error;
    }
  },
};

// ============================================
// Storage Service
// ============================================
export const storageService = {
  /**
   * Upload file to Supabase Storage
   */
  async uploadFile(
    bucket: 'compositions' | 'thumbnails' | 'avatars',
    file: File,
    userId: string
  ): Promise<string> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });
      
      if (error) throw error;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);
      
      return publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  },
  
  /**
   * Delete file from storage
   */
  async deleteFile(bucket: string, path: string) {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([path]);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  },
};

// ============================================
// Analytics Service
// ============================================
export const analyticsService = {
  /**
   * Get composer dashboard stats
   */
  async getComposerStats(composerId: string) {
    try {
      const { data: compositions, error: compError } = await supabase
        .from('compositions')
        .select(`
          id,
          title,
          price,
          composition_stats(views, purchases)
        `)
        .eq('composer_id', composerId)
        .eq('deleted', false);
      
      if (compError) throw compError;
      
      const totalCompositions = compositions.length;
      const totalViews = compositions.reduce((sum, c) => sum + (c.composition_stats?.views || 0), 0);
      const totalPurchases = compositions.reduce((sum, c) => sum + (c.composition_stats?.purchases || 0), 0);
      const totalRevenue = compositions.reduce((sum, c) => 
        sum + (c.composition_stats?.purchases || 0) * c.price, 0
      );
      
      return {
        totalCompositions,
        totalViews,
        totalPurchases,
        totalRevenue,
        compositions,
      };
    } catch (error) {
      console.error('Error fetching composer stats:', error);
      throw error;
    }
  },
  
  /**
   * Get admin dashboard stats
   */
  async getAdminStats() {
    try {
      const [
        { count: totalUsers },
        { count: totalCompositions },
        { count: totalPurchases },
        { count: pendingReports },
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('compositions').select('*', { count: 'exact', head: true }).eq('deleted', false),
        supabase.from('purchases').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);
      
      return {
        totalUsers: totalUsers || 0,
        totalCompositions: totalCompositions || 0,
        totalPurchases: totalPurchases || 0,
        pendingReports: pendingReports || 0,
      };
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      throw error;
    }
  },
};

// Export all services
export const api = {
  auth: authService,
  compositions: compositionService,
  purchases: purchaseService,
  fyp: fypService,
  categories: categoryService,
  reports: reportService,
  storage: storageService,
  analytics: analyticsService,
};

export default api;
