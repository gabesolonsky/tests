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

// Global variables for match loading
let currentPageForMatches = 1;
let hasMoreMatches = true;
const MATCH_PAGE_SIZE = 5; // Assuming 5 matches per page as per user input

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
        if (allDivisionRatings.length === 0) {
            if (chartContainer) chartContainer.innerHTML = '<p class="text-center text-gray-500 mt-10">No ranking history available.</p>';
        } else {
            if (chartContainer) chartContainer.innerHTML = ''; 
            new ApexCharts(chartContainer, {
                series: [{ name: 'Rating', data: allDivisionRatings.map(r => r.rating) }],
                chart: { height: '100%', type: 'area', toolbar: { show: false } }, // Changed height to '100%'
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
            }).render();
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

// Helper to normalize player names for comparison
const normalizeName = (name) => {
    if (!name) return '';
    return name.replace(/\s+/g, ' ').trim(); // Replace multiple spaces/nbsp with single space and trim
};

// Function to display a temporary message
function showTemporaryMessage(message, type = 'info') {
    const messageBox = document.getElementById('temp-message-box');
    if (!messageBox) {
        console.warn("Temporary message box element not found.");
        return;
    }

    messageBox.textContent = message;
    messageBox.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg z-50 text-white ';
    
    if (type === 'info') {
        messageBox.classList.add('bg-blue-500');
    } else if (type === 'success') {
        messageBox.classList.add('bg-green-500');
    } else if (type === 'error') {
        messageBox.classList.add('bg-red-500');
    }

    messageBox.style.display = 'block';
    messageBox.style.opacity = '1';

    setTimeout(() => {
        messageBox.style.opacity = '0';
        setTimeout(() => {
            messageBox.style.display = 'none';
        }, 500); // Fade out duration
    }, 3000); // Display duration
}


// New function to fetch and append a single page of matches
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
            console.error(`HTTP error fetching matches page ${pageNumber}! status: ${response.status}`);
            throw new Error(`HTTP error fetching matches page ${pageNumber}! status: ${response.status}`); // Re-throw to be caught by the outer catch
        }
        const data = await response.json();

        if (!data.matches || !Array.isArray(data.matches) || data.matches.length === 0) {
            return false; // No more matches on this page or subsequent pages
        }

        let matchesRenderedThisPage = 0;
        data.matches.forEach(match => {
            if (matchesRenderedThisPage >= pageSize) return; // Only render up to pageSize per call

            // Only process completed or retired matches
            if (match.Status !== "C" && match.Status !== "RE") {
                return;
            }

            // Check if the current user participated in this match (either as winner or loser)
            const userParticipated = (match.wid1 === currentUserId || match.oid1 === currentUserId);
            if (!userParticipated) {
                console.log(`Skipping match ${match.Matchid}: user ${currentUserId} not found as winner or loser.`);
                return;
            }

            let didWin = false;
            let opponentName = "Opponent";

            // Determine win/loss status and opponent name based on currentUserId
            if (match.wid1 === currentUserId) {
                didWin = true;
                opponentName = normalizeName(match.vplayer1); // If current user won, opponent is vplayer1
            } else if (match.oid1 === currentUserId) {
                didWin = false;
                opponentName = normalizeName(match.hplayer1); // If current user lost, opponent is hplayer1
            } else {
                // This case should ideally not be reached if userParticipated is true
                console.warn(`User ${currentUserId} role ambiguous in match ${match.Matchid}. Cannot determine win/loss or opponent.`);
                return; // Skip this match if role is unclear
            }
            
            const resultClass = didWin ? "win" : "lose";

            // Final safeguard: Ensure the resolved opponentName is not the current user's name
            if (normalizeName(opponentName) === normalizeName(currentUserName)) {
                console.warn(`Opponent name resolved to current user's name for match ${match.Matchid}. Forcing to 'Opponent'.`);
                opponentName = "Opponent";
            }

            // Ensure opponentName is not empty or just whitespace
            if (!opponentName || opponentName.trim() === '') {
                opponentName = "Opponent";
            }


            let formattedScore = 'N/A';
            if (match.Score) {
                const games = match.Score.split(',');
                const formattedGames = games.map(game => {
                    const [left, right] = game.split('-');
                    return didWin ? `${left}-${right}` : `${right}-${left}`;
                });
                formattedScore = formattedGames.join(', ');
            }
            if (match.Status === "RE") {
                formattedScore += ` (${match.Status})`;
            }

            const matchDate = new Date(match.MatchDate).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
            });

            let descriptionHTML = '';
            if (match.Descr && match.Descr.trim() !== '') {
                descriptionHTML = `<p>${match.Descr}</p>`;
            }

            const matchHTML = `
                <div class="event-card ${resultClass}" data-matchid="${match.Matchid}" 
                     data-home-player-name="${match.hplayer1 || 'Home Player'}" 
                     data-visiting-player-name="${match.vplayer1 || 'Visiting Player'}">
                    <img src="https://ussq-img-live.s3.us-east-1.amazonaws.com/uploads%2Fussq-profile-icon-default.png" class="event-logo" alt="Match" />
                    <div class="event-details">
                        <p><strong>${matchDate}</strong></p>
                        <p>Score: ${formattedScore}</p>
                        ${descriptionHTML}
                        <p>vs. ${opponentName}</p>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML("beforeend", matchHTML);
            matchesRenderedThisPage++;
        });

        return data.matches.length === pageSize; // Return true if there might be more pages
    } catch (error) { // Corrected from 'catches' to 'catch'
        console.error("Error fetching or rendering matches page:", error);
        container.innerHTML = '<p class="text-center text-red-500 mt-4">Error loading matches.</p>';
        return false; // Indicate error, stop loading
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (loadMoreBtn) loadMoreBtn.disabled = false;
    }
}

// Function to handle loading of match pages via button click
async function loadNextMatches(currentUserId, currentUserName) {
    const container = document.querySelector("#matches-container");
    const loadMoreBtn = document.getElementById("load-more-matches-btn");
    const noMoreMatchesMessage = document.getElementById("no-more-matches-message");

    if (currentPageForMatches === 1) { // Only clear on the very first load
        if (container) container.innerHTML = "";
    }

    if (hasMoreMatches) {
        hasMoreMatches = await fetchAndAppendMatchesPage(currentUserId, currentUserName, currentPageForMatches, MATCH_PAGE_SIZE);
        currentPageForMatches++;

        if (!hasMoreMatches) {
            // No more matches, hide the button and show the message
            if (loadMoreBtn) loadMoreBtn.style.display = 'none';
            if (noMoreMatchesMessage) noMoreMatchesMessage.style.display = 'block';
            // If it's the first page and no matches were found, display a message within the container
            if (currentPageForMatches === 2 && container && container.children.length === 0) {
                container.innerHTML = '<p class="text-center text-gray-500 mt-4">No completed matches found.</p>';
            }
        } else {
             // More matches, ensure button is visible
            if (loadMoreBtn) loadMoreBtn.style.display = 'block';
            if (noMoreMatchesMessage) noMoreMatchesMessage.style.display = 'none';
        }
    } else {
        // No more matches to load
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        if (noMoreMatchesMessage) noMoreMatchesMessage.style.display = 'block';
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

// Fetches and renders match record breakdown and win rate
async function fetchAndRenderMatchRecord(currentUserId) {
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

            if (winsEl) winsEl.textContent = matchesWon; // Corrected from winsWon
            if (lossesEl) lossesEl.textContent = matchesLost;
        });

        const overallWinsEl = document.getElementById('overall-wins');
        if (overallWinsEl) {
            overallWinsEl.textContent = totalWins;
        }

        const overallLossesEl = document.getElementById('overall-losses');
        if (overallLossesEl) {
            overallLossesEl.textContent = totalLosses;
        }

        const matchesPlayedTotalEl = document.getElementById('matches-played-total');
        if (matchesPlayedTotalEl) {
            matchesPlayedTotalEl.textContent = totalWins + totalLosses;
        }

        const winRateDisplayEl = document.getElementById('win-rate-display');
        if (winRateDisplayEl) {
            if (totalWins + totalLosses > 0) {
                const winRate = (totalWins / (totalWins + totalLosses)) * 100;
                winRateDisplayEl.textContent = `${winRate.toFixed(0)}%`;
            } else {
                winRateDisplayEl.textContent = "0%";
            }
        }

    } catch (error) {
        console.error("Error fetching or rendering match record:", error);
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

// Fetches and renders user's personal details - MODIFIED TO RETURN USER NAME
async function fetchAndRenderUserDetails(currentUserId) {
    try {
        const response = await fetch(`/proxy/user/${currentUserId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const userData = await response.json();
        console.log("User Details Data:", userData);

        const welcomeMessageEl = document.getElementById('welcome-message');
        if (welcomeMessageEl && userData.firstName) {
            welcomeMessageEl.textContent = `Welcome Back, ${userData.firstName} 🎉`; 
        }

        const profilePictureEl = document.getElementById('profile-picture');
        if (profilePictureEl && userData.profilePictureUrl) {
            profilePictureEl.src = userData.profilePictureUrl;
        } else if (profilePictureEl) {
            profilePictureEl.src = 'https://ussq-img-live.s3.us-east-1.amazonaws.com/uploads%2Fussq-profile-icon-default.png'; // Default fallback
        }

        const playerNameEl = document.getElementById('player-name');
        if (playerNameEl && userData.name) {
            playerNameEl.textContent = userData.name;
        } else if (playerNameEl) {
            playerNameEl.textContent = 'N/A';
        }

        const memberStatusEl = document.getElementById('member-status');
        if (memberStatusEl && typeof userData.isMember === 'boolean') {
            memberStatusEl.textContent = userData.isMember ? 'Member, US Squash' : 'Non-Member, US Squash';
        } else if (memberStatusEl) {
            memberStatusEl.textContent = 'Status Unavailable';
        }

        const playerEmailEl = document.getElementById('player-email');
        if (playerEmailEl && userData.Email) { 
            playerEmailEl.textContent = userData.Email;
        } else if (playerEmailEl) {
            playerEmailEl.textContent = 'N/A';
        }

        const playerPhoneEl = document.getElementById('player-phone');
        if (playerPhoneEl && userData.CellPhone) { 
            playerPhoneEl.textContent = userData.CellPhone;
        } else if (playerPhoneEl) {
            playerPhoneEl.textContent = 'N/A';
        }

        const playerBirthdayEl = document.getElementById('player-birthday');
        if (playerBirthdayEl && userData.BirthDate) { 
            const birthDate = new Date(userData.BirthDate);
            if (!isNaN(birthDate)) {
                playerBirthdayEl.textContent = birthDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
            } else {
                playerBirthdayEl.textContent = 'N/A'; 
            }
        } else if (playerBirthdayEl) {
            playerBirthdayEl.textContent = 'N/A';
        }

        const playerGenderEl = document.getElementById('player-gender');
        if (playerGenderEl && userData.Gender) { 
            playerGenderEl.textContent = userData.Gender;
        } else if (playerGenderEl) {
            playerGenderEl.textContent = 'N/A';
        }

        const playerCitizenshipEl = document.getElementById('player-citizenship');
        // This will remain the static value from HTML unless an API field is provided.

        const playerCityEl = document.getElementById('player-city');
        if (playerCityEl && userData.City && userData.State && userData.Zip) { 
            playerCityEl.textContent = `${userData.City}, ${userData.State} ${userData.Zip}`;
        } else if (playerCityEl && userData.City) { 
             playerCityEl.textContent = userData.City;
        } else if (playerCityEl) {
            playerCityEl.textContent = 'N/A';
        }

        const playerAffiliationEl = document.getElementById('player-affiliation');
        if (playerAffiliationEl && userData.mainAffiliation && userData.mainAffiliation.descr) {
            playerAffiliationEl.textContent = userData.mainAffiliation.descr;
        } else if (playerAffiliationEl) {
            playerAffiliationEl.textContent = 'N/A';
        }

        const playerMembershipThruEl = document.getElementById('player-membership-thru');
        if (playerMembershipThruEl && userData.PAID_THRU) {
            const paidThruDate = new Date(userData.PAID_THRU);
            if (!isNaN(paidThruDate)) {
                playerMembershipThruEl.textContent = paidThruDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
            } else {
                playerMembershipThruEl.textContent = 'N/A'; 
            }
        } else if (playerMembershipThruEl) {
            playerMembershipThruEl.textContent = 'N/A';
        }

        return userData.name; // IMPORTANT: Return the user's full name
    } catch (error) {
        console.error("Error fetching or rendering user details:", error);
        // Set UI elements to indicate an'error
        document.getElementById('welcome-message').textContent = 'Welcome Back, User 🎉';
        document.getElementById('profile-picture').src = 'https://ussq-img-live.s3.us-east-1.amazonaws.com/uploads%2Fussq-profile-icon-default.png';
        document.getElementById('player-name').textContent = 'Error Loading';
        document.getElementById('member-status').textContent = 'Status Unavailable';
        document.getElementById('player-email').textContent = 'N/A';
        document.getElementById('player-phone').textContent = 'N/A';
        document.getElementById('player-birthday').textContent = 'N/A';
        document.getElementById('player-gender').textContent = 'N/A';
        document.getElementById('player-city').textContent = 'N/A';
        document.getElementById('player-affiliation').textContent = 'N/A';
        document.getElementById('player-membership-thru').textContent = 'N/A';
        return null; // Return null on error
    }
}

