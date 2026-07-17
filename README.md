# Hyderabad Sweets — Customer Analytics & Branch Expansion

A production-ready internal web application for a Hyderabad-based sweets
business. It captures customer origins, analyses demand across Hyderabad,
Secunderabad and the HMR region, and recommends optimal locations for new
branches using a transparent, heuristic recommendation engine.

> Strictly for internal use by shop staff and administrators.

## ✨ Highlights

- **Counter-friendly customer entry** — only Name + Main Area are required.
- **Area-restricted master data** — drop-downs only list valid Hyderabad / HMR
  localities; free-text addresses are rejected.
- **Automatic distance & catchment** — every customer is auto-assigned to the
  nearest active branch using the Haversine formula, both in TypeScript and as
  a database trigger.
- **Dashboard, area / sub-area / distance / branch analytics**, all with
  Recharts visualisations and CSV / Excel exports.
- **Interactive Leaflet + OpenStreetMap view** — branches, area demand bubbles,
  and recommended expansion candidates.
- **Branch Recommendation Engine** — five explainable sub-scores (demand,
  growth, distance, coverage, repeat customers) combined into a 0-100
  confidence score with plain-English reasoning.
- **AI Insights module** — rule-based commentary on the data (e.g.
  “Gachibowli cluster contributes 42% of customers”).
- **Premium internal-tool UI** — maroon / gold / cream palette, Playfair
  Display headings, dark-mode aware, responsive down to mobile.

## 🧱 Tech stack

| Layer       | Choice                                                            |
| ----------- | ------------------------------------------------------------------ |
| Framework   | **Next.js 15 (App Router) + React 19 + TypeScript**                |
| Styling     | **Tailwind CSS + ShadCN-style primitives** (Radix UI under the hood) |
| Backend     | **Supabase** (PostgreSQL + Auth + RLS)                             |
| Charts      | **Recharts**                                                       |
| Maps        | **Leaflet + OpenStreetMap** (no API key required)                  |
| Exports     | **xlsx**, CSV                                                       |
| Hosting     | **Vercel** (recommended)                                            |

## 🚀 Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Provision Supabase

Run the SQL in `supabase/migrations/0001_init.sql` followed by
`supabase/seed.sql` (see `supabase/README.md` for details). The seed data
includes 30+ HMR localities and a couple of example branches so you can start
clicking through the UI immediately.

### 3. Configure environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Then fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 4. Create your first admin

Sign up via Supabase Auth (Dashboard → Authentication → Users → Invite User),
then promote yourself in SQL:

```sql
update public.profiles
   set role = 'admin', is_active = true
 where email = 'you@hyderabadsweets.local';
```

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in.

## 🗂️ Project structure

```
src/
├── app/
│   ├── (app)/                    # Auth-gated workspace
│   │   ├── dashboard/            # KPI dashboard
│   │   ├── customers/            # List + entry form + server actions
│   │   ├── branches/             # Admin-only branch CRUD
│   │   ├── master-data/          # Admin-only areas / sub-areas
│   │   ├── analytics/            # Tabbed analytics
│   │   ├── recommendations/      # Branch recommendation engine UI
│   │   ├── insights/             # AI insights
│   │   ├── reports/              # Period reports + CSV/Excel export
│   │   ├── map/                  # Leaflet OSM view
│   │   └── layout.tsx            # Sidebar + topbar shell
│   ├── auth/signout/             # Sign-out route
│   ├── login/                    # Login screen (full-bleed split layout)
│   ├── layout.tsx                # Root layout, theme provider, toasts
│   └── globals.css               # Brand palette + Tailwind layers
├── components/
│   ├── ui/                       # shadcn-style primitives (Button, Card …)
│   ├── layout/                   # Sidebar, topbar, mobile nav
│   ├── auth/                     # Login form (client)
│   ├── customers/                # Entry form, row actions
│   ├── branches/                 # Branch admin manager
│   ├── master-data/              # Area + sub-area admin tables
│   ├── dashboard/                # KPI card primitives
│   ├── charts/                   # Recharts wrappers
│   ├── reports/                  # Reports tool (export)
│   └── map/                      # Leaflet client component
├── lib/
│   ├── supabase/                 # SSR client, server client, admin client
│   ├── analytics/                # Queries, aggregations, recs, insights
│   ├── geo.ts                    # Haversine, distance buckets
│   ├── validation.ts             # Zod schemas
│   ├── exports.ts                # CSV / xlsx helpers
│   ├── navigation.ts             # Role-aware sidebar config
│   └── auth.ts                   # requireProfile / requireAdmin helpers
└── middleware.ts                 # Session refresh + protected routes
supabase/
├── migrations/0001_init.sql      # Tables, triggers, policies
├── seed.sql                      # HMR master data + sample branches
└── README.md                     # Supabase setup guide
```

