let allArticles = [];
let filteredArticles = [];

let highPriorityOnly = false;
let newOnly = false;


/* =========================
   TERRITORY DEFINITIONS
========================= */

const territoryTerms = {

  "Texas / Gulf Coast": [
    "texas",
    "houston",
    "gulf coast",
    "beaumont",
    "baytown",
    "pasadena",
    "freeport",
    "port arthur",
    "galveston",
    "conroe",
    "corpus christi",
    "lake charles",
    "baton rouge",
    "louisiana"
  ],

  "Texas": [
    "texas",
    "houston",
    "dallas",
    "fort worth",
    "austin",
    "san antonio",
    "beaumont",
    "midland",
    "odessa",
    "corpus christi",
    "conroe",
    "amarillo"
  ],

  "Houston": [
    "houston",
    "conroe",
    "cypress",
    "katy",
    "baytown",
    "pasadena",
    "galveston",
    "the woodlands"
  ],

  "Louisiana": [
    "louisiana",
    "lake charles",
    "baton rouge",
    "new orleans",
    "lafayette",
    "shreveport"
  ]

};


/* =========================
   LOAD AUTOMATED NEWS
========================= */

async function loadIntelligence() {

  const articleFeed =
    document.getElementById("articleFeed");

  const priorityFeed =
    document.getElementById("priorityFeed");

  articleFeed.innerHTML =
    `
    <div class="loading-card">
      Gathering current market intelligence...
    </div>
    `;

  priorityFeed.innerHTML =
    `
    <div class="loading-card">
      Loading top opportunities...
    </div>
    `;

  try {

    const response =
      await fetch(
        "news.json?v=" + Date.now(),
        {
          cache: "no-store"
        }
      );

    if (!response.ok) {

      throw new Error(
        "Could not load news.json"
      );

    }

    const data =
      await response.json();

    if (
      !data ||
      !Array.isArray(data.articles)
    ) {

      throw new Error(
        "Invalid intelligence feed"
      );

    }


    allArticles =
      data.articles.map(
        normalizeArticle
      );


    if (data.generated_at) {

      const updated =
        new Date(
          data.generated_at
        );

      document
        .getElementById("feedUpdated")
        .textContent =
          "Updated " +
          updated.toLocaleString(
            [],
            {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit"
            }
          );

    } else {

      document
        .getElementById("feedUpdated")
        .textContent =
          "Automated intelligence online";

    }


    applyFilters();

  }

  catch(error) {

    console.error(error);

    document
      .getElementById("feedUpdated")
      .textContent =
        "Feed unavailable";


    articleFeed.innerHTML =
      `
      <div class="error-card">

        <strong>
          Unable to load the intelligence feed.
        </strong>

        <br><br>

        The dashboard loaded correctly,
        but news.json could not be read.

      </div>
      `;


    priorityFeed.innerHTML =
      `
      <div class="error-card">
        Priority feed unavailable.
      </div>
      `;


    updateStats([]);

  }

}


/* =========================
   NORMALIZE DATA
========================= */

function normalizeArticle(article) {

  return {

    title:
      article.title ||
      "Untitled Article",

    url:
      safeUrl(article.url)
        ? article.url
        : "#",

    source:
      article.source ||
      "News Source",

    publishedAt:
      article.published_at ||
      null,

    category:
      article.category ||
      "Market Intelligence",

    score:
      Number(article.score) ||
      50,

    salesAngle:
      article.sales_angle ||
      "Review this development for potential customer, territory or competitive implications.",

    matchedQuery:
      article.matched_query ||
      ""

  };

}


/* =========================
   FILTERING
========================= */

function applyFilters() {

  const searchText =
    document
      .getElementById("searchFilter")
      .value
      .trim()
      .toLowerCase();


  const category =
    document
      .getElementById("categoryFilter")
      .value;


  const territory =
    document
      .getElementById("territoryFilter")
      .value;


  const days =
    Number(
      document
        .getElementById("timeFilter")
        .value
    );


  const cutoff =
    days > 0
      ? Date.now() -
        (
          days *
          24 *
          60 *
          60 *
          1000
        )
      : 0;


  filteredArticles =
    allArticles.filter(
      article => {


        /* CATEGORY */

        if (
          category !== "All" &&
          article.category !== category
        ) {

          return false;

        }


        /* HIGH PRIORITY */

        if (
          highPriorityOnly &&
          article.score < 80
        ) {

          return false;

        }


        /* NEW SINCE YESTERDAY */

        if (
          newOnly &&
          !isWithinHours(
            article.publishedAt,
            24
          )
        ) {

          return false;

        }


        /* TERRITORY */

        if (
          territory !== "All" &&
          !matchesTerritory(
            article,
            territory
          )
        ) {

          return false;

        }


        /* DATE */

        if (
          days > 0 &&
          article.publishedAt
        ) {

          const published =
            new Date(
              article.publishedAt
            ).getTime();


          if (
            !Number.isNaN(published) &&
            published < cutoff
          ) {

            return false;

          }

        }


        /* TEXT SEARCH */

        if (searchText) {

          const text =
            articleText(article);


          if (
            !text.includes(
              searchText
            )
          ) {

            return false;

          }

        }


        return true;

      }
    );


  filteredArticles.sort(
    (a, b) => {

      const scoreDifference =
        opportunityPriority(b) -
        opportunityPriority(a);


      if (
        scoreDifference !== 0
      ) {

        return scoreDifference;

      }


      return (
        dateValue(b.publishedAt) -
        dateValue(a.publishedAt)
      );

    }
  );


  renderDashboard();

}


