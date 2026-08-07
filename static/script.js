// Global userId - Set to Matthew Majewski's ID (435642) for testing with your provided API sample.
// Change this back to 328331 if you are using Gabe Solonsky's data.
let userId = 170053; // Make this mutable with 'let'

// Define RATING_TIERS globally for consistency
const RATING_TIERS = [
  { name: 'Beginner', min: 0, max: 3.5 },
  { name: 'Intermediate', min: 3.5, max: 4.5 },
  { name: 'Advanced', min: 4.5, max: 5.5 },
  { name: 'Semi-pro', min: 5.5, max: 6.5 },
  { name: 'Pro', min: 6.5, max: Infinity }
];

// Holds the current ApexCharts instance for the "Rating Over Time" chart so the reset-zoom button can control it
let ratingChartInstance = null;

// Global variables for match loading
let currentPageForMatches = 1;
let hasMoreMatches = true;
let matchesLoadingInProgress = false;
let currentUserFullName = '';
const loadedMatchIds = new Set();
const MATCH_PAGE_SIZE = 5; // API returns 5 matches per page

// Hardcoded access code for match insights
const MATCH_INSIGHTS_ACCESS_CODE = "0"; // User changed this to "0"
const SESSION_STORAGE_KEY_MATCH_INSIGHTS = 'matchInsightsAccessGranted'; // New session storage key for match insights
const SESSION_STORAGE_KEY_USER_ID = 'lastViewedUserId'; // New session storage key for user ID

// Hardcoded access code for analytics page
const ANALYTICS_ACCESS_CODE = "squash123"; // New access code for analytics

// Hardcoded phone number for contact
const CONTACT_PHONE_NUMBER = "301-347-8710"; // User needs to replace this with their actual phone number

// Toggles the sidebar visibility
function toggleSidebar() {
  document.getElementById("app").classList.toggle("sidebar-collapsed");
}

// Updates the progress bar and text based on current rating
function updateProgressBar(rating) {
  const tiers = RATING_TIERS;
  let currentTierIndex = tiers.findIndex(tier => rating >= tier.min && rating < tier.max);
  
  if (currentTierIndex === -1) {
      if (rating >= 6.5) { 
          currentTierIndex = tiers.length - 1; 
      } else if (rating < tiers[0].min) { 
          currentTierIndex = 0;
      } else { 
          currentTierIndex = 0;
      }
  }
  const currentTier = tiers[currentTierIndex];

  let progressPercent;
  if (currentTier.max === Infinity) { 
    progressPercent = 100;
  } else {
    progressPercent = ((rating - currentTier.min) / (currentTier.max - currentTier.min)) * 100;
    progressPercent = Math.max(0, Math.min(100, progressPercent));
  }

  const progressBarFill = document.querySelector('.w-full > div.bg-gradient-to-r');
  if (progressBarFill) {
    progressBarFill.style.width = `${progressPercent}%`;
  }

  const progressText = document.querySelector('.text-xs.mt-2.text-neutral-400.italic');
  if (progressText) {
    let nextTierName;
    if (currentTier.max === Infinity) { 
        nextTierName = "Pro (Max)";
    } else {
        const nextTier = tiers[currentTierIndex + 1];
        nextTierName = nextTier ? nextTier.name : "Max Tier"; 
    }
    progressText.textContent = `${progressPercent.toFixed(0)}% towards ${nextTierName}`;
  }
}

// Populates the rating tooltip with tier information
function populateRatingTooltip() {
    const tooltipContentDiv = document.querySelector('#rating-tooltip-content');
    if (!tooltipContentDiv) return;

    let html = '<h4 class="font-bold mb-1">Rating Tiers:</h4>';
    RATING_TIERS.forEach(tier => {
        let range;
        if (tier.max === Infinity) {
            range = `${tier.min.toFixed(1)}+`;
        } else if (tier.min === 0) {
            range = `Up to ${tier.max.toFixed(1)}`;
        }
        else {
            range = `${tier.min.toFixed(1)} - ${tier.max.toFixed(1)}`;
        }
        html += `<p class="text-xs mb-0.5"><strong class="text-indigo-300">${tier.name}:</strong> ${range}</p>`;
    });
    tooltipContentDiv.innerHTML = html;
}