// Fetches and calculates the average opponent rating from the last 15 matches
async function fetchAndCalculateAverageOpponentRating(currentUserId) {
    const averageOpponentRatingElement = document.getElementById("average-opponent-rating");
    if (averageOpponentRatingElement) {
        averageOpponentRatingElement.textContent = "Loading..."; // Set loading state
    }

    let opponentRatings = [];
    let matchesProcessedCount = 0;
    const matchesToConsider = 15; // Limit to the last 15 matches

    // Fetch matches across multiple pages until we have enough or run out of matches
    for (let page = 1; matchesProcessedCount < matchesToConsider; page++) {
        try {
            const response = await fetch(`/proxy/user/${currentUserId}/matches/page/${page}`);
            if (!response.ok) {
                console.error(`HTTP error fetching matches page ${page} for average opponent rating! Status: ${response.status}`);
                break; // Stop if there's an error fetching matches
            }
            const data = await response.json();

            if (!data.matches || !Array.isArray(data.matches) || data.matches.length === 0) {
                console.log(`No more matches available from page ${page} for average opponent rating calculation.`);
                break; // No more matches to process
            }

            for (const match of data.matches) {
                if (matchesProcessedCount >= matchesToConsider) break; // Stop after processing 15 matches

                // Only consider completed or retired matches
                if (match.Status !== "C" && match.Status !== "RE") {
                    continue; // Skip non-completed/retired matches
                }

                let opponentId;
                // Determine opponent ID based on who the current user is (winner or opponent)
                if (match.wid1 === currentUserId) {
                    opponentId = match.oid1; // Current user won, opponent is oid1
                } else if (match.oid1 === currentUserId) {
                    opponentId = match.wid1; // Current user lost, opponent is wid1
                } else {
                    console.warn(`User ${currentUserId} not found as participant (winner/opponent) in match ${match.Matchid}. Skipping for average opponent rating.`);
                    continue; // User not in this match, skip
                }

                if (opponentId) {
                    try {
                        const opponentRatingResponse = await fetch(`/proxy/user/${opponentId}/ratings-top`);
                        if (!opponentRatingResponse.ok) {
                            console.warn(`Could not fetch rating for opponent ${opponentId} (Match ID: ${match.Matchid}). Status: ${opponentRatingResponse.status}`);
                            continue; // Skip this opponent if rating fetch fails
                        }
                        const opponentRatingData = await opponentRatingResponse.json();
                        if (opponentRatingData && opponentRatingData.length > 0 && typeof opponentRatingData[0].rating === 'number' && !isNaN(opponentRatingData[0].rating)) {
                            opponentRatings.push(opponentRatingData[0].rating);
                            matchesProcessedCount++; // Increment count only for successfully processed opponent ratings
                        } else {
                            console.warn(`No valid rating data found for opponent ${opponentId} (Match ID: ${match.Matchid}).`);
                        }
                    } catch (error) {
                        console.error(`Error fetching rating for opponent ${opponentId} (Match ID: ${match.Matchid}):`, error);
                    }
                }
            }
        } catch (error) {
            console.error("Critical error fetching matches for average opponent rating calculation:", error);
            break; // Break outer loop on critical error
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

    searchResultsContainer.innerHTML = '<div class="p-2 text-gray-500">Searching...</div>';
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
                loadPlayerProfile(result.ObjectId);
                searchInput.value = result.ObjectName; // Populate search input with selected name
                searchResultsContainer.classList.add('hidden'); // Hide results
            } else {
                console.warn("Selected result is not a player or missing ObjectId:", result);
            }
        });
        searchResultsContainer.appendChild(resultItem);
    });
    searchResultsContainer.classList.remove('hidden');
}

