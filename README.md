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

The page fetches `https://api.github.com/users/slastra/repos` server-side at request time with a 10-minute in-memory cache. Each card opens a modal that renders the repo's README via `marked` + `isomorphic-dompurify`, cached per-repo for 30 minutes.
