// Global variable for the current user's ID
let userId;

// Define RATING_TIERS globally for consistency
const RATING_TIERS = [
  { name: 'Beginner', min: 0, max: 3.5 },
  { name: 'Intermediate', min: 3.5, max: 4.5 },
  { name: 'Advanced', min: 4.5, max: 5.5 },
  { name: 'Semi-pro', min: 5.5, max: 6.5 },
  { name: 'Pro', min: 6.5, max: Infinity }
];

const ANALYTICS_ACCESS_CODE = "0";
const SESSION_STORAGE_KEY_ANALYTICS_ACCESS = 'analyticsAccessGranted';

/**
 * Toggles the sidebar visibility by adding/removing a class on the main app container.
 */
function toggleSidebar() {
  document.getElementById("app").classList.toggle("sidebar-collapsed");
}

/**
 * Fetches and displays the user's current singles rating and related stats.
 * @param {string} currentUserId - The ID of the user to fetch data for.
 */
async function fetchCurrentUserRating(currentUserId) {
  try {
    const res = await fetch(`/proxy/user/${currentUserId}/ratings`);
    if (!res.ok) throw new Error(`Network response was not ok. Status: ${res.status}`);
    const data = await res.json();

    const currentRatingEl = document.getElementById("current-rating");
    const statusIndicatorEl = document.getElementById("status-indicator");
    const currentTierNameDisplayEl = document.getElementById('current-tier-name-display');

    const ratingObj = data.find(r => r.ratingTypeName === "Singles International Rating");

    if (ratingObj && typeof ratingObj.rating === 'number' && !isNaN(ratingObj.rating)) {
      const currentRating = ratingObj.rating;
      currentRatingEl.textContent = `${currentRating.toFixed(2)}`;
      statusIndicatorEl.textContent = "Active";
      statusIndicatorEl.className = "inline-block bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-1 rounded-full";
      
      const currentTier = RATING_TIERS.find(tier => currentRating >= tier.min && currentRating < tier.max);
      const currentTierIndex = RATING_TIERS.findIndex(tier => currentRating >= tier.min && currentRating < tier.max);

      if (currentTierNameDisplayEl) {
        currentTierNameDisplayEl.textContent = currentTier ? currentTier.name : 'N/A';
      }
      
      // --- Tooltip Logic ---
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
      currentRatingEl.textContent = "N/A";
      statusIndicatorEl.textContent = "Inactive";
      statusIndicatorEl.className = "inline-block bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded-full";
      if (currentTierNameDisplayEl) {
          currentTierNameDisplayEl.textContent = 'N/A';
      }
    }
  } catch (err) {
    console.error("Error fetching current rating:", err);
    document.getElementById("current-rating").textContent = "Error";
  }
}

/**
 * Fetches and renders the user's weekly rankings, showing changes from the previous week.
 * @param {string} currentUserId - The ID of the user.
 */