/* =========================
   PRIORITY LOGIC
========================= */

function opportunityPriority(article) {

  let priority =
    article.score;


  if (
    isWithinHours(
      article.publishedAt,
      24
    )
  ) {

    priority += 4;

  }


  const text =
    articleText(article);


  if (
    text.includes("texas") ||
    text.includes("houston") ||
    text.includes("gulf coast")
  ) {

    priority += 3;

  }


  return priority;

}


/* =========================
   TERRITORY MATCHING
========================= */

function matchesTerritory(
  article,
  territory
) {

  const terms =
    territoryTerms[territory] ||
    [];


  const text =
    articleText(article);


  return terms.some(
    term =>
      text.includes(term)
  );

}


/* =========================
   RENDER EVERYTHING
========================= */

function renderDashboard() {

  updateStats(
    filteredArticles
  );

  renderPriorityFeed(
    filteredArticles
  );

  renderArticleFeed(
    filteredArticles
  );


  document
    .getElementById("resultCount")
    .textContent =
      filteredArticles.length +
      (
        filteredArticles.length === 1
          ? " intelligence signal"
          : " intelligence signals"
      );

}


/* =========================
   DASHBOARD STATS
========================= */

function updateStats(articles) {

  const high =
    articles.filter(
      article =>
        article.score >= 80
    ).length;


  const dataCenters =
    articles.filter(
      article =>
        article.category ===
        "Data Centers"
    ).length;


  const newArticles =
    articles.filter(
      article =>
        isWithinHours(
          article.publishedAt,
          24
        )
    ).length;


  document
    .getElementById("articleCount")
    .textContent =
      articles.length;


  document
    .getElementById("highCount")
    .textContent =
      high;


  document
    .getElementById("dataCenterCount")
    .textContent =
      dataCenters;


  document
    .getElementById("newCount")
    .textContent =
      newArticles;

}


/* =========================
   MONDAY MORNING TOP 5
========================= */

function renderPriorityFeed(articles) {

  const container =
    document.getElementById(
      "priorityFeed"
    );


  const topFive =
    articles.slice(0, 5);


  if (
    topFive.length === 0
  ) {

    container.innerHTML =
      `
      <div
        class="empty-card"
        style="grid-column:1/-1;"
      >

        No priority opportunities
        match the current filters.

      </div>
      `;

    return;

  }


  container.innerHTML = "";


  topFive.forEach(
    (article, index) => {


      const card =
        document.createElement(
          "div"
        );


      card.className =
        "priority-card";


      const link =
        safeUrl(article.url)
          ? article.url
          : "#";


      card.innerHTML =
        `

        <div class="priority-rank">

          #${index + 1}
          Priority

        </div>


        <h3>

          <a
            href="${escapeHtml(link)}"
            target="_blank"
            rel="noopener noreferrer"
          >

            ${escapeHtml(article.title)}

          </a>

        </h3>


        <div class="priority-meta">

          ${escapeHtml(article.source)}

          <br>

          ${formatDate(article.publishedAt)}

        </div>


        <span class="priority-score">

          Opportunity Score:
          ${article.score}

        </span>

        `;


      container.appendChild(
        card
      );

    }
  );

}


/* =========================
   ARTICLE FEED
========================= */

