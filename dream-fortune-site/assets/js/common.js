const SITE_DATA = window.DREAM_FORTUNE_SITE || {
  siteName: "Dream & Fortune Archive",
  siteUrl: "",
  contentItems: []
};

const SEARCH_INDEX = SITE_DATA.contentItems;
const RECENT_SEARCHES_KEY = "dfa_recent_searches";
const RECENT_VIEWS_KEY = "dfa_recent_views";

function normalizeText(value) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function getCurrentPath() {
  return window.location.pathname.replace(/index\.html$/, "");
}

function getDreamItems() {
  return SEARCH_INDEX.filter((item) => item.section === "dream");
}

function initMobileMenu() {
  const hamburger = document.querySelector(".hamburger");
  const nav = document.querySelector("nav.main-nav");

  if (!hamburger || !nav) {
    return;
  }

  hamburger.addEventListener("click", () => {
    const isOpen = hamburger.classList.toggle("active");
    nav.classList.toggle("active", isOpen);
    hamburger.setAttribute("aria-expanded", String(isOpen));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      hamburger.classList.remove("active");
      nav.classList.remove("active");
      hamburger.setAttribute("aria-expanded", "false");
    });
  });
}

function setActiveNavigation() {
  const currentPath = getCurrentPath();

  document.querySelectorAll("nav.main-nav a").forEach((link) => {
    const href = new URL(link.getAttribute("href"), window.location.href)
      .pathname
      .replace(/index\.html$/, "");

    const isActive = (href !== "/" && currentPath.startsWith(href)) || (href === "/" && currentPath === "/");
    link.classList.toggle("active", isActive);

    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function getSearchResults(query) {
  const normalized = normalizeText(query);
  const rawTokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  return SEARCH_INDEX.map((entry) => {
    let score = 0;
    const haystack = normalizeText(`${entry.fullTitle} ${entry.title} ${entry.keywords.join(" ")}`);

    if (haystack.includes(normalized)) {
      score += 8;
    }

    entry.keywords.forEach((keyword) => {
      const normalizedKeyword = normalizeText(keyword);
      if (normalizedKeyword === normalized) {
        score += 10;
      } else if (normalizedKeyword.includes(normalized) || normalized.includes(normalizedKeyword)) {
        score += 6;
      }
    });

    rawTokens.forEach((token) => {
      if (token && haystack.includes(normalizeText(token))) {
        score += 2;
      }
    });

    return { ...entry, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
}

function getFileProtocolRootPath() {
  const currentPath = window.location.pathname;
  const knownRoots = ["/dream/", "/fortune/", "/guide/", "/about/", "/contact/", "/privacy/", "/terms/"];

  for (const root of knownRoots) {
    if (currentPath.includes(root)) {
      return currentPath.split(root)[0] + "/";
    }
  }

  return currentPath.replace(/index\.html$/, "");
}

function buildAbsoluteUrl(route) {
  const current = new URL(window.location.href);

  if (/^https?:\/\//.test(route)) {
    return route;
  }

  if (current.protocol === "file:") {
    return new URL(route.replace(/^\//, ""), `file://${getFileProtocolRootPath()}`).toString();
  }

  return new URL(route, window.location.origin).toString();
}

function buildArchiveSearchUrl(query) {
  return `/dream/?q=${encodeURIComponent(query)}`;
}

function getStorageList(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function setStorageList(key, items) {
  window.localStorage.setItem(key, JSON.stringify(items.slice(0, 6)));
}

function saveRecentSearch(query) {
  const normalized = normalizeText(query);
  const current = getStorageList(RECENT_SEARCHES_KEY).filter((item) => normalizeText(item) !== normalized);
  current.unshift(query.trim());
  setStorageList(RECENT_SEARCHES_KEY, current);
}

function saveRecentView() {
  const viewNode = document.querySelector("[data-view-title]");
  if (!viewNode) {
    return;
  }

  const title = viewNode.getAttribute("data-view-title");
  const url = viewNode.getAttribute("data-view-url") || getCurrentPath();
  const current = getStorageList(RECENT_VIEWS_KEY).filter((item) => item.url !== url);
  current.unshift({ title, url });
  setStorageList(RECENT_VIEWS_KEY, current);
}

function renderTagList(container, items, emptyMessage) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "text-small mb-0";
    empty.textContent = emptyMessage;
    container.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const link = document.createElement("a");
    link.className = "tag";
    link.href = item.href;
    link.textContent = item.label;
    container.appendChild(link);
  });
}

function renderRecentSearches() {
  const searches = getStorageList(RECENT_SEARCHES_KEY);

  document.querySelectorAll("[data-recent-searches]").forEach((container) => {
    renderTagList(
      container,
      searches.map((query) => ({
        label: `#${query}`,
        href: buildAbsoluteUrl(buildArchiveSearchUrl(query))
      })),
      "최근 검색어가 아직 없습니다."
    );
  });
}

function renderRecentViews() {
  const views = getStorageList(RECENT_VIEWS_KEY);

  document.querySelectorAll("[data-recent-views]").forEach((container) => {
    renderTagList(
      container,
      views.map((item) => ({
        label: item.title,
        href: buildAbsoluteUrl(item.url)
      })),
      "아직 읽은 글이 없습니다."
    );
  });
}

function createArchiveCard(item) {
  const article = document.createElement("article");
  article.className = "card";
  article.setAttribute("data-search-card", "");
  article.setAttribute(
    "data-search-terms",
    `${item.title} ${item.fullTitle} ${item.keywords.join(" ")}`
  );

  article.innerHTML = `
    <div class="card-meta"><span>${item.group}</span><span>${item.badge}</span></div>
    <h2>${item.title}</h2>
    <p>${item.summary}</p>
    <a href="${item.path.replace("/dream/", "./")}" class="btn btn-secondary">자세히 읽기</a>
  `;

  return article;
}

function renderArchiveGrid() {
  const grid = document.querySelector("[data-archive-grid]");
  if (!grid) {
    return;
  }

  grid.innerHTML = "";
  getDreamItems().forEach((item) => {
    grid.appendChild(createArchiveCard(item));
  });

  document.querySelectorAll("[data-dream-count]").forEach((node) => {
    node.textContent = String(getDreamItems().length);
  });
}

function initSearch() {
  const searchBoxes = document.querySelectorAll(".search-box");

  searchBoxes.forEach((box) => {
    const input = box.querySelector(".search-input");
    const button = box.querySelector(".search-button");
    const status = box.parentElement.querySelector("[data-search-status]");

    if (!input || !button) {
      return;
    }

    const moveToResult = () => {
      const query = input.value.trim();

      if (!query) {
        window.alert("검색어를 입력해 주세요.");
        input.focus();
        return;
      }

      const results = getSearchResults(query);
      const topResult = results[0];
      const route = topResult && topResult.score >= 8 ? topResult.path : buildArchiveSearchUrl(query);

      if (status) {
        status.textContent = topResult
          ? `"${query}" 검색 결과로 ${topResult.fullTitle} 페이지를 준비했습니다.`
          : `"${query}"와 관련된 결과를 꿈해몽 아카이브에서 찾아봅니다.`;
      }

      saveRecentSearch(query);
      renderRecentSearches();
      window.location.href = buildAbsoluteUrl(route);
    };

    button.addEventListener("click", moveToResult);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        moveToResult();
      }
    });
  });
}

function initArchiveSearchResults() {
  const archive = document.querySelector("[data-archive-search]");
  if (!archive) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const query = params.get("q");
  const input = document.querySelector("[data-archive-input]");
  const cards = Array.from(document.querySelectorAll("[data-search-card]"));
  const count = document.querySelector("[data-results-count]");
  const empty = document.querySelector("[data-empty-results]");

  if (!query) {
    if (count) {
      count.textContent = `전체 꿈해몽 주제 ${getDreamItems().length}개를 둘러보는 중입니다.`;
    }
    return;
  }

  if (input) {
    input.value = query;
  }

  const normalized = normalizeText(query);
  let visibleCount = 0;

  cards.forEach((card) => {
    const terms = normalizeText(card.getAttribute("data-search-terms") || "");
    const matches = terms.includes(normalized);
    card.hidden = !matches;
    if (matches) {
      visibleCount += 1;
    }
  });

  if (count) {
    count.textContent = `"${query}"와 관련된 결과 ${visibleCount}개`;
  }

  if (empty) {
    empty.hidden = visibleCount !== 0;
  }
}

function updateCurrentYear() {
  const year = new Date().getFullYear();

  document.querySelectorAll("[data-current-year]").forEach((node) => {
    node.textContent = String(year);
  });
}

function onPageReady(callback) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback);
  } else {
    callback();
  }
}

onPageReady(() => {
  renderArchiveGrid();
  initMobileMenu();
  setActiveNavigation();
  initSearch();
  initArchiveSearchResults();
  updateCurrentYear();
  saveRecentView();
  renderRecentSearches();
  renderRecentViews();
});
