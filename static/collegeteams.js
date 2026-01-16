// College Teams front-end JS (uses proxy endpoints)

const DIVISION_IDS = {
  mensVarsity: 5733,
  womensVarsity: 5736,
  mixedClub: 5734,
  womensClub: 5735
};

// Friendly section titles for badges and navigation
const SECTION_TITLES = {
  'mens-varsity-content': "Men's Varsity",
  'womens-varsity-content': "Women's Varsity",
  'womens-club-content': "Women's Club",
  'mixed-club-content': 'Mixed Club'
};

function toggleSidebar() {
  document.getElementById("app").classList.toggle("sidebar-collapsed");
}

function showCollegeTab(tabId) {
  document.querySelectorAll(".college-tab-content").forEach((tab) => tab.classList.add("hidden"));
  const el = document.getElementById(tabId);
  if (el) el.classList.remove("hidden");
}

async function fetchLeagueInfo() {
  const proxyUrl = "/proxy/leagues/info/2200";
  try {
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`League API HTTP ${res.status}`);
    const data = await res.json();

    // Data might be an object or array; guard for both shapes
    const entries = Array.isArray(data) ? data : (data.leagues || []);

    // If no array-like content, attempt to use data as an array
    const teamsArray = entries.length ? entries : (Array.isArray(data) ? data : []);

    // Simple categorization by LeagueDescr where available
    // Use word boundaries so 'women' doesn't match 'men' accidentally ("women" contains "men")
    const mens = teamsArray.filter(t => (/\bmen\b/i.test(t.LeagueDescr || '') || t.DivisionId === DIVISION_IDS.mensVarsity));
    const womens = teamsArray.filter(t => ((/\bwomen\b/i.test(t.LeagueDescr || '') && /varsity/i.test(t.LeagueDescr || '')) || t.DivisionId === DIVISION_IDS.womensVarsity));
    const womensClub = teamsArray.filter(t => ((/\bwomen\b/i.test(t.LeagueDescr || '') && /club/i.test(t.LeagueDescr || '')) || t.DivisionId === DIVISION_IDS.womensClub));
    const mixed = teamsArray.filter(t => (/\bmixed\b/i.test(t.LeagueDescr || '') || t.DivisionId === DIVISION_IDS.mixedClub));

    renderTeams('mens-varsity-content', mens, DIVISION_IDS.mensVarsity);
    renderTeams('womens-varsity-content', womens, DIVISION_IDS.womensVarsity);
    renderTeams('womens-club-content', womensClub, DIVISION_IDS.womensClub);
    renderTeams('mixed-club-content', mixed, DIVISION_IDS.mixedClub);

    // Also fetch and show scrollable standings previews for each main section
    fetchAndRenderSectionStandings('mens-varsity-content', DIVISION_IDS.mensVarsity);
    fetchAndRenderSectionStandings('womens-varsity-content', DIVISION_IDS.womensVarsity);
    fetchAndRenderSectionStandings('womens-club-content', DIVISION_IDS.womensClub);
    fetchAndRenderSectionStandings('mixed-club-content', DIVISION_IDS.mixedClub);

      // (floating quick-nav removed per UX request)

  } catch (e) {
    console.error('Error fetching league info via proxy', e);
    document.getElementById('mens-varsity-content').innerHTML = '<p class="text-red-500">Failed to load.</p>';
  }
}

