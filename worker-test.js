export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/health' || url.pathname === '/api/health') {
      return new Response(JSON.stringify({ ok: true, env_check: !!env.JWT_SECRET, has_db: !!env.DB }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    // Serve frontend assets for everything else
    return env.ASSETS.fetch(request);
  }
};
