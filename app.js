const API_BASE = "https://api.github.com";
const STORAGE_KEY_THEME = "gh-dashboard-theme";
const STORAGE_KEY_LAST_USER = "gh-dashboard-last-user";
const STORAGE_KEY_COMPANY_CACHE = "gh-dashboard-company-cache";
const DEFAULT_USERNAME = "DataCrash";
const LINKEDIN_PROFILE_URL = "https://www.linkedin.com/in/datacrash";

const COMPANY_DOMAIN_MAP = {
  "c&a": "cea.com.br",
  "ca": "cea.com.br",
  "carglass": "carglass.com.br",
  "ecorodovias": "ecorodovias.com.br",
  "itau": "itau.com.br"
};

const els = {
  usernameInput: document.getElementById("usernameInput"),
  loadBtn: document.getElementById("loadBtn"),
  themeToggle: document.getElementById("themeToggle"),
  status: document.getElementById("status"),
  hero: document.getElementById("hero"),
  kpis: document.getElementById("kpis"),
  contentGrid: document.getElementById("contentGrid"),
  avatar: document.getElementById("avatar"),
  displayName: document.getElementById("displayName"),
  bio: document.getElementById("bio"),
  profileLink: document.getElementById("profileLink"),
  location: document.getElementById("location"),
  company: document.getElementById("company"),
  companyLogo: document.getElementById("companyLogo"),
  kpiRepos: document.getElementById("kpiRepos"),
  kpiFollowers: document.getElementById("kpiFollowers"),
  kpiFollowing: document.getElementById("kpiFollowing"),
  kpiStars: document.getElementById("kpiStars"),
  topRepos: document.getElementById("topRepos"),
  recentRepos: document.getElementById("recentRepos"),
  languageBars: document.getElementById("languageBars"),
  repoItemTpl: document.getElementById("repoItemTpl")
};

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY_THEME, theme);
  els.themeToggle.textContent = theme === "dark" ? "Tema: Escuro" : "Tema: Claro";
}

function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY_THEME);
  if (saved === "dark" || saved === "light") {
    setTheme(saved);
    return;
  }

  const prefersDark = globalThis.matchMedia("(prefers-color-scheme: dark)").matches;
  setTheme(prefersDark ? "dark" : "light");
}

function formatNumber(num) {
  return new Intl.NumberFormat("pt-BR").format(num || 0);
}

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.style.color = isError ? "#ff6d7a" : "";
}

function formatDate(isoDate) {
  if (!isoDate) {
    return "N/A";
  }
  return new Date(isoDate).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function normalizeCompany(value) {
  return (value || "")
    .replace(/^@/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveCompanyLogo(companyName) {
  const normalized = normalizeCompany(companyName).toLowerCase();
  if (!normalized) {
    return "";
  }

  const foundKey = Object.keys(COMPANY_DOMAIN_MAP).find((key) => normalized.includes(key));
  if (!foundKey) {
    return "";
  }

  return `https://logo.clearbit.com/${COMPANY_DOMAIN_MAP[foundKey]}`;
}

function applyCompany(companyName, logoUrl = "") {
  const finalCompany = normalizeCompany(companyName) || "Sem empresa informada";
  els.company.textContent = finalCompany;

  if (logoUrl) {
    els.companyLogo.src = logoUrl;
    els.companyLogo.classList.remove("hidden");
  } else {
    els.companyLogo.classList.add("hidden");
    els.companyLogo.src = "";
  }
}

function loadCachedCompany() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COMPANY_CACHE);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveCachedCompany(companyName, logoUrl) {
  localStorage.setItem(
    STORAGE_KEY_COMPANY_CACHE,
    JSON.stringify({ companyName: normalizeCompany(companyName), logoUrl: logoUrl || "", at: Date.now() })
  );
}

async function syncCompanyFromLinkedInFallback() {
  try {
    const response = await fetch(`https://r.jina.ai/http://${LINKEDIN_PROFILE_URL.replace(/^https?:\/\//, "")}`);
    if (!response.ok) {
      return null;
    }

    const text = await response.text();
    const companyRegex = /company[^\n:]*[:-]\s*([^\n]+)/i;
    const match = companyRegex.exec(text);
    if (!match?.[1]) {
      return null;
    }

    const companyName = normalizeCompany(match[1]);
    if (!companyName) {
      return null;
    }

    return {
      companyName,
      logoUrl: resolveCompanyLogo(companyName)
    };
  } catch {
    return null;
  }
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json"
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Usuário não encontrado.");
    }
    if (response.status === 403) {
      throw new Error("Limite da API atingido. Tente novamente em alguns minutos.");
    }
    throw new Error("Falha ao consultar API do GitHub.");
  }

  return response.json();
}

