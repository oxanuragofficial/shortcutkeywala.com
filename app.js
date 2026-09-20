// app.js - Main Application Logic with Proper Routing
// OS Selection only appears on Home page, after selection shows Apps page

// ==================== APPLICATION STATE ====================
let currentView = 'home';
let currentPlatform = null;
let currentAppId = null;
let currentShortcutSearch = '';
let currentShortcutCategoryFilter = 'all';
let currentShortcutSort = 'default';
let favorites = JSON.parse(localStorage.getItem('shortcutFavorites') || '[]');

// DOM Elements
const appRoot = document.getElementById('appRoot');
const mobileMenu = document.getElementById('mobileMenu');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
let cpActiveIndex = -1;
let cpResultsData = [];

// ==================== KEYCAP RENDERING ====================
// Turns a raw shortcut string like "Ctrl + Shift + P" or "Cmd + C" into
// individual keycap elements. Data already stores the correct platform-native
// key names (Windows shortcuts say "Ctrl", macOS shortcuts say "Cmd"), so this
// only handles presentation -- it does not invent or convert shortcuts.
const KEY_LABELS = {
    'ctrl': 'Ctrl', 'control': 'Ctrl',
    'cmd': '⌘ Cmd', 'command': '⌘ Cmd',
    'alt': 'Alt', 'option': '⌥ Option', 'opt': '⌥ Option',
    'shift': '⇧ Shift',
    'win': '⊞ Win', 'windows': '⊞ Win',
    'tab': '⇥ Tab',
    'enter': '↵ Enter', 'return': '↩ Return',
    'esc': '⎋ Esc', 'escape': '⎋ Esc',
    'backspace': '⌫ Backspace', 'delete': '⌦ Delete', 'del': '⌦ Delete',
    'space': 'Space', 'spacebar': 'Space',
    'up': '↑', 'down': '↓', 'left': '←', 'right': '→',
    'capslock': '⇪ Caps Lock'
};

function renderKeycaps(keysString, isMac = false) {
    if (!keysString) return '';
    const parts = keysString.split('+').map(k => k.trim()).filter(Boolean);
    return parts.map((part, i) => {
        let label;
        const lower = part.toLowerCase();
        if (isMac && (lower === 'ctrl' || lower === 'control')) {
            label = '⌃ Control';
        } else {
            label = KEY_LABELS[lower] || part;
        }
        const sep = i < parts.length - 1 ? '<span class="keycap-sep">+</span>' : '';
        return `<kbd class="keycap">${escapeHtml(label)}</kbd>${sep}`;
    }).join('');
}


document.addEventListener('DOMContentLoaded', () => {
    loadThemePreference();
    setupNavigation();
    setupCommandPalette();
    checkURLParameters();
    loadFavorites();
    updateFavNavCount();
    updateGlobalStats();
});

// Real browser Back/Forward support. Every navigation action already calls
// updateURL() (pushState), which changes the address bar but does nothing on
// its own -- without this listener, Chrome's Back/Forward buttons silently
// did nothing because no code ever responded to the popstate event.
// checkURLParameters() re-derives the correct view purely from the current
// URL, so it's reused here rather than tracking state separately.
window.addEventListener('popstate', () => {
    checkURLParameters();
});

// Fill in the header badge and footer stats with real, computed numbers
// (previously these were hardcoded and did not match the actual database)
function updateGlobalStats() {
    const apps = getAllApps();
    const totalShortcuts = apps.reduce((sum, app) => sum + app.shortcutCount, 0);
    const totalApps = apps.length;
    const platforms = new Set(apps.map(a => a.platform)).size;

    const badge = document.getElementById('headerBadge');
    if (badge) badge.textContent = `${totalShortcuts} Shortcuts`;

    const footerStats = document.getElementById('footerStats');
    if (footerStats) {
        footerStats.innerHTML = `<i class="fas fa-chart-line"></i> ${totalShortcuts} Shortcuts • ${totalApps} Apps • ${platforms} Platforms`;
    }
}

// Compute the real shortcut count for one platform (used by the home page,
// replacing numbers that used to be hardcoded and inaccurate)
function getPlatformShortcutCount(platform) {
    return getAllApps()
        .filter(app => app.platform === platform)
        .reduce((sum, app) => sum + app.shortcutCount, 0);
}

// ==================== COMMAND PALETTE (global search overlay) ====================
// Builds a flat searchable index once: every shortcut across every app, plus
// its app name/platform, so search can match on keys, action, description,
// app name, or category in one pass.
function buildSearchIndex() {
    const index = [];
    getAllApps().forEach(appMeta => {
        const app = SHORTCUTS_DB[appMeta.id];
        (app.shortcuts || []).forEach(s => {
            index.push({
                appId: appMeta.id,
                appName: app.name,
                platform: app.platform,
                keys: s.keys,
                action: s.action,
                description: s.description || '',
                category: s.category || ''
            });
        });
    });
    return index;
}

let cpPreviousFocus = null;

function openCommandPalette() {
    const backdrop = document.getElementById('cpBackdrop');
    const input = document.getElementById('cpInput');
    if (!backdrop || !input) return;
    cpPreviousFocus = document.activeElement;
    backdrop.hidden = false;
    input.value = '';
    cpActiveIndex = -1;
    renderCpResults('');
    setTimeout(() => input.focus(), 10);
}

function closeCommandPalette() {
    const backdrop = document.getElementById('cpBackdrop');
    const input = document.getElementById('cpInput');
    if (backdrop) backdrop.hidden = true;
    if (input) input.blur();
    if (cpPreviousFocus && typeof cpPreviousFocus.focus === 'function') {
        cpPreviousFocus.focus();
        cpPreviousFocus = null;
    }
}

function renderCpResults(query) {
    const resultsEl = document.getElementById('cpResults');
    if (!resultsEl) return;
    const q = query.trim().toLowerCase();

    if (!q) {
        resultsEl.innerHTML = `<div class="cp-empty">Start typing to search ${window.__searchIndex ? window.__searchIndex.length : ''} shortcuts…</div>`;
        cpResultsData = [];
        return;
    }

    const index = window.__searchIndex || (window.__searchIndex = buildSearchIndex());
    const qCollapsed = q.replace(/\s+/g, '');
    const matches = index.filter(item => {
        const haystack = `${item.keys} ${item.action} ${item.description} ${item.appName} ${item.category}`.toLowerCase();
        return haystack.includes(q) || haystack.replace(/\+/g, ' ').replace(/\s+/g, '').includes(qCollapsed);
    }).slice(0, 30);

    cpResultsData = matches;
    cpActiveIndex = matches.length ? 0 : -1;

    if (!matches.length) {
        resultsEl.innerHTML = `<div class="cp-empty">No shortcuts found for "${escapeHtml(query)}". Try a different term, like "copy" or "ctrl c".</div>`;
        return;
    }

    resultsEl.innerHTML = matches.map((m, i) => `
        <div class="cp-result-item${i === 0 ? ' active' : ''}" data-idx="${i}" role="option" aria-selected="${i === 0}">
            <div class="cp-result-main">
                <div class="shortcut-keys">${renderKeycaps(m.keys, m.platform === 'mac')}</div>
                <div class="cp-result-action">${escapeHtml(m.action)}</div>
                <div class="cp-result-meta">${escapeHtml(m.appName)} · ${escapeHtml(m.category || 'General')}</div>
            </div>
            <span class="cp-result-type">⌨ Shortcut</span>
        </div>
    `).join('');

    resultsEl.querySelectorAll('.cp-result-item').forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.idx, 10);
            openCpResult(idx);
        });
    });
}