// Fetches and renders user ratings and ranking history chart
async function fetchAndRenderRatings(currentUserId) {
    let highestRatingVal = "N/A";
    let highestRatingDateStr = "";
    let allDivisionRatings = []; 

    try {
        const ratingsTopResponse = await fetch(`/proxy/user/${currentUserId}/ratings-top`);
        if (!ratingsTopResponse.ok) {
            console.warn(`Ratings-Top API HTTP error! status: ${ratingsTopResponse.status}. Attempting to use rankings data instead.`);
        } else {
            const ratingsTopData = await ratingsTopResponse.json();
            if (ratingsTopData && ratingsTopData.length > 0 && typeof ratingsTopData[0].rating === 'number' && !isNaN(ratingsTopData[0].rating)) {
                highestRatingVal = ratingsTopData[0].rating.toFixed(2);
                highestRatingDateStr = new Date(ratingsTopData[0].ratingPeriod).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            } else {
                console.log("No valid data found in ratings-top API. Falling back to rankings API for highest rating.");
            }
        }

        const rankingsResponse = await fetch(`/proxy/user/${currentUserId}/rankings`);
        if (!rankingsResponse.ok) {
            console.warn(`Rankings API HTTP error! status: ${rankingsResponse.status}. Cannot render chart.`);
        } else {
            const rankingsData = await rankingsResponse.json();
            allDivisionRatings = rankingsData
                .filter(entry => entry.DivisionName === "All")
                .map(entry => ({
                    date: entry.RankingPeriod,
                    rating: entry.Rating
                }))
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            if (highestRatingVal === "N/A" && allDivisionRatings.length > 0) {
                let highestEntryFromRankings = allDivisionRatings.reduce((max, entry) => (entry.rating > max.rating ? entry : max), allDivisionRatings[0]);
                highestRatingVal = highestEntryFromRankings.rating.toFixed(2);
                highestRatingDateStr = new Date(highestEntryFromRankings.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            }
        }

        const highestRatingEl = document.getElementById("highest-rating");
        const highestRatingDateEl = document.getElementById("highest-rating-date");
        if (highestRatingEl) highestRatingEl.textContent = highestRatingVal;
        if (highestRatingDateEl) highestRatingDateEl.textContent = highestRatingDateStr ? `(${highestRatingDateStr})` : "";

        const chartContainer = document.querySelector("#chart");
        const resetZoomBtn = document.getElementById('reset-zoom-btn');

        if (allDivisionRatings.length === 0) {
            if (chartContainer) chartContainer.innerHTML = '<p class="text-center text-gray-500 mt-10">No ranking history available.</p>';
            ratingChartInstance = null;
            if (resetZoomBtn) resetZoomBtn.classList.add('hidden');
        } else {
            if (chartContainer) chartContainer.innerHTML = ''; 
            ratingChartInstance = new ApexCharts(chartContainer, {
                series: [{ name: 'Rating', data: allDivisionRatings.map(r => r.rating) }],
                chart: { height: '100%', type: 'area', toolbar: { show: false }, zoom: { enabled: true } }, // Changed height to '100%'
                dataLabels: { enabled: false },
                stroke: { curve: 'smooth' },
                xaxis: {
                    categories: allDivisionRatings.map(r => r.date),
                    type: 'datetime',
                    labels: { rotate: -45, style: { fontSize: '12px' } }
                },
                tooltip: { x: { format: 'MMMM dd, yyyy' } },
                colors: ['#6366f1'],
                fill: {
                    type: "gradient",
                    gradient: { shadeIntensity: 1, opacityFrom: 0.6, opacityTo: 0.1 }
                }
            });
            await ratingChartInstance.render();

            if (resetZoomBtn) {
                resetZoomBtn.classList.remove('hidden');
                if (!resetZoomBtn.dataset.listenerAttached) {
                    resetZoomBtn.addEventListener('click', () => {
                        if (ratingChartInstance) ratingChartInstance.resetSeries(true, true);
                    });
                    resetZoomBtn.dataset.listenerAttached = 'true';
                }
            }
        }

    } catch (error) {
        console.error("Critical error in fetchAndRenderRatings:", error);
        const highestRatingEl = document.getElementById("highest-rating");
        const highestRatingDateEl = document.getElementById("highest-rating-date");
        if (highestRatingEl) highestRatingEl.textContent = "Error";
        if (highestRatingDateEl) highestRatingDateEl.textContent = "";
        const chartEl = document.querySelector("#chart");
        if (chartEl) chartEl.innerHTML = '<p class="text-center text-red-500 mt-10">Error loading ranking history.</p>';
    }
}

// Helper to normalize player names for display (collapse whitespace)
const normalizeName = (name) => {
    if (!name) return '';
    return name.replace(/\s+/g, ' ').trim();
};

// Helper for robust name comparison (case-insensitive, collapsed whitespace)
const normalizeNameForCompare = (name) => normalizeName(name).toLowerCase();

const parseUserId = (userId) => parseInt(userId, 10);

/**
 * Returns whether the user was home or visiting in a match.
 * wid1 = home player ID, oid1 = visiting player ID.
 */
function getUserMatchSide(match, userId, userName) {
    const uid = parseUserId(userId);
    if (match.wid1 === uid) return 'home';
    if (match.oid1 === uid) return 'visiting';

    const normalizedUser = normalizeNameForCompare(userName);
    if (!normalizedUser) return null;

    const isHome = normalizeNameForCompare(match.hplayer1).includes(normalizedUser);
    const isVisiting = normalizeNameForCompare(match.vplayer1).includes(normalizedUser);
    if (isHome && !isVisiting) return 'home';
    if (isVisiting && !isHome) return 'visiting';
    return null;
}

/** Returns true when the user participated in the match as home or visiting player. */
function userParticipatedInMatch(match, userId, userName) {
    return getUserMatchSide(match, userId, userName) !== null;
}

/**
 * Determines whether the user won using the authoritative Winner field:
 * "H" = home won, "V" = visiting won.
 */
function didUserWinMatch(match, userId, userName) {
    const side = getUserMatchSide(match, userId, userName);
    if (!side) return null;
    if (match.Winner === 'H') return side === 'home';
    if (match.Winner === 'V') return side === 'visiting';
    return null;
}

function getOpponentDisplayName(match, userId, userName) {
    const side = getUserMatchSide(match, userId, userName);
    if (side === 'home') return normalizeName(match.vplayer1) || 'Opponent';
    if (side === 'visiting') return normalizeName(match.hplayer1) || 'Opponent';
    return 'Opponent';
}

function getOpponentPlayerId(match, userId, userName) {
    const side = getUserMatchSide(match, userId, userName);
    if (side === 'home') return match.oid1 || null;
    if (side === 'visiting') return match.wid1 || null;
    return null;
}

function getUserRatingFromMatch(match, userId, userName) {
    const side = getUserMatchSide(match, userId, userName);
    if (side === 'home') return match.w1Rating;
    if (side === 'visiting') return match.o1Rating;
    return null;
}

function getOpponentRatingFromMatch(match, userId, userName) {
    const side = getUserMatchSide(match, userId, userName);
    if (side === 'home') return match.o1Rating;
    if (side === 'visiting') return match.w1Rating;
    return null;
}

/**
 * Formats match score so the user's own points are listed first in each game.
 * API scores list the match winner's points first.
 */
function formatMatchScoreForUser(match, didWin) {
    if (!match.Score || String(match.Score).trim().toLowerCase() === 'unknown') {
        return 'Unknown';
    }

    const games = String(match.Score).split(',');
    const formattedGames = games.map(game => {
        const parts = game.trim().split('-');
        if (parts.length !== 2) return game.trim();
        const [winnerScore, loserScore] = parts;
        return didWin ? `${winnerScore}-${loserScore}` : `${loserScore}-${winnerScore}`;
    });

    let formattedScore = formattedGames.join(', ');
    if (match.Status === 'RE') {
        formattedScore += ' (Retired)';
    }
    return formattedScore;
}

function formatMatchDate(matchDate) {
    if (!matchDate) return 'Unknown date';
    return new Date(matchDate).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function buildMatchDescriptionHTML(match) {
    const parts = [];
    if (match.Descr && match.Descr.trim() !== '') {
        parts.push(match.Descr.trim());
    }
    if (match.DivisionDescr && match.DivisionDescr.trim() !== '') {
        parts.push(match.DivisionDescr.trim());
    }
    if (match.TournamentID && Number(match.TournamentID) > 0) {
        parts.push(`Tournament #${match.TournamentID}`);
    }
    if (parts.length === 0) return '';
    return `<p class="text-xs text-gray-500">${parts.join(' · ')}</p>`;
}

function getUserMatchOutcome(match, userId, userName) {
    const didWin = didUserWinMatch(match, userId, userName);
    if (didWin === null) return null;

    let opponentName = getOpponentDisplayName(match, userId, userName);
    if (normalizeNameForCompare(opponentName) === normalizeNameForCompare(userName)) {
        opponentName = 'Opponent';
    }
    if (!opponentName.trim()) {
        opponentName = 'Opponent';
    }

    return {
        didWin,
        opponentName,
        formattedScore: formatMatchScoreForUser(match, didWin),
        matchDate: formatMatchDate(match.MatchDate),
        descriptionHTML: buildMatchDescriptionHTML(match),
    };
}

function renderMatchEventCardHTML(match, userId, userName) {
    const outcome = getUserMatchOutcome(match, userId, userName);
    if (!outcome) return '';

    const resultClass = outcome.didWin ? 'win' : 'lose';
    return `
        <div class="event-card ${resultClass}" data-matchid="${match.Matchid}"
             data-home-player-name="${match.hplayer1 || 'Home Player'}"
             data-visiting-player-name="${match.vplayer1 || 'Visiting Player'}">
            <img src="https://ussq-img-live.s3.us-east-1.amazonaws.com/uploads%2Fussq-profile-icon-default.png" class="event-logo" alt="Match" />
            <div class="event-details">
                <p><strong>${outcome.matchDate}</strong></p>
                <p>Score: ${outcome.formattedScore}</p>
                ${outcome.descriptionHTML}
                <p>vs. ${outcome.opponentName}</p>
            </div>
        </div>
    `;
}

function isRenderableCompletedMatch(match) {
    return match && (match.Status === 'C' || match.Status === 'RE');
}

// Function to display a temporary message
const TEMP_MESSAGE_ICONS = {
    info: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    success: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/></svg>',
    error: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>'
};
let tempMessageHideTimer = null;
let tempMessageFadeTimer = null;

function showTemporaryMessage(message, type = 'info') {
    let messageBox = document.getElementById('temp-message-box');
    if (!messageBox) {
        // Create it on the fly so this works even on pages that forgot to add it.
        messageBox = document.createElement('div');
        messageBox.id = 'temp-message-box';
        document.body.appendChild(messageBox);
    }

    clearTimeout(tempMessageHideTimer);
    clearTimeout(tempMessageFadeTimer);

    const icon = TEMP_MESSAGE_ICONS[type] || TEMP_MESSAGE_ICONS.info;
    messageBox.innerHTML = `${icon}<span>${message}</span>`;
    messageBox.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-lg shadow-lg z-[70] text-white transition-opacity duration-300';

    if (type === 'info') {
        messageBox.classList.add('bg-indigo-600');
    } else if (type === 'success') {
        messageBox.classList.add('bg-green-500');
    } else if (type === 'error') {
        messageBox.classList.add('bg-red-500');
    }

    messageBox.style.display = 'flex';
    // Force reflow so the opacity transition reliably plays even on repeated calls
    void messageBox.offsetWidth;
    messageBox.style.opacity = '1';

    tempMessageFadeTimer = setTimeout(() => {
        messageBox.style.opacity = '0';
        tempMessageHideTimer = setTimeout(() => {
            messageBox.style.display = 'none';
        }, 300); // Fade out duration
    }, 3000); // Display duration
}


// Fetches and appends a single page of completed matches to the dashboard widget
async function fetchAndAppendMatchesPage(currentUserId, currentUserName, pageNumber, pageSize) {
    const container = document.querySelector("#matches-container");
    const loadingIndicator = document.getElementById("loading-matches-indicator");
    const loadMoreBtn = document.getElementById("load-more-matches-btn");

    if (!container) {
        console.error("No container found for matches rendering.");
        return false;
    }

    if (loadingIndicator) loadingIndicator.style.display = 'block';
    if (loadMoreBtn) loadMoreBtn.disabled = true;

    try {
        const response = await fetch(`/proxy/user/${currentUserId}/matches/page/${pageNumber}`);
        if (!response.ok) {
            throw new Error(`HTTP error fetching matches page ${pageNumber}! status: ${response.status}`);
        }
        const data = await response.json();

        if (!data.matches || !Array.isArray(data.matches) || data.matches.length === 0) {
            return false;
        }

        let matchesRenderedThisPage = 0;
        data.matches.forEach(match => {
            if (matchesRenderedThisPage >= pageSize) return;

            if (!isRenderableCompletedMatch(match)) {
                return;
            }

            if (!userParticipatedInMatch(match, currentUserId, currentUserName)) {
                console.log(`Skipping match ${match.Matchid}: user ${currentUserId} not found as home or visiting player.`);
                return;
            }

            if (loadedMatchIds.has(match.Matchid)) {
                return;
            }

            const matchHTML = renderMatchEventCardHTML(match, currentUserId, currentUserName);
            if (!matchHTML) {
                console.warn(`Could not determine outcome for match ${match.Matchid}; skipping.`);
                return;
            }

            loadedMatchIds.add(match.Matchid);
            container.insertAdjacentHTML("beforeend", matchHTML);
            matchesRenderedThisPage++;
        });

        return data.matches.length >= pageSize;
    } catch (error) {
        console.error("Error fetching or rendering matches page:", error);
        if (pageNumber === 1 && container.children.length === 0) {
            container.innerHTML = '<p class="text-center text-red-500 mt-4">Error loading matches.</p>';
        }
        return false;
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (loadMoreBtn) loadMoreBtn.disabled = false;
    }
}

// Loads the next page of completed matches (single entry point for scroll + button)
async function loadNextMatches(currentUserId, currentUserName) {
    if (matchesLoadingInProgress || !hasMoreMatches) {
        return;
    }

    const container = document.querySelector("#matches-container");
    const loadMoreBtn = document.getElementById("load-more-matches-btn");
    const noMoreMatchesMessage = document.getElementById("no-more-matches-message");
    const resolvedUserName = currentUserName || currentUserFullName;

    if (currentPageForMatches === 1 && container) {
        container.innerHTML = "";
        loadedMatchIds.clear();
    }

    matchesLoadingInProgress = true;
    const pageToFetch = currentPageForMatches;

    try {
        const stillHasMore = await fetchAndAppendMatchesPage(
            currentUserId,
            resolvedUserName,
            pageToFetch,
            MATCH_PAGE_SIZE
        );

        currentPageForMatches = pageToFetch + 1;
        hasMoreMatches = stillHasMore;

        if (!hasMoreMatches) {
            if (loadMoreBtn) loadMoreBtn.style.display = 'none';
            if (noMoreMatchesMessage) noMoreMatchesMessage.style.display = 'block';
            if (pageToFetch === 1 && container && container.children.length === 0) {
                container.innerHTML = '<p class="text-center text-gray-500 mt-4">No completed matches found.</p>';
            }
        } else {
            if (loadMoreBtn) loadMoreBtn.style.display = 'block';
            if (noMoreMatchesMessage) noMoreMatchesMessage.style.display = 'none';
        }
    } finally {
        matchesLoadingInProgress = false;
    }
}


// Fetches and displays the user's current singles rating
async function fetchUserRatings(currentUserId) {
  try {
    const res = await fetch(`/proxy/user/${currentUserId}/ratings`);
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();

    const currentRatingEl = document.getElementById("current-rating");
    const statusIndicatorEl = document.getElementById("status-indicator");
    const currentTierNameDisplayEl = document.getElementById('current-tier-name-display');

        // Try to find the singles rating entry and robustly extract a numeric value.
        let ratingObj = data.find(r => /singles/i.test(r.ratingTypeName || '')) || data.find(r => r.ratingTypeName === "Singles International Rating");
        const extractNumeric = (obj) => {
            if (!obj) return NaN;
            const candidates = [obj.rating, obj.Rating, obj.value, obj.ratingValue];
            for (const c of candidates) {
                const parsed = parseFloat(c);
                if (!isNaN(parsed)) return parsed;
            }
            return NaN;
        };

        let parsedRating = extractNumeric(ratingObj);
        if (isNaN(parsedRating)) {
            const singlesFallback = data.find(r => /singles/i.test(r.ratingTypeName || ''));
            if (singlesFallback) parsedRating = extractNumeric(singlesFallback);
        }
        if (isNaN(parsedRating)) {
            for (const entry of data) {
                const v = extractNumeric(entry);
                if (!isNaN(v)) { parsedRating = v; break; }
            }
        }

        if (!isNaN(parsedRating)) {
            currentRatingEl.textContent = `${parsedRating.toFixed(2)}`;
            updateProgressBar(parsedRating);

            statusIndicatorEl.textContent = "Active";
            statusIndicatorEl.className = "inline-block bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-1 rounded-full";

            if (currentTierNameDisplayEl) {
                    const currentTier = RATING_TIERS.find(tier => parsedRating >= tier.min && (tier.max === Infinity || parsedRating < tier.max));
                    currentTierNameDisplayEl.textContent = currentTier ? currentTier.name : 'N/A';
            }
        } else {
            console.debug('No numeric rating found for user', currentUserId, 'ratings payload:', data);
            currentRatingEl.textContent = "N/A";
            updateProgressBar(0);

            statusIndicatorEl.textContent = "N/A";
            statusIndicatorEl.className = "inline-block bg-gray-100 text-gray-700 text-xs font-semibold px-2 py-1 rounded-full";

            if (currentTierNameDisplayEl) {
                    currentTierNameDisplayEl.textContent = `N/A`;
            }
    }
  } catch (err) {
    console.error("Error fetching current rating:", err);
    const currentRatingEl = document.getElementById("current-rating");
    const statusIndicatorEl = document.getElementById("status-indicator");
    const currentTierNameDisplayEl = document.getElementById('current-tier-name-display');

    if (currentRatingEl) currentRatingEl.textContent = "Error loading rating.";
    updateProgressBar(0);

    if (statusIndicatorEl) {
        statusIndicatorEl.textContent = "Error";
        statusIndicatorEl.className = "inline-block bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded-full";
    }

    if (currentTierNameDisplayEl) {
        currentTierNameDisplayEl.textContent = `Error`;
    }
  }
}

// Fetches and renders the Match Breakdown. This uses the /record API
// (`/proxy/user/{id}/record`) which returns the user's match record broken
// down by match type (S/D) and length (3, 4, 5 games), so we don't have to
// iterate through every match the user has played.
async function fetchAndRenderMatchRecord(currentUserId, currentUserName) {
    const breakdown = {
        wins3: 0, wins4: 0, wins5: 0,
        losses3: 0, losses4: 0, losses5: 0,
        totalWins: 0, totalLosses: 0
    };

    const updateUI = () => {
        setText('wins-3-game', breakdown.wins3);
        setText('wins-4-game', breakdown.wins4);
        setText('wins-5-game', breakdown.wins5);
        setText('losses-3-game', breakdown.losses3);
        setText('losses-4-game', breakdown.losses4);
        setText('losses-5-game', breakdown.losses5);
        setText('overall-wins', breakdown.totalWins);
        setText('overall-losses', breakdown.totalLosses);

        const matchesPlayedTotalEl = document.getElementById('matches-played-total');
        if (matchesPlayedTotalEl) matchesPlayedTotalEl.textContent = breakdown.totalWins + breakdown.totalLosses;

        const winRateDisplayEl = document.getElementById('win-rate-display');
        if (winRateDisplayEl) {
            const played = breakdown.totalWins + breakdown.totalLosses;
            winRateDisplayEl.textContent = played > 0 ? `${Math.round((breakdown.totalWins / played) * 100)}%` : '0%';
        }
    };

    const addEntry = (entry) => {
        if (!entry) return;
        const wins = Number(entry.matchesWon) || 0;
        const losses = Number(entry.matchesLost) || 0;

        breakdown.totalWins += wins;
        breakdown.totalLosses += losses;

        switch (Number(entry.matchesType)) {
            case 3: breakdown.wins3 += wins; breakdown.losses3 += losses; break;
            case 4: breakdown.wins4 += wins; breakdown.losses4 += losses; break;
            case 5: breakdown.wins5 += wins; breakdown.losses5 += losses; break;
        }
    };

    try {
        const response = await fetch(`/proxy/user/${currentUserId}/record`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        if (!Array.isArray(data)) throw new Error('Record response is not an array');

        // Only count singles ('S') records for the singles breakdown.
        data.filter(entry => entry.type === 'S').forEach(addEntry);

        updateUI();
    } catch (error) {
        console.error("Error fetching or rendering match breakdown:", error);
        const ids = ['wins-3-game', 'wins-4-game', 'wins-5-game', 'losses-3-game', 'losses-4-game', 'losses-5-game'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = 'N/A';
        });
        const matchesPlayedTotalEl = document.getElementById('matches-played-total');
        if (matchesPlayedTotalEl) matchesPlayedTotalEl.textContent = 'N/A';
        const winRateDisplayEl = document.getElementById('win-rate-display');
        if (winRateDisplayEl) winRateDisplayEl.textContent = 'N/A';
        const overallWinsEl = document.getElementById('overall-wins');
        if (overallWinsEl) overallWinsEl.textContent = 'N/A';
        const overallLossesEl = document.getElementById('overall-losses');
        if (overallLossesEl) overallLossesEl.textContent = 'N/A';
    }
}

// Default profile picture used everywhere
const DEFAULT_PROFILE_PICTURE = 'https://ussq-img-live.s3.us-east-1.amazonaws.com/uploads%2Fussq-profile-icon-default.png';

/**
 * Fetches and renders user's personal details on the dashboard.
 *
 * Personal details are resolved from the public rankings lookup
 * (`fetchUserFromRankings`), falling back to the `/proxy/user/{id}` details
 * API if the rankings lookup fails.
 *
 * @param {string|number} currentUserId - The ID of the user.
 * @returns {Promise<string|null>} The user's full name (for match rendering), or null on total failure.
 */
async function fetchAndRenderUserDetails(currentUserId) {
    const setDefaults = () => {
        setText('welcome-message', 'Welcome Back 🎉');
        setText('player-name', 'N/A');
        setText('member-status', 'Member, US Squash');
        setImg('profile-picture', DEFAULT_PROFILE_PICTURE);
        setText('player-email', 'N/A');
        setText('player-home-club', 'N/A');
        setText('player-location', 'N/A');
        setText('player-birthday', 'N/A');
        setText('player-gender', 'N/A');
    };

    let userData = null;

    try {
        // Fetch the selected user's direct profile first. We use its first name
        // as the identity check for the leaderboard row so a shifted ranking
        // cannot populate Personal Details with a different player.
        const response = await fetch(`/proxy/user/${currentUserId}`);
        if (response.ok) {
            userData = await response.json();
        } else {
            console.warn(`User details HTTP error ${response.status}; rankings lookup will continue without a first-name check.`);
        }

        const expectedFirstName = getUserFirstName(userData);

        // Primary source for the richer Personal Details fields: leaderboard.
        // The lookup checks the expected rank, then 1 above/below, then 2 above/below,
        // and only accepts a row whose first name matches the selected user.
        const details = await fetchUserFromRankings(currentUserId, expectedFirstName);
        if (details && (details.firstName || details.lastName)) {
            renderUserDetails(details);
            currentUserFullName = [details.firstName, details.lastName].filter(Boolean).join(' ').trim();
            return currentUserFullName;
        }

        // Fallback to the direct user details API if no verified leaderboard row was found.
        if (!userData) {
            throw new Error('Could not load either verified rankings details or direct user details');
        }

        const fallbackFirstName = getUserFirstName(userData);
        setText('welcome-message', fallbackFirstName ? `Welcome Back, ${fallbackFirstName} 🎉` : 'Welcome Back 🎉');
        setImg('profile-picture', userData.profilePictureUrl || DEFAULT_PROFILE_PICTURE);
        setText('player-name', userData.name || [userData.firstName, userData.lastName].filter(Boolean).join(' ') || 'N/A');
        setText('member-status', typeof userData.isMember === 'boolean' ? (userData.isMember ? 'Member, US Squash' : 'Non-Member, US Squash') : 'Status Unavailable');
        setText('player-email', userData.Email || userData.email || 'N/A');
        setText('player-home-club', (userData.mainAffiliation && userData.mainAffiliation.descr) || userData.homeClub || 'N/A');
        if (userData.City) {
            setText('player-location', userData.State ? `${userData.City}, ${userData.State}${userData.Zip ? ' ' + userData.Zip : ''}` : userData.City);
        } else {
            setText('player-location', userData.location || 'N/A');
        }
        setText('player-birthday', userData.BirthDate ? formatDate(userData.BirthDate) : 'N/A');
        setText('player-gender', userData.Gender || userData.gender || 'N/A');

        currentUserFullName = userData.name || [userData.firstName, userData.lastName].filter(Boolean).join(' ').trim();
        return currentUserFullName || null;
    } catch (error) {
        console.error("Error fetching or rendering user details:", error);
        setDefaults();
        return null;
    }
}

// Returns the direct profile's first name in a consistent form for leaderboard verification.
function getUserFirstName(userData) {
    if (!userData) return '';
    if (userData.firstName && String(userData.firstName).trim()) {
        return String(userData.firstName).trim();
    }
    if (userData.FirstName && String(userData.FirstName).trim()) {
        return String(userData.FirstName).trim();
    }
    if (userData.name && String(userData.name).trim()) {
        return normalizeName(String(userData.name)).split(' ')[0] || '';
    }
    return '';
}

// First-name comparison used only to verify that a leaderboard row belongs to the selected user.
function firstNamesMatch(a, b) {
    const normalizeFirst = value => normalizeName(value).toLowerCase();
    return Boolean(normalizeFirst(a) && normalizeFirst(b) && normalizeFirst(a) === normalizeFirst(b));
}

/**
 * Performs the two-step public rankings lookup and returns a normalized object
 * with the leaderboard entry fields, or null if any step fails.
 *
 * The rankings API is sometimes shifted relative to the leaderboard. Start at
 * the expected rank (reported rank + 1), then search ±1 and ±2. When the direct
 * profile supplied a first name, only a leaderboard row with that same first
 * name is accepted. Candidate ranks can cross a 50-row page boundary.
 */
async function fetchUserFromRankings(userId, expectedFirstName = '') {
    try {
        // Step 1: find the current Universal Squash Rating entry.
        const rankingsRes = await fetch(`/proxy/user/${userId}/rankings-current`);
        if (!rankingsRes.ok) throw new Error(`Rankings HTTP error ${rankingsRes.status}`);
        const rankings = await rankingsRes.json();
        if (!Array.isArray(rankings)) throw new Error('Rankings response not an array');

        const target = rankings.find(r =>
            r.DivisionID === 0 &&
            r.Rating_GroupID === 208 &&
            r.Rating_OrgID === 13895 &&
            r.OrgType === 8 &&
            r.DivisionName === "All"
        );
        if (!target || target.Ranking === undefined) throw new Error('No Universal Squash Rating entry found');

        const rawRanking = Number(target.Ranking);
        if (!Number.isFinite(rawRanking)) throw new Error(`Invalid ranking value: ${target.Ranking}`);

        // Current API behavior indicates the leaderboard is normally +1, but the
        // exact offset can drift. Search nearest candidates in this order.
        const expectedRanking = rawRanking + 1;
        const candidateRanks = [
            expectedRanking,
            expectedRanking - 1,
            expectedRanking + 1,
            expectedRanking - 2,
            expectedRanking + 2
        ].filter(rank => Number.isInteger(rank) && rank > 0);

        const pageCache = new Map();

        const getLeaderboardRowsForRank = async rank => {
            const pageNumber = Math.ceil(rank / 50);
            if (pageCache.has(pageNumber)) return pageCache.get(pageNumber);

            const boardRes = await fetch(`/proxy/rankings/208/current?divisions=0&pageNumber=${pageNumber}`);
            if (!boardRes.ok) throw new Error(`Leaderboard HTTP error ${boardRes.status} for page ${pageNumber}`);
            const board = await boardRes.json();
            const rows = Array.isArray(board) ? board : (board && Array.isArray(board.rankings) ? board.rankings : []);
            pageCache.set(pageNumber, rows);
            return rows;
        };

        let unverifiedExpectedEntry = null;

        for (const candidateRank of candidateRanks) {
            const rows = await getLeaderboardRowsForRank(candidateRank);
            const entry = rows.find(r => String(r.ranking) === String(candidateRank));
            if (!entry) continue;

            // If no direct-profile first name was available, preserve the old
            // behavior and use only the expected rank rather than guessing nearby.
            if (!expectedFirstName) {
                if (candidateRank === expectedRanking) return normalizeLeaderboardEntry(entry);
                continue;
            }

            if (candidateRank === expectedRanking) {
                unverifiedExpectedEntry = entry;
            }

            if (firstNamesMatch(entry.firstName, expectedFirstName)) {
                if (candidateRank !== expectedRanking) {
                    console.info(`Personal details ranking corrected from ${expectedRanking} to ${candidateRank} for ${expectedFirstName}.`);
                }
                return normalizeLeaderboardEntry(entry);
            }
        }

        if (expectedFirstName) {
            const foundName = unverifiedExpectedEntry && unverifiedExpectedEntry.firstName
                ? unverifiedExpectedEntry.firstName
                : 'unknown';
            throw new Error(`No leaderboard row within ±2 of rank ${expectedRanking} matched first name "${expectedFirstName}" (expected row was "${foundName}")`);
        }

        throw new Error(`Entry with ranking ${expectedRanking} not found`);
    } catch (err) {
        console.warn('fetchUserFromRankings failed, falling back to direct user details API:', err);
        return null;
    }
}

function normalizeLeaderboardEntry(entry) {
    return {
        firstName: entry.firstName,
        lastName: entry.lastName,
        email: entry.email,
        homeClub: entry.homeClub,
        location: entry.location || (entry.city ? [entry.city, entry.state].filter(Boolean).join(', ') : ''),
        dob: entry.dob,
        gender: entry.gender,
        rating: entry.rating,
        profilePictureUrl: entry.profilePictureUrl,
        ranking: entry.ranking
    };
}

/**
 * Populates the Personal Details card from a normalized leaderboard entry.
 */
function renderUserDetails(details) {
    const fullName = [details.firstName, details.lastName].filter(Boolean).join(' ').trim();

    setText('welcome-message', details.firstName ? `Welcome Back, ${details.firstName} 🎉` : 'Welcome Back 🎉');
    setText('player-name', fullName || 'N/A');
    setText('member-status', 'Member, US Squash');
    setImg('profile-picture', details.profilePictureUrl || DEFAULT_PROFILE_PICTURE);
    setText('player-email', details.email || 'N/A');
    setText('player-home-club', details.homeClub || 'N/A');
    setText('player-location', details.location || 'N/A');
    setText('player-birthday', details.dob ? formatDate(details.dob) : 'N/A');
    setText('player-gender', details.gender || 'N/A');
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function setImg(id, src) {
    const el = document.getElementById(id);
    if (el) el.src = src;
}

function formatDate(input) {
    const d = new Date(input);
    if (isNaN(d)) return 'N/A';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

// Fetches and calculates the average opponent rating from the last 15 matches
async function fetchAndCalculateAverageOpponentRating(currentUserId, currentUserName) {
    const averageOpponentRatingElement = document.getElementById("average-opponent-rating");
    if (averageOpponentRatingElement) {
        averageOpponentRatingElement.textContent = "Loading...";
    }

    const opponentRatings = [];
    let matchesProcessedCount = 0;
    const matchesToConsider = 15;

    for (let page = 1; matchesProcessedCount < matchesToConsider; page++) {
        try {
            const response = await fetch(`/proxy/user/${currentUserId}/matches/page/${page}`);
            if (!response.ok) {
                console.error(`HTTP error fetching matches page ${page} for average opponent rating! Status: ${response.status}`);
                break;
            }
            const data = await response.json();

            if (!data.matches || !Array.isArray(data.matches) || data.matches.length === 0) {
                break;
            }

            for (const match of data.matches) {
                if (matchesProcessedCount >= matchesToConsider) break;

                if (!isRenderableCompletedMatch(match)) {
                    continue;
                }

                if (!userParticipatedInMatch(match, currentUserId, currentUserName)) {
                    continue;
                }

                const opponentRating = getOpponentRatingFromMatch(match, currentUserId, currentUserName);
                if (typeof opponentRating === 'number' && !isNaN(opponentRating)) {
                    opponentRatings.push(opponentRating);
                    matchesProcessedCount++;
                } else {
                    const opponentId = getOpponentPlayerId(match, currentUserId, currentUserName);
                    if (!opponentId) continue;

                    try {
                        const opponentRatingResponse = await fetch(`/proxy/user/${opponentId}/ratings-top`);
                        if (!opponentRatingResponse.ok) continue;
                        const opponentRatingData = await opponentRatingResponse.json();
                        if (opponentRatingData?.length > 0 && typeof opponentRatingData[0].rating === 'number' && !isNaN(opponentRatingData[0].rating)) {
                            opponentRatings.push(opponentRatingData[0].rating);
                            matchesProcessedCount++;
                        }
                    } catch (error) {
                        console.error(`Error fetching rating for opponent ${opponentId} (Match ID: ${match.Matchid}):`, error);
                    }
                }
            }

            if (data.matches.length < MATCH_PAGE_SIZE) {
                break;
            }
        } catch (error) {
            console.error("Critical error fetching matches for average opponent rating calculation:", error);
            break;
        }
    }

    if (averageOpponentRatingElement) {
        if (opponentRatings.length > 0) {
            const sumRatings = opponentRatings.reduce((sum, rating) => sum + rating, 0);
            const averageRating = (sumRatings / opponentRatings.length).toFixed(2);
            averageOpponentRatingElement.textContent = `${averageRating} (last 15 matches)`;
        } else {
            averageOpponentRatingElement.textContent = "N/A (No matches considered)";
        }
    } else {
        console.warn("Element with ID 'average-opponent-rating' not found. Cannot display average opponent rating.");
    }
}


// --- Search Bar Functionality ---
let searchTimeout = null;
const searchInput = document.getElementById('search-input');
const searchResultsContainer = document.getElementById('search-results');

if (searchInput && searchResultsContainer) {
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const query = searchInput.value.trim();

        if (query.length > 2) { // Only search if query is at least 3 characters
            searchTimeout = setTimeout(() => {
                performSearch(query);
            }, 300); // Debounce search to 300ms
        } else {
            searchResultsContainer.innerHTML = '';
            searchResultsContainer.classList.add('hidden');
        }
    });

    // Hide search results when clicking outside
    document.addEventListener('click', (event) => {
        if (!searchInput.contains(event.target) && !searchResultsContainer.contains(event.target)) {
            searchResultsContainer.classList.add('hidden');
        }
    });
}

async function performSearch(query) {
    // Replace spaces with '+' as per API requirement
    const formattedQuery = query.replace(/\s/g, '+');
    const apiUrl = `/proxy/resources/res/search/${formattedQuery}`;

    searchResultsContainer.innerHTML = `
        <div class="flex items-center gap-2 p-3 text-gray-500 text-sm">
            <svg class="animate-spin h-4 w-4 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Searching...</span>
        </div>`;
    searchResultsContainer.classList.remove('hidden');

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        displaySearchResults(data);
    } catch (error) {
        console.error("Error fetching search results:", error);
        searchResultsContainer.innerHTML = '<div class="p-2 text-red-500">Error loading search results.</div>';
    }
}

function displaySearchResults(results) {
    searchResultsContainer.innerHTML = ''; // Clear previous results

    if (results.length === 0) {
        searchResultsContainer.innerHTML = '<div class="p-2 text-gray-500">No results found.</div>';
        searchResultsContainer.classList.add('hidden');
        return;
    }

    results.forEach(result => {
        const resultItem = document.createElement('div');
        resultItem.classList.add('flex', 'items-center', 'gap-2', 'p-2', 'hover:bg-gray-100', 'cursor-pointer', 'border-b', 'border-gray-200');
        
        // Use a default image if LogoImageUrl is empty or null
        const imageUrl = result.LogoImageUrl && result.LogoImageUrl.trim() !== '' 
                                     ? result.LogoImageUrl 
                                     : 'https://ussq-img-live.s3.us-east-1.amazonaws.com/uploads%2Fussq-profile-icon-default.png';

        resultItem.innerHTML = `
            <img src="${imageUrl}" alt="${result.ObjectName}" class="w-8 h-8 rounded-full object-cover">
            <div>
                <p class="text-sm font-medium">${result.ObjectName}</p>
                <p class="text-xs text-gray-500">${result.ObjectType} ${result.ObjectLocation ? `(${result.ObjectLocation})` : ''}</p>
            </div>
        `;
        // Attach click listener to load the new player's profile
        resultItem.addEventListener('click', () => {
            if (result.ObjectType === "Player" && result.ObjectId) {
                window.location.href = `dashboard?userId=${result.ObjectId}`;
            }
        });
        searchResultsContainer.appendChild(resultItem);
    });
    searchResultsContainer.classList.remove('hidden');
}

// Function to load all dashboard data for a given userId
async function loadPlayerProfile(newUserId) {
    // Show loading overlay
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
        loadingOverlay.style.opacity = '1';
    }

    userId = newUserId; // Update the global userId

    // Update the URL with the new userId
    const url = new URL(window.location.href);
    url.searchParams.set('userId', userId);
    window.history.pushState({ userId: userId }, '', url.toString());

    // Save the current userId to session storage
    sessionStorage.setItem(SESSION_STORAGE_KEY_USER_ID, newUserId);
    console.log(`Dashboard: Saved userId to session storage: ${newUserId}`);

    // Reset match loading state
    currentPageForMatches = 1;
    hasMoreMatches = true;
    matchesLoadingInProgress = false;
    loadedMatchIds.clear();
    currentUserFullName = '';

    // Clear existing matches display
    const matchesContainer = document.querySelector("#matches-container");
    if (matchesContainer) {
        matchesContainer.innerHTML = '';
    }
    const noMoreMatchesMessage = document.getElementById('no-more-matches-message');
    if (noMoreMatchesMessage) noMoreMatchesMessage.style.display = 'none'; // Hide no more matches message

    // Fetch and render all dashboard components for the new user
    const userName = await fetchAndRenderUserDetails(userId); // Get the user's name for match rendering

    if (userName) {
        currentUserFullName = userName;
        await Promise.all([
            fetchUserRatings(userId),
            fetchAndRenderRatings(userId),
            fetchAndRenderMatchRecord(userId, userName),
            fetchAndCalculateAverageOpponentRating(userId, userName)
        ]);
        populateRatingTooltip(); // This doesn't depend on userId, but good to call for consistency
        await loadNextMatches(userId, userName); // Load first page of matches for the new user
        
        // Refresh the test record widget with new userId
        if (typeof refreshTestRecordWidget === 'function') {
            refreshTestRecordWidget();
        }
    } else {
        console.error("User name not available for new profile, cannot render matches or calculate opponent rating accurately.");
        document.querySelector("#matches-container").innerHTML = '<p class="text-center text-red-500 mt-4">Could not load match history for this player.</p>';
    }


    setTimeout(() => {
        if (loadingOverlay) {
            loadingOverlay.style.opacity = '0';
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
            }, 300);
        }
    }, 1500);


}


