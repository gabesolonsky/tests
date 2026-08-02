// Global variable for the current user's ID
let userId;
// Full name of the current user, used to resolve which side (home/visiting)
// they played in a match when match.Winner disagrees with match.wid1.
let currentUserFullName = '';
// Global AbortController to cancel requests on navigation
let abortController = new AbortController();

// Define RATING_TIERS globally for consistency
const RATING_TIERS = [
  { name: 'Beginner', min: 0, max: 3.5 },
  { name: 'Intermediate', min: 3.5, max: 4.5 },
  { name: 'Advanced', min: 4.5, max: 5.5 },
  { name: 'Semi-pro', min: 5.5, max: 6.5 },
  { name: 'Pro', min: 6.5, max: Infinity }
];

const MATCH_INSIGHTS_ACCESS_CODE = "0";
const SESSION_STORAGE_KEY_MATCH_INSIGHTS = 'matchInsightsAccessGranted';
const CONTACT_PHONE_NUMBER = "301-347-8710";

/**
 * Toggles the sidebar visibility by adding/removing a class on the main app container.
 */
function toggleSidebar() {
  document.getElementById("app").classList.toggle("sidebar-collapsed");
}

/**
 * Updates the rank percentage text and progress bar element dynamically.
 */
function updateRankProgressDisplay(currentRating, tier) {
  const progressTextEl = document.getElementById('rank-progress-text');
  const progressBarEl = document.getElementById('rank-progress-bar');

  if (!tier || tier.max === Infinity) {
    if (progressTextEl) {
      progressTextEl.textContent = "Max rank reached!";
      progressTextEl.classList.remove('italic');
    }
    if (progressBarEl) progressBarEl.style.width = '100%';
    return;
  }

  const range = tier.max - tier.min;
  const progress = currentRating - tier.min;
  let percentage = Math.round((progress / range) * 100);
  percentage = Math.min(Math.max(percentage, 0), 100);

  if (progressTextEl) {
    progressTextEl.textContent = `${percentage}% through your rank`;
    progressTextEl.classList.remove('italic');
  }
  if (progressBarEl) {
    progressBarEl.style.width = `${percentage}%`;
  }
}

/**
 * Fetches and displays the user's current singles rating and related stats.
 * @param {string} currentUserId - The ID of the user to fetch data for.
 */
async function fetchCurrentUserRating(currentUserId) {
  try {
    const res = await fetch(`/proxy/user/${currentUserId}/ratings`, { signal: abortController.signal });
    if (!res.ok) throw new Error(`Network response was not ok. Status: ${res.status}`);
    const data = await res.json();

    const currentRatingEl = document.getElementById("current-rating");
    const statusIndicatorEl = document.getElementById("status-indicator");
    const currentTierNameDisplayEl = document.getElementById('current-tier-name-display');

        // Try to find the Singles International Rating entry (case-insensitive 'singles').
        let ratingObj = data.find(r => /singles/i.test(r.ratingTypeName || '')) || data.find(r => r.ratingTypeName === "Singles International Rating");

        // Helper to extract a numeric rating from possible fields
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

        // If not found yet, look for any entry that has a numeric rating (prefer singles if possible)
        if (isNaN(parsedRating)) {
            // first try any entry with 'singles' in the type
            const singlesFallback = data.find(r => /singles/i.test(r.ratingTypeName || ''));
            if (singlesFallback) parsedRating = extractNumeric(singlesFallback);
        }
        if (isNaN(parsedRating)) {
            // otherwise use the first numeric rating we can find
            for (const entry of data) {
                const v = extractNumeric(entry);
                if (!isNaN(v)) { parsedRating = v; break; }
            }
        }

        if (!isNaN(parsedRating)) {
            const currentRating = parsedRating;
            currentRatingEl.textContent = `${currentRating.toFixed(2)}`;
            statusIndicatorEl.textContent = "Active";
            statusIndicatorEl.className = "inline-block bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-1 rounded-full";
      
            const currentTier = RATING_TIERS.find(tier => currentRating >= tier.min && currentRating < tier.max);
            const currentTierIndex = RATING_TIERS.findIndex(tier => currentRating >= tier.min && currentRating < tier.max);

            if (currentTierNameDisplayEl) {
                currentTierNameDisplayEl.textContent = currentTier ? currentTier.name : 'N/A';
            }

            // Calculate and display rank progress percentage
            updateRankProgressDisplay(currentRating, currentTier);
      
            const tooltipContentEl = document.getElementById('rating-tooltip-content');
            if (tooltipContentEl && currentTier && currentTierIndex < RATING_TIERS.length - 1) {
                    const nextTier = RATING_TIERS[currentTierIndex + 1];
                    const ratingNeeded = nextTier.min - currentRating;
                    tooltipContentEl.innerHTML = `
                            <p><span class="font-semibold">Current Tier:</span> ${currentTier.name} (${currentTier.min} - ${nextTier.min})</p>
                            <p><span class="font-semibold">Next Tier:</span> ${nextTier.name} (${nextTier.min}+)</p>
                            <hr class="my-1 border-gray-600">
                            <p>You need <span class="font-bold text-indigo-300">${ratingNeeded.toFixed(2)}</span> more points to reach the ${nextTier.name} tier.</p>
                    `;
            } else if (tooltipContentEl) {
                    tooltipContentEl.innerHTML = '<p>You are at the highest tier!</p>';
            }

        } else {
            // No valid rating available — show neutral N/A instead of marking the player "Inactive".
            console.debug('No numeric rating found for user', currentUserId, 'ratings payload:', data);
            currentRatingEl.textContent = "N/A";
            statusIndicatorEl.textContent = "N/A";
            statusIndicatorEl.className = "inline-block bg-gray-100 text-gray-700 text-xs font-semibold px-2 py-1 rounded-full";
            if (currentTierNameDisplayEl) {
                    currentTierNameDisplayEl.textContent = 'N/A';
            }
            const progressTextEl = document.getElementById('rank-progress-text');
            if (progressTextEl) {
                progressTextEl.textContent = "N/A";
                progressTextEl.classList.remove('italic');
            }
    }
  } catch (err) {
    console.error("Error fetching current rating:", err);
    document.getElementById("current-rating").textContent = "Error";
    const progressTextEl = document.getElementById('rank-progress-text');
    if (progressTextEl) {
        progressTextEl.textContent = "Unable to calculate rank progress";
        progressTextEl.classList.remove('italic');
    }
  }
}

/**
 * Fetches and renders the user's weekly rankings, showing changes from the previous week.
 * @param {string} currentUserId - The ID of the user.
 */