function updateCpActiveHighlight() {
    const resultsEl = document.getElementById('cpResults');
    if (!resultsEl) return;
    resultsEl.querySelectorAll('.cp-result-item').forEach((el, i) => {
        el.classList.toggle('active', i === cpActiveIndex);
        el.setAttribute('aria-selected', i === cpActiveIndex ? 'true' : 'false');
        if (i === cpActiveIndex) el.scrollIntoView({ block: 'nearest' });
    });
}

function openCpResult(idx) {
    const item = cpResultsData[idx];
    if (!item) return;
    closeCommandPalette();
    currentAppId = item.appId;
    currentView = 'app-detail';
    renderAppDetail();
    updateURL('app-detail');
}

function setupCommandPalette() {
    const trigger = document.getElementById('navSearchTrigger');
    const mobileTrigger = document.getElementById('mobileSearchTrigger');
    const backdrop = document.getElementById('cpBackdrop');
    const input = document.getElementById('cpInput');
    const closeBtn = document.getElementById('cpClose');

    trigger?.addEventListener('click', openCommandPalette);
    mobileTrigger?.addEventListener('click', () => { closeMobileMenu(); openCommandPalette(); });
    closeBtn?.addEventListener('click', closeCommandPalette);
    backdrop?.addEventListener('click', (e) => { if (e.target === backdrop) closeCommandPalette(); });

    input?.addEventListener('input', (e) => renderCpResults(e.target.value));

    input?.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (cpResultsData.length) { cpActiveIndex = (cpActiveIndex + 1) % cpResultsData.length; updateCpActiveHighlight(); }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (cpResultsData.length) { cpActiveIndex = (cpActiveIndex - 1 + cpResultsData.length) % cpResultsData.length; updateCpActiveHighlight(); }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (cpActiveIndex >= 0) openCpResult(cpActiveIndex);
        } else if (e.key === 'Escape') {
            closeCommandPalette();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            e.preventDefault();
            openCommandPalette();
        } else if (e.key === 'Escape') {
            const backdropEl = document.getElementById('cpBackdrop');
            if (backdropEl && !backdropEl.hidden) closeCommandPalette();
        }
    });
}

// Check URL parameters for direct navigation
function checkURLParameters() {
    const hash = window.location.hash.replace(/^#\/?/, '');
    const [routePath, routeQuery = ''] = hash.split('?');
    const route = routePath || '';
    const params = new URLSearchParams(routeQuery || window.location.search.replace(/^\?/, ''));
    const parts = route.split('/').filter(Boolean);
    const platform = parts[0];
    const section = parts[1];
    const appId = parts[2];

    if (route === 'favorites' || params.get('view') === 'favorites') {
        renderFavoritesView();
    } else if (platform && section === 'os-shortcuts') {
        renderOSShortcuts(platform, params.get('search') || '');
    } else if (platform && section === 'terminal') {
        renderTerminalCommands(platform, params.get('search') || '');
    } else if (platform && section === 'applications' && appId) {
        currentPlatform = platform;
        currentAppId = appId;
        renderAppDetail(params.get('search') || '');
    } else if (platform && section === 'applications') {
        renderApplications(platform, params.get('search') || '');
    } else if (route === 'applications') {
        renderApplications(null, params.get('search') || '');
    } else if (platform && !section) {
        renderOSLanding(platform);
    } else if (params.get('app')) {
        currentAppId = params.get('app');
        renderAppDetail();
    } else if (params.get('search') !== null) {
        renderAllShortcutsWithSearch(params.get('search'));
    } else {
        renderHome();
    }
}

// Theme Management
function loadThemePreference() {
    // Migrate the old key once, so existing users' choice isn't silently reset.
    const oldKey = localStorage.getItem('theme');
    if (oldKey && !localStorage.getItem('shortcutkeywala-theme')) {
        localStorage.setItem('shortcutkeywala-theme', oldKey);
    }
    const savedTheme = localStorage.getItem('shortcutkeywala-theme');
    // Default to LIGHT for first-time visitors -- only use dark if the user
    // has explicitly chosen it before.
    if (savedTheme !== 'dark') {
        document.body.classList.add('light');
    }
    updateThemeButtons();
}

function toggleTheme() {
    document.body.classList.toggle('light');
    const isLight = document.body.classList.contains('light');
    localStorage.setItem('shortcutkeywala-theme', isLight ? 'light' : 'dark');
    updateThemeButtons();
}

// Updates every theme toggle button (header + footer share the .theme-btn
// class) to show the action it performs, not the current state -- e.g. while
// light mode is active, the button offers to switch to dark.
function updateThemeButtons() {
    const isLight = document.body.classList.contains('light');
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.innerHTML = isLight ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
        btn.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
        btn.setAttribute('title', isLight ? 'Dark Mode' : 'Light Mode');
    });
}

// Favorites Management
function loadFavorites() {
    favorites = JSON.parse(localStorage.getItem('shortcutFavorites') || '[]');
}

function saveFavorites() {
    localStorage.setItem('shortcutFavorites', JSON.stringify(favorites));
}

function toggleFavorite(appId, shortcutKey) {
    const favKey = `${appId}_${shortcutKey}`;
    const index = favorites.indexOf(favKey);
    if (index === -1) {
        favorites.push(favKey);
        showTooltip('⭐ Added to favorites!');
    } else {
        favorites.splice(index, 1);
        showTooltip('🗑️ Removed from favorites');
    }
    saveFavorites();
    return index === -1;
}

function isFavorite(appId, shortcutKey) {
    return favorites.includes(`${appId}_${shortcutKey}`);
}

