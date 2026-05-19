const API_BASE = "https://api.github.com";
const STORAGE_KEY_THEME = "gh-dashboard-theme";
const STORAGE_KEY_LAST_USER = "gh-dashboard-last-user";
const STORAGE_KEY_COMPANY_CACHE = "gh-dashboard-company-cache";
const DEFAULT_USERNAME = "DataCrash";
const LINKEDIN_BASE_URL = "https://www.linkedin.com/in/";

// Mapa de domínios de empresas conhecidas para fallback de logo
const COMPANY_DOMAIN_MAP = {
  "c&a": "cea.com",
  "ca brasil": "cea.com",
  "cea": "cea.com",
  "carglass": "carglass.com.br",
  "ecorodovias": "ecorodovias.com.br",
  "itau": "itau.com.br",
  "itaú": "itau.com.br",
  "ntt data": "nttdata.com",
  "microsoft": "microsoft.com",
  "amazon": "amazon.com",
  "google": "google.com"
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

function normalizeProfileText(value) {
  return (value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function preloadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => resolve("");
    img.src = url;
  });
}

function getCompanyLogoCandidates(companyName, orgAvatarUrl = "", linkedinLogoUrl = "") {
  const cleanName = normalizeCompany(companyName);
  const normalized = cleanName.toLowerCase();
  if (!normalized) return [];

  const candidates = [];

  // 1) avatar oficial da organização GitHub (melhor fonte)
  if (orgAvatarUrl) candidates.push(orgAvatarUrl);

  // 2) logo extraído do LinkedIn (quando disponível)
  if (linkedinLogoUrl) candidates.push(linkedinLogoUrl);

  // 3) domínio mapeado → clearbit + duckduckgo + google
  const foundKey = Object.keys(COMPANY_DOMAIN_MAP).find((key) => normalized.includes(key));
  if (foundKey) {
    const domain = COMPANY_DOMAIN_MAP[foundKey];
    candidates.push(
      `https://logo.clearbit.com/${domain}`,
      `https://icons.duckduckgo.com/ip3/${domain}.ico`,
      `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
    );
  }

  // 4) placeholder gerado com iniciais (garantido sempre funciona)
  candidates.push(
    `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=1e293b&color=94a3b8&size=128&bold=true&format=png`
  );

  return candidates;
}

async function resolveCompanyLogo(companyName, orgAvatarUrl = "", linkedinLogoUrl = "") {
  const candidates = getCompanyLogoCandidates(companyName, orgAvatarUrl, linkedinLogoUrl);
  for (const candidate of candidates) {
    const resolved = await preloadImage(candidate);
    if (resolved) return resolved;
  }
  return "";
}

// Busca organização GitHub do usuário e tenta casar com company do perfil
async function fetchGitHubOrgData(username, companyName) {
  try {
    const orgs = await fetchJson(`${API_BASE}/users/${encodeURIComponent(username)}/orgs`);
    if (!orgs || orgs.length === 0) return null;

    const normalized = normalizeCompany(companyName).toLowerCase();

    // tenta casar pelo nome da org com o campo company
    let match = orgs.find((org) => {
      const orgName = (org.login + " " + (org.description || "")).toLowerCase();
      return normalized && (orgName.includes(normalized) || normalized.includes(org.login.toLowerCase()));
    });

    // se não casou pelo nome, usa a primeira org pública como melhor aposta
    if (!match && orgs.length > 0) match = orgs[0];

    if (!match) return null;

    return {
      companyName: match.name || match.login,
      orgAvatarUrl: match.avatar_url || "",
      orgLogin: match.login
    };
  } catch {
    return null;
  }
}

function parseLinkedInLogoUrl(text) {
  if (!text) return "";

  // Tenta imagens do LinkedIn em Markdown convertido pelo r.jina.ai
  const markdownImages = [...text.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/gi)]
    .map((m) => m[1])
    .filter((url) => /media\.licdn\.com|licdn\.com/i.test(url));

  const directLinkedInMedia = [...text.matchAll(/https?:\/\/[^\s"')]+/gi)]
    .map((m) => m[0])
    .filter((url) => /media\.licdn\.com|licdn\.com/i.test(url));

  const candidates = [...markdownImages, ...directLinkedInMedia];
  const prioritized = candidates.find((url) => /company|logo|dms\/image/i.test(url));
  return prioritized || candidates[0] || "";
}

function parseLinkedInCompany(text) {
  if (!text) return "";

  const patterns = [
    /title:\s*[^\n|]+-\s*([^|\n]{2,120})\|\s*LinkedIn/i,
    /https?:\/\/(?:[a-z]{2}\.)?linkedin\.com\/company\/[^\s?]+\?trk=[^\s\n]*topcard-current-company[^\n]*\n?/i,
    /Current company[:\s]+([^\n|]+)/i,
    /(?:works? at|working at|employed at)[:\s]+([^\n|,]+)/i,
    /company[^\n:]*[:-]\s*([^\n|]{3,80})/i
  ];

  for (const pattern of patterns) {
    const m = pattern.exec(text);
    if (m?.[0]) {
      let extracted = m[1] || "";

      // Quando casar URL da empresa (topcard-current-company), tenta pegar o slug e normalizar.
      if (!extracted && /\/company\//i.test(m[0])) {
        const slugMatch = m[0].match(/\/company\/([^/?\s]+)/i);
        extracted = slugMatch?.[1] || "";
        extracted = decodeURIComponent(extracted).replace(/[_-]+/g, " ");
      }

      const name = normalizeCompany(extracted);
      if (name && name.length > 1) return name;
    }
  }

  return "";
}

function parseLinkedInBio(text) {
  if (!text) return "";

  const patterns = [
    /Headline[:\s]+([^\n]{8,200})/i,
    /About[:\s]+([^\n]{8,260})/i,
    /Summary[:\s]+([^\n]{8,260})/i
  ];

  for (const pattern of patterns) {
    const m = pattern.exec(text);
    if (m?.[1]) {
      const bio = normalizeProfileText(m[1]);
      if (bio) return bio;
    }
  }

  return "";
}

// Verifica se existe perfil LinkedIn com o mesmo username GitHub
// Se não existir (404 / authwall sem conteúdo), retorna null e mantém fallback do GitHub
async function fetchLinkedInProfileData(username) {
  try {
    const profileCandidates = [
      `https://br.linkedin.com/in/${encodeURIComponent(username)}`,
      `https://pt.linkedin.com/in/${encodeURIComponent(username)}`,
      `${LINKEDIN_BASE_URL}${encodeURIComponent(username)}`
    ];

    for (const profileUrl of profileCandidates) {
      const response = await fetch(`https://r.jina.ai/${profileUrl}`, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) continue;

      const text = await response.text();
      if (!text || text.length < 200) continue;

      const companyName = parseLinkedInCompany(text);
      const bio = parseLinkedInBio(text);
      const companyLogoUrl = parseLinkedInLogoUrl(text);

      // Página pública pode conter "Sign in/Join" e ainda assim trazer dados válidos.
      const hasSignals = Boolean(companyName || bio || companyLogoUrl);
      if (!hasSignals) continue;

      return {
        companyName,
        bio,
        companyLogoUrl,
        profileUrl
      };
    }

    return null;
  } catch {
    return null;
  }
}

