SVG Icon Sprite
================

This folder contains a single SVG sprite `icons-sprite.svg` with multiple <symbol> entries for common site sections.

Usage examples:

Inline use (recommended for consistent styling):

```html
<span class="icon">
  <svg class="icon" aria-hidden="true">
    <use href="assets/icons/icons-sprite.svg#icon-phone"></use>
  </svg>
</span>
```

Or directly embed the sprite in the HTML (copy contents of `icons-sprite.svg` into your page head) and reference with fragment-only `#icon-name`:

```html
<!-- paste sprite into page -->
<svg style="display:none"> ... </svg>

<svg class="icon"><use href="#icon-phone"></use></svg>
```

Notes:
- Icons are minimal, monoline/filled shapes and designed to use `currentColor` so they inherit text color.
- Add the `icons.css` helper for sizing classes.
- If you want me to replace existing inline SVGs across `frontend/landing/index.html` with sprite references, say "replace icons" and I'll update them.
