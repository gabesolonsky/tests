document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById('search-input');
    const searchResultsContainer = document.getElementById('search-results');
    const lookupResultContainer = document.getElementById('lookup-result-container');
    let searchTimeout = null;

    /**
     * Toggles the sidebar visibility.
     */
    window.toggleSidebar = function() {
        document.getElementById("app").classList.toggle("sidebar-expanded");
    };

    /**
     * Creates the HTML for a single player card. The remove button and name link are now optional.
     * @param {object} player - The player data object.
     * @returns {string} The HTML string for the player card.
     */
    function createPlayerCardHTML(player) {
        const defaultProfilePic = 'https://ussq-img-live.s3.us-east-1.amazonaws.com/uploads%2Fussq-profile-icon-default.png';
        const matchResultClass = player.matchStatus === 'win' ? 'text-green-600' : 'text-red-600';
        const matchResultText = player.matchStatus ? player.matchStatus.charAt(0).toUpperCase() + player.matchStatus.slice(1) : 'N/A';
        
        const matchDate = player.matchDate ? new Date(player.matchDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
        const nextMatchDate = player.nextMatchWonDate ? new Date(player.nextMatchWonDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'TBD';

        return `
            <div class="bg-white/70 backdrop-blur-md border border-gray-200 rounded-2xl p-6 shadow-xl font-sans flex flex-col">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-4">
                        <img src="${player.profilePictureUrl || defaultProfilePic}" alt="${player.name}" class="w-16 h-16 rounded-full object-cover shadow-md">
                        <div>
                            <h3 class="text-xl font-bold text-gray-800">${player.name}</h3>
                            <p class="text-sm text-gray-500">ID: ${player.id}</p>
                        </div>
                    </div>
                </div>

                <div class="bg-gray-50 rounded-lg p-4 mb-4">
                    <h4 class="font-semibold text-gray-700 mb-2">Last Match</h4>
                    <p class="text-sm text-gray-600">vs. <strong>${player.matchOpponent || 'N/A'}</strong> on ${matchDate}</p>
                    <p class="text-sm text-gray-600">Event: ${player.matchEvent || 'N/A'}</p>
                    <div class="flex justify-between items-center mt-2">
                        <span class="font-bold text-lg ${matchResultClass}">${matchResultText}</span>
                        <span class="text-gray-800 font-mono">${player.matchScore || 'No Score'}</span>
                    </div>
                </div>

                <div class="bg-indigo-50 rounded-lg p-4">
                    <h4 class="font-semibold text-indigo-800 mb-2">Next Match</h4>
                     <p class="text-sm text-indigo-700">vs. <strong>${player.nextMatchWonOpponent || 'TBD'}</strong> on ${nextMatchDate}</p>
                    <p class="text-sm text-indigo-700">Event: ${player.nextMatchWonEvent || 'TBD'}</p>
                    <p class="text-sm text-indigo-700 mt-2">Time: ${player.nextMatchWonTime || 'TBD'} on Court ${player.nextMatchWonCourt || 'TBD'}</p>
                </div>
            </div>
        `;
    }

    /**
     * Adds a player to the tracker and returns success status.
     * @param {number} playerId - The ID of the player to add.
     * @returns {boolean} - True if successful, false otherwise.
     */
    async function addPlayerToTracker(playerId) {
        try {
            const response = await fetch("/proxy/player_tracker/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ playerId: parseInt(playerId) })
            });
            const data = await response.json();
            return data.success;
        } catch (err) {
            console.error(`Failed to add player ${playerId}:`, err);
            return false;
        }
    }

    /**
     * Removes a player from the tracker.
     * @param {number} playerId - The ID of the player to remove.
     */
    async function removePlayerFromTracker(playerId) {
        try {
            const response = await fetch(`/proxy/player_tracker/${playerId}`, {
                method: "DELETE"
            });
            const data = await response.json();
            if (data.success) {
                console.log(`Successfully cleaned up player ${playerId} from tracker.`);
            } else {
                 console.error(data.error || "Cleanup failed.");
            }
        } catch(err) {
             console.error(`Failed to remove player ${playerId}:`, err);
        }
    }
    
    /**
     * The main workflow for looking up a player.
     * @param {object} playerInfo - The basic player info from search results.
     */
    async function performPlayerLookup(playerInfo) {
        if (!lookupResultContainer) return;
        lookupResultContainer.innerHTML = `<div class="bg-white/70 backdrop-blur-md border border-gray-200 rounded-2xl p-8 shadow-xl text-center"><p class="text-gray-500">Fetching details for ${playerInfo.ObjectName}...</p></div>`;

        try {
            // Step 1: Add player to the tracker
            const added = await addPlayerToTracker(playerInfo.ObjectId);
            if (!added) throw new Error('Could not add player to tracker. They might already be tracked in another session.');

            // Step 2: Fetch the tracker list to get detailed info
            const response = await fetch('/proxy/player_tracker/list');
            if (!response.ok) throw new Error('Could not fetch tracker data.');
            const trackerData = await response.json();
            
            // Step 3: Find the specific player's data
            const playerData = trackerData.trackedPlayers.find(p => p.id == playerInfo.ObjectId);
            if (!playerData) throw new Error('Player data not found in tracker list after adding.');

            // Step 4: Display the data
            lookupResultContainer.innerHTML = createPlayerCardHTML(playerData);
            lucide.createIcons();

        } catch (error) {
            lookupResultContainer.innerHTML = `<div class="bg-white/70 backdrop-blur-md border border-gray-200 rounded-2xl p-8 shadow-xl text-center"><p class="text-red-500 font-semibold">Error: ${error.message}</p></div>`;
        } finally {
            // Step 5: Always attempt to remove the player to clean up the tracker
            await removePlayerFromTracker(playerInfo.ObjectId);
        }
    }

    /**
     * Performs a search and displays results.
     */
    async function performSearch(query) {
        const formattedQuery = query.replace(/\s/g, '+');
        const apiUrl = `/proxy/resources/res/search/${formattedQuery}`;
        searchResultsContainer.innerHTML = '<div class="p-2 text-gray-500">Searching...</div>';
        searchResultsContainer.classList.remove('hidden');
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            displaySearchResults(await response.json());
        } catch (error) {
            console.error("Error fetching search results:", error);
            searchResultsContainer.innerHTML = '<div class="p-2 text-red-500">Error loading search results.</div>';
        }
    }

    function displaySearchResults(results) {
        searchResultsContainer.innerHTML = '';
        const players = results.filter(r => r.ObjectType === 'Player');
        if (players.length === 0) {
            searchResultsContainer.innerHTML = '<div class="p-2 text-gray-500">No players found.</div>';
            return;
        }
        players.forEach(player => {
            const resultItem = document.createElement('div');
            resultItem.className = 'flex items-center gap-2 p-2 hover:bg-gray-100 cursor-pointer border-b border-gray-200';
            const imageUrl = player.LogoImageUrl || 'https://ussq-img-live.s3.us-east-1.amazonaws.com/uploads%2Fussq-profile-icon-default.png';
            resultItem.innerHTML = `<img src="${imageUrl}" alt="${player.ObjectName}" class="w-8 h-8 rounded-full object-cover"><div><p class="text-sm font-medium">${player.ObjectName}</p></div>`;
            resultItem.addEventListener('click', () => {
                performPlayerLookup(player); // Trigger the main lookup workflow
                searchInput.value = '';
                searchResultsContainer.classList.add('hidden');
            });
            searchResultsContainer.appendChild(resultItem);
        });
    }

    // --- Event Listeners ---
    if (searchInput) {
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
    }

    document.addEventListener('click', (event) => {
        if (!searchInput.contains(event.target) && !searchResultsContainer.contains(event.target)) {
            searchResultsContainer.classList.add('hidden');
        }
    });
    
    // --- Initial Load ---
    lucide.createIcons();
});