async function fetchWeeklyRankings(currentUserId) {
    const rankingsContainer = document.getElementById("weekly-rankings-list");
    if (!rankingsContainer) {
        console.error("Weekly rankings list container not found.");
        return;
    }
    rankingsContainer.innerHTML = '<p class="text-center text-gray-500 mt-10">Loading rankings...</p>';

    try {
        const rankingsResponse = await fetch(`/proxy/user/${currentUserId}/rankings`);
        if (!rankingsResponse.ok) {
            throw new Error(`Rankings API HTTP error! status: ${rankingsResponse.status}`);
        }
        const rankingsData = await rankingsResponse.json();

        if (rankingsData.length === 0) {
            rankingsContainer.innerHTML = '<p class="text-center text-gray-500 mt-10">No ranking history available.</p>';
            return;
        }

        // Find the highest rating from the entire history for the "Highest Rating" card
        const allDivisionRatings = rankingsData
            .filter(entry => entry.DivisionName === "All")
            .map(entry => ({ rating: entry.Rating, date: new Date(entry.RankingPeriod) }));

        if (allDivisionRatings.length > 0) {
            const highestEntry = allDivisionRatings.reduce((max, entry) => (entry.rating > max.rating ? entry : max), allDivisionRatings[0]);
            document.getElementById("highest-rating").textContent = highestEntry.rating.toFixed(2);
            document.getElementById("highest-rating-date").textContent = `(${highestEntry.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })})`;
        }

        // Get all unique dates from the data and sort them chronologically
        const uniqueDates = [...new Set(rankingsData.map(entry => new Date(entry.RankingPeriod).toISOString().split('T')[0]))]
            .sort((a, b) => new Date(b) - new Date(a));

        const mostRecentDateString = uniqueDates[0];
        const previousWeekDateString = uniqueDates[1]; 

        // Filter for rankings from the most recent date
        const currentWeekRankings = rankingsData.filter(entry => {
            return new Date(entry.RankingPeriod).toISOString().split('T')[0] === mostRecentDateString;
        });

        // Create a map of the previous week's rankings for easy and accurate comparison
        let previousWeekRankingsMap = new Map();
        if (previousWeekDateString) {
            const previousWeekRankings = rankingsData.filter(entry => {
                return new Date(entry.RankingPeriod).toISOString().split('T')[0] === previousWeekDateString;
            });
            // The key is a composite of DivisionName and RatingGroupDescr to ensure we only compare identical ranking types
            previousWeekRankingsMap = new Map(previousWeekRankings.map(r => [r.DivisionName + '-' + r.RatingGroupDescr, r.Ranking]));
        }

        // Generate and display the HTML for the rankings list
        let rankingsHtml = '';
        if (currentWeekRankings.length > 0) {
            const mostRecentDate = new Date(mostRecentDateString);
            rankingsHtml += `<p class="text-sm text-gray-500 mb-3">As of: <span class="font-medium text-gray-800">${mostRecentDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></p>`;
            rankingsHtml += '<ul class="space-y-3">';
            
            currentWeekRankings.forEach(ranking => {
                const previousRank = previousWeekRankingsMap.get(ranking.DivisionName + '-' + ranking.RatingGroupDescr);
                let changeHtml = '';

                if (previousRank !== undefined) {
                    // A lower ranking number is better. If previous was 10 and current is 5, you moved up 5 spots.
                    const change = previousRank - ranking.Ranking;
                    if (change > 0) { // Rank improved (e.g., from 10 to 5)
                        changeHtml = `<div class="flex items-center gap-1 text-green-600">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
                                        <span class="text-xs font-medium">${change}</span>
                                      </div>`;
                    } else if (change < 0) { // Rank worsened (e.g., from 5 to 10)
                        changeHtml = `<div class="flex items-center gap-1 text-red-600">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7 7 7-7"/><path d="M12 5v14"/></svg>
                                        <span class="text-xs font-medium">${Math.abs(change)}</span>
                                      </div>`;
                    } else { // No change
                        changeHtml = `<div class="text-xs text-gray-400">-</div>`;
                    }
                } else { // No previous rank data for this division
                    changeHtml = `<div class="text-xs text-gray-400">New</div>`;
                }

                rankingsHtml += `
                    <li class="flex items-center justify-between p-3 bg-white/60 backdrop-blur-sm border border-gray-200/80 rounded-xl shadow-sm transition-all hover:shadow-md hover:bg-white">
                        <div>
                            <div class="font-semibold text-gray-800">${ranking.DivisionName}</div>
                            <div class="text-sm text-gray-500">${ranking.RatingGroupDescr}</div>
                        </div>
                        <div class="flex flex-col items-end">
                           <span class="text-xl font-bold text-indigo-600">${ranking.Ranking}</span>
                           <div class="h-4">${changeHtml}</div>
                        </div>
                    </li>
                `;
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
        const response = await fetch(`/proxy/user/${currentUserId}/record`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const recordData = await response.json();

        let totalWins = 0;
        let totalLosses = 0;

        recordData.forEach(entry => {
            const matchesType = entry.matchesType;
            const matchesWon = entry.matchesWon || 0;
            const matchesLost = entry.matchesLost || 0;

            totalWins += matchesWon;
            totalLosses += matchesLost;
            
            const winsEl = document.getElementById(`wins-${matchesType}-game`);
            const lossesEl = document.getElementById(`losses-${matchesType}-game`);

            if (winsEl) winsEl.textContent = matchesWon;
            if (lossesEl) lossesEl.textContent = matchesLost;
        });
        
        const totalMatches = totalWins + totalLosses;
        document.getElementById('matches-played-total').textContent = totalMatches;

        const winPercentage = totalMatches > 0 ? ((totalWins / totalMatches) * 100).toFixed(0) + '%' : '0%';
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
        let opponentId;
        if (match.wid1 === parseInt(userId)) {
            opponentId = match.oid1;
        } else {
            opponentId = match.wid1;
        }
        
        if (opponentId) {
            try {
                const res = await fetch(`/proxy/user/${opponentId}/ratings-top`);
                if (!res.ok) return null;
                const ratingData = await res.json();
                if (ratingData && ratingData.length > 0 && typeof ratingData[0].rating === 'number') {
                    return ratingData[0].rating;
                }
            } catch (e) {
                console.error(`Could not fetch rating for opponent ${opponentId}`, e);
            }
        }
        return null;
    });

    const opponentRatings = (await Promise.all(ratingPromises)).filter(rating => rating !== null);

    if (opponentRatings.length > 0) {
        const sumRatings = opponentRatings.reduce((sum, rating) => sum + rating, 0);
        const averageRating = (sumRatings / opponentRatings.length).toFixed(2);
        avgOpponentRatingEl.textContent = averageRating;
        if (opponentRatingStatusEl) opponentRatingStatusEl.textContent = `Based on last ${opponentRatings.length} matches.`;
    } else {
        avgOpponentRatingEl.textContent = "N/A";
        if (opponentRatingStatusEl) opponentRatingStatusEl.textContent = "No valid opponent data found.";
    }
}

/**
 * Fetches and displays the monthly rating changes for the user.
 * @param {string} currentUserId - The ID of the user.
 */
async function fetchAndDisplayMonthlyRatingChanges(currentUserId) {
    const container = document.getElementById("monthly-rating-change-list");
    if (!container) {
        console.error("Monthly rating change list container not found.");
        return;
    }
    container.innerHTML = '<p class="text-center text-gray-500 mt-10">Loading data...</p>';

    try {
        const response = await fetch(`/proxy/user/${currentUserId}/rankings`);
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const rankingsData = await response.json();

        const allDivisionRatings = rankingsData.filter(entry => entry.DivisionName === "All");

        if (allDivisionRatings.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 mt-10">No rating history available.</p>';
            return;
        }

        // Group ratings by month
        const ratingsByMonth = {};
        allDivisionRatings.forEach(entry => {
            const date = new Date(entry.RankingPeriod);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!ratingsByMonth[monthKey]) {
                ratingsByMonth[monthKey] = [];
            }
            ratingsByMonth[monthKey].push({ date: date, rating: entry.Rating });
        });

        // Calculate YTD Change
        const currentYear = new Date().getFullYear();
        const yearRatings = allDivisionRatings.filter(r => new Date(r.date).getFullYear() === currentYear);
        let ytdChangeHtml = '<p class="text-sm text-gray-500">YTD Change: No Data</p>';
        if(yearRatings.length > 1){
            yearRatings.sort((a,b) => a.date - b.date);
            const startRating = yearRatings[0].rating;
            const endRating = yearRatings[yearRatings.length - 1].rating;
            const ytdChange = endRating - startRating;
            
            if (ytdChange > 0) {
                ytdChangeHtml = `<p class="text-sm text-green-600 font-semibold">YTD Change: +${ytdChange.toFixed(2)}</p>`;
            } else if (ytdChange < 0) {
                ytdChangeHtml = `<p class="text-sm text-red-600 font-semibold">YTD Change: ${ytdChange.toFixed(2)}</p>`;
            } else {
                 ytdChangeHtml = `<p class="text-sm text-gray-500">YTD Change: ${ytdChange.toFixed(2)}</p>`;
            }
        }


        // Get the last 12 months
        let months = [];
        let currentDate = new Date();
        for (let i = 0; i < 12; i++) {
            months.push({
                key: `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`,
                name: currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })
            });
            currentDate.setMonth(currentDate.getMonth() - 1);
        }

        let html = `<div class="text-center mb-4">${ytdChangeHtml}</div><ul class="space-y-2">`;
        months.forEach(month => {
            const monthRatings = ratingsByMonth[month.key];
            let changeHtml = '<span class="text-sm font-medium text-gray-500">No Data</span>';

            if (monthRatings && monthRatings.length > 0) {
                // Sort by date to find the first and last entry of the month
                monthRatings.sort((a, b) => a.date - b.date);
                const firstRating = monthRatings[0].rating;
                const lastRating = monthRatings[monthRatings.length - 1].rating;
                const change = lastRating - firstRating;

                if (change > 0) {
                    changeHtml = `<div class="flex items-center gap-1 text-green-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
                                    <span class="text-sm font-bold">${change.toFixed(2)}</span>
                                  </div>`;
                } else if (change < 0) {
                    changeHtml = `<div class="flex items-center gap-1 text-red-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7 7 7-7"/><path d="M12 5v14"/></svg>
                                    <span class="text-sm font-bold">${change.toFixed(2)}</span>
                                  </div>`;
                } else {
                    changeHtml = `<span class="text-sm font-medium text-gray-500">${change.toFixed(2)}</span>`;
                }
            }
            
            html += `
                <li class="flex justify-between items-center bg-gray-50 p-3 rounded-lg shadow-sm">
                    <span class="font-semibold text-gray-800">${month.name}</span>
                    ${changeHtml}
                </li>
            `;
        });
        html += '</ul>';
        container.innerHTML = html;

    } catch (error) {
        console.error("Error fetching or rendering monthly rating changes:", error);
        container.innerHTML = '<p class="text-center text-red-500 mt-10">Error loading data.</p>';
    }
}

