// File: supabase-config.js
// GANTI INI DENGAN CREDENTIALS ANDA
const SUPABASE_URL = 'https://txncrqatfrveenobnmwb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_SHEiJkhRXFjzzAdlVK9E4w_olEd7X7A';

// Initialize Supabase - gunakan nama yang berbeda
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('✅ Supabase client initialized');
