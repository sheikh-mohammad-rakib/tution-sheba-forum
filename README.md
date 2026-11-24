# Tuition Forum

A small React + Vite frontend that lists available tuition opportunities fetched from the Tuition Seba backend. Users can search, filter by salary / teacher preference / student gender, and browse tuition cards in a responsive grid.

## Features

- **Protected Access**: Master password lock screen with brute-force rate limiting and httpOnly JWT session cookies
- **Resilient data states**: clear "temporarily unavailable" screens, exponential-backoff auto-retry, and a last-good snapshot so listings stay readable while the upstream API is down
- **Tuition Opportunities**: Authenticated access to available tuition listings via private serverless proxy
  - Search across class, subject, city, area, and tuition code
  - Filter by teacher preference (male / female / all)
  - Filter by student gender (male / female / mixed / all)
  - Filter by salary range (৳)
  - Fixed filter for tuitions with 3 days/week
- **Teachers Directory (`/teachers`)**: Private paginated teacher ingestion through authenticated serverless endpoints
  - Automated background batch fetching with live progress indicator
  - Offline-first IndexedDB persistence for instant repeat page loads
  - Privacy-preserving logout that completely wipes local IndexedDB cache
  - Advanced multi-criteria search and filters (search any field, gender, area, university/institute, academic year)
  - Smooth client-side infinite scroll
  - Teacher detail modal with comprehensive educational history (SSC, HSC, Honors, Masters)
  - One-click Export to CSV and JSON (for filtered or entire datasets)
- Responsive navigation bar with client-side routing via React Router
- Loading skeleton, error, and empty states
- Vercel Analytics integration

## Tech Stack

- React 19
- Vite 8 with `@vitejs/plugin-react`
- Tailwind CSS v4 (via `@tailwindcss/vite`)
- `@vercel/analytics` for usage tracking
- ESLint 9 (`@eslint/js`, `react-hooks`, `react-refresh`)

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- npm

### Install

```bash
npm install
```

### Environment Setup

Create a `.env` file at the root (see `.env.example`):

```bash
ADMIN_PASSWORD=your-secure-password
JWT_SECRET=your-random-32-char-jwt-secret
UPSTREAM_API_BASE=https://api.tuitionsebaforum.com
```

In production, configure these same variables in the Netlify Dashboard (**Site configuration → Environment variables**).

### Run the dev server

```bash
npm run dev
```

The app starts on the default Vite port (usually `http://localhost:5173`).

### Build for production

```bash
npm run build
```

### Preview the production build

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

## Project Structure

```
.
├── index.html
├── vite.config.js
├── eslint.config.js
├── package.json
├── tuitions.json              # Sample/reference tuition data
├── public/                    # Static assets
└── src/
    ├── main.jsx               # App entry point
    ├── App.jsx                # Main page: fetching, filters, grid
    ├── index.css              # Global CSS / Tailwind entry
    ├── assets/
    └── components/
        └── TuitionCard.jsx    # Individual tuition card UI
```

## Styling

Styling is done with Tailwind utility classes directly in JSX. See [`STYLE_GUIDE.md`](./STYLE_GUIDE.md) for the full styling reference (color palette, layout patterns, badge colors, state screens, etc.).

## Data Source

Live data is loaded from the Tuition Seba backend API at runtime. `tuitions.json` is included as a reference shape for a tuition record:

```json
{
  "_id": "...",
  "tuitionCode": "12365(A)",
  "isPublish": true,
  "isUrgent": false,
  "wantedTeacher": "Female",
  "student": "1 ( Female)",
  "class": "2",
  "medium": "Bangla Medium",
  "subject": "All",
  "time": "8PM-10PM",
  "day": "5( 2 hour)",
  "salary": "2000",
  "location": "...",
  "area": "Shershah",
  "city": "chittagong",
  "note": "...",
  "joining": "As soon as"
}
```

## Deployment

The project is set up to be deployed on Vercel (a `.vercel/` directory is present and `@vercel/analytics` is wired in `App.jsx`). Run `npm run build` and deploy the `dist/` output.

## License

Private project — all rights reserved.
