---
name: awesome-design-md
description: Reference library of 74 real DESIGN.md files reverse-engineered from well-known websites and products (Stripe, Apple, Linear, Airbnb, Vercel, Notion, Tesla, etc). Use when the user wants a page or component to look like a specific named brand/company/product, or asks to "build it like Stripe/Linear/Apple/..." — read the matching DESIGN.md for exact tokens, typography, spacing, and component rules instead of guessing.
---

# Awesome DESIGN.md — Brand Design Reference Library

Vendored from [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md). Each brand folder under `design-md/` contains a `DESIGN.md` — a plain-text design-system document (colors with hex codes, typography scale, spacing, component behavior, motion) extracted from the real site.

## When to use this

The user names a specific brand/company/product as the visual target — e.g. "make this look like Stripe's docs", "give me a Linear-style dashboard", "Apple-esque product page", "Tesla configurator vibes". Do NOT use this for generic taste requests with no named brand (use `design-taste-frontend` / `impeccable` / other taste skills for that).

## How to use it

1. Match the user's named brand to a folder below (case-insensitive, ignore punctuation — e.g. "mistral" → `mistral.ai`, "x" / "xAI" → `x.ai`).
2. Read that brand's `design-md/<brand>/DESIGN.md` in full before writing any code.
3. Apply its concrete values (hex codes, font stacks, spacing scale, radii, shadow depth, motion timing) directly — don't paraphrase them into vague adjectives.
4. If the user's ask conflicts with a rule in the file (e.g. they want a color the brand doc bans), flag the conflict rather than silently overriding one or the other.
5. If no folder matches, say so explicitly rather than inventing a DESIGN.md — offer the closest available brand or fall back to a general taste skill.

## Available brands

`design-md/<name>/DESIGN.md` for each of:

airbnb, airtable, apple, binance, bmw, bmw-m, bugatti, cal, claude, clay, clickhouse, cohere, coinbase, composio, cursor, dell-1996, elevenlabs, expo, ferrari, figma, framer, hashicorp, hp, ibm, intercom, kraken, lamborghini, linear.app, lovable, mastercard, meta, minimax, mintlify, miro, mistral.ai, mongodb, nike, nintendo-2001, notion, nvidia, ollama, opencode.ai, pinterest, playstation, posthog, raycast, renault, replicate, resend, revolut, runwayml, sanity, sentry, shopify, slack, spacex, spotify, starbucks, stripe, supabase, superhuman, tesla, theverge, together.ai, uber, vercel, vodafone, voltagent, warp, webflow, wired, wise, x.ai, zapier

This list changes only when the upstream repo is re-vendored — if a brand you expect isn't here, it wasn't in the source repo at vendor time.