document.addEventListener('DOMContentLoaded', async () => {
    // Log the userId being determined at DOMContentLoaded
    console.log("Dashboard DOMContentLoaded: Starting userId determination.");

    // Initialize Lucide icons early for static elements
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }

    // Read userId from URL on page load
    const urlParams = new URLSearchParams(window.location.search);
    const userIdFromUrl = urlParams.get('userId');
    let currentDeterminedUserId; // Use a local variable for clarity

    if (userIdFromUrl) {
        const parsedId = parseInt(userIdFromUrl, 10);
        if (!isNaN(parsedId)) {
            currentDeterminedUserId = parsedId;
            console.log(`Dashboard: User ID determined from URL: ${currentDeterminedUserId}`);
        } else {
            console.warn("Dashboard: Invalid userId found in URL. Attempting to load from session storage.");
            const storedUserId = sessionStorage.getItem(SESSION_STORAGE_KEY_USER_ID);
            if (storedUserId && !isNaN(parseInt(storedUserId, 10))) {
                currentDeterminedUserId = parseInt(storedUserId, 10);
                console.log(`Dashboard: Loaded userId from session storage (URL was invalid): ${currentDeterminedUserId}`);
            } else {
                currentDeterminedUserId = 170053;
                console.log(`Dashboard: Defaulting userId to ${currentDeterminedUserId} (URL invalid, no session storage).`);
            }
        }
    } else {
        console.log("Dashboard: No userId found in URL. Attempting to load from session storage.");
        const storedUserId = sessionStorage.getItem(SESSION_STORAGE_KEY_USER_ID);
        if (storedUserId && !isNaN(parseInt(storedUserId, 10))) {
            currentDeterminedUserId = parseInt(storedUserId, 10);
            console.log(`Dashboard: Loaded userId from session storage: ${currentDeterminedUserId}`);
        } else {
            currentDeterminedUserId = 170053;
            console.log(`Dashboard: Defaulting userId to ${currentDeterminedUserId} (no URL, no session storage).`);
        }
    }

    // Update the global userId variable
    userId = currentDeterminedUserId;

    // Only proceed with dashboard specific logic if not on analytics page
    // This check is important to prevent dashboard logic from running on analytics.html
    if (!window.location.pathname.includes('analytics')) {
        console.log(`Dashboard: Calling loadPlayerProfile with userId: ${userId}`);
        await loadPlayerProfile(userId);

        // Attach click listener to the Load More button (if not already attached)
        // This listener should persist across profile loads as it refers to the global loadNextMatches
        const loadMoreBtn = document.getElementById('load-more-matches-btn');
        if (loadMoreBtn && !loadMoreBtn.dataset.listenerAttached) { // Prevent attaching multiple listeners
            loadMoreBtn.addEventListener('click', () => {
                loadNextMatches(userId, currentUserFullName);
            });
            loadMoreBtn.dataset.listenerAttached = 'true'; // Mark as attached
        } else if (!loadMoreBtn) {
            console.warn("Load More Matches button not found. Manual loading will not work.");
        }

        // Make "Updated:" date dynamic
        const lastUpdatedDateEl = document.getElementById('last-updated-date');
        if (lastUpdatedDateEl) {
            const currentDate = new Date();
            lastUpdatedDateEl.textContent = currentDate.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }

        // Add event listener for displaying Matchid on click
        const matchesContainer = document.getElementById('matches-container');
        if (matchesContainer) {
            matchesContainer.addEventListener('click', (event) => {
                const clickedCard = event.target.closest('.event-card');
                if (clickedCard) {
                    const matchId = clickedCard.dataset.matchid;
                    const homePlayerName = clickedCard.dataset.homePlayerName;
                    const visitingPlayerName = clickedCard.dataset.visitingPlayerName;
                    if (matchId) {
                        showGraphModal({Matchid: matchId, playerHome1Name: homePlayerName, playerVisiting1Name: visitingPlayerName});
                    }
                }
            });

            // Add scroll listener for infinite loading and back-to-top button
            matchesContainer.addEventListener('scroll', () => {
                const scrollTop = matchesContainer.scrollTop;
                const scrollHeight = matchesContainer.scrollHeight;
                const clientHeight = matchesContainer.clientHeight;
                const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;

                if (isAtBottom && hasMoreMatches && !matchesLoadingInProgress) {
                    loadNextMatches(userId, currentUserFullName);
                }

                const backToTopBtn = document.getElementById('back-to-top-btn');
                if (backToTopBtn) {
                    if (scrollTop > 100) {
                        backToTopBtn.classList.remove('hidden');
                        backToTopBtn.classList.add('opacity-100');
                    } else {
                        backToTopBtn.classList.add('hidden');
                        backToTopBtn.classList.remove('opacity-100');
                    }
                }
            });
        } else {
            console.warn("Matches container not found, cannot attach click listener for Match ID display.");
        }

        // Add a temporary message box element to the body if it's not on analytics page
        let tempMessageBox = document.getElementById('temp-message-box');
        if (!tempMessageBox) {
            tempMessageBox = document.createElement('div');
            tempMessageBox.id = 'temp-message-box';
            tempMessageBox.style.cssText = `
                display: none;
                position: fixed;
                top: 4rem; /* Adjust as needed */
                left: 50%;
                transform: translateX(-50%);
                padding: 0.75rem 1.5rem;
                border-radius: 0.5rem;
                background-color: #3B82F6; /* blue-500 */
                color: white;
                font-size: 0.875rem; /* text-sm */
                font-weight: 500; /* font-medium */
                z-index: 1000;
                opacity: 0;
                transition: opacity 0.5s ease-in-out;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            `;
            document.body.appendChild(tempMessageBox);
        }

        // Add Contact Me section
        addContactMeSection();

        // Attach event listener for the Analytics link in dashboard.html
        const analyticsLink = document.getElementById('analytics-link');
        if (analyticsLink) {
            analyticsLink.addEventListener('click', (event) => {
                event.preventDefault(); // Prevent default link behavior
                // Navigate to analytics.html with the current userId
                window.location.href = `analytics?userId=${userId}`;
            });
        }
    }
});

