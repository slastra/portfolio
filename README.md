# dev.lastra.us

Source for [dev.lastra.us](https://dev.lastra.us) — a live index of public projects pulled directly from GitHub.

SvelteKit · Tailwind v4 · Rosé Pine · Playfair Display.

## Run

```sh
bun install
bun run dev
```

## Build

```sh
bun run build
bun run start
```

The page fetches `https://api.github.com/users/slastra/repos` server-side at request time with a 10-minute in-memory cache.

Every repo also has its own server-rendered page at `/projects/<name>`, with its README rendered via `marked` + `isomorphic-dompurify` and code blocks highlighted by [Shiki](https://shiki.style) in Rosé Pine. READMEs are cached per repo until it is pushed to, or for 30 minutes at most. Relative links and images in a README are rewritten to point back at the repo on GitHub. On the index, a card opens that same page's content in a modal through a shallow navigation, so the URL changes to the project page and Back closes it.

Each project page has its own title, description, canonical URL and JSON-LD (an `ItemPage` with a `BreadcrumbList` and the repo as `SoftwareSourceCode`, authored by the same `Person` the index declares). It also gets a 1200×630 preview image generated at `/projects/<name>/og.png` with [satori](https://github.com/vercel/satori) + resvg. `/sitemap.xml` lists the index and every project page, with screenshots as image entries.

A repo with a `docs/screenshot.*` or root `screenshot.*` gets that image as a banner on its card. Detection is a single GraphQL query that reads the root and `docs/` trees of every repo at once, on the same 10-minute cache as the repo list. GraphQL needs a token, so without `GITHUB_TOKEN` the lookup is skipped and cards render without banners rather than spending the anonymous REST budget on per-repo calls.

## Credits

Color palette by [Rosé Pine](https://rosepinetheme.com) — *all natural pine, faux fur and a bit of soho vibes for the classy minimalist*. Used here under their MIT-style licence; the visible accents (`rose`, `love`, `gold`, `pine`, `foam`, `iris`) are theirs.