async function fetchWeeklyRankings(currentUserId) {
    const rankingsContainer = document.getElementById("weekly-rankings-list");
    if (!rankingsContainer) return;
    rankingsContainer.innerHTML = '<p class="text-center text-gray-500 mt-10">Loading rankings...</p>';

    try {
        const rankingsResponse = await fetch(`/proxy/user/${currentUserId}/rankings`, { signal: abortController.signal });
        if (!rankingsResponse.ok) throw new Error(`Rankings API HTTP error! status: ${rankingsResponse.status}`);
        
        const rankingsData = await rankingsResponse.json();
        if (rankingsData.length === 0) {
            rankingsContainer.innerHTML = '<p class="text-center text-gray-500 mt-10">No ranking history available.</p>';
            return;
        }

        const allDivisionRatings = rankingsData.filter(entry => entry.DivisionName === "All").map(entry => ({ rating: entry.Rating, date: new Date(entry.RankingPeriod) }));
        if (allDivisionRatings.length > 0) {
            const highestEntry = allDivisionRatings.reduce((max, entry) => (entry.rating > max.rating ? entry : max), allDivisionRatings[0]);
            document.getElementById("highest-rating").textContent = highestEntry.rating.toFixed(2);
            document.getElementById("highest-rating-date").textContent = `(${highestEntry.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })})`;
        }

        const uniqueDates = [...new Set(rankingsData.map(entry => new Date(entry.RankingPeriod).toISOString().split('T')[0]))].sort((a, b) => new Date(b) - new Date(a));
        const mostRecentDateString = uniqueDates[0];
        const previousWeekDateString = uniqueDates[1]; 
        const currentWeekRankings = rankingsData.filter(entry => new Date(entry.RankingPeriod).toISOString().split('T')[0] === mostRecentDateString);

        let previousWeekRankingsMap = new Map();
        if (previousWeekDateString) {
            const previousWeekRankings = rankingsData.filter(entry => new Date(entry.RankingPeriod).toISOString().split('T')[0] === previousWeekDateString);
            previousWeekRankingsMap = new Map(previousWeekRankings.map(r => [`${r.DivisionName}-${r.RatingGroupDescr}`, r.Ranking]));
        }

        let rankingsHtml = '';
        if (currentWeekRankings.length > 0) {
            const mostRecentDate = new Date(mostRecentDateString);
            rankingsHtml += `<p class="text-sm text-gray-500 mb-3">As of: <span class="font-medium text-gray-800">${mostRecentDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></p>`;
            rankingsHtml += '<ul class="space-y-3">';
            
            currentWeekRankings.forEach(ranking => {
                const previousRank = previousWeekRankingsMap.get(`${ranking.DivisionName}-${ranking.RatingGroupDescr}`);
                let changeHtml = '<div class="text-xs text-gray-400">New</div>';
                if (previousRank !== undefined) {
                    const change = previousRank - ranking.Ranking;
                    if (change > 0) {
                        changeHtml = `<div class="flex items-center gap-1 text-green-600"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg><span class="text-xs font-medium">${change}</span></div>`;
                    } else if (change < 0) {
                        changeHtml = `<div class="flex items-center gap-1 text-red-600"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7 7 7-7"/><path d="M12 5v14"/></svg><span class="text-xs font-medium">${Math.abs(change)}</span></div>`;
                    } else {
                        changeHtml = `<div class="text-xs text-gray-400">-</div>`;
                    }
                }

                rankingsHtml += `<li class="flex items-center justify-between p-3 bg-white/60 backdrop-blur-sm border border-gray-200/80 rounded-xl shadow-sm transition-all hover:shadow-md hover:bg-white"><div><div class="font-semibold text-gray-800">${ranking.DivisionName}</div><div class="text-sm text-gray-500">${ranking.RatingGroupDescr}</div></div><div class="flex flex-col items-end"><span class="text-xl font-bold text-indigo-600">${ranking.Ranking}</span><div class="h-4">${changeHtml}</div></div></li>`;
            });
            rankingsHtml += '</ul>';
        } else {
            rankingsHtml = '<p class="text-center text-gray-500 mt-10">No rankings found for the current week.</p>';
        }
        rankingsContainer.innerHTML = rankingsHtml;

    } catch (error) {
        console.error("Error fetching or rendering weekly rankings:", error);
        rankingsContainer.innerHTML = '<p class="text-center text-red-500 mt-10">Error loading rankings.</p>';
    }
}


/**
 * Fetches and displays the user's match statistics.
 * @param {string} currentUserId - The ID of the user.
 */
async function fetchMatchStatistics(currentUserId) {
    try {
        const response = await fetch(`/proxy/user/${currentUserId}/record`, { signal: abortController.signal });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const recordData = await response.json();
        let totalWins = 0;
        let totalLosses = 0;

        recordData.forEach(entry => {
            totalWins += entry.matchesWon || 0;
            totalLosses += entry.matchesLost || 0;
            
            const winsEl = document.getElementById(`wins-${entry.matchesType}-game`);
            const lossesEl = document.getElementById(`losses-${entry.matchesType}-game`);

            if (winsEl) winsEl.textContent = entry.matchesWon || 0;
            if (lossesEl) lossesEl.textContent = entry.matchesLost || 0;
        });
        
        const totalMatches = totalWins + totalLosses;
        document.getElementById('matches-played-total').textContent = totalMatches;
        const winPercentage = totalMatches > 0 ? `${((totalWins / totalMatches) * 100).toFixed(0)}%` : '0%';
        document.getElementById('wins').textContent = totalWins;
        document.getElementById('losses').textContent = totalLosses;
        document.getElementById('win-percentage').textContent = winPercentage;
        document.getElementById('win-rate-display').textContent = winPercentage;

    } catch (error) {
        console.error("Error fetching or rendering match statistics:", error);
    }
}

/**
 * Calculates the average opponent rating using ONLY the ratings embedded in
 * each match object (w1Rating / o1Rating). No additional API calls are made
 * (previously this fetched /ratings-top for every opponent).
 * @param {number} matchesToConsider - The number of recent matches to analyze.
 * @param {Array} allMatches - The complete list of the user's matches.
 */
async function calculateAverageOpponentRating(matchesToConsider, allMatches) {
    const avgOpponentRatingEl = document.getElementById('average-opponent-rating');
    const opponentRatingStatusEl = document.getElementById('opponent-rating-status');

    if (avgOpponentRatingEl) avgOpponentRatingEl.textContent = "Loading...";
    if (opponentRatingStatusEl) opponentRatingStatusEl.textContent = "";

    if (!allMatches || allMatches.length === 0) {
        if (avgOpponentRatingEl) avgOpponentRatingEl.textContent = "N/A";
        if (opponentRatingStatusEl) opponentRatingStatusEl.textContent = "No matches found.";
        return;
    }

    const uid = parseInt(userId, 10);
    const recentMatches = allMatches.slice(0, matchesToConsider);
    const opponentRatings = [];

    recentMatches.forEach(match => {
        const rating = getOpponentRatingFromMatch(match, uid);
        if (!isNaN(rating)) opponentRatings.push(rating);
    });

    if (opponentRatings.length > 0) {
        const averageRating = (opponentRatings.reduce((sum, rating) => sum + rating, 0) / opponentRatings.length).toFixed(2);
        avgOpponentRatingEl.textContent = averageRating;
        if (opponentRatingStatusEl) opponentRatingStatusEl.textContent = `Based on last ${opponentRatings.length} matches.`;
    } else {
        avgOpponentRatingEl.textContent = "N/A";
        if (opponentRatingStatusEl) opponentRatingStatusEl.textContent = "No valid opponent data found.";
    }
}

/**
 * Fetches and displays the monthly rating changes for the user with a modernized UI.
 * Each month is clickable and opens a modal listing every match played that month.
 * @param {string} currentUserId - The ID of the user.
 * @param {Array} allMatches - The complete list of the user's matches (for the click-through modal).
 */