// Helper function to format duration in seconds into MM:SS or HH:MM:SS
function formatDurationSec(totalSeconds) {
    if (isNaN(totalSeconds) || totalSeconds < 0) return "N/A";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.round(totalSeconds % 60);

    const pad = (num) => num.toString().padStart(2, '0');

    if (hours > 0) {
        return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    } else {
        return `${pad(minutes)}:${pad(seconds)}`;
    }
}

// Icons used inside the match insights modal (kept inline so no extra requests are needed)
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

// Cache of already-fetched, already-validated insight data for a given match, keyed by match_id.
// Avoids re-fetching the same data when access is granted right after the "no insights yet" check.
const matchInsightsDataCache = new Map();

/**
 * Simple placeholder UI shown the instant the modal opens, while we check
 * whether this match actually has insight data to show.
 */
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

/**
 * Fetches and validates the raw live-scoring data for a match.
 * Returns a processed object (allPoints, gameMap, uniqueGames) when the match
 * has usable scoring data, or null when there's nothing worth showing.
 * This never touches the DOM/modal — callers decide what to do with the result.
 */
async function fetchMatchInsightsData(match) {
    const match_id = match.matchId || match.Matchid;

    if (matchInsightsDataCache.has(match_id)) {
        return matchInsightsDataCache.get(match_id);
    }

    const apiUrl = `/proxy/liveScoreDetails?match_id=${match_id}`;
    let data;
    try {
        const response = await fetch(apiUrl, { method: "GET", credentials: "include" });
        if (!response.ok) throw new Error("Proxy response not ok");
        data = await response.json();
    } catch (error) {
        console.error("Error fetching proxy data:", error);
        return null;
    }

    if (!data || data.length === 0) return null;

    const allPoints = data.filter(evt => evt.Decision === "point");
    if (allPoints.length < 2) return null;
    allPoints.sort((a, b) => new Date(a.StartDate) - new Date(b.StartDate));

    const gameMap = {};
    for (const evt of allPoints) {
        const g = evt.Game_Number;
        if (!gameMap[g]) gameMap[g] = [];
        gameMap[g].push(evt);
    }
    const uniqueGames = Object.keys(gameMap).map(g => parseInt(g)).sort((a, b) => a - b);

    const result = { allPoints, gameMap, uniqueGames };
    matchInsightsDataCache.set(match_id, result);
    return result;
}

