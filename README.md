# Jackie B III — Going Loopy

Blog documenting the Jackie B III's journey on the Great Loop (2022–2024).

Built with [Astro 7](https://astro.build) + Tailwind CSS 4, deployed on Netlify free tier.

## Deploy

| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Publish directory | `dist` |
| Node version | 22 (pinned via `.nvmrc` and `netlify.toml`) |

### Connect to Netlify

**Via CLI:**
```
netlify login        # opens browser for auth
netlify init         # link repo, build: npm run build, publish: dist
netlify deploy --build --prod
```

**Via dashboard:** Netlify → Add new site → Import from Git → select this repo.

## Local development

```
npm install
npm run dev      # http://localhost:4321/
npm run build    # build to dist/
```
