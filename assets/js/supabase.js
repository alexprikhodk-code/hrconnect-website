// HRconnect — Supabase client singleton
// Requires Supabase JS v2 loaded from CDN BEFORE this file.
(function () {
  if (!window.supabase) {
    console.error("Supabase JS client not loaded. Include CDN <script> first.");
    return;
  }
  const cfg = window.HRC_CONFIG;
  if (!cfg || !cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes("YOUR-PROJECT")) {
    console.error("HRC_CONFIG not set. Edit assets/js/env.js");
    return;
  }
  window.sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
})();