// NEW: Functions for the Graph Modal
async function showGraphModal(match) {
    console.log("showGraphModal called with match:", match);
    const match_id = match.matchId || match.Matchid;
    if (!match_id) {
        console.error("Error: No matchId available for this match.");
        showTemporaryMessage("No matchId available for this match.", "error");
        return;
    }

    const graphModal = document.getElementById("graph-modal");
    if (!graphModal) {
        console.error("Error: Element with ID 'graph-modal' not found.");
        showTemporaryMessage("Error displaying match insights modal.", "error");
        return;
    }

    const graphStatus = document.getElementById("graph-status");
    const metricsContainer = document.getElementById("metrics-container");
    const matchInsightsTitle = document.getElementById("match-insights-title");
    const matchInsightsIcon = document.getElementById("match-insights-icon");

    // Open the modal right away with a loading state.
    if (metricsContainer) metricsContainer.innerHTML = renderInsightsLoadingSkeleton();
    if (graphStatus) graphStatus.textContent = '';
    if (matchInsightsIcon) matchInsightsIcon.innerHTML = MI_ICONS.activity;
    if (matchInsightsTitle) matchInsightsTitle.textContent = 'Match Insights';

    graphModal.classList.remove("hidden");
    graphModal.classList.add("mi-open");
    graphModal.style.display = "flex";
    graphModal.style.alignItems = "center";
    graphModal.style.justifyContent = "center";
    document.body.classList.add('no-scroll');

    const insightsData = await fetchMatchInsightsData(match);
    if (!insightsData) {
        // No insights for this match — automatically close the modal back out
        // and just tell the person via the toast instead of leaving it open empty.
        closeGraphModal();
        showTemporaryMessage("No match insights available for this match yet.", "info");
        return;
    }

    // Check if access has already been granted in this session
    if (sessionStorage.getItem(SESSION_STORAGE_KEY_MATCH_INSIGHTS) === 'true') {
        if (matchInsightsTitle) matchInsightsTitle.textContent = 'Match Insights';
        renderMatchInsights(match, insightsData, metricsContainer);
        return;
    }

    if (matchInsightsTitle) matchInsightsTitle.textContent = 'Enter Access Code';
    renderAccessCodeGate(match, insightsData, metricsContainer, matchInsightsTitle);
}

