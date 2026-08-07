# Task Log

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