// Navigation Setup
function setupNavigation() {
    // Logo/brand -- always returns to Home, from any view
    document.getElementById('logoHome')?.addEventListener('click', () => {
        closeMobileMenu();
        renderHome();
        updateURL('home');
    });

    // Desktop navigation
    document.getElementById('homeNav')?.addEventListener('click', (e) => {
        e.preventDefault();
        closeMobileMenu();
        renderHome();
        updateURL('home');
    });
    
    document.getElementById('appsNav')?.addEventListener('click', (e) => {
        e.preventDefault();
        closeMobileMenu();
        renderApplications();
        updateURL('applications');
    });
    
    document.getElementById('allShortcutsNav')?.addEventListener('click', (e) => {
        e.preventDefault();
        closeMobileMenu();
        renderAllShortcuts();
        updateURL('all-shortcuts');
    });

    document.getElementById('favoritesNav')?.addEventListener('click', (e) => {
        e.preventDefault();
        closeMobileMenu();
        renderFavoritesView();
        updateURL('favorites');
    });
    
    // Mobile navigation
    document.getElementById('mobileHomeNav')?.addEventListener('click', (e) => {
        e.preventDefault();
        closeMobileMenu();
        renderHome();
        updateURL('home');
    });
    
    document.getElementById('mobileAppsNav')?.addEventListener('click', (e) => {
        e.preventDefault();
        closeMobileMenu();
        renderApplications();
        updateURL('applications');
    });
    
    document.getElementById('mobileAllShortcutsNav')?.addEventListener('click', (e) => {
        e.preventDefault();
        closeMobileMenu();
        renderAllShortcuts();
        updateURL('all-shortcuts');
    });

    document.getElementById('mobileFavoritesNav')?.addEventListener('click', (e) => {
        e.preventDefault();
        closeMobileMenu();
        renderFavoritesView();
        updateURL('favorites');
    });
    
    // Footer navigation
    document.getElementById('footerHome')?.addEventListener('click', (e) => {
        e.preventDefault();
        renderHome();
        updateURL('home');
    });
    
    document.getElementById('footerApps')?.addEventListener('click', (e) => {
        e.preventDefault();
        renderApplications();
        updateURL('applications');
    });
    
    document.getElementById('footerShortcuts')?.addEventListener('click', (e) => {
        e.preventDefault();
        renderAllShortcuts();
        updateURL('all-shortcuts');
    });
    
    // Theme toggle
    document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
    
    // Mobile menu toggle
    mobileMenuBtn?.addEventListener('click', () => {
        mobileMenu.classList.toggle('active');
    });
}

function closeMobileMenu() {
    mobileMenu.classList.remove('active');
}

function updateFavNavCount() {
    const badge = document.getElementById('navFavCount');
    if (!badge) return;
    if (favorites.length > 0) {
        badge.textContent = favorites.length;
        badge.hidden = false;
    } else {
        badge.hidden = true;
    }
}

function renderFavoritesView() {
    currentView = 'favorites';
    document.title = 'My Favorite Shortcuts | ShortcutKeyWala';

    const favShortcuts = [];
    favorites.forEach(favKey => {
        const sepIdx = favKey.indexOf('_');
        const appId = favKey.slice(0, sepIdx);
        const key = favKey.slice(sepIdx + 1);
        const app = SHORTCUTS_DB[appId];
        if (!app) return;
        const shortcut = (app.shortcuts || []).find(s => s.keys === key);
        if (shortcut) favShortcuts.push({ ...shortcut, appId, appName: app.name });
    });

    appRoot.innerHTML = `
        <div class="fade-in">
            <div class="all-shortcuts-header">
                <h1><i class="fas fa-star"></i> My Favorite Shortcuts</h1>
                <p>${favShortcuts.length} shortcut${favShortcuts.length === 1 ? '' : 's'} saved on this device</p>
            </div>
            ${favShortcuts.length === 0 ? `
                <div class="empty-state">
                    <i class="far fa-star"></i>
                    <p>No favorites yet</p>
                    <small>Tap the star on any shortcut to save it here. Favorites are stored only in this browser.</small>
                </div>
            ` : `
                <div class="shortcuts-container">
                    ${favShortcuts.map((s, idx) => buildShortcutCardHTML(s, s.appId, idx, s.appName)).join('')}
                </div>
            `}
        </div>
    `;

    wireShortcutCardEvents(appRoot);
    // Favorite toggling from this view also needs to re-render the list
    // itself (so an un-favorited shortcut disappears immediately), which the
    // shared wiring doesn't do on its own since other views just update the
    // one button in place.
    appRoot.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setTimeout(() => renderFavoritesView(), 0);
        });
    });
}

function updateURL(view, param = null) {
    const routes = {
        home: '#/',
        'os-landing': `#/${param || currentPlatform}`,
        'os-shortcuts': `#/${param || currentPlatform}/os-shortcuts`,
        terminal: `#/${param || currentPlatform}/terminal`,
        applications: param || currentPlatform ? `#/${param || currentPlatform}/applications` : '#/applications',
        'app-detail': `#/${currentPlatform || 'windows'}/applications/${currentAppId}`,
        'all-shortcuts': '#/all-shortcuts',
        favorites: '#/favorites'
    };
    const nextRoute = routes[view];
    if (nextRoute && window.location.hash !== nextRoute) {
        window.history.pushState({}, '', nextRoute);
    }
}

function updateRouteSearch(value) {
    if (!window.location.hash) return;
    const [path, query = ''] = window.location.hash.slice(1).split('?');
    const params = new URLSearchParams(query);
    if (value) params.set('search', value);
    else params.delete('search');
    const nextHash = `#${path}${params.toString() ? `?${params.toString()}` : ''}`;
    if (window.location.hash !== nextHash) window.history.replaceState({}, '', nextHash);
}

// Tooltip
function showTooltip(message, duration = 2000) {
    const existingTooltip = document.querySelector('.tooltip');
    if (existingTooltip) existingTooltip.remove();
    
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.innerHTML = `<i class="fas fa-info-circle"></i> ${message}`;
    document.body.appendChild(tooltip);
    setTimeout(() => tooltip.remove(), duration);
}

// Escape HTML
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ==================== RENDER FUNCTIONS ====================