async function fetchAndRenderSectionStandings(containerId, divisionId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // create or reuse a stacked standings block appended under this section
  let stack = container.querySelector('.standings-stack');
  if (!stack) {
    stack = document.createElement('div');
    // nice card with a header and a scrollable list (slightly larger padding)
    stack.className = 'standings-stack mt-4 bg-white p-4 rounded shadow-sm';
      const sectionName = SECTION_TITLES[containerId] || '';
      stack.innerHTML = `
        <div class="standings-stack-header bg-white py-2 -mx-3 px-3">
          <div class="flex items-center gap-3">
            ${sectionName ? `<span class="section-badge inline-block text-xs font-medium text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">${sectionName}</span>` : ''}
            <!-- Standings label intentionally removed for a cleaner layout -->
          </div>
        </div>
      <div class="standings-list max-h-[66vh] md:max-h-[80vh] overflow-y-auto -mx-3 px-3 relative">
        <!-- column header (sticky inside the scrollable list) -->
        <div class="standings-columns sticky top-0 bg-white z-10"></div>
        <div class="standings-rows"></div>
      </div>
    `;
    container.appendChild(stack);
  }

  const listEl = stack.querySelector('.standings-list');
    const columnsHolder = listEl.querySelector('.standings-columns');
    const rowsHolder = listEl.querySelector('.standings-rows');
    rowsHolder.innerHTML = '<div class="text-sm text-gray-500 py-2 text-center">Loading standings...</div>';

  try {
    const res = await fetch(`/proxy/divisions/standings/${divisionId}`);
    if (!res.ok) throw new Error(`Standings HTTP ${res.status}`);
    const data = await res.json();

    // Data might be array of teams as provided in example
    const items = Array.isArray(data) ? data : (data.standings || data.Standings || data.playerStandings || []);
    if (!Array.isArray(items) || items.length === 0) {
      listEl.innerHTML = '<div class="text-sm text-gray-500 py-2">No standings available.</div>';
      return;
    }
    columnsHolder.innerHTML = '';

    // Check if mobile
    const isMobile = window.innerWidth <= 767;

    // Header row for columns: Rank | Team | (Wins-Losses | Individual Matches | Win % on desktop only)
    const header = document.createElement('div');
    header.className = 'grid standings-grid gap-3 items-center py-2 border-b bg-gray-50 text-xs text-gray-500 font-medium';
    if (isMobile) {
      header.innerHTML = `
        <div class="text-center">Rank</div>
        <div class="pl-2">Team</div>
      `;
    } else {
      header.innerHTML = `
        <div class="text-center">Rank</div>
        <div class="pl-2 text-center">Team</div>
        <div class="text-center">Wins - Losses</div>
        <div class="text-center">Individual Matches</div>
        <div class="text-center">Win %</div>
      `;
    }
    columnsHolder.appendChild(header);

    rowsHolder.innerHTML = '';
    items.forEach((row, idx) => {
      const name = row.Teamname || row.TeamDescr || row.PlayerDescr || row.TeamName || row.Name || '';
      const logo = row.LogoImageUrl || row.logo || '';
      const rank = row.hGroup || row.Rank || row.rank || row.Position || (idx + 1);

      // Team wins/losses from standings API (detect presence vs. missing)
      const teamWinsRaw = row.TotalTeamwins ?? row.TotalTeamWins ?? row.TeamWins ?? row.Wins ?? row.W ?? null;
      const teamLossesRaw = row.TotalTeamloses ?? row.TotalTeamLoses ?? row.TotalTeamLosses ?? row.TeamLosses ?? row.Losses ?? row.L ?? null;
      const teamWins = (teamWinsRaw !== null && teamWinsRaw !== undefined && String(teamWinsRaw).trim() !== '') ? Number(teamWinsRaw) : null;
      const teamLosses = (teamLossesRaw !== null && teamLossesRaw !== undefined && String(teamLossesRaw).trim() !== '') ? Number(teamLossesRaw) : null;

      // Individual matches from standings API
      const indWRaw = row.TotalMatchesWon ?? row.TotalMatchesWonValue ?? row.TotalMatchesWonCount ?? row.IndividualsWon ?? row.IndividualMatchesWon ?? null;
      const indLRaw = row.TotalMatchesLost ?? row.TotalMatchesLostValue ?? row.TotalMatchesLostCount ?? row.IndividualsLost ?? row.IndividualMatchesLost ?? null;
      const indW = (indWRaw !== null && indWRaw !== undefined && String(indWRaw).trim() !== '') ? Number(indWRaw) : null;
      const indL = (indLRaw !== null && indLRaw !== undefined && String(indLRaw).trim() !== '') ? Number(indLRaw) : null;

      // Matches (total team matches) if provided
      const matches = row.TotalMatches ?? row.Matches ?? '';

      // Determine display values (use 'N/A' when data missing)
      const winsLossesDisplay = (teamWins !== null || teamLosses !== null)
        ? `${teamWins !== null ? teamWins : 0} - ${teamLosses !== null ? teamLosses : 0}`
        : 'N/A';
      const indDisplay = (indW !== null || indL !== null) ? `${indW !== null ? indW : 0} - ${indL !== null ? indL : 0}` : 'N/A';

      // Calculate win percentage from team wins/losses if possible
      let pctDisplay = '';
      if (teamWins !== null && teamLosses !== null && (teamWins + teamLosses) > 0) {
        pctDisplay = ((teamWins / (teamWins + teamLosses)) * 100).toFixed(1) + '%';
      } else {
        const pctRaw = row.WinPct ?? row.WinPercentage ?? row.WinningPct ?? row.WinPercent ?? row.Pct ?? '';
        if (pctRaw !== '' && pctRaw !== null && pctRaw !== undefined) {
          if (typeof pctRaw === 'number') pctDisplay = pctRaw <= 1 ? (pctRaw * 100).toFixed(1) + '%' : pctRaw + (String(pctRaw).includes('%') ? '' : '%');
          else {
            const parsed = parseFloat(String(pctRaw).replace('%', '').trim());
            if (!isNaN(parsed)) pctDisplay = (parsed <= 1 ? (parsed * 100).toFixed(1) : parsed) + '%';
          }
        } else {
          pctDisplay = 'N/A';
        }
      }

      const rowEl = document.createElement('div');
      rowEl.className = 'grid standings-grid gap-4 items-center py-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors cursor-pointer';
      if (isMobile) {
        rowEl.innerHTML = `
          <div class="w-12 text-sm text-gray-700 text-center">${rank}</div>
          <div class="flex items-center gap-4 min-w-0">
            <div class="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
              ${logo ? `<img src="${logo}" alt="${name}" class="w-full h-full object-cover">` : `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5z"/></svg>`}
            </div>
            <div class="min-w-0">
              <div class="text-base font-medium text-gray-800">${name}</div>
            </div>
          </div>
        `;
      } else {
        rowEl.innerHTML = `
          <div class="w-12 text-sm text-gray-700 text-center">${rank}</div>
          <div class="flex items-center gap-4 min-w-0 justify-center md:justify-start">
            <div class="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
              ${logo ? `<img src="${logo}" alt="${name}" class="w-full h-full object-cover">` : `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5z"/></svg>`}
            </div>
            <div class="min-w-0">
              <div class="text-base font-medium text-gray-800 text-center md:text-left">${name}</div>
            </div>
          </div>
          <div class="text-center text-sm text-gray-700">${winsLossesDisplay}</div>
          <div class="text-center text-sm text-gray-700">${indDisplay}</div>
          <div class="text-center text-sm text-gray-700">${pctDisplay}</div>
        `;
      }

      // clicking a row shows the team roster (falls back to division view if no team id)
      rowEl.onclick = () => {
        const tid = getTeamIdFromRow(row);
        if (tid) showTeamPreview(tid, name, logo, winsLossesDisplay, indDisplay, pctDisplay);
        else loadDivision(divisionId);
      };

      rowsHolder.appendChild(rowEl);
    });
    // (removed duplicate header + rendering block) — rows are rendered into columnsHolder/rowsHolder above
    // previously had a view-division button here; removed per UX request
  } catch (e) {
    listEl.innerHTML = '<div class="text-sm text-red-500 py-2">Failed to load standings.</div>';
  }
}

// Create and show a modal preview for a division (top teams + quick actions)
function createDivisionPreviewModal() {
  if (document.getElementById('division-preview-modal')) return;
  const wrap = document.createElement('div');
  wrap.id = 'division-preview-modal';
  wrap.className = 'fixed inset-0 z-50 hidden items-center justify-center';
  wrap.innerHTML = `
    <div class="fixed inset-0 bg-black/40" data-close="true"></div>
    <div class="relative w-full max-w-2xl mx-4">
      <div class="bg-white rounded-xl shadow-xl overflow-hidden border-t-2 border-purple-600">
        <div class="p-5">
          <div id="division-preview-title" class="flex items-start justify-between gap-4">
            <div>
              <h3 id="division-preview-name" class="text-lg font-semibold text-gray-800">Division</h3>
              <p id="division-preview-season" class="text-xs text-gray-500 mt-1">Season</p>
            </div>
            <div class="flex-shrink-0">
              <button id="division-preview-close" class="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm">Close</button>
            </div>
          </div>
          <div id="division-preview-body" class="mt-4 grid gap-3">
            <p class="text-sm text-gray-500">Loading preview…</p>
          </div>
          <div class="mt-4 flex gap-2 justify-end">
            <button id="division-preview-open" class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md">Open Division</button>
            <button id="division-preview-schedule" class="inline-flex items-center gap-2 px-4 py-2 bg-white border rounded-md">View Schedule</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  // close handlers
  wrap.addEventListener('click', (ev) => {
    if (ev.target && ev.target.getAttribute && ev.target.getAttribute('data-close') === 'true') hideDivisionPreview();
  });
  document.getElementById('division-preview-close').onclick = hideDivisionPreview;
  document.getElementById('division-preview-open').onclick = () => {
    const id = wrap.getAttribute('data-division');
    if (id) {
      hideDivisionPreview();
      loadDivision(id);
    }
  };
  document.getElementById('division-preview-schedule').onclick = () => {
    const id = wrap.getAttribute('data-division');
    if (id) {
      hideDivisionPreview();
      fetchDivisionSchedule(id);
      // open division details panel
      loadDivision(id);
    }
  };
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') hideDivisionPreview(); });
}

// Team preview modal (appears above everything)
function createTeamPreviewModal() {
  if (document.getElementById('team-preview-modal')) return;
  const wrap = document.createElement('div');
  wrap.id = 'team-preview-modal';
  wrap.className = 'fixed inset-0 z-50 hidden items-center justify-center';
  wrap.innerHTML = `
    <div class="fixed inset-0 bg-black/40" data-close="true"></div>
    <div class="relative w-full max-w-4xl mx-auto">
      <div class="bg-white rounded-xl shadow-xl overflow-hidden border-t-2 border-purple-600">
        <div class="p-6">
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-center gap-3">
              <img id="team-preview-logo" src="" alt="" class="w-12 h-12 rounded-full object-cover hidden" />
              <div>
                <h3 id="team-preview-name" class="text-lg font-semibold text-gray-800">Team</h3>
                <p id="team-preview-sub" class="text-xs text-gray-500 mt-1">Roster</p>
              </div>
            </div>
            <div class="flex-shrink-0">
              <button id="team-preview-close" class="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm">Close</button>
            </div>
          </div>
          <div id="team-preview-body" class="mt-4 grid gap-3">
            <!-- two column layout: roster (left) and schedule (right) -->
            <div id="team-preview-grid" class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div id="team-preview-roster" class="overflow-y-auto pr-3">
                <div class="flex items-center gap-3"><div class="spinner" aria-hidden="true"></div><div class="text-sm text-gray-500">Loading roster…</div></div>
              </div>
              <div id="team-preview-schedule" class="overflow-y-auto pl-3 border-l md:border-l md:pl-6">
                <div class="flex items-center gap-3"><div class="spinner" aria-hidden="true"></div><div class="text-sm text-gray-500">Loading schedule…</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  // close handlers
  wrap.addEventListener('click', (ev) => {
    if (ev.target && ev.target.getAttribute && ev.target.getAttribute('data-close') === 'true') hideTeamPreview();
  });
  document.getElementById('team-preview-close').onclick = hideTeamPreview;
  // Close handler already wired above. (Open/Open in new tab CTAs removed)
  // Clicking the logo opens inline details (if present)
  const logoEl = document.getElementById('team-preview-logo');
  if (logoEl) {
    logoEl.style.cursor = 'pointer';
    logoEl.onclick = () => {
      const id = wrap.getAttribute('data-team');
      const name = document.getElementById('team-preview-name').textContent;
      if (id) { hideTeamPreview(); showTeam(id, name); }
    };
  }
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') hideTeamPreview(); });
}

function showTeamPreview(teamId, teamName, teamLogo, winsLossesDisplay = '', indDisplay = '', pctDisplay = '') {
  createTeamPreviewModal();
  const wrap = document.getElementById('team-preview-modal');
  wrap.setAttribute('data-team', teamId);
  // store provided logo so modal can show it
  wrap.setAttribute('data-team-logo', teamLogo || '');
  wrap.classList.remove('hidden');
  const titleEl = document.getElementById('team-preview-name');
  const subEl = document.getElementById('team-preview-sub');
  const body = document.getElementById('team-preview-body');
  titleEl.textContent = teamName || `Team ${teamId}`;
  const isMobile = window.innerWidth <= 767;
  subEl.innerHTML = `Team ID: ${teamId}${!isMobile && winsLossesDisplay ? ` • Wins-Losses: ${winsLossesDisplay}` : ''}${!isMobile && indDisplay ? ` • Individual Matches: ${indDisplay}` : ''}${!isMobile && pctDisplay ? ` • Win %: ${pctDisplay}` : ''}`;
  const logoEl = document.getElementById('team-preview-logo');
  if (logoEl) {
    const teamLogo = wrap.getAttribute('data-team-logo') || '';
    if (teamLogo) {
      logoEl.src = teamLogo;
      logoEl.classList.remove('hidden');
    } else {
      logoEl.src = '';
      logoEl.classList.add('hidden');
    }
  }
  // Ensure the left and right columns show loading states (do not overwrite body which contains the grid)
  const rosterEl = document.getElementById('team-preview-roster');
  const schedEl = document.getElementById('team-preview-schedule');
  if (rosterEl) rosterEl.innerHTML = `<div class="flex items-center gap-3"><div class="spinner" aria-hidden="true"></div><div class="text-sm text-gray-500">Loading roster…</div></div>`;
  if (schedEl) schedEl.innerHTML = `<div class="flex items-center gap-3"><div class="spinner" aria-hidden="true"></div><div class="text-sm text-gray-500">Loading schedule…</div></div>`;

  // fetch roster and render inside the left column
  fetch(`/proxy/teams/${teamId}/players`).then(r => r.ok ? r.json() : null).then(data => {
    const players = Array.isArray(data) ? data : (data.players || data.PlayerList || data.teamPlayers || []);
    if (!Array.isArray(players) || players.length === 0) {
      if (rosterEl) rosterEl.innerHTML = '<p class="text-sm text-gray-500">No roster available.</p>';
      return;
    }

    if (rosterEl) rosterEl.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'grid gap-2';
    players.forEach(p => {
      const pid = p.playerid || p.PlayerId || p.PlayerID || p.id || null;
      const rating = p.CurrentRating ?? p.Rating ?? p.RatingValue ?? p.RatingOther ?? '';
      const wins = (p.wins !== undefined && p.wins !== null) ? p.wins : (p.Wins ?? '');
      const losses = (p.losses !== undefined && p.losses !== null) ? p.losses : (p.Losses ?? '');
      const pos = p.TeamPosition || p.TeamPos || p.Position || p.TeamPositionName || '';
      const pic = p.profilePictureUrl || p.profilePicture || '';

      const li = document.createElement('div');
      li.className = 'p-3 border rounded-lg flex items-center gap-4 hover:bg-gray-50 cursor-pointer';
      li.innerHTML = `
        <div class="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
          ${pic ? `<img src="${pic}" alt="${p.player || p.PlayerName || ''}" class="w-full h-full object-cover">` : `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5z"/></svg>`}
        </div>
        <div class="min-w-0">
          <div class="text-sm font-medium text-gray-800">${p.player || p.PlayerName || p.Name || ''}</div>
          <div class="text-xs text-gray-500">Rating: ${rating !== '' && rating !== null && rating !== undefined ? (typeof rating === 'number' ? rating.toFixed(2) : rating) : 'N/A'} • Pos: ${pos || 'N/A'}</div>
        </div>
        <div class="ml-auto text-sm text-gray-700 text-right">
          <div class="font-medium">${(wins !== '' && wins !== null && wins !== undefined) || (losses !== '' && losses !== null && losses !== undefined) ? `${wins || 0} - ${losses || 0}` : 'N/A'}</div>
          <div class="text-xs text-gray-500">W-L</div>
        </div>
      `;

      // hovering shows quick rating chart preview (only on hover-capable devices)
      if (window.matchMedia && window.matchMedia('(hover: hover)').matches) {
        li.onmouseenter = () => { if (pid) showPlayerHoverChart(pid, li); };
        li.onmouseleave = () => { hidePlayerHoverChart(); };
      } else {
        // ensure no hover handlers on touch devices
        li.onmouseenter = null;
        li.onmouseleave = null;
      }
      li.onclick = () => { if (pid) window.location.href = `/dashboard?userId=${pid}`; };
      grid.appendChild(li);
    });
    if (rosterEl) rosterEl.appendChild(grid);
  }).catch((e) => { console.error('Error loading roster (modal)', teamId, e); if (rosterEl) rosterEl.innerHTML = '<p class="text-sm text-red-500">Failed to load roster.</p>'; });

  // fetch schedule and render into right column
  fetch(`/proxy/teams/${teamId}/schedule`).then(r => r.ok ? r.json() : null).then(data => {
    const items = Array.isArray(data) ? data : (data.matches || data.Schedule || data.schedule || []);
    if (!Array.isArray(items) || items.length === 0) {
      if (schedEl) schedEl.innerHTML = '<p class="text-sm text-gray-500">No schedule available.</p>';
      return;
    }

    if (schedEl) schedEl.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'grid gap-2';
    items.slice(0, 50).forEach(m => {
      // normalize date and opponent fields
      const d = m.MatchDate || m.matchDate || m.Date || m.date || '';
      const home = m.HomeTeam || m.Home || m.HomeDescr || m.HomeName || '';
      const away = m.VisitingTeam || m.AwayTeam || m.VisitingDescr || m.AwayName || m.Visiting || '';
      const isHome = String(m.HomeTeam || m.Home || '').trim() !== '' && String(m.VisitingTeam || m.AwayTeam || '').trim() !== '' && (home && away && (String(home).includes(document.getElementById('team-preview-name').textContent) || String(away).includes(document.getElementById('team-preview-name').textContent))) ? (String(home).includes(document.getElementById('team-preview-name').textContent)) : null;
      const opponent = isHome === null ? (home || away) : (isHome ? away : home);
      const el = document.createElement('div');
      el.className = 'p-2 border rounded-md';
      el.innerHTML = `<div class="text-sm font-medium text-gray-800">${d || 'Date TBD'}</div><div class="text-xs text-gray-600">${(home ? `<strong>${home}</strong> vs ` : '')}${away || ''}${opponent ? ` • Opponent: ${opponent}` : ''}</div>`;
      list.appendChild(el);
    });
    if (schedEl) schedEl.appendChild(list);
  }).catch((e) => { console.error('Error loading team schedule', teamId, e); if (schedEl) schedEl.innerHTML = '<p class="text-sm text-red-500">Failed to load schedule.</p>'; });
}

function hideTeamPreview() {
  const wrap = document.getElementById('team-preview-modal');
  if (wrap) wrap.classList.add('hidden');
}

function showDivisionPreview(divisionId) {
  createDivisionPreviewModal();
  const wrap = document.getElementById('division-preview-modal');
  wrap.setAttribute('data-division', divisionId);
  wrap.classList.remove('hidden');
  const titleEl = document.getElementById('division-preview-name');
  const seasonEl = document.getElementById('division-preview-season');
  const body = document.getElementById('division-preview-body');
  titleEl.textContent = 'Loading...';
  seasonEl.textContent = '';
  body.innerHTML = '<p class="text-sm text-gray-500">Loading preview…</p>';

  // fetch division info and standings concurrently
  Promise.all([
    fetch(`/proxy/divisions/${divisionId}`).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`/proxy/divisions/standings/${divisionId}`).then(r => r.ok ? r.json() : null).catch(() => null)
  ]).then(([divInfo, standData]) => {
    if (divInfo) {
      titleEl.textContent = divInfo.DivisionDescr || divInfo.divisionDescr || `Division ${divisionId}`;
      seasonEl.textContent = divInfo.SeasonDescr || divInfo.seasonDescr || '';
    } else {
      titleEl.textContent = `Division ${divisionId}`;
    }

    const items = Array.isArray(standData) ? standData : (standData && (standData.standings || standData.Standings || standData.playerStandings)) || [];
    if (!Array.isArray(items) || items.length === 0) return (body.innerHTML = '<p class="text-sm text-gray-500">No standings data available.</p>');

    const list = document.createElement('div');
    list.className = 'grid gap-2';
    items.slice(0, 8).forEach((row, i) => {
      const name = row.Teamname || row.TeamDescr || row.TeamName || row.Name || '';
      const teamWins = row.TotalTeamwins ?? row.TotalTeamWins ?? row.TeamWins ?? row.Wins ?? null;
      const teamLosses = row.TotalTeamloses ?? row.TotalTeamLoses ?? row.TotalTeamLosses ?? row.TeamLosses ?? row.Losses ?? null;
      const indW = row.TotalMatchesWon ?? row.IndividualsWon ?? null;
      const indL = row.TotalMatchesLost ?? row.IndividualsLost ?? null;
      const pct = row.WinPct ?? row.WinPercentage ?? row.WinningPct ?? row.WinPercent ?? '';
      const li = document.createElement('div');
      li.className = 'flex items-center justify-between gap-3 p-2 rounded-md hover:bg-gray-50';
      li.innerHTML = `<div class="text-sm font-medium text-gray-800">${i+1}. ${name}</div><div class="text-xs text-gray-600">${teamWins !== null && teamLosses !== null ? teamWins+' - '+teamLosses : 'N/A'} ${ (indW||indL) ? '• ' + (indW||0)+' - '+(indL||0) : '' } ${pct ? '• '+pct : ''}</div>`;
      list.appendChild(li);
    });
    body.innerHTML = '';
    body.appendChild(list);
  });
}

function hideDivisionPreview() {
  const wrap = document.getElementById('division-preview-modal');
  if (wrap) wrap.classList.add('hidden');
}

function renderTeams(containerId, teams, divisionId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  // Render a minimal section header and a small "View Division" button.
  // The full standings list is rendered below by fetchAndRenderSectionStandings.
  container.innerHTML = '';

  // nothing more per-team — keep the UI clean and let the standings card show the full list
}

async function loadDivision(divisionId) {
  const details = document.getElementById('division-details');
  const title = document.getElementById('division-title');
  const info = document.getElementById('division-info');
  const schedule = document.getElementById('division-schedule');
  const standings = document.getElementById('division-standings');
  if (!details || !title || !info) return;

  details.classList.remove('hidden');
  // Clear previous
  info.innerHTML = '<p class="text-gray-500">Loading division info...</p>';
  schedule.innerHTML = '';
  standings.innerHTML = '';

  try {
    const res = await fetch(`/proxy/divisions/${divisionId}`);
    if (!res.ok) throw new Error(`Division HTTP ${res.status}`);
    const data = await res.json();
    title.textContent = data.DivisionDescr || data.divisionDescr || `Division ${divisionId}`;
    info.innerHTML = `
      <p class="text-gray-700">Division ID: ${divisionId}</p>
      <p class="text-gray-700">Season: ${data.SeasonDescr || data.seasonDescr || 'N/A'}</p>
      <p class="text-gray-700">Teams: ${(data.TeamCount || data.NumTeams) || 'N/A'}</p>
    `;

    // wire schedule and standings buttons
    document.getElementById('load-schedule').onclick = () => fetchDivisionSchedule(divisionId);
    document.getElementById('load-standings').onclick = () => fetchDivisionStandings(divisionId);

  } catch (e) {
    console.error('Error loading division', divisionId, e);
    info.innerHTML = '<p class="text-red-500">Failed to load division information.</p>';
  }
}

  // Try to extract a team id from a standings row object
  function getTeamIdFromRow(row) {
    return row.TeamId || row.TeamID || row.teamid || row.TeamIdRef || row.TeamIdentifier || row.Team || row.ClubId || null;
  }

  async function showTeam(teamId, teamName) {
    const details = document.getElementById('team-details');
    const title = document.getElementById('team-title');
    const sub = document.getElementById('team-sub');
    const roster = document.getElementById('team-roster');
    if (!details || !title || !roster) return;

    title.textContent = teamName || `Team ${teamId}`;
    sub.textContent = `Team ID: ${teamId}`;
    roster.innerHTML = '<p class="text-sm text-gray-500">Loading roster…</p>';
    details.classList.remove('hidden');

    try {
      const res = await fetch(`/proxy/teams/${teamId}/players`);
      if (!res.ok) throw new Error(`Team players HTTP ${res.status}`);
      const data = await res.json();
      const players = Array.isArray(data) ? data : (data.players || data.PlayerList || data.teamPlayers || []);
      if (!Array.isArray(players) || players.length === 0) {
        roster.innerHTML = '<p class="text-sm text-gray-500">No roster available.</p>';
        return;
      }

      roster.innerHTML = '';
      players.forEach(p => {
        const pid = p.playerid || p.PlayerId || p.PlayerID || p.id || null;
        const rating = p.CurrentRating ?? p.Rating ?? p.RatingValue ?? p.RatingOther ?? '';
        const wins = (p.wins !== undefined && p.wins !== null) ? p.wins : (p.Wins ?? '');
        const losses = (p.losses !== undefined && p.losses !== null) ? p.losses : (p.Losses ?? '');
        const pos = p.TeamPosition || p.TeamPos || p.Position || p.TeamPositionName || '';
        const pic = p.profilePictureUrl || p.profilePicture || '';

        const item = document.createElement('div');
        item.className = 'p-3 border rounded-lg flex items-center gap-4 hover:bg-gray-50 cursor-pointer';
        item.innerHTML = `
          <div class="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
            ${pic ? `<img src="${pic}" alt="${p.player || p.PlayerName || ''}" class="w-full h-full object-cover">` : `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5z"/></svg>`}
          </div>
          <div class="min-w-0">
            <div class="text-sm font-medium text-gray-800">${p.player || p.PlayerName || p.Name || ''}</div>
            <div class="text-xs text-gray-500">Rating: ${rating !== '' && rating !== null && rating !== undefined ? (typeof rating === 'number' ? rating.toFixed(2) : rating) : 'N/A'} • Pos: ${pos || 'N/A'}</div>
          </div>
          <div class="ml-auto text-sm text-gray-700 text-right">
            <div class="font-medium">${(wins !== '' && wins !== null && wins !== undefined) || (losses !== '' && losses !== null && losses !== undefined) ? `${wins || 0} - ${losses || 0}` : 'N/A'}</div>
            <div class="text-xs text-gray-500">W-L</div>
          </div>
        `;

        item.onclick = () => {
          if (pid) {
            // Navigate to dashboard for player (dashboard expects userId query param)
            window.location.href = `/dashboard?userId=${pid}`;
          }
        };

        roster.appendChild(item);
      });

    } catch (e) {
      console.error('Error loading team roster', teamId, e);
      roster.innerHTML = '<p class="text-sm text-red-500">Failed to load roster.</p>';
    }
  }

  function setupTeamBackButton() {
    const back = document.getElementById('back-to-team-list');
    if (back) back.onclick = () => document.getElementById('team-details').classList.add('hidden');
  }

async function fetchAndRenderDivisionPreview(divisionId, previewEl) {
  if (!previewEl) return;
  try {
    const res = await fetch(`/proxy/divisions/${divisionId}`);
    if (!res.ok) throw new Error(`Preview HTTP ${res.status}`);
    const data = await res.json();

    // Try multiple possible fields for team lists
    let teams = data.Teams || data.TeamList || data.teams || data.Team || data.teamsList || data.TeamsList || [];
    if (!Array.isArray(teams)) {
      // Sometimes API returns an object with keys; try to extract arrays
      for (const k of Object.keys(data || {})) {
        if (Array.isArray(data[k]) && (k.toLowerCase().includes('team') || k.toLowerCase().includes('club'))) {
          teams = data[k];
          break;
        }
      }
    }

    if (!teams || teams.length === 0) {
      // Try players/entries that may include team descriptors
      const fallback = [];
      if (data.DivisionTeams && Array.isArray(data.DivisionTeams)) fallback.push(...data.DivisionTeams);
      teams = fallback;
    }

    if (!teams || teams.length === 0) {
      previewEl.textContent = '';
      return;
    }

    // Map to friendly names
    const names = teams.map(t => (t.TeamDescr || t.TeamName || t.ClubDescr || t.Name || t.PlayerDescr || t.ClubName || t.Description)).filter(Boolean);
    const top = names.slice(0, 3);
    previewEl.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'flex items-center gap-2 flex-wrap mt-1 justify-center';
    top.forEach(n => {
      const chip = document.createElement('span');
      chip.className = 'px-2 py-1 bg-gray-100 rounded-full text-xs text-gray-700 border';
      chip.textContent = n;
      container.appendChild(chip);
    });
    if (names.length > 3) {
      const more = document.createElement('span');
      more.className = 'text-xs text-gray-500';
      more.textContent = `+${names.length - 3} more`;
      container.appendChild(more);
    }
    previewEl.appendChild(container);

    // Also fetch a quick standings preview (top 3) and append below the team chips
    try {
      const sres = await fetch(`/proxy/divisions/standings/${divisionId}`);
      if (sres.ok) {
        const sdata = await sres.json();
        let standings = sdata.standings || sdata.Standings || sdata.playerStandings || sdata || [];
        if (!Array.isArray(standings)) {
          // Try to find an array inside the response
          const arr = Object.values(sdata || {}).find(v => Array.isArray(v));
          standings = arr || [];
        }
        if (Array.isArray(standings) && standings.length > 0) {
          const topStandings = standings.slice(0, 3).map((row, idx) => {
            const name = row.TeamDescr || row.PlayerDescr || row.Name || row.TeamName || row.ClubDescr || '';
            const rank = row.Rank || row.rank || (row.Position || idx + 1);
            return { rank, name };
          });
          const standContainer = document.createElement('div');
          standContainer.className = 'mt-2 text-xs text-center text-gray-600';
          standContainer.innerHTML = `<strong class="text-gray-800 text-sm">Standings:</strong>`;
          const list = document.createElement('div');
          list.className = 'flex items-center gap-2 mt-1 flex-wrap justify-center';
          topStandings.forEach(s => {
            const chip = document.createElement('span');
            chip.className = 'px-2 py-1 bg-white border rounded-full text-xs text-gray-700';
            chip.textContent = `${s.rank}. ${s.name}`;
            list.appendChild(chip);
          });
          standContainer.appendChild(list);
          previewEl.appendChild(standContainer);
        }
      }
    } catch (e) {
      // ignore standings preview errors silently
    }
  } catch (e) {
    // fail silently, remove loading text
    previewEl.textContent = '';
  }
}

// Player ratings cache to avoid refetching
const playerRatingsCache = new Map();

function createPlayerHoverChartContainer() {
  if (document.getElementById('player-hover-chart')) return;
  const el = document.createElement('div');
  el.id = 'player-hover-chart';
  el.className = 'fixed z-50 hidden p-3 bg-white border rounded-lg shadow-lg';
  el.style.width = '320px';
  // Detect hover capability; on touch devices, avoid capturing pointer events
  const _supportsHover = () => (window.matchMedia && window.matchMedia('(hover: hover)').matches);
  el.style.pointerEvents = _supportsHover() ? 'auto' : 'none'; // allow interaction inside chart only on hover-capable devices
  el.innerHTML = `<div id="player-hover-body" class="min-h-[90px]"></div>`;
  document.body.appendChild(el);
}

function showPlayerHoverChart(playerId, anchorEl) {
  // Only show hover chart on devices that support hover (avoid mobile taps being intercepted)
  const _supportsHover = () => (window.matchMedia && window.matchMedia('(hover: hover)').matches);
  if (!_supportsHover()) return;
  createPlayerHoverChartContainer();
  const container = document.getElementById('player-hover-chart');
  const body = document.getElementById('player-hover-body');
  if (!container || !body) return;
  container.classList.remove('hidden');
  container.classList.add('show');
  body.innerHTML = `<div class="flex items-center gap-3"><div class="spinner"></div><div class="text-sm text-gray-500">Loading chart…</div></div>`;

  // position the chart near anchorEl (right side if space, else above)
  const rect = anchorEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const left = (rect.right + 12 + 320 < vw) ? (rect.right + 12) : Math.max(12, rect.left - 12 - 320);
  const top = Math.max(12, rect.top - 12);
  container.style.left = `${left}px`;
  container.style.top = `${top}px`;

  if (playerRatingsCache.has(playerId)) {
    renderPlayerChartFromData(playerRatingsCache.get(playerId), body, playerId);
    return;
  }

  fetch(`/proxy/user/${playerId}/rankings`).then(r => r.ok ? r.json() : null).then(data => {
    if (!data) return body.innerHTML = '<div class="text-sm text-gray-500">No data</div>';
    const allDivisionRatings = (Array.isArray(data) ? data : data || []).filter(e => e.DivisionName === 'All').map(e => ({ date: e.RankingPeriod, rating: e.Rating })).sort((a,b)=>new Date(a.date)-new Date(b.date));
    playerRatingsCache.set(playerId, allDivisionRatings);
    renderPlayerChartFromData(allDivisionRatings, body, playerId);
  }).catch(e => {
    console.error('Error fetching player rankings for hover', e);
    body.innerHTML = '<div class="text-sm text-red-500">Failed to load</div>';
  });

  // Keep hover visible while mouse is over container; hide when both anchor and container are left
  if (container._hideTimer) clearTimeout(container._hideTimer);
  container.onmouseenter = () => { if (container._hideTimer) { clearTimeout(container._hideTimer); container._hideTimer = null; } };
  container.onmouseleave = () => { if (container._hideTimer) clearTimeout(container._hideTimer); container._hideTimer = setTimeout(hidePlayerHoverChart, 300); };
}

function renderPlayerChartFromData(data, body) {
  body.innerHTML = '';
  if (!data || data.length === 0) return body.innerHTML = '<div class="text-sm text-gray-500">No ranking history</div>';
  const chartWrap = document.createElement('div');
  chartWrap.className = 'w-full';
  chartWrap.innerHTML = `<div id="player-hover-chart-canvas" style="height:90px"></div>`;
  body.appendChild(chartWrap);
  // create small area chart
  try {
    const chart = new ApexCharts(document.querySelector('#player-hover-chart-canvas'), {
      series: [{ name: 'Rating', data: data.map(d=>d.rating) }],
      chart: { height: 90, type: 'area', toolbar: { show: false } },
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth' },
      xaxis: { categories: data.map(d=>d.date), type: 'datetime', labels: { show: false } },
      tooltip: { x: { format: 'MMM dd, yyyy' } },
      colors: ['#7c3aed'],
      fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.6, opacityTo: 0.1 } }
    });
    chart.render();
  } catch (e) {
    console.error('Error rendering player hover chart', e);
  }
}

function hidePlayerHoverChart() {
  const container = document.getElementById('player-hover-chart');
  if (container) container.classList.add('hidden');
}

async function fetchDivisionSchedule(divisionId) {
  const container = document.getElementById('division-schedule');
  container.innerHTML = '<p class="text-gray-500">Loading schedule...</p>';
  try {
    const res = await fetch(`/proxy/divisions/schedule/${divisionId}`);
    if (!res.ok) throw new Error(`Schedule HTTP ${res.status}`);
    const data = await res.json();
    if (!data || (Array.isArray(data) && data.length === 0)) {
      container.innerHTML = '<p class="text-gray-500">No schedule data available.</p>';
      return;
    }
    // Attempt to render some fields
    const items = Array.isArray(data) ? data : (data.matches || data.Schedule || []);
    container.innerHTML = '';
    items.slice(0, 50).forEach(match => {
      const d = document.createElement('div');
      d.className = 'p-2 border-b border-gray-100';
      d.innerHTML = `<div class="text-sm">${match.MatchDate || match.matchDate || match.Date || ''} — <strong>${match.HomeTeam || match.Home || match.HomeDescr || ''}</strong> vs <strong>${match.VisitingTeam || match.AwayTeam || match.VisitingDescr || ''}</strong></div>`;
      container.appendChild(d);
    });
  } catch (e) {
    console.error('Error fetching standings for division', divisionId, e);
    container.innerHTML = '<p class="text-red-500">Failed to load standings.</p>';
  }
}

function setupBackButton() {
  const back = document.getElementById('back-to-list');
  if (back) back.onclick = () => document.getElementById('division-details').classList.add('hidden');
}

async function loadTeamPerformanceChart() {
  const chartContainer = document.getElementById('team-performance-chart');
  if (!chartContainer) return;

  try {
    // Fetch data from all divisions to aggregate team performance
    const divisions = [5733, 5736, 5734, 5735]; // mens-varsity, womens-varsity, womens-club, mixed-club
    const performanceData = [];

    for (const divisionId of divisions) {
      const res = await fetch(`/proxy/divisions/standings/${divisionId}`);
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data.standings || data.Standings || []);
        if (items.length > 0) {
          // Calculate average win percentage for this division
          const validItems = items.filter(item => {
            const wins = item.TotalTeamwins ?? item.TotalTeamWins ?? item.TeamWins ?? 0;
            const losses = item.TotalTeamloses ?? item.TotalTeamLoses ?? item.TeamLosses ?? 0;
            return wins + losses > 0;
          });

          if (validItems.length > 0) {
            const avgWinPct = validItems.reduce((sum, item) => {
              const wins = item.TotalTeamwins ?? item.TotalTeamWins ?? item.TeamWins ?? 0;
              const losses = item.TotalTeamloses ?? item.TotalTeamLoses ?? item.TeamLosses ?? 0;
              return sum + (wins / (wins + losses));
            }, 0) / validItems.length;

            performanceData.push({
              division: SECTION_TITLES[`${Object.keys(SECTION_TITLES).find(key => SECTION_TITLES[key] === SECTION_TITLES[Object.keys(SECTION_TITLES).find(k => k.includes(divisionId.toString().slice(-1)))])}`] || `Division ${divisionId}`,
              winPercentage: avgWinPct * 100,
              teamCount: validItems.length
            });
          }
        }
      }
    }

    if (performanceData.length > 0) {
      const options = {
        series: [{
          name: 'Average Win %',
          data: performanceData.map(d => d.winPercentage.toFixed(1))
        }],
        chart: {
          type: 'bar',
          height: 300,
          toolbar: { show: false }
        },
        plotOptions: {
          bar: {
            horizontal: true,
            dataLabels: { position: 'top' }
          }
        },
        dataLabels: {
          enabled: true,
          offsetX: -6,
          style: { fontSize: '12px', colors: ['#fff'] }
        },
        xaxis: {
          categories: performanceData.map(d => `${d.division} (${d.teamCount} teams)`),
          labels: { formatter: val => `${val}%` }
        },
        colors: ['#7c3aed'],
        tooltip: {
          y: { formatter: val => `${val}% average win rate` }
        }
      };

      const chart = new ApexCharts(chartContainer, options);
      chart.render();
    } else {
      chartContainer.innerHTML = '<p class="text-center text-gray-500">No performance data available.</p>';
    }
  } catch (error) {
    console.error('Error loading team performance chart:', error);
    chartContainer.innerHTML = '<p class="text-center text-red-500">Error loading chart.</p>';
  }
}



document.addEventListener('DOMContentLoaded', () => {
  showCollegeTab('college-dashboard');
  fetchLeagueInfo();
  setupBackButton();
  setupTeamBackButton();

  // Load analytics charts when analytics tab is shown
  const analyticsTab = document.querySelector('[onclick*="college-analytics"]');
  if (analyticsTab) {
    analyticsTab.addEventListener('click', () => {
      setTimeout(() => {
        loadTeamPerformanceChart();
        loadPlayerContributionChart();
      }, 100);
    });
  }

  // initialize lucide icons
  if (window.lucide) lucide.createIcons();
});

// Floating quick-nav for sections (uses SECTION_TITLES). Appears on md+ screens.
// Floating quick-nav removed: Navigation buttons were removed per user request to avoid the right-side list.