/**
 * Renders the "enter access code" gate inside the metrics container.
 * On success it hands off to renderMatchInsights using the already-fetched data.
 */
function renderAccessCodeGate(match, insightsData, metricsContainer, matchInsightsTitle) {
    const codeInputHtml = `
        <div id="code-input-area" class="text-center py-8 px-4">
            <div class="mi-lock-circle mb-4">${MI_ICONS.lock}</div>
            <h3 class="text-lg font-semibold text-gray-800 mb-1.5">Match Insights are locked</h3>
            <p class="mb-1 text-sm text-gray-500 max-w-xs mx-auto">Enter the access code to view detailed stats, game-by-game score progression, and more.</p>
            <p class="mb-5 text-sm text-gray-500">Need a code? Message <a href="tel:${CONTACT_PHONE_NUMBER}" class="text-indigo-600 font-medium hover:underline inline-flex items-center gap-1">${CONTACT_PHONE_NUMBER}</a></p>
            <div class="flex items-center justify-center gap-2 flex-wrap">
                <input type="password" id="access-code-input" class="border border-gray-300 rounded-lg px-3 py-2.5 text-center text-lg tracking-widest w-40 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="••••" autocomplete="off">
                <button id="submit-code-btn" class="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">Unlock</button>
            </div>
            <p id="code-error-message" class="flex items-center justify-center gap-1.5 text-red-500 text-sm mt-3 hidden">${MI_ICONS.alertCircle}<span>Incorrect code. Please try again.</span></p>
        </div>
    `;
    metricsContainer.innerHTML = codeInputHtml;

    const accessCodeInput = document.getElementById('access-code-input');
    const submitCodeBtn = document.getElementById('submit-code-btn');
    const codeErrorMessage = document.getElementById('code-error-message');
    const codeInputArea = document.getElementById('code-input-area');

    const handleCodeSubmission = () => {
        if (accessCodeInput.value === MATCH_INSIGHTS_ACCESS_CODE) {
            sessionStorage.setItem(SESSION_STORAGE_KEY_MATCH_INSIGHTS, 'true');
            if (codeErrorMessage) codeErrorMessage.classList.add('hidden');
            if (matchInsightsTitle) matchInsightsTitle.textContent = 'Match Insights';
            renderMatchInsights(match, insightsData, metricsContainer);
        } else {
            if (codeErrorMessage) codeErrorMessage.classList.remove('hidden');
            if (codeInputArea) {
                codeInputArea.classList.remove('mi-shake');
                void codeInputArea.offsetWidth; // restart animation
                codeInputArea.classList.add('mi-shake');
            }
            accessCodeInput.value = '';
            accessCodeInput.focus();
        }
    };

    if (submitCodeBtn) submitCodeBtn.addEventListener("click", handleCodeSubmission);
    if (accessCodeInput) {
        accessCodeInput.addEventListener("keypress", (e) => { if (e.key === 'Enter') handleCodeSubmission(); });
        accessCodeInput.focus();
    }
}

