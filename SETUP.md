# TriTime — Triathlon Timing App
## Complete Setup Guide

---

## What You're Getting

A full race management and timing web app with:
- Participant registration + editing
- Race-day check-in
- Kids timing (Start → Finish)
- Adult timing (Start → Swim → Bike → Run → Finish with splits)
- Live results (auto-refresh every 10s)
- Final results (Top 3 overall, men, women, teams)
- Print/PDF results page

**Tech stack:** React + Vite → Netlify (frontend), Supabase PostgreSQL (database)

---

## Step 1 — Create Your Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up / log in
2. Click **New Project**
3. Fill in:
   - **Name:** `triathlon-timing` (or anything you want)
   - **Database Password:** choose a strong password and save it
   - **Region:** pick the one closest to your event location
4. Click **Create new project** and wait ~2 minutes for it to spin up

---

## Step 2 — Run the Database Setup SQL

1. In your Supabase project, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open the file `supabase_setup.sql` from this project folder
4. Copy the entire contents and paste it into the SQL editor
5. Click **Run** (the green button)
6. You should see: `Success. No rows returned`

To verify it worked, run this in the SQL editor:
```sql
select table_name from information_schema.tables
where table_schema = 'public';
```
You should see: `participants`, `race_events`, `timing_records`

---

## Step 3 — Get Your Supabase API Keys

1. In your Supabase project, click **Settings** (gear icon) → **API**
2. Copy two values:
   - **Project URL** — looks like `https://abcdefghijkl.supabase.co`
   - **anon public** key — a long string starting with `eyJ...`

Keep these handy for the next steps.

---

## Step 4 — Set Up the Project Locally

Make sure you have **Node.js 18+** installed. Check with:
```bash
node --version
```

Then in your terminal:
```bash
# Navigate to the project folder
cd triathlon

# Install dependencies
npm install

# Create your environment file
cp .env.example .env
```

Open `.env` in any text editor and fill in your keys:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJyour-long-anon-key-here
```

Test locally:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) — you should see the dashboard.

---

## Step 5 — Deploy to Netlify

### Option A: Drag-and-Drop (fastest, no Git required)

1. Build the project:
   ```bash
   npm run build
   ```
   This creates a `dist/` folder.

2. Go to [https://app.netlify.com](https://app.netlify.com) and log in
3. On the dashboard, drag your `dist/` folder directly onto the page where it says "drag and drop your site folder here"
4. Netlify will give you a URL like `https://amazing-name-123.netlify.app`

5. **Add environment variables in Netlify:**
   - Go to your site → **Site settings** → **Environment variables**
   - Click **Add variable** for each:
     - `VITE_SUPABASE_URL` → your Supabase project URL
     - `VITE_SUPABASE_ANON_KEY` → your anon key
   - After adding, rebuild: **Deploys** → **Trigger deploy** → **Deploy site**

> ⚠️ NOTE: With drag-and-drop, you must rebuild and re-upload `dist/` each time you make changes. For easier updates, use Option B.

### Option B: GitHub + Continuous Deploy (recommended if you know Git)

1. Push this project folder to a new GitHub repository
2. In Netlify: **Add new site** → **Import an existing project** → connect GitHub
3. Select your repo
4. Build settings (Netlify may auto-detect these):
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. Before finishing, click **Advanced** → **Add environment variables** and add your two Supabase keys
6. Click **Deploy site**

Future changes: push to GitHub → Netlify auto-deploys.

---

## Step 6 — Configure Supabase for Your Netlify Domain

1. In Supabase → **Authentication** → **URL Configuration**
2. Add your Netlify URL to **Allowed origins** (e.g. `https://amazing-name-123.netlify.app`)

> This prevents CORS errors when your live site talks to the database.

---

## Day-of-Race Checklist

### Before Registration Opens
- [ ] Open the app on a laptop or tablet
- [ ] Go to **Participants** and verify any pre-registered participants imported correctly
- [ ] Test adding one participant via **Registration** and delete them

### During Check-In
- [ ] Use the **Check-In** page — search by number or name
- [ ] Use the quick buttons: Check In / Mark Paid / Give Swag
- [ ] Day-of registrations: click **+ Day-of Registration** at the top right

### Starting the Kids Race
- [ ] Go to **Kids Race** (Timing section in sidebar)
- [ ] Verify only checked-in kids appear
- [ ] Click **▶ Start Race** when the race starts — this locks the start time
- [ ] Type race numbers and press Enter (or click Mark Finished) as kids cross

### Starting the Adult Race
- [ ] Go to **Adult Race**
- [ ] Click **▶ Start Race**
- [ ] Type race number → next checkpoint button appears → click it or press Enter

### Viewing Results
- [ ] **Live Results** pages auto-refresh every 10 seconds
- [ ] **Final Results** shows top 3 / gender / team breakdowns
- [ ] **Print** page → click "Print / Save PDF" button for official results

---

## Page Reference

| Page | URL | Purpose |
|------|-----|---------|
| Dashboard | `/` | Stats overview |
| Registration | `/register` | Add participant |
| Edit Participant | `/register/:id` | Edit existing |
| Participant List | `/participants` | Search + manage all |
| Check-In | `/checkin` | Race day check-in |
| Kids Timing | `/timing/kids` | Time the kids race |
| Adult Timing | `/timing/adult` | Time the adult race |
| Live Results — Kids | `/results/live/kids` | Real-time kids results |
| Live Results — Adults | `/results/live/adult` | Real-time adult results |
| Final Results | `/results/final` | Top 3, gender, teams |
| Print Results | `/results/print` | Print / PDF page |

---

## Timing Keyboard Shortcut

On the timing pages, type a race number and press **Enter** to instantly record the next checkpoint for that racer. This is the fastest way to operate during a race.

---

## Troubleshooting

**"Missing VITE_SUPABASE_URL" error**
→ Your `.env` file is missing or has wrong variable names. Check spelling exactly: `VITE_SUPABASE_URL`

**Blank page on Netlify after deploy**
→ Make sure environment variables are set in Netlify AND you triggered a new deploy after adding them.

**"Failed to fetch" errors in the app**
→ Check that your Supabase URL and anon key are correct. Also check that RLS is disabled (it is by default with the setup SQL).

**Race numbers not auto-incrementing**
→ This is calculated in the app by finding the max existing race number. If participants were added directly to the database with duplicate numbers, fix those first.

**Can't add participants after race started**
→ This is intentional. Once Start Race is clicked on a timing page, that race_type is locked for new registrations. Use the Check-In page to manage existing participants.

---

## File Structure

```
triathlon/
├── index.html
├── vite.config.js
├── package.json
├── netlify.toml          ← SPA routing fix for Netlify
├── .env.example          ← Copy to .env and fill in keys
├── .gitignore
├── supabase_setup.sql    ← Run this in Supabase SQL editor
└── src/
    ├── main.jsx
    ├── App.jsx            ← Routes + sidebar
    ├── index.css          ← All styles
    ├── lib/
    │   ├── supabase.js    ← DB client
    │   └── utils.js       ← Time math, helpers
    ├── components/
    │   └── ConfirmModal.jsx
    └── pages/
        ├── Dashboard.jsx
        ├── Registration.jsx
        ├── ParticipantList.jsx
        ├── CheckIn.jsx
        ├── KidsTiming.jsx
        ├── AdultTiming.jsx
        ├── LiveResultsKids.jsx
        ├── LiveResultsAdult.jsx
        ├── FinalResults.jsx
        └── PrintResults.jsx
```
