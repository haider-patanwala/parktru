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

## Component Strategy

- Prefer building UI with shadcn-style components and composition patterns.
- Reuse existing shadcn components before creating new primitives.
- It is fine to extend, restyle, or compose beyond default shadcn presentation when the product needs a stronger identity.
- Do not treat the default shadcn look as the final design system.
- Keep the underlying component APIs ergonomic, accessible, and easy to maintain.

## Design Rules

- Use clear hierarchy before decorative styling.
- Prefer fewer elements with better spacing.
- Keep each screen focused on one primary action.
- Use consistent surface styles, border radii, and spacing rhythm.
- Prefer calm neutrals with one restrained accent family.
- Ensure contrast is strong enough for fast scanning.
- Make empty, loading, error, and offline states feel intentional.
- Aim for interfaces that feel designed by a thoughtful product designer, not generated from a generic SaaS template.
- Choose one coherent visual idea per screen and carry it through spacing, type, color, and surface treatment.

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

## shadcn Rules

- If shadcn is already installed in the repo, compose from its existing primitives first.
- If shadcn is not installed and the task requires a component system, propose or add it intentionally instead of hand-waving the dependency.
- Treat shadcn as a component foundation, not as the finished brand language.
- Restyle components through tokens, variants, spacing, and typography so screens do not look copy-pasted from the default shadcn examples.

## Visual Originality Rules

- Avoid the generic "AI-generated app" look: centered marketing blobs, random purple gradients, excessive glass cards, and interchangeable dashboard blocks.
- Prefer distinctive but likable decisions: stronger typography, a clear spacing rhythm, restrained accents, and purposeful asymmetry when it improves hierarchy.
- Make the UI memorable through composition and polish, not novelty for its own sake.
- If a screen starts to resemble a default starter kit, push it toward a clearer product identity.

## Motion Rules

- Use animation only to clarify transitions or feedback.
- Keep motion fast and understated.
- Avoid decorative motion loops.

## Anti-Patterns

- Do not build dashboard-like clutter by default.
- Do not overload the page with badges, pills, and dividers.
- Do not use loud gradients or multiple accent colors without a product reason.
- Do not create components that look polished but hide the primary action.
- Do not ship untouched default shadcn styling when the page needs stronger identity.
- Do not generate layouts that feel like stock AI SaaS templates.

## Review Checklist

Before finishing UI work, check:

- Is the main action obvious in under 3 seconds?
- Is the screen readable without explaining it?
- Is the spacing doing more work than extra decoration?
- Does it still feel clean on mobile?
- Are offline/loading/error states covered?
