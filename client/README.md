# Valorant Veto - React client

```bash
npm install
npm run dev        # http://localhost:5173 (proxies /api to http://localhost:4000)
npm run build      # outputs dist/, uses VITE_API_URL from .env.production
```

## Deploy
Backend: https://valoveto.onrender.com (separate Render Web Service).

**Render Static Site**: Build `npm install && npm run build` | Publish dir `dist`.
Then Redirects/Rewrites -> add rule: Source `/*`  Destination `/index.html`  Action **Rewrite**.
**Netlify / Cloudflare Pages**: `public/_redirects` is included.
**Vercel**: `vercel.json` is included.

The SPA rewrite is required, otherwise captain links such as `/m/abc/token` return 404 on refresh.