// HOME PAGE - Shows OS Selection only
function renderHome() {
    currentView = 'home';
    currentPlatform = null;
    
    const totalShortcuts = getAllApps().reduce((sum, app) => sum + (app.shortcutCount || 0), 0);
    const windowsCount = getPlatformShortcutCount('windows');
    const macCount = getPlatformShortcutCount('mac');
    const linuxCount = getPlatformShortcutCount('linux');

    document.title = `ShortcutKeyWala – Master ${totalShortcuts} Keyboard Shortcuts`;

    appRoot.innerHTML = `
        <div class="hero fade-in">
            <h1>⌨️ ShortcutKeyWala – Master Every Keyboard Shortcut</h1>
            <p>Boost your productivity with <strong>${totalShortcuts} keyboard shortcuts</strong> across Windows, macOS, and Linux</p>
            <div class="hero-stats">
                <div class="stat-card"><i class="fab fa-windows"></i> ${windowsCount} Windows Shortcuts</div>
                <div class="stat-card"><i class="fab fa-apple"></i> ${macCount} macOS Shortcuts</div>
                <div class="stat-card"><i class="fab fa-linux"></i> ${linuxCount} Linux Shortcuts</div>
                <div class="stat-card"><i class="fas fa-keyboard"></i> ${totalShortcuts} Total Shortcuts</div>
            </div>
        </div>
        
        <div class="os-grid">
            <div class="os-card windows" data-platform="windows" tabindex="0" role="button" aria-label="Browse Windows shortcuts">
                <i class="fab fa-windows"></i>
                <h3>Windows</h3>
                <p>Complete Windows shortcuts + Microsoft Office, Adobe, VS Code & more</p>
                <div class="shortcut-count"><i class="fas fa-keyboard"></i> ${windowsCount} shortcuts</div>
            </div>
            <div class="os-card mac" data-platform="mac" tabindex="0" role="button" aria-label="Browse macOS shortcuts">
                <i class="fab fa-apple"></i>
                <h3>macOS</h3>
                <p>Mac keyboard mastery + Finder, Safari, and app shortcuts</p>
                <div class="shortcut-count"><i class="fas fa-keyboard"></i> ${macCount} shortcuts</div>
            </div>
            <div class="os-card linux" data-platform="linux" tabindex="0" role="button" aria-label="Browse Linux shortcuts">
                <i class="fab fa-linux"></i>
                <h3>Linux / Ubuntu</h3>
                <p>Ubuntu, GNOME desktop, and terminal keyboard shortcuts</p>
                <div class="shortcut-count"><i class="fas fa-keyboard"></i> ${linuxCount} shortcuts</div>
            </div>
        </div>
        
        <div class="featured-section" style="max-width: 1000px; margin: 2rem auto; padding: 0 2rem;">
            <h2 style="text-align: center; margin-bottom: 1.5rem; color: var(--accent-cyan);">Most Popular Shortcuts</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 0.8rem;">
                <div class="shortcut-preview" data-shortcut="Ctrl + C" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 0.75rem; padding: 0.8rem 1rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                    <span style="font-family: monospace; color: var(--accent-cyan); font-weight: bold;">Ctrl + C</span>
                    <span style="color: var(--text-secondary);">Copy</span>
                    <i class="fas fa-copy" style="color: var(--text-muted);"></i>
                </div>
                <div class="shortcut-preview" data-shortcut="Ctrl + V" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 0.75rem; padding: 0.8rem 1rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                    <span style="font-family: monospace; color: var(--accent-cyan); font-weight: bold;">Ctrl + V</span>
                    <span style="color: var(--text-secondary);">Paste</span>
                    <i class="fas fa-copy" style="color: var(--text-muted);"></i>
                </div>
                <div class="shortcut-preview" data-shortcut="Ctrl + Z" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 0.75rem; padding: 0.8rem 1rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                    <span style="font-family: monospace; color: var(--accent-cyan); font-weight: bold;">Ctrl + Z</span>
                    <span style="color: var(--text-secondary);">Undo</span>
                    <i class="fas fa-copy" style="color: var(--text-muted);"></i>
                </div>
                <div class="shortcut-preview" data-shortcut="Alt + Tab" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 0.75rem; padding: 0.8rem 1rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                    <span style="font-family: monospace; color: var(--accent-cyan); font-weight: bold;">Alt + Tab</span>
                    <span style="color: var(--text-secondary);">Switch Apps</span>
                    <i class="fas fa-copy" style="color: var(--text-muted);"></i>
                </div>
            </div>
        </div>
    `;
    
    // OS cards open the selected platform's three-section landing page.
    document.querySelectorAll('.os-card[data-platform]').forEach(card => {
        const activate = () => {
            renderOSLanding(card.dataset.platform);
            updateURL('os-landing', card.dataset.platform);
        };
        card.addEventListener('click', activate);
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
        });
    });

    // Add shortcut preview copy handlers
    document.querySelectorAll('.shortcut-preview').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const shortcut = item.dataset.shortcut;
            navigator.clipboard.writeText(shortcut);
            const icon = item.querySelector('.fa-copy');
            const originalClass = icon.className;
            icon.className = 'fas fa-check';
            setTimeout(() => {
                icon.className = originalClass;
            }, 1500);
            showTooltip(`📋 Copied: ${shortcut}`);
        });
    });
}

// OS LANDING PAGE
function renderOSLanding(platform) {
    const platformNames = { windows: 'Windows', mac: 'macOS', linux: 'Linux' };
    const platformName = platformNames[platform];
    if (!platformName) return renderHome();
    currentPlatform = platform;
    currentView = 'os-landing';
    document.title = `${platformName} Shortcuts | ShortcutKeyWala`;
    const appCount = getApplications(platform).length;
    appRoot.innerHTML = `
        <div class="fade-in os-landing">
            <button class="back-btn" id="backToHomeFromLanding" type="button"><i class="fas fa-arrow-left"></i> Back to Home</button>
            <div class="page-heading"><h1>${escapeHtml(platformName)}</h1><p>Choose what you want to explore.</p></div>
            <div class="os-section-grid">
                <div class="os-section-card" data-section="os-shortcuts" tabindex="0" role="button"><i class="fas fa-keyboard"></i><h2>OS Shortcut Keys</h2><p>${getOSShortcuts(platform).length} native ${escapeHtml(platformName)} shortcuts</p></div>
                <div class="os-section-card" data-section="terminal" tabindex="0" role="button"><i class="fas fa-terminal"></i><h2>Terminal Commands</h2><p>Commands for the ${escapeHtml(platformName)} terminal</p></div>
                <div class="os-section-card" data-section="applications" tabindex="0" role="button"><i class="fas fa-th-large"></i><h2>Applications</h2><p>${appCount} supported application${appCount === 1 ? '' : 's'}</p></div>
            </div>
        </div>`;
    document.getElementById('backToHomeFromLanding')?.addEventListener('click', () => { renderHome(); updateURL('home'); });
    appRoot.querySelectorAll('.os-section-card').forEach(card => {
        const activate = () => {
            const section = card.dataset.section;
            if (section === 'os-shortcuts') renderOSShortcuts(platform);
            else if (section === 'terminal') renderTerminalCommands(platform);
            else renderApplications(platform);
            updateURL(section === 'os-shortcuts' ? 'os-shortcuts' : section, platform);
        };
        card.addEventListener('click', activate);
        card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
    });
}

// APP DETAIL PAGE
function renderAppDetail(initialSearch = '') {
    const app = getAppById(currentAppId);
    if (!app) {
        renderApplications();
        return;
    }
    
    currentView = 'app-detail';
    const shortcuts = app.shortcuts || [];
    currentShortcutCategoryFilter = 'all';
    currentShortcutSort = 'default';
    currentShortcutSearch = initialSearch;

    document.title = `${app.name} Keyboard Shortcuts - Complete Guide | ShortcutKeyWala`;
    
    appRoot.innerHTML = `
        <div class="fade-in">
            <div class="back-btn" id="backToApps">
                <i class="fas fa-arrow-left"></i> Back to Apps
            </div>
            
            <div style="text-align: center; margin-bottom: 2rem;">
                <i class="${app.icon || 'fas fa-apps'}" style="font-size: 3rem; color: var(--accent-cyan);"></i>
                <h1 style="font-size: 2.5rem; margin-top: 0.5rem;">${escapeHtml(app.name)} Keyboard Shortcuts</h1>
                <p style="color: var(--text-secondary);">${escapeHtml(app.description || 'Master keyboard shortcuts to work faster and smarter')}</p>
                <div class="stats" style="justify-content: center;">
                    <div class="stat-badge"><i class="fas fa-keyboard"></i> ${shortcuts.length} shortcuts</div>
                    <div class="stat-badge"><i class="fas fa-tag"></i> ${getAppCategory(app.id)}</div>
                </div>
            </div>
            
            <div class="search-box" style="margin-bottom: 1rem;">
                <i class="fas fa-search"></i>
                <input type="text" id="shortcutSearch" placeholder="Search shortcuts by key, action, or description..." value="${escapeHtml(currentShortcutSearch)}" autocomplete="off">
            </div>

            <div id="shortcutsToolbar"></div>
            <div id="shortcutsContainer"></div>
        </div>
    `;
    
    document.getElementById('backToApps')?.addEventListener('click', () => {
        renderApplications(currentPlatform);
        updateURL('applications', currentPlatform);
    });
    
    const shortcutSearch = document.getElementById('shortcutSearch');
    shortcutSearch?.addEventListener('input', (e) => {
        currentShortcutSearch = e.target.value;
        renderShortcutsList(shortcuts);
        updateRouteSearch(currentShortcutSearch);
    });
    
    renderShortcutsList(shortcuts);
}

