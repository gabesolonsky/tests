function toggleSidebar() {
  document.getElementById("app").classList.toggle("sidebar-collapsed");
}

function updateProgressBar(rating) {
  const tiers = [
    { name: 'Beginner', min: 0, max: 3.5 },
    { name: 'Intermediate', min: 3.5, max: 4.5 },
    { name: 'Advanced', min: 4.5, max: 5.5 },
    { name: 'Semi-pro', min: 5.5, max: 6.5 },
    { name: 'Pro', min: 6.5, max: Infinity }
  ];

  let currentTierIndex = tiers.findIndex(tier => rating >= tier.min && rating < tier.max);
  if (currentTierIndex === -1) currentTierIndex = 0;
  const currentTier = tiers[currentTierIndex];

  let progressPercent;
  if (currentTier.max === Infinity) {
    progressPercent = 100;
  } else {
    progressPercent = ((rating - currentTier.min) / (currentTier.max - currentTier.min)) * 100;
  }

  const progressBarFill = document.querySelector('.w-full > div.bg-gradient-to-r');
  if (progressBarFill) {
    progressBarFill.style.width = `${progressPercent}%`;
  }

  const progressText = document.querySelector('.text-xs.mt-2.text-neutral-400.italic');
  if (progressText) {
    const nextTier = tiers[Math.min(currentTierIndex + 1, tiers.length - 1)];
    progressText.textContent = `${progressPercent.toFixed(0)}% towards ${nextTier.name}`;
  }
}

