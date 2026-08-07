# Task Log

## Done: Mobile bottom nav — 5 tabs (all 5 templates)
- [x] Added a "Rankings" tab to the mobile bottom nav on every page
- [x] Renamed the "Teams" tab to "College Teams"
- [x] Resulting tab order on all pages: Dashboard, Analytics, Tracker, Rankings, College Teams
  - `templates/dashboard.html`
  - `templates/analytics.html`
  - `templates/playertracker.html`
  - `templates/collegeteams.html`
  - `templates/rankings.html`
- [x] Verified CSS flex layout and `mobile-nav.js` handle 5 tabs (generic `.mobile-nav-btn` iteration; `flex: 1` distributes evenly)
- [x] Verified all routes return HTTP 200 with 5 nav buttons, a Rankings tab, and a College Teams tab

## Done: College Teams sidebar reorganization (all 5 templates)
- [x] Removed the "Work in Progress" / under-construction badge from the Teams link
- [x] Removed the "College Squash Association" sidebar section entirely (removes Schedule + Standings "Coming soon" links)
- [x] Moved the Teams link into the "Players" section and renamed it "College Teams"
  - `templates/dashboard.html`
  - `templates/analytics.html`
  - `templates/playertracker.html`
  - `templates/collegeteams.html`
  - `templates/rankings.html`
- [x] Removed the construction icon from the Teams button in the mobile bottom nav (dashboard, analytics, playertracker)
- [x] Verified all routes return HTTP 200 with the College Teams link, and no "Work in Progress" / "College Squash Association" references remain

## Done: Rankings page linked + sidebar updated
- [x] Move `rankings.html` from project root into `templates/` so the existing `/rankings` Flask route resolves it (was otherwise broken — Flask looks in `templates/` by default)
- [x] Update the "Rankings" sidebar link (was `href="#"` with a "Coming soon" badge) to point to `/rankings` and remove the "Coming soon" badge on all pages:
  - `templates/dashboard.html`
  - `templates/analytics.html`
  - `templates/playertracker.html`
  - `templates/collegeteams.html`
- [x] Leave all other "Coming soon" badges (Events, Leagues, Clubs, Schedule, Standings, Help, Settings) and the Teams "Work in Progress" badge untouched
- [x] Verified `/rankings` returns HTTP 200 and renders the Rankings page + sidebar link

## Done: "Work in Progress" badge next to Teams link
- [x] Add yellow "Work in Progress" badge + lucide construction icon to Teams sidebar link in all 4 templates
  - `templates/dashboard.html`
  - `templates/analytics.html`
  - `templates/playertracker.html`
  - `templates/collegeteams.html`
- [x] Add compact construction icon to Teams mobile bottom-nav button in all 4 templates

## Done: Signed rank change numbers in Analytics weekly rankings
- [x] In `static/analytics.js` → `fetchWeeklyRankings()`, display rank change with explicit sign:
  - Rank improved → `+N` (green, up arrow)
  - Rank dropped → `-N` (red, down arrow, using signed value, not abs)
  - No change → `-`

## In Progress: Dashboard Personal Details cleanup + Match Breakdown rework
- [x] Remove "First Name", "Last Name", and "Rating" rows from the Personal Details grid in `templates/dashboard.html`
- [x] Remove "US Squash Rating:" prefix from member-status text (keep it as "Member, US Squash")
- [x] Remove `setText('player-first-name'|'player-last-name'|'player-rating')` calls in `static/script.js`
  - `setDefaults()` (removed the three)
  - legacy fallback block (removed the three)
  - `renderUserDetails()` (removed the three, member-status now always "Member, US Squash")
- [x] Rework `fetchAndRenderMatchRecord()` in `static/script.js` to compute the Match Breakdown from all
  matches (iterating `/matches/page/N` pages) instead of the `/record` API — mirrors the analytics page.
  - Tally wins/losses by game count (3/4/5) from `match.Score`
  - Update overall wins/losses, matches-played, and win rate
- [x] Update the call site in `loadPlayerProfile()` to pass `userName` to `fetchAndRenderMatchRecord(userId, userName)`
- [x] Verified no dangling references to removed element IDs remain
- [x] Verified call site passes `userName` and no `/record` API usage remains for dashboard Match Breakdown
- [x] Syntax/balance validated (script.js balanced; analytics.js confirmed clean)
