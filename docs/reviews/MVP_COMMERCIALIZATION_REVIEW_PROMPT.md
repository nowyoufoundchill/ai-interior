# Review prompt — MVP → free App Store app monetized by affiliate links

This file contains a single copy-paste prompt. Everything between the `---BEGIN PROMPT---`
and `---END PROMPT---` markers is the prompt. It is written to be handed to a capable
agent that has web access and read access to this repository.

---BEGIN PROMPT---

## Role

You are acting as a combined technical due-diligence reviewer, mobile product lead, and
affiliate-commerce operator. You have shipped consumer iOS apps, you have run affiliate
revenue at real scale, and you have taken web MVPs through App Store review. Your job is
not to be encouraging. Your job is to tell me exactly what stands between what exists
today and a free App Store application that earns affiliate revenue, and to be specific
about which parts are genuinely hard.

## What I built

An interior design web application. A homeowner uploads photographs of a real room, gives
a small amount of plain-language input, and the app returns a designed transformation of
their actual room. From that accepted design it produces an implementation package
including a product list. The commercial idea is that the product list becomes affiliate
links, the app is free, and revenue comes from affiliate commissions.

Live MVP: https://ai-interior-theta.vercel.app/dashboard
Repository: the one you have been given access to.

Verified facts about the current build — confirm each yourself, do not take them on faith:

- Next.js 16 / React 19 / TypeScript, deployed on Vercel, Tailwind for styling.
- Supabase (Postgres + Storage) for persistence. `@supabase/ssr` and `@supabase/supabase-js`
  are installed. Service-role credentials are server-only by design.
- Providers: Anthropic for reasoning, OpenAI for image editing, Tavily for sourcing
  support (`lib/ai/tavily.ts` wraps Tavily `/search` and `/extract`).
- No authentication exists. `app/login/page.tsx` is a stub that redirects to `/dashboard`.
  `middleware.ts` is correlation-ID only and explicitly documents "no auth". The product
  is currently designed as private, single-household, unauthenticated.
- Long-running work runs as persisted, bounded, retryable jobs
  (`app/api/rooms/[roomId]/jobs/*`, `generation_jobs` migration).
- The `products` table (`supabase/migrations/001_initial_schema.sql`) has
  `category, name, retailer, url, image_url, price, dimensions, material, finish, scores,
  reason_selected, risks, alternatives, status`. There is no affiliate column of any kind.
- Artifacts are append-only; superseded work goes stale rather than being deleted.
- `docs/PRODUCT.md` is the product contract, `docs/ACTIVE_BUILD.md` is the current build
  state. Read both before judging intent — several things that look like gaps are
  deliberate product decisions, and you should say so when that is the case.

## Ground rules

1. **Verify before you assert.** Open the live URL and actually walk the flow. Read the
   code paths you are judging. Where you cannot verify something (because it needs a paid
   provider key, a real device, or an account I have not given you), say so explicitly and
   label it `UNVERIFIED` rather than guessing.
2. **Cite.** Every claim about the codebase cites `file:line`. Every claim about a
   platform rule, affiliate network policy, or API capability cites the current primary
   source with a link and the date you checked it. Policies in this space change; do not
   answer from memory.
3. **Separate fact from judgment.** Mark each finding as `FACT`, `INFERENCE`, or `OPINION`.
4. **Rank by revenue impact, not by tidiness.** A missing affiliate attribution mechanism
   outranks a styling inconsistency, always.
5. **Distinguish blocker from cost from nice-to-have.** A "blocker" means the app cannot
   ship or cannot earn. Use the word precisely.
6. **No plan theatre.** I do not want a 12-phase roadmap with invented dates. I want the
   real critical path, the genuine unknowns, and honest ranges.
7. If you believe the whole premise is unsound — that this business cannot work at the
   unit economics available — say that plainly and show the arithmetic. That is a
   legitimate and useful answer.

## Sections the review must cover

### A. Does the MVP actually work, and is the core defensible

Walk the live app end to end as a first-time user with a real room photograph.

- Where does the flow break, stall, or produce something a homeowner would not accept?
- Is the transformed image good enough that a person would act on it? This is the whole
  product; judge it honestly against Decorilla / Havenly / Spacejoy / Modsy-style
  expectations, and against what a person can already get free from ChatGPT or Gemini in
  a chat window.
