const { createClient } = require('@supabase/supabase-js');
const localDb = require('./localDb');
require('dotenv').config();

const isPlaceholder =
  !process.env.SUPABASE_URL ||
  process.env.SUPABASE_URL.includes('xxxxxxxx') ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY.includes('your-service-role-key');

let supabase;

if (isPlaceholder) {
  console.log(
    '[database] Using persistent local JSON database (Supabase credentials not set or using placeholder).'
  );
  supabase = localDb;
} else {
  console.log(`[database] Connecting to Supabase at: ${process.env.SUPABASE_URL}`);
  try {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  } catch (err) {
    console.warn('[database] Failed to initialize Supabase client, falling back to localDb:', err.message);
    supabase = localDb;
  }
}

module.exports = supabase;
