# Website Analytics & Conversion Optimization System (Advanced)

This project is now an extended analytics suite with campaign tracking, multi-experiment testing, and actionable reporting.

## Pages
- `index.html`: Landing page with 2 experiments (CTA color + hero headline).
- `product.html`: Product interaction tracking with detailed menu engagement.
- `signup.html`: Goal conversion form with plan-level metadata.
- `campaigns.html`: UTM campaign URL builder + traffic simulation links.
- `dashboard.html`: Advanced analytics control center with filters, charts, export, and seed data.
- `reports.html`: Auto-generated insights and recommended optimization actions.

## Major Features
- Session-level analytics with source, campaign, medium, and device metadata.
- Funnel tracking: Landing -> Product -> CTA click -> Signup conversion.
- Event log with timestamps for trend and recent activity analysis.
- Traffic/channel analysis and campaign performance inputs.
- Experiment analytics:
  - CTA Color (Variant A vs B)
  - Hero Headline (Variant A vs B)
- Dashboard controls:
  - Time filter (7d, 30d, all)
  - Source filter
  - CSV export for events
  - Seed demo data button
  - Full reset
- Ad ecosystem placeholders:
  - GA4
  - Google Ads conversion events
  - AdSense ad blocks

## Viva Mapping (Your 6 Experiments)
- **Exp 1 (WordPress/blog)**: Multi-page website + content modules.
- **Exp 2 (Tracking + Traffic)**: Session/event tracking + source/campaign capture.
- **Exp 3 (User engagement)**: Page interaction events + returning sessions + trends.
- **Exp 4 (Goal tracking)**: CTA click + signup conversion measurement.
- **Exp 5 (User flow/search)**: Funnel stages + top pages + event journey.
- **Exp 6 (A/B testing)**: Two controlled experiments with CTR comparison.

## Run Locally
```powershell
cd c:\Users\gupta\Desktop\Web
python -m http.server 5500
```
Open `http://localhost:5500/index.html`.

## ID Placeholders to Replace
- `G-XXXXXXXXXX` -> GA4 Measurement ID
- `AW-XXXXXXXXX` -> Google Ads tag ID
- `CTA_CONVERSION_LABEL` and `SIGNUP_CONVERSION_LABEL` -> Conversion labels in `app.js`
- `ca-pub-XXXXXXXXXXXXXXXX` -> AdSense publisher ID
- `1234567890` -> AdSense slot ID

## Notes
- Storage is local (`localStorage`) for academic demo simplicity.
- For production, use server-side storage, consent management, and real attribution models.
