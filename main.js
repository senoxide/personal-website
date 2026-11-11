const phrases = [
	"compiles at 3am",
	"rebuilds kernels",
	"runs local models",
	"breaks the homelab",
	"reads manpages for fun",
];

const typingText = document.getElementById("typing-text");

if (typingText) {
	let phraseIndex = 0;
	let charIndex = 0;
	let deleting = false;

	const typeSpeed = 70;
	const deleteSpeed = 40;
	const pauseTime = 1400;

	const tick = () => {
		const current = phrases[phraseIndex];

		if (!deleting) {
			charIndex += 1;
			typingText.textContent = current.slice(0, charIndex);
			if (charIndex === current.length) {
				deleting = true;
				setTimeout(tick, pauseTime);
				return;
			}
		} else {
			charIndex -= 1;
			typingText.textContent = current.slice(0, charIndex);
			if (charIndex === 0) {
				deleting = false;
				phraseIndex = (phraseIndex + 1) % phrases.length;
			}
		}

		setTimeout(tick, deleting ? deleteSpeed : typeSpeed);
	};

	tick();
}

function attachRipple(el) {
	el.addEventListener("pointerdown", (event) => {
		const rect = el.getBoundingClientRect();
		const size = Math.max(rect.width, rect.height) * 1.4;
		const ripple = document.createElement("span");
		ripple.className = "ripple";
		ripple.style.width = `${size}px`;
		ripple.style.height = `${size}px`;
		ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
		ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
		el.appendChild(ripple);
		ripple.addEventListener("animationend", () => ripple.remove());
	});
}

document.querySelectorAll(".btn, .project-card--more").forEach(attachRipple);

const GH_USERNAME = "senoxide";
const GH_CACHE_KEY = "gh-stats-cache-v1";
const GH_CACHE_TTL = 1000 * 60 * 60 * 6;

const statEls = {
	repos: document.querySelector('[data-stat="repos"]'),
	stars: document.querySelector('[data-stat="stars"]'),
	followers: document.querySelector('[data-stat="followers"]'),
	updated: document.querySelector('[data-stat="updated"]'),
};

function readGhCache() {
	try {
		const raw = localStorage.getItem(GH_CACHE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (!parsed || !parsed.data || !parsed.timestamp) return null;
		return parsed;
	} catch {
		return null;
	}
}

function writeGhCache(data) {
	try {
		localStorage.setItem(GH_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
	} catch {
	}
}

function timeAgo(dateStr) {
	const diffMs = Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(diffMs / 60000);
	if (mins < 60) return `${Math.max(mins, 1)}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days}d ago`;
	return `${Math.floor(days / 30)}mo ago`;
}

function renderGhStats(data) {
	if (statEls.repos) statEls.repos.textContent = data.repos;
	if (statEls.stars) statEls.stars.textContent = data.stars;
	if (statEls.followers) statEls.followers.textContent = data.followers;
	if (statEls.updated) {
		statEls.updated.textContent = data.lastPush ? `updated ${timeAgo(data.lastPush)}` : "synced";
	}
}

async function loadGithubStats() {
	if (!statEls.repos) return;

	const cached = readGhCache();
	if (cached) {
		renderGhStats(cached.data);
		if (Date.now() - cached.timestamp < GH_CACHE_TTL) {
			return;
		}
	}

	try {
		const [userRes, reposRes] = await Promise.all([
			fetch(`https://api.github.com/users/${GH_USERNAME}`),
			fetch(`https://api.github.com/users/${GH_USERNAME}/repos?per_page=100`),
		]);
		if (!userRes.ok || !reposRes.ok) throw new Error("github api error");

		const user = await userRes.json();
		const repos = await reposRes.json();
		const repoList = Array.isArray(repos) ? repos : [];

		const stars = repoList.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
		const lastPush = repoList.length
			? repoList.reduce((latest, r) => (new Date(r.pushed_at) > new Date(latest) ? r.pushed_at : latest), repoList[0].pushed_at)
			: null;

		const data = {
			repos: user.public_repos ?? "–",
			stars,
			followers: user.followers ?? "–",
			lastPush,
		};

		writeGhCache(data);
		renderGhStats(data);
	} catch {
		if (!cached && statEls.updated) {
			statEls.updated.textContent = "stats unavailable";
		}
	}
}

loadGithubStats();

const nav = document.querySelector(".bottom-nav");
const indicator = document.querySelector(".bottom-nav__indicator");
const navItems = Array.from(document.querySelectorAll(".bottom-nav__item"));

if (nav && indicator && navItems.length) {
	const sections = navItems
		.map((item) => document.querySelector(item.getAttribute("href")))
		.filter(Boolean);

	const setActive = (item) => {
		navItems.forEach((i) => i.classList.remove("is-active"));
		item.classList.add("is-active");
		moveIndicator(item);
	};

	function moveIndicator(item) {
		const navRect = nav.getBoundingClientRect();
		const itemRect = item.getBoundingClientRect();
		indicator.style.width = `${itemRect.width}px`;
		indicator.style.transform = `translateX(${itemRect.left - navRect.left}px)`;
	}

	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					const match = navItems.find((i) => i.getAttribute("href") === `#${entry.target.id}`);
					if (match) {
						setActive(match);
					}
				}
			});
		},
		{ rootMargin: "-45% 0px -45% 0px", threshold: 0 }
	);

	sections.forEach((section) => observer.observe(section));

	navItems.forEach((item) => {
		item.addEventListener("click", () => setActive(item));
	});

	window.addEventListener("load", () => moveIndicator(navItems[0]));

	let resizeTimer;
	window.addEventListener("resize", () => {
		window.clearTimeout(resizeTimer);
		resizeTimer = window.setTimeout(() => {
			const active = navItems.find((i) => i.classList.contains("is-active")) || navItems[0];
			moveIndicator(active);
		}, 120);
	});
}
