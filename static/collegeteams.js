// College Squash Teams UI
// Uses the existing Flask proxy endpoints already used by the original page.

const COLLEGE_DIVISIONS = [
  { id: 5733, key: "mensVarsity", name: "Men's Varsity" },
  { id: 5736, key: "womensVarsity", name: "Women's Varsity" },
  { id: 5735, key: "womensClub", name: "Women's Club" },
  { id: 5734, key: "mixedClub", name: "Mixed Club" }
];

const DEFAULT_TEAM_ICON = `
  <i data-lucide="shield" class="w-5 h-5 text-gray-400"></i>
`;

const DEFAULT_PROFILE_PICTURE =
  "https://ussq-img-live.s3.us-east-1.amazonaws.com/uploads%2Fussq-profile-icon-default.png";

const MATCH_INSIGHTS_ACCESS_CODE = "0";
const SESSION_STORAGE_KEY_MATCH_INSIGHTS = "matchInsightsAccessGranted";
const CONTACT_PHONE_NUMBER = "301-347-8710";

let selectedDivisionId = 5733;
let currentView = "standings";
const standingsCache = new Map();
const rosterCache = new Map();
const scheduleCache = new Map();
const scorecardCache = new Map();
const matchInsightsCache = new Map();
const playerProfilePictureCache = new Map();
let chartJsLoadPromise = null;

function toggleSidebar() {
  const app = document.getElementById("app");
  if (app) app.classList.toggle("sidebar-collapsed");
}

