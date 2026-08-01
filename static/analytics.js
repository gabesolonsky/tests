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
 * Fetches opponent ratings and calculates the average.
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

    const recentMatches = allMatches.slice(0, matchesToConsider);
    const ratingPromises = recentMatches.map(async (match) => {
        const opponentId = match.wid1 === parseInt(userId) ? match.oid1 : match.wid1;
        if (opponentId && opponentId !== -1) {
            try {
                const res = await fetch(`/proxy/user/${opponentId}/ratings-top`, { signal: abortController.signal });
                if (!res.ok) return null;
                const ratingData = await res.json();
                return (ratingData && ratingData.length > 0 && typeof ratingData[0].rating === 'number') ? ratingData[0].rating : null;
            } catch (e) {
                console.error(`Could not fetch rating for opponent ${opponentId}`, e);
                return null;
            }
        }
        return null;
    });

    const opponentRatings = (await Promise.all(ratingPromises)).filter(rating => rating !== null);
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

        let months = [];
        let currentDate = new Date();
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
 * Optimized fetchAndDisplayTopOpponents
 */
async function fetchAndDisplayTopOpponents(currentUserId, allMatches) {
    const container = document.getElementById("top-opponents-list");
    if (!container) return;
    if (!allMatches || allMatches.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 mt-10">No match history available.</p>';
        return;
    }
    container.innerHTML = '<p class="text-center text-gray-500 mt-10">Analyzing opponents...</p>';

    const opponentData = new Map();
    const uid = parseInt(currentUserId);

    // 1. Group matches by opponent
    allMatches.forEach(match => {
        const opponentId = match.wid1 === uid ? match.oid1 : match.wid1;
        const opponentName = getOpponentDisplayName(match, uid, currentUserFullName);
        if (opponentId && opponentId !== -1 && opponentName) {
            if (!opponentData.has(opponentId)) {
                opponentData.set(opponentId, { name: opponentName, rating: 0, matches: [] });
            }
            opponentData.get(opponentId).matches.push(match);
        }
    });

    // 2. Filter out opponents with very few matches if the dataset is huge (Optional)
    const opponentEntries = Array.from(opponentData.entries());

    // 3. Fetch ratings in parallel with concurrency limit or Promise.all
    // Adding a simple in-memory cache check so we never re-fetch the same opponent twice in a session
    if (!window.opponentRatingCache) window.opponentRatingCache = new Map();

    const ratingPromises = opponentEntries.map(async ([id, data]) => {
        // Check cache first
        if (window.opponentRatingCache.has(id)) {
            data.rating = window.opponentRatingCache.get(id);
            return;
        }

        try {
            const res = await fetch(`/proxy/user/${id}/ratings-top`, { signal: abortController.signal });
            if (!res.ok) return;
            const ratingData = await res.json();
            if (ratingData && ratingData.length > 0 && typeof ratingData[0].rating === 'number') {
                const rating = ratingData[0].rating;
                data.rating = rating;
                window.opponentRatingCache.set(id, rating); // Save to cache
            }
        } catch (e) {
            console.error(`Could not fetch rating for opponent ${id}`, e);
        }
    });

    await Promise.all(ratingPromises);

    // 4. Sort and render top 5
    const sortedOpponents = Array.from(opponentData.values())
        .filter(opp => opp.rating > 0)
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 5);

    if (sortedOpponents.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 mt-10">No opponent rating data found.</p>';
        return;
    }

    let html = '<div class="space-y-3">';
    sortedOpponents.forEach(opponent => {
        const lastMatch = opponent.matches.sort((a, b) => new Date(b.MatchDate) - new Date(a.MatchDate))[0];
        const didWin = didUserWinMatch(lastMatch, uid, currentUserFullName);
        html += `<div class="event-card ${didWin ? "win" : "lose"}" data-matchid="${lastMatch.Matchid}" data-home-player-name="${lastMatch.hplayer1 || 'Home Player'}" data-visiting-player-name="${lastMatch.vplayer1 || 'Visiting Player'}">
            <img src="https://ussq-img-live.s3.us-east-1.amazonaws.com/uploads%2Fussq-profile-icon-default.png" class="event-logo" alt="Match" />
            <div class="event-details">
                <p><strong>vs. ${opponent.name} (${opponent.rating.toFixed(2)})</strong></p>
                <p>Score: ${lastMatch.Score}</p>
            </div>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
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
    return;
}

// --- START: Match Insights Modal Functions ---

function showTemporaryMessage(message, type = 'info') {
    let messageBox = document.getElementById('temp-message-box');
    if (!messageBox) {
        messageBox = document.createElement('div');
        messageBox.id = 'temp-message-box';
        document.body.appendChild(messageBox);
    }
    messageBox.textContent = message;
    messageBox.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg z-50 text-white transition-opacity duration-300';
    if (type === 'info') messageBox.classList.add('bg-blue-500');
    else if (type === 'success') messageBox.classList.add('bg-green-500');
    else if (type === 'error') messageBox.classList.add('bg-red-500');
    messageBox.style.display = 'block';
    setTimeout(() => messageBox.style.opacity = '1', 10);
    setTimeout(() => {
        messageBox.style.opacity = '0';
        setTimeout(() => messageBox.style.display = 'none', 500);
    }, 3000);
}

function closeGraphModal() {
    const graphModal = document.getElementById("graph-modal");
    if (graphModal) {
        graphModal.classList.add("hidden");
        graphModal.style.display = "none";
    }
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
    metricsContainer.innerHTML = '';
    graphModal.classList.remove("hidden");
    graphModal.style.display = "flex";

    if (sessionStorage.getItem(SESSION_STORAGE_KEY_MATCH_INSIGHTS) === 'true') {
        if (matchInsightsTitle) matchInsightsTitle.textContent = 'Match Insights';
        await loadMatchInsights(match, metricsContainer);
        return;
    }

    if (matchInsightsTitle) matchInsightsTitle.textContent = 'Enter Access Code';
    metricsContainer.innerHTML = `<div id="code-input-area" class="text-center p-4"><p class="mb-4 text-gray-700">Please enter the access code to view detailed match insights.</p><p class="mb-4 text-gray-700">For more details, please contact <a href="tel:${CONTACT_PHONE_NUMBER}" class="text-indigo-600 hover:underline">${CONTACT_PHONE_NUMBER}</a>.</p><input type="password" id="access-code-input" class="border border-gray-300 rounded-md p-2 text-center text-lg w-48 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Enter code"><button id="submit-code-btn" class="ml-3 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Submit</button><p id="code-error-message" class="text-red-500 text-sm mt-2 hidden">Incorrect code.</p></div>`;
    
    const accessCodeInput = document.getElementById('access-code-input');
    const submitCodeBtn = document.getElementById('submit-code-btn');
    const handleCodeSubmission = async () => {
        if (accessCodeInput.value === MATCH_INSIGHTS_ACCESS_CODE) {
            sessionStorage.setItem(SESSION_STORAGE_KEY_MATCH_INSIGHTS, 'true');
            if (matchInsightsTitle) matchInsightsTitle.textContent = 'Match Insights';
            await loadMatchInsights(match, metricsContainer);
        } else {
            document.getElementById('code-error-message').classList.remove('hidden');
            accessCodeInput.value = '';
        }
    };
    submitCodeBtn.addEventListener("click", handleCodeSubmission);
    accessCodeInput.addEventListener("keypress", (e) => { if (e.key === 'Enter') handleCodeSubmission(); });
}

async function loadMatchInsights(match, container) {
    const match_id = match.Matchid || match.matchId;
    container.innerHTML = '<p class="text-center text-gray-500 mt-10">Loading match insights...</p>';
    
    let data;
    try {
        const response = await fetch(`/proxy/liveScoreDetails?match_id=${match_id}`, { signal: abortController.signal });
        if (!response.ok) throw new Error("Proxy response not ok");
        data = await response.json();
    } catch (error) {
        showTemporaryMessage("No live scoring available for this match.", "info");
        container.innerHTML = ''; return;
    }

    if (!data || data.length < 2) {
        showTemporaryMessage("No live scoring available for this match.", "info");
        container.innerHTML = ''; return;
    }
    
    const allPoints = data.filter(evt => evt.Decision === "point").sort((a, b) => new Date(a.StartDate) - new Date(b.StartDate));
    if (allPoints.length < 2) {
        showTemporaryMessage("No live scoring available for this match.", "info");
        container.innerHTML = ''; return;
    }
    
    const homePlayerName = match.playerHome1Name || match.hplayer1 || "Home Player";
    const visitingPlayerName = match.playerVisiting1Name || match.vplayer1 || "Visiting Player";
    
    container.innerHTML = `<div id="tab-nav" class="flex justify-center border-b border-gray-200 mb-4"></div><div id="tab-content" class="p-4"></div>`;
    const tabNav = container.querySelector("#tab-nav");
    const tabContent = container.querySelector("#tab-content");

    const gameMap = {};
    allPoints.forEach(evt => {
        if (!gameMap[evt.Game_Number]) gameMap[evt.Game_Number] = [];
        gameMap[evt.Game_Number].push(evt);
    });
    const uniqueGames = Object.keys(gameMap).map(g => parseInt(g)).sort((a,b) => a - b);

    // --- Overview Tab Setup ---
    const overviewTabBtn = document.createElement("button");
    overviewTabBtn.textContent = "Overview";
    overviewTabBtn.className = "tab-button py-2 px-4 text-sm font-medium text-gray-600 hover:text-indigo-600 focus:outline-none border-b-2 border-transparent";
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
        if(diffSec > 0 && diffSec < 150) { // Using 150s max as per outlier rules
            pointDurations.push(diffSec);
            if(diffSec > longestPointSec) longestPointSec = diffSec;
        }
    }
    const averagePointSec = pointDurations.length > 0 ? pointDurations.reduce((a, b) => a + b, 0) / pointDurations.length : 0;
    const averageGameSec = gameLengthsSec.length > 0 ? gameLengthsSec.reduce((a, b) => a + b, 0) / gameLengthsSec.length : 0;

    // --- Render Overview Content ---
    function makeStatBox(label, value) {
        return `<div class="bg-gray-50 p-3 rounded-lg shadow-sm text-center min-w-[120px]"><strong class="block text-gray-600 text-sm">${label}:</strong> <span class="text-lg font-semibold text-indigo-700">${value}</span></div>`;
    }
    overviewContent.innerHTML = `
        <div class="mb-4 text-center">
            <h3 class="text-lg font-semibold mb-2">Match Score</h3>
            <p class="text-2xl font-bold">${homePlayerName} <span class="text-red-500">${homeGamesWon}</span> - <span class="text-blue-500">${visitingGamesWon}</span> ${visitingPlayerName}</p>
        </div>
        <div class="flex justify-center gap-4 mb-6 flex-wrap">
            ${makeStatBox("Match Length", formatDurationSec(matchLengthSec))}
            ${makeStatBox("Avg Point", formatDurationSec(averagePointSec))}
            ${makeStatBox("Longest Point", formatDurationSec(longestPointSec))}
            ${makeStatBox("Avg Game", formatDurationSec(averageGameSec))}
        </div>
        <div class="max-w-xl mx-auto"><canvas id="game-scores-bar-chart"></canvas></div>
    `;

    new Chart(document.getElementById('game-scores-bar-chart').getContext('2d'), {
        type: 'bar',
        data: { labels: gameLabels, datasets: [{ label: homePlayerName, data: homeGameScores, backgroundColor: 'rgba(239, 68, 68, 0.8)' }, { label: visitingPlayerName, data: visitingGameScores, backgroundColor: 'rgba(59, 130, 246, 0.8)' }] },
        options: { responsive: true, plugins: { title: { display: true, text: 'Game Scores' } } }
    });

    // --- Create Game Tabs ---
    uniqueGames.forEach(gameNum => {
        const gameTabBtn = document.createElement("button");
        gameTabBtn.textContent = `Game ${gameNum}`;
        gameTabBtn.className = "tab-button py-2 px-4 text-sm font-medium text-gray-600 hover:text-indigo-600 focus:outline-none border-b-2 border-transparent";
        tabNav.appendChild(gameTabBtn);
        const gameContent = document.createElement("div");
        gameContent.className = "tab-content-pane";
        gameContent.style.display = "none";
        gameContent.innerHTML = `<div class="max-w-xl mx-auto" style="height: 350px;"><canvas id="game-chart-${gameNum}"></canvas></div>`;
        tabContent.appendChild(gameContent);
        const pointsGame = gameMap[gameNum].sort((a, b) => new Date(a.StartDate) - new Date(b.StartDate));
        new Chart(document.getElementById(`game-chart-${gameNum}`).getContext('2d'), {
            type: 'line',
            data: { labels: pointsGame.map((_, i) => i + 1), datasets: [{ label: homePlayerName, data: pointsGame.map(p => p.Points_left), borderColor: 'rgb(239, 68, 68)', tension: 0.1 }, { label: visitingPlayerName, data: pointsGame.map(p => p.Points_right), borderColor: 'rgb(59, 130, 246)', tension: 0.1 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: `Game ${gameNum} Progression` } } }
        });
        gameTabBtn.addEventListener("click", () => {
            tabContent.querySelectorAll(".tab-content-pane").forEach(p => p.style.display = "none");
            tabNav.querySelectorAll(".tab-button").forEach(b => b.classList.remove("active", "border-indigo-500", "text-indigo-600"));
            gameContent.style.display = "block";
            gameTabBtn.classList.add("active", "border-indigo-500", "text-indigo-600");
        });
    });

    overviewTabBtn.addEventListener("click", () => {
        tabContent.querySelectorAll(".tab-content-pane").forEach(p => p.style.display = "none");
        tabNav.querySelectorAll(".tab-button").forEach(b => b.classList.remove("active", "border-indigo-500", "text-indigo-600"));
        overviewContent.style.display = "block";
        overviewTabBtn.classList.add("active", "border-indigo-500", "text-indigo-600");
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
            <span class="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">${streaks.highestWinStreak}</span>
        </div>
        <div class="flex justify-between items-center p-2">
            <span class="text-gray-600">Highest Loss Streak</span>
            <span class="px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">${streaks.highestLossStreak}</span>
        </div>
    `;
}
function isComeback(match, userId) {
    const uid = parseInt(userId, 10);

    // Must have score and must have won the match
    if (!match.Score || match.wid1 !== uid) return false;

    // Parse games: "11-7 6-11 11-9" → [[11,7],[6,11],[11,9]]
    const games = match.Score.split(/\s+/)
        .map(g => g.split('-').map(Number))
        .filter(arr => arr.length === 2);

    if (games.length === 0) return false;

    // Determine if user is home or visiting
    const userIsHome = match.hid === uid;

    // Check game 1
    const [g1h, g1v] = games[0];
    const userLostGame1 = userIsHome ? g1h < g1v : g1v < g1h;

    // Check game 2 (if exists)
    let userLostGame2 = false;
    if (games.length > 1) {
        const [g2h, g2v] = games[1];
        userLostGame2 = userIsHome ? g2h < g2v : g2v < g2h;
    }

    // Comeback = lost game 1 OR lost game 2
    return userLostGame1 || userLostGame2;
}

/**
 * Renders the Comeback Tracker widget inside the specified container.
 */
function renderComebackTracker(container, stats, userId) {
    if (!container) return;
    
    if (!stats.comebackMatches || stats.comebackMatches.length === 0) {
        container.innerHTML = `
            <p class="text-center text-gray-500 mt-10">No comeback wins yet.</p>
            <p class="text-xs text-center text-gray-400 mt-2">A comeback is a match you won after falling behind in games.</p>
        `;
        return;
    }

    container.innerHTML = `
        <div id="comeback-count-trigger" class="flex justify-between items-center p-3 rounded-xl bg-indigo-100 cursor-pointer hover:bg-indigo-200 transition-colors">
            <span class="font-medium text-gray-700">Comeback Wins</span>
            <span class="text-lg font-bold text-indigo-600">${stats.totalComebacks}</span>
        </div>
        <div class="grid grid-cols-2 gap-2 pt-2">
            <div class="bg-gray-100 p-3 rounded-xl text-center border border-gray-200">
                <p class="text-xs text-gray-500 font-medium">Down 1 Game</p>
                <p class="text-lg font-bold text-indigo-600 mt-1">${stats.down1Rate}%</p>
                <p class="text-[10px] text-gray-500">${stats.down1Wins}/${stats.down1Opportunities} won</p>
            </div>
            <div class="bg-gray-100 p-3 rounded-xl text-center border border-gray-200">
                <p class="text-xs text-gray-500 font-medium">Down 2 Games</p>
                <p class="text-lg font-bold text-indigo-600 mt-1">${stats.down2Rate}%</p>
                <p class="text-[10px] text-gray-500">${stats.down2Wins}/${stats.down2Opportunities} won</p>
            </div>
        </div>
        <p class="text-xs text-gray-500 mt-2 text-center">Tap Comeback Wins to view matches.</p>
    `;

    const trigger = container.querySelector('#comeback-count-trigger');
    if (trigger) {
        trigger.addEventListener('click', () => showMatchListModal('Comeback Wins', stats.comebackMatches, userId));
    }
}

// --- END: Shared Match Card / Match List Modal Helpers ---


function setupModalListeners() {
    const containers = [ document.getElementById('top-opponents-list'), document.getElementById('last-match-details'), document.getElementById('match-list-body') ];
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


// --- END: Match Insights Modal Functions ---

/**
 * Evaluates match comeback metrics: total comeback wins, 
 * wins after being down 1 game, and wins after being down 2 games.
 */
function computeComebackStats(allMatches, userId) {
    const uid = parseInt(userId, 10);
    let totalComebacks = 0;
    let down1Opportunities = 0;
    let down1Wins = 0;
    let down2Opportunities = 0;
    let down2Wins = 0;

    const comebackMatches = [];

    (allMatches || []).forEach(match => {
        if (!match.Score) return;
        const games = match.Score.split(',').map(g => g.trim()).filter(Boolean);
        if (games.length === 0) return;

        // The match winner's per-game score is always listed FIRST in match.Score
        // (see formatMatchScoreForUser). didUserWinMatch prefers the authoritative
        // Winner field over wid1 when they disagree (wid1 can be stale on
        // corrected/disputed match records).
        const didWin = didUserWinMatch(match, uid, currentUserFullName);

        let userWins = 0;
        let oppWins = 0;
        let wasDown1 = false;
        let wasDown2 = false;
        let everBehind = false;

        for (const g of games) {
            // Check deficits *before* tallying the current game result
            const diff = oppWins - userWins;
            if (diff === 1) wasDown1 = true;
            if (diff >= 2) wasDown2 = true;
            if (oppWins > userWins) everBehind = true;

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

        // Final check after loop in case deficit happened right before winning the match
        if (oppWins - userWins === 1) wasDown1 = true;
        if (oppWins - userWins >= 2) wasDown2 = true;
        if (oppWins > userWins) everBehind = true;

        if (wasDown1) {
            down1Opportunities++;
            if (didWin) down1Wins++;
        }
        if (wasDown2) {
            down2Opportunities++;
            if (didWin) down2Wins++;
        }

        if (didWin && (everBehind || wasDown1 || wasDown2)) {
            totalComebacks++;
            comebackMatches.push(match);
        }
    });

    return {
        totalComebacks,
        comebackMatches,
        down1Rate: down1Opportunities > 0 ? Math.round((down1Wins / down1Opportunities) * 100) : 0,
        down1Wins,
        down1Opportunities,
        down2Rate: down2Opportunities > 0 ? Math.round((down2Wins / down2Opportunities) * 100) : 0,
        down2Wins,
        down2Opportunities
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

    document.getElementById('last-updated-date').textContent = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

    // Load Top Opponents widget last since it performs multiple opponent rating API fetches
    await fetchAndDisplayTopOpponents(currentUserId, allMatches);
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