// Function to load all dashboard data for a given userId
async function loadPlayerProfile(newUserId) {
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

    // Clear existing matches display
    const matchesContainer = document.querySelector("#matches-container");
    if (matchesContainer) {
        matchesContainer.innerHTML = '';
    }
    const loadMoreBtn = document.getElementById('load-more-matches-btn');
    if (loadMoreBtn) loadMoreBtn.style.display = 'block'; // Ensure button is visible for new profile
    const noMoreMatchesMessage = document.getElementById('no-more-matches-message');
    if (noMoreMatchesMessage) noMoreMatchesMessage.style.display = 'none'; // Hide no more matches message

    // Fetch and render all dashboard components for the new user
    const userName = await fetchAndRenderUserDetails(userId); // Get the user's name for match rendering

    if (userName) {
        fetchUserRatings(userId);
        fetchAndRenderRatings(userId);
        fetchAndRenderMatchRecord(userId);
        populateRatingTooltip(); // This doesn't depend on userId, but good to call for consistency
        await loadNextMatches(userId, userName); // Load first page of matches for the new user
        await fetchAndCalculateAverageOpponentRating(userId);
    } else {
        console.error("User name not available for new profile, cannot render matches or calculate opponent rating accurately.");
        document.querySelector("#matches-container").innerHTML = '<p class="text-center text-red-500 mt-4">Could not load match history for this player.</p>';
    }
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
            loadMoreBtn.addEventListener('click', async () => {
                const userName = await fetchAndRenderUserDetails(userId); // Re-fetch name to ensure it's current
                if (userName) {
                    loadNextMatches(userId, userName);
                }
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
    const graphStatus = document.getElementById("graph-status");
    const metricsContainer = document.getElementById("metrics-container");
    const matchInsightsTitle = document.getElementById("match-insights-title");
    
    // Clear previous content and show modal with code input
    if (metricsContainer) metricsContainer.innerHTML = '';
    if (graphStatus) graphStatus.textContent = '';
    if (matchInsightsTitle) matchInsightsTitle.textContent = 'Enter Access Code for Match Insights';

    if (graphModal) {
        graphModal.style.display = "flex"; 
        graphModal.style.alignItems = "center"; 
        graphModal.style.justifyContent = "center";
    } else {
        console.error("Error: Element with ID 'graph-modal' not found.");
        showTemporaryMessage("Error displaying match insights modal.", "error");
        return;
    }

    // Check if access has already been granted in this session
    if (sessionStorage.getItem(SESSION_STORAGE_KEY_MATCH_INSIGHTS) === 'true') {
        if (matchInsightsTitle) matchInsightsTitle.textContent = 'Match Insights'; // Reset title
        await loadMatchInsights(match); // Proceed to load insights
        return; // Exit the function, no need to show password modal
    }

    const codeInputHtml = `
        <div id="code-input-area" class="text-center p-4">
            <p class="mb-4 text-gray-700">Please enter the access code to view detailed match insights:</p>
            <p class="mb-4 text-gray-700">For more details, please contact <a href="tel:${CONTACT_PHONE_NUMBER}" class="text-indigo-600 hover:underline">${CONTACT_PHONE_NUMBER}</a>.</p>
            <input type="password" id="access-code-input" class="border border-gray-300 rounded-md p-2 text-center text-lg w-48 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Enter code">
            <button id="submit-code-btn" class="ml-3 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">Submit</button>
            <p id="code-error-message" class="text-red-500 text-sm mt-2 hidden">Incorrect code. Please try again.</p>
        </div>
    `;
    if (metricsContainer) metricsContainer.innerHTML = codeInputHtml;

    const accessCodeInput = document.getElementById('access-code-input');
    const submitCodeBtn = document.getElementById('submit-code-btn');
    const codeErrorMessage = document.getElementById('code-error-message');

    const handleCodeSubmission = async () => {
        if (accessCodeInput.value === MATCH_INSIGHTS_ACCESS_CODE) {
            sessionStorage.setItem(SESSION_STORAGE_KEY_MATCH_INSIGHTS, 'true'); // Set flag in session storage
            if (codeErrorMessage) codeErrorMessage.classList.add('hidden');
            if (metricsContainer) metricsContainer.innerHTML = ''; // Clear code input
            if (matchInsightsTitle) matchInsightsTitle.textContent = 'Match Insights'; // Reset title
            await loadMatchInsights(match); // Proceed to load insights
        } else {
            if (codeErrorMessage) codeErrorMessage.classList.remove('hidden');
            accessCodeInput.value = ''; // Clear input on wrong code
        }
    };

    // Remove old listeners to prevent duplicates
    // This is important because showGraphModal might be called multiple times
    if (submitCodeBtn) {
        submitCodeBtn.onclick = null; // Clear existing click handler
        submitCodeBtn.addEventListener("click", handleCodeSubmission);
    }
    if (accessCodeInput) {
        accessCodeInput.removeEventListener("keypress", handleCodeSubmissionOnEnter); // Remove named function
        accessCodeInput.addEventListener("keypress", handleCodeSubmissionOnEnter); // Add named function
    }
    // Define handleCodeSubmissionOnEnter to allow removal
    function handleCodeSubmissionOnEnter(e) {
        if (e.key === 'Enter') {
            handleCodeSubmission();
        }
    }
}

async function loadMatchInsights(match) {
    const match_id = match.matchId || match.Matchid;
    const apiUrl = `/proxy/liveScoreDetails?match_id=${match_id}`;
    const graphStatus = document.getElementById("graph-status");
    const metricsContainer = document.getElementById("metrics-container");

    if (graphStatus) graphStatus.textContent = "Loading match insights...";
    
    // Fetch data from the proxy.
    let data;
    try {
        const response = await fetch(apiUrl, { method: "GET", credentials: "include" });
        if (response.ok) {
            data = await response.json();
        } else {
            throw new Error("Proxy response not ok");
        }
    } catch (error) {
        console.error("Error fetching proxy data:", error);
        if (graphStatus) graphStatus.textContent = ""; // Clear loading message
        showTemporaryMessage("No live scoring available for this match.", "info"); // Show message on screen
        return; // Stop execution
    }

    if (!data || data.length === 0) {
        if (graphStatus) graphStatus.textContent = ""; // Clear loading message
        showTemporaryMessage("No live scoring available for this match.", "info"); // Show message on screen
        return; // Stop execution
    }
    
    // Filter scoring events.
    const allPoints = data.filter(evt => evt.Decision === "point");
    if (allPoints.length < 2) {
        if (graphStatus) graphStatus.textContent = ""; // Clear loading message
        showTemporaryMessage("No live scoring available for this match.", "info"); // Show message on screen
        return; // Stop execution
    }
    allPoints.sort((a, b) => new Date(a.StartDate) - new Date(b.StartDate));
    
    // Player names for labeling
    const homePlayerName = match.playerHome1Name || "Home Player";
    const visitingPlayerName = match.playerVisiting1Name || "Visiting Player";
    
    // Figure out how many games each player won (match score)
    const gameMap = {};
    for (let evt of allPoints) {
        const g = evt.Game_Number;
        if (!gameMap[g]) gameMap[g] = [];
        gameMap[g].push(evt);
    }
    const uniqueGames = Object.keys(gameMap).map(g => parseInt(g)).sort((a, b) => a - b);
    
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
    let longestPointSec = 0; // Reset for overall longest point
    const MAX_POINT_DURATION_SEC = 120; // 2 minutes

    console.log("Starting point duration calculations. Max allowed duration:", MAX_POINT_DURATION_SEC, "seconds.");

    for (let gameNum of uniqueGames) {
        const pointsInGame = gameMap[gameNum].sort((a, b) => new Date(a.StartDate) - new Date(b.StartDate));
        for (let i = 1; i < pointsInGame.length; i++) {
            const diffSec = (new Date(pointsInGame[i].StartDate) - new Date(pointsInGame[i-1].StartDate)) / 1000;
            if (diffSec <= MAX_POINT_DURATION_SEC) { // Exclude points longer than 2 minutes
                totalPointPlayTimeSec += diffSec;
                validPointsCount++;
                if (diffSec > longestPointSec) {
                    longestPointSec = diffSec;
                }
            } else {
                console.log(`Point duration ${diffSec.toFixed(2)}s for game ${gameNum}, point ${i} excluded (>${MAX_POINT_DURATION_SEC}s)`);
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
    
    // Build tabbed interface
    if (!metricsContainer) {
        console.error("Error: Metrics container not found.");
        return;
    }
    metricsContainer.innerHTML = ''; // Clear previous content

    const tabNav = document.createElement("div");
    tabNav.id = "tab-nav";
    tabNav.classList.add("flex", "justify-center", "border-b", "border-gray-200", "mb-4"); // Added justify-center for centering tabs
    console.log("Tab navigation created and centering class added.");
    
    const tabContent = document.createElement("div");
    tabContent.id = "tab-content";
    tabContent.classList.add("p-4");
    
    // Overview tab button
    const overviewTabBtn = document.createElement("button");
    overviewTabBtn.textContent = "Overview";
    overviewTabBtn.classList.add("tab-button", "py-2", "px-4", "text-sm", "font-medium", "text-gray-600", "hover:text-indigo-600", "focus:outline-none", "border-b-2", "border-transparent");
    tabNav.appendChild(overviewTabBtn);
    
    // Overview tab content
    const overviewContent = document.createElement("div");
    overviewContent.classList.add("tab-content-pane");
    overviewContent.id = "overview-tab";
    overviewContent.style.display = "block";
    
    // Match Score
    const matchScoreDiv = document.createElement("div");
    matchScoreDiv.classList.add("mb-4", "text-center");
    matchScoreDiv.innerHTML = `
        <h3 class="text-lg font-semibold mb-2">Match Score</h3>
        <p class="text-2xl font-bold">${homePlayerName} <span class="text-red-500">${homeGamesWon}</span> - <span class="text-blue-500">${visitingGamesWon}</span> ${visitingPlayerName}</p>
      `;
    overviewContent.appendChild(matchScoreDiv);
    
    // Additional stats row
    const overviewStats = document.createElement("div");
    overviewStats.classList.add("flex", "justify-center", "gap-4", "mb-6", "flex-wrap");
    
    function makeStatBox(label, value) {
        const box = document.createElement("div");
        box.classList.add("bg-gray-50", "p-3", "rounded-lg", "shadow-sm", "text-center", "min-w-[120px]");
        box.innerHTML = `<strong class="block text-gray-600 text-sm">${label}:</strong> <span class="text-lg font-semibold text-indigo-700">${value}</span>`;
        return box;
    }
    overviewStats.appendChild(makeStatBox("Match Length", formatDurationSec(matchLengthSec)));
    overviewStats.appendChild(makeStatBox("Avg Point", formatDurationSec(averagePointSec)));
    overviewStats.appendChild(makeStatBox("Longest Point", formatDurationSec(longestPointSec)));
    overviewStats.appendChild(makeStatBox("Avg Game", formatDurationSec(averageGameSec)));
    overviewContent.appendChild(overviewStats);
    
    // Bar chart for game scores
    const barChartDiv = document.createElement("div");
    barChartDiv.classList.add("max-w-xl", "mx-auto", "mb-4");
    const barCanvas = document.createElement("canvas");
    barCanvas.id = "game-scores-bar-chart";
    barChartDiv.appendChild(barCanvas);
    overviewContent.appendChild(barChartDiv);
    
    new Chart(barCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: gameLabels,
          datasets: [
            {
              label: homePlayerName,
              data: homeGameScores,
              backgroundColor: 'rgba(239, 68, 68, 0.8)' // red-500
            },
            {
              label: visitingPlayerName,
              data: visitingGameScores,
              backgroundColor: 'rgba(59, 130, 246, 0.8)' // blue-500
            }
          ]
        },
        options: {
          responsive: true,
          plugins: { 
            legend: { display: true, position: 'top', labels: { color: '#333' } },
            title: { display: true, text: 'Game Scores', color: '#333', font: { size: 16 } }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#333' }
            },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(0,0,0,0.1)' },
              ticks: { color: '#333' }
            }
          }
        }
    });
    
    tabContent.appendChild(overviewContent);
    
    // Create a tab for each game
    uniqueGames.forEach(gameNum => {
        const gameTabBtn = document.createElement("button");
        gameTabBtn.textContent = `Game ${gameNum}`;
        gameTabBtn.classList.add("tab-button", "py-2", "px-4", "text-sm", "font-medium", "text-gray-600", "hover:text-indigo-600", "focus:outline-none", "border-b-2", "border-transparent");
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
            let validGamePointsCount = 0;

            for (let i = 1; i < pointsGame.length; i++) {
                const diffSec = (new Date(pointsGame[i].StartDate) - new Date(pointsGame[i-1].StartDate)) / 1000;
                if (diffSec <= MAX_POINT_DURATION_SEC) { // Exclude points longer than 2 minutes
                    intervals.push(diffSec);
                    validGamePointsCount++;
                    if (diffSec > longestPointSecGame) {
                        longestPointSecGame = diffSec;
                    }
                } else {
                    console.log(`Point duration ${diffSec.toFixed(2)}s for game ${gameNum}, point ${i} excluded (>${MAX_POINT_DURATION_SEC}s)`);
                }
            }
            const avgPointSecGame = intervals.length ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
        
            const scoreboardDiv = document.createElement("div");
            scoreboardDiv.classList.add("mb-4", "text-center");
            scoreboardDiv.innerHTML = `
                <h3 class="text-lg font-semibold mb-2">Final Score for Game ${gameNum}</h3>
                <p class="text-xl font-bold mb-4"><span class="text-red-500">${homePlayerName}:</span> ${finalLeft} | <span class="text-blue-500">${visitingPlayerName}:</span> ${finalRight}</p>
                <div class="flex justify-center gap-4 flex-wrap">
                  ${makeStatBox("Game Length", formatDurationSec(gameLengthSec)).outerHTML}
                  ${makeStatBox("Avg Point", formatDurationSec(avgPointSecGame)).outerHTML}
                  ${makeStatBox("Longest Point", formatDurationSec(longestPointSecGame)).outerHTML}
                </div>
              `;
            gameContent.appendChild(scoreboardDiv);
        
            const x = pointsGame.map(evt => evt.Points_left + evt.Points_right);
            const p1_scores = pointsGame.map(evt => evt.Points_left);
            const p2_scores = pointsGame.map(evt => evt.Points_right);
        
            const lineCanvas = document.createElement("canvas");
            lineCanvas.style.maxWidth = "100%";
            lineCanvas.style.maxHeight = "350px"; // Increased height for better visibility
            gameContent.appendChild(lineCanvas);
        
            new Chart(lineCanvas.getContext('2d'), {
                type: 'line',
                data: {
                  labels: x,
                  datasets: [
                    {
                      label: homePlayerName,
                      data: p1_scores,
                      borderColor: 'rgb(239, 68, 68)', // red-500
                      backgroundColor: 'rgba(239, 68, 68, 0.2)',
                      fill: true,
                      tension: 0.3,
                      pointStyle: 'circle',
                      pointRadius: 5,
                      pointHoverRadius: 7,
                      borderWidth: 2
                    },
                    {
                      label: visitingPlayerName,
                      data: p2_scores,
                      borderColor: 'rgb(59, 130, 246)', // blue-500
                      backgroundColor: 'rgba(59, 130, 246, 0.2)',
                      fill: true,
                      tension: 0.3,
                      pointStyle: 'circle',
                      pointRadius: 5,
                      pointHoverRadius: 7,
                      borderWidth: 2
                    }
                  ]
                },
                options: {
                  responsive: true,
                  maintainAspectRatio: false, // Allow custom height
                  plugins: { 
                    legend: { display: true, position: 'top', labels: { color: '#333' } },
                    title: { display: true, text: `Game ${gameNum} Score Progression`, color: '#333', font: { size: 16 } }
                  },
                  scales: {
                    x: {
                      type: 'linear',
                      title: { display: true, text: 'Total Points Played in Game', color: '#333' },
                      ticks: { stepSize: 1, color: '#333' },
                      grid: { color: 'rgba(0,0,0,0.1)', drawBorder: false }
                    },
                    y: {
                      beginAtZero: true,
                      title: { display: true, text: 'Score', color: '#333' },
                      ticks: { color: '#333' },
                      grid: { color: 'rgba(0,0,0,0.1)', drawBorder: false }
                    }
                  }
                }
            });
        
            // Removed the "Time Between Points" chart section
        }
        tabContent.appendChild(gameContent);
    
        gameTabBtn.addEventListener("click", () => {
          tabContent.querySelectorAll(".tab-content-pane").forEach(pane => pane.style.display = "none");
          tabNav.querySelectorAll(".tab-button").forEach(btn => btn.classList.remove("active", "border-indigo-500", "text-indigo-600"));
          gameContent.style.display = "block";
          gameTabBtn.classList.add("active", "border-indigo-500", "text-indigo-600");
        });
    });
    
    overviewTabBtn.addEventListener("click", () => {
        tabContent.querySelectorAll(".tab-content-pane").forEach(pane => pane.style.display = "none");
        tabNav.querySelectorAll(".tab-button").forEach(btn => btn.classList.remove("active", "border-indigo-500", "text-indigo-600"));
        overviewContent.style.display = "block";
        overviewTabBtn.classList.add("active", "border-indigo-500", "text-indigo-600");
    });
    
    metricsContainer.appendChild(tabNav);
    metricsContainer.appendChild(tabContent);
    
    // Set initial active tab styling
    overviewTabBtn.classList.add("active", "border-indigo-500", "text-indigo-600");

    // "Match Insights" title centering
    const matchInsightsTitle = document.getElementById("match-insights-title");
    if (matchInsightsTitle) {
        matchInsightsTitle.classList.add("text-center");
        console.log("'Match Insights' title centered.");
    } else {
        console.warn("Element with ID 'match-insights-title' not found.");
    }

    if (graphStatus) graphStatus.textContent = "";
}
    
function closeGraphModal() {
    document.getElementById("graph-modal").style.display = "none";
}
document.getElementById("graph-close").addEventListener("click", closeGraphModal);
window.addEventListener("click", function (event) {
    const graphModal = document.getElementById("graph-modal");
    if (event.target == graphModal) graphModal.style.display = "none";
});

// Function to add the "Contact Me" section to the sidebar
function addContactMeSection() {
    lucide.createIcons(); // Re-render Lucide icons for the newly added phone icon
}
