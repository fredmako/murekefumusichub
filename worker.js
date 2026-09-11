export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/health' || url.pathname === '/api/health') {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return env.ASSETS.fetch(request);
  }
};