function applyCompany(companyName, logoUrl = "") {
  const companyBadge = els.company?.closest?.(".company-badge") || els.companyLogo?.closest?.(".company-badge");

  if (!companyName) {
    // Oculta o badge inteiro quando não há empresa
    if (companyBadge) companyBadge.classList.add("hidden");
    els.companyLogo.classList.add("hidden");
    els.companyLogo.src = "";
    els.company.textContent = "";
    return;
  }

  const finalCompany = normalizeCompany(companyName);
  els.company.textContent = finalCompany;
  if (companyBadge) companyBadge.classList.remove("hidden");

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

function saveCachedCompany(data) {
  localStorage.setItem(
    STORAGE_KEY_COMPANY_CACHE,
    JSON.stringify({ ...data, companyName: normalizeCompany(data.companyName), at: Date.now() })
  );
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

    // --- Resolução dinâmica de empresa/logo ---
    // Prioridade: GitHub Org (logo oficial) → campo company → LinkedIn (mesmo username) → ocultar
    const githubCompany = normalizeCompany(user.company);
    const cached = loadCachedCompany();

    // Exibe cache imediatamente para UX rápida
    if (cached?.companyName) {
      applyCompany(cached.companyName, cached.logoUrl || "");
    } else {
      applyCompany("");
    }

    // Busca org GitHub e dados públicos do LinkedIn em paralelo
    const [orgData, linkedinData] = await Promise.all([
      fetchGitHubOrgData(username, githubCompany),
      fetchLinkedInProfileData(username)
    ]);

    let finalCompany = "";
    let finalLogoUrl = "";

    if (linkedinData?.bio) {
      els.bio.textContent = linkedinData.bio;
    }

    if (orgData) {
      // Org GitHub tem avatar oficial — preferência máxima
      finalCompany = githubCompany || orgData.companyName;
      finalLogoUrl = await resolveCompanyLogo(finalCompany, orgData.orgAvatarUrl);
    } else if (linkedinData?.companyName) {
      // LinkedIn (mesmo username) com empresa e, se disponível, logo oficial
      finalCompany = linkedinData.companyName;
      finalLogoUrl = await resolveCompanyLogo(finalCompany, "", linkedinData.companyLogoUrl || "");
    } else if (githubCompany) {
      // Campo company do perfil GitHub
      finalCompany = githubCompany;
      finalLogoUrl = await resolveCompanyLogo(finalCompany);
    }
    // Se nenhum fonte retornou empresa, deixa badge oculto

    applyCompany(finalCompany, finalLogoUrl);
    if (finalCompany) {
      saveCachedCompany({ companyName: finalCompany, logoUrl: finalLogoUrl });
    } else {
      localStorage.removeItem(STORAGE_KEY_COMPANY_CACHE);
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