function divisionMeta(divisionId) {
  return COLLEGE_DIVISIONS.find(d => String(d.id) === String(divisionId)) ||
    { id: Number(divisionId), name: `Division ${divisionId}` };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function firstValue(object, keys, fallback = "") {
  for (const key of keys) {
    if (object && object[key] !== undefined && object[key] !== null && object[key] !== "") {
      return object[key];
    }
  }
  return fallback;
}


function cleanImageUrl(value) {
  if (!value) return "";

  let text = String(value).trim();

  // Handles values pasted/rendered in markdown form: [url](url)
  const markdownMatch = text.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if (markdownMatch) text = markdownMatch[2];

  return text.replace(/\\_/g, "_");
}

function handleTeamLogoError(image) {
  if (!image || !image.parentElement) return;

  const wrapper = image.parentElement;
  image.remove();
  wrapper.classList.remove("bg-white");
  wrapper.classList.add("bg-gray-100", "text-gray-400");
  wrapper.innerHTML = DEFAULT_TEAM_ICON;

  if (window.lucide) lucide.createIcons();
}

function teamLogoMarkup(url, name, sizeClass = "w-10 h-10") {
  const cleanUrl = cleanImageUrl(url);

  if (cleanUrl) {
    return `
      <div class="${sizeClass} rounded-xl overflow-hidden bg-white border border-gray-200 shrink-0 flex items-center justify-center">
        <img src="${escapeHtml(cleanUrl)}"
             alt="${escapeHtml(name || "Team")} logo"
             class="w-full h-full object-contain p-0.5"
             onerror="handleTeamLogoError(this)" />
      </div>
    `;
  }

  return `
    <div class="${sizeClass} rounded-xl bg-gray-100 border border-gray-200 shrink-0 flex items-center justify-center">
      ${DEFAULT_TEAM_ICON}
    </div>
  `;
}

function findCachedPlayerPicture(playerId) {
  if (playerId === null || playerId === undefined || playerId === "") return "";

  const target = String(playerId);

  for (const roster of rosterCache.values()) {
    const match = roster.find(player => String(player.id) === target);
    if (match?.picture) return cleanImageUrl(match.picture);
  }

  return "";
}

async function fetchPlayerProfilePicture(playerId) {
  if (playerId === null || playerId === undefined || playerId === "") {
    return DEFAULT_PROFILE_PICTURE;
  }

  const key = String(playerId);

  if (playerProfilePictureCache.has(key)) {
    return playerProfilePictureCache.get(key);
  }

  const cachedRosterPicture = findCachedPlayerPicture(key);
  if (cachedRosterPicture) {
    playerProfilePictureCache.set(key, cachedRosterPicture);
    return cachedRosterPicture;
  }

  const request = (async () => {
    try {
      const response = await fetch(`/proxy/user/${encodeURIComponent(key)}`);
      if (!response.ok) throw new Error(`Player profile HTTP ${response.status}`);

      const raw = await response.json();
      const candidates = [];

      if (Array.isArray(raw)) candidates.push(...raw);
      else if (raw && typeof raw === "object") {
        candidates.push(raw);
        if (raw.user && typeof raw.user === "object") candidates.push(raw.user);
        if (raw.profile && typeof raw.profile === "object") candidates.push(raw.profile);
        if (raw.player && typeof raw.player === "object") candidates.push(raw.player);
        if (raw.userInfo && typeof raw.userInfo === "object") candidates.push(raw.userInfo);
      }

      for (const item of candidates) {
        const picture = cleanImageUrl(firstValue(item, [
          "profilePictureUrl",
          "ProfilePictureUrl",
          "profilePicture",
          "ProfilePicture",
          "LogoImageUrl",
          "logoImageUrl",
          "ImageUrl",
          "imageUrl",
          "PhotoUrl",
          "photoUrl"
        ], ""));

        if (picture) return picture;
      }
    } catch (error) {
      console.warn(`Unable to load profile picture for player ${key}:`, error);
    }

    return DEFAULT_PROFILE_PICTURE;
  })();

  playerProfilePictureCache.set(key, request);
  const resolved = await request;
  playerProfilePictureCache.set(key, resolved);
  return resolved;
}

async function hydratePlayerProfileImages(root) {
  if (!root) return;

  const images = Array.from(root.querySelectorAll("img[data-player-image-id]"));
  if (!images.length) return;

  const byPlayer = new Map();

  images.forEach(image => {
    const playerId = image.dataset.playerImageId;
    if (!playerId) return;

    if (!byPlayer.has(playerId)) byPlayer.set(playerId, []);
    byPlayer.get(playerId).push(image);
  });

  await Promise.all(
    Array.from(byPlayer.entries()).map(async ([playerId, playerImages]) => {
      const picture = await fetchPlayerProfilePicture(playerId);

      playerImages.forEach(image => {
        if (!image.isConnected) return;
        image.src = picture || DEFAULT_PROFILE_PICTURE;
      });
    })
  );
}

function getTeamIdFromRow(row) {
  return firstValue(row, [
    "TeamId", "TeamID", "teamid", "teamId", "TeamIdRef",
    "TeamIdentifier", "ClubId", "clubId", "ID", "Id", "id"
  ], null);
}

function getTeamNameFromRow(row) {
  return String(firstValue(row, [
    "Teamname", "TeamName", "TeamDescr", "PlayerDescr",
    "Name", "ClubDescr", "ClubName"
  ], "Unknown Team")).trim();
}

function getTeamLogoFromRow(row) {
  return firstValue(row, [
    "LogoImageUrl", "logoImageUrl", "LogoUrl", "logoUrl", "logo"
  ], "");
}

function normalizeStandingsResponse(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  return data.standings || data.Standings || data.playerStandings || data.teams || [];
}

function normalizeTeamRow(row, index, divisionId) {
  const teamWins = numberOrNull(firstValue(row, [
    "TotalTeamwins", "TotalTeamWins", "TeamWins", "Wins", "W"
  ], null));

  const teamLosses = numberOrNull(firstValue(row, [
    "TotalTeamloses", "TotalTeamLoses", "TotalTeamLosses", "TeamLosses", "Losses", "L"
  ], null));

  const individualWins = numberOrNull(firstValue(row, [
    "TotalMatchesWon", "TotalMatchesWonValue", "TotalMatchesWonCount",
    "IndividualsWon", "IndividualMatchesWon"
  ], null));

  const individualLosses = numberOrNull(firstValue(row, [
    "TotalMatchesLost", "TotalMatchesLostValue", "TotalMatchesLostCount",
    "IndividualsLost", "IndividualMatchesLost"
  ], null));

  let winPct = null;
  if (teamWins !== null && teamLosses !== null && teamWins + teamLosses > 0) {
    winPct = (teamWins / (teamWins + teamLosses)) * 100;
  } else {
    const rawPct = firstValue(row, [
      "WinPct", "WinPercentage", "WinningPct", "WinPercent", "Pct"
    ], null);

    if (rawPct !== null) {
      const parsed = parseFloat(String(rawPct).replace("%", ""));
      if (Number.isFinite(parsed)) {
        winPct = parsed <= 1 ? parsed * 100 : parsed;
      }
    }
  }

  const rawRank = firstValue(row, ["hGroup", "Rank", "rank", "Position"], index + 1);
  const parsedRank = parseInt(rawRank, 10);

  return {
    id: getTeamIdFromRow(row),
    name: getTeamNameFromRow(row),
    logo: getTeamLogoFromRow(row),
    divisionId: Number(divisionId),
    rank: Number.isFinite(parsedRank) ? parsedRank : index + 1,
    teamWins,
    teamLosses,
    individualWins,
    individualLosses,
    winPct,
    raw: row
  };
}

function recordText(wins, losses) {
  if (wins === null && losses === null) return "N/A";
  return `${wins ?? 0}-${losses ?? 0}`;
}

function pctText(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}%` : "N/A";
}

function logoMarkup(team, sizeClass = "w-11 h-11") {
  if (team.logo) {
    return `
      <div class="${sizeClass} rounded-xl overflow-hidden bg-gray-100 border border-gray-100 shrink-0 flex items-center justify-center">
        <img src="${escapeHtml(team.logo)}"
             onerror="this.onerror=null;this.style.display='none'"
             alt="${escapeHtml(team.name)}"
             class="w-full h-full object-cover" />
      </div>
    `;
  }

  return `
    <div class="${sizeClass} rounded-xl bg-gray-100 border border-gray-100 shrink-0 flex items-center justify-center">
      ${DEFAULT_TEAM_ICON}
    </div>
  `;
}

async function fetchStandings(divisionId, force = false) {
  const id = Number(divisionId);

  if (!force && standingsCache.has(id)) {
    return standingsCache.get(id);
  }

  const response = await fetch(`/proxy/divisions/standings/${id}`);
  if (!response.ok) throw new Error(`Standings HTTP ${response.status}`);

  const data = await response.json();
  const rows = normalizeStandingsResponse(data);

  const teams = rows
    .map((row, index) => normalizeTeamRow(row, index, id))
    .filter(team => team.name && team.name !== "Unknown Team")
    .sort((a, b) => a.rank - b.rank);

  standingsCache.set(id, teams);
  return teams;
}

async function preloadAllStandings() {
  await Promise.allSettled(
    COLLEGE_DIVISIONS.map(division => fetchStandings(division.id))
  );
  populateCompareDropdowns();
}

function updateDivisionTabs() {
  document.querySelectorAll(".division-chip").forEach(button => {
    const active = String(button.dataset.division) === String(selectedDivisionId);
    button.classList.toggle("active", active);
    button.classList.toggle("bg-white", !active);
    button.classList.toggle("text-gray-600", !active);
    button.classList.toggle("border-gray-200", !active);
  });
}

function renderSummary(teams) {
  const leader = teams[0];
  const totalIndividualWins = teams.reduce(
    (sum, team) => sum + (team.individualWins ?? 0),
    0
  );

  document.getElementById("metric-teams").textContent = teams.length || "0";
  document.getElementById("metric-leader").textContent = leader ? leader.name : "N/A";
  document.getElementById("metric-individual-wins").textContent =
    totalIndividualWins.toLocaleString();

  const meta = divisionMeta(selectedDivisionId);
  document.getElementById("division-title").textContent = meta.name;
  document.getElementById("standings-subtitle").textContent =
    `${teams.length} teams · ${meta.name}`;
}

function podiumTone(place) {
  if (place === 1) {
    return {
      card: "podium-gold podium-first",
      badge: "bg-yellow-400 text-yellow-950",
      icon: "crown",
      label: "Gold"
    };
  }

  if (place === 2) {
    return {
      card: "podium-silver podium-second",
      badge: "bg-gray-300 text-gray-800",
      icon: "medal",
      label: "Silver"
    };
  }

  return {
    card: "podium-bronze podium-third",
    badge: "bg-amber-700 text-white",
    icon: "medal",
    label: "Bronze"
  };
}

function podiumCard(team, place) {
  const tone = podiumTone(place);
  const height = place === 1 ? "md:min-h-[238px]" : "md:min-h-[212px]";
  const logoSize = place === 1 ? "w-16 h-16" : "w-14 h-14";

  return `
    <button type="button"
            class="${tone.card} ${height} text-left rounded-2xl border border-gray-200 p-4 md:p-5 shadow-sm hover:shadow-md transition-shadow"
            data-team-id="${escapeHtml(team.id)}">
      <div class="flex items-center justify-between gap-3 mb-4">
        <span class="rank-circle ${tone.badge}">${place}</span>
        <span class="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-gray-500">
          <i data-lucide="${tone.icon}" class="w-4 h-4"></i>
          ${tone.label}
        </span>
      </div>

      <div class="flex md:flex-col md:text-center items-center gap-3">
        ${logoMarkup(team, logoSize)}
        <div class="min-w-0 md:w-full">
          <p class="font-bold text-gray-900 md:text-lg truncate">${escapeHtml(team.name)}</p>
          <p class="text-xs text-gray-500 mt-0.5">Team record ${escapeHtml(recordText(team.teamWins, team.teamLosses))}</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-black/5">
        <div>
          <p class="text-[11px] uppercase tracking-wide font-semibold text-gray-400">Win rate</p>
          <p class="font-black text-lg text-gray-900">${pctText(team.winPct)}</p>
        </div>
        <div class="text-right">
          <p class="text-[11px] uppercase tracking-wide font-semibold text-gray-400">Individuals</p>
          <p class="font-bold text-gray-700">${escapeHtml(recordText(team.individualWins, team.individualLosses))}</p>
        </div>
      </div>
    </button>
  `;
}

function renderPodium(teams) {
  const container = document.getElementById("podium-container");
  const top = teams.slice(0, 3);

  if (!top.length) {
    container.innerHTML = `
      <div class="md:col-span-3 py-10 text-center text-sm text-gray-400">
        No teams available in this division.
      </div>
    `;
    return;
  }

  let ordered;
  if (top.length >= 3) {
    ordered = [
      { team: top[1], place: 2 },
      { team: top[0], place: 1 },
      { team: top[2], place: 3 }
    ];
  } else {
    ordered = top.map((team, index) => ({ team, place: index + 1 }));
  }

  container.innerHTML = ordered
    .map(item => podiumCard(item.team, item.place))
    .join("");

  container.querySelectorAll("[data-team-id]").forEach(button => {
    button.addEventListener("click", () => openTeamModal(button.dataset.teamId));
  });
}

function rankBadgeClass(rank) {
  if (rank === 1) return "bg-yellow-100 text-yellow-700";
  if (rank === 2) return "bg-gray-200 text-gray-700";
  if (rank === 3) return "bg-amber-100 text-amber-800";
  return "bg-gray-100 text-gray-600";
}

function teamRowMarkup(team) {
  const pct = Number.isFinite(team.winPct) ? Math.max(0, Math.min(100, team.winPct)) : 0;

  return `
    <button type="button"
            class="team-row w-full rounded-2xl border border-gray-200 bg-white/65 p-3 md:p-4 text-left"
            data-team-id="${escapeHtml(team.id)}"
            data-team-name="${escapeHtml(team.name.toLowerCase())}">
      <div class="flex items-center gap-3 md:gap-4">
        <span class="rank-circle ${rankBadgeClass(team.rank)}">${escapeHtml(team.rank)}</span>
        ${logoMarkup(team)}

        <div class="min-w-0 flex-1">
          <div class="flex items-start md:items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="font-semibold text-gray-900 truncate">${escapeHtml(team.name)}</p>
              <p class="text-xs text-gray-400 mt-0.5 md:hidden">
                ${escapeHtml(recordText(team.teamWins, team.teamLosses))} team ·
                ${escapeHtml(recordText(team.individualWins, team.individualLosses))} individual
              </p>
            </div>

            <i data-lucide="chevron-right" class="w-4 h-4 text-gray-300 shrink-0 md:hidden"></i>
          </div>

          <div class="mt-2 md:hidden">
            <div class="flex items-center justify-between text-[11px] font-semibold text-gray-400 mb-1">
              <span>Win rate</span>
              <span>${pctText(team.winPct)}</span>
            </div>
            <div class="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div class="h-full rounded-full bg-indigo-500" style="width:${pct}%"></div>
            </div>
          </div>
        </div>

        <div class="hidden md:grid grid-cols-[78px_92px_130px_auto] gap-5 xl:gap-8 items-center shrink-0">
          <div class="text-center min-w-[78px]">
            <p class="text-[11px] uppercase tracking-wide font-semibold text-gray-400">Team W-L</p>
            <p class="text-sm font-bold text-gray-700 mt-0.5">${escapeHtml(recordText(team.teamWins, team.teamLosses))}</p>
          </div>

          <div class="text-center min-w-[92px]">
            <p class="text-[11px] uppercase tracking-wide font-semibold text-gray-400">Individuals</p>
            <p class="text-sm font-bold text-gray-700 mt-0.5">${escapeHtml(recordText(team.individualWins, team.individualLosses))}</p>
          </div>

          <div class="min-w-[130px]">
            <div class="flex justify-between text-[11px] uppercase tracking-wide font-semibold text-gray-400 mb-1">
              <span>Win rate</span>
              <span>${pctText(team.winPct)}</span>
            </div>
            <div class="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div class="h-full rounded-full bg-indigo-500" style="width:${pct}%"></div>
            </div>
          </div>

          <i data-lucide="chevron-right" class="w-4 h-4 text-gray-300"></i>
        </div>
      </div>
    </button>
  `;
}

function renderStandingsList(teams) {
  const list = document.getElementById("standings-list");
  const search = document.getElementById("team-search").value.trim().toLowerCase();

  const filtered = search
    ? teams.filter(team => team.name.toLowerCase().includes(search))
    : teams;

  if (!filtered.length) {
    list.innerHTML = `
      <div class="py-12 text-center">
        <span class="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
          <i data-lucide="search-x" class="w-5 h-5 text-gray-400"></i>
        </span>
        <p class="font-semibold text-gray-700">No teams found</p>
        <p class="text-sm text-gray-400 mt-1">Try another search.</p>
      </div>
    `;
  } else {
    list.innerHTML = filtered.map(teamRowMarkup).join("");
  }

  list.querySelectorAll("[data-team-id]").forEach(button => {
    button.addEventListener("click", () => openTeamModal(button.dataset.teamId));
  });

  if (window.lucide) lucide.createIcons();
}

async function renderSelectedDivision() {
  updateDivisionTabs();

  const list = document.getElementById("standings-list");
  list.innerHTML = `
    <div class="py-12 text-center text-sm text-gray-400">
      Loading ${escapeHtml(divisionMeta(selectedDivisionId).name)} standings…
    </div>
  `;

  try {
    const teams = await fetchStandings(selectedDivisionId);
    renderSummary(teams);
    renderPodium(teams);
    renderStandingsList(teams);
  } catch (error) {
    console.error("Failed to load division standings:", error);
    renderSummary([]);
    document.getElementById("podium-container").innerHTML = `
      <div class="md:col-span-3 py-10 text-center text-sm text-red-500">
        Failed to load division leaders.
      </div>
    `;
    list.innerHTML = `
      <div class="py-12 text-center">
        <p class="font-semibold text-red-500">Failed to load standings.</p>
        <p class="text-sm text-gray-400 mt-1">Check the division standings proxy.</p>
      </div>
    `;
  }

  if (window.lucide) lucide.createIcons();
}

function findTeamById(teamId) {
  for (const [divisionId, teams] of standingsCache.entries()) {
    const team = teams.find(item => String(item.id) === String(teamId));
    if (team) return { ...team, divisionId };
  }
  return null;
}

function allCachedTeams() {
  const all = [];

  for (const division of COLLEGE_DIVISIONS) {
    const teams = standingsCache.get(division.id) || [];
    teams.forEach(team => all.push(team));
  }

  const unique = new Map();
  all.forEach(team => {
    const key = String(team.id || `${team.divisionId}:${team.name}`);
    if (!unique.has(key)) unique.set(key, team);
  });

  return Array.from(unique.values());
}

function populateCompareDropdowns() {
  const selectA = document.getElementById("compare-team-a");
  const selectB = document.getElementById("compare-team-b");
  if (!selectA || !selectB) return;

  const currentA = selectA.value;
  const currentB = selectB.value;

  const buildOptions = () => {
    let markup = `<option value="">Choose a team...</option>`;

    COLLEGE_DIVISIONS.forEach(division => {
      const teams = standingsCache.get(division.id) || [];
      if (!teams.length) return;

      markup += `<optgroup label="${escapeHtml(division.name)}">`;

      teams.forEach(team => {
        markup += `
          <option value="${escapeHtml(team.id)}">
            #${escapeHtml(team.rank)} ${escapeHtml(team.name)}
          </option>
        `;
      });

      markup += `</optgroup>`;
    });

    return markup;
  };

  const options = buildOptions();
  selectA.innerHTML = options;
  selectB.innerHTML = options;

  if (Array.from(selectA.options).some(option => option.value === currentA)) {
    selectA.value = currentA;
  }

  if (Array.from(selectB.options).some(option => option.value === currentB)) {
    selectB.value = currentB;
  }
}

function setView(view) {
  currentView = view;

  const standingsView = document.getElementById("standings-view");
  const compareView = document.getElementById("compare-view");
  const standingsButton = document.getElementById("view-standings-btn");
  const compareButton = document.getElementById("view-compare-btn");

  standingsView.classList.toggle("hidden", view !== "standings");
  compareView.classList.toggle("hidden", view !== "compare");

  standingsButton.classList.toggle("active", view === "standings");
  compareButton.classList.toggle("active", view === "compare");

  standingsButton.classList.toggle("text-gray-600", view !== "standings");
  compareButton.classList.toggle("text-gray-600", view !== "compare");

  if (view === "compare") {
    populateCompareDropdowns();
  }

  if (window.lucide) lucide.createIcons();
}

function normalizeRoster(data) {
  const rows = Array.isArray(data)
    ? data
    : (data?.players || data?.PlayerList || data?.teamPlayers || []);

  return rows.map((player, index) => {
    const rating = numberOrNull(firstValue(player, [
      "CurrentRating", "Rating", "RatingValue", "RatingOther", "rating"
    ], null));

    const positionRaw = firstValue(player, [
      "TeamPosition", "TeamPos", "Position", "TeamPositionName", "position"
    ], "");

    const positionMatch = String(positionRaw).match(/\d+/);
    const position = positionMatch ? parseInt(positionMatch[0], 10) : null;

    return {
      id: firstValue(player, ["playerid", "PlayerId", "PlayerID", "id"], null),
      name: String(firstValue(player, ["player", "PlayerName", "Name", "name"], `Player ${index + 1}`)),
      rating,
      position,
      positionText: positionRaw || "",
      wins: numberOrNull(firstValue(player, ["wins", "Wins", "W"], null)),
      losses: numberOrNull(firstValue(player, ["losses", "Losses", "L"], null)),
      picture: firstValue(player, ["profilePictureUrl", "profilePicture", "ProfilePictureUrl"], ""),
      raw: player
    };
  });
}

async function fetchRoster(teamId) {
  const key = String(teamId);

  if (rosterCache.has(key)) return rosterCache.get(key);

  const response = await fetch(`/proxy/teams/${encodeURIComponent(teamId)}/players`);
  if (!response.ok) throw new Error(`Roster HTTP ${response.status}`);

  const data = await response.json();
  const players = normalizeRoster(data);
  rosterCache.set(key, players);
  return players;
}

async function fetchSchedule(teamId) {
  const key = String(teamId);

  if (scheduleCache.has(key)) return scheduleCache.get(key);

  const response = await fetch(`/proxy/teams/${encodeURIComponent(teamId)}/schedule`);
  if (!response.ok) throw new Error(`Schedule HTTP ${response.status}`);

  const data = await response.json();
  const rows = Array.isArray(data)
    ? data
    : (data?.matches || data?.Schedule || data?.schedule || []);

  scheduleCache.set(key, rows);
  return rows;
}

function lineupSortPosition(player) {
  // Position 0 is effectively unassigned/reserve for display purposes.
  // Keep normal positions 1, 2, 3... first and move 0 to the bottom.
  if (Number.isFinite(player.position) && player.position > 0) {
    return player.position;
  }
  return 999;
}

function orderLineup(players) {
  const rated = players.filter(player => Number.isFinite(player.rating));

  return rated
    .sort((a, b) => {
      const positionDifference = lineupSortPosition(a) - lineupSortPosition(b);
      if (positionDifference !== 0) return positionDifference;

      return b.rating - a.rating;
    })
    .slice(0, 9);
}

function individualWinProbability(ratingA, ratingB) {
  // A simple rating-only heuristic. A 1.0 rating-point edge produces a strong
  // favorite while smaller differences stay closer to 50/50.
  const diff = ratingA - ratingB;
  return 1 / (1 + Math.pow(10, -diff / 1.0));
}

function teamWinProbability(matchupProbabilities) {
  const n = matchupProbabilities.length;
  if (!n) return 0.5;

  const neededWins = Math.floor(n / 2) + 1;
  let distribution = Array(n + 1).fill(0);
  distribution[0] = 1;

  matchupProbabilities.forEach(probability => {
    const next = Array(n + 1).fill(0);

    for (let wins = 0; wins <= n; wins++) {
      if (!distribution[wins]) continue;
      next[wins] += distribution[wins] * (1 - probability);
      next[wins + 1] += distribution[wins] * probability;
    }

    distribution = next;
  });

  return distribution
    .slice(neededWins)
    .reduce((sum, probability) => sum + probability, 0);
}

function averageRating(lineup) {
  if (!lineup.length) return null;
  return lineup.reduce((sum, player) => sum + player.rating, 0) / lineup.length;
}

function teamHeaderMarkup(team, side) {
  return `
    <div class="${side === "B" ? "text-right" : ""} min-w-0">
      <p class="text-xs uppercase tracking-wide font-semibold text-gray-400">Team ${side}</p>
      <div class="flex ${side === "B" ? "justify-end" : ""} items-center gap-2 mt-1">
        ${side === "B" ? "" : logoMarkup(team, "w-10 h-10")}
        <div class="min-w-0">
          <p class="font-bold text-gray-900 truncate">${escapeHtml(team.name)}</p>
          <p class="text-xs text-gray-500">${escapeHtml(divisionMeta(team.divisionId).name)}</p>
        </div>
        ${side === "B" ? logoMarkup(team, "w-10 h-10") : ""}
      </div>
    </div>
  `;
}

function lineupRowMarkup(matchup, index, teamA, teamB) {
  const probabilityA = matchup.probabilityA;
  const favorite = probabilityA > 0.5 ? "A" : probabilityA < 0.5 ? "B" : "tie";
  const edge = Math.abs(matchup.playerA.rating - matchup.playerB.rating);

  return `
    <div class="rounded-2xl border border-gray-200 bg-white/70 p-3 md:p-4">
      <div class="grid grid-cols-[1fr_auto_1fr] gap-2 md:gap-4 items-center">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-black shrink-0">${index + 1}</span>
            <div class="min-w-0">
              <p class="text-sm font-semibold text-gray-900 truncate">${escapeHtml(matchup.playerA.name)}</p>
              <p class="text-xs ${favorite === "A" ? "text-green-600 font-semibold" : "text-gray-400"}">
                ${matchup.playerA.rating.toFixed(2)} rating
              </p>
            </div>
          </div>
        </div>

        <div class="text-center px-1">
          <p class="text-[10px] uppercase tracking-wide font-semibold text-gray-400">Edge</p>
          <p class="text-xs font-bold ${favorite === "tie" ? "text-gray-500" : "text-indigo-600"}">
            ${favorite === "tie" ? "Even" : edge.toFixed(2)}
          </p>
        </div>

        <div class="min-w-0 text-right">
          <div class="flex items-center justify-end gap-2">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-gray-900 truncate">${escapeHtml(matchup.playerB.name)}</p>
              <p class="text-xs ${favorite === "B" ? "text-green-600 font-semibold" : "text-gray-400"}">
                ${matchup.playerB.rating.toFixed(2)} rating
              </p>
            </div>
            <span class="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-xs font-black shrink-0">${index + 1}</span>
          </div>
        </div>
      </div>

      <div class="mt-3 flex items-center gap-2">
        <span class="text-[11px] font-bold text-gray-500 w-10">${Math.round(probabilityA * 100)}%</span>
        <div class="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden relative">
          <div class="absolute inset-y-0 left-0 bg-indigo-400 rounded-full" style="width:${probabilityA * 100}%"></div>
        </div>
        <span class="text-[11px] font-bold text-gray-500 w-10 text-right">${Math.round((1 - probabilityA) * 100)}%</span>
      </div>
    </div>
  `;
}

function renderComparison(teamA, teamB, lineupA, lineupB) {
  const matchupCount = Math.min(lineupA.length, lineupB.length, 9);

  if (!matchupCount) {
    throw new Error("One or both teams do not have rated players.");
  }

  const matchups = [];
  let projectedAWins = 0;
  let projectedBWins = 0;

  for (let i = 0; i < matchupCount; i++) {
    const playerA = lineupA[i];
    const playerB = lineupB[i];
    const probabilityA = individualWinProbability(playerA.rating, playerB.rating);

    if (probabilityA >= 0.5) projectedAWins += 1;
    else projectedBWins += 1;

    matchups.push({ playerA, playerB, probabilityA });
  }

  const probabilityA = teamWinProbability(matchups.map(matchup => matchup.probabilityA));
  const probabilityB = 1 - probabilityA;
  const averageA = averageRating(lineupA.slice(0, matchupCount));
  const averageB = averageRating(lineupB.slice(0, matchupCount));
  const ratingDifference = averageA - averageB;

  document.getElementById("compare-team-header").innerHTML = `
    ${teamHeaderMarkup(teamA, "A")}
    <div class="w-9 h-9 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center font-black text-xs">VS</div>
    ${teamHeaderMarkup(teamB, "B")}
  `;

  document.getElementById("projected-score").textContent =
    `${projectedAWins} – ${projectedBWins}`;

  let projectedWinner = "Projected draw";
  if (projectedAWins > projectedBWins) projectedWinner = `${teamA.name} projected to win`;
  if (projectedBWins > projectedAWins) projectedWinner = `${teamB.name} projected to win`;

  document.getElementById("projected-winner").textContent = projectedWinner;
  document.getElementById("probability-a").textContent = `${Math.round(probabilityA * 100)}%`;
  document.getElementById("probability-b").textContent = `${Math.round(probabilityB * 100)}%`;

  const fill = document.getElementById("compare-probability-fill");

  if (probabilityA >= probabilityB) {
    fill.style.left = "0";
    fill.style.right = "auto";
    fill.style.width = `${probabilityA * 100}%`;
  } else {
    fill.style.left = "auto";
    fill.style.right = "0";
    fill.style.width = `${probabilityB * 100}%`;
  }

  document.getElementById("compare-avg-a").textContent =
    Number.isFinite(averageA) ? averageA.toFixed(2) : "N/A";

  document.getElementById("compare-avg-b").textContent =
    Number.isFinite(averageB) ? averageB.toFixed(2) : "N/A";

  let edgeText = "Even";
  if (Number.isFinite(ratingDifference) && Math.abs(ratingDifference) >= 0.005) {
    const edgeTeam = ratingDifference > 0 ? teamA.name : teamB.name;
    edgeText = `${edgeTeam} +${Math.abs(ratingDifference).toFixed(2)}`;
  }

  document.getElementById("compare-rating-edge").textContent = edgeText;
  document.getElementById("compare-lineups-used").textContent = `${matchupCount} vs ${matchupCount}`;

  document.getElementById("lineup-comparison").innerHTML =
    matchups.map((matchup, index) =>
      lineupRowMarkup(matchup, index, teamA, teamB)
    ).join("");

  document.getElementById("compare-empty").classList.add("hidden");
  document.getElementById("compare-results").classList.remove("hidden");

  if (window.lucide) lucide.createIcons();
}

async function compareSelectedTeams() {
  const selectA = document.getElementById("compare-team-a");
  const selectB = document.getElementById("compare-team-b");
  const error = document.getElementById("compare-error");
  const loading = document.getElementById("compare-loading");
  const results = document.getElementById("compare-results");

  error.classList.add("hidden");
  error.textContent = "";

  const teamAId = selectA.value;
  const teamBId = selectB.value;

  if (!teamAId || !teamBId) {
    error.textContent = "Choose two teams first.";
    error.classList.remove("hidden");
    return;
  }

  if (String(teamAId) === String(teamBId)) {
    error.textContent = "Choose two different teams.";
    error.classList.remove("hidden");
    return;
  }

  const teamA = findTeamById(teamAId);
  const teamB = findTeamById(teamBId);

  if (!teamA || !teamB) {
    error.textContent = "Team information is not loaded yet. Try again in a moment.";
    error.classList.remove("hidden");
    return;
  }

  loading.classList.remove("hidden");
  results.classList.add("hidden");
  document.getElementById("compare-empty").classList.add("hidden");

  try {
    const [playersA, playersB] = await Promise.all([
      fetchRoster(teamAId),
      fetchRoster(teamBId)
    ]);

    const lineupA = orderLineup(playersA);
    const lineupB = orderLineup(playersB);

    renderComparison(teamA, teamB, lineupA, lineupB);
  } catch (comparisonError) {
    console.error("Compare teams failed:", comparisonError);
    error.textContent = comparisonError.message || "Failed to compare the selected teams.";
    error.classList.remove("hidden");
    document.getElementById("compare-empty").classList.remove("hidden");
  } finally {
    loading.classList.add("hidden");
  }
}

function modalMetric(label, value, accent = false) {
  return `
    <div class="rounded-2xl border ${accent ? "border-indigo-100 bg-indigo-50/60" : "border-gray-200 bg-gray-50/65"} p-3">
      <p class="text-[11px] uppercase tracking-wide font-semibold ${accent ? "text-indigo-500" : "text-gray-400"}">${escapeHtml(label)}</p>
      <p class="text-lg font-black text-gray-900 mt-0.5">${escapeHtml(value)}</p>
    </div>
  `;
}

function rosterPlayerMarkup(player, index) {
  const rating = Number.isFinite(player.rating) ? player.rating.toFixed(2) : "N/A";
  const position =
    Number.isFinite(player.position) && player.position === 0
      ? "Position 0"
      : player.positionText || (Number.isFinite(player.position) ? `#${player.position}` : `#${index + 1}`);
  const record = recordText(player.wins, player.losses);
  const initialPicture = cleanImageUrl(player.picture) || DEFAULT_PROFILE_PICTURE;

  return `
    <button type="button"
            class="w-full rounded-xl border border-gray-200 bg-white p-3 flex items-center gap-3 text-left hover:border-indigo-200 hover:bg-indigo-50/25 transition-colors"
            data-player-id="${escapeHtml(player.id)}">
      <div class="w-11 h-11 rounded-xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
        <img src="${escapeHtml(initialPicture)}"
             data-player-image-id="${escapeHtml(player.id)}"
             alt="${escapeHtml(player.name)}"
             class="w-full h-full object-cover"
             onerror="this.onerror=null;this.src='${DEFAULT_PROFILE_PICTURE}'" />
      </div>

      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold text-gray-900 truncate">${escapeHtml(player.name)}</p>
        <p class="text-xs text-gray-400 mt-0.5">${escapeHtml(position)} · ${escapeHtml(record)} W-L</p>
      </div>

      <span class="rounded-lg bg-indigo-50 text-indigo-700 px-2 py-1 text-xs font-bold">${escapeHtml(rating)}</span>
    </button>
  `;
}

