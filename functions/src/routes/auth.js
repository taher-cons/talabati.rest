import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();


// Lazy initialization of Supabase clients
let _supabaseAdmin = null;
let _supabase = null;

function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    }
    
    _supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return _supabaseAdmin;
}

function getSupabase() {
  if (!_supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required');
    }
    
    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
}

// POST /api/auth/signup - Create new admin user (invite only)
// SECURITY: this endpoint creates users with an arbitrary `role` via the
// service-role key. It MUST NOT be public — otherwise anyone could self-grant
// the `owner` role. Invite-only = existing admin required.
router.post('/signup', requireAdmin, async (req, res) => {

  try {
    const { email, password, role, restaurantId } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await getSupabaseAdmin().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: role || 'staff',
        restaurant_id: restaurantId
      }
    });

    if (authError) throw authError;

    // Create profile in custom users table
    const { data: profile, error: profileError } = await getSupabaseAdmin()
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        email,
        role: role || 'staff',
        restaurant_id: restaurantId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (profileError) throw profileError;

    res.status(201).json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: profile.role,
        restaurant_id: profile.restaurant_id
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/login - Sign in user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await getSupabase().auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    // Get user profile
    const { data: profile, error: profileError } = await getSupabaseAdmin()
      .from('user_profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      throw profileError;
    }

    res.json({
      success: true,
      session: data.session,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: profile?.role || 'staff',
        restaurant_id: profile?.restaurant_id
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// POST /api/auth/logout - Sign out user
router.post('/logout', async (req, res) => {
  try {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw error;
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/auth/me - Get current user profile
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    const { data: { user }, error } = await getSupabase().auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get profile
    const { data: profile, error: profileError } = await getSupabaseAdmin()
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      throw profileError;
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: profile?.role || 'staff',
        restaurant_id: profile?.restaurant_id,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/refresh - Refresh access token
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const { data, error } = await getSupabase().auth.refreshSession({
      refresh_token
    });

    if (error) throw error;

    res.json({
      success: true,
      session: data.session
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// POST /api/auth/reset-password - Request password reset
router.post('/reset-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.CLIENT_URL}/admin/reset-password`
    });

    if (error) throw error;

    res.json({ success: true, message: 'Password reset email sent' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/update-password - Update password (after reset)
router.post('/update-password', async (req, res) => {
  try {
    const { password } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    const { data: { user }, error: userError } = await getSupabase().auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { error } = await getSupabaseAdmin().auth.admin.updateUserById(user.id, {
      password
    });

    if (error) throw error;

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ADMIN USER MANAGEMENT — authentication required for all /admin/** routes
// ============================================
router.use('/admin', requireAdmin);

// Admin: List all users for a restaurant
router.get('/admin/users', async (req, res) => {

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await getSupabase().auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if user is owner/admin
    const { data: profile } = await getSupabaseAdmin()
      .from('user_profiles')
      .select('role, restaurant_id')
      .eq('id', user.id)
      .single();

    if (!profile || !['owner', 'admin'].includes(profile.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Get all users for this restaurant
    const { data: users, error: usersError } = await getSupabaseAdmin()
      .from('user_profiles')
      .select('id, email, role, restaurant_id, created_at, last_login')
      .eq('restaurant_id', profile.restaurant_id);

    if (usersError) throw usersError;

    res.json({ users });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Update user role
router.put('/admin/users/:userId/role', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await getSupabase().auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if user is owner
    const { data: profile } = await getSupabaseAdmin()
      .from('user_profiles')
      .select('role, restaurant_id')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'owner') {
      return res.status(403).json({ error: 'Only owners can change roles' });
    }

    const { role } = req.body;
    const validRoles = ['owner', 'admin', 'manager', 'staff'];
    
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Update role in profile
    const { data, error: updateError } = await getSupabaseAdmin()
      .from('user_profiles')
      .update({ role })
      .eq('id', req.params.userId)
      .eq('restaurant_id', profile.restaurant_id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Also update auth metadata
    await getSupabaseAdmin().auth.admin.updateUserById(req.params.userId, {
      user_metadata: { role }
    });

    res.json({ success: true, user: data });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Delete user
router.delete('/admin/users/:userId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await getSupabase().auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if user is owner
    const { data: profile } = await getSupabaseAdmin()
      .from('user_profiles')
      .select('role, restaurant_id')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'owner') {
      return res.status(403).json({ error: 'Only owners can delete users' });
    }

    // Prevent self-deletion
    if (req.params.userId === user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    // Delete from auth
    const { error: authError } = await getSupabaseAdmin().auth.admin.deleteUser(req.params.userId);
    if (authError) throw authError;

    // Delete from profiles (cascade should handle this)
    const { error: profileError } = await getSupabaseAdmin()
      .from('user_profiles')
      .delete()
      .eq('id', req.params.userId);

    if (profileError) throw profileError;

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;