// Apps suitable for the "Applications" browse list -- excludes the three
// pure-OS entries (windows_os/macos/linux_ubuntu), which are reached via the
// Windows/macOS/Linux home-page options instead. Derived from existing data,
// nothing hardcoded or invented.
function getApplications(platform = null) {
    const OS_APP_IDS = ['windows_os', 'macos', 'linux_ubuntu'];
    return getAllApps().filter(app => !OS_APP_IDS.includes(app.id) && (!platform || app.platform === platform));
}

// Flattens every shortcut across every app for a given platform into one
// list, each tagged with its source app, for the direct OS shortcut view.
function getOSShortcuts(platform) {
    const list = [];
    const OS_APP_IDS = { windows: 'windows_os', mac: 'macos', linux: 'linux_ubuntu' };
    const appMeta = getAllApps().find(app => app.id === OS_APP_IDS[platform]);
    if (appMeta) {
        const full = SHORTCUTS_DB[appMeta.id];
        (full.shortcuts || []).forEach(s => {
            list.push({ ...s, appId: appMeta.id, appName: full.name });
        });
    }
    return list;
}

// OS SHORTCUTS PAGE -- shows all shortcuts for a platform directly, with one
// search box. No intermediate app-category browsing step.
let currentOSSearch = '';

function renderOSShortcuts(platform, initialSearch = '') {
    currentView = 'os-shortcuts';
    currentPlatform = platform;
    currentOSSearch = initialSearch;

    const platformNames = { windows: 'Windows', mac: 'macOS', linux: 'Linux/Ubuntu' };
    const platformName = platformNames[platform] || platform;
    const allShortcuts = getOSShortcuts(platform);

    document.title = `${platformName} Keyboard Shortcuts - ${allShortcuts.length} Shortcuts | ShortcutKeyWala`;

    appRoot.innerHTML = `
        <div class="fade-in">
            <div class="back-btn" id="backToHomeFromOS">
                <i class="fas fa-arrow-left"></i> Back to Home
            </div>
            <div style="text-align: center; margin-bottom: 2rem;">
                <h1 style="font-size: 2.5rem; margin-top: 0.5rem;">${escapeHtml(platformName)} Shortcuts</h1>
                <p style="color: var(--text-secondary);">${allShortcuts.length} keyboard shortcuts for ${escapeHtml(platformName)}</p>
            </div>
            <div class="search-box" style="margin-bottom: 1rem;">
                <i class="fas fa-search"></i>
                <input type="text" id="osShortcutSearch" placeholder="Search ${escapeHtml(platformName)} shortcuts..." value="${escapeHtml(currentOSSearch)}" autocomplete="off">
            </div>
            <div id="osShortcutsContainer"></div>
        </div>
    `;

    document.getElementById('backToHomeFromOS')?.addEventListener('click', () => {
        renderOSLanding(platform);
        updateURL('os-landing', platform);
    });

    const searchInput = document.getElementById('osShortcutSearch');
    searchInput?.addEventListener('input', (e) => {
        currentOSSearch = e.target.value;
        renderOSShortcutResults(allShortcuts);
        updateRouteSearch(currentOSSearch);
    });

    renderOSShortcutResults(allShortcuts);
}