async function fetchAndDisplayMonthlyRatingChanges(currentUserId, allMatches) {
    const container = document.getElementById("monthly-rating-change-list");
    if (!container) return;
    container.innerHTML = '<p class="text-center text-gray-500 mt-10">Loading data...</p>';

    try {
        const response = await fetch(`/proxy/user/${currentUserId}/rankings`, { signal: abortController.signal });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const rankingsData = await response.json();
        const allDivisionRatings = rankingsData.filter(entry => entry.DivisionName === "All");

        if (allDivisionRatings.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 mt-10">No rating history available.</p>';
            return;
        }

        const ratingsByMonth = {};
        allDivisionRatings.forEach(entry => {
            const date = new Date(entry.RankingPeriod);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!ratingsByMonth[monthKey]) ratingsByMonth[monthKey] = [];
            ratingsByMonth[monthKey].push({ date: date, rating: entry.Rating });
        });

        const currentYear = new Date().getFullYear();
        const yearRatings = allDivisionRatings.filter(r => new Date(r.RankingPeriod).getFullYear() === currentYear);
        let ytdChangeHtml = '<div class="text-center text-gray-500"><span class="font-semibold">YTD Change:</span> No Data</div>';

        if (yearRatings.length > 1) {
            yearRatings.sort((a, b) => new Date(a.RankingPeriod) - new Date(b.RankingPeriod));
            const ytdChange = yearRatings[yearRatings.length - 1].Rating - yearRatings[0].Rating;
            let icon = ytdChange > 0 ? 'm5 12 7-7 7 7' : 'm5 12 7 7 7-7';
            let color = ytdChange > 0 ? 'text-green-600' : (ytdChange < 0 ? 'text-red-600' : 'text-gray-600');
            let sign = ytdChange > 0 ? '+' : '';
            if (ytdChange !== 0) {
                ytdChangeHtml = `<div class="flex items-center justify-center gap-2 ${color}"><span class="font-semibold">YTD Change:</span> <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="${icon}"/><path d="M12 ${ytdChange > 0 ? '19V5' : '5v14'}"/></svg> <span class="font-semibold">${sign}${ytdChange.toFixed(2)}</span></div>`;
            } else {
                ytdChangeHtml = `<div class="flex items-center justify-center gap-2 ${color}"><span class="font-semibold">YTD Change:</span><span class="font-semibold">${ytdChange.toFixed(2)}</span></div>`;
            }
        }

        // Show the last 12 months (default view, no toggle button).
        const months = [];
        const currentDate = new Date();
        currentDate.setDate(1); // Prevent duplicate months

        for (let i = 0; i < 12; i++) {
            months.push({
                key: `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`,
                name: currentDate.toLocaleString('default', {
                    month: 'long',
                    year: 'numeric'
                })
            });

            currentDate.setMonth(currentDate.getMonth() - 1);
        }

        let html = `<div class="mb-4 p-2 bg-gray-100 rounded-lg">${ytdChangeHtml}</div><ul class="space-y-3">`;
        months.forEach(month => {
            const monthRatings = ratingsByMonth[month.key];
            let changeHtml = '<span class="text-sm font-medium text-gray-500">No Data</span>';
            if (monthRatings && monthRatings.length > 0) {
                monthRatings.sort((a, b) => a.date - b.date);
                const change = monthRatings[monthRatings.length - 1].rating - monthRatings[0].rating;
                let color = change > 0 ? 'text-green-600' : (change < 0 ? 'text-red-600' : 'text-gray-500');
                let sign = change > 0 ? '+' : '';
                if (change !== 0) {
                     let icon = change > 0 ? 'm5 12 7-7 7 7' : 'm5 12 7 7 7-7';
                     changeHtml = `<div class="flex items-center gap-1 ${color}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="${icon}"/><path d="M12 ${change > 0 ? '19V5' : '5v14'}"/></svg><span class="text-md font-bold">${sign}${change.toFixed(2)}</span></div>`;
                } else {
                    changeHtml = `<span class="text-md font-bold ${color}">${change.toFixed(2)}</span>`;
                }
            }
            html += `<li class="flex items-center justify-between p-3 bg-white/60 backdrop-blur-sm border border-gray-200/80 rounded-xl shadow-sm cursor-pointer hover:bg-white hover:border-indigo-200 hover:shadow-md transition-all" data-month-key="${month.key}" data-month-name="${month.name}"><div><div class="font-semibold text-gray-800">${month.name}</div></div><div class="flex items-center gap-2"><div class="flex flex-col items-end"><div class="h-5">${changeHtml}</div></div><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></div></li>`;
        });
        html += '</ul>';
        container.innerHTML = html;

        // Make each month row clickable -> show every match played that month
        container.querySelectorAll('li[data-month-key]').forEach(li => {
            li.addEventListener('click', () => {
                const key = li.dataset.monthKey;
                const monthName = li.dataset.monthName;
                const monthMatches = (allMatches || []).filter(m => {
                    if (!m.MatchDate) return false;
                    const d = new Date(m.MatchDate);
                    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    return mk === key;
                });
                showMatchListModal(`Matches — ${monthName}`, monthMatches, currentUserId);
            });
        });

    } catch (error) {
        console.error("Error fetching or rendering monthly rating changes:", error);
        container.innerHTML = '<p class="text-center text-red-500 mt-10">Error loading data.</p>';
    }
}

/**
 * Returns the opponent's rating embedded in the match object (no extra API call).
 *
 * Match schema:
 *   wid1     -> home player's user ID
 *   oid1     -> visiting player's user ID
 *   w1Rating -> home player's rating
 *   o1Rating -> visiting player's rating
 *
 * If the current user is the home player (wid1 === uid), the opponent is the
 * visiting player, so we use o1Rating. If the user is the visiting player
 * (oid1 === uid), the opponent is the home player, so we use w1Rating.
 */
function getOpponentRatingFromMatch(match, uid) {
    if (match.wid1 === uid) return parseFloat(match.o1Rating); // user home -> opponent is visitor
    if (match.oid1 === uid) return parseFloat(match.w1Rating); // user visiting -> opponent is home
    return NaN;
}

/**
 * Renders a single match card for the Top Wins/Losses by Opponent Rating
 * widgets, showing the opponent's rating alongside the score.
 */
