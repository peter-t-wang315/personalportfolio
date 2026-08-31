# Content intake

Everything still needed before the content files can be frozen. Rough notes are fine — they get rewritten. The important thing is facts, numbers, and what was actually built.

## Blocking

**1. Internal naming.** Confirm the descriptive replacements in `03-content-model.md`, or confirm with your manager that the internal names can ship. This has been raised twice and is the one item with a real downside if it goes wrong.

**2. Photo** for `/about`.

**3. Corrections** to the eight drafted project write-ups in `03-content-model.md`. Particularly the through-hole platform, since it is the only system you built alone and the draft is assembled from a single paragraph.

**4. Should the through-hole platform be one node or three?** Splitting it into client, worker, and supervisor gives the site a second real topology with runtime edges — and unlike the solder line, this one is entirely yours. Recommend splitting. Needs a one-line description of each tier.

## Project write-ups needed

For each: what it does, what you built, technologies, any numbers, live URL, ownership.

**Flying probe dashboard.** Migrated from WPF to React/Redux. What does the dashboard actually show an operator, and what can they do with it? How does machine state get from the backend to the frontend — polling, websockets? Roughly how many operators use it?

**METER — ZENTRA web pages.** Subscriptions and purchasing pages, React/MUI, used by 90%+ of users. What were the pages, and what does the 90% figure count?

**METER — weather pipeline.** Python on AWS Lambda and DynamoDB via Serverless Framework, feeding soil moisture predictions. Plus the Django query optimization over 150k+ objects — same project or separate? Recommend keeping them one node with two threads.

**VGCLite.** Multi-tier caching over Pikalytics and Smogon data behind Next.js route handlers with per-source TTLs, auto-discovering the latest published stats period at runtime, plus client-side deduplication. Live URL? Any usage numbers? This is your strongest personal project for a backend audience — the caching story maps directly onto real infrastructure work.

**Pokémon Team Builder.** What does it do beyond the repo description, and what's the live URL?

**TimeSense.** Won the advanced track at WSU CrimsonCode 2024. What does it do? Team size, your part, how long you had.

**Sonder Barber** (sonderbarbers.com) and **Thai Ginger** (thaigingerpullman.com). What did each client need, what did you build, what stack? Anything measurable — bookings, orders, traffic? Confirm both are still live and that the owners are fine with them being credited.

**CartPole.** Repo says "Attempting to AI." What was the actual scope — RL from scratch, or a Gym environment? Be honest; a small honest ML project reads better than an inflated one.

**WSU Hackathon 2023** (Elixir, with BrandonCook7). What was it, and did it place?

**This site.** Written last, once it exists. Next.js, R3F, the graph data model, the persistent-canvas architecture, and the decision to make it work without WebGL.

## Also needed

**`/about` copy.** Bio in your own words. What you actually like about the work. WSU. Mentoring the junior developer. On-call. How you use Claude Code — this deserves a real paragraph, not a line item, because it was named in eight of the sixteen postings we reviewed.

**Resume PDF** — the combined single-document version, exported and ready for `/public`.

**GitHub, LinkedIn, and the email address** you want public.