async function fetchAndRenderRatings(userId = 170053) {
  try {
    const response = await fetch(`/proxy/user/${userId}/rankings`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    // Filter for DivisionName === "All"
    const allDivisionRatings = data
      .filter(entry => entry.DivisionName === "All")
      .map(entry => ({
        date: entry.RankingPeriod,
        rating: entry.Rating
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date)); // chronological order

    if (allDivisionRatings.length === 0) {
      console.warn("No ratings data found for Division 'All'.");
      return;
    }

    // Current rating = rating on most recent date
    const currentRatingEntry = allDivisionRatings[allDivisionRatings.length - 1];
    const currentRating = currentRatingEntry.rating;

    // Highest rating and date
    let highestEntry = allDivisionRatings.reduce((max, entry) => (entry.rating > max.rating ? entry : max), allDivisionRatings[0]);
    const highestRating = highestEntry.rating;
    const highestDate = new Date(highestEntry.date);

    // Format highestDate nicely, e.g. "May 31, 2025"
    const highestDateFormatted = highestDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

    // Update HTML elements
    const currentRatingEl = document.getElementById("current-rating");
    const highestRatingEl = document.getElementById("highest-rating");
    const highestRatingDateEl = document.getElementById("highest-rating-date");

    if (currentRatingEl) currentRatingEl.textContent = currentRating.toFixed(2);
    updateProgressBar(currentRating);

    if (highestRatingEl) highestRatingEl.textContent = highestRating.toFixed(2);
    if (highestRatingDateEl) highestRatingDateEl.textContent = `(${highestDateFormatted})`;

    // Prepare data for chart
    const ratings = allDivisionRatings.map(r => r.rating);
    const categories = allDivisionRatings.map(r => r.date);

    // Render ApexChart
    new ApexCharts(document.querySelector("#chart"), {
      series: [{ name: 'Rating', data: ratings }],
      chart: { height: 350, type: 'area', toolbar: { show: false } },
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth' },
      xaxis: {
        categories: categories,
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

  } catch (error) {
    console.error("Error fetching or rendering ratings:", error);
  }
}

const userId = 170053; // Gabe's user ID

async function fetchAndRenderMatches() {
  try {
    // 10 Preloaded matches data
    const data = {
      "matches": [
        {
          "rowNum": "1",
          "Matchid": 3540383,
          "MatchDate": "2025-03-01T00:00:00",
          "Descr": "CSA Men's Varsity",
          "Score": "11-5,11-8,11-7",
          "Status": "C",
          "WhatKind": "L",
          "wid1": 79790,
          "wid2": 0,
          "oid1": 170053,
          "oid2": 0,
          "hplayer1": "Cooper Jessop",
          "hplayer2": null,
          "vplayer1": "Gabe Solonsky",
          "vplayer2": null,
          "Winner": "H"
        },
        {
          "rowNum": "2",
          "Matchid": 3540384,
          "MatchDate": "2025-03-10T00:00:00",
          "Descr": "CSA Men's Varsity",
          "Score": "9-11,11-7,11-9,11-8",
          "Status": "C",
          "WhatKind": "L",
          "wid1": 12345,
          "wid2": 67890,
          "oid1": 0,
          "oid2": 170053,
          "hplayer1": "John Smith",
          "hplayer2": null,
          "vplayer1": "Gabe Solonsky",
          "vplayer2": null,
          "Winner": "V"
        },
        {
          "rowNum": "3",
          "Matchid": 3540385,
          "MatchDate": "2025-03-15T00:00:00",
          "Descr": "National Series",
          "Score": "11-4,11-6,11-3",
          "Status": "C",
          "WhatKind": "L",
          "wid1": 22334,
          "wid2": 55667,
          "oid1": 170053,
          "oid2": 99999,
          "hplayer1": "Gabe Solonsky",
          "hplayer2": null,
          "vplayer1": "Alice Johnson",
          "vplayer2": null,
          "Winner": "H"
        },
        {
          "rowNum": "4",
          "Matchid": 3540386,
          "MatchDate": "2025-03-20T00:00:00",
          "Descr": "College Championship",
          "Score": "7-11,11-9,11-8,11-6",
          "Status": "C",
          "WhatKind": "L",
          "wid1": 33445,
          "wid2": 66778,
          "oid1": 11111,
          "oid2": 170053,
          "hplayer1": "Brian Lee",
          "hplayer2": null,
          "vplayer1": "Gabe Solonsky",
          "vplayer2": null,
          "Winner": "V"
        },
        {
          "rowNum": "5",
          "Matchid": 3540387,
          "MatchDate": "2025-04-01T00:00:00",
          "Descr": "Regional Qualifier",
          "Score": "11-9,11-7,11-5",
          "Status": "C",
          "WhatKind": "L",
          "wid1": 44556,
          "wid2": 77889,
          "oid1": 170053,
          "oid2": 22222,
          "hplayer1": "Gabe Solonsky",
          "hplayer2": null,
          "vplayer1": "Mark Davis",
          "vplayer2": null,
          "Winner": "H"
        },
        {
          "rowNum": "6",
          "Matchid": 3540388,
          "MatchDate": "2025-04-10T00:00:00",
          "Descr": "Local Tournament",
          "Score": "11-6,11-8,11-4",
          "Status": "C",
          "WhatKind": "L",
          "wid1": 55667,
          "wid2": 88990,
          "oid1": 33333,
          "oid2": 170053,
          "hplayer1": "Carl Young",
          "hplayer2": null,
          "vplayer1": "Gabe Solonsky",
          "vplayer2": null,
          "Winner": "V"
        },
        {
          "rowNum": "7",
          "Matchid": 3540389,
          "MatchDate": "2025-04-15T00:00:00",
          "Descr": "State Finals",
          "Score": "11-8,11-7,11-9",
          "Status": "C",
          "WhatKind": "L",
          "wid1": 66778,
          "wid2": 99001,
          "oid1": 170053,
          "oid2": 44444,
          "hplayer1": "Gabe Solonsky",
          "hplayer2": null,
          "vplayer1": "Chris Wilson",
          "vplayer2": null,
          "Winner": "H"
        },
        {
          "rowNum": "8",
          "Matchid": 3540390,
          "MatchDate": "2025-04-20T00:00:00",
          "Descr": "City Championship",
          "Score": "9-11,11-9,11-8,11-6,11-7",
          "Status": "C",
          "WhatKind": "L",
          "wid1": 77889,
          "wid2": 100002,
          "oid1": 55555,
          "oid2": 170053,
          "hplayer1": "David Martin",
          "hplayer2": null,
          "vplayer1": "Gabe Solonsky",
          "vplayer2": null,
          "Winner": "H"
        },
        {
          "rowNum": "9",
          "Matchid": 3540391,
          "MatchDate": "2025-04-25T00:00:00",
          "Descr": "Spring Open",
          "Score": "11-7,11-5,11-4",
          "Status": "C",
          "WhatKind": "L",
          "wid1": 88990,
          "wid2": 110003,
          "oid1": 170053,
          "oid2": 66666,
          "hplayer1": "Gabe Solonsky",
          "hplayer2": null,
          "vplayer1": "Kevin Brown",
          "vplayer2": null,
          "Winner": "H"
        },
        {
          "rowNum": "10",
          "Matchid": 3540392,
          "MatchDate": "2025-05-01T00:00:00",
          "Descr": "Summer Classic",
          "Score": "11-9,11-6,11-7",
          "Status": "C",
          "WhatKind": "L",
          "wid1": 99001,
          "wid2": 120004,
          "oid1": 77777,
          "oid2": 170053,
          "hplayer1": "Peter Parker",
          "hplayer2": null,
          "vplayer1": "Gabe Solonsky",
          "vplayer2": null,
          "Winner": "V"
        }
      ]
    };

    const container = document.querySelector("#matches-container"); 
    if (!container) {
      console.error("No container found for matches rendering.");
      return;
    }
    container.innerHTML = ""; // Clear existing content

    data.matches.forEach(match => {
      const isHome = match.oid1 === userId;
      const isVisitor = match.oid2 === userId;

      if (!isHome && !isVisitor) return;

      const opponentPlayers = isHome
        ? [match.vplayer1, match.vplayer2].filter(Boolean).join(" / ")
        : [match.hplayer1, match.hplayer2].filter(Boolean).join(" / ");

      const didWin = (match.Winner === "H" && isHome) || (match.Winner === "V" && isVisitor);
      const resultClass = didWin ? "win" : "lose";

      const matchDate = new Date(match.MatchDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      const matchHTML = `
        <div class="event-card ${resultClass}">
          <img src="https://ussq-img-live.s3.us-east-1.amazonaws.com/uploads%2Fussq-profile-icon-default.png" class="event-logo" alt="Match" />
          <div class="event-details">
            <p><strong>${matchDate}</strong></p>
            <p>${match.Score.replace(/,/g, ', ')}</p>
            <p>${match.Descr} — vs. ${opponentPlayers}</p>
          </div>
        </div>
      `;

      container.insertAdjacentHTML("beforeend", matchHTML);
    });

  } catch (error) {
    console.error("Error fetching or rendering matches:", error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  fetchAndRenderRatings();
  fetchAndRenderMatches();
});

lucide.createIcons(); // Initialize icons
