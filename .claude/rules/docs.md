---
paths:
  - "docs/**/*"
  - "website/**/*"
  - "README.md"
  - "CONTRIBUTING.md"
  - "SECURITY.md"
---

# Docs and the docs site

`docs/` and the root Markdown pages are published to https://dialmasterorg.github.io/Youtarr/ through `website/`, and readers also see them on GitHub.

- `website/scripts/manifest.mjs` publishes every `docs/**/*.md` plus `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, `LICENSE.md` and `CONTRIBUTORS.md`. `CLAUDE.md` is excluded, and a page's sidebar section comes from its filename.
- CI runs `npm run docs:check` and `npm run docs:build`, which fail on a broken link or anchor, so run them after changing a heading or link.
- Relative links must resolve to a published page. A repository file that is not published (Compose YAML, for example) needs a full GitHub URL, and an image goes under `website/static/`.
- Write callouts as plain `**Note:**` text, because `> [!NOTE]` renders literally on the docs site and `:::note` renders literally on GitHub.