function renderOSShortcutResults(allShortcuts) {
    const container = document.getElementById('osShortcutsContainer');
    if (!container) return;

    let filtered = allShortcuts;
    if (currentOSSearch) {
        const q = currentOSSearch.toLowerCase();
        filtered = allShortcuts.filter(s =>
            s.keys.toLowerCase().includes(q) ||
            s.action.toLowerCase().includes(q) ||
            (s.description && s.description.toLowerCase().includes(q)) ||
            (s.category && s.category.toLowerCase().includes(q)) ||
            s.appName.toLowerCase().includes(q)
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <p>No shortcuts match your search</p>
                <small>Try a different term</small>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <p class="result-count">${filtered.length} of ${allShortcuts.length} shortcut${allShortcuts.length === 1 ? '' : 's'}</p>
        <div class="shortcuts-container">
            ${filtered.map((s, idx) => buildShortcutCardHTML(s, s.appId, idx, s.appName)).join('')}
        </div>
    `;

    wireShortcutCardEvents(container);
}

// TERMINAL COMMANDS PAGE -- intentionally separate from keyboard shortcuts
let currentTerminalSearch = '';

function renderTerminalCommands(platform, initialSearch = '') {
    const platformNames = { windows: 'Windows', mac: 'macOS', linux: 'Linux' };
    const platformName = platformNames[platform];
    if (!platformName) return renderHome();
    currentPlatform = platform;
    currentView = 'terminal';
    currentTerminalSearch = initialSearch;
    const commands = (window.TERMINAL_COMMANDS || []).filter(command => command.platform === platform);
    document.title = `${platformName} Terminal Commands | ShortcutKeyWala`;
    appRoot.innerHTML = `
        <div class="fade-in">
            <button class="back-btn" id="backToLandingFromTerminal" type="button"><i class="fas fa-arrow-left"></i> Back to ${escapeHtml(platformName)}</button>
            <div class="page-heading"><h1>${escapeHtml(platformName)} Terminal Commands</h1><p>Commands are listed only for the selected platform.</p></div>
            <div class="search-box" style="margin-bottom: 1rem;"><i class="fas fa-search"></i><input type="text" id="terminalSearch" placeholder="Search command name, text, or description..." value="${escapeHtml(currentTerminalSearch)}" autocomplete="off"></div>
            <div id="terminalCommandsContainer"></div>
        </div>`;
    document.getElementById('backToLandingFromTerminal')?.addEventListener('click', () => { renderOSLanding(platform); updateURL('os-landing', platform); });
    document.getElementById('terminalSearch')?.addEventListener('input', event => {
        currentTerminalSearch = event.target.value;
        updateRouteSearch(currentTerminalSearch);
        renderTerminalResults(commands, platformName);
    });
    renderTerminalResults(commands, platformName);
}

function renderTerminalResults(commands, platformName) {
    const container = document.getElementById('terminalCommandsContainer');
    if (!container) return;
    const query = currentTerminalSearch.trim().toLowerCase();
    const filtered = query ? commands.filter(command => `${command.name} ${command.command} ${command.description} ${command.usage}`.toLowerCase().includes(query)) : commands;
    if (!filtered.length) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-terminal"></i><p>No ${escapeHtml(platformName)} terminal commands match your search</p><small>Try a command name, shell keyword, or description.</small></div>`;
        return;
    }
    container.innerHTML = `<p class="result-count">${filtered.length} of ${commands.length} command${commands.length === 1 ? '' : 's'}</p><div class="command-list">${filtered.map(command => `
        <article class="shortcut-card terminal-command-card">
            <code class="terminal-command-text">${escapeHtml(command.command)}</code>
            <h2 class="terminal-command-name">${escapeHtml(command.name)}</h2>
            <div class="terminal-command-details">
                <p class="terminal-command-description">${escapeHtml(command.description)}</p>
                <small class="terminal-command-usage">Example: <code>${escapeHtml(command.usage)}</code></small>
            </div>
            <span class="terminal-command-shell">${escapeHtml(command.shell)}</span>
        </article>`).join('')}</div>`;
}

// APPLICATIONS LIST PAGE -- browse shortcuts by application
let currentAppsSearch = '';

function renderApplications(platform = null, initialSearch = '') {
    currentView = 'applications';
    currentPlatform = platform;
    currentAppsSearch = initialSearch;
    const apps = getApplications(platform);
    const platformNames = { windows: 'Windows', mac: 'macOS', linux: 'Linux' };
    const backLabel = platform ? `Back to ${platformNames[platform] || platform}` : 'Back to Home';

    document.title = `Browse Applications | ShortcutKeyWala`;

    appRoot.innerHTML = `
        <div class="fade-in">
            <button class="back-btn" id="backToHomeFromApps" type="button">
                <i class="fas fa-arrow-left"></i> ${escapeHtml(backLabel)}
            </button>
            <div style="text-align: center; margin-bottom: 2rem;">
                <h1 style="font-size: 2.5rem; margin-top: 0.5rem;">Applications</h1>
                <p style="color: var(--text-secondary);">Browse keyboard shortcuts by application</p>
            </div>
            <div class="search-box" style="margin-bottom: 1rem;">
                <i class="fas fa-search"></i>
                <input type="text" id="applicationSearch" placeholder="Search applications..." value="${escapeHtml(currentAppsSearch)}" autocomplete="off">
            </div>
            <div id="applicationsContainer"></div>
        </div>
    `;

    document.getElementById('backToHomeFromApps')?.addEventListener('click', () => {
        if (currentPlatform) {
            renderOSLanding(currentPlatform);
            updateURL('os-landing', currentPlatform);
        } else {
            renderHome();
            updateURL('home');
        }
    });

    const searchInput = document.getElementById('applicationSearch');
    searchInput?.addEventListener('input', (e) => {
        currentAppsSearch = e.target.value;
        renderApplicationsResults(apps);
        updateRouteSearch(currentAppsSearch);
    });

    renderApplicationsResults(apps);
}

function renderApplicationsResults(apps) {
    const container = document.getElementById('applicationsContainer');
    if (!container) return;

    let filtered = apps;
    if (currentAppsSearch) {
        const q = currentAppsSearch.toLowerCase();
        filtered = apps.filter(app => app.name.toLowerCase().includes(q));
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas ${apps.length ? 'fa-search' : 'fa-th-large'}"></i>
                <p>${apps.length ? 'No applications match your search' : 'No supported applications for this OS yet'}</p>
                <small>${apps.length ? 'Try a different term' : 'Application shortcuts will appear here when supported data is available.'}</small>
                ${apps.length ? '<button class="clear-all-btn" id="appsEmptyClear" style="margin-top:1rem;">Clear search</button>' : ''}
            </div>
        `;
        document.getElementById('appsEmptyClear')?.addEventListener('click', () => {
            currentAppsSearch = '';
            const input = document.getElementById('applicationSearch');
            if (input) input.value = '';
            renderApplicationsResults(apps);
        });
        return;
    }

    container.innerHTML = `
        <div class="apps-grid">
            ${filtered.map(app => `
                <div class="app-card" data-app-id="${app.id}" tabindex="0" role="button" aria-label="View ${escapeHtml(app.name)} shortcuts">
                    <i class="${app.icon || 'fas fa-apps'}" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
                    <h3>${escapeHtml(app.name)}</h3>
                    <div class="shortcut-count"><i class="fas fa-keyboard"></i> ${app.shortcutCount} shortcuts</div>
                </div>
            `).join('')}
        </div>
    `;

    container.querySelectorAll('.app-card').forEach(card => {
        const activate = () => {
            currentAppId = card.dataset.appId;
            currentShortcutSearch = '';
            renderAppDetail();
            updateURL('app-detail');
        };
        card.addEventListener('click', activate);
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
        });
    });
}

function renderShortcutsList(shortcuts) {

    const container = document.getElementById('shortcutsContainer');
    if (!container) return;

    let filteredShortcuts = shortcuts;
    if (currentShortcutSearch) {
        const searchLower = currentShortcutSearch.toLowerCase();
        filteredShortcuts = filteredShortcuts.filter(shortcut =>
            shortcut.keys.toLowerCase().includes(searchLower) ||
            shortcut.action.toLowerCase().includes(searchLower) ||
            (shortcut.description && shortcut.description.toLowerCase().includes(searchLower)) ||
            (shortcut.category && shortcut.category.toLowerCase().includes(searchLower))
        );
    }
    if (currentShortcutCategoryFilter !== 'all') {
        filteredShortcuts = filteredShortcuts.filter(s => (s.category || 'General') === currentShortcutCategoryFilter);
    }

    filteredShortcuts = sortShortcuts(filteredShortcuts, currentShortcutSort);

    // Toolbar: category chips + sort + active filter state (built once per shortcut set)
    const allCategories = ['all', ...new Set(shortcuts.map(s => s.category || 'General'))];
    const toolbarEl = document.getElementById('shortcutsToolbar');
    if (toolbarEl) {
        const activeCount = (currentShortcutCategoryFilter !== 'all' ? 1 : 0) + (currentShortcutSearch ? 1 : 0);
        toolbarEl.innerHTML = `
            <button class="mobile-filter-trigger" id="mobileFilterTrigger">
                <i class="fas fa-sliders-h"></i> Filters & Sort ${activeCount ? `(${activeCount})` : ''}
            </button>
            <div class="filter-toolbar filter-bar-inline">
                <div class="filter-chip-group">
                    ${allCategories.map(c => `
                        <button class="filter-chip cat-chip ${currentShortcutCategoryFilter === c ? 'active' : ''}" data-cat="${escapeHtml(c)}">
                            ${c === 'all' ? 'All categories' : escapeHtml(c)}
                        </button>
                    `).join('')}
                </div>
                <select class="sort-select" id="shortcutSortSelect" aria-label="Sort shortcuts">
                    <option value="default" ${currentShortcutSort === 'default' ? 'selected' : ''}>Most useful</option>
                    <option value="alpha" ${currentShortcutSort === 'alpha' ? 'selected' : ''}>Alphabetical</option>
                    <option value="category" ${currentShortcutSort === 'category' ? 'selected' : ''}>By category</option>
                </select>
            </div>
            ${currentShortcutCategoryFilter !== 'all' || currentShortcutSearch ? `
                <div class="active-filters-bar">
                    <span>Active filters:</span>
                    ${currentShortcutCategoryFilter !== 'all' ? `<span class="active-filter-pill">${escapeHtml(currentShortcutCategoryFilter)}<button data-clear="cat">×</button></span>` : ''}
                    ${currentShortcutSearch ? `<span class="active-filter-pill">"${escapeHtml(currentShortcutSearch)}"<button data-clear="search">×</button></span>` : ''}
                    <button class="clear-all-btn" id="clearAllShortcutFilters">Clear all</button>
                </div>
            ` : ''}
            <p class="result-count">${filteredShortcuts.length} of ${shortcuts.length} shortcut${shortcuts.length === 1 ? '' : 's'}</p>
        `;

        toolbarEl.querySelectorAll('.cat-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                currentShortcutCategoryFilter = btn.dataset.cat;
                renderShortcutsList(shortcuts);
            });
        });
        const sortSelect = document.getElementById('shortcutSortSelect');
        sortSelect?.addEventListener('change', (e) => {
            currentShortcutSort = e.target.value;
            renderShortcutsList(shortcuts);
        });
        toolbarEl.querySelectorAll('[data-clear]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.dataset.clear === 'cat') currentShortcutCategoryFilter = 'all';
                if (btn.dataset.clear === 'search') currentShortcutSearch = '';
                renderShortcutsList(shortcuts);
            });
        });
        document.getElementById('clearAllShortcutFilters')?.addEventListener('click', () => {
            currentShortcutCategoryFilter = 'all';
            currentShortcutSearch = '';
            const searchInput = document.getElementById('shortcutSearch');
            if (searchInput) searchInput.value = '';
            renderShortcutsList(shortcuts);
        });

        document.getElementById('mobileFilterTrigger')?.addEventListener('click', () => {
            openFilterDrawer(allCategories, shortcuts);
        });
    }

    if (filteredShortcuts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <p>No shortcuts match your filters</p>
                <small>Try clearing the category filter or searching a different term</small>
            </div>
        `;
        return;
    }

    // New focal card: keycaps + action are the primary, always-visible content.
    // Description/use-case/tips are secondary and live behind a lightweight toggle.
    container.innerHTML = `
        <div class="shortcuts-container">
            ${filteredShortcuts.map((shortcut, idx) =>
                buildShortcutCardHTML(shortcut, currentAppId, idx, shortcut.os_specific)
            ).join('')}
        </div>
    `;

    wireShortcutCardEvents(container);
}

// Builds one shortcut card's HTML. metaExtra is the secondary text shown
// after the category (e.g. "Windows" for a per-app view, or the app name
// like "Excel" for the flattened OS view) -- everything else is identical,
// so both views share this single template instead of duplicating it.
function buildShortcutCardHTML(shortcut, appId, idx, metaExtra) {
    const faved = isFavorite(appId, shortcut.keys);
    const isMac = SHORTCUTS_DB[appId] && SHORTCUTS_DB[appId].platform === 'mac';
    const label = `${shortcut.action}, ${shortcut.keys}. Press to view details.`;
    return `
        <div class="shortcut-card" data-shortcut-idx="${idx}" tabindex="0" role="button" aria-expanded="false" aria-label="${escapeHtml(label)}">
            <div class="shortcut-card-main">
                <div class="shortcut-keys">${renderKeycaps(shortcut.keys, isMac)}</div>
                <p class="shortcut-action">${escapeHtml(shortcut.action)}</p>
                <div class="shortcut-meta">
                    <span>${escapeHtml(shortcut.category || 'General')}</span>
                    ${metaExtra ? `<span class="dot">·</span><span>${escapeHtml(metaExtra)}</span>` : ''}
                </div>
            </div>
            <div class="shortcut-card-actions">
                <button class="favorite-btn ${faved ? 'active' : ''}" type="button" data-app-id="${appId}" data-shortcut-key="${escapeHtml(shortcut.keys)}" aria-pressed="${faved}" aria-label="${faved ? 'Remove from favorites' : 'Add to favorites'}">
                    <i class="${faved ? 'fas' : 'far'} fa-star"></i>
                </button>
            </div>
            <div class="shortcut-expand">
                <div class="expand-content">
                    <p><strong>📘 Description:</strong> ${escapeHtml(shortcut.description || 'Increase productivity with this shortcut')}</p>
                    <p><strong>🎯 Use Case:</strong> ${escapeHtml(shortcut.useCase || 'Common workflow accelerator')}</p>
                    <p><strong>💡 Pro Tip:</strong> ${escapeHtml(shortcut.tips || 'Practice regularly to build muscle memory')}</p>
                </div>
            </div>
        </div>
    `;
}

// Wires favorite/details/copy interactions for every .shortcut-card inside
// a container -- shared by every view that renders shortcut cards.
function wireShortcutCardEvents(container) {
    container.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Prevent the click from bubbling to the card's own click handler,
            // which would otherwise also toggle the details panel open/closed.
            e.stopPropagation();
            toggleFavorite(btn.dataset.appId, btn.dataset.shortcutKey);
            const nowFaved = isFavorite(btn.dataset.appId, btn.dataset.shortcutKey);
            btn.classList.toggle('active', nowFaved);
            btn.setAttribute('aria-pressed', String(nowFaved));
            btn.setAttribute('aria-label', nowFaved ? 'Remove from favorites' : 'Add to favorites');
            btn.querySelector('i').className = nowFaved ? 'fas fa-star' : 'far fa-star';
            updateFavNavCount();
        });
    });

    // The entire card is the expand/collapse trigger (per the redesign --
    // there's no separate "Details" button anymore). Works with mouse, touch,
    // and keyboard (Enter/Space), since the card itself is a focusable
    // role="button" element.
    container.querySelectorAll('.shortcut-card').forEach(card => {
        const expandDiv = card.querySelector('.shortcut-expand');
        const toggleExpand = () => {
            const isOpen = expandDiv.classList.toggle('open');
            card.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        };

        card.addEventListener('click', toggleExpand);
        card.addEventListener('keydown', (e) => {
            if ((e.key === 'Enter' || e.key === ' ') && e.target === card) {
                e.preventDefault();
                toggleExpand();
            }
        });
    });
}