- What is the actual defensible moat here, if any: persistence, whole-home memory,
  revision fidelity, the implementation package, or nothing?
- How reliable is architectural retention — does the output preserve the real room's
  windows, doors, ceiling lines, and proportions, or does it hallucinate a different room?
  A design that is not recognisably *their* room kills both retention and purchase intent.
- Cold-start and empty states: what does a brand-new user see, and how many steps until
  the first image?

### B. The user experience, specifically as a funnel to an affiliate click

This is the part I care most about. Model the funnel explicitly:

`install → first photo → first design → accept design → view product list → tap product → retailer site → purchase`

For each step, estimate drop-off and identify what causes it. Then answer:

- How long from cold open to first rendered design? What is the wait experience? Generation
  latency is the single most common killer of this kind of app — quantify it.
- Does the user ever actually reach the product list, or is it buried behind accepting a
  design, an implementation package, and a sourcing job? Count the taps.
- Is there any reason for a user to return after their first design? Map the retention
  loop, or state that there isn't one.
- Where does the app ask for input it does not need? Where does it ask too late?
- Does the product list read as a genuine shopping list a person would buy from, or as an
  AI-generated list of approximations? Trust here is the conversion mechanism.
- Failure and recovery: what happens on a failed generation, a slow job, a backgrounded
  app, a lost connection? Judge this against the invariant that work must survive refresh.
- Assess at 390px specifically. Phone is the only viewport that matters for this business.

Deliverable: a funnel table with each step, the current friction, the fix, and the
estimated conversion impact of the fix.

### C. Web MVP → native iOS application

- Compare the realistic options and recommend one with reasoning: React Native/Expo
  rewrite, Capacitor or a native shell wrapping the existing Next.js app, a PWA, or
  native Swift. Factor in that the entire product is server-rendered Next.js today and the
  API routes are reusable as a backend regardless of the client choice.
- Address App Store Review Guideline 4.2 (Minimum Functionality) directly: a thin wrapper
  around a website gets rejected. What is the minimum native surface that clears it —
  camera capture, photo library integration, push notifications, offline state, share
  sheet? Be specific about which of these are needed versus merely nice.
- Native camera capture is likely a product upgrade, not just a compliance box. Assess
  whether guided in-app capture (framing, lighting, multiple angles) would materially
  improve output quality versus library uploads.
- Push notifications matter here because generation is asynchronous. Specify the work:
  APNs, device token storage, tying notifications to the existing job system.
- What happens to the job/polling architecture when the client is a phone that gets
  backgrounded or killed mid-generation?
- Android: recommend whether to do it at the same time or defer, with reasoning.
- Estimate engineering effort in person-weeks for the recommended path, with ranges.

### D. App Store listing, review, and compliance

Check every one of these against the current guidelines and cite them:

- **Guideline 3.1.1 / 3.1.3 and physical goods.** Confirm the current position on apps
  that link out to purchase physical goods and whether affiliate commission on physical
  goods requires In-App Purchase. Then state the consequence clearly: if I later add a
  paid tier for extra generations, that is digital content and the rules are different.
  Tell me exactly where the line is, because getting this wrong is an existential risk.
- **Guideline 4.7 / AI-generated content and 1.2 UGC.** Users upload photographs and the
  app generates images. What moderation, reporting, and content-filtering obligations
  attach? What is the minimum viable moderation pipeline for uploaded photos, and what is
  the risk exposure if someone uploads something illegal?
- **Guideline 5.1.1(v).** If I add accounts, in-app account deletion becomes mandatory.
  Scope that work against the append-only artifact invariant — deletion and append-only
  are in direct tension and I need to know how to reconcile them.
- **Guideline 4.8 Login Services.** If I offer any third-party login, Sign in with Apple
  obligations follow. Confirm current requirements.
- **App Privacy nutrition labels and ATT.** Photographs of the inside of someone's home
  are sensitive data. Enumerate exactly what I must declare, what permission strings I
  need, and whether affiliate tracking triggers App Tracking Transparency.
- The full submission checklist: privacy policy URL, support URL, age rating, export
  compliance, demo account for reviewers, screenshots, and what App Review will actually
  do when they test an AI app that costs me money per generation.