function renderArticleFeed(articles) {

  const container =
    document.getElementById(
      "articleFeed"
    );


  if (
    articles.length === 0
  ) {

    container.innerHTML =
      `
      <div class="empty-card">

        <strong>
          No matching opportunities.
        </strong>

        <br><br>

        Try broadening the date range,
        removing a filter,
        or changing the territory.

      </div>
      `;

    return;

  }


  container.innerHTML = "";


  articles.forEach(
    article => {


      let level =
        "normal";


      let scoreClass =
        "badge-normal";


      if (
        article.score >= 80
      ) {

        level =
          "high";

        scoreClass =
          "badge-high";

      }

      else if (
        article.score >= 68
      ) {

        level =
          "medium";

        scoreClass =
          "badge-medium";

      }


      const card =
        document.createElement(
          "article"
        );


      card.className =
        "article-card " +
        level;


      const link =
        safeUrl(article.url)
          ? article.url
          : "#";


      const newBadge =
        isWithinHours(
          article.publishedAt,
          24
        )
        ?
        `
        <span class="badge badge-new">
          NEW &lt; 24H
        </span>
        `
        :
        "";


      card.innerHTML =
        `

        <div class="badges">


          <span
            class="badge ${scoreClass}"
          >

            OPPORTUNITY SCORE:
            ${article.score}

          </span>


          <span
            class="badge badge-category"
          >

            ${escapeHtml(article.category)}

          </span>


          ${newBadge}


        </div>


        <h3>

          <a
            href="${escapeHtml(link)}"
            target="_blank"
            rel="noopener noreferrer"
          >

            ${escapeHtml(article.title)}

          </a>

        </h3>


        <div class="meta">

          ${escapeHtml(article.source)}

          &nbsp;•&nbsp;

          ${formatDate(
            article.publishedAt
          )}

        </div>


        <div class="sales-intelligence">

          <strong>
            Sales Intelligence:
          </strong>

          ${escapeHtml(
            article.salesAngle
          )}

        </div>


        ${
          article.matchedQuery
          ?
          `
          <div class="trigger">

            Triggered by:
            ${escapeHtml(
              article.matchedQuery
            )}

          </div>
          `
          :
          ""
        }

        `;


      container.appendChild(
        card
      );

    }
  );

}


/* =========================
   FILTER BUTTONS
========================= */

function toggleHighPriority() {

  highPriorityOnly =
    !highPriorityOnly;


  document
    .getElementById(
      "highPriorityButton"
    )
    .classList
    .toggle(
      "active",
      highPriorityOnly
    );


  applyFilters();

}


function toggleNewOnly() {

  newOnly =
    !newOnly;


  document
    .getElementById(
      "newButton"
    )
    .classList
    .toggle(
      "active",
      newOnly
    );


  applyFilters();

}


/* =========================
   HELPERS
========================= */

function articleText(article) {

  return [

    article.title,
    article.source,
    article.category,
    article.salesAngle,
    article.matchedQuery

  ]
  .join(" ")
  .toLowerCase();

}


function safeUrl(url) {

  return (
    typeof url === "string" &&
    (
      url.startsWith("https://") ||
      url.startsWith("http://")
    )
  );

}


function escapeHtml(value) {

  return String(
    value || ""
  )

  .replaceAll(
    "&",
    "&amp;"
  )

  .replaceAll(
    "<",
    "&lt;"
  )

  .replaceAll(
    ">",
    "&gt;"
  )

  .replaceAll(
    '"',
    "&quot;"
  )

  .replaceAll(
    "'",
    "&#039;"
  );

}


function dateValue(value) {

  if (!value) {

    return 0;

  }


  const time =
    new Date(value)
    .getTime();


  return Number.isNaN(time)
    ? 0
    : time;

}


function isWithinHours(
  value,
  hours
) {

  const time =
    dateValue(value);


  if (!time) {

    return false;

  }


  return (
    Date.now() -
    time <=
    (
      hours *
      60 *
      60 *
      1000
    )
  );

}


function formatDate(value) {

  if (!value) {

    return "Recent";

  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "Recent";

  }


  return date.toLocaleString(
    [],
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }
  );

}


/* =========================
   EVENT LISTENERS
========================= */

document
  .getElementById(
    "searchFilter"
  )
  .addEventListener(
    "input",
    applyFilters
  );


document
  .getElementById(
    "categoryFilter"
  )
  .addEventListener(
    "change",
    applyFilters
  );


document
  .getElementById(
    "territoryFilter"
  )
  .addEventListener(
    "change",
    applyFilters
  );


document
  .getElementById(
    "timeFilter"
  )
  .addEventListener(
    "change",
    applyFilters
  );


document
  .getElementById(
    "highPriorityButton"
  )
  .addEventListener(
    "click",
    toggleHighPriority
  );


document
  .getElementById(
    "newButton"
  )
  .addEventListener(
    "click",
    toggleNewOnly
  );


document
  .getElementById(
    "refreshButton"
  )
  .addEventListener(
    "click",
    loadIntelligence
  );


/* =========================
   START CEMTEX
========================= */

loadIntelligence();