function parseMatchDate(value) {
  if (!value) return null;

  const text = String(value).trim();
  const shortUs = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);

  if (shortUs) {
    const [, month, day, shortYear] = shortUs;
    const year = 2000 + Number(shortYear);
    const date = new Date(year, Number(month) - 1, Number(day));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatMatchDate(value) {
  if (!value) return "Date TBD";

  const date = parseMatchDate(value);
  if (!date) return String(value);

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function getMatchId(match) {
  return firstValue(match, [
    "MatchId", "MatchID", "matchId", "matchID", "Matchid", "matchid", "id", "Id"
  ], null);
}

function getScorecardId(match) {
  return firstValue(match, [
    "scorecardid", "ScoreCardId", "ScorecardId", "scoreCardId", "ScorecardID"
  ], null);
}

function getMatchStatus(match) {
  return String(firstValue(match, [
    "Score_Entered", "ScoreEntered", "Status", "status",
    "MatchStatus", "matchStatus", "ResultStatus"
  ], "")).trim();
}

function getMatchScore(match) {
  const explicitScore = firstValue(match, [
    "matchResult", "MatchResult", "Score", "score", "MatchScore",
    "TeamScore", "Result", "result"
  ], "");

  if (explicitScore !== null && explicitScore !== undefined && String(explicitScore).trim() !== "") {
    return String(explicitScore).trim();
  }

  const homeWins = numberOrNull(firstValue(match, [
    "Home_Matches_Won", "HomeMatchesWon", "homeMatchesWon"
  ], null));

  const visitorWins = numberOrNull(firstValue(match, [
    "Visitor_Matches_Won", "VisitorMatchesWon", "visitorMatchesWon"
  ], null));

  if (
    homeWins !== null &&
    visitorWins !== null &&
    (homeWins > 0 || visitorWins > 0)
  ) {
    return `${homeWins} - ${visitorWins}`;
  }

  return "";
}

function isCompletedTeamMatch(match) {
  const entered = String(firstValue(match, [
    "Score_Entered", "ScoreEntered"
  ], "")).trim().toLowerCase();

  // The team schedule example explicitly uses "Scheduled" for unplayed matches.
  if (entered === "scheduled") return false;

  const homeWins = numberOrNull(firstValue(match, [
    "Home_Matches_Won", "HomeMatchesWon"
  ], null));

  const visitorWins = numberOrNull(firstValue(match, [
    "Visitor_Matches_Won", "VisitorMatchesWon"
  ], null));

  if (
    homeWins !== null &&
    visitorWins !== null &&
    (homeWins > 0 || visitorWins > 0)
  ) {
    return true;
  }

  if (["c", "re", "completed", "complete", "final", "finished", "entered"].includes(entered)) {
    return true;
  }

  // Some completed schedule rows may simply have a scorecard plus an entered
  // score/result string rather than a formal completion status.
  return getMatchScore(match) !== "";
}

function teamMatchPerspective(match, teamName, teamId = null) {
  const date = firstValue(match, [
    "matchdate", "MatchDate", "matchDate", "Date", "date"
  ], "");

  // In the supplied schedule payload, wTeamName corresponds to hteamid and
  // oTeamName corresponds to vteamid.
  const home = String(firstValue(match, [
    "wTeamName", "HomeTeam", "Home", "HomeDescr", "HomeName", "HomeTeamName"
  ], "")).trim();

  const away = String(firstValue(match, [
    "oTeamName", "VisitingTeam", "AwayTeam", "VisitingDescr",
    "AwayName", "Visiting", "Away", "VisitingTeamName"
  ], "")).trim();

  const homeTeamId = firstValue(match, [
    "hteamid", "hTeamId", "HomeTeamId", "homeTeamId"
  ], null);

  const visitorTeamId = firstValue(match, [
    "vteamid", "vTeamId", "VisitorTeamId", "AwayTeamId", "visitorTeamId"
  ], null);

  const normalizedTeam = String(teamName || "").trim().toLowerCase();

  const selectedIsHome =
    teamId !== null && teamId !== undefined
      ? String(homeTeamId) === String(teamId)
      : Boolean(normalizedTeam && home.toLowerCase().includes(normalizedTeam));

  const selectedIsAway =
    teamId !== null && teamId !== undefined
      ? String(visitorTeamId) === String(teamId)
      : Boolean(normalizedTeam && away.toLowerCase().includes(normalizedTeam));

  let opponent = away || home || String(firstValue(match, ["teamname"], "Opponent TBD"));
  let venueLabel = "";

  if (selectedIsHome) {
    opponent = away || String(firstValue(match, ["teamname"], "Opponent TBD"));
    venueLabel = "Home";
  } else if (selectedIsAway) {
    opponent = home || String(firstValue(match, ["teamname"], "Opponent TBD"));
    venueLabel = "Away";
  }

  const homeWins = numberOrNull(firstValue(match, [
    "Home_Matches_Won", "HomeMatchesWon"
  ], null));

  const visitorWins = numberOrNull(firstValue(match, [
    "Visitor_Matches_Won", "VisitorMatchesWon"
  ], null));

  let resultLabel = "";
  if (
    isCompletedTeamMatch(match) &&
    homeWins !== null &&
    visitorWins !== null &&
    homeWins !== visitorWins
  ) {
    if (selectedIsHome) {
      resultLabel = homeWins > visitorWins ? "Win" : "Loss";
    } else if (selectedIsAway) {
      resultLabel = visitorWins > homeWins ? "Win" : "Loss";
    }
  }

  return {
    scorecardId: getScorecardId(match),
    date,
    home,
    away,
    homeTeamId,
    visitorTeamId,
    opponent,
    venueLabel,
    score: getMatchScore(match),
    resultLabel,
    status: getMatchStatus(match),
    venue: firstValue(match, ["VenueName", "MatchSite", "Venue"], ""),
    event: firstValue(match, ["descr", "Descr", "DivisionDescr", "LeagueDescr"], ""),
    leagueId: firstValue(match, ["Leagueid", "LeagueId", "leagueId"], null),
    seasonId: firstValue(match, ["Seasonid", "SeasonId", "seasonId"], null),
    matchTime: firstValue(match, ["MatchTime", "StartTime"], ""),
    homeLogo: cleanImageUrl(firstValue(match, ["wLogo", "HomeLogo", "homeLogo"], "")),
    awayLogo: cleanImageUrl(firstValue(match, ["oLogo", "AwayLogo", "VisitingLogo", "awayLogo"], ""))
  };
}

function teamMatchCardMarkup(match, team, matchIndex, completed) {
  const view = teamMatchPerspective(match, team.name, team.id);

  const resultTone =
    view.resultLabel === "Win"
      ? "bg-green-50 text-green-700 border-green-100"
      : view.resultLabel === "Loss"
        ? "bg-red-50 text-red-600 border-red-100"
        : "bg-gray-100 text-gray-500 border-gray-200";

  return `
    <button type="button"
            class="w-full rounded-2xl border border-gray-200 bg-white p-3 md:p-4 text-left hover:border-indigo-200 hover:bg-indigo-50/25 transition-colors"
            data-team-match-index="${matchIndex}">
      <div class="flex items-center justify-between gap-3 mb-3">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">
          ${escapeHtml(formatMatchDate(view.date))}
          ${view.matchTime ? ` · ${escapeHtml(view.matchTime)}` : ""}
        </p>

        <div class="flex flex-wrap items-center justify-end gap-1.5">
          ${view.venueLabel
            ? `<span class="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">${escapeHtml(view.venueLabel)}</span>`
            : ""}

          ${completed && view.resultLabel
            ? `<span class="rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${resultTone}">${escapeHtml(view.resultLabel)}</span>`
            : ""}
        </div>
      </div>

      <div class="grid grid-cols-[1fr_auto_1fr] gap-2 md:gap-3 items-center">
        <div class="flex items-center gap-2 min-w-0">
          ${teamLogoMarkup(view.homeLogo, view.home, "w-10 h-10")}
          <p class="text-xs md:text-sm font-semibold text-gray-800 truncate">${escapeHtml(view.home || "Home Team")}</p>
        </div>

        <div class="text-center shrink-0">
          ${view.score
            ? `<p class="text-lg font-black text-indigo-600">${escapeHtml(view.score)}</p>`
            : `<p class="text-xs font-bold uppercase tracking-wide text-gray-400">vs</p>`}
        </div>

        <div class="flex items-center justify-end gap-2 min-w-0 text-right">
          <p class="text-xs md:text-sm font-semibold text-gray-800 truncate">${escapeHtml(view.away || view.opponent || "Away Team")}</p>
          ${teamLogoMarkup(view.awayLogo, view.away || view.opponent, "w-10 h-10")}
        </div>
      </div>

      <div class="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-gray-100">
        <p class="text-xs text-gray-400 truncate">
          ${view.venue ? escapeHtml(view.venue) : (view.event ? escapeHtml(view.event) : "")}
        </p>

        <div class="flex items-center gap-1 text-[10px] font-semibold text-indigo-500 shrink-0">
          <span>${completed ? "View scorecard" : "View details"}</span>
          <i data-lucide="chevron-right" class="w-3 h-3"></i>
        </div>
      </div>
    </button>
  `;
}

async function fetchTeamScorecard(scorecardId) {
  if (!scorecardId) return [];

  const key = String(scorecardId);
  if (scorecardCache.has(key)) return scorecardCache.get(key);

  const proxyUrl = `/proxy/leagues/scorecards/live?id=${encodeURIComponent(scorecardId)}`;
  let response;

  try {
    response = await fetch(proxyUrl);
    if (!response.ok) throw new Error(`Scorecard HTTP ${response.status}`);
  } catch (proxyError) {
    console.warn("Scorecard proxy failed; trying US Squash directly:", proxyError);

    const directUrl =
      `https://api.ussquash.com/resources/leagues/scorecards/live?id=${encodeURIComponent(scorecardId)}`;

    response = await fetch(directUrl);
    if (!response.ok) throw new Error(`Scorecard HTTP ${response.status}`);
  }

  const data = await response.json();
  const rows = Array.isArray(data)
    ? data
    : (data?.matches || data?.scorecard || data?.results || []);

  const sorted = [...rows].sort((a, b) => {
    const pa = numberOrNull(firstValue(a, ["positionNumber", "PositionNumber"], null));
    const pb = numberOrNull(firstValue(b, ["positionNumber", "PositionNumber"], null));

    if (pa !== null && pb !== null) return pa - pb;
    if (pa !== null) return -1;
    if (pb !== null) return 1;
    return 0;
  });

  scorecardCache.set(key, sorted);
  return sorted;
}

function formatDurationValue(value) {
  if (!value) return "N/A";

  const text = String(value).trim();

  // Scorecard API duration example: 1970-01-01T00:24:36.000Z
  const isoClock = text.match(/T(\d{2}):(\d{2}):(\d{2})/);
  if (isoClock) {
    const hours = Number(isoClock[1]);
    const minutes = Number(isoClock[2]);
    const seconds = Number(isoClock[3]);

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  return text;
}

function individualCourtMarkup(row) {
  const homePlayer = String(firstValue(row, [
    "playerHome1Name", "HomePlayer", "HomePlayerName", "hplayer1",
    "Player1", "player1", "HomeName", "homePlayer"
  ], "Home player"));

  const awayPlayer = String(firstValue(row, [
    "playerVisiting1Name", "VisitingPlayer", "AwayPlayer",
    "VisitingPlayerName", "vplayer1", "Player2", "player2",
    "AwayName", "awayPlayer"
  ], "Away player"));

  const homePlayerId = firstValue(row, [
    "playerHome1Id", "PlayerHome1Id", "HomePlayerId", "wid1"
  ], null);

  const awayPlayerId = firstValue(row, [
    "playerVisiting1Id", "PlayerVisiting1Id", "VisitingPlayerId", "oid1"
  ], null);

  const score = String(firstValue(row, [
    "score", "Score", "MatchScore", "Result"
  ], ""));

  const result = String(firstValue(row, ["result", "Result"], ""));

  const position = firstValue(row, [
    "positionPlayed", "positionNumber", "PositionPlayed",
    "Position", "Court", "MatchPosition", "Line"
  ], "");

  const winner = String(firstValue(row, ["winner", "Winner"], "")).toUpperCase();
  const duration = formatDurationValue(
    firstValue(row, ["matchDuration", "MatchDuration"], "")
  );

  const homeWon = winner === "H";
  const awayWon = winner === "V" || winner === "A";
  const matchId = getMatchId(row);

  return `
    <button type="button"
            class="w-full rounded-xl border border-gray-200 bg-white p-3 text-left hover:border-indigo-200 hover:bg-indigo-50/25 transition-colors"
            data-individual-match-id="${escapeHtml(matchId)}">
      <div class="flex items-center justify-between gap-3 mb-3">
        <span class="rounded-lg bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
          ${escapeHtml(position || "Position")}
        </span>

        <div class="flex items-center gap-2">
          ${duration !== "N/A"
            ? `<span class="text-[10px] font-semibold text-gray-400">${escapeHtml(duration)}</span>`
            : ""}
          <span class="text-[10px] font-semibold text-indigo-500 inline-flex items-center gap-1">
            Match Insights <i data-lucide="chevron-right" class="w-3 h-3"></i>
          </span>
        </div>
      </div>

      <div class="grid grid-cols-[1fr_auto_1fr] gap-2 md:gap-4 items-center">
        <div class="flex items-center gap-2 min-w-0">
          <img src="${DEFAULT_PROFILE_PICTURE}"
               data-player-image-id="${escapeHtml(homePlayerId)}"
               alt="${escapeHtml(homePlayer)}"
               class="w-10 h-10 rounded-full object-cover border border-gray-200 shrink-0"
               onerror="this.onerror=null;this.src='${DEFAULT_PROFILE_PICTURE}'" />

          <div class="min-w-0">
            <p class="text-sm font-semibold ${homeWon ? "text-green-700" : "text-gray-800"} truncate">
              ${escapeHtml(homePlayer)}
            </p>
            ${homeWon ? `<p class="text-[10px] font-bold uppercase tracking-wide text-green-600 mt-0.5">Winner</p>` : ""}
          </div>
        </div>

        <div class="text-center shrink-0">
          <p class="text-sm font-black text-indigo-700">${escapeHtml(result || "vs")}</p>
        </div>

        <div class="flex items-center justify-end gap-2 min-w-0 text-right">
          <div class="min-w-0">
            <p class="text-sm font-semibold ${awayWon ? "text-green-700" : "text-gray-800"} truncate">
              ${escapeHtml(awayPlayer)}
            </p>
            ${awayWon ? `<p class="text-[10px] font-bold uppercase tracking-wide text-green-600 mt-0.5">Winner</p>` : ""}
          </div>

          <img src="${DEFAULT_PROFILE_PICTURE}"
               data-player-image-id="${escapeHtml(awayPlayerId)}"
               alt="${escapeHtml(awayPlayer)}"
               class="w-10 h-10 rounded-full object-cover border border-gray-200 shrink-0"
               onerror="this.onerror=null;this.src='${DEFAULT_PROFILE_PICTURE}'" />
        </div>
      </div>

      ${score
        ? `<p class="text-xs font-semibold text-gray-500 text-center mt-3">${escapeHtml(score)}</p>`
        : ""}
    </button>
  `;
}

function matchDetailMetric(label, value) {
  if (value === null || value === undefined || String(value).trim() === "") return "";

  return `
    <div class="rounded-xl border border-gray-200 bg-gray-50/70 p-3">
      <p class="text-[10px] font-semibold uppercase tracking-wide text-gray-400">${escapeHtml(label)}</p>
      <p class="text-sm font-bold text-gray-800 mt-0.5">${escapeHtml(value)}</p>
    </div>
  `;
}

async function openMatchDetail(match, team) {
  const modal = document.getElementById("match-detail-modal");
  const body = document.getElementById("match-detail-body");
  const perspective = teamMatchPerspective(match, team.name, team.id);
  const completed = isCompletedTeamMatch(match);
  const scorecardId = perspective.scorecardId;

  document.getElementById("match-detail-date").textContent =
    completed ? "Completed Team Match" : "Team Match";

  document.getElementById("match-detail-title").textContent =
    `${perspective.home || team.name || "Home Team"} vs ${perspective.away || perspective.opponent}`;

  modal.classList.remove("hidden");
  modal.classList.add("flex");

  body.innerHTML = `
    <div class="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 md:p-5 mb-4">
      <div class="grid grid-cols-[1fr_auto_1fr] gap-3 items-center text-center">
        <div class="min-w-0 flex flex-col items-center">
          ${teamLogoMarkup(perspective.homeLogo, perspective.home, "w-14 h-14")}
          <p class="text-xs uppercase tracking-wide font-semibold text-gray-400 mt-2">Home</p>
          <p class="font-bold text-gray-900 mt-1 truncate w-full">${escapeHtml(perspective.home || "Home Team")}</p>
        </div>

        <div>
          <p class="text-xs uppercase tracking-wide font-semibold text-gray-400">${completed ? "Final" : "Match"}</p>
          <p class="text-2xl font-black text-indigo-700 mt-1">${escapeHtml(perspective.score || "vs")}</p>
        </div>

        <div class="min-w-0 flex flex-col items-center">
          ${teamLogoMarkup(perspective.awayLogo, perspective.away, "w-14 h-14")}
          <p class="text-xs uppercase tracking-wide font-semibold text-gray-400 mt-2">Away</p>
          <p class="font-bold text-gray-900 mt-1 truncate w-full">${escapeHtml(perspective.away || "Away Team")}</p>
        </div>
      </div>

      ${perspective.resultLabel
        ? `<div class="mt-3 text-center">
             <span class="inline-flex rounded-full ${perspective.resultLabel === "Win" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"} px-3 py-1 text-xs font-bold">
               ${escapeHtml(team.name)}: ${escapeHtml(perspective.resultLabel)}
             </span>
           </div>`
        : ""}
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
      ${matchDetailMetric("Date", formatMatchDate(perspective.date))}
      ${matchDetailMetric("Time", perspective.matchTime || "N/A")}
      ${matchDetailMetric("Venue", perspective.venue || "N/A")}
      ${matchDetailMetric("Event", perspective.event || "N/A")}
    </div>

    <div>
      <div class="flex items-center justify-between mb-3">
        <div>
          <h3 class="font-semibold text-gray-900">Individual Matches</h3>
          <p class="text-xs text-gray-400 mt-0.5">
            ${completed && scorecardId
              ? "Loading the full team scorecard…"
              : completed
                ? "This result does not include a scorecard ID."
                : "Individual court results will appear once the score is entered."}
          </p>
        </div>
      </div>

      <div id="team-scorecard-matches" class="grid gap-2">
        ${completed && scorecardId
          ? `<div class="py-8 text-center">
               <svg class="animate-spin h-6 w-6 text-indigo-500 mx-auto mb-2"
                    xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                 <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
                 <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
               </svg>
               <p class="text-sm text-gray-400">Loading scorecard…</p>
             </div>`
          : `<div class="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-5 text-center">
               <p class="text-sm font-semibold text-gray-600">${completed ? "Scorecard unavailable" : "Match not played yet"}</p>
             </div>`}
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();

  if (!completed || !scorecardId) return;

  const scorecardContainer = document.getElementById("team-scorecard-matches");

  try {
    const rows = await fetchTeamScorecard(scorecardId);

    if (!rows.length) {
      scorecardContainer.innerHTML = `
        <div class="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-5 text-center">
          <p class="text-sm font-semibold text-gray-600">No individual matches found</p>
          <p class="text-xs text-gray-400 mt-1">The scorecard endpoint returned no court results.</p>
        </div>
      `;
      return;
    }

    // Scorecard rows repeat the authoritative team names and final score.
    const scorecardTeamResult = firstValue(rows[0], ["matchResult", "MatchResult"], "");
    const scorecardHomeName = firstValue(rows[0], ["teamHomeName", "TeamHomeName"], "");
    const scorecardVisitingName = firstValue(rows[0], ["teamVisitingName", "TeamVisitingName"], "");

    if (scorecardTeamResult) {
      const headlineScore = body.querySelector(".text-2xl.font-black.text-indigo-700");
      if (headlineScore) headlineScore.textContent = scorecardTeamResult;
    }

    if (scorecardHomeName || scorecardVisitingName) {
      document.getElementById("match-detail-title").textContent =
        `${scorecardHomeName || perspective.home || "Home Team"} vs ${scorecardVisitingName || perspective.away || "Visiting Team"}`;

      const teamHeadings = body.querySelectorAll(".rounded-2xl.border.border-indigo-100 p.font-bold");
      if (teamHeadings.length >= 2) {
        if (scorecardHomeName) teamHeadings[0].textContent = scorecardHomeName;
        if (scorecardVisitingName) teamHeadings[1].textContent = scorecardVisitingName;
      }
    }

    scorecardContainer.innerHTML = rows.map(individualCourtMarkup).join("");
    hydratePlayerProfileImages(scorecardContainer);

    scorecardContainer.querySelectorAll("[data-individual-match-id]").forEach(button => {
      button.addEventListener("click", () => {
        const matchId = button.dataset.individualMatchId;
        const row = rows.find(item => String(getMatchId(item)) === String(matchId));

        if (row) {
          openIndividualMatchInsights(row);
        }
      });
    });

    if (window.lucide) lucide.createIcons();
  } catch (error) {
    console.error("Failed to load team scorecard:", error);
    scorecardContainer.innerHTML = `
      <div class="rounded-xl border border-red-100 bg-red-50/60 p-5 text-center">
        <p class="text-sm font-semibold text-red-600">Failed to load scorecard</p>
        <p class="text-xs text-red-400 mt-1">${escapeHtml(error.message || "Unknown error")}</p>
      </div>
    `;
  }
}

function closeMatchDetail() {
  closeIndividualMatchInsights();

  const modal = document.getElementById("match-detail-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}


async function ensureMatchInsightsChartJs() {
  if (window.Chart) return window.Chart;
  if (chartJsLoadPromise) return chartJsLoadPromise;

  chartJsLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-college-chartjs="true"]');

    if (existing) {
      existing.addEventListener("load", () => resolve(window.Chart));
      existing.addEventListener("error", () => reject(new Error("Chart.js failed to load")));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";
    script.async = true;
    script.dataset.collegeChartjs = "true";
    script.onload = () => resolve(window.Chart);
    script.onerror = () => reject(new Error("Chart.js failed to load"));
    document.head.appendChild(script);
  });

  return chartJsLoadPromise;
}

function ensureMatchInsightsStyles() {
  if (document.getElementById("college-match-insights-styles")) return;

  const style = document.createElement("style");
  style.id = "college-match-insights-styles";
  style.textContent = `
    #individual-insights-body .mi-tab-nav {
      display: flex;
      gap: .5rem;
      overflow-x: auto;
      padding-bottom: .25rem;
      scrollbar-width: thin;
    }
    #individual-insights-body .mi-tab-btn {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      gap: .4rem;
      padding: .6rem .85rem;
      border: 1px solid #e5e7eb;
      border-radius: .8rem;
      background: white;
      color: #6b7280;
      font-size: .8rem;
      font-weight: 700;
      transition: all .16s ease;
    }
    #individual-insights-body .mi-tab-btn:hover {
      border-color: #c7d2fe;
      color: #4f46e5;
      background: #eef2ff;
    }
    #individual-insights-body .mi-tab-btn.mi-active {
      border-color: #4f46e5;
      background: #4f46e5;
      color: white;
    }
    #individual-insights-body .mi-tab-icon {
      width: 1rem;
      height: 1rem;
      display: inline-flex;
    }
    #individual-insights-body .mi-tab-icon svg,
    #individual-insights-body .mi-stat-icon svg {
      width: 100%;
      height: 100%;
    }
    #individual-insights-body .mi-score-card {
      border: 1px solid #e0e7ff;
      border-radius: 1rem;
      background: rgba(238,242,255,.72);
      padding: 1rem;
    }
    #individual-insights-body .mi-player-pill {
      display: inline-flex;
      align-items: center;
      max-width: 12rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      border: 1px solid #e5e7eb;
      border-radius: 9999px;
      padding: .3rem .65rem;
      background: white;
      color: #374151;
      font-size: .8rem;
    }
    #individual-insights-body .mi-stat-card {
      min-width: 7.4rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: .4rem;
      padding: .75rem;
      border: 1px solid #e5e7eb;
      border-radius: .9rem;
      background: white;
      text-align: center;
    }

    #individual-insights-body .mi-stat-card > .min-w-0 {
      width: 100%;
      text-align: center;
    }
    #individual-insights-body .mi-stat-icon {
      width: 1.8rem;
      height: 1.8rem;
      padding: .4rem;
      border-radius: .6rem;
      background: #eef2ff;
      color: #4f46e5;
      flex: 0 0 auto;
    }
    #individual-insights-body .mi-stat-label {
      text-align: center;
      color: #9ca3af;
      font-size: .65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .045em;
    }
    #individual-insights-body .mi-stat-value {
      width: 100%;
      text-align: center;
      color: #111827;
      font-size: .9rem;
      font-weight: 800;
      margin-top: .1rem;
    }
    #individual-insights-body .mi-chart-wrap {
      position: relative;
      min-height: 250px;
      height: 290px;
    }
    #individual-insights-body .mi-skeleton {
      position: relative;
      overflow: hidden;
      background: #eef0f3;
      border-radius: .7rem;
    }
    #individual-insights-body .mi-skeleton::after {
      content: "";
      position: absolute;
      inset: 0;
      transform: translateX(-100%);
      background: linear-gradient(90deg, transparent, rgba(255,255,255,.7), transparent);
      animation: collegeMiShimmer 1.4s infinite;
    }
    #individual-insights-body .mi-lock-circle {
      width: 64px;
      height: 64px;
      border-radius: 9999px;
      margin-left: auto;
      margin-right: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(79,70,229,.1);
      color: #4f46e5;
    }
    #individual-insights-body .mi-lock-circle svg {
      width: 26px;
      height: 26px;
    }
    #individual-insights-body .mi-shake {
      animation: collegeMiShake .3s linear;
    }
    @keyframes collegeMiShimmer {
      100% { transform: translateX(100%); }
    }
    @keyframes collegeMiShake {
      0%,100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }
    @media (max-width: 639px) {
      #individual-insights-body .mi-chart-wrap {
        min-height: 230px;
        height: 250px;
      }
      #individual-insights-body .mi-stat-card {
        min-width: calc(50% - .4rem);
        flex: 1 1 calc(50% - .4rem);
      }
      #individual-insights-body .mi-player-pill {
        max-width: 8rem;
      }
    }
  `;
  document.head.appendChild(style);
}

const MI_ICONS = {
    activity: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
    x: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    grid: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>',
    clock: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    zap: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>',
    flame: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
    trophy: '<svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
    lock: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    alertCircle: '<svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>'
};

function formatDurationSec(totalSeconds) {
    if (isNaN(totalSeconds) || totalSeconds <= 0) return "N/A";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.round(totalSeconds % 60);
    const pad = (num) => num.toString().padStart(2, '0');
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

function renderInsightsLoadingSkeleton() {
    return `
        <div class="py-6">
            <div class="mi-skeleton h-6 w-40 mx-auto mb-4"></div>
            <div class="flex justify-center gap-3 mb-6 flex-wrap">
                <div class="mi-skeleton h-14 w-32 rounded-xl"></div>
                <div class="mi-skeleton h-14 w-32 rounded-xl"></div>
                <div class="mi-skeleton h-14 w-32 rounded-xl"></div>
                <div class="mi-skeleton h-14 w-32 rounded-xl"></div>
            </div>
            <div class="mi-skeleton h-56 w-full max-w-xl mx-auto"></div>
        </div>
    `;
}


async function fetchMatchInsightsData(match) {
  const matchId = match.Matchid || match.matchId;

  if (!matchId) return null;

  const key = String(matchId);
  if (matchInsightsCache.has(key)) {
    return matchInsightsCache.get(key);
  }

  const request = (async () => {
    try {
      const response = await fetch(
        `/proxy/liveScoreDetails?match_id=${encodeURIComponent(key)}`,
        { method: "GET", credentials: "include" }
      );

      if (!response.ok) throw new Error(`Live score HTTP ${response.status}`);

      const data = await response.json();
      if (!Array.isArray(data) || data.length < 2) return null;

      const allPoints = data
        .filter(evt => evt.Decision === "point")
        .sort((a, b) => new Date(a.StartDate) - new Date(b.StartDate));

      if (allPoints.length < 2) return null;

      const gameMap = {};
      allPoints.forEach(evt => {
        if (!gameMap[evt.Game_Number]) gameMap[evt.Game_Number] = [];
        gameMap[evt.Game_Number].push(evt);
      });

      const uniqueGames = Object.keys(gameMap)
        .map(game => parseInt(game, 10))
        .sort((a, b) => a - b);

      return { allPoints, gameMap, uniqueGames };
    } catch (error) {
      console.warn(`Unable to load Match Insights for match ${key}:`, error);
      return null;
    }
  })();

  matchInsightsCache.set(key, request);
  const result = await request;
  matchInsightsCache.set(key, result);
  return result;
}

function renderAccessCodeGate(match, insightsData, metricsContainer, matchInsightsTitle) {
  metricsContainer.innerHTML = `
    <div id="code-input-area" class="text-center py-8 px-4">
      <div class="mi-lock-circle mb-4">${MI_ICONS.lock}</div>
      <h3 class="text-lg font-semibold text-gray-800 mb-1.5">Match Insights are locked</h3>
      <p class="mb-1 text-sm text-gray-500 max-w-xs mx-auto">Enter the access code to view detailed stats, game-by-game score progression, and more.</p>
      <p class="mb-5 text-sm text-gray-500">Need a code? Message <a href="tel:${CONTACT_PHONE_NUMBER}" class="text-indigo-600 font-medium hover:underline">${CONTACT_PHONE_NUMBER}</a></p>
      <div class="flex items-center justify-center gap-2 flex-wrap">
        <input type="password" id="access-code-input" class="border border-gray-300 rounded-lg px-3 py-2.5 text-center text-lg tracking-widest w-40 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="••••" autocomplete="off">
        <button id="submit-code-btn" class="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">Unlock</button>
      </div>
      <p id="code-error-message" class="flex items-center justify-center gap-1.5 text-red-500 text-sm mt-3 hidden">${MI_ICONS.alertCircle}<span>Incorrect code. Please try again.</span></p>
    </div>
  `;

  const accessCodeInput = metricsContainer.querySelector("#access-code-input");
  const submitCodeBtn = metricsContainer.querySelector("#submit-code-btn");
  const codeErrorMessage = metricsContainer.querySelector("#code-error-message");
  const codeInputArea = metricsContainer.querySelector("#code-input-area");

  const handleCodeSubmission = () => {
    if (accessCodeInput.value === MATCH_INSIGHTS_ACCESS_CODE) {
      sessionStorage.setItem(SESSION_STORAGE_KEY_MATCH_INSIGHTS, "true");
      if (matchInsightsTitle) matchInsightsTitle.textContent = "Match Insights";
      renderMatchInsights(match, insightsData, metricsContainer);
    } else {
      if (codeErrorMessage) codeErrorMessage.classList.remove("hidden");
      if (codeInputArea) {
        codeInputArea.classList.remove("mi-shake");
        void codeInputArea.offsetWidth;
        codeInputArea.classList.add("mi-shake");
      }
      accessCodeInput.value = "";
      accessCodeInput.focus();
    }
  };

  submitCodeBtn.addEventListener("click", handleCodeSubmission);
  accessCodeInput.addEventListener("keypress", event => {
    if (event.key === "Enter") handleCodeSubmission();
  });
  accessCodeInput.focus();
}

function renderMatchInsights(match, insightsData, container) {
    const { allPoints, gameMap, uniqueGames } = insightsData;
    const homePlayerName = match.playerHome1Name || match.hplayer1 || "Home Player";
    const visitingPlayerName = match.playerVisiting1Name || match.vplayer1 || "Visiting Player";

    container.innerHTML = `<div id="tab-nav" class="mi-tab-nav mb-4"></div><div id="tab-content" class="px-1 pb-2"></div>`;
    const tabNav = container.querySelector("#tab-nav");
    const tabContent = container.querySelector("#tab-content");

    function makeStatCard(icon, label, value) {
        return `
            <div class="mi-stat-card">
                <div class="mi-stat-icon">${icon}</div>
                <div class="min-w-0">
                    <div class="mi-stat-label">${label}</div>
                    <div class="mi-stat-value truncate">${value}</div>
                </div>
            </div>`;
    }

    // --- Overview Tab Setup ---
    const overviewTabBtn = document.createElement("button");
    overviewTabBtn.innerHTML = `<span class="mi-tab-icon">${MI_ICONS.grid}</span>Overview`;
    overviewTabBtn.className = "mi-tab-btn";
    tabNav.appendChild(overviewTabBtn);

    const overviewContent = document.createElement("div");
    overviewContent.className = "tab-content-pane";
    overviewContent.style.display = "block";
    tabContent.appendChild(overviewContent);

    
    

    // --- Overview Calculations ---
    let homeGamesWon = 0, visitingGamesWon = 0;
    const homeGameScores = [], visitingGameScores = [], gameLabels = [];
    const gameLengthsSec = [];
    uniqueGames.forEach(gameNum => {
        const eventsInGame = gameMap[gameNum].sort((a, b) => new Date(a.StartDate) - new Date(b.StartDate));
        const finalLeft = eventsInGame[eventsInGame.length - 1].Points_left;
        const finalRight = eventsInGame[eventsInGame.length - 1].Points_right;
        gameLabels.push(`Game ${gameNum}`);
        homeGameScores.push(finalLeft);
        visitingGameScores.push(finalRight);
        if (finalLeft > finalRight) homeGamesWon++; else visitingGamesWon++;
        gameLengthsSec.push((new Date(eventsInGame[eventsInGame.length-1].StartDate) - new Date(eventsInGame[0].StartDate)) / 1000);
    });

    const matchLengthSec = (new Date(allPoints[allPoints.length - 1].StartDate) - new Date(allPoints[0].StartDate)) / 1000;
    let longestPointSec = 0;
    const pointDurations = [];
    for(let i = 1; i < allPoints.length; i++) {
        const diffSec = (new Date(allPoints[i].StartDate) - new Date(allPoints[i-1].StartDate)) / 1000;
        if(diffSec > 0 && diffSec < 150) {
            pointDurations.push(diffSec);
            if(diffSec > longestPointSec) longestPointSec = diffSec;
        }
    }
    const averagePointSec = pointDurations.length > 0 ? pointDurations.reduce((a, b) => a + b, 0) / pointDurations.length : 0;
    const averageGameSec = gameLengthsSec.length > 0 ? gameLengthsSec.reduce((a, b) => a + b, 0) / gameLengthsSec.length : 0;

    // --- Render Overview Content ---
    overviewContent.innerHTML = `
        <div class="mi-score-card mb-4 text-center">
            <div class="flex items-center justify-center gap-2 mb-1 text-indigo-500">${MI_ICONS.trophy}<span class="text-xs font-semibold uppercase tracking-wide">Match Score</span></div>
            <p class="text-xl sm:text-2xl font-bold flex items-center justify-center gap-2 flex-wrap">
                <span class="mi-player-pill">${homePlayerName}</span>
                <span class="text-red-500">${homeGamesWon}</span>
                <span class="text-gray-300">–</span>
                <span class="text-blue-500">${visitingGamesWon}</span>
                <span class="mi-player-pill">${visitingPlayerName}</span>
            </p>
        </div>
        <div class="flex justify-center gap-3 mb-6 flex-wrap">
            ${makeStatCard(MI_ICONS.clock, "Match Length", formatDurationSec(matchLengthSec))}
            ${makeStatCard(MI_ICONS.zap, "Avg Point", formatDurationSec(averagePointSec))}
            ${makeStatCard(MI_ICONS.flame, "Longest Point", formatDurationSec(longestPointSec))}
            ${makeStatCard(MI_ICONS.clock, "Avg Game", formatDurationSec(averageGameSec))}
        </div>
        <div class="max-w-xl mx-auto mi-chart-wrap"><canvas id="game-scores-bar-chart"></canvas></div>
    `;

    new Chart(document.getElementById('game-scores-bar-chart').getContext('2d'), {
        type: 'bar',
        data: { labels: gameLabels, datasets: [{ label: homePlayerName, data: homeGameScores, backgroundColor: 'rgba(239, 68, 68, 0.8)', borderRadius: 6 }, { label: visitingPlayerName, data: visitingGameScores, backgroundColor: 'rgba(99, 102, 241, 0.8)', borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Game Scores' } } }
    });

    // --- Create Game Tabs ---
    uniqueGames.forEach(gameNum => {
        const gameTabBtn = document.createElement("button");
        gameTabBtn.innerHTML = `<span class="mi-tab-icon">${MI_ICONS.activity}</span>Game ${gameNum}`;
        gameTabBtn.className = "mi-tab-btn";
        tabNav.appendChild(gameTabBtn);
        const gameContent = document.createElement("div");
        gameContent.className = "tab-content-pane";
        gameContent.style.display = "none";
        tabContent.appendChild(gameContent);
        const pointsGame = gameMap[gameNum].sort((a, b) => new Date(a.StartDate) - new Date(b.StartDate));

        // --- Per-Game Stats (mirrors script.js game tab) ---
        const MAX_POINT_DURATION_SEC = 120; // 2 minutes
        const finalLeft = pointsGame[pointsGame.length - 1].Points_left;
        const finalRight = pointsGame[pointsGame.length - 1].Points_right;
        const start = new Date(pointsGame[0].StartDate);
        const end = new Date(pointsGame[pointsGame.length - 1].StartDate);
        const gameLengthSec = (end - start) / 1000;

        const intervals = [];
        let longestPointSecGame = 0;
        for (let i = 1; i < pointsGame.length; i++) {
            const diffSec = (new Date(pointsGame[i].StartDate) - new Date(pointsGame[i - 1].StartDate)) / 1000;
            if (diffSec <= MAX_POINT_DURATION_SEC) {
                intervals.push(diffSec);
                if (diffSec > longestPointSecGame) longestPointSecGame = diffSec;
            }
        }
        const avgPointSecGame = intervals.length ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;

        gameContent.innerHTML = `
            <div class="mi-score-card mb-4 text-center">
                <div class="text-xs font-semibold uppercase tracking-wide text-indigo-500 mb-1">Final Score · Game ${gameNum}</div>
                <p class="text-xl font-bold mb-3"><span class="text-red-500">${homePlayerName}</span> ${finalLeft} &ndash; ${finalRight} <span class="text-blue-500">${visitingPlayerName}</span></p>
                <div class="flex justify-center gap-3 flex-wrap">
                    ${makeStatCard(MI_ICONS.clock, "Game Length", formatDurationSec(gameLengthSec))}
                    ${makeStatCard(MI_ICONS.zap, "Avg Point", formatDurationSec(avgPointSecGame))}
                    ${makeStatCard(MI_ICONS.flame, "Longest Point", formatDurationSec(longestPointSecGame))}
                </div>
            </div>
            <div class="mi-chart-wrap"><canvas id="game-chart-${gameNum}"></canvas></div>
        `;

        const x = pointsGame.map(evt => evt.Points_left + evt.Points_right);
        const p1_scores = pointsGame.map(evt => evt.Points_left);
        const p2_scores = pointsGame.map(evt => evt.Points_right);
        const lineCanvas = gameContent.querySelector(`#game-chart-${gameNum}`);
        lineCanvas.style.maxWidth = "100%";

        new Chart(lineCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: x,
                datasets: [
                    { label: homePlayerName, data: p1_scores, borderColor: 'rgb(239, 68, 68)', backgroundColor: 'rgba(239, 68, 68, 0.2)', fill: true, tension: 0.3, pointStyle: 'circle', pointRadius: 5, pointHoverRadius: 7, borderWidth: 2 },
                    { label: visitingPlayerName, data: p2_scores, borderColor: 'rgb(99, 102, 241)', backgroundColor: 'rgba(99, 102, 241, 0.2)', fill: true, tension: 0.3, pointStyle: 'circle', pointRadius: 5, pointHoverRadius: 7, borderWidth: 2 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'top', labels: { color: '#333' } },
                    title: { display: true, text: `Game ${gameNum} Score Progression`, color: '#333', font: { size: 16 } }
                },
                scales: {
                    x: { type: 'linear', title: { display: true, text: 'Total Points Played in Game', color: '#333' }, ticks: { stepSize: 1, color: '#333' }, grid: { color: 'rgba(0,0,0,0.1)', drawBorder: false } },
                    y: { beginAtZero: true, title: { display: true, text: 'Score', color: '#333' }, ticks: { color: '#333' }, grid: { color: 'rgba(0,0,0,0.1)', drawBorder: false } }
                }
            }
        });
        
        gameTabBtn.addEventListener("click", () => {
            tabContent.querySelectorAll(".tab-content-pane").forEach(p => p.style.display = "none");
            tabNav.querySelectorAll(".mi-tab-btn").forEach(b => b.classList.remove("mi-active"));
            gameContent.style.display = "block";
            gameTabBtn.classList.add("mi-active");
        });
    });

    overviewTabBtn.addEventListener("click", () => {
        tabContent.querySelectorAll(".tab-content-pane").forEach(p => p.style.display = "none");
        tabNav.querySelectorAll(".mi-tab-btn").forEach(b => b.classList.remove("mi-active"));
        overviewContent.style.display = "block";
        overviewTabBtn.classList.add("mi-active");
    });
    overviewTabBtn.click();
}