/**
 * Renders the full Match Insights UI (score card, stat chips, charts, game tabs)
 * into the given container using data that was already fetched & validated.
 */
function renderMatchInsights(match, insightsData, metricsContainer) {
    const { allPoints, gameMap, uniqueGames } = insightsData;
    const graphStatus = document.getElementById("graph-status");

    // Player names for labeling
    const homePlayerName = match.playerHome1Name || "Home Player";
    const visitingPlayerName = match.playerVisiting1Name || "Visiting Player";

    let homeGamesWon = 0;
    let visitingGamesWon = 0;

    // We'll store final game scores for a bar chart
    const homeGameScores = [];
    const visitingGameScores = [];
    const gameLabels = [];

    uniqueGames.forEach(gameNum => {
        const eventsInGame = gameMap[gameNum].sort((a, b) => new Date(a.StartDate) - new Date(b.StartDate));
        const finalLeft = eventsInGame[eventsInGame.length - 1].Points_left;
        const finalRight = eventsInGame[eventsInGame.length - 1].Points_right;
        gameLabels.push(`Game ${gameNum}`);
        homeGameScores.push(finalLeft);
        visitingGameScores.push(finalRight);
        if (finalLeft > finalRight) homeGamesWon++;
        else if (finalRight > finalLeft) visitingGamesWon++;
    });

    // Overall match length stats
    const firstTime = new Date(allPoints[0].StartDate);
    const lastTime = new Date(allPoints[allPoints.length - 1].StartDate);
    const matchLengthSec = (lastTime - firstTime) / 1000;

    // Calculate total actual point play time for the entire match, excluding points > 2 min
    let totalPointPlayTimeSec = 0;
    let validPointsCount = 0;
    let longestPointSec = 0;
    const MAX_POINT_DURATION_SEC = 120; // 2 minutes

    for (let gameNum of uniqueGames) {
        const pointsInGame = gameMap[gameNum].sort((a, b) => new Date(a.StartDate) - new Date(b.StartDate));
        for (let i = 1; i < pointsInGame.length; i++) {
            const diffSec = (new Date(pointsInGame[i].StartDate) - new Date(pointsInGame[i-1].StartDate)) / 1000;
            if (diffSec <= MAX_POINT_DURATION_SEC) {
                totalPointPlayTimeSec += diffSec;
                validPointsCount++;
                if (diffSec > longestPointSec) longestPointSec = diffSec;
            }
        }
    }
    const averagePointSec = validPointsCount > 0 ? totalPointPlayTimeSec / validPointsCount : 0;

    // Average game length
    const gameLengthsSec = uniqueGames.map(g => {
        const events = gameMap[g].sort((a, b) => new Date(a.StartDate) - new Date(b.StartDate));
        const start = new Date(events[0].StartDate);
        const end = new Date(events[events.length-1].StartDate);
        return (end - start) / 1000;
    });
    const averageGameSec = gameLengthsSec.reduce((a, b) => a + b, 0) / gameLengthsSec.length;

    if (!metricsContainer) {
        console.error("Error: Metrics container not found.");
        return;
    }
    metricsContainer.innerHTML = '';

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

    // ---- Overview tab ----
    const overviewContent = document.createElement("div");
    overviewContent.classList.add("tab-content-pane");
    overviewContent.id = "overview-tab";
    overviewContent.style.display = "block";
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
        <div class="max-w-xl mx-auto mb-4 mi-chart-wrap"><canvas id="game-scores-bar-chart"></canvas></div>
    `;

    new Chart(overviewContent.querySelector('#game-scores-bar-chart').getContext('2d'), {
        type: 'bar',
        data: {
          labels: gameLabels,
          datasets: [
            { label: homePlayerName, data: homeGameScores, backgroundColor: 'rgba(239, 68, 68, 0.8)', borderRadius: 6 },
            { label: visitingPlayerName, data: visitingGameScores, backgroundColor: 'rgba(99, 102, 241, 0.8)', borderRadius: 6 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: 'top', labels: { color: '#333' } },
            title: { display: true, text: 'Game Scores', color: '#333', font: { size: 16 } }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#333' } },
            y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.1)' }, ticks: { color: '#333' } }
          }
        }
    });

    // ---- Tab nav (pill style) ----
    const tabNav = document.createElement("div");
    tabNav.id = "tab-nav";
    tabNav.classList.add("mi-tab-nav", "mb-4");

    const tabContent = document.createElement("div");
    tabContent.id = "tab-content";
    tabContent.classList.add("px-1", "pb-2");

    const overviewTabBtn = document.createElement("button");
    overviewTabBtn.innerHTML = `<span class="mi-tab-icon">${MI_ICONS.grid}</span>Overview`;
    overviewTabBtn.classList.add("mi-tab-btn");
    tabNav.appendChild(overviewTabBtn);
    tabContent.appendChild(overviewContent);

    // ---- Create a tab for each game ----
    uniqueGames.forEach(gameNum => {
        const gameTabBtn = document.createElement("button");
        gameTabBtn.innerHTML = `<span class="mi-tab-icon">${MI_ICONS.activity}</span>Game ${gameNum}`;
        gameTabBtn.classList.add("mi-tab-btn");
        tabNav.appendChild(gameTabBtn);

        const gameContent = document.createElement("div");
        gameContent.classList.add("tab-content-pane");
        gameContent.id = `game-tab-${gameNum}`;
        gameContent.style.display = "none";

        const pointsGame = gameMap[gameNum].sort((a, b) => new Date(a.StartDate) - new Date(b.StartDate));
        if (pointsGame.length === 0) {
          gameContent.innerHTML = `<div class="text-center text-gray-500 text-base py-4">No data for Game ${gameNum}</div>`;
        } else {
            const finalLeft = pointsGame[pointsGame.length - 1].Points_left;
            const finalRight = pointsGame[pointsGame.length - 1].Points_right;
            const start = new Date(pointsGame[0].StartDate);
            const end = new Date(pointsGame[pointsGame.length - 1].StartDate);
            const gameLengthSec = (end - start) / 1000;

            const intervals = [];
            let longestPointSecGame = 0;

            for (let i = 1; i < pointsGame.length; i++) {
                const diffSec = (new Date(pointsGame[i].StartDate) - new Date(pointsGame[i-1].StartDate)) / 1000;
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
        }
        tabContent.appendChild(gameContent);

        gameTabBtn.addEventListener("click", () => {
          tabContent.querySelectorAll(".tab-content-pane").forEach(pane => pane.style.display = "none");
          tabNav.querySelectorAll(".mi-tab-btn").forEach(btn => btn.classList.remove("mi-active"));
          gameContent.style.display = "block";
          gameTabBtn.classList.add("mi-active");
        });
    });

    overviewTabBtn.addEventListener("click", () => {
        tabContent.querySelectorAll(".tab-content-pane").forEach(pane => pane.style.display = "none");
        tabNav.querySelectorAll(".mi-tab-btn").forEach(btn => btn.classList.remove("mi-active"));
        overviewContent.style.display = "block";
        overviewTabBtn.classList.add("mi-active");
    });

    metricsContainer.appendChild(tabNav);
    metricsContainer.appendChild(tabContent);

    // Set initial active tab styling
    overviewTabBtn.classList.add("mi-active");

    const matchInsightsTitle = document.getElementById("match-insights-title");
    if (matchInsightsTitle) matchInsightsTitle.classList.add("text-center");

    if (graphStatus) graphStatus.textContent = "";
}

    
function closeGraphModal() {
    const graphModal = document.getElementById("graph-modal");
    if (!graphModal) return;
    graphModal.style.display = "none";
    graphModal.classList.remove("mi-open");
    document.body.classList.remove('no-scroll');
}
document.getElementById("graph-close").addEventListener("click", closeGraphModal);
window.addEventListener("click", function (event) {
    const graphModal = document.getElementById("graph-modal");
    if (event.target == graphModal) closeGraphModal();
});

// Function to add the "Contact Me" section to the sidebar
function addContactMeSection() {
    lucide.createIcons(); // Re-render Lucide icons for the newly added phone icon
}