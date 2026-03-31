---
name: parktru-ui
description: Use when designing or implementing UI in ParkTru. This skill keeps the interface modern, clean, intuitive, and low-cognitive-load while fitting the existing Next.js and Tailwind setup.
---

# ParkTru UI

Use this skill for screens, components, forms, empty states, and visual polish.

## Read Before Coding

Inspect these files first:

- `AGENTS.md`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/~offline/page.tsx`
- `src/styles/globals.css`

## UI Goal

The default visual direction for ParkTru is:

- modern
- clean
- quiet
- intuitive
- low cognitive load

The UI should feel confident and simple, not flashy or crowded.

## Design Rules

- Use clear hierarchy before decorative styling.
- Prefer fewer elements with better spacing.
- Keep each screen focused on one primary action.
- Use consistent surface styles, border radii, and spacing rhythm.
- Prefer calm neutrals with one restrained accent family.
- Ensure contrast is strong enough for fast scanning.
- Make empty, loading, error, and offline states feel intentional.

## Layout Rules

- Start mobile-first, then scale up.
- Use narrow reading widths for dense text.
- Group related controls inside clear sections/cards.
- Avoid nesting too many cards inside cards.
- Prefer sticky primary actions only when they reduce effort.

## Component Rules

- Keep reusable UI primitives generic and shared only when used by multiple features.
- Keep feature-specific UI inside the owning feature's `views/` folder.
- Prefer semantic HTML and accessible labels.
- Keep forms short, obvious, and forgiving.

## Tailwind Rules

- Reuse shared tokens from `src/styles/globals.css` when possible.
- If a new theme direction is needed, add CSS variables or theme tokens before scattering hard-coded values.
- Prefer composable utility groups over long inconsistent class strings.
- Use subtle shadows, borders, and gradients. Avoid visual noise.

## Motion Rules

- Use animation only to clarify transitions or feedback.
- Keep motion fast and understated.
- Avoid decorative motion loops.

## Anti-Patterns

- Do not build dashboard-like clutter by default.
- Do not overload the page with badges, pills, and dividers.
- Do not use loud gradients or multiple accent colors without a product reason.
- Do not create components that look polished but hide the primary action.

## Review Checklist

Before finishing UI work, check:

- Is the main action obvious in under 3 seconds?
- Is the screen readable without explaining it?
- Is the spacing doing more work than extra decoration?
- Does it still feel clean on mobile?
- Are offline/loading/error states covered?