async function openIndividualMatchInsights(matchRow) {
  const modal = document.getElementById("individual-insights-modal");
  const body = document.getElementById("individual-insights-body");
  const title = document.getElementById("individual-insights-title");
  const positionLabel = document.getElementById("individual-insights-position");

  const matchId = getMatchId(matchRow);
  const position = firstValue(matchRow, [
    "positionPlayed", "positionNumber", "PositionPlayed", "Position"
  ], "Match");

  const homeName = firstValue(matchRow, [
    "playerHome1Name", "HomePlayerName", "hplayer1"
  ], "Home Player");

  const awayName = firstValue(matchRow, [
    "playerVisiting1Name", "VisitingPlayerName", "vplayer1"
  ], "Visiting Player");

  positionLabel.textContent = `${position} · Match Insights`;
  title.textContent = `${homeName} vs ${awayName}`;

  modal.classList.remove("hidden");
  modal.classList.add("flex");

  ensureMatchInsightsStyles();
  body.innerHTML = renderInsightsLoadingSkeleton();

  if (!matchId) {
    body.innerHTML = `
      <div class="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
        <p class="text-sm font-semibold text-gray-700">No Match ID available</p>
      </div>
    `;
    return;
  }

  try {
    const [, insightsData] = await Promise.all([
      ensureMatchInsightsChartJs(),
      fetchMatchInsightsData({
        ...matchRow,
        Matchid: matchId,
        matchId,
        hplayer1: homeName,
        vplayer1: awayName
      })
    ]);

    if (!insightsData) {
      body.innerHTML = `
        <div class="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
          <p class="text-sm font-semibold text-gray-700">No Match Insights available</p>
          <p class="text-xs text-gray-400 mt-1">This match does not currently have usable point-by-point scoring data.</p>
        </div>
      `;
      return;
    }

    const matchForInsights = {
      ...matchRow,
      Matchid: matchId,
      matchId,
      hplayer1: homeName,
      vplayer1: awayName,
      playerHome1Name: homeName,
      playerVisiting1Name: awayName
    };

    if (sessionStorage.getItem(SESSION_STORAGE_KEY_MATCH_INSIGHTS) === "true") {
      renderMatchInsights(matchForInsights, insightsData, body);
    } else {
      renderAccessCodeGate(matchForInsights, insightsData, body, title);
    }
  } catch (error) {
    console.error("Match Insights failed:", error);
    body.innerHTML = `
      <div class="rounded-xl border border-red-100 bg-red-50/60 p-6 text-center">
        <p class="text-sm font-semibold text-red-600">Could not load Match Insights</p>
        <p class="text-xs text-red-400 mt-1">${escapeHtml(error.message || "Unknown error")}</p>
      </div>
    `;
  }

  if (window.lucide) lucide.createIcons();
}