function renderTopOpponentRatingCard(match, rating, userId) {
    const { didWin, opponentName } = getUserMatchOutcome(match, userId);
    const resultClass = didWin ? 'win' : 'lose';
    const score = formatMatchScoreForUser(match, didWin);
    const date = match.MatchDate ? new Date(match.MatchDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    return `<div class="event-card ${resultClass}" data-matchid="${match.Matchid}" data-home-player-name="${match.hplayer1 || 'Home Player'}" data-visiting-player-name="${match.vplayer1 || 'Visiting Player'}">
        <img src="https://ussq-img-live.s3.us-east-1.amazonaws.com/uploads%2Fussq-profile-icon-default.png" class="event-logo" alt="Match" />
        <div class="event-details">
            <p><strong>vs. ${opponentName} (${rating.toFixed(2)})</strong></p>
            <p>Score: ${score}</p>
            <p class="text-xs text-gray-500">${date}</p>
        </div>
    </div>`;
}

/**
 * Renders "Top Losses by Opponent Rating" using ONLY the rating data already
 * embedded in each match object (w1Rating / o1Rating). No additional API calls
 * are made.
 *
 * The user's side is determined by comparing their user ID to wid1 (home)
 * and oid1 (visiting). The opponent's rating is the opposite side's rating:
 *   user home (wid1 === uid)      -> opponent rating = o1Rating
 *   user visiting (oid1 === uid)  -> opponent rating = w1Rating
 * The winner is determined from the authoritative Winner field.
 */
function fetchAndDisplayTopLosses(currentUserId, allMatches) {
    const lossesContainer = document.getElementById('top-losses-list');
    if (!lossesContainer) return;

    if (!allMatches || allMatches.length === 0) {
        lossesContainer.innerHTML = '<p class="text-center text-gray-500 mt-10">No match history available.</p>';
        return;
    }

    lossesContainer.innerHTML = '<p class="text-center text-gray-500 mt-10">Analyzing losses...</p>';

    const uid = parseInt(currentUserId);
    const losses = [];

    (allMatches || []).forEach(match => {
        const rating = getOpponentRatingFromMatch(match, uid);
        if (isNaN(rating)) return; // match object has no opponent rating -> skip (no API call)
        const didWin = didUserWinMatch(match, uid, currentUserFullName);
        if (!didWin) losses.push({ rating, match });
    });

    if (losses.length === 0) {
        lossesContainer.innerHTML = '<p class="text-center text-gray-500 mt-10">No losses with rating data.</p>';
        return;
    }

    const topLosses = losses.sort((a, b) => b.rating - a.rating).slice(0, 5);
    lossesContainer.innerHTML = `<div class="space-y-3">${topLosses.map(e => renderTopOpponentRatingCard(e.match, e.rating, currentUserId)).join('')}</div>`;
}

/**
 * Fetches and displays details of the user's last match.
 * @param {string} currentUserId - The ID of the user.
 * @param {Array} allMatches - The complete list of the user's matches.
 */
function displayLastMatch(currentUserId, allMatches) {
    const container = document.getElementById("last-match-details");
    if (!container) return;
    if (!allMatches || allMatches.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 mt-10">No match history available.</p>';
        return;
    }

    const lastMatch = allMatches[0];
    const uid = parseInt(currentUserId);
    const didWin = didUserWinMatch(lastMatch, uid, currentUserFullName);
    const opponentName = getOpponentDisplayName(lastMatch, uid, currentUserFullName);
    const date = new Date(lastMatch.MatchDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    container.innerHTML = `<div class="event-card ${didWin ? "win" : "lose"}" data-matchid="${lastMatch.Matchid}" data-home-player-name="${lastMatch.hplayer1 || 'Home Player'}" data-visiting-player-name="${lastMatch.vplayer1 || 'Visiting Player'}"><img src="https://ussq-img-live.s3.us-east-1.amazonaws.com/uploads%2Fussq-profile-icon-default.png" class="event-logo" alt="Match" /><div class="event-details"><p><strong>vs. ${opponentName}</strong></p><p>Score: ${lastMatch.Score}</p><p class="text-xs text-gray-500">${date}</p></div></div>`;
}

/**
 * Fetches all matches for a user in parallel batches rather than sequentially.
 * @returns {Promise<Array>} A promise that resolves to an array of all matches.
 */
async function fetchAllMatches(currentUserId) {
    let allMatches = [];
    let page = 1;
    const BATCH_SIZE = 5; // Fetch 5 pages concurrently at a time
    let hasMore = true;

    while (hasMore) {
        // Create an array of page numbers to fetch in this batch
        const pageNumbers = Array.from({ length: BATCH_SIZE }, (_, i) => page + i);

        try {
            const fetchPromises = pageNumbers.map(p => 
                fetch(`/proxy/user/${currentUserId}/matches/page/${p}`, { signal: abortController.signal })
                    .then(res => res.ok ? res.json() : null)
                    .catch(() => null)
            );

            const results = await Promise.all(fetchPromises);

            for (const data of results) {
                if (data && data.matches && data.matches.length > 0) {
                    allMatches.push(...data.matches);
                } else {
                    hasMore = false; // Stop if any page returns no matches
                }
            }

            page += BATCH_SIZE;
        } catch (error) {
            console.error("Error fetching match batch:", error);
            hasMore = false;
        }
    }

    return allMatches.sort((a, b) => new Date(b.MatchDate) - new Date(a.MatchDate));
}

/**
 * Performs a search for players based on the query.
 * @param {string} query - The search term.
 */
async function performSearch(query) {
    const searchResultsContainer = document.getElementById('search-results');
    const formattedQuery = query.replace(/\s/g, '+');
    const apiUrl = `/proxy/resources/res/search/${formattedQuery}`;
    searchResultsContainer.innerHTML = '<div class="p-2 text-gray-500">Searching...</div>';
    searchResultsContainer.classList.remove('hidden');
    try {
        const response = await fetch(apiUrl, { signal: abortController.signal });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        displaySearchResults(await response.json());
    } catch (error) {
        console.error("Error fetching search results:", error);
        searchResultsContainer.innerHTML = '<div class="p-2 text-red-500">Error loading results.</div>';
    }
}

/**
 * Displays the search results in the dropdown.
 * @param {Array} results - The array of search result objects.
 */
function displaySearchResults(results) {
    const searchResultsContainer = document.getElementById('search-results');
    searchResultsContainer.innerHTML = '';
    if (results.length === 0) {
        searchResultsContainer.innerHTML = '<div class="p-2 text-gray-500">No results found.</div>';
        return;
    }
    results.forEach(result => {
        if (result.ObjectType !== "Player") return;
        const resultItem = document.createElement('div');
        resultItem.className = 'flex items-center gap-2 p-2 hover:bg-gray-100 cursor-pointer border-b';
        const imageUrl = result.LogoImageUrl || 'https://ussquash.org/wp-content/uploads%2Fussq-profile-icon-default.png';
        resultItem.innerHTML = `<img src="${imageUrl}" alt="${result.ObjectName}" class="w-8 h-8 rounded-full object-cover"><div><p class="text-sm font-medium">${result.ObjectName}</p><p class="text-xs text-gray-500">${result.ObjectType} ${result.ObjectLocation ? `(${result.ObjectLocation})` : ''}</p></div>`;
        resultItem.addEventListener('click', () => loadAnalyticsProfile(result.ObjectId));
        searchResultsContainer.appendChild(resultItem);
    });
}

/**
 * Loads the analytics page for a specific player.
 * @param {string} newUserId - The ID of the player to load.
 */
function loadAnalyticsProfile(newUserId) {
    window.location.href = `analytics?userId=${newUserId}`;
}

/**
 * Helper function to format seconds into MM:SS or HH:MM:SS.
 * @param {number} totalSeconds - The total seconds to format.
 * @returns {string} The formatted time string.
 */
function formatDurationSec(totalSeconds) {
    if (isNaN(totalSeconds) || totalSeconds <= 0) return "N/A";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.round(totalSeconds % 60);
    const pad = (num) => num.toString().padStart(2, '0');
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Fetches and calculates advanced match statistics like match and point durations.
 * @param {Array} allMatches - An array of the user's matches.
 */

async function fetchAdvancedMatchInsights(allMatches) {
    const insightIds = ['average-match-length', 'longest-match-length', 'shortest-match-length', 'average-point-length', 'longest-point-length', 'shortest-point-length'];
    insightIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = 'Loading...';
    });

    if (!allMatches || allMatches.length === 0) {
        insightIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = 'N/A';
        });
        return;
    }

    let matchesWithInsights = [];
    const pointLengths = [];
    const MIN_POINT_DURATION_SEC = 4;
    const MAX_POINT_DURATION_SEC = 150;
    const MIN_MATCH_DURATION_SEC = 240;

    await Promise.all(allMatches.map(async (match) => {
        try {
            const res = await fetch(`/proxy/liveScoreDetails?match_id=${match.Matchid}`, { signal: abortController.signal });
            if (!res.ok) return;
            const details = await res.json();
            if (!details || details.length < 2) return;
            const allPoints = details.filter(evt => evt.Decision === "point").sort((a, b) => new Date(a.StartDate) - new Date(b.StartDate));
            if (allPoints.length < 2) return;

            const matchStart = new Date(allPoints[0].StartDate);
            const matchEnd = new Date(allPoints[allPoints.length - 1].StartDate);
            const matchDurationSec = (matchEnd - matchStart) / 1000;

            if (matchDurationSec >= MIN_MATCH_DURATION_SEC) {
                matchesWithInsights.push({ duration: matchDurationSec, match: match });
            }

            for (let i = 1; i < allPoints.length; i++) {
                const diffSec = (new Date(allPoints[i].StartDate) - new Date(allPoints[i - 1].StartDate)) / 1000;
                if (diffSec >= MIN_POINT_DURATION_SEC && diffSec <= MAX_POINT_DURATION_SEC) {
                    pointLengths.push(diffSec);
                }
            }
        } catch (e) { /* Silently ignore */ }
    }));

    if (matchesWithInsights.length > 0) {
        const avgMatchLength = matchesWithInsights.reduce((a, b) => a + b.duration, 0) / matchesWithInsights.length;
        matchesWithInsights.sort((a, b) => a.duration - b.duration);
        const shortestMatch = matchesWithInsights[0];
        const longestMatch = matchesWithInsights[matchesWithInsights.length - 1];

        document.getElementById('average-match-length').textContent = formatDurationSec(avgMatchLength);
        document.getElementById('longest-match-length').textContent = formatDurationSec(longestMatch.duration);
        document.getElementById('shortest-match-length').textContent = formatDurationSec(shortestMatch.duration);

        const longestEl = document.getElementById('longest-match-length');
        const shortestEl = document.getElementById('shortest-match-length');
        if (longestEl) longestEl.onclick = () => showGraphModal(longestMatch.match);
        if (shortestEl) shortestEl.onclick = () => showGraphModal(shortestMatch.match);
    } else {
        ['average-match-length', 'longest-match-length', 'shortest-match-length'].forEach(id => document.getElementById(id).textContent = 'N/A');
    }

    if (pointLengths.length > 0) {
        const avgPoint = pointLengths.reduce((a, b) => a + b, 0) / pointLengths.length;
        document.getElementById('average-point-length').textContent = formatDurationSec(avgPoint);
        document.getElementById('longest-point-length').textContent = formatDurationSec(Math.max(...pointLengths));
        document.getElementById('shortest-point-length').textContent = formatDurationSec(Math.min(...pointLengths));
    } else {
        ['average-point-length', 'longest-point-length', 'shortest-point-length'].forEach(id => document.getElementById(id).textContent = 'N/A');
    }
}

// --- START: Match Insights Modal Functions ---

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
        messageBox = document.createElement('div');
        messageBox.id = 'temp-message-box';
        document.body.appendChild(messageBox);
    }
    clearTimeout(tempMessageHideTimer);
    clearTimeout(tempMessageFadeTimer);

    const icon = TEMP_MESSAGE_ICONS[type] || TEMP_MESSAGE_ICONS.info;
    messageBox.innerHTML = `${icon}<span>${message}</span>`;
    messageBox.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-lg shadow-lg z-[70] text-white transition-opacity duration-300';
    if (type === 'info') messageBox.classList.add('bg-indigo-600');
    else if (type === 'success') messageBox.classList.add('bg-green-500');
    else if (type === 'error') messageBox.classList.add('bg-red-500');
    messageBox.style.display = 'flex';
    void messageBox.offsetWidth;
    setTimeout(() => messageBox.style.opacity = '1', 10);
    tempMessageFadeTimer = setTimeout(() => {
        messageBox.style.opacity = '0';
        tempMessageHideTimer = setTimeout(() => messageBox.style.display = 'none', 300);
    }, 3000);
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
    alertCircle: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>'
};