function openFilterDrawer(allCategories, shortcuts) {
    const backdrop = document.getElementById('filterDrawerBackdrop');
    const body = document.getElementById('filterDrawerBody');
    if (!backdrop || !body) return;

    body.innerHTML = `
        <h4>Category</h4>
        <div class="filter-chip-group">
            ${allCategories.map(c => `
                <button class="filter-chip drawer-cat-chip ${currentShortcutCategoryFilter === c ? 'active' : ''}" data-cat="${escapeHtml(c)}">
                    ${c === 'all' ? 'All categories' : escapeHtml(c)}
                </button>
            `).join('')}
        </div>
        <h4>Sort by</h4>
        <div class="filter-chip-group">
            <button class="filter-chip drawer-sort-chip ${currentShortcutSort === 'default' ? 'active' : ''}" data-sort="default">Most useful</button>
            <button class="filter-chip drawer-sort-chip ${currentShortcutSort === 'alpha' ? 'active' : ''}" data-sort="alpha">Alphabetical</button>
            <button class="filter-chip drawer-sort-chip ${currentShortcutSort === 'category' ? 'active' : ''}" data-sort="category">By category</button>
        </div>
    `;

    body.querySelectorAll('.drawer-cat-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            currentShortcutCategoryFilter = btn.dataset.cat;
            body.querySelectorAll('.drawer-cat-chip').forEach(b => b.classList.toggle('active', b === btn));
        });
    });
    body.querySelectorAll('.drawer-sort-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            currentShortcutSort = btn.dataset.sort;
            body.querySelectorAll('.drawer-sort-chip').forEach(b => b.classList.toggle('active', b === btn));
        });
    });

    backdrop.hidden = false;

    const applyBtn = document.getElementById('filterDrawerApply');
    const closeBtn = document.getElementById('filterDrawerClose');
    const closeDrawer = () => { backdrop.hidden = true; };
    const applyAndClose = () => { closeDrawer(); renderShortcutsList(shortcuts); };

    // Replace nodes to avoid stacking duplicate listeners across repeated opens
    const newApply = applyBtn.cloneNode(true);
    applyBtn.replaceWith(newApply);
    newApply.addEventListener('click', applyAndClose);

    const newClose = closeBtn.cloneNode(true);
    closeBtn.replaceWith(newClose);
    newClose.addEventListener('click', closeDrawer);

    backdrop.onclick = (e) => { if (e.target === backdrop) closeDrawer(); };

    const escHandler = (e) => {
        if (e.key === 'Escape' && !backdrop.hidden) {
            closeDrawer();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

function sortShortcuts(shortcuts, sortMode) {
    const list = [...shortcuts];
    if (sortMode === 'alpha') {
        list.sort((a, b) => a.action.localeCompare(b.action));
    } else if (sortMode === 'category') {
        list.sort((a, b) => (a.category || 'General').localeCompare(b.category || 'General'));
    }
    // 'default' preserves the curated data order ("most useful" first, as authored)
    return list;
}

// ALL SHORTCUTS PAGE
function renderAllShortcuts() {
    currentView = 'all-shortcuts';
    
    const totalApps = getAllApps().length;
    const totalShortcuts = getAllApps().reduce((sum, app) => sum + (app.shortcutCount || 0), 0);
    const windowsCount = getPlatformShortcutCount('windows');
    const macCount = getPlatformShortcutCount('mac');
    const linuxCount = getPlatformShortcutCount('linux');

    document.title = `All Keyboard Shortcuts - Search ${totalShortcuts} Shortcuts | ShortcutKeyWala`;

    const platforms = [
        { id: 'windows', name: 'Windows', icon: 'fab fa-windows' },
        { id: 'mac', name: 'macOS', icon: 'fab fa-apple' },
        { id: 'linux', name: 'Linux', icon: 'fab fa-linux' }
    ];
    
    appRoot.innerHTML = `
        <div class="fade-in">
            <div class="all-shortcuts-header">
                <h1><i class="fas fa-globe"></i> All Keyboard Shortcuts</h1>
                <p>Search across ${totalShortcuts} shortcuts from all platforms and applications</p>
                <div class="stats">
                    <div class="stat-badge"><i class="fab fa-windows"></i> Windows: ${windowsCount}</div>
                    <div class="stat-badge"><i class="fab fa-apple"></i> macOS: ${macCount}</div>
                    <div class="stat-badge"><i class="fab fa-linux"></i> Linux: ${linuxCount}</div>
                    <div class="stat-badge"><i class="fas fa-apps"></i> Apps: ${totalApps}</div>
                    <div class="stat-badge"><i class="fas fa-keyboard"></i> Total: ${totalShortcuts}</div>
                </div>
            </div>
            
            <div class="search-box" style="margin-bottom: 2rem;">
                <i class="fas fa-search"></i>
                <input type="text" id="globalShortcutSearch" placeholder="Search any shortcut (e.g., 'Ctrl+C', 'copy', 'save', 'screenshot', 'Cmd+Tab')..." autocomplete="off">
            </div>
            
            <div id="globalSearchResults"></div>
        </div>
    `;
    
    const searchInput = document.getElementById('globalShortcutSearch');
    searchInput?.addEventListener('input', (e) => {
        performGlobalSearch(e.target.value);
    });
    
    // Initial empty state
    const resultsContainer = document.getElementById('globalSearchResults');
    if (resultsContainer) {
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-keyboard"></i>
                <p>Start typing to search across ${getAllApps().reduce((sum, app) => sum + app.shortcutCount, 0)} shortcuts</p>
                <small>Try: "Ctrl+C", "save", "screenshot", "undo", "Cmd+Tab", "Alt+F4"</small>
            </div>
        `;
    }
}

function renderAllShortcutsWithSearch(searchTerm) {
    renderAllShortcuts();
    setTimeout(() => {
        const searchInput = document.getElementById('globalShortcutSearch');
        if (searchInput) {
            searchInput.value = searchTerm;
            performGlobalSearch(searchTerm);
        }
    }, 100);
}

function performGlobalSearch(query) {
    const resultsContainer = document.getElementById('globalSearchResults');
    if (!resultsContainer) return;
    
    if (query.length < 2) {
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-keyboard"></i>
                <p>Type at least 2 characters to search shortcuts</p>
                <small>Example: "Ctrl+C", "save", "screenshot", "undo"</small>
            </div>
        `;
        return;
    }
    
    const searchResults = searchShortcuts(query, null);
    
    if (searchResults.length === 0) {
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <p>No shortcuts found for "${escapeHtml(query)}"</p>
                <small>Try searching for: copy, paste, save, undo, find, replace</small>
            </div>
        `;
        return;
    }
    
    let resultsHtml = `<div style="margin-bottom: 1rem; color: var(--text-secondary);">Found ${searchResults.reduce((sum, r) => sum + r.shortcuts.length, 0)} shortcuts for "${escapeHtml(query)}"</div>`;
    
    searchResults.forEach(result => {
        resultsHtml += `
            <div style="margin-bottom: 2rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap;">
                    <i class="${result.appIcon || 'fas fa-apps'}" style="font-size: 1.5rem; color: var(--accent-cyan);"></i>
                    <h3 style="font-size: 1.5rem;">${escapeHtml(result.appName)}</h3>
                    <span class="stat-badge">${result.shortcuts.length} shortcuts</span>
                </div>
                <div class="shortcuts-container">
                    ${result.shortcuts.map((shortcut, idx) => buildShortcutCardHTML(shortcut, result.appId, idx, null)).join('')}
                </div>
            </div>
        `;
    });
    
    resultsContainer.innerHTML = resultsHtml;
    wireShortcutCardEvents(resultsContainer);
}

// Helper Functions
function getPlatformIcon(platform) {
    const icons = { windows: 'fab fa-windows', mac: 'fab fa-apple', linux: 'fab fa-linux' };
    return icons[platform] || 'fas fa-desktop';
}