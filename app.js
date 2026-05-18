const API_BASE = "https://api.github.com";
const STORAGE_KEY_THEME = "gh-dashboard-theme";
const STORAGE_KEY_LAST_USER = "gh-dashboard-last-user";

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

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  setTheme(prefersDark ? "dark" : "light");
}

function formatNumber(num) {
  return new Intl.NumberFormat("pt-BR").format(num || 0);
}

function status(message, isError = false) {
  els.status.textContent = message;
  els.status.style.color = isError ? "#ff6d7a" : "";
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
  const title = node.querySelector("h4");
  const desc = node.querySelector("p");
  const meta = node.querySelector(".repo-meta");

  node.href = repo.html_url;
  title.textContent = repo.name;
  desc.textContent = repo.description || "Sem descrição";
  meta.textContent = `★ ${formatNumber(repo.stargazers_count)} · ${repo.language || "N/A"}`;

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
    status("Informe um usuário do GitHub para carregar o dashboard.", true);
    showContent(false);
    return;
  }

  status("Carregando dados do GitHub...");
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
    els.company.textContent = user.company || "Sem empresa informada";

    els.kpiRepos.textContent = formatNumber(user.public_repos);
    els.kpiFollowers.textContent = formatNumber(user.followers);
    els.kpiFollowing.textContent = formatNumber(user.following);
    els.kpiStars.textContent = formatNumber(stars);

    renderRepos(els.topRepos, topRepos, 6);
    renderRepos(els.recentRepos, recentRepos, 7);
    renderLanguages(repos);

    localStorage.setItem(STORAGE_KEY_LAST_USER, username);
    showContent(true);
    status(`Dashboard carregado para @${user.login}.`);
  } catch (err) {
    showContent(false);
    status(err.message || "Erro inesperado ao montar dashboard.", true);
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

  const lastUser = localStorage.getItem(STORAGE_KEY_LAST_USER) || "";
  els.usernameInput.value = lastUser;
  if (lastUser) {
    loadDashboard();
  } else {
    status("Digite um usuário e clique em Carregar para gerar o overview.");
  }
})();