function closeGraphModal() {
    const graphModal = document.getElementById("graph-modal");
    if (graphModal) {
        graphModal.classList.add("hidden");
        graphModal.classList.remove("mi-open");
        graphModal.style.display = "none";
        document.body.classList.remove('no-scroll');
    }
}

// Cache of already-fetched, already-validated insight data for a given match, keyed by match_id.
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
    const match_id = match.Matchid || match.matchId;

    if (matchInsightsDataCache.has(match_id)) {
        return matchInsightsDataCache.get(match_id);
    }

    let data;
    try {
        const response = await fetch(`/proxy/liveScoreDetails?match_id=${match_id}`, { signal: abortController.signal });
        if (!response.ok) throw new Error("Proxy response not ok");
        data = await response.json();
    } catch (error) {
        return null;
    }

    if (!data || data.length < 2) return null;

    const allPoints = data.filter(evt => evt.Decision === "point").sort((a, b) => new Date(a.StartDate) - new Date(b.StartDate));
    if (allPoints.length < 2) return null;

    const gameMap = {};
    allPoints.forEach(evt => {
        if (!gameMap[evt.Game_Number]) gameMap[evt.Game_Number] = [];
        gameMap[evt.Game_Number].push(evt);
    });
    const uniqueGames = Object.keys(gameMap).map(g => parseInt(g)).sort((a, b) => a - b);

    const result = { allPoints, gameMap, uniqueGames };
    matchInsightsDataCache.set(match_id, result);
    return result;
}

async function showGraphModal(match) {
    const match_id = match.Matchid || match.matchId;
    if (!match_id) {
        showTemporaryMessage("No match ID available.", "error");
        return;
    }
    const graphModal = document.getElementById("graph-modal");
    if (!graphModal) return;

    const metricsContainer = graphModal.querySelector("#metrics-container");
    const matchInsightsTitle = graphModal.querySelector("#match-insights-title");
    const matchInsightsIcon = graphModal.querySelector("#match-insights-icon");

    // Open the modal right away with a loading state.
    metricsContainer.innerHTML = renderInsightsLoadingSkeleton();
    if (matchInsightsIcon) matchInsightsIcon.innerHTML = MI_ICONS.activity;
    if (matchInsightsTitle) matchInsightsTitle.textContent = 'Match Insights';
    graphModal.classList.remove("hidden");
    graphModal.classList.add("mi-open");
    graphModal.style.display = "flex";
    document.body.classList.add('no-scroll');

    const insightsData = await fetchMatchInsightsData(match);
    if (!insightsData) {
        // No insights for this match — automatically close the modal back out
        // and just tell the person via the toast instead of leaving it open empty.
        closeGraphModal();
        showTemporaryMessage("No match insights available for this match yet.", "info");
        return;
    }

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
    metricsContainer.innerHTML = `
        <div id="code-input-area" class="text-center py-8 px-4">
            <div class="mi-lock-circle mb-4">${MI_ICONS.lock}</div>
            <h3 class="text-lg font-semibold text-gray-800 mb-1.5">Match Insights are locked</h3>
            <p class="mb-1 text-sm text-gray-500 max-w-xs mx-auto">Enter the access code to view detailed stats, game-by-game score progression, and more.</p>
            <p class="mb-5 text-sm text-gray-500">Need a code? Call <a href="tel:${CONTACT_PHONE_NUMBER}" class="text-indigo-600 font-medium hover:underline">${CONTACT_PHONE_NUMBER}</a></p>
            <div class="flex items-center justify-center gap-2 flex-wrap">
                <input type="password" id="access-code-input" class="border border-gray-300 rounded-lg px-3 py-2.5 text-center text-lg tracking-widest w-40 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="••••" autocomplete="off">
                <button id="submit-code-btn" class="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">Unlock</button>
            </div>
            <p id="code-error-message" class="flex items-center justify-center gap-1.5 text-red-500 text-sm mt-3 hidden">${MI_ICONS.alertCircle}<span>Incorrect code. Please try again.</span></p>
        </div>
    `;

    const accessCodeInput = document.getElementById('access-code-input');
    const submitCodeBtn = document.getElementById('submit-code-btn');
    const codeErrorMessage = document.getElementById('code-error-message');
    const codeInputArea = document.getElementById('code-input-area');

    const handleCodeSubmission = () => {
        if (accessCodeInput.value === MATCH_INSIGHTS_ACCESS_CODE) {
            sessionStorage.setItem(SESSION_STORAGE_KEY_MATCH_INSIGHTS, 'true');
            if (matchInsightsTitle) matchInsightsTitle.textContent = 'Match Insights';
            renderMatchInsights(match, insightsData, metricsContainer);
        } else {
            if (codeErrorMessage) codeErrorMessage.classList.remove('hidden');
            if (codeInputArea) {
                codeInputArea.classList.remove('mi-shake');
                void codeInputArea.offsetWidth;
                codeInputArea.classList.add('mi-shake');
            }
            accessCodeInput.value = '';
            accessCodeInput.focus();
        }
    };
    submitCodeBtn.addEventListener("click", handleCodeSubmission);
    accessCodeInput.addEventListener("keypress", (e) => { if (e.key === 'Enter') handleCodeSubmission(); });
    accessCodeInput.focus();
}

/**
 * Renders the full Match Insights UI (score card, stat chips, charts, game tabs)
 * into the given container using data that was already fetched & validated.
 */
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
        <div class="max-w-xl mx-auto"><canvas id="game-scores-bar-chart"></canvas></div>
    `;

    new Chart(document.getElementById('game-scores-bar-chart').getContext('2d'), {
        type: 'bar',
        data: { labels: gameLabels, datasets: [{ label: homePlayerName, data: homeGameScores, backgroundColor: 'rgba(239, 68, 68, 0.8)', borderRadius: 6 }, { label: visitingPlayerName, data: visitingGameScores, backgroundColor: 'rgba(99, 102, 241, 0.8)', borderRadius: 6 }] },
        options: { responsive: true, plugins: { title: { display: true, text: 'Game Scores' } } }
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
            <div style="max-height: 350px;"><canvas id="game-chart-${gameNum}"></canvas></div>
        `;

        const x = pointsGame.map(evt => evt.Points_left + evt.Points_right);
        const p1_scores = pointsGame.map(evt => evt.Points_left);
        const p2_scores = pointsGame.map(evt => evt.Points_right);
        const lineCanvas = gameContent.querySelector(`#game-chart-${gameNum}`);
        lineCanvas.style.maxWidth = "100%";
        lineCanvas.style.maxHeight = "350px";

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



// --- START: Shared Match Card / Match List Modal Helpers ---

/**
 * Normalizes a player name for robust comparison (collapses whitespace, lowercases).
 */