## 🧠 Recommendation engine — how it works

`src/lib/analytics/recommendations.ts`

For every HMR area that does **not** already host an active branch, we
compute five normalised sub-scores (each 0-100):

| Sub-score    | Signal                                                 | Weight |
| ------------ | -------------------------------------------------------- | ------ |
| `demand`     | Total customer volume from this area so far               | 32%    |
| `growth`     | 30-day vs prior-30-day customer growth %                  | 22%    |
| `distance`   | Average distance customers currently travel               | 18%    |
| `coverage`   | Distance from area centroid to nearest existing branch    | 20%    |
| `repeat`     | Share of unique mobiles that show up more than once       | 8%     |

The weighted sum (clamped to 0-100) is the **Confidence Score**.

Each recommendation also surfaces:

- Expected reach (rough customer pool size)
- Estimated distance reduction for current customers
- Top sub-area hotspot
- Coverage radius (used in the map)
- Plain-English “reasons” summary

Everything is deterministic and easy to swap for a learned model later.

## 🗺️ Geographic scope

Only Hyderabad, Secunderabad, and HMDA / HMR localities are accepted. The
customer entry form, branch creation, and master-data dialogs all enforce this
by:

1. Restricting selections to the `hyderabad_areas` / `hyderabad_sub_areas`
   tables.
2. Server-side re-validating against those tables before insert.
3. Coordinate validation (`lat 16-19`, `lng 77-80`) on branches and areas.

## 🔐 Roles

- **Admin** — full access: branches, master data, all analytics & exports.
- **Staff** — fast customer entry, list & search, dashboards & reports.

Roles are stored in `public.profiles.role` and enforced through Supabase RLS
policies plus Next.js server-side guards (`requireAdmin`, `requireProfile`).

## 📊 Exports

`/reports` exports:

- **CSV** — flat customer list with all fields.
- **Excel (xlsx)** — multi-sheet workbook: customers, by-area, by-sub-area,
  by-distance, by-branch.

(PDF is on the post-MVP roadmap.)

## 🛣️ Roadmap (post-MVP)

- Full place autocomplete + Google Places geocoding for exact pins.
- Customer-level density polygons + heatmaps.
- ML-based forecasting (Prophet / linear models).
- Loyalty programme + WhatsApp re-engagement.
- Revenue analytics (SKU-level integration with billing).
- Franchise / multi-region rollout.

## 🛠️ Useful npm scripts

```bash
npm run dev        # start the local dev server
npm run build      # production build (also runs type-check)
npm run start      # run the production build
npm run lint       # run ESLint
npm run typecheck  # run tsc --noEmit
```

## 📦 Deployment

The app is designed for **Vercel + Supabase**.

1. Connect the repo to Vercel.
2. Add the three `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` env vars in the Vercel project settings.
3. Deploy. The middleware will redirect unauthenticated traffic to `/login`.

## 📄 License

Internal / proprietary — see your engagement contract.
