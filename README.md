# Metel Patel — personal site

Live at <https://igithubfofun.github.io/profile/>

Static HTML, CSS and JavaScript. No build step, no framework, no dependencies —
push to `master` and GitHub Pages serves it as-is.

## Structure

```
index.html        markup and content
css/styles.css    design tokens, layout, components
js/main.js        theme, nav, reveal, tilt, clipboard, easter egg
img/              portrait, social preview, favicon
img/projects/     project thumbnails (WebP + JPEG)
tests/qa.js       Playwright QA suite
```

Files from the previous version of the site (`css/bootstrap*`, `css/freelancer*`,
`font-awesome/`, `less/`, `mail/`, the old `js/*`) are no longer referenced by
`index.html` and can be deleted whenever convenient.

## Features

- **Theming** follows the OS by default; the header toggle sets an explicit
  choice and stores it in `localStorage`. Applied before first paint, so there
  is no flash of the wrong theme.
- **Motion** — animated aurora backdrop, gradient wordmark, rotating tagline,
  scroll reveals, pointer-tracked portrait tilt and card spotlight. Every one of
  these is disabled under `prefers-reduced-motion: reduce`.
- **Email** is assembled at runtime from `data-user` / `data-domain` attributes,
  so the address is not in the page source for basic scrapers. Click the address
  in the contact card to copy it.
- **No phone number or resume file** exists anywhere in this repository.
- Try the Konami code. ↑ ↑ ↓ ↓ ← → ← → B A

## Editing content

Everything is plain HTML in `index.html`. The likely edits:

| What | Where |
| --- | --- |
| Tagline words | `words` array in `js/main.js` |
| Bio | `#about` section |
| Focus areas / skills | `.stack-card .tags` |
| Work history | `.timeline-item` entries in `#experience` |
| Projects | `.cards` in `#work` |

To add another employer to `#experience`, copy a `.timeline-item` block and
give it a `.timeline-meta` (company) and bullet list. Job titles and dates are
only shown where they were explicitly supplied — don't invent either.

## QA

`tests/qa.js` covers console errors, horizontal overflow across seven viewports,
anchor-scroll positioning, mobile menu behaviour, theme persistence, email
obfuscation, accessibility basics, reduced-motion, no-JS resilience and outbound
link hygiene.

```sh
python3 -m http.server 8160
BASE=http://localhost:8160 node tests/qa.js
```

Requires Playwright and Chromium available to Node.

## Local preview

```sh
python3 -m http.server 8000
# open http://localhost:8000
```