function normalizeName(name) {
    return (name || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Determines whether the current user was the home or visiting player in a
 * match, by matching their name against hplayer1/vplayer1. Returns null if
 * the user's name isn't available or doesn't clearly match either side.
 */
function isUserHomePlayer(match, userFullName) {
    const normalizedUser = normalizeName(userFullName);
    if (!normalizedUser) return null;
    const isHome = normalizeName(match.hplayer1).includes(normalizedUser);
    const isVisiting = normalizeName(match.vplayer1).includes(normalizedUser);
    if (isHome && !isVisiting) return true;
    if (isVisiting && !isHome) return false;
    return null;
}

/**
 * Determines whether the given user won a match.
 *
 * match.wid1 (winner id) is correct for the vast majority of matches, but on
 * some records the authoritative match.Winner field ("H"/"V") disagrees with
 * wid1 — e.g. a disputed/corrected result where Winner was updated but wid1
 * wasn't resynced. When Winner is present and we can confidently tell (by
 * name) which side the user played, Winner takes priority over wid1.
 */
function didUserWinMatch(match, uid, userFullName) {
    const widSaysWin = match.wid1 === uid;

    if (match.Winner === 'H' || match.Winner === 'V') {
        const isHome = isUserHomePlayer(match, userFullName);
        if (isHome !== null) {
            return isHome ? match.Winner === 'H' : match.Winner === 'V';
        }
    }

    return widSaysWin;
}

/**
 * Determines the opponent's display name for a match, preferring a name-based
 * home/visiting resolution over the wid1 heuristic (see didUserWinMatch).
 */
function getOpponentDisplayName(match, uid, userFullName) {
    const isHome = isUserHomePlayer(match, userFullName);
    if (isHome !== null) return isHome ? match.vplayer1 : match.hplayer1;
    return match.wid1 === uid ? match.vplayer1 : match.hplayer1;
}


/**
 * Determines whether the given user won a match and who their opponent was.
 * @param {object} match - A match object from the matches API.
 * @param {string|number} userId - The user's id.
 */
function getUserMatchOutcome(match, userId) {
    const uid = parseInt(userId);
    const didWin = didUserWinMatch(match, uid, currentUserFullName);
    const opponentName = getOpponentDisplayName(match, uid, currentUserFullName) || 'Opponent';
    return { didWin, opponentName };
}

/**
 * Formats a match's per-game "Score" string (e.g. "11-5,7-11,11-9") so the
 * given user's own score is always listed first, regardless of which side
 * of the raw data they were recorded as.
 */
function formatMatchScoreForUser(match, didWin) {
    if (!match.Score) return 'N/A';
    const games = match.Score.split(',');
    const formattedGames = games.map(game => {
        const parts = game.trim().split('-');
        if (parts.length !== 2) return game.trim();
        const [left, right] = parts;
        return didWin ? `${left}-${right}` : `${right}-${left}`;
    });
    return formattedGames.join(', ');
}

/**
 * Renders a single match as the same "event-card" style used elsewhere in analytics,
 * wired up with the data attributes setupModalListeners() expects for click-through
 * to the detailed Match Insights modal.
 */
function renderMatchEventCardHTML(match, userId) {
    const { didWin, opponentName } = getUserMatchOutcome(match, userId);
    const resultClass = didWin ? 'win' : 'lose';
    const score = formatMatchScoreForUser(match, didWin);
    const date = match.MatchDate ? new Date(match.MatchDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    return `<div class="event-card ${resultClass}" data-matchid="${match.Matchid}" data-home-player-name="${match.hplayer1 || 'Home Player'}" data-visiting-player-name="${match.vplayer1 || 'Visiting Player'}">
        <img src="https://ussq-img-live.s3.us-east-1.amazonaws.com/uploads%2Fussq-profile-icon-default.png" class="event-logo" alt="Match" />
        <div class="event-details">
            <p><strong>vs. ${opponentName}</strong></p>
            <p>Score: ${score}</p>
            <p class="text-xs text-gray-500">${date}</p>
        </div>
    </div>`;
}

/**
 * Opens the generic match-list modal with a title and a set of matches
 * (used for "matches this month" and "comeback wins").
 */
function showMatchListModal(title, matches, userId) {
    const modal = document.getElementById('match-list-modal');
    const titleEl = document.getElementById('match-list-title');
    const bodyEl = document.getElementById('match-list-body');
    if (!modal || !bodyEl) return;

    if (titleEl) titleEl.textContent = title;

    if (!matches || matches.length === 0) {
        bodyEl.innerHTML = '<p class="text-center text-gray-500 py-10">No matches found.</p>';
    } else {
        const sorted = [...matches].sort((a, b) => new Date(b.MatchDate) - new Date(a.MatchDate));
        bodyEl.innerHTML = `<div class="space-y-3">${sorted.map(m => renderMatchEventCardHTML(m, userId)).join('')}</div>`;
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeMatchListModal() {
    const modal = document.getElementById('match-list-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

/**
 * Computes the user's current streak plus their all-time highest win and loss streaks.
 * @param {Array} allMatches - The complete list of the user's matches.
 * @param {string|number} userId - The user's id.
 */
function computeStreaks(allMatches, userId) {
    const uid = parseInt(userId);
    const sorted = (allMatches || [])
        .filter(m => (m.wid1 === uid || m.oid1 === uid) && m.MatchDate)
        .sort((a, b) => new Date(a.MatchDate) - new Date(b.MatchDate));

    let highestWinStreak = 0, highestLossStreak = 0;
    let runWin = 0, runLoss = 0;

    sorted.forEach(m => {
        if (didUserWinMatch(m, uid, currentUserFullName)) {
            runWin++; runLoss = 0;
            if (runWin > highestWinStreak) highestWinStreak = runWin;
        } else {
            runLoss++; runWin = 0;
            if (runLoss > highestLossStreak) highestLossStreak = runLoss;
        }
    });

    let currentStreakType = null, currentStreakCount = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
        const type = didUserWinMatch(sorted[i], uid, currentUserFullName) ? 'W' : 'L';
        if (currentStreakType === null) {
            currentStreakType = type;
            currentStreakCount = 1;
        } else if (type === currentStreakType) {
            currentStreakCount++;
        } else {
            break;
        }
    }

    return { currentStreakType, currentStreakCount, highestWinStreak, highestLossStreak };
}

function renderStreaks(container, streaks) {
    if (!container) return;
    if (!streaks.currentStreakType) {
        container.innerHTML = '<p class="text-center text-gray-500 mt-10">No match history available.</p>';
        return;
    }
    const isWinStreak = streaks.currentStreakType === 'W';
    container.innerHTML = `
        <div class="flex justify-between items-center p-3 rounded-xl ${isWinStreak ? 'bg-green-100' : 'bg-red-100'}">
            <span class="font-medium text-gray-700">Current ${isWinStreak ? 'Win' : 'Loss'} Streak</span>
            <span class="text-lg font-bold ${isWinStreak ? 'text-green-600' : 'text-red-600'}">${streaks.currentStreakCount}${isWinStreak ? 'W' : 'L'}</span>
        </div>
        <div class="flex justify-between items-center p-2">
            <span class="text-gray-600">Highest Win Streak</span>
            <span id="streak-highest-win" class="stat-clickable px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold cursor-pointer hover:bg-green-200 transition-colors" data-stat-type="highest-win-streak">${streaks.highestWinStreak}</span>
        </div>
        <div class="flex justify-between items-center p-2">
            <span class="text-gray-600">Highest Loss Streak</span>
            <span id="streak-highest-loss" class="stat-clickable px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold cursor-pointer hover:bg-red-200 transition-colors" data-stat-type="highest-loss-streak">${streaks.highestLossStreak}</span>
        </div>
    `;
}
/**
 * Determines whether a match is a "comeback win" using the exact game
 * progression from the user's perspective (best-of-5, first to 3 games):
 *
 *   L W W W   (lost game 1, then won the next 3)
 *   L L W W W (lost the first 2 games, then won the next 3)
 *   W L L W W (won game 1, lost games 2-3, then won games 4-5)
 *   L W L W W (lost game 1, won game 2, lost game 3, then won games 4-5)
 *
 * Only completed matches (Status 'C' or 'RE', mirroring script.js's
 * isRenderableCompletedMatch) are considered. The winner is resolved with the
 * authoritative didUserWinMatch (Winner field "H"/"V" takes priority, with
 * name-based home/visiting resolution), so corrected/disputed records and
 * forfeits (e.g. Status 'DF', "0-11,0-11,0-11") are handled correctly.
 */
function isComebackWin(match, uid, userFullName) {
    const status = match.Status ? String(match.Status).toUpperCase() : '';
    if (status !== 'C' && status !== 'RE') return false;

    const didWin = didUserWinMatch(match, uid, userFullName);
    if (!didWin) return false;

    if (!match.Score) return false;

    const games = String(match.Score).split(',').map(g => g.trim()).filter(Boolean);
    if (games.length < 3 || games.length > 5) return false; // best-of-5

    const sequence = games.map(g => {
        const parts = g.split('-').map(n => parseInt(n, 10));
        if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
        // The match winner's per-game score is always listed FIRST in match.Score
        const userScore = didWin ? parts[0] : parts[1];
        const oppScore = didWin ? parts[1] : parts[0];
        if (userScore === oppScore) return null;
        return userScore > oppScore ? 'W' : 'L';
    });

    if (sequence.includes(null)) return false;
    const seq = sequence.join('');

    // Exact comeback patterns only
    return seq === 'LWWW' || seq === 'LLWWW' || seq === 'WLLWW' || seq === 'LWLWW';
}

/**
 * Legacy alias for isComebackWin.
 */
function isComeback(match, userId) {
    return isComebackWin(match, parseInt(userId, 10), currentUserFullName);
}

/**
 * Renders the Comeback Tracker widget inside the specified container.
 *
 * Shows four stats:
 *   - Comeback Wins        : wins after trailing in games (clickable -> list)
 *   - Comeback Win %       : Comeback Wins ÷ Matches Where You Trailed
 *   - Reverse Sweeps       : wins from 0-2 down (LLWWW)
 *   - Reverse Sweep %      : Reverse Sweeps ÷ Matches Trailing 0-2
 */
function renderComebackTracker(container, stats, userId) {
    if (!container) return;

    const noComebacks = !stats.comebackMatches || stats.comebackMatches.length === 0;

    container.innerHTML = `
        ${noComebacks ? '' : `
        <div id="comeback-count-trigger" class="flex justify-between items-center p-3 rounded-xl bg-indigo-100 cursor-pointer hover:bg-indigo-200 transition-colors">
            <span class="font-medium text-gray-700">Comeback Wins</span>
            <span class="text-lg font-bold text-indigo-600">${stats.totalComebacks}</span>
        </div>`}
        <div class="grid grid-cols-2 gap-2 ${noComebacks ? '' : 'pt-2'}">
            <div class="bg-gray-100 p-3 rounded-xl text-center border border-gray-200">
                <p class="text-xs text-gray-500 font-medium">Comeback Win %</p>
                <p class="text-lg font-bold text-indigo-600 mt-1">${stats.comebackWinRate}%</p>
                <p class="text-[10px] text-gray-500">${stats.totalComebacks}/${stats.trailingMatches} won when trailing</p>
            </div>
            <div class="bg-gray-100 p-3 rounded-xl text-center border border-gray-200">
                <p class="text-xs text-gray-500 font-medium">Reverse Sweeps</p>
                <p class="text-lg font-bold text-indigo-600 mt-1">${stats.reverseSweeps}</p>
                <p class="text-[10px] text-gray-500">Won from 0-2 down</p>
            </div>
            <div class="bg-gray-100 p-3 rounded-xl text-center border border-gray-200">
                <p class="text-xs text-gray-500 font-medium">Reverse Sweep %</p>
                <p class="text-lg font-bold text-indigo-600 mt-1">${stats.reverseSweepRate}%</p>
                <p class="text-[10px] text-gray-500">${stats.reverseSweeps}/${stats.trailing0_2Matches} won from 0-2</p>
            </div>
            <div class="bg-gray-100 p-3 rounded-xl text-center border border-gray-200">
                <p class="text-xs text-gray-500 font-medium">Trailing Matches</p>
                <p class="text-lg font-bold text-indigo-600 mt-1">${stats.trailingMatches}</p>
                <p class="text-[10px] text-gray-500">Opportunities to come back</p>
            </div>
        </div>
        <p class="text-xs text-gray-500 mt-2 text-center">${noComebacks ? 'No comeback wins yet — a comeback is a win after trailing in games.' : 'Tap Comeback Wins to view matches.'}</p>
    `;

    const trigger = container.querySelector('#comeback-count-trigger');
    if (trigger) {
        trigger.addEventListener('click', () => showMatchListModal('Comeback Wins', stats.comebackMatches, userId));
    }
}

// --- END: Shared Match Card / Match List Modal Helpers ---


function setupModalListeners() {
    const containers = [ document.getElementById('top-losses-list'), document.getElementById('last-match-details'), document.getElementById('match-list-body') ];
    containers.forEach(container => {
        if (container) {
            container.addEventListener('click', (event) => {
                const clickedCard = event.target.closest('.event-card');
                if (clickedCard) {
                    const match = {
                        Matchid: clickedCard.dataset.matchid,
                        hplayer1: clickedCard.dataset.homePlayerName,
                        vplayer1: clickedCard.dataset.visitingPlayerName
                    };
                    if (match.Matchid) showGraphModal(match);
                }
            });
        }
    });

    const graphModal = document.getElementById("graph-modal");
    const closeButton = document.getElementById("graph-close");
    if (closeButton) closeButton.addEventListener("click", closeGraphModal);
    if (graphModal) graphModal.addEventListener("click", (e) => { if (e.target === graphModal) closeGraphModal(); });

    const matchListModal = document.getElementById("match-list-modal");
    const matchListClose = document.getElementById("match-list-close");
    if (matchListClose) matchListClose.addEventListener("click", closeMatchListModal);
    if (matchListModal) matchListModal.addEventListener("click", (e) => { if (e.target === matchListModal) closeMatchListModal(); });
}

/**
 * Wires up the clickable stat badges in the Match Statistics and Streaks cards.
 * Each badge carries a data-stat-type that maps to a filter over allMatches.
 * @param {Array} allMatches - The complete list of the user's matches.
 * @param {string|number} currentUserId - The user's id.
 */
function setupMatchStatClickListeners(allMatches, currentUserId) {
    const uid = parseInt(currentUserId, 10);
    const container = document.getElementById('app');

    if (!container) return;

    // Delegate clicks on any .stat-clickable badge
    container.addEventListener('click', (event) => {
        const badge = event.target.closest('.stat-clickable');
        if (!badge) return;

        const type = badge.getAttribute('data-stat-type');
        if (!type) return;

        let filteredMatches = [];
        let title = 'Matches';

        switch (type) {
            case 'wins':
                filteredMatches = (allMatches || []).filter(m => didUserWinMatch(m, uid, currentUserFullName));
                title = 'Wins';
                break;
            case 'losses':
                filteredMatches = (allMatches || []).filter(m => !didUserWinMatch(m, uid, currentUserFullName));
                title = 'Losses';
                break;
            case 'wins-3':
            case 'wins-4':
            case 'wins-5': {
                const gameCount = parseInt(type.split('-')[1], 10);
                filteredMatches = (allMatches || []).filter(m => {
                    if (!didUserWinMatch(m, uid, currentUserFullName)) return false;
                    const games = (m.Score || '').split(',').filter(g => g.trim() !== '');
                    return games.length === gameCount;
                });
                title = `${gameCount}-Game Wins`;
                break;
            }
            case 'losses-3':
            case 'losses-4':
            case 'losses-5': {
                const gameCount = parseInt(type.split('-')[1], 10);
                filteredMatches = (allMatches || []).filter(m => {
                    if (didUserWinMatch(m, uid, currentUserFullName)) return false;
                    const games = (m.Score || '').split(',').filter(g => g.trim() !== '');
                    return games.length === gameCount;
                });
                title = `${gameCount}-Game Losses`;
                break;
            }
            case 'highest-win-streak':
            case 'highest-loss-streak': {
                const wantWins = type === 'highest-win-streak';
                const sorted = (allMatches || [])
                    .filter(m => (m.wid1 === uid || m.oid1 === uid) && m.MatchDate)
                    .sort((a, b) => new Date(a.MatchDate) - new Date(b.MatchDate));

                let longest = [];
                let run = [];

                sorted.forEach(m => {
                    const won = didUserWinMatch(m, uid, currentUserFullName);
                    const inRun = wantWins ? won : !won;
                    if (inRun) {
                        run.push(m);
                    } else {
                        if (run.length > longest.length) longest = run.slice();
                        run = [];
                    }
                });
                if (run.length > longest.length) longest = run.slice();

                filteredMatches = longest;
                title = `Longest ${wantWins ? 'Win' : 'Loss'} Streak`;
                break;
            }
            default:
                return;
        }

        showMatchListModal(title, filteredMatches, currentUserId);
    });
}


// --- END: Match Insights Modal Functions ---

/**
 * Evaluates match comeback metrics:
 *   - Comeback Wins        : wins after trailing in games
 *   - Comeback Win %       : Comeback Wins ÷ Matches Where You Trailed
 *   - Reverse Sweeps       : wins from 0-2 down (LLWWW)
 *   - Reverse Sweep %      : Reverse Sweeps ÷ Matches Trailing 0-2
 *
 * "Trailed" means the user was behind 0-1, 0-2, or 1-2 in games at some
 * point in the match. Only completed matches (Status 'C' / 'RE', mirroring
 * script.js isRenderableCompletedMatch) are considered, so forfeits and
 * default wins (e.g. Status 'DF', "0-11,0-11,0-11") are excluded.
 */
function computeComebackStats(allMatches, userId) {
    const uid = parseInt(userId, 10);
    let totalComebacks = 0;
    let trailingMatches = 0;
    let reverseSweeps = 0;
    let trailing0_2Matches = 0;

    const comebackMatches = [];

    (allMatches || []).forEach(match => {
        if (!match.Score) return;

        // Only consider completed matches (mirrors script.js isRenderableCompletedMatch).
        const status = match.Status ? String(match.Status).toUpperCase() : '';
        if (status !== 'C' && status !== 'RE') return;

        const games = match.Score.split(',').map(g => g.trim()).filter(Boolean);
        if (games.length === 0) return;

        // The match winner's per-game score is always listed FIRST in match.Score
        // (see formatMatchScoreForUser). didUserWinMatch prefers the authoritative
        // Winner field over wid1 when they disagree (wid1 can be stale on
        // corrected/disputed match records).
        const didWin = didUserWinMatch(match, uid, currentUserFullName);

        let userWins = 0;
        let oppWins = 0;
        let trailed = false;
        let trailed0_2 = false;

        for (const g of games) {
            // Check deficits *before* tallying the current game result
            const diff = oppWins - userWins;
            if (oppWins > userWins) trailed = true;
            if (diff === 2) trailed0_2 = true; // 0-2 down before this game

            const parts = g.split('-').map(n => parseInt(n, 10));
            if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) continue;

            const [winnerSideScore, loserSideScore] = parts;
            const userScore = didWin ? winnerSideScore : loserSideScore;
            const oppScore = didWin ? loserSideScore : winnerSideScore;

            if (userScore > oppScore) {
                userWins++;
            } else if (oppScore > userScore) {
                oppWins++;
            }
        }

        // No final "trailed" check is needed: a match where the user was
        // behind at ANY point will have oppWins > userWins before some game,
        // which the loop above already captured. Adding checks after the loop
        // would falsely flag e.g. a 2-3 loss after leading 2-0, or mislabel a
        // 1-3 loss as "trailed 0-2".

        // Only completed-match data reaches here, so any trailing = a real
        // opportunity to make a comeback.
        if (trailed) trailingMatches++;
        if (trailed0_2) trailing0_2Matches++;

        // Count only true comebacks (exact 4 patterns) as comeback wins.
        if (isComebackWin(match, uid, currentUserFullName)) {
            totalComebacks++;
            comebackMatches.push(match);
            // LLWWW = reverse sweep (won after being down 0-2)
            const seq = String(match.Score).split(',').map(g => g.trim()).filter(Boolean).length === 5
                ? String(match.Score).split(',').map(g => g.trim()).map(gg => {
                    const parts = gg.split('-').map(n => parseInt(n, 10));
                    const userScore = didWin ? parts[0] : parts[1];
                    const oppScore = didWin ? parts[1] : parts[0];
                    return userScore > oppScore ? 'W' : 'L';
                }).join('')
                : '';
            if (seq === 'LLWWW') {
                reverseSweeps++;
                // TEMP TEST LOG: log the score and player names of every reverse sweep
                console.log('[Reverse Sweep]', {
                    matchId: match.Matchid,
                    date: match.MatchDate,
                    score: match.Score,
                    homePlayer: match.hplayer1,
                    visitingPlayer: match.vplayer1,
                    winner: match.Winner,
                    userWon: didWin
                });
            }
        }
    });

    return {
        totalComebacks,
        comebackMatches,
        trailingMatches,
        trailing0_2Matches,
        reverseSweeps,
        comebackWinRate: trailingMatches > 0 ? Math.round((totalComebacks / trailingMatches) * 100) : 0,
        reverseSweepRate: trailing0_2Matches > 0 ? Math.round((reverseSweeps / trailing0_2Matches) * 100) : 0
    };
}
/**
 * Helper to fade out the loading overlay smoothly.
 */
function fadeOutLoadingOverlay() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.opacity = '0';
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
        }, 300);
    }
}

/**
 * Initializes the analytics dashboard view and loads metrics components.
 */
function initializeAnalyticsPage(allMatches, currentUserId) {
    const comebackContainer = document.getElementById('comeback-tracker-container');
    if (comebackContainer) {
        const comebackStats = computeComebackStats(allMatches, currentUserId);
        renderComebackTracker(comebackContainer, comebackStats, currentUserId);
    }
}

/**
 * Main function to initialize the page and fetch all necessary data.
 * @param {string} currentUserId - The ID of the user whose data to load.
 */
async function initializePage(currentUserId) {
    // Reset abort controller for new page load
    abortController = new AbortController();
    // Abort requests when navigating away
    window.addEventListener('beforeunload', () => abortController.abort());

    lucide.createIcons();
    // Show the updated date immediately so the user sees the timestamp before other data loads
    const lastUpdatedEl = document.getElementById('last-updated-date');
    if (lastUpdatedEl) lastUpdatedEl.textContent = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    try {
        const response = await fetch(`/proxy/user/${currentUserId}`, { signal: abortController.signal });
        const userData = await response.json();
        currentUserFullName = [userData.firstName, userData.lastName].filter(Boolean).join(' ').trim();
        document.getElementById('welcome-message').textContent = `Welcome Back, ${userData.firstName} 🎉`;
    } catch (e) {
        if (e.name !== 'AbortError') {
            console.error("Could not fetch user's name", e);
            document.getElementById('welcome-message').textContent = `Welcome Back 🎉`;
        }
    }

    // Fade out loading overlay after initial data loads (with a brief delay for perception)
    setTimeout(() => {
        fadeOutLoadingOverlay();
    }, 1500);

    fetchCurrentUserRating(currentUserId);
    fetchWeeklyRankings(currentUserId);
    fetchMatchStatistics(currentUserId);

    const allMatches = await fetchAllMatches(currentUserId);

    renderStreaks(document.getElementById('streaks-container'), computeStreaks(allMatches, currentUserId));
    const comebackStats = computeComebackStats(allMatches, currentUserId);
    renderComebackTracker(document.getElementById('comeback-tracker-container'), comebackStats, currentUserId);

    fetchAndDisplayMonthlyRatingChanges(currentUserId, allMatches);
    calculateAverageOpponentRating(25, allMatches);
    displayLastMatch(currentUserId, allMatches);
    fetchAdvancedMatchInsights(allMatches);



    setupModalListeners();
    setupMatchStatClickListeners(allMatches, currentUserId);

    document.getElementById('last-updated-date').textContent = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

    // Load Top Losses by Opponent Rating (uses ratings already embedded in match objects, no extra API calls)
    fetchAndDisplayTopLosses(currentUserId, allMatches);
}


// --- EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', () => {
    const appContainer = document.getElementById('app');
    if (appContainer) appContainer.style.display = 'flex';

    // Show the app first, then initialize and fade out loading
    const loadPageContent = () => {
        const urlParams = new URLSearchParams(window.location.search);
        let idFromUrl = urlParams.get('userId');
        let idFromStorage = sessionStorage.getItem('lastViewedAnalyticsUserId');
        let finalUserId = idFromUrl || idFromStorage || '170053';

        sessionStorage.setItem('lastViewedAnalyticsUserId', finalUserId);
        userId = finalUserId;
        initializePage(userId);

        const searchInput = document.getElementById('search-input');
        const searchResultsContainer = document.getElementById('search-results');
        let searchTimeout = null;

        if (searchInput && searchResultsContainer) {
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                const query = searchInput.value.trim();
                if (query.length > 2) {
                    searchTimeout = setTimeout(() => performSearch(query), 300);
                } else {
                    searchResultsContainer.innerHTML = '';
                    searchResultsContainer.classList.add('hidden');
                }
            });
            document.addEventListener('click', (event) => {
                if (!searchInput.contains(event.target) && !searchResultsContainer.contains(event.target)) {
                    searchResultsContainer.classList.add('hidden');
                }
            });
        }
    };
    
    loadPageContent();
});