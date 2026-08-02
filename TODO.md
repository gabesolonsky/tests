# Task: Add Logov3 logo everywhere + margin fix

- [x] 0. Analyze task and explore repo
- [x] 1. Read all relevant templates, JS, and CSS
- [x] 2. Create & approve plan
- [x] 3. dashboard.html: add `margin-left: 6px` to "Squash Stats" span, add favicon
- [x] 4. analytics.html: swap Logo 1.png → Logov3.png, add `margin-left: 6px`, add favicon
- [x] 5. playertracker.html: swap Logo 1.png → Logov3.png, add `margin-left: 6px`, add favicon
- [x] 6. collegeteams.html: swap Logo 1.png → Logov3.png, add `margin-left: 6px`, add favicon
- [x] 7. style.css: add `margin-left: 0 !important` for collapsed sidebar span (center logo when nav closed)
- [x] 8. Verify all changes with grep
- [x] 9. Fix favicon rendering (was off-center/high/dark): generate clean centered `Logov3-favicon.png` from Logov3.png (cropped to content, shadow removed, centered with padding), update all 4 templates to use it
- [x] 10. Remove background from Logo 2 and create enhanced new file: `static/Logo 2 clean.png` (1024x1024, transparent bg, feathered edges, centered, Lanczos-enhanced)
- [x] 11. Enhance user-created `static/Logo No Background.png`: created `static/Logo No Background HD.png` (1024x1024, alpha edge smoothing, centered, Lanczos upscale + unsharp mask)

# Task: Make Comeback Tracker accurate (analytics page)

- [x] 0. Analyze task and read script.js + analytics.js
- [x] 1. Identify root cause: `computeComebackStats` counts forfeits/defaults and any "ever behind" win
- [x] 2. Create & approve plan
- [x] 3. Add `isComebackWin` helper (completed matches only, uses didUserWinMatch, exact 4 patterns LWWW/LLWWW/WLLWW/LWLWW)
- [x] 4. Rewrite `computeComebackStats` to use it, correctly tally down1/down2 opportunities + wins
- [x] 5. Update `isComeback` to delegate to `isComebackWin`
- [x] 6. Verify: JXA test harness (10/10 pass) + grep
- [x] 7. Add enhanced stats: Comeback Win %, Reverse Sweeps, Reverse Sweep %, Trailing Matches (per user feedback)
- [x] 8. Verify: JXA test harness (13/13 pass) + cleanup
- [x] 9. Top Wins/Losses by Opponent Rating: use embedded w1Rating/o1Rating (no extra API calls), split into separate widgets
- [x] 10. Verify: JXA test harness for top ratings (9/9 pass) + cleanup
- [x] 11. Add reverse sweep console logging (TEMP) for comeback tracker testing

# Task: Analytics page refinements (feedback round 2)

- [x] 0. Analyze feedback: remove Top Wins widget, remove ratings-top API call, monthly rating 6-month toggle, clickable match stats
- [x] 1. Remove "Top Wins by Opponent Rating" widget (keep only Top Losses); rename function to fetchAndDisplayTopLosses; update HTML/JS callers
- [x] 2. Remove /ratings-top API call from calculateAverageOpponentRating (use embedded w1Rating/o1Rating only); keep script.js untouched (dashboard)
- [x] 3. Monthly Rating Change: default to last 6 months with a "Next 6 Months" toggle button (and "Back to Last 6 Months" reset) — mirrors dashboard Reset Zoom pattern
- [x] 4. Make Match Statistics numbers clickable (wins/losses, 3/4/5-game wins/losses) via stat-clickable badges + data-stat-type
- [x] 5. Make Streaks highest win/loss numbers clickable
- [x] 6. Add setupMatchStatClickListeners delegation + wire into initializePage
- [x] 7. Verify: JXA syntax check + search for stale refs + cleanup test files

# Task: Analytics reversions (feedback round 3)

- [x] 0. Analyze feedback: revert monthly rating to default 12 months; restore Advanced Match Insights section
- [x] 1. Revert Monthly Rating Change: show last 12 months by default (removed 6-month offset logic, toggle button "Next 6 Months"/"Back to Last 6 Months", and toggle wiring)
- [x] 2. Remove now-unused `monthlyRatingWindowOffset` global
- [x] 3. Restore Advanced Match Insights: removed "Feature currently down — fix in progress" banner and the `opacity-30 pointer-events-none select-none` greyed-out wrapper
- [x] 4. Restore full `fetchAdvancedMatchInsights` implementation (fetches liveScoreDetails per match, computes avg/longest/shortest match + point durations, clickable longest/shortest match containers)
- [x] 5. Verify: grep (no toggle/notice refs; 6 insight IDs in HTML; function restored) + JXA check passed

# Task: Make analytics.js game tabs match script.js (Match Insights modal)

- [x] 0. Analyze task & read analytics.js + script.js
- [x] 1. Identify gap: analytics.js game tab had bare chart only; script.js had score card + stat chips + enriched chart
- [x] 2. Create & approve plan (port script.js game-tab rendering into analytics.js renderMatchInsights)
- [x] 3. Replace game-tab block in analytics.js: add per-game stats (finalLeft/finalRight/gameLengthSec/avgPointSecGame/longestPointSecGame with MAX_POINT_DURATION_SEC=120 filter), render "Final Score · Game X" score card + 3 stat chips + chart
- [x] 4. Verify: grep for new identifiers + read-back of updated renderMatchInsights

# Task: Center Match Insights tab nav (feedback round 4)

- [x] 0. Analyze feedback: Overview / Game 1 / Game 2 tabs left-aligned when match has 3-4 games (looks good at 5)
- [x] 1. Root cause: `.mi-tab-nav` flex container had no `justify-content`, and `.mi-tab-btn` had `flex-shrink: 0`, so tabs packed left when not filling width
- [x] 2. Fix in shared style.css (covers both script.js dashboard + analytics.js): add `justify-content: center`, make `.mi-tab-btn` `flex: 1 1 auto` + `justify-content: center` for an even segmented-control look
- [x] 3. Replace `overflow-x: auto` with `flex-wrap: wrap` so 5-game matches on narrow screens wrap centered instead of clipping the first tab
- [x] 4. Verify: read-back of updated .mi-tab-nav/.mi-tab-btn rules

# Task: Make Match Insights modal stack above other popups (feedback round 5)

- [x] 0. Analyze feedback: Match Insights opens behind the match-list modal when opened from it
- [x] 1. Root cause: `#graph-modal` and `#match-list-modal` both used `z-50`; match-list modal appears later in DOM so it painted on top
- [x] 2. Fix: raise `#graph-modal` to `z-[80]` in both templates/analytics.html and templates/dashboard.html (above loading overlay z-50, mobile nav z-60, and match-list z-50)
- [x] 3. Verify: grep for `id="graph-modal"` in templates