- Realistic first-submission rejection risks for *this specific app*, ranked by
  likelihood, each with the mitigation.

### E. Affiliate sourcing and link generation — the revenue mechanism

Be rigorous here. This is where I most suspect my assumptions are wrong.

- **What Tavily can and cannot do.** I assumed Tavily could source and generate affiliate
  links. Verify this against Tavily's actual API surface (the repo already wraps `/search`
  and `/extract`). State plainly whether Tavily generates affiliate links, and if it does
  not, what it *is* useful for in this pipeline.
- **How affiliate links are actually produced.** Cover the real options and recommend a
  concrete stack: Amazon Associates and PA-API 5.0, Impact, CJ, Rakuten, Awin, ShareASale,
  and auto-affiliation layers such as Skimlinks or Sovrn Commerce that convert arbitrary
  merchant URLs into tracked links. For each, cover: approval requirements and whether a
  brand-new app with no traffic will be accepted, API access prerequisites, commission
  rates in home/furniture categories, cookie or attribution windows, payout thresholds,
  and mobile-app-specific policies.
- **The cold-start problem.** Several networks require existing traffic or qualifying
  sales before granting API access. Amazon PA-API in particular. Sequence the path: what
  do I do on day one before I qualify for anything?
- **Product identity is the hard problem.** The image model invents furniture; it does not
  select SKUs. Assess how the pipeline currently gets from a generated image to a real
  purchasable product (`app/api/rooms/[roomId]/source-products/route.ts`, `lib/ai/*`), and
  how accurate that match plausibly is. A shopping list of items that don't resemble what
  is in the picture converts at approximately zero. Recommend the approach: visual
  similarity search, merchant product feeds, catalogue-constrained generation (generate
  *from* real products rather than matching after the fact), or a hybrid.
- **Data freshness.** Price and stock go stale. What breaks when a user taps through to a
  404 or a sold-out item, and what is the maintenance model?
- **Attribution mechanics on mobile.** This is where affiliate revenue silently
  disappears. Cover: `SFSafariViewController` versus `WKWebView` and cookie behaviour,
  universal links deep-linking into the retailer's native app and whether the network
  supports app-to-app attribution, ITP and cookie lifetime, and how to verify attribution
  is actually working rather than assuming it is.
- **Disclosure and legal.** FTC affiliate disclosure requirements and where the disclosure
  must appear in the app. Also flag the tax and entity questions (1099s, business entity,
  international payouts) since I have not thought about them.
- **Schema work.** The `products` table has no affiliate fields. Specify the additive
  migration needed — network, merchant ID, canonical URL versus tracked URL, commission
  rate, click ID, last-verified timestamp — consistent with the repo's additive-only
  migration rule.
- **Click and conversion tracking.** I need to know which designs earn money. Specify the
  minimum event pipeline: click logging, network postback or report ingestion,
  reconciliation, and per-design revenue attribution.

### F. Authentication, accounts, and multi-tenancy

The app is currently single-household and unauthenticated by explicit product decision.
Going to the App Store changes that.

- Recommend the auth approach — Supabase Auth with Sign in with Apple, Google, email;
  what about anonymous-first so a user can get their first design before signing up? Given
  the funnel, I suspect forcing signup before the first image is fatal. Give me a
  recommendation with reasoning.
- Scope the multi-tenancy work honestly. Today everything is server-side with a service
  role and no per-user isolation. Enumerate every table needing an owner column and RLS
  policy, the additive migration path, and the risk of getting isolation wrong. This is
  probably the largest single engineering item in the whole review — confirm or refute
  that.
- Data model for a real user base: household sharing (couples design together — is that
  one account or two?), device sync, account deletion versus append-only artifacts.
- Abuse and cost control. With no auth, anyone can burn my OpenAI budget. Specify rate
  limiting, per-user generation quotas, and abuse detection. Quantify worst-case spend
  under an attack.
- Security review of what exists: service-role key handling, storage bucket policies,
  signed URL expiry, whether any API route would leak another user's room once multiple
  users exist.

### G. Unit economics — the section that decides whether any of this is worth doing

Build an actual model with stated assumptions.

- Cost per user: image generation calls, Anthropic reasoning calls, Tavily credits,
  storage, bandwidth, Supabase and Vercel tier costs at 1k, 10k, and 100k users. Use the
  repo's real call patterns and current published provider prices; cite them.