function closeIndividualMatchInsights() {
  const modal = document.getElementById("individual-insights-modal");
  if (!modal) return;

  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function setTeamDetailTab(tabName) {
  document.querySelectorAll(".team-detail-panel").forEach(panel => {
    panel.classList.add("hidden");
  });

  document.querySelectorAll(".team-detail-tab").forEach(button => {
    const active = button.dataset.teamTab === tabName;

    button.classList.toggle("bg-white", active);
    button.classList.toggle("shadow-sm", active);
    button.classList.toggle("text-indigo-600", active);
    button.classList.toggle("text-gray-500", !active);
  });

  const panel = document.getElementById(`team-panel-${tabName}`);
  if (panel) panel.classList.remove("hidden");
}

async function openTeamModal(teamId) {
  const team = findTeamById(teamId);
  if (!team) return;

  const modal = document.getElementById("team-modal");
  const logoWrap = document.getElementById("team-modal-logo-wrap");

  modal.classList.remove("hidden");
  modal.classList.add("flex");
  document.body.classList.add("overflow-hidden");

  document.getElementById("team-modal-name").textContent = team.name;
  document.getElementById("team-modal-division").textContent =
    `${divisionMeta(team.divisionId).name} · Rank #${team.rank}`;

  if (team.logo) {
    logoWrap.innerHTML = `
      <img src="${escapeHtml(team.logo)}"
           alt="${escapeHtml(team.name)}"
           class="w-full h-full object-cover" />
    `;
  } else {
    logoWrap.innerHTML = DEFAULT_TEAM_ICON;
  }

  document.getElementById("team-modal-metrics").innerHTML = [
    modalMetric("Rank", `#${team.rank}`, true),
    modalMetric("Team Record", recordText(team.teamWins, team.teamLosses)),
    modalMetric("Individual", recordText(team.individualWins, team.individualLosses)),
    modalMetric("Win Rate", pctText(team.winPct))
  ].join("");

  const rosterContainer = document.getElementById("team-modal-roster");
  const resultsContainer = document.getElementById("team-modal-results");
  const upcomingContainer = document.getElementById("team-modal-upcoming");

  rosterContainer.innerHTML = `<p class="text-sm text-gray-400 py-4">Loading roster…</p>`;
  resultsContainer.innerHTML = `<p class="text-sm text-gray-400 py-4">Loading results…</p>`;
  upcomingContainer.innerHTML = `<p class="text-sm text-gray-400 py-4">Loading schedule…</p>`;
  document.getElementById("roster-count").textContent = "";
  document.getElementById("results-count").textContent = "";
  document.getElementById("upcoming-count").textContent = "";
  setTeamDetailTab("roster");

  if (window.lucide) lucide.createIcons();

  const [rosterResult, scheduleResult] = await Promise.allSettled([
    fetchRoster(teamId),
    fetchSchedule(teamId)
  ]);

  if (rosterResult.status === "fulfilled") {
    const roster = rosterResult.value;
    document.getElementById("roster-count").textContent = `(${roster.length})`;

    if (!roster.length) {
      rosterContainer.innerHTML = `<p class="text-sm text-gray-400 py-4">No roster available.</p>`;
    } else {
      const ordered = [...roster].sort((a, b) => {
        const positionDifference = lineupSortPosition(a) - lineupSortPosition(b);
        if (positionDifference !== 0) return positionDifference;

        const ra = Number.isFinite(a.rating) ? a.rating : -Infinity;
        const rb = Number.isFinite(b.rating) ? b.rating : -Infinity;
        return rb - ra;
      });

      rosterContainer.innerHTML = ordered.map(rosterPlayerMarkup).join("");
      hydratePlayerProfileImages(rosterContainer);

      rosterContainer.querySelectorAll("[data-player-id]").forEach(button => {
        button.addEventListener("click", () => {
          const playerId = button.dataset.playerId;
          if (playerId && playerId !== "null") {
            window.location.href = `/dashboard?userId=${encodeURIComponent(playerId)}`;
          }
        });
      });
    }
  } else {
    rosterContainer.innerHTML = `<p class="text-sm text-red-500 py-4">Failed to load roster.</p>`;
  }

  if (scheduleResult.status === "fulfilled") {
    const matches = scheduleResult.value.slice(0, 100);
    const completedMatches = [];
    const upcomingMatches = [];

    matches.forEach((match, sourceIndex) => {
      const item = { match, sourceIndex };

      if (isCompletedTeamMatch(match)) completedMatches.push(item);
      else upcomingMatches.push(item);
    });

    // Most recent completed matches first.
    completedMatches.sort((a, b) => {
      const dateA = parseMatchDate(firstValue(a.match, ["matchdate", "MatchDate", "matchDate", "Date", "date"], ""))?.getTime() || 0;
      const dateB = parseMatchDate(firstValue(b.match, ["matchdate", "MatchDate", "matchDate", "Date", "date"], ""))?.getTime() || 0;
      return dateB - dateA;
    });

    // Soonest upcoming matches first.
    upcomingMatches.sort((a, b) => {
      const dateA = parseMatchDate(firstValue(a.match, ["matchdate", "MatchDate", "matchDate", "Date", "date"], ""))?.getTime() || Number.MAX_SAFE_INTEGER;
      const dateB = parseMatchDate(firstValue(b.match, ["matchdate", "MatchDate", "matchDate", "Date", "date"], ""))?.getTime() || Number.MAX_SAFE_INTEGER;
      return dateA - dateB;
    });

    document.getElementById("results-count").textContent = `(${completedMatches.length})`;
    document.getElementById("upcoming-count").textContent = `(${upcomingMatches.length})`;

    resultsContainer.innerHTML = completedMatches.length
      ? completedMatches.map(item =>
          teamMatchCardMarkup(item.match, team, item.sourceIndex, true)
        ).join("")
      : `<p class="text-sm text-gray-400 py-5 text-center md:col-span-2">No completed results available.</p>`;

    upcomingContainer.innerHTML = upcomingMatches.length
      ? upcomingMatches.map(item =>
          teamMatchCardMarkup(item.match, team, item.sourceIndex, false)
        ).join("")
      : `<p class="text-sm font-medium text-gray-500 py-2">None</p>`;

    [resultsContainer, upcomingContainer].forEach(container => {
      container.querySelectorAll("[data-team-match-index]").forEach(button => {
        button.addEventListener("click", () => {
          const sourceIndex = Number(button.dataset.teamMatchIndex);
          const selectedMatch = matches[sourceIndex];

          if (selectedMatch) {
            openMatchDetail(selectedMatch, team);
          }
        });
      });
    });
  } else {
    document.getElementById("results-count").textContent = "(0)";
    document.getElementById("upcoming-count").textContent = "(0)";
    resultsContainer.innerHTML = `<p class="text-sm text-red-500 py-4">Failed to load match results.</p>`;
    upcomingContainer.innerHTML = `<p class="text-sm text-red-500 py-4">Failed to load schedule.</p>`;
  }

  if (window.lucide) lucide.createIcons();
}

function closeTeamModal() {
  closeMatchDetail();

  const modal = document.getElementById("team-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  document.body.classList.remove("overflow-hidden");
}

function wireEvents() {
  document.getElementById("view-standings-btn").addEventListener("click", () => {
    setView("standings");
  });

  document.getElementById("view-compare-btn").addEventListener("click", () => {
    setView("compare");
  });

  document.querySelectorAll(".division-chip").forEach(button => {
    button.addEventListener("click", () => {
      selectedDivisionId = Number(button.dataset.division);
      document.getElementById("team-search").value = "";
      renderSelectedDivision();
    });
  });

  document.getElementById("team-search").addEventListener("input", () => {
    const teams = standingsCache.get(selectedDivisionId) || [];
    renderStandingsList(teams);
  });

  document.getElementById("compare-btn").addEventListener("click", compareSelectedTeams);

  document.getElementById("swap-teams-btn").addEventListener("click", () => {
    const selectA = document.getElementById("compare-team-a");
    const selectB = document.getElementById("compare-team-b");
    const oldA = selectA.value;
    selectA.value = selectB.value;
    selectB.value = oldA;
  });

  document.querySelectorAll(".team-detail-tab").forEach(button => {
    button.addEventListener("click", () => {
      setTeamDetailTab(button.dataset.teamTab);
    });
  });

  document.getElementById("team-modal-close").addEventListener("click", closeTeamModal);

  document.getElementById("team-modal").addEventListener("click", event => {
    if (event.target?.dataset?.teamModalClose === "true") {
      closeTeamModal();
    }
  });

  document.getElementById("match-detail-close").addEventListener("click", closeMatchDetail);

  document.getElementById("match-detail-modal").addEventListener("click", event => {
    if (event.target?.dataset?.matchModalClose === "true") {
      closeMatchDetail();
    }
  });

  document.getElementById("individual-insights-close").addEventListener("click", closeIndividualMatchInsights);

  document.getElementById("individual-insights-modal").addEventListener("click", event => {
    if (event.target?.dataset?.individualInsightsClose === "true") {
      closeIndividualMatchInsights();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;

    const individualInsightsModal = document.getElementById("individual-insights-modal");
    if (individualInsightsModal && !individualInsightsModal.classList.contains("hidden")) {
      closeIndividualMatchInsights();
      return;
    }

    const matchModal = document.getElementById("match-detail-modal");
    if (matchModal && !matchModal.classList.contains("hidden")) {
      closeMatchDetail();
      return;
    }

    closeTeamModal();
  });
}

async function initializeCollegeTeams() {
  const loadingOverlay = document.getElementById("loading-overlay");
  const app = document.getElementById("app");

  try {
    wireEvents();

    // Get the selected division on screen as soon as possible, while the
    // remaining divisions load in parallel for Compare Teams.
    const selectedPromise = fetchStandings(selectedDivisionId);
    const preloadPromise = preloadAllStandings();

    await selectedPromise;
    await renderSelectedDivision();

    // Do not block the initial page on every division, but make sure the
    // dropdowns are populated when preload finishes.
    preloadPromise.then(() => {
      populateCompareDropdowns();
    });

    if (app) app.style.display = "flex";
  } catch (error) {
    console.error("College teams initialization failed:", error);
    if (app) app.style.display = "flex";
    document.getElementById("standings-list").innerHTML = `
      <div class="py-12 text-center">
        <p class="font-semibold text-red-500">College team data could not be loaded.</p>
        <p class="text-sm text-gray-400 mt-1">Check the standings proxy endpoints.</p>
      </div>
    `;
  } finally {
    if (loadingOverlay) {
      loadingOverlay.style.opacity = "0";
      setTimeout(() => {
        loadingOverlay.style.display = "none";
      }, 300);
    }

    if (window.lucide) lucide.createIcons();
  }
}

document.addEventListener("DOMContentLoaded", initializeCollegeTeams);