function repoItem(repo) {
  const node = els.repoItemTpl.content.firstElementChild.cloneNode(true);
  const head = node.querySelector(".repo-head");
  const title = node.querySelector("h4");
  const desc = node.querySelector("p");
  const meta = node.querySelector(".repo-meta");
  const details = node.querySelector(".repo-details");

  title.textContent = repo.name;
  desc.textContent = repo.description || "Sem descrição";
  meta.textContent = `★ ${formatNumber(repo.stargazers_count)} · ${repo.language || "N/A"} · ▼`;

  const topics = (repo.topics || []).slice(0, 4).join(" · ") || "Sem tópicos";
  details.innerHTML = `
    <p>${repo.description || "Sem descrição adicional."}</p>
    <div class="detail-grid">
      <div class="detail-chip">Forks: ${formatNumber(repo.forks_count)}</div>
      <div class="detail-chip">Issues: ${formatNumber(repo.open_issues_count)}</div>
      <div class="detail-chip">Branch: ${repo.default_branch || "main"}</div>
      <div class="detail-chip">Criado: ${formatDate(repo.created_at)}</div>
      <div class="detail-chip">Atualizado: ${formatDate(repo.updated_at)}</div>
      <div class="detail-chip">Pushed: ${formatDate(repo.pushed_at)}</div>
    </div>
    <p>Tópicos: ${topics}</p>
    <div class="repo-links">
      <a href="${repo.html_url}" target="_blank" rel="noreferrer">Abrir repositório</a>
      ${repo.homepage ? `<a href="${repo.homepage}" target="_blank" rel="noreferrer">Homepage</a>` : ""}
    </div>
    <span class="repo-toggle">Clique no card para colapsar</span>
  `;

  head.addEventListener("click", () => {
    const expanded = node.dataset.expanded === "true";
    node.dataset.expanded = expanded ? "false" : "true";
    details.classList.toggle("hidden", expanded);
    meta.textContent = expanded
      ? `★ ${formatNumber(repo.stargazers_count)} · ${repo.language || "N/A"} · ▼`
      : `★ ${formatNumber(repo.stargazers_count)} · ${repo.language || "N/A"} · ▲`;
  });

  return node;
}

function renderRepos(container, repos, max = 6) {
  container.innerHTML = "";
  repos.slice(0, max).forEach((repo) => {
    container.appendChild(repoItem(repo));
  });
}

function renderLanguages(repos) {
  const totals = repos.reduce((acc, repo) => {
    if (!repo.language) {
      return acc;
    }
    acc[repo.language] = (acc[repo.language] || 0) + 1;
    return acc;
  }, {});

  const entries = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const max = entries[0]?.[1] || 1;
  els.languageBars.innerHTML = "";

  entries.forEach(([lang, count]) => {
    const percent = Math.round((count / max) * 100);
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <span>${lang}</span>
      <div class="track"><div class="fill" style="width:${percent}%"></div></div>
      <strong>${count}</strong>
    `;
    els.languageBars.appendChild(row);
  });
}

function showContent(show) {
  [els.hero, els.kpis, els.contentGrid].forEach((el) => {
    el.classList.toggle("hidden", !show);
  });
}

async function loadDashboard() {
  const username = els.usernameInput.value.trim();
  if (!username) {
    setStatus("Informe um usuário do GitHub para carregar o dashboard.", true);
    showContent(false);
    return;
  }

  setStatus("Carregando dados do GitHub...");
  els.loadBtn.disabled = true;

  try {
    const [user, reposRaw] = await Promise.all([
      fetchJson(`${API_BASE}/users/${encodeURIComponent(username)}`),
      fetchJson(`${API_BASE}/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`)
    ]);

    const repos = reposRaw.filter((repo) => !repo.fork);
    const topRepos = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count);
    const recentRepos = [...repos].sort((a, b) => {
      return new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime();
    });

    const stars = topRepos.slice(0, 10).reduce((sum, repo) => sum + repo.stargazers_count, 0);

    els.avatar.src = user.avatar_url;
    els.displayName.textContent = user.name || `@${user.login}`;
    els.bio.textContent = user.bio || "Sem bio cadastrada.";
    els.profileLink.href = user.html_url;
    els.location.textContent = user.location || "Sem local informado";
    const githubCompany = normalizeCompany(user.company);
    const cachedCompany = loadCachedCompany();
    const fallbackCompany = githubCompany || cachedCompany?.companyName || "";
    const fallbackLogo = githubCompany ? resolveCompanyLogo(githubCompany) : (cachedCompany?.logoUrl || "");
    applyCompany(fallbackCompany, fallbackLogo);

    if (githubCompany) {
      saveCachedCompany(githubCompany, fallbackLogo);
    } else {
      const linkedinCompany = await syncCompanyFromLinkedInFallback();
      if (linkedinCompany?.companyName) {
        applyCompany(linkedinCompany.companyName, linkedinCompany.logoUrl);
        saveCachedCompany(linkedinCompany.companyName, linkedinCompany.logoUrl);
      }
    }

    els.kpiRepos.textContent = formatNumber(user.public_repos);
    els.kpiFollowers.textContent = formatNumber(user.followers);
    els.kpiFollowing.textContent = formatNumber(user.following);
    els.kpiStars.textContent = formatNumber(stars);

    renderRepos(els.topRepos, topRepos, 6);
    renderRepos(els.recentRepos, recentRepos, 7);
    renderLanguages(repos);

    localStorage.setItem(STORAGE_KEY_LAST_USER, username);
    showContent(true);
    setStatus(`Dashboard carregado para @${user.login}.`);
  } catch (err) {
    showContent(false);
    setStatus(err.message || "Erro inesperado ao montar dashboard.", true);
  } finally {
    els.loadBtn.disabled = false;
  }
}

els.themeToggle.addEventListener("click", () => {
  const current = document.documentElement.dataset.theme;
  setTheme(current === "dark" ? "light" : "dark");
});

els.loadBtn.addEventListener("click", loadDashboard);
els.usernameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadDashboard();
  }
});

(function init() {
  initTheme();

  const lastUser = localStorage.getItem(STORAGE_KEY_LAST_USER) || DEFAULT_USERNAME;
  els.usernameInput.value = lastUser;
  if (els.usernameInput.value.trim()) {
    loadDashboard();
  } else {
    setStatus("Digite um usuário e clique em Carregar para gerar o overview.");
  }
})();