/**
 * Fetches and displays the user's top opponents by rating.
 * @param {string} currentUserId - The ID of the user.
 * @param {Array} allMatches - The complete list of the user's matches.
 */
async function fetchAndDisplayTopOpponents(currentUserId, allMatches) {
    const container = document.getElementById("top-opponents-list");
    if (!container) {
        console.error("Top opponents list container not found.");
        return;
    }
    
    if (!allMatches || allMatches.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 mt-10">No match history available.</p>';
        return;
    }
    
    container.innerHTML = '<p class="text-center text-gray-500 mt-10">Analyzing opponents...</p>';

    const opponentData = new Map();
    allMatches.forEach(match => {
        let opponentId, opponentName;
        if (match.wid1 === parseInt(currentUserId)) {
            opponentId = match.oid1;
            opponentName = match.vplayer1;
        } else {
            opponentId = match.wid1;
            opponentName = match.hplayer1;
        }
        if (opponentId && opponentName) {
            if (!opponentData.has(opponentId)) {
                opponentData.set(opponentId, { name: opponentName, rating: 0, matches: [] });
            }
            opponentData.get(opponentId).matches.push(match);
        }
    });

    const ratingPromises = Array.from(opponentData.keys()).map(async (id) => {
        try {
            const res = await fetch(`/proxy/user/${id}/ratings-top`);
            if (!res.ok) return;
            const ratingData = await res.json();
            if (ratingData && ratingData.length > 0 && typeof ratingData[0].rating === 'number') {
                opponentData.get(id).rating = ratingData[0].rating;
            }
        } catch (e) {
            console.error(`Could not fetch rating for opponent ${id}`, e);
        }
    });

    await Promise.all(ratingPromises);

    const sortedOpponents = Array.from(opponentData.values())
        .filter(opp => opp.rating > 0)
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 5);

    let html = '<div class="space-y-3">';
    sortedOpponents.forEach(opponent => {
        const lastMatch = opponent.matches.sort((a,b) => new Date(b.MatchDate) - new Date(a.MatchDate))[0];
        const didWin = lastMatch.wid1 === parseInt(currentUserId);
        const resultClass = didWin ? "win" : "lose";

        html += `
            <div class="event-card ${resultClass}" data-matchid="${lastMatch.Matchid}" 
                 data-home-player-name="${lastMatch.hplayer1 || 'Home Player'}" 
                 data-visiting-player-name="${lastMatch.vplayer1 || 'Visiting Player'}">
                <img src="https://ussquash.org/wp-content/uploads/2021/10/Vertical-01-696x665.jpg" class="event-logo" alt="Match" />
                <div class="event-details">
                    <p><strong>vs. ${opponent.name} (${opponent.rating.toFixed(2)})</strong></p>
                    <p>Score: ${lastMatch.Score}</p>
                </div>
            </div>
        `;
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
    if (!container) {
        console.error("Last match details container not found.");
        return;
    }

    if (!allMatches || allMatches.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 mt-10">No match history available.</p>';
        return;
    }

    const lastMatch = allMatches[0]; // Already sorted by date
    
    const opponentName = lastMatch.wid1 === parseInt(currentUserId) ? lastMatch.vplayer1 : lastMatch.hplayer1;
    const result = lastMatch.wid1 === parseInt(currentUserId) ? 'Win' : 'Loss';
    const score = lastMatch.Score;
    const date = new Date(lastMatch.MatchDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

    const html = `
        <div class="space-y-3">
            <div class="flex justify-between">
                <span class="font-medium text-gray-600">Opponent:</span>
                <span class="font-bold text-gray-800">${opponentName}</span>
            </div>
            <div class="flex justify-between">
                <span class="font-medium text-gray-600">Result:</span>
                <span class="font-bold ${result === 'Win' ? 'text-green-600' : 'text-red-600'}">${result}</span>
            </div>
            <div class="flex justify-between">
                <span class="font-medium text-gray-600">Score:</span>
                <span class="font-bold text-gray-800">${score}</span>
            </div>
            <div class="flex justify-between">
                <span class="font-medium text-gray-600">Date:</span>
                <span class="font-bold text-gray-800">${date}</span>
            </div>
        </div>
    `;
    container.innerHTML = html;
}

/**
 * Fetches all matches for a user by paginating through the API.
 * @param {string} currentUserId - The ID of the user.
 * @returns {Promise<Array>} A promise that resolves to an array of all matches.
 */
async function fetchAllMatches(currentUserId) {
    let allMatches = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        try {
            const response = await fetch(`/proxy/user/${currentUserId}/matches/page/${page}`);
            if (!response.ok) {
                console.error(`HTTP error fetching matches page ${page}! Status: ${response.status}`);
                hasMore = false;
                continue;
            }
            const data = await response.json();
            if (data.matches && Array.isArray(data.matches) && data.matches.length > 0) {
                allMatches = allMatches.concat(data.matches);
                page++;
            } else {
                hasMore = false;
            }
        } catch (error) {
            console.error("Critical error fetching matches:", error);
            hasMore = false;
        }
    }
    // Sort all matches by date descending once
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
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        displaySearchResults(data);
    } catch (error) {
        console.error("Error fetching search results:", error);
        searchResultsContainer.innerHTML = '<div class="p-2 text-red-500">Error loading search results.</div>';
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
        resultItem.className = 'flex items-center gap-2 p-2 hover:bg-gray-100 cursor-pointer border-b border-gray-200';
        
        const imageUrl = result.LogoImageUrl || 'https://ussquash.org/wp-content/uploads%2Fussq-profile-icon-default.png';

        resultItem.innerHTML = `
            <img src="${imageUrl}" alt="${result.ObjectName}" class="w-8 h-8 rounded-full object-cover">
            <div>
                <p class="text-sm font-medium">${result.ObjectName}</p>
                <p class="text-xs text-gray-500">${result.ObjectType} ${result.ObjectLocation ? `(${result.ObjectLocation})` : ''}</p>
            </div>
        `;
        resultItem.addEventListener('click', () => {
            loadAnalyticsProfile(result.ObjectId);
        });
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
 * Main function to initialize the page and fetch all necessary data.
 * @param {string} currentUserId - The ID of the user whose data to load.
 */
async function initializePage(currentUserId) {
    lucide.createIcons();
    
    try {
        const response = await fetch(`/proxy/user/${currentUserId}`);
        const userData = await response.json();
        document.getElementById('welcome-message').textContent = `Welcome Back, ${userData.firstName} 🎉`;
    } catch (e) {
        console.error("Could not fetch user's name", e);
        document.getElementById('welcome-message').textContent = `Welcome Back 🎉`;
    }

    fetchCurrentUserRating(currentUserId);
    fetchWeeklyRankings(currentUserId);
    fetchAndDisplayMonthlyRatingChanges(currentUserId);
    fetchMatchStatistics(currentUserId);
    
    const allMatches = await fetchAllMatches(currentUserId);
    
    calculateAverageOpponentRating(25, allMatches);
    fetchAndDisplayTopOpponents(currentUserId, allMatches);
    displayLastMatch(currentUserId, allMatches);
    
    document.getElementById('last-updated-date').textContent = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}


// --- EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', () => {
    const passwordModal = document.getElementById('password-modal');
    const appContainer = document.getElementById('app');
    const passwordInput = document.getElementById('password-input');
    const passwordSubmitBtn = document.getElementById('password-submit-btn');
    const passwordErrorMsg = document.getElementById('password-error-message');

    const checkAccess = () => {
        if (sessionStorage.getItem(SESSION_STORAGE_KEY_ANALYTICS_ACCESS) === 'true') {
            passwordModal.style.display = 'none';
            appContainer.style.display = 'flex';
            loadPageContent(); 
        } else {
            passwordModal.style.display = 'flex';
            appContainer.style.display = 'flex'; // Keep the app visible
        }
    };

    const handlePasswordSubmit = () => {
        if (passwordInput.value === ANALYTICS_ACCESS_CODE) {
            sessionStorage.setItem(SESSION_STORAGE_KEY_ANALYTICS_ACCESS, 'true');
            checkAccess();
        } else {
            passwordErrorMsg.classList.remove('hidden');
            passwordInput.value = '';
        }
    };

    passwordSubmitBtn.addEventListener('click', handlePasswordSubmit);
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handlePasswordSubmit();
        }
    });

    const loadPageContent = () => {
        const urlParams = new URLSearchParams(window.location.search);
        let idFromUrl = urlParams.get('userId');
        let idFromStorage = sessionStorage.getItem('lastViewedAnalyticsUserId');
        let finalUserId;

        if (idFromUrl) {
            finalUserId = idFromUrl;
        } else if (idFromStorage) {
            finalUserId = idFromStorage;
        } else {
            finalUserId = '170053';
        }

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
                    searchTimeout = setTimeout(() => {
                        performSearch(query);
                    }, 300);
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
    
    checkAccess();
});
