# The Syndicate — Setup Guide

A real-time classroom game for 150 MSc students across 23 teams.

---

## Quick Start

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Once created, go to **SQL Editor** and run the full contents of `supabase/schema.sql`
3. If the `ALTER PUBLICATION` commands fail, enable Realtime manually:
   - Go to **Database > Replication**
   - Enable replication for: `game_state`, `submissions`, `teams`, `players`

### 2. Configure Credentials

1. In Supabase, go to **Project Settings > API**
2. Copy your **Project URL** and **anon public key**
3. Edit `js/config.js` and replace the placeholder values:

```javascript
const SUPABASE_URL = 'https://your-project-ref.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-public-key-here';
```

### 3. Deploy to Vercel

1. Push this project to a GitHub repository
2. Go to [vercel.com](https://vercel.com) and import the repository
3. Deploy — no build configuration needed (static files only)

Alternatively, run locally by opening `index.html` directly in a browser (Supabase handles CORS).

---

## Pages

| URL | Purpose |
|-----|---------|
| `/` | Player login |
| `/player` | Player view (phone screen) |
| `/facilitator` | Facilitator control panel (laptop) |
| `/scoreboard` | Live scoreboard (projector) |

**Facilitator password:** `syndicate2025`

---

## Running the Game

### Before the session
1. Open `/facilitator` on your laptop
2. Open `/scoreboard` in a second tab and project/share it
3. Share the `/` (login) URL with students — they join on their phones

### Round sequence
| Round | Type | Question |
|-------|------|----------|
| 1 | Main | Apple 2023 revenue ($bn) — Answer: 383 |
| 2 | Main | EV % of global car sales 2023 — Answer: 18 |
| 3 | Main | McDonald's worldwide restaurants — Answer: 40,000 |
| 4 | **Wildcard** | London Underground stations — Answer: 272 |
| 5 | Main | Fortune 500 CEOs with MBA (%) — Answer: 40 |
| 6 | Main | Amazon US e-commerce share (%) — Answer: 38 |
| 7 | **Wildcard** | YouTube hours uploaded per minute — Answer: 500 |

### Facilitator controls per round
1. **Open Round** — activates constraints for all players, starts 8-minute timer (main rounds)
2. **Close Round Early** — optional, if you want to cut the timer short
3. **Reveal Answer** — scores all submissions, updates leaderboard
4. **Next Round** — advances to next round

### Wildcard rounds
- No timer — stays open until 3 teams score within 10% OR you close it manually
- Points awarded live as teams submit: 1st = 15 pts, 2nd = 10 pts, 3rd = 5 pts
- Dramatic announcement appears on the scoreboard automatically
- Close with **Close Round Early** after 3 teams score, then **Reveal Answer**

---

## Scoring

**Main rounds:**
- Within 10% of correct answer: **10 points**
- Within 25% of correct answer: **5 points**
- Outside 25% or no submission: **0 points**

**Wildcard rounds:**
- 1st team within 10%: **15 points**
- 2nd team within 10%: **10 points**
- 3rd team within 10%: **5 points**

---

## Communication Constraints

Each player gets a different constraint role each round (rotates using a Latin square):

| Role | Constraint |
|------|-----------|
| **Speaker** | Full communication — only person who can submit |
| **Yes/No** | Can only answer "yes" or "no" |
| **Drawing** | Can only draw/sketch — no words |
| **Fixed Phrase** | Can only repeat one assigned phrase |
| **Physical** | Gestures and pointing only |
| **Numbers** | Can only say or write numbers |
| **Silent** | Cannot communicate at all (Team 23 only, 7th player) |

Teams 1–22 have 6 players and cycle through the first 6 roles.  
Team 23 has 7 players and includes the **Silent** role.

---

## Technical Notes

- All real-time updates use Supabase Postgres Changes (WebSocket)
- No build step required — deploy as static files
- Session persisted in `localStorage` — players can refresh and rejoin their session
- Timer synced across all clients via `round_start_time` in the database
- Auto-closes main rounds when 8-minute timer expires (facilitator page must be open)

---

## Reset

Use the **Reset Game** button in the facilitator panel to wipe all players, submissions, and scores. Students will need to log in again.
