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

The page fetches `https://api.github.com/users/slastra/repos` server-side at request time with a 10-minute in-memory cache. Each card opens a modal that renders the repo's README via `marked` + `isomorphic-dompurify`, cached per-repo for 30 minutes. Code blocks in the modal are highlighted with [Shiki](https://shiki.style) using the Rosé Pine theme.

## Credits

Color palette by [Rosé Pine](https://rosepinetheme.com) — *all natural pine, faux fur and a bit of soho vibes for the classy minimalist*. Used here under their MIT-style licence; the visible accents (`rose`, `love`, `gold`, `pine`, `foam`, `iris`) are theirs.
