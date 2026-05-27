// Mar&Tierra — Supabase client (public anon key only)
const SUPABASE_URL = 'https://ocynnsdxzdoudqpqpgje.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jeW5uc2R4emRvdWRxcHFwZ2plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NDA5NjUsImV4cCI6MjA5NTQxNjk2NX0.RpFvOhtn8A3SdrWRc-PBb6HZfK5gI6t8NH066aYoOdM';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
