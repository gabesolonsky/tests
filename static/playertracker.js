document.addEventListener('DOMContentLoaded', () => {
    const DEFAULT_PROFILE_PIC = 'https://ussq-img-live.s3.us-east-1.amazonaws.com/uploads%2Fussq-profile-icon-default.png';
    const TRACKER_CONTEXT_USER_ID = 170053; // Preserves the existing tracker-list workflow.
    const MATCHES_PER_PAGE = 5;

    const loadingOverlay = document.getElementById('loading-overlay');
    const app = document.getElementById('app');
    const lookupResultContainer = document.getElementById('lookup-result-container');
    const h2hResultContainer = document.getElementById('h2h-result-container');
    const comparePlayersBtn = document.getElementById('compare-players-btn');

    const state = {
        mode: 'player',
        playerA: null,
        playerB: null,
        activeLookupToken: 0,
        activeCompareToken: 0
    };

    if (loadingOverlay) {
        loadingOverlay.style.opacity = '0';
        setTimeout(() => { loadingOverlay.style.display = 'none'; }, 300);
    }
    if (app) app.style.display = 'flex';

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const normalizeName = (name) => String(name || '').replace(/\s+/g, ' ').trim();
    const num = (value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    };

    const formatRating = (value) => num(value) === null ? 'N/A' : num(value).toFixed(2);
    const formatPercent = (value) => Number.isFinite(value) ? `${Math.round(value * 100)}%` : 'N/A';
    const formatDate = (value, options = { month: 'short', day: 'numeric', year: 'numeric' }) => {
        if (!value) return 'N/A';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString(undefined, options);
    };

    function calculateAge(dateValue) {
        if (!dateValue) return null;
        const dob = new Date(dateValue);
        if (Number.isNaN(dob.getTime())) return null;
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
        return age >= 0 && age < 120 ? age : null;
    }

    async function safeFetchJson(url, options) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.warn(`Request failed: ${url}`, error);
            return null;
        }
    }

    function getUniversalRankingEntry(rankings) {
        if (!Array.isArray(rankings)) return null;
        return rankings.find(r =>
            Number(r.DivisionID) === 0 &&
            Number(r.Rating_GroupID) === 208 &&
            Number(r.Rating_OrgID) === 13895 &&
            Number(r.OrgType) === 8 &&
            String(r.DivisionName || '').toLowerCase() === 'all'
        ) || rankings.find(r => String(r.DivisionName || '').toLowerCase() === 'all') || null;
    }


    function firstNamesMatch(a, b) {
        const normalizeFirst = value => normalizeName(value).toLowerCase();
        return Boolean(normalizeFirst(a) && normalizeFirst(b) && normalizeFirst(a) === normalizeFirst(b));
    }

    function getExpectedFirstName(userData, fallbackName = '') {
        return normalizeName(
            userData?.firstName ||
            userData?.FirstName ||
            normalizeName(userData?.name || fallbackName).split(' ')[0]
        );
    }

    async function fetchVerifiedLeaderboardDetails(userId, userData, rankings, fallbackName = '') {
        const target = getUniversalRankingEntry(rankings);
        const rawRanking = num(target?.Ranking ?? target?.ranking);
        if (rawRanking === null) return null;

        const expectedRank = rawRanking + 1;
        const expectedFirstName = getExpectedFirstName(userData, fallbackName);
        const candidateRanks = [expectedRank, expectedRank - 1, expectedRank + 1, expectedRank - 2, expectedRank + 2]
            .filter(rank => Number.isInteger(rank) && rank > 0);
        const pageCache = new Map();

        async function rowsForRank(rank) {
            const pageNumber = Math.ceil(rank / 50);
            if (pageCache.has(pageNumber)) return pageCache.get(pageNumber);
            const board = await safeFetchJson(`/proxy/rankings/208/current?divisions=0&pageNumber=${pageNumber}`);
            const rows = Array.isArray(board) ? board : Array.isArray(board?.rankings) ? board.rankings : [];
            pageCache.set(pageNumber, rows);
            return rows;
        }

        for (const candidateRank of candidateRanks) {
            const rows = await rowsForRank(candidateRank);
            const entry = rows.find(row => String(row.ranking) === String(candidateRank));
            if (!entry) continue;
            if (!expectedFirstName && candidateRank === expectedRank) return entry;
            if (expectedFirstName && firstNamesMatch(entry.firstName, expectedFirstName)) return entry;
        }
        return null;
    }

    function extractCurrentRating(ratings, rankings) {
        if (Array.isArray(ratings)) {
            const singles = ratings.find(r => /singles/i.test(r.ratingTypeName || '')) || ratings[0];
            if (singles) {
                for (const candidate of [singles.rating, singles.Rating, singles.value, singles.ratingValue]) {
                    const parsed = num(candidate);
                    if (parsed !== null) return parsed;
                }
            }
        }
        const rankingEntry = getUniversalRankingEntry(rankings);
        return num(rankingEntry?.Rating ?? rankingEntry?.rating);
    }

    function extractCurrentRank(rankings) {
        const entry = getUniversalRankingEntry(rankings);
        const rawRank = num(entry?.Ranking ?? entry?.ranking);
        // The dashboard already accounts for the US Squash rankings endpoint being one spot off the leaderboard.
        return rawRank === null ? null : rawRank + 1;
    }

    function extractHighestRating(ratingsTop, rankings) {
        if (Array.isArray(ratingsTop) && ratingsTop.length) {
            const best = ratingsTop
                .map(r => ({ rating: num(r.rating ?? r.Rating), date: r.ratingPeriod ?? r.RankingPeriod ?? r.date }))
                .filter(r => r.rating !== null)
                .sort((a, b) => b.rating - a.rating)[0];
            if (best) return best;
        }

        if (Array.isArray(rankings)) {
            const best = rankings
                .map(r => ({ rating: num(r.Rating ?? r.rating), date: r.RankingPeriod ?? r.ratingPeriod }))
                .filter(r => r.rating !== null)
                .sort((a, b) => b.rating - a.rating)[0];
            if (best) return best;
        }
        return { rating: null, date: null };
    }

    function summarizeRecord(recordData) {
        const summary = {
            wins: 0,
            losses: 0,
            total: 0,
            winRate: null,
            byLength: {
                3: { wins: 0, losses: 0 },
                4: { wins: 0, losses: 0 },
                5: { wins: 0, losses: 0 }
            }
        };

        if (!Array.isArray(recordData)) return summary;
        recordData.filter(entry => entry.type === 'S').forEach(entry => {
            const wins = Number(entry.matchesWon) || 0;
            const losses = Number(entry.matchesLost) || 0;
            summary.wins += wins;
            summary.losses += losses;
            const length = Number(entry.matchesType);
            if (summary.byLength[length]) {
                summary.byLength[length].wins += wins;
                summary.byLength[length].losses += losses;
            }
        });
        summary.total = summary.wins + summary.losses;
        summary.winRate = summary.total ? summary.wins / summary.total : null;
        return summary;
    }

    function getMatchPerspective(match, userId) {
        if (!match) return null;
        const uid = Number(userId);
        const homeId = Number(match.wid1);
        const visitingId = Number(match.oid1);
        let side = null;
        if (homeId === uid) side = 'home';
        if (visitingId === uid) side = 'visiting';
        if (!side) return null;

        const didWin = match.Winner === 'H' ? side === 'home' : match.Winner === 'V' ? side === 'visiting' : null;
        const opponentId = side === 'home' ? visitingId : homeId;
        const opponentName = normalizeName(side === 'home' ? match.vplayer1 : match.hplayer1) || 'Opponent';
        const userRating = num(side === 'home' ? match.w1Rating : match.o1Rating);
        const opponentRating = num(side === 'home' ? match.o1Rating : match.w1Rating);

        return {
            match,
            side,
            didWin,
            opponentId: Number.isFinite(opponentId) ? opponentId : null,
            opponentName,
            userRating,
            opponentRating,
            date: match.MatchDate,
            event: match.Descr || match.DivisionDescr || 'Match',
            score: formatScoreForUser(match.Score, didWin),
            status: match.Status
        };
    }

    function formatScoreForUser(score, didWin) {
        if (!score || String(score).trim().toLowerCase() === 'unknown') return 'No score';
        const games = String(score).split(',').map(game => {
            const parts = game.trim().split('-');
            if (parts.length !== 2) return game.trim();
            return didWin === false ? `${parts[1]}-${parts[0]}` : `${parts[0]}-${parts[1]}`;
        });
        return games.join(', ');
    }

    async function fetchMatchPages(userId, maxPages = 2) {
        const matches = [];
        let exhausted = false;
        let pagesScanned = 0;

        for (let page = 1; page <= maxPages; page++) {
            const data = await safeFetchJson(`/proxy/user/${userId}/matches/page/${page}`);
            const pageMatches = Array.isArray(data?.matches) ? data.matches : [];
            pagesScanned++;
            if (!pageMatches.length) {
                exhausted = true;
                break;
            }
            matches.push(...pageMatches);
            if (pageMatches.length < MATCHES_PER_PAGE) {
                exhausted = true;
                break;
            }
        }

        return { matches, exhausted, pagesScanned };
    }

    function analyzeRecentMatches(matches, userId, limit = 10) {
        const perspectives = matches
            .filter(m => m && (m.Status === 'C' || m.Status === 'RE'))
            .map(m => getMatchPerspective(m, userId))
            .filter(p => p && p.didWin !== null)
            .slice(0, limit);

        const wins = perspectives.filter(p => p.didWin).length;
        const losses = perspectives.length - wins;
        const winRate = perspectives.length ? wins / perspectives.length : null;
        const avgOpponentRatingValues = perspectives.map(p => p.opponentRating).filter(v => v !== null);
        const averageOpponentRating = avgOpponentRatingValues.length
            ? avgOpponentRatingValues.reduce((sum, value) => sum + value, 0) / avgOpponentRatingValues.length
            : null;

        let streak = 'N/A';
        if (perspectives.length) {
            const firstResult = perspectives[0].didWin;
            let count = 0;
            for (const p of perspectives) {
                if (p.didWin !== firstResult) break;
                count++;
            }
            streak = `${firstResult ? 'W' : 'L'}${count}`;
        }

        return { perspectives, wins, losses, winRate, averageOpponentRating, streak };
    }

    function resolveProfile(playerInfo, userData, trackerData, leaderboardData) {
        const leaderboardName = normalizeName([leaderboardData?.firstName, leaderboardData?.lastName].filter(Boolean).join(' '));
        const directName = normalizeName(userData?.name || [userData?.firstName || userData?.FirstName, userData?.lastName || userData?.LastName].filter(Boolean).join(' '));
        const name = leaderboardName || directName || normalizeName(trackerData?.name) || normalizeName(playerInfo?.ObjectName) || `Player ${playerInfo?.ObjectId || ''}`;
        const birthDate = leaderboardData?.dob || userData?.BirthDate || userData?.birthDate || userData?.dob || null;
        const city = userData?.City || userData?.city || leaderboardData?.city || '';
        const stateName = userData?.State || userData?.state || leaderboardData?.state || '';
        const zip = userData?.Zip || userData?.zip || '';
        const composedLocation = city ? [city, stateName].filter(Boolean).join(', ') + (zip ? ` ${zip}` : '') : '';
        const leaderboardLocation = leaderboardData?.location || (leaderboardData?.city ? [leaderboardData.city, leaderboardData.state].filter(Boolean).join(', ') : '');

        return {
            id: Number(playerInfo?.ObjectId || userData?.id || trackerData?.id),
            name,
            firstName: normalizeName(leaderboardData?.firstName || userData?.firstName || userData?.FirstName || name.split(' ')[0]),
            profilePictureUrl: leaderboardData?.profilePictureUrl || userData?.profilePictureUrl || trackerData?.profilePictureUrl || playerInfo?.LogoImageUrl || DEFAULT_PROFILE_PIC,
            isMember: typeof userData?.isMember === 'boolean' ? userData.isMember : null,
            homeClub: leaderboardData?.homeClub || userData?.mainAffiliation?.descr || userData?.homeClub || userData?.HomeClub || 'N/A',
            location: leaderboardLocation || composedLocation || userData?.location || playerInfo?.ObjectLocation || 'N/A',
            birthDate,
            age: calculateAge(birthDate),
            gender: leaderboardData?.gender || userData?.Gender || userData?.gender || 'N/A'
        };
    }

    async function addPlayerToTracker(playerId) {
        try {
            const response = await fetch('/proxy/player_tracker/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId: Number(playerId) })
            });
            const data = await response.json();
            return Boolean(data?.success);
        } catch (error) {
            console.warn(`Unable to add player ${playerId} to tracker`, error);
            return false;
        }
    }

    async function removePlayerFromTracker(playerId) {
        try {
            await fetch(`/proxy/player_tracker/${playerId}`, { method: 'DELETE' });
        } catch (error) {
            console.warn(`Unable to clean up player ${playerId} from tracker`, error);
        }
    }

    async function fetchTrackerSnapshot(playerInfo) {
        const added = await addPlayerToTracker(playerInfo.ObjectId);
        try {
            const trackerList = await safeFetchJson(`/proxy/player_tracker/list?userId=${TRACKER_CONTEXT_USER_ID}`);
            return Array.isArray(trackerList?.trackedPlayers)
                ? trackerList.trackedPlayers.find(p => Number(p.id) === Number(playerInfo.ObjectId)) || null
                : null;
        } finally {
            // Only remove the temporary entry when this request successfully added it.
            if (added) await removePlayerFromTracker(playerInfo.ObjectId);
        }
    }

    async function fetchPlayerBundle(playerInfo, { includeTrackerSchedule = false } = {}) {
        const id = Number(playerInfo.ObjectId || playerInfo.id);
        const normalizedPlayerInfo = {
            ObjectId: id,
            ObjectName: playerInfo.ObjectName || playerInfo.name || '',
            ObjectLocation: playerInfo.ObjectLocation || playerInfo.location || '',
            LogoImageUrl: playerInfo.LogoImageUrl || playerInfo.profilePictureUrl || ''
        };

        const trackerPromise = includeTrackerSchedule ? fetchTrackerSnapshot(normalizedPlayerInfo) : Promise.resolve(null);
        const [userData, ratings, ratingsTop, recordData, rankings, matchPageData, trackerData] = await Promise.all([
            safeFetchJson(`/proxy/user/${id}`),
            safeFetchJson(`/proxy/user/${id}/ratings`),
            safeFetchJson(`/proxy/user/${id}/ratings-top`),
            safeFetchJson(`/proxy/user/${id}/record`),
            safeFetchJson(`/proxy/user/${id}/rankings-current`),
            fetchMatchPages(id, 2),
            trackerPromise
        ]);

        const leaderboardData = await fetchVerifiedLeaderboardDetails(id, userData, rankings, normalizedPlayerInfo.ObjectName);
        const profile = resolveProfile(normalizedPlayerInfo, userData, trackerData, leaderboardData);
        const currentRating = extractCurrentRating(ratings, rankings) ?? num(leaderboardData?.rating);
        const currentRank = num(leaderboardData?.ranking) ?? extractCurrentRank(rankings);
        const highestRating = extractHighestRating(ratingsTop, rankings);
        const record = summarizeRecord(recordData);
        const recent = analyzeRecentMatches(matchPageData.matches, id, 10);

        return {
            playerInfo: normalizedPlayerInfo,
            profile,
            currentRating,
            currentRank,
            highestRating,
            record,
            recent,
            trackerData,
            userData,
            rankings
        };
    }

    function resultBadge(result) {
        if (result === true) return '<span class="inline-flex px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">Win</span>';
        if (result === false) return '<span class="inline-flex px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">Loss</span>';
        return '<span class="inline-flex px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">N/A</span>';
    }

    function statCard(label, value, helper = '') {
        return `
            <div class="bg-gray-50 border border-gray-200 rounded-xl p-3 sm:p-4 min-w-0">
                <p class="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-gray-400 break-words">${escapeHtml(label)}</p>
                <p class="text-xl sm:text-2xl font-bold text-gray-900 mt-1 break-words">${escapeHtml(value)}</p>
                ${helper ? `<p class="text-[11px] sm:text-xs text-gray-500 mt-1 break-words">${escapeHtml(helper)}</p>` : ''}
            </div>`;
    }

    function profileRow(label, value) {
        return `<div class="flex items-start justify-between gap-3 py-2.5 border-b border-gray-100 last:border-b-0"><span class="text-xs sm:text-sm text-gray-500 min-w-0">${escapeHtml(label)}</span><span class="text-xs sm:text-sm font-medium text-gray-800 text-right max-w-[58%] break-words">${escapeHtml(value || 'N/A')}</span></div>`;
    }

    function renderRecentMatchRow(perspective) {
        const ratingText = perspective.opponentRating !== null ? ` · Opp. ${perspective.opponentRating.toFixed(2)}` : '';
        return `
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 py-3 border-b border-gray-100 last:border-b-0">
                <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                        ${resultBadge(perspective.didWin)}
                        <span class="text-sm font-semibold text-gray-800 truncate">vs. ${escapeHtml(perspective.opponentName)}</span>
                    </div>
                    <p class="text-xs text-gray-500 mt-1">${escapeHtml(formatDate(perspective.date))}${escapeHtml(ratingText)} · ${escapeHtml(perspective.event)}</p>
                </div>
                <span class="text-xs sm:text-sm font-mono text-gray-700 sm:text-right break-words">${escapeHtml(perspective.score)}</span>
            </div>`;
    }

    function createExpandedPlayerCardHTML(bundle) {
        const p = bundle.profile;
        const record = bundle.record;
        const recent = bundle.recent;
        const tracker = bundle.trackerData || {};
        const highestDate = bundle.highestRating?.date ? `on ${formatDate(bundle.highestRating.date)}` : 'career high';
        const recentForm = recent.perspectives.length ? recent.perspectives.map(m => m.didWin ? 'W' : 'L').join(' ') : 'N/A';
        const memberText = p.isMember === null ? 'Status unavailable' : p.isMember ? 'US Squash Member' : 'Non-member';
        const birthdayText = p.birthDate ? `${formatDate(p.birthDate, { month: 'long', day: 'numeric', year: 'numeric' })}${p.age !== null ? ` (${p.age})` : ''}` : 'N/A';

        const lastTrackerDate = tracker.matchDate ? formatDate(tracker.matchDate) : 'N/A';
        const nextMatchDate = tracker.nextMatchWonDate ? formatDate(tracker.nextMatchWonDate) : 'TBD';
        const recentRows = recent.perspectives.length
            ? recent.perspectives.map(renderRecentMatchRow).join('')
            : '<p class="text-sm text-gray-500 py-4">No recent completed matches were returned.</p>';

        return `
            <div class="space-y-5">
                <div class="bg-white/70 backdrop-blur-md border border-gray-200 rounded-2xl p-4 sm:p-5 md:p-6 shadow-xl">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-5">
                        <div class="flex items-center gap-4 min-w-0">
                            <img src="${escapeHtml(p.profilePictureUrl || DEFAULT_PROFILE_PIC)}" alt="${escapeHtml(p.name)}" class="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shadow-md border border-gray-200 bg-white shrink-0" onerror="this.src='${DEFAULT_PROFILE_PIC}'">
                            <div class="min-w-0">
                                <h2 class="text-xl sm:text-2xl font-bold text-gray-900 break-words">${escapeHtml(p.name)}</h2>
                                <div class="flex flex-wrap gap-2 mt-2">
                                    <span class="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-full">ID ${escapeHtml(p.id)}</span>
                                    <span class="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded-full">${escapeHtml(memberText)}</span>
                                    ${p.homeClub !== 'N/A' ? `<span class="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded-full">${escapeHtml(p.homeClub)}</span>` : ''}
                                </div>
                                <p class="text-sm text-gray-500 mt-2">${escapeHtml(p.location)}</p>
                            </div>
                        </div>
                        <div class="flex sm:block items-end justify-between sm:text-right shrink-0 border-t sm:border-t-0 border-gray-100 pt-3 sm:pt-0">
                            <p class="text-xs uppercase tracking-wide font-semibold text-gray-400">Current Rating</p>
                            <p class="text-3xl sm:text-4xl font-extrabold text-indigo-600">${formatRating(bundle.currentRating)}</p>
                            <p class="text-sm text-gray-500 mt-1">${bundle.currentRank ? `Rank #${bundle.currentRank}` : 'Rank unavailable'}</p>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-3">
                    ${statCard('Current Rating', formatRating(bundle.currentRating), bundle.currentRank ? `Rank #${bundle.currentRank}` : '')}
                    ${statCard('Highest Rating', formatRating(bundle.highestRating?.rating), highestDate)}
                    ${statCard('Singles Record', `${record.wins}-${record.losses}`, `${record.total} matches`)}
                    ${statCard('Win Rate', formatPercent(record.winRate), 'career singles')}
                    ${statCard('Recent Form', recentForm, `${recent.wins}-${recent.losses} last ${recent.perspectives.length}`)}
                    ${statCard('Recent Opp. Avg', formatRating(recent.averageOpponentRating), recent.streak !== 'N/A' ? `Streak ${recent.streak}` : '')}
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div class="bg-white/70 backdrop-blur-md border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-xl">
                        <div class="flex items-center gap-2 mb-3"><i data-lucide="badge-info" class="w-5 h-5 text-indigo-500"></i><h3 class="font-semibold text-gray-800">Player Details</h3></div>
                        ${profileRow('Home Club', p.homeClub)}
                        ${profileRow('Location', p.location)}
                        ${profileRow('Gender', p.gender)}
                        ${profileRow('Birthday / Age', birthdayText)}
                        ${profileRow('Membership', memberText)}
                        ${profileRow('US Squash ID', p.id)}
                    </div>

                    <div class="bg-white/70 backdrop-blur-md border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-xl">
                        <div class="flex items-center gap-2 mb-3"><i data-lucide="chart-no-axes-column-increasing" class="w-5 h-5 text-indigo-500"></i><h3 class="font-semibold text-gray-800">Singles Match Breakdown</h3></div>
                        ${profileRow('3-game matches', `${record.byLength[3].wins}W - ${record.byLength[3].losses}L`)}
                        ${profileRow('4-game matches', `${record.byLength[4].wins}W - ${record.byLength[4].losses}L`)}
                        ${profileRow('5-game matches', `${record.byLength[5].wins}W - ${record.byLength[5].losses}L`)}
                        ${profileRow('Overall singles', `${record.wins}W - ${record.losses}L`)}
                        ${profileRow('Career win rate', formatPercent(record.winRate))}
                        ${profileRow('Last-10 win rate', formatPercent(recent.winRate))}
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div class="bg-white/70 backdrop-blur-md border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-xl">
                        <div class="flex items-center gap-2 mb-4"><i data-lucide="history" class="w-5 h-5 text-indigo-500"></i><h3 class="font-semibold text-gray-800">Latest Match</h3></div>
                        ${tracker.matchOpponent ? `
                            <div class="rounded-xl bg-gray-50 border border-gray-200 p-4">
                                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                                    <div>
                                        <p class="text-sm text-gray-500">${escapeHtml(lastTrackerDate)} · ${escapeHtml(tracker.matchEvent || 'Match')}</p>
                                        <p class="font-semibold text-gray-900 mt-1">vs. ${escapeHtml(tracker.matchOpponent)}</p>
                                    </div>
                                    ${resultBadge(tracker.matchStatus === 'win' ? true : tracker.matchStatus === 'loss' ? false : null)}
                                </div>
                                <p class="text-sm font-mono text-gray-700 mt-3">${escapeHtml(tracker.matchScore || 'No score')}</p>
                            </div>` : (recent.perspectives[0] ? renderRecentMatchRow(recent.perspectives[0]) : '<p class="text-sm text-gray-500">Latest match unavailable.</p>')}
                    </div>

                    <div class="bg-white/70 backdrop-blur-md border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-xl">
                        <div class="flex items-center gap-2 mb-4"><i data-lucide="calendar-clock" class="w-5 h-5 text-indigo-500"></i><h3 class="font-semibold text-gray-800">Upcoming Match</h3></div>
                        ${tracker.nextMatchWonOpponent ? `
                            <div class="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
                                <p class="text-sm text-indigo-600">${escapeHtml(nextMatchDate)} · ${escapeHtml(tracker.nextMatchWonEvent || 'Scheduled match')}</p>
                                <p class="font-semibold text-indigo-950 mt-1">vs. ${escapeHtml(tracker.nextMatchWonOpponent)}</p>
                                <p class="text-sm text-indigo-700 mt-2">${escapeHtml(tracker.nextMatchWonTime || 'Time TBD')}${tracker.nextMatchWonCourt ? ` · Court ${escapeHtml(tracker.nextMatchWonCourt)}` : ''}</p>
                            </div>` : '<div class="rounded-xl bg-gray-50 border border-gray-200 p-4 text-sm text-gray-500">No upcoming match was returned by the tracker.</div>'}
                    </div>
                </div>

                <div class="bg-white/70 backdrop-blur-md border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-xl">
                    <div class="flex items-center justify-between gap-3 mb-2">
                        <div class="flex items-center gap-2"><i data-lucide="list-ordered" class="w-5 h-5 text-indigo-500"></i><h3 class="font-semibold text-gray-800">Recent Matches</h3></div>
                        <span class="text-xs text-gray-400">Most recent ${recent.perspectives.length}</span>
                    </div>
                    ${recentRows}
                </div>
            </div>`;
    }

    async function performPlayerLookup(playerInfo) {
        if (!lookupResultContainer) return;
        const token = ++state.activeLookupToken;
        lookupResultContainer.innerHTML = loadingCard(`Building profile for ${escapeHtml(playerInfo.ObjectName)}...`, 'Loading ratings, record, profile details, and recent matches.');

        try {
            const bundle = await fetchPlayerBundle(playerInfo, { includeTrackerSchedule: true });
            if (token !== state.activeLookupToken) return;
            lookupResultContainer.innerHTML = createExpandedPlayerCardHTML(bundle);
            if (window.lucide) lucide.createIcons();
        } catch (error) {
            console.error('Player lookup failed:', error);
            if (token !== state.activeLookupToken) return;
            lookupResultContainer.innerHTML = errorCard('Could not load this player', error.message || 'Unknown error');
        }
    }

    function loadingCard(title, subtitle) {
        return `
            <div class="bg-white/70 backdrop-blur-md border border-gray-200 rounded-2xl p-8 shadow-xl text-center">
                <svg class="animate-spin h-8 w-8 text-indigo-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                <p class="font-semibold text-gray-700">${title}</p>
                <p class="text-sm text-gray-500 mt-1">${subtitle}</p>
            </div>`;
    }

    function errorCard(title, message) {
        return `<div class="bg-white/70 backdrop-blur-md border border-red-200 rounded-2xl p-8 shadow-xl text-center"><i data-lucide="circle-alert" class="w-10 h-10 mx-auto text-red-500 mb-3"></i><p class="font-semibold text-red-700">${escapeHtml(title)}</p><p class="text-sm text-red-500 mt-1">${escapeHtml(message)}</p></div>`;
    }

    async function searchPlayers(query) {
        const formattedQuery = encodeURIComponent(query.trim()).replace(/%20/g, '+');
        const data = await safeFetchJson(`/proxy/resources/res/search/${formattedQuery}`);
        return Array.isArray(data) ? data.filter(r => r.ObjectType === 'Player') : [];
    }

    function createSearchResultHTML(player) {
        const imageUrl = player.LogoImageUrl || DEFAULT_PROFILE_PIC;
        const locationText = player.ObjectLocation ? `(${player.ObjectLocation})` : '';
        return `
            <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(player.ObjectName)}" class="w-8 h-8 rounded-full object-cover" onerror="this.src='${DEFAULT_PROFILE_PIC}'">
            <div class="min-w-0">
                <p class="text-sm font-medium text-gray-800 truncate">${escapeHtml(player.ObjectName)}</p>
                <p class="text-xs text-gray-500 truncate">${escapeHtml(locationText)}</p>
            </div>`;
    }

    function setupPlayerSearch(inputId, resultsId, onSelect) {
        const input = document.getElementById(inputId);
        const results = document.getElementById(resultsId);
        if (!input || !results) return;
        let timeout = null;
        let searchSequence = 0;

        input.addEventListener('input', () => {
            clearTimeout(timeout);
            const query = input.value.trim();
            if (query.length < 3) {
                results.innerHTML = '';
                results.classList.add('hidden');
                return;
            }

            timeout = setTimeout(async () => {
                const seq = ++searchSequence;
                results.innerHTML = '<div class="p-2 text-gray-500">Searching...</div>';
                results.classList.remove('hidden');
                const players = await searchPlayers(query);
                if (seq !== searchSequence) return;

                results.innerHTML = '';
                if (!players.length) {
                    results.innerHTML = '<div class="p-2 text-gray-500">No results found.</div>';
                    return;
                }

                players.forEach(player => {
                    const row = document.createElement('button');
                    row.type = 'button';
                    row.className = 'w-full flex items-center gap-2 p-2 hover:bg-gray-100 text-left border-b border-gray-200 last:border-b-0';
                    row.innerHTML = createSearchResultHTML(player);
                    row.addEventListener('click', () => {
                        onSelect(player);
                        input.value = '';
                        results.classList.add('hidden');
                    });
                    results.appendChild(row);
                });
            }, 250);
        });

        document.addEventListener('click', event => {
            if (!input.contains(event.target) && !results.contains(event.target)) results.classList.add('hidden');
        });
    }

    function renderSelectedPlayer(slot, player) {
        const container = document.getElementById(slot === 'A' ? 'h2h-player-a-selected' : 'h2h-player-b-selected');
        if (!container) return;
        if (!player) {
            container.innerHTML = '';
            return;
        }
        container.innerHTML = `
            <div class="flex items-center gap-2.5 sm:gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-2.5 sm:p-3">
                <img src="${escapeHtml(player.LogoImageUrl || DEFAULT_PROFILE_PIC)}" alt="${escapeHtml(player.ObjectName)}" class="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover bg-white shrink-0" onerror="this.src='${DEFAULT_PROFILE_PIC}'">
                <div class="min-w-0 flex-1">
                    <p class="text-sm font-semibold text-indigo-950 truncate">${escapeHtml(player.ObjectName)}</p>
                    <p class="text-xs text-indigo-600 truncate">${escapeHtml(player.ObjectLocation || `ID ${player.ObjectId}`)}</p>
                </div>
                <button type="button" class="remove-h2h-player p-1.5 rounded-lg text-indigo-500 hover:bg-indigo-100" aria-label="Remove selected player" data-slot="${slot}"><i data-lucide="x" class="w-4 h-4"></i></button>
            </div>`;
        container.querySelector('.remove-h2h-player')?.addEventListener('click', () => {
            if (slot === 'A') state.playerA = null; else state.playerB = null;
            renderSelectedPlayer(slot, null);
            updateCompareButton();
        });
        if (window.lucide) lucide.createIcons();
    }

    function updateCompareButton() {
        if (!comparePlayersBtn) return;
        const valid = state.playerA && state.playerB && Number(state.playerA.ObjectId) !== Number(state.playerB.ObjectId);
        comparePlayersBtn.disabled = !valid;
    }

    async function findHeadToHeadMatches(playerAId, playerBId, maxPages = 20) {
        const { matches, exhausted, pagesScanned } = await fetchMatchPages(playerAId, maxPages);
        const direct = [];
        let completedScanned = 0;

        for (const match of matches) {
            if (!match || (match.Status !== 'C' && match.Status !== 'RE')) continue;
            const aPerspective = getMatchPerspective(match, playerAId);
            if (!aPerspective) continue;
            completedScanned++;
            if (Number(aPerspective.opponentId) === Number(playerBId)) direct.push(aPerspective);
        }

        return {
            matches: direct,
            playerAWins: direct.filter(m => m.didWin).length,
            playerBWins: direct.filter(m => m.didWin === false).length,
            completedScanned,
            pagesScanned,
            exhausted,
            truncated: !exhausted && pagesScanned >= maxPages
        };
    }

    function recentFormShare(a, b) {
        if (a === null || b === null) return null;
        if (a + b === 0) return 0.5;
        return a / (a + b);
    }

    function buildPrediction(bundleA, bundleB, h2h) {
        const signals = [];
        const reasons = [];
        const ratingA = bundleA.currentRating;
        const ratingB = bundleB.currentRating;

        if (ratingA !== null && ratingB !== null) {
            // Squash ratings live on a compact scale, so a 0.50 rating gap is a meaningful edge.
            const ratingProbabilityA = 1 / (1 + Math.exp(-(ratingA - ratingB) / 0.50));
            signals.push({ key: 'rating', label: 'Current rating', probabilityA: ratingProbabilityA, weight: 0.70 });
            const leader = ratingA === ratingB ? 'Ratings are even' : `${ratingA > ratingB ? bundleA.profile.firstName : bundleB.profile.firstName} leads rating by ${Math.abs(ratingA - ratingB).toFixed(2)}`;
            reasons.push(leader);
        }

        if (bundleA.recent.perspectives.length >= 3 && bundleB.recent.perspectives.length >= 3) {
            const share = recentFormShare(bundleA.recent.winRate, bundleB.recent.winRate);
            signals.push({ key: 'recent', label: 'Recent form', probabilityA: share, weight: 0.15 });
            reasons.push(`Recent form: ${bundleA.recent.wins}-${bundleA.recent.losses} vs ${bundleB.recent.wins}-${bundleB.recent.losses}`);
        }

        if (bundleA.record.total > 0 && bundleB.record.total > 0) {
            const share = recentFormShare(bundleA.record.winRate, bundleB.record.winRate);
            signals.push({ key: 'overall', label: 'Overall singles record', probabilityA: share, weight: 0.05 });
        }

        if (h2h.matches.length > 0) {
            signals.push({ key: 'h2h', label: 'Direct head-to-head', probabilityA: h2h.playerAWins / h2h.matches.length, weight: 0.10 });
            reasons.push(`Direct H2H found: ${h2h.playerAWins}-${h2h.playerBWins}`);
        }

        if (!signals.length) {
            return {
                playerAProbability: 0.5,
                playerBProbability: 0.5,
                winner: null,
                projectedScore: 'Too little data',
                edge: 'No reliable edge',
                confidence: 15,
                signals: [],
                reasons: ['Not enough comparable rating or match data was returned.']
            };
        }

        const weightTotal = signals.reduce((sum, s) => sum + s.weight, 0);
        let pA = signals.reduce((sum, s) => sum + s.probabilityA * s.weight, 0) / weightTotal;
        pA = Math.max(0.08, Math.min(0.92, pA));
        const pB = 1 - pA;
        const winner = pA >= 0.5 ? bundleA : bundleB;
        const winnerP = Math.max(pA, pB);
        const edge = winnerP >= 0.78 ? 'Strong edge' : winnerP >= 0.64 ? 'Moderate edge' : winnerP >= 0.55 ? 'Slight edge' : 'Very close';
        const projectedScore = winnerP >= 0.78 ? '3-0' : winnerP >= 0.64 ? '3-1' : '3-2';

        let confidence = 25;
        if (signals.some(s => s.key === 'rating')) confidence += 35;
        if (signals.some(s => s.key === 'recent')) confidence += 20;
        if (signals.some(s => s.key === 'overall')) confidence += 5;
        if (signals.some(s => s.key === 'h2h')) confidence += Math.min(15, h2h.matches.length * 3);
        confidence = Math.min(95, confidence);

        return { playerAProbability: pA, playerBProbability: pB, winner, projectedScore, edge, confidence, signals, reasons };
    }

    function findCommonOpponentInsight(bundleA, bundleB) {
        const aByOpponent = new Map();
        const bByOpponent = new Map();

        bundleA.recent.perspectives.forEach(p => {
            if (!p.opponentId) return;
            if (!aByOpponent.has(p.opponentId)) aByOpponent.set(p.opponentId, { name: p.opponentName, wins: 0, losses: 0 });
            const row = aByOpponent.get(p.opponentId);
            p.didWin ? row.wins++ : row.losses++;
        });
        bundleB.recent.perspectives.forEach(p => {
            if (!p.opponentId) return;
            if (!bByOpponent.has(p.opponentId)) bByOpponent.set(p.opponentId, { name: p.opponentName, wins: 0, losses: 0 });
            const row = bByOpponent.get(p.opponentId);
            p.didWin ? row.wins++ : row.losses++;
        });

        const common = [];
        for (const [id, a] of aByOpponent) {
            if (bByOpponent.has(id)) common.push({ id, a, b: bByOpponent.get(id) });
        }
        return common;
    }

    function comparisonValueRow(label, aValue, bValue, highlight = null) {
        const aClass = highlight === 'a' ? 'font-bold text-indigo-700' : 'font-semibold text-gray-800';
        const bClass = highlight === 'b' ? 'font-bold text-indigo-700' : 'font-semibold text-gray-800';
        return `
            <div class="py-3 border-b border-gray-100 last:border-b-0">
                <div class="text-[11px] sm:hidden text-gray-400 font-semibold text-center mb-1.5">${escapeHtml(label)}</div>
                <div class="grid grid-cols-2 sm:grid-cols-[1fr_auto_1fr] gap-2 sm:gap-3 items-center">
                    <div class="text-left sm:text-right text-sm sm:text-base break-words ${aClass}">${escapeHtml(aValue)}</div>
                    <div class="hidden sm:block text-xs text-gray-400 font-semibold text-center min-w-[100px]">${escapeHtml(label)}</div>
                    <div class="text-right sm:text-left text-sm sm:text-base break-words ${bClass}">${escapeHtml(bValue)}</div>
                </div>
            </div>`;
    }

    function renderH2HMeeting(match, playerAName, playerBName) {
        const winnerName = match.didWin ? playerAName : playerBName;
        return `
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 border-b border-gray-100 last:border-b-0">
                <div>
                    <p class="text-sm font-semibold text-gray-800">${escapeHtml(winnerName)} won</p>
                    <p class="text-xs text-gray-500 mt-0.5">${escapeHtml(formatDate(match.date))} · ${escapeHtml(match.event)}</p>
                </div>
                <span class="text-sm font-mono text-gray-700">${escapeHtml(match.score)}</span>
            </div>`;
    }

    function renderHeadToHead(bundleA, bundleB, h2h, prediction) {
        const a = bundleA.profile;
        const b = bundleB.profile;
        const common = findCommonOpponentInsight(bundleA, bundleB);
        const pA = Math.round(prediction.playerAProbability * 100);
        const pB = 100 - pA;
        const predictedWinnerName = prediction.winner?.profile?.name || 'Too close to call';
        const favoredSide = pA > pB ? 'left' : pB > pA ? 'right' : 'tie';
        const favoredProbability = Math.max(pA, pB);
        const probabilityBarStyle = favoredSide === 'right'
            ? `width:${favoredProbability}%; right:0;`
            : favoredSide === 'left'
                ? `width:${favoredProbability}%; left:0;`
                : 'width:50%; left:25%;';
        const h2hCoverage = h2h.truncated
            ? `Searched ${h2h.completedScanned} completed matches from ${a.name}'s most recent ${h2h.pagesScanned * MATCHES_PER_PAGE} results.`
            : `Searched the returned match history (${h2h.completedScanned} completed matches scanned).`;

        const ratingHighlight = bundleA.currentRating !== null && bundleB.currentRating !== null
            ? bundleA.currentRating > bundleB.currentRating ? 'a' : bundleB.currentRating > bundleA.currentRating ? 'b' : null
            : null;
        const winRateHighlight = bundleA.record.winRate !== null && bundleB.record.winRate !== null
            ? bundleA.record.winRate > bundleB.record.winRate ? 'a' : bundleB.record.winRate > bundleA.record.winRate ? 'b' : null
            : null;
        const recentHighlight = bundleA.recent.winRate !== null && bundleB.recent.winRate !== null
            ? bundleA.recent.winRate > bundleB.recent.winRate ? 'a' : bundleB.recent.winRate > bundleA.recent.winRate ? 'b' : null
            : null;

        return `
            <div class="space-y-5">
                <div class="bg-white/70 backdrop-blur-md border border-gray-200 rounded-2xl p-5 md:p-6 shadow-xl">
                    <div class="grid grid-cols-[1fr_auto_1fr] gap-2 sm:gap-3 md:gap-8 items-center">
                        <div class="text-center">
                            <img src="${escapeHtml(a.profilePictureUrl)}" alt="${escapeHtml(a.name)}" class="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full object-cover mx-auto shadow border border-gray-200" onerror="this.src='${DEFAULT_PROFILE_PIC}'">
                            <h2 class="font-bold text-gray-900 mt-2 text-xs sm:text-sm md:text-lg leading-tight break-words">${escapeHtml(a.name)}</h2>
                            <p class="text-[10px] sm:text-xs text-gray-500 mt-1">Rating ${formatRating(bundleA.currentRating)}${bundleA.currentRank ? ` · #${bundleA.currentRank}` : ''}</p>
                        </div>
                        <div class="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full text-xs sm:text-base bg-gray-100 border border-gray-200 flex items-center justify-center font-bold text-gray-500">VS</div>
                        <div class="text-center">
                            <img src="${escapeHtml(b.profilePictureUrl)}" alt="${escapeHtml(b.name)}" class="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full object-cover mx-auto shadow border border-gray-200" onerror="this.src='${DEFAULT_PROFILE_PIC}'">
                            <h2 class="font-bold text-gray-900 mt-2 text-xs sm:text-sm md:text-lg leading-tight break-words">${escapeHtml(b.name)}</h2>
                            <p class="text-[10px] sm:text-xs text-gray-500 mt-1">Rating ${formatRating(bundleB.currentRating)}${bundleB.currentRank ? ` · #${bundleB.currentRank}` : ''}</p>
                        </div>
                    </div>
                </div>

                <div class="bg-white/70 backdrop-blur-md border border-indigo-200 rounded-2xl p-5 md:p-6 shadow-xl">
                    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-5">
                        <div>
                            <div class="flex items-center gap-2"><i data-lucide="sparkles" class="w-5 h-5 text-indigo-500"></i><p class="text-sm font-semibold text-indigo-700">Experimental Match Projection</p></div>
                            <h3 class="text-xl sm:text-2xl font-bold text-gray-900 mt-2 break-words">${escapeHtml(predictedWinnerName)}</h3>
                            <p class="text-sm text-gray-500 mt-1">${escapeHtml(prediction.edge)} · projected match score ${escapeHtml(prediction.projectedScore)}</p>
                        </div>
                        <div class="sm:text-right flex sm:block items-end justify-between gap-4 border-t sm:border-t-0 border-indigo-100 pt-3 sm:pt-0">
                            <p class="text-xs uppercase tracking-wide font-semibold text-gray-400">Data confidence</p>
                            <p class="text-2xl sm:text-3xl font-bold text-indigo-600">${prediction.confidence}%</p>
                            <p class="text-xs text-gray-400">not a guaranteed outcome</p>
                        </div>
                    </div>

                    <div class="mt-5">
                        <div class="grid grid-cols-2 gap-3 text-xs sm:text-sm font-semibold mb-2"><span class="truncate">${escapeHtml(a.firstName || a.name)} ${pA}%</span><span class="truncate text-right">${pB}% ${escapeHtml(b.firstName || b.name)}</span></div>
                        <div class="h-3 rounded-full overflow-hidden h2h-probability-track border border-gray-200 relative">
                            <div class="absolute top-0 bottom-0 bg-indigo-500 transition-all duration-500" style="${probabilityBarStyle}"></div>
                            <div class="absolute top-0 bottom-0 left-1/2 w-px bg-white/90"></div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 mt-4 sm:mt-5">
                        ${prediction.signals.map(signal => `
                            <div class="rounded-xl border border-gray-200 bg-gray-50 p-2.5 sm:p-3 min-w-0">
                                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3"><span class="text-sm font-semibold text-gray-700">${escapeHtml(signal.label)}</span><span class="text-xs text-gray-400">${Math.round(signal.weight * 100)}% base weight</span></div>
                                <p class="text-xs text-gray-500 mt-1">Signal lean: ${Math.round(signal.probabilityA * 100)}% ${escapeHtml(a.firstName || 'Player 1')} / ${100 - Math.round(signal.probabilityA * 100)}% ${escapeHtml(b.firstName || 'Player 2')}</p>
                            </div>`).join('')}
                    </div>
                    <p class="text-xs text-gray-400 mt-4">Weights are re-normalized when a data source is unavailable. Rating is the primary signal, followed by recent form, direct H2H, and overall singles record.</p>
                </div>

                <div class="bg-white/70 backdrop-blur-md border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-xl">
                    <h3 class="font-semibold text-gray-800 mb-2">Side-by-Side Comparison</h3>
                    ${comparisonValueRow('Current rating', formatRating(bundleA.currentRating), formatRating(bundleB.currentRating), ratingHighlight)}
                    ${comparisonValueRow('Current rank', bundleA.currentRank ? `#${bundleA.currentRank}` : 'N/A', bundleB.currentRank ? `#${bundleB.currentRank}` : 'N/A')}
                    ${comparisonValueRow('Highest rating', formatRating(bundleA.highestRating?.rating), formatRating(bundleB.highestRating?.rating))}
                    ${comparisonValueRow('Singles record', `${bundleA.record.wins}-${bundleA.record.losses}`, `${bundleB.record.wins}-${bundleB.record.losses}`)}
                    ${comparisonValueRow('Career win rate', formatPercent(bundleA.record.winRate), formatPercent(bundleB.record.winRate), winRateHighlight)}
                    ${comparisonValueRow('Last-10 record', `${bundleA.recent.wins}-${bundleA.recent.losses}`, `${bundleB.recent.wins}-${bundleB.recent.losses}`, recentHighlight)}
                    ${comparisonValueRow('Recent streak', bundleA.recent.streak, bundleB.recent.streak)}
                    ${comparisonValueRow('Recent opp. avg', formatRating(bundleA.recent.averageOpponentRating), formatRating(bundleB.recent.averageOpponentRating))}
                    ${comparisonValueRow('Direct H2H wins', h2h.playerAWins, h2h.playerBWins, h2h.playerAWins > h2h.playerBWins ? 'a' : h2h.playerBWins > h2h.playerAWins ? 'b' : null)}
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div class="bg-white/70 backdrop-blur-md border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-xl">
                        <div class="flex items-center gap-2 mb-3"><i data-lucide="swords" class="w-5 h-5 text-indigo-500"></i><h3 class="font-semibold text-gray-800">Direct Meetings</h3></div>
                        ${h2h.matches.length ? h2h.matches.slice(0, 8).map(m => renderH2HMeeting(m, a.name, b.name)).join('') : '<p class="text-sm text-gray-500 py-3">No direct meeting was found in the match history searched.</p>'}
                        <p class="text-xs text-gray-400 mt-3">${escapeHtml(h2hCoverage)}</p>
                    </div>

                    <div class="bg-white/70 backdrop-blur-md border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-xl">
                        <div class="flex items-center gap-2 mb-3"><i data-lucide="users-round" class="w-5 h-5 text-indigo-500"></i><h3 class="font-semibold text-gray-800">Common Recent Opponents</h3></div>
                        ${common.length ? common.slice(0, 8).map(item => `
                            <div class="py-3 border-b border-gray-100 last:border-b-0">
                                <p class="text-sm font-semibold text-gray-800">${escapeHtml(item.a.name)}</p>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-3 mt-1 text-xs text-gray-500">
                                    <span>${escapeHtml(a.firstName || 'Player 1')}: ${item.a.wins}-${item.a.losses}</span>
                                    <span>${escapeHtml(b.firstName || 'Player 2')}: ${item.b.wins}-${item.b.losses}</span>
                                </div>
                            </div>`).join('') : '<p class="text-sm text-gray-500 py-3">No common opponents were found in each player\'s most recent matches.</p>'}
                        <p class="text-xs text-gray-400 mt-3">Common-opponent records are context only and are not currently given a separate prediction weight.</p>
                    </div>
                </div>

                <div class="bg-indigo-50 border border-indigo-100 rounded-2xl p-3 sm:p-4 text-xs sm:text-sm text-indigo-900 leading-relaxed">
                    <strong>How to read this:</strong> this is a lightweight statistical projection built from the data available through your existing US Squash endpoints. It does not account for injuries, court conditions, match format changes, or other real-world factors that are not in the data.
                </div>
            </div>`;
    }

    async function runHeadToHead() {
        if (!state.playerA || !state.playerB || !h2hResultContainer) return;
        if (Number(state.playerA.ObjectId) === Number(state.playerB.ObjectId)) {
            h2hResultContainer.innerHTML = errorCard('Choose two different players', 'Player 1 and Player 2 cannot be the same person.');
            return;
        }

        const token = ++state.activeCompareToken;
        comparePlayersBtn.disabled = true;
        h2hResultContainer.innerHTML = loadingCard('Comparing players...', 'Loading rating, ranking, records, recent form, and direct match history.');

        try {
            const [bundleA, bundleB, h2h] = await Promise.all([
                fetchPlayerBundle(state.playerA),
                fetchPlayerBundle(state.playerB),
                findHeadToHeadMatches(state.playerA.ObjectId, state.playerB.ObjectId, 20)
            ]);
            if (token !== state.activeCompareToken) return;
            const prediction = buildPrediction(bundleA, bundleB, h2h);
            h2hResultContainer.innerHTML = renderHeadToHead(bundleA, bundleB, h2h, prediction);
            if (window.lucide) lucide.createIcons();
        } catch (error) {
            console.error('Head-to-head comparison failed:', error);
            if (token !== state.activeCompareToken) return;
            h2hResultContainer.innerHTML = errorCard('Comparison failed', error.message || 'Could not load enough player data.');
        } finally {
            updateCompareButton();
        }
    }

    function setMode(mode) {
        state.mode = mode;
        const playerSection = document.getElementById('player-lookup-mode');
        const h2hSection = document.getElementById('h2h-mode');
        const playerBtn = document.getElementById('mode-player-btn');
        const h2hBtn = document.getElementById('mode-h2h-btn');

        const activeClasses = ['bg-indigo-600', 'text-white', 'shadow-sm'];
        const inactiveClasses = ['text-gray-600', 'hover:bg-gray-50'];

        if (mode === 'player') {
            playerSection?.classList.remove('hidden');
            h2hSection?.classList.add('hidden');
            playerBtn?.classList.add(...activeClasses);
            playerBtn?.classList.remove(...inactiveClasses);
            h2hBtn?.classList.remove(...activeClasses);
            h2hBtn?.classList.add(...inactiveClasses);
        } else {
            playerSection?.classList.add('hidden');
            h2hSection?.classList.remove('hidden');
            h2hBtn?.classList.add(...activeClasses);
            h2hBtn?.classList.remove(...inactiveClasses);
            playerBtn?.classList.remove(...activeClasses);
            playerBtn?.classList.add(...inactiveClasses);
        }
        if (window.lucide) lucide.createIcons();
    }

    document.querySelectorAll('.tracker-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });

    setupPlayerSearch('search-input', 'search-results', player => performPlayerLookup(player));
    setupPlayerSearch('h2h-player-a-input', 'h2h-player-a-results', player => {
        state.playerA = player;
        renderSelectedPlayer('A', player);
        updateCompareButton();
    });
    setupPlayerSearch('h2h-player-b-input', 'h2h-player-b-results', player => {
        state.playerB = player;
        renderSelectedPlayer('B', player);
        updateCompareButton();
    });

    comparePlayersBtn?.addEventListener('click', runHeadToHead);

    updateCompareButton();
    if (window.lucide) lucide.createIcons();
});