- Revenue per user: realistic click-through from design to product, realistic conversion
  on a furniture purchase, average order value, commission rate in the home category, and
  attribution loss. Be pessimistic and say so.
- Then compute the honest number: **contribution margin per active user**, and the
  break-even conversion rate.
- If the arithmetic does not work at plausible values — and I want you to consider that it
  may not, since furniture commissions are typically low single-digit percentages while
  image generation has real marginal cost — say so directly and model the alternatives:
  freemium generation limits, a subscription tier, ads, lead-gen to designers, or a
  retailer partnership. Do not soften this.
- Specify the free-tier generation limit that keeps costs survivable without destroying
  the funnel.

### H. Marketing and distribution

- ASO: keyword strategy, title and subtitle, screenshot narrative, and the App Store
  category to target for this app specifically.
- Assess whether paid user acquisition can ever work here. Compare plausible CPI against
  the LTV from section G and give a verdict.
- Organic channels, ranked by fit: before/after content is inherently shareable, so assess
  Pinterest, TikTok, Instagram Reels, and YouTube Shorts specifically. What is the content
  engine, and can it be semi-automated from real user designs (with consent)?
- In-app virality: shareable before/after outputs, watermarking, referral mechanics. What
  is the single highest-leverage share moment in the flow?
- The first 1,000 users: give a concrete launch plan, not a channel list.
- Email or push lifecycle: what messages, at what trigger, to bring a user back to their
  unfinished room.

### I. Everything I have not thought of

Do not skip this section and do not pad it. Include only items that are genuinely material
and that I have not raised. Consider at minimum, and add whatever else you find:

- Legal exposure from design advice: fit, clearance, structural, or safety claims. The
  repo already treats visual inference as distinct from measurement — assess whether the
  owner-facing product holds that line well enough to be defensible with real users.
- Liability if a homeowner buys furniture that doesn't fit based on my app's output.
- Photograph privacy and retention: interior photos, faces or children potentially in
  frame, GDPR/CCPA, what my provider terms allow, whether uploads may be used for training.
- Provider dependency and terms-of-service risk: OpenAI image editing policy changes,
  price changes, rate limits, and what happens to the business if a provider changes terms.
- Content moderation of uploaded photos as a legal, not just policy, obligation.
- Support load: a consumer app with AI failures generates real support volume.
- Analytics and instrumentation: what I must be able to measure from day one, and the
  privacy constraints on measuring it.
- Accessibility, and whether it affects App Store approval or market reach.
- Internationalisation: affiliate networks, retailers, and currencies are country-specific.
- Key-person and operational risk of running this solo.

### J. Verdict and critical path

- A one-paragraph honest verdict: is this a business, a feature, or a portfolio piece?
- The ranked critical path to a shipped, earning v1 — the shortest genuine sequence, with
  effort estimates and explicit dependencies.
- The three things most likely to kill it, each with an early-warning signal I could watch
  for.
- The cheapest experiment that would validate or kill the affiliate revenue thesis before
  I build the native app. I would rather spend two weeks proving the economics than three
  months building the wrong thing.

## Output format

1. **Executive summary** — one page maximum. Verdict, the three blockers, the critical
   path. Written so it is useful on its own.
2. **Findings by section A–J** — each finding with severity (`BLOCKER` / `HIGH` / `MEDIUM`
   / `LOW`), evidence with citations, and a concrete recommendation.
3. **Unit economics model** — a table with every assumption stated and sourced.
4. **Critical path** — ordered, with effort ranges and dependencies.
5. **Risk register** — risk, likelihood, impact, mitigation, early-warning signal.
6. **Open questions for me** — decisions only I can make, each with the options and the
   consequence of each.

Do not modify any code. This is a review. If you find something so broken it changes the
review's conclusions, report it — do not fix it.

---END PROMPT---

## Notes on using this prompt

- Give the reviewer web access. Sections D, E, and G are worthless without live policy and
  pricing lookups.
- If the reviewer cannot reach the live URL, expect section A and B quality to drop
  sharply; consider supplying screen recordings of the real flow instead.
- Sections E and G are the ones most likely to change the plan. If you only have budget
  for a partial review, run those two first.
