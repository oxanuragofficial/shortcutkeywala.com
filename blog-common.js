// blog-common.js
// Shared behavior for blog listing + article pages, which intentionally do NOT
// load the full app.js/data.js stack (they have no shortcut database to search
// or filter). This keeps just two things consistent with the main app:
// 1) the light/dark theme choice, and 2) the keycap visual treatment for any
// element with class="shortcut-keys" containing "+"-separated key names.

(function () {
    // Sync theme with the main site. Migrate the old key once so an existing
    // user's choice isn't silently reset.
    var oldKey = localStorage.getItem('theme');
    if (oldKey && !localStorage.getItem('shortcutkeywala-theme')) {
        localStorage.setItem('shortcutkeywala-theme', oldKey);
    }
    var savedTheme = localStorage.getItem('shortcutkeywala-theme');
    // Default to LIGHT for first-time visitors -- only dark if explicitly saved.
    if (savedTheme !== 'dark') {
        document.body.classList.add('light');
    }

    function updateThemeButtons() {
        var isLight = document.body.classList.contains('light');
        document.querySelectorAll('.theme-btn').forEach(function (btn) {
            btn.innerHTML = isLight ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
            btn.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
            btn.setAttribute('title', isLight ? 'Dark Mode' : 'Light Mode');
        });
    }
    updateThemeButtons();

    document.querySelectorAll('.theme-btn').forEach(function (themeBtn) {
        themeBtn.addEventListener('click', function () {
            document.body.classList.toggle('light');
            var isLight = document.body.classList.contains('light');
            localStorage.setItem('shortcutkeywala-theme', isLight ? 'light' : 'dark');
            updateThemeButtons();
        });
    });

    // Turn "Ctrl + Shift + P"-style text into individual keycap elements,
    // matching the main app's keycap component.
    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    document.querySelectorAll('.shortcut-keys').forEach(function (el) {
        var raw = el.textContent.trim();
        if (!raw) return;
        var parts = raw.split('+').map(function (k) { return k.trim(); }).filter(Boolean);
        el.innerHTML = parts.map(function (part, i) {
            var sep = i < parts.length - 1 ? '<span class="keycap-sep">+</span>' : '';
            return '<kbd class="keycap">' + escapeHtml(part) + '</kbd>' + sep;
        }).join('');
    });

    // Blog listing page: tag filter (only present on blog.html)
    var tagBar = document.getElementById('tagFilterBar');
    if (tagBar) {
        var cards = document.querySelectorAll('.blog-card');
        tagBar.querySelectorAll('button').forEach(function (btn) {
            btn.addEventListener('click', function () {
                tagBar.querySelectorAll('button').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                var tag = btn.dataset.tag;
                cards.forEach(function (card) {
                    card.style.display = (tag === 'all' || card.dataset.tag === tag) ? '' : 'none';
                });
            });
        });
    }

    // Article pages: related articles + prev/next navigation.
    // Single shared list here avoids maintaining the same links in 6 files.
    var ARTICLES = [
        { url: 'blog-windows-11-shortcuts.html', title: 'Windows 11 Shortcuts', tag: 'windows' },
        { url: 'blog-top-50-excel-shortcuts.html', title: 'Top 50 Excel Shortcuts', tag: 'excel' },
        { url: 'blog-outlook-productivity-guide.html', title: 'Outlook Productivity Guide', tag: 'outlook' },
        { url: 'blog-vs-code-shortcuts-guide.html', title: 'VS Code Shortcuts Guide', tag: 'vscode' },
        { url: 'blog-macos-shortcuts-cheatsheet.html', title: 'macOS Shortcuts Cheatsheet', tag: 'macos' },
        { url: 'blog-photoshop-shortcuts-mastery.html', title: 'Photoshop Shortcuts Mastery', tag: 'design' }
    ];
    var articleRoot = document.getElementById('relatedArticles');
    if (articleRoot) {
        var currentFile = location.pathname.split('/').pop();
        var idx = ARTICLES.findIndex(function (a) { return a.url === currentFile; });
        if (idx !== -1) {
            var others = ARTICLES.filter(function (a, i) { return i !== idx; });
            var related = others.slice(0, 3);
            var prev = idx > 0 ? ARTICLES[idx - 1] : null;
            var next = idx < ARTICLES.length - 1 ? ARTICLES[idx + 1] : null;

            var html = '<h2>Related Guides</h2><div class="related-articles-grid">' +
                related.map(function (a) {
                    return '<a href="' + a.url + '" class="related-article-card">' + escapeHtml(a.title) + ' <i class="fas fa-arrow-right"></i></a>';
                }).join('') + '</div>';

            html += '<div class="article-prev-next">' +
                (prev ? '<a href="' + prev.url + '"><i class="fas fa-arrow-left"></i> ' + escapeHtml(prev.title) + '</a>' : '<span></span>') +
                (next ? '<a href="' + next.url + '">' + escapeHtml(next.title) + ' <i class="fas fa-arrow-right"></i></a>' : '<span></span>') +
                '</div>';

            articleRoot.innerHTML = html;
        }
    }
    // Article pages: Table of Contents, derived from real h2 headings.
    // Uses native <details>/<summary> for free keyboard support and mobile
    // collapsibility, rather than a custom widget.
    var articleBody = document.querySelector('.post-container');
    if (articleBody) {
        var headings = Array.prototype.slice.call(articleBody.querySelectorAll('h2'));
        // Skip short articles where a TOC adds no value.
        if (headings.length >= 3) {
            var usedIds = {};
            function slugify(text) {
                return text.toLowerCase()
                    .replace(/[^\w\s-]/g, '')
                    .trim()
                    .replace(/\s+/g, '-') || 'section';
            }
            var items = headings.map(function (h) {
                var base = slugify(h.textContent);
                var id = base;
                var n = 2;
                while (usedIds[id]) { id = base + '-' + n; n++; }
                usedIds[id] = true;
                h.id = id;
                h.setAttribute('tabindex', '-1'); // focusable programmatically, not via Tab
                return { id: id, text: h.textContent.trim() };
            });

            var toc = document.createElement('details');
            toc.className = 'toc';
            toc.open = true;
            toc.innerHTML = '<summary>📑 In this article</summary>' +
                '<nav aria-label="Table of contents"><ol>' +
                items.map(function (it) {
                    return '<li><a href="#' + it.id + '">' + escapeHtml(it.text) + '</a></li>';
                }).join('') +
                '</ol></nav>';

            var postHeader = articleBody.querySelector('.post-header');
            if (postHeader && postHeader.nextSibling) {
                postHeader.parentNode.insertBefore(toc, postHeader.nextSibling);
            }

            // Focus the target heading after jumping, so keyboard/screen-reader
            // users land somewhere meaningful (anchors alone don't move DOM focus).
            toc.querySelectorAll('a').forEach(function (link) {
                link.addEventListener('click', function () {
                    var target = document.getElementById(link.getAttribute('href').slice(1));
                    if (target) setTimeout(function () { target.focus(); }, 300);
                });
            });

            // Highlight the current section while scrolling, using IntersectionObserver
            // (no scroll-event polling, no extra dependency).
            if ('IntersectionObserver' in window) {
                var tocLinks = toc.querySelectorAll('a');
                var observer = new IntersectionObserver(function (entries) {
                    entries.forEach(function (entry) {
                        var link = toc.querySelector('a[href="#' + entry.target.id + '"]');
                        if (!link) return;
                        if (entry.isIntersecting) {
                            tocLinks.forEach(function (l) { l.classList.remove('active'); });
                            link.classList.add('active');
                        }
                    });
                }, { rootMargin: '-20% 0px -70% 0px' });
                headings.forEach(function (h) { observer.observe(h); });
            }
        }
    }
})();
