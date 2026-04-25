# Innovation Guild Directory

Standalone Innovation Guild organization and machine directory with a SELCO-style public search flow.

Project folder:
`C:\github\innovation-guild-directory`

Included app surfaces:
- Public search page: `index.html`
- Organization detail page: `vendor-detail.html`
- Machine detail page: `product-detail.html`
- Admin-triggered sync page: `admin.html`
- Shared Supabase loader: `innovation-store.js`
- Supabase migration: `supabase/migrations/20260425150000_create_innovation_guild_directory.sql`
- Supabase edge function: `supabase/functions/innovation-guild-admin/index.ts`

Implementation notes:
- Organizations are normalized into vendor-style records so this dataset stays structurally parallel with SELCO and future ASKGRE cross-mapping.
- Machines are normalized into product-style records with specifications, galleries, and embedded video URLs.
- Contact fields are stored on the organization row using the same names as SELCO. The Innovation Guild API exposes reliable address/location data but not organization email/phone, so the sync also supports optional enrichment through `organization-contact-seed.json`.

Deployment:
- GitHub Pages deploys automatically from `.github/workflows/deploy-pages.yml`
- The static frontend uses the configured Supabase URL and anon key in `config.js`
- Add a `MAPMYINDIA_MAP_KEY` in `config.js` to enable the live blue-pin map

Backend requirement:
- The `innovation-guild-admin` edge function reads the existing `SELCO_VENDOR_SERVICE_ROLE_KEY` secret for Supabase service-role access
- Optionally set `INNOVATION_GUILD_APP_AUTHORIZATION` if you want to override the bundled Innovation Guild app authorization header
