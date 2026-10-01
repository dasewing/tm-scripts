// ==UserScript==
// @name         CLM torrent library
// @namespace    https://github.com/dasewing/tm-scripts
// @version      1.6.1
// @description  Manage CLM torrents and send magnets to PikPak cloud download.
// @author       David
// @match        https://www.clmclm.com/search-*
// @match        https://www.clmclm.com/hash/*.html
// @match        https://mypikpak.com/drive/all*
// @updateURL    https://raw.githubusercontent.com/dasewing/tm-scripts/main/scripts/clm-torrent-library.user.js
// @downloadURL  https://raw.githubusercontent.com/dasewing/tm-scripts/main/scripts/clm-torrent-library.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const STORE_KEY = 'clm-torrent-library-v1';
    const SHARED_STORE_KEY = 'clm-torrent-library-shared-v1';
    const MIGRATION_KEY = 'clm-torrent-library-local-migrated-v1';
    const IS_PIKPAK = location.hostname === 'mypikpak.com';
    const IS_SEARCH = !IS_PIKPAK && /^\/search-.*\.html$/i.test(location.pathname);
    const DETAIL_PATH = /^\/hash\/([a-f\d]{40})\.html$/i;
    const HASH_LINK_SELECTOR = 'a.zsky-result-name[href*="/hash/"], a[href*="/hash/"]';
    const STYLE_ID = 'clm-torrent-library-style';
    const HIDDEN_CLASS = 'clm-library-hidden';
    const MODAL_OPEN_CLASS = 'clm-library-modal-open';

    const state = {
        records: loadRecords(),
        showHidden: localStorage.getItem(`${STORE_KEY}:show-hidden`) === '1',
        observer: null,
        scanQueued: false,
        modalFilter: IS_PIKPAK ? 'all' : 'visited',
        sort: 'recent',
    };

    function loadRecords() {
        let shared = {};
        let sharedAvailable = false;
        try {
            const parsed = GM_getValue(SHARED_STORE_KEY, {});
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) shared = parsed;
            sharedAvailable = true;
        } catch (_) {
            // Local storage remains available on CLM if the manager API fails.
        }
        if (IS_PIKPAK) return shared;
        try {
            const legacy = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
            if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) return shared;
            if (!sharedAvailable) return legacy;
            if (!GM_getValue(MIGRATION_KEY, false)) {
                shared = { ...legacy, ...shared };
                GM_setValue(SHARED_STORE_KEY, shared);
                GM_setValue(MIGRATION_KEY, true);
            }
            return shared;
        } catch (_) { return sharedAvailable ? shared : {}; }
    }

    function saveRecords() {
        try { GM_setValue(SHARED_STORE_KEY, state.records); } catch (_) { /* legacy fallback */ }
        if (!IS_PIKPAK) localStorage.setItem(STORE_KEY, JSON.stringify(state.records));
    }

    function getHash(value = location.pathname) {
        const match = String(value).match(/\/hash\/([a-f\d]{40})(?:\.html)?/i)
            || String(value).match(/\b([a-f\d]{40})\b/i);
        return match ? match[1].toLowerCase() : '';
    }

    function getRecord(hash, defaults = {}) {
        if (!hash) return null;
        if (!state.records[hash]) {
            state.records[hash] = {
                hash,
                name: '',
                size: '',
                magnet: '',
                clicks: 0,
                lastVisited: '',
                starred: false,
                note: '',
                hidden: false,
            };
        }
        Object.assign(state.records[hash], defaults);
        return state.records[hash];
    }

    function formatTime(value) {
        if (!value) return '暂无访问记录';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '暂无访问记录';
        return date.toLocaleString('zh-CN', { hour12: false });
    }

    function escapeHTML(value) {
        return String(value).replace(/[&<>"']/g, (char) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        })[char]);
    }

    function addStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .${HIDDEN_CLASS} { display: none !important; }
            .${MODAL_OPEN_CLASS} .clm-library-badge { display:none !important; }
            .clm-library-badge { display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin:6px 0; padding:6px 8px; border:1px solid #dbe4f0; border-radius:6px; background:#f5f8fc; color:#334155; font:12px/1.5 system-ui,sans-serif; }
            .clm-library-badge button { border:0; padding:2px 0 !important; overflow-wrap:anywhere; white-space:pre-wrap; text-align:left; color:#475569; background:transparent; cursor:pointer; font:inherit; }
            .clm-library-badge button:hover { color:#2563eb; }
            .clm-library-badge .clm-library-action { border-radius:4px; padding:2px 7px !important; color:#1e293b; background:#e2e8f0; }
            .clm-library-badge .clm-library-action.is-starred { color:#b45309; background:#fef3c7; }
            .clm-detail-actions { display:inline-flex; flex-wrap:wrap; align-items:center; gap:6px; margin:6px 0; vertical-align:middle; }
            .clm-detail-actions button { border:0; border-radius:4px; padding:5px 9px; background:#e2e8f0; color:#1e293b; cursor:pointer; font:inherit; }
            .clm-library-note-button { max-width:100%; padding:2px 0 !important; overflow-wrap:anywhere; white-space:pre-wrap; text-align:left; color:#475569 !important; background:transparent !important; }
            .clm-library-control, .clm-library-modal button, .clm-library-modal select { font:inherit; }
            .clm-library-control { position:fixed; z-index:2147483000; left:16px; bottom:16px; display:flex; gap:8px; }
            .clm-library-control button { border:0; border-radius:8px; padding:10px 13px; color:#fff; background:#243b53; box-shadow:0 3px 12px #0003; cursor:pointer; }
            .clm-library-control button:hover { background:#102a43; }
            .clm-library-modal-backdrop { position:fixed; z-index:2147483001; inset:0; display:flex; align-items:center; justify-content:center; padding:20px; background:#0f172a88; }
            .clm-library-modal { display:flex; flex-direction:column; width:calc(100vw - 40px); max-width:${IS_PIKPAK ? '300rem' : '120rem'}; max-height:calc(100vh - 40px); overflow:hidden; border-radius:12px; background:#fff; color:#172033; box-shadow:0 18px 60px #0004; font:14px/1.5 system-ui,sans-serif; }
            .clm-library-modal header, .clm-library-modal footer { display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:12px 16px; border-bottom:1px solid #e5e7eb; }
            .clm-library-modal footer { border-top:1px solid #e5e7eb; border-bottom:0; }
            .clm-library-modal h2 { flex:1; margin:0; font-size:18px; }
            .clm-library-modal input[type="search"] { flex:1; min-width:160px; padding:7px 9px; border:1px solid #cbd5e1; border-radius:6px; }
            .clm-library-modal select { padding:7px 9px; border:1px solid #cbd5e1; border-radius:6px; background:#fff; }
            .clm-library-modal button { padding:7px 10px; border:0; border-radius:6px; background:#e2e8f0; color:#172033; cursor:pointer; }
            .clm-library-modal button.primary { color:#fff; background:#2563eb; }
            .clm-library-table-wrap { flex:1; min-height:0; overflow:auto; padding:0 16px; }
            .clm-library-table { width:100%; border-collapse:collapse; text-align:left; }
            .clm-library-table th, .clm-library-table td { padding:9px 10px; border-bottom:1px solid #edf0f4; vertical-align:middle; }
            .clm-library-table th { position:sticky; top:0; z-index:1; background:#f8fafc; color:#64748b; font-size:12px; font-weight:600; }
            .clm-library-table tbody tr:hover { background:#f8fafc; }
            .clm-library-table .select-cell { width:38px; text-align:center; }
            .clm-library-table .name-cell { min-width:280px; }
            .clm-library-name { display:inline; color:#172033; font-weight:600; text-decoration:none; overflow-wrap:anywhere; }
            .clm-library-name:hover { color:#2563eb; }
            .clm-library-modal .clm-library-note-button { display:inline-block; margin-left:8px; font-size:12px; font-weight:400; vertical-align:baseline; }
            .clm-library-table .actions-cell { width:${IS_PIKPAK ? '264px' : '220px'}; text-align:center; white-space:nowrap; }
            .clm-library-pikpak-pick { display:inline-flex; align-items:center; justify-content:center; margin:8px; padding:7px 10px; border:0; border-radius:6px; background:#2563eb; color:#fff; cursor:pointer; font:13px system-ui,sans-serif; }
            .clm-library-icon-btn { display:inline-flex; align-items:center; justify-content:center; vertical-align:middle; width:36px !important; height:36px !important; margin:0 2px; padding:0 !important; line-height:1; text-align:center; background:transparent !important; color:#64748b !important; }
            .clm-library-icon-btn:hover { color:#2563eb !important; background:#eff6ff !important; }
            .clm-library-icon-btn.danger:hover { color:#dc2626 !important; background:#fef2f2 !important; }
            .clm-library-icon-btn.is-active { color:#b45309 !important; }
            .clm-library-icon-btn.is-active svg { fill:currentColor !important; }
            .clm-library-icon-btn svg { display:block !important; flex:0 0 24px !important; box-sizing:border-box !important; width:24px !important; height:24px !important; min-width:24px !important; min-height:24px !important; max-width:24px !important; max-height:24px !important; transform:none !important; fill:none; stroke:currentColor !important; stroke-width:2.2 !important; stroke-linecap:round; stroke-linejoin:round; }
            .clm-library-icon-btn svg path, .clm-library-icon-btn svg rect { stroke:currentColor !important; stroke-width:2.2 !important; }
            .clm-library-empty { padding:28px 8px; color:#64748b; text-align:center; }
            @media (max-width:640px) { .clm-library-control { left:10px; bottom:10px; } .clm-library-control button { padding:9px 11px; } .clm-library-table { min-width:720px; } }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    function extractDetailName() {
        const selectors = ['.zsky-title', '.zsky-title-card h1', 'h1', '.torrent-name', '.title', '[itemprop="name"]'];
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            const text = element && (element.getAttribute('title') || element.textContent).trim();
            if (text) return text;
        }
        return document.title.replace(/\s*[-|｜].*$/, '').trim();
    }

    function extractSize(root = document) {
        const labeledFields = root.querySelectorAll('.zsky-info > div, .zsky-info-wide, .zsky-result-meta > span');
        for (const field of labeledFields) {
            const text = (field.textContent || '').replace(/\s+/g, ' ').trim();
            const match = text.match(/^(?:Resource size|Total size|Size|文件大小|种子大小|大小)\s*[:：]?\s*([\d.]+\s*(?:TB|GB|MB|KB|B))$/i);
            if (match) return match[1].replace(/\s+/g, '');
        }
        const text = root.textContent || '';
        const match = text.match(/(?:Resource size|Total size|文件大小|种子大小|大小|Size)\s*[:：]?\s*([\d.]+\s*(?:TB|GB|MB|KB|字节|B))/i);
        return match ? match[1].replace(/\s+/g, '') : '';
    }

    function extractMagnet() {
        const candidate = Array.from(document.querySelectorAll('a[href^="magnet:"]'))
            .map((link) => link.href)
            .find(Boolean);
        if (candidate) return candidate;

        const sources = [
            document.querySelector('#copyMagnetBtn'),
            ...document.querySelectorAll('[data-clipboard-text], [data-magnet], input, textarea'),
        ].filter(Boolean);
        for (const element of sources) {
            const values = [
                element.getAttribute('data-clipboard-text'),
                element.getAttribute('data-magnet'),
                element.getAttribute('value'),
                element.value,
                element.getAttribute('href'),
            ];
            const magnet = values.find((value) => value && value.startsWith('magnet:?'));
            if (magnet) return magnet;
        }
        const match = (document.body.textContent || '').match(/magnet:\?xt=urn:btih:[^\s"'<>]+/i);
        return match ? match[0] : '';
    }

    function detailRecord() {
        const hash = getHash();
        if (!hash) return null;
        return getRecord(hash, {
            name: extractDetailName(),
            size: extractSize(),
        });
    }

    function persistVisit(magnet = '') {
        const record = detailRecord();
        if (!record) return;
        record.name = extractDetailName() || record.name;
        record.size = extractSize() || record.size;
        record.magnet = magnet || extractMagnet() || record.magnet;
        record.clicks = (Number(record.clicks) || 0) + 1;
        record.lastVisited = new Date().toISOString();
        saveRecords();
        renderLibraryControls();
    }

    function saveMagnet(magnet) {
        if (!magnet || !/^magnet:\?xt=urn:btih:/i.test(magnet)) return;
        const record = detailRecord();
        if (record) {
            record.magnet = magnet.trim();
            saveRecords();
        }
    }

    function installCopyTracking(button) {
        let copyArmedUntil = 0;
        button.addEventListener('click', () => {
            copyArmedUntil = Date.now() + 2500;
            persistVisit();
            window.setTimeout(() => saveMagnet(extractMagnet()), 150);
        }, true);

        const clipboard = navigator.clipboard;
        if (clipboard && typeof clipboard.writeText === 'function' && !clipboard.__clmLibraryWrapped) {
            const originalWriteText = clipboard.writeText.bind(clipboard);
            try {
                clipboard.writeText = function (text) {
                    if (Date.now() < copyArmedUntil && typeof text === 'string') saveMagnet(text);
                    return originalWriteText(text);
                };
                Object.defineProperty(clipboard, '__clmLibraryWrapped', { value: true });
            } catch (_) {
                // The page's copy button still records the visit if Clipboard API is immutable.
            }
        }

        document.addEventListener('copy', (event) => {
            if (Date.now() >= copyArmedUntil) return;
            window.setTimeout(() => {
                const text = event.clipboardData && event.clipboardData.getData('text/plain');
                saveMagnet(text || extractMagnet());
            }, 0);
        }, true);
    }

    function installDetailActions() {
        const button = document.querySelector('#copyMagnetBtn');
        if (!button || button.dataset.clmLibraryReady) return;
        button.dataset.clmLibraryReady = '1';
        const record = detailRecord();

        const actions = document.createElement('span');
        actions.className = 'clm-detail-actions';
        actions.dataset.clmDetailActions = '1';

        const star = document.createElement('button');
        star.type = 'button';
        star.className = record && record.starred ? 'is-starred' : '';
        star.textContent = record && record.starred ? '★ 已收藏' : '☆ 收藏';
        star.addEventListener('click', () => {
            const current = detailRecord();
            current.starred = !current.starred;
            saveRecords();
            star.classList.toggle('is-starred', current.starred);
            star.textContent = current.starred ? '★ 已收藏' : '☆ 收藏';
            refreshSearchCards();
        });

        const note = document.createElement('button');
        note.type = 'button';
        note.className = 'clm-library-note-button';
        note.textContent = record && record.note ? `📝 ${record.note}` : '＋ 添加备注';
        note.addEventListener('click', () => {
            const current = detailRecord();
            const next = window.prompt('为这个种子添加备注（留空可清除）', current.note || '');
            if (next === null) return;
            current.note = next.trim();
            saveRecords();
            note.textContent = current.note ? `📝 ${current.note}` : '＋ 添加备注';
            refreshSearchCards();
        });

        actions.append(star, note);
        button.insertAdjacentElement('afterend', actions);
        installCopyTracking(button);
    }

    async function copyRecordMagnet(hash) {
        const record = state.records[hash] || getRecord(hash);
        const magnet = record.magnet || `magnet:?xt=urn:btih:${hash}`;
        try {
            await copyText(magnet);
            record.magnet = magnet;
            record.clicks = (Number(record.clicks) || 0) + 1;
            record.lastVisited = new Date().toISOString();
            saveRecords();
            refreshSearchCards();
            showToast(`已复制 Magnet · ${record.clicks} 次`);
        } catch (error) {
            showToast(`复制失败：${error.message}`);
        }
    }

    function findCard(link) {
        if (link.closest('.clm-library-modal-backdrop')) return null;
        const resultRow = link.closest('article.zsky-result-row');
        if (resultRow) return resultRow;
        let node = link.parentElement;
        let fallback = node;
        while (node && node !== document.body) {
            const matchingLinks = node.querySelectorAll(HASH_LINK_SELECTOR);
            if (matchingLinks.length > 1) break;
            fallback = node;
            if (matchingLinks.length === 1 && node !== link && node.textContent.trim().length > 20) {
                return node;
            }
            node = node.parentElement;
        }
        return fallback;
    }

    function decorateSearchResults() {
        const links = document.querySelectorAll(HASH_LINK_SELECTOR);
        links.forEach((link) => {
            if (link.closest('.clm-library-modal-backdrop')) return;
            const hash = getHash(link.getAttribute('href'));
            if (!hash) return;
            const card = findCard(link);
            if (!card || card === document.body) return;

            const record = getRecord(hash);
            const name = (link.getAttribute('title') || link.textContent || '').trim();
            if (name) record.name = name;
            record.size = extractSize(card) || record.size;

            if (record.hidden && !state.showHidden) {
                card.classList.add(HIDDEN_CLASS);
            } else {
                card.classList.remove(HIDDEN_CLASS);
            }

            const badgeHost = card.querySelector('.zsky-result-body') || card;
            let badge = badgeHost.querySelector(`:scope > [data-clm-library-hash="${hash}"]`);
            if (!badge) {
                badge = document.createElement('div');
                badge.className = 'clm-library-badge';
                badge.dataset.clmLibraryHash = hash;

                const info = document.createElement('span');
                info.dataset.clmInfo = '1';
                badge.appendChild(info);

                const copy = document.createElement('button');
                copy.type = 'button';
                copy.className = 'clm-library-action';
                copy.textContent = '复制 Magnet';
                copy.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    copyRecordMagnet(hash);
                });
                badge.appendChild(copy);

                const star = document.createElement('button');
                star.type = 'button';
                star.className = 'clm-library-action';
                star.dataset.clmStar = '1';
                star.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const current = state.records[hash];
                    current.starred = !current.starred;
                    saveRecords();
                    refreshSearchCards();
                });
                badge.appendChild(star);

                const hide = document.createElement('button');
                hide.type = 'button';
                hide.className = 'clm-library-action';
                hide.dataset.clmHide = '1';
                hide.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const current = state.records[hash];
                    current.hidden = !current.hidden;
                    saveRecords();
                    refreshSearchCards();
                });
                badge.appendChild(hide);

                const note = document.createElement('button');
                note.type = 'button';
                note.dataset.clmNote = '1';
                note.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const current = state.records[hash];
                    if (!current) return;
                    const next = window.prompt('为这个种子添加备注（留空可清除）', current.note || '');
                    if (next === null) return;
                    current.note = next.trim();
                    saveRecords();
                    refreshSearchCards();
                });
                badge.appendChild(note);
                badgeHost.appendChild(badge);
            }

            const info = badge.querySelector('[data-clm-info]');
            info.textContent = `${record.hidden ? '已隐藏 · ' : ''}${record.clicks > 0
                ? `已复制 ${record.clicks} 次 · ${formatTime(record.lastVisited)}`
                : '尚未复制'}`;
            const star = badge.querySelector('[data-clm-star]');
            star.textContent = record.starred ? '★ 已收藏' : '☆ 收藏';
            star.classList.toggle('is-starred', Boolean(record.starred));
            badge.querySelector('[data-clm-hide]').textContent = record.hidden ? '取消隐藏' : '隐藏';
            const note = badge.querySelector('[data-clm-note]');
            note.textContent = record.note ? `📝 ${record.note}` : '＋ 添加备注';
        });
        renderLibraryControls();
    }

    function refreshSearchCards() {
        document.querySelectorAll(HASH_LINK_SELECTOR).forEach((link) => {
            if (link.closest('.clm-library-modal-backdrop')) return;
            const hash = getHash(link.getAttribute('href'));
            if (!hash) return;
            const card = findCard(link);
            const record = state.records[hash];
            if (card && record && record.hidden && !state.showHidden) card.classList.add(HIDDEN_CLASS);
            else if (card) card.classList.remove(HIDDEN_CLASS);
        });
        if (IS_SEARCH) decorateSearchResults();
        renderModalIfOpen();
    }

    function getVisibleModalRecords() {
        const query = (document.querySelector('#clm-library-search')?.value || '').trim().toLowerCase();
        let entries = Object.values(state.records).filter((record) => record && record.hash
            && (record.clicks > 0 || record.starred || record.note || record.hidden));
        if (state.modalFilter === 'hidden') entries = entries.filter((record) => record.hidden);
        else entries = entries.filter((record) => !record.hidden);
        if (state.modalFilter === 'visited') entries = entries.filter((record) => record.clicks > 0);
        if (state.modalFilter === 'starred') entries = entries.filter((record) => record.starred);
        if (state.modalFilter === 'noted') entries = entries.filter((record) => Boolean(record.note));
        if (query) {
            entries = entries.filter((record) => `${record.name} ${record.hash} ${record.note}`.toLowerCase().includes(query));
        }
        entries.sort((a, b) => {
            if (state.sort === 'clicks') return (b.clicks || 0) - (a.clicks || 0);
            if (state.sort === 'name') return (a.name || a.hash).localeCompare(b.name || b.hash, 'zh-CN');
            if (state.sort === 'starred') return Number(b.starred) - Number(a.starred) || (b.clicks || 0) - (a.clicks || 0);
            return (Date.parse(b.lastVisited || '') || 0) - (Date.parse(a.lastVisited || '') || 0);
        });
        return entries;
    }

    function openDetailURL(hash) {
        return `https://www.clmclm.com/hash/${encodeURIComponent(hash)}.html`;
    }

    function copyText(value) {
        if (!value) return Promise.reject(new Error('没有可复制的内容'));
        if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(value);
        const area = document.createElement('textarea');
        area.value = value;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const success = document.execCommand('copy');
        area.remove();
        return success ? Promise.resolve() : Promise.reject(new Error('剪贴板写入失败'));
    }

    function recordMagnet(record) {
        return record.magnet || `magnet:?xt=urn:btih:${record.hash}`;
    }

    function isVisible(element) {
        return Boolean(element && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
    }

    function findPikPakTaskInput() {
        const nativeInput = document.querySelector('[role="dialog"][aria-label="创建云下载任务"] .cloud-download-textarea textarea');
        if (isVisible(nativeInput)) return { dialog: nativeInput.closest('[role="dialog"]'), input: nativeInput };
        const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"], [class*="modal" i], [class*="dialog" i]')).reverse();
        for (const dialog of dialogs) {
            if (dialog.closest('.clm-library-modal-backdrop') || !isVisible(dialog)) continue;
            const inputs = Array.from(dialog.querySelectorAll('textarea, input[type="text"], input:not([type]), [contenteditable="true"]'))
                .filter((input) => isVisible(input) && !input.closest('.clm-library-modal-backdrop'));
            if (!inputs.length) continue;
            const cloudTitle = /创建云下载任务|云下载|离线下载|cloud download|offline download|new task/i.test(dialog.textContent || '');
            const linkInput = inputs.find((input) => /磁链|链接|link|url|magnet|paste|粘贴/i.test(input.getAttribute('placeholder') || input.getAttribute('aria-label') || ''));
            if (cloudTitle && (linkInput || inputs.length === 1)) return { dialog, input: linkInput || inputs[0] };
        }
        return null;
    }

    function findPikPakTaskTrigger() {
        return Array.from(document.querySelectorAll('button, [role="button"]')).find((button) =>
            !button.closest('.clm-library-control, .clm-library-modal-backdrop')
            && isVisible(button)
            && /^(?:创建云下载任务|云下载|离线下载|cloud download|offline download|new task)$/i.test((button.textContent || button.getAttribute('aria-label') || '').trim()));
    }

    function waitForPikPakTaskInput(timeout = 2500) {
        return new Promise((resolve) => {
            const existing = findPikPakTaskInput();
            if (existing) { resolve(existing); return; }
            const observer = new MutationObserver(() => {
                const found = findPikPakTaskInput();
                if (!found) return;
                observer.disconnect();
                clearTimeout(timer);
                resolve(found);
            });
            observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
            const timer = setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
        });
    }

    function fillPikPakInput(input, value) {
        input.focus();
        if (input.isContentEditable) {
            input.textContent = value;
        } else {
            const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value);
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    async function sendToPikPak(records) {
        const magnets = records.map(recordMagnet);
        if (!magnets.length) { showToast('请先选择种子'); return; }
        closeModal();
        let task = findPikPakTaskInput();
        if (!task) {
            const trigger = findPikPakTaskTrigger();
            if (trigger) {
                trigger.click();
                task = await waitForPikPakTaskInput();
            }
        }
        if (task) {
            const existing = task.input.value.trim();
            const additions = magnets.filter((magnet) => !existing.split(/\r?\n/).includes(magnet));
            fillPikPakInput(task.input, [existing, ...additions].filter(Boolean).join('\n'));
            showToast(`已填入 ${additions.length} 条磁链，请确认创建`);
            return;
        }
        try {
            await copyText(magnets.join('\n'));
            showToast('已复制磁链，请打开 PikPak 云下载并粘贴');
        } catch (error) { showToast(`未找到云下载输入框，复制也失败：${error.message}`); }
    }

    function decoratePikPakTaskDialog() {
        const task = findPikPakTaskInput();
        if (!task || task.dialog.querySelector('.clm-library-pikpak-pick')) return;
        const picker = document.createElement('button');
        picker.type = 'button';
        picker.className = 'clm-library-pikpak-pick';
        picker.textContent = '从种子库选择';
        picker.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            openModal();
        });
        const host = task.input.closest('.cloud-download-textarea') || task.input;
        host.insertAdjacentElement('afterend', picker);
    }

    function schedulePikPakScan() {
        if (state.scanQueued) return;
        state.scanQueued = true;
        requestAnimationFrame(() => {
            state.scanQueued = false;
            decoratePikPakTaskDialog();
        });
    }

    function createIconButton(icon, label, onClick, danger = false) {
        const paths = {
            open: '<path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h6"/>',
            delete: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/>',
            close: '<path d="m6 6 12 12M18 6 6 18"/>',
            copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
            star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
            cloud: '<path d="M7 18a5 5 0 0 1-.4-10A6.5 6.5 0 0 1 19 9.5a4.3 4.3 0 0 1-.5 8.5H7Z"/><path d="M12 11v7m-3-3 3 3 3-3"/>',
            eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
            eyeOff: '<path d="M3 3 21 21M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-3.3 4.1M6.2 6.2C3.5 8.1 2 12 2 12s3.5 7 10 7a9.9 9.9 0 0 0 4-.8M10 10a3 3 0 0 0 4 4"/>',
        };
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `clm-library-icon-btn${danger ? ' danger' : ''}`;
        button.title = label;
        button.setAttribute('aria-label', label);
        button.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">${paths[icon]}</svg>`;
        button.addEventListener('click', onClick);
        return button;
    }

    function deleteRecords(hashes, confirmMessage = '') {
        const uniqueHashes = [...new Set(hashes)].filter((hash) => state.records[hash]);
        if (!uniqueHashes.length) {
            showToast('请先选择种子');
            return;
        }
        if (confirmMessage && !window.confirm(confirmMessage)) return;
        uniqueHashes.forEach((hash) => { delete state.records[hash]; });
        saveRecords();
        refreshSearchCards();
        showToast(`已删除 ${uniqueHashes.length} 条记录`);
    }

    function renderModalList(modal) {
        const tableBody = modal.querySelector('.clm-library-table-body');
        const records = getVisibleModalRecords();
        const checked = new Set(Array.from(modal.querySelectorAll('[data-clm-select]:checked')).map((input) => input.value));
        tableBody.replaceChildren();

        if (!records.length) {
            const row = document.createElement('tr');
            const empty = document.createElement('td');
            empty.className = 'clm-library-empty';
            empty.colSpan = 6;
            empty.textContent = '没有符合条件的种子记录';
            row.appendChild(empty);
            tableBody.appendChild(row);
            modal.querySelector('[data-clm-count]').textContent = '0 条';
            return;
        }

        records.forEach((record) => {
            const row = document.createElement('tr');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.dataset.clmSelect = '1';
            checkbox.value = record.hash;
            checkbox.checked = checked.has(record.hash);

            const selectCell = document.createElement('td');
            selectCell.className = 'select-cell';
            selectCell.appendChild(checkbox);

            const nameCell = document.createElement('td');
            nameCell.className = 'name-cell';
            const name = record.name || record.hash;
            const nameLink = document.createElement('a');
            nameLink.className = 'clm-library-name';
            nameLink.href = openDetailURL(record.hash);
            nameLink.target = '_blank';
            nameLink.rel = 'noopener noreferrer';
            nameLink.title = name;
            nameLink.textContent = `${record.hidden ? '已隐藏 · ' : ''}${record.starred ? '★ ' : ''}${name}`;
            nameCell.appendChild(nameLink);

            const note = document.createElement('button');
            note.type = 'button';
            note.className = 'clm-library-note-button';
            note.textContent = record.note ? `📝 ${record.note}` : '＋ 添加备注';
            note.addEventListener('click', () => {
                const current = state.records[record.hash];
                const next = window.prompt('为这个种子添加备注（留空可清除）', current.note || '');
                if (next === null) return;
                current.note = next.trim();
                saveRecords();
                refreshSearchCards();
                renderModalIfOpen();
            });
            nameCell.appendChild(note);

            const sizeCell = document.createElement('td');
            sizeCell.textContent = record.size || '未知';
            const clicksCell = document.createElement('td');
            clicksCell.textContent = `${record.clicks || 0}`;
            const visitedCell = document.createElement('td');
            visitedCell.textContent = formatTime(record.lastVisited);
            const actionsCell = document.createElement('td');
            actionsCell.className = 'actions-cell';
            actionsCell.appendChild(createIconButton('copy', '复制 Magnet', () => {
                copyRecordMagnet(record.hash);
            }));
            if (IS_PIKPAK) actionsCell.appendChild(createIconButton('cloud', '填入云下载任务', () => {
                sendToPikPak([record]);
            }));
            const starAction = createIconButton('star', record.starred ? '取消收藏' : '收藏', () => {
                const current = state.records[record.hash];
                current.starred = !current.starred;
                saveRecords();
                renderModalIfOpen();
            });
            if (record.starred) starAction.classList.add('is-active');
            actionsCell.appendChild(starAction);
            actionsCell.appendChild(createIconButton(record.hidden ? 'eye' : 'eyeOff', record.hidden ? '取消隐藏' : '隐藏', () => {
                const current = state.records[record.hash];
                current.hidden = !current.hidden;
                saveRecords();
                refreshSearchCards();
            }));
            actionsCell.appendChild(createIconButton('open', '打开详情', () => {
                window.open(openDetailURL(record.hash), '_blank', 'noopener,noreferrer');
            }));
            actionsCell.appendChild(createIconButton('delete', '删除记录', () => {
                deleteRecords([record.hash], `从种子库删除「${record.name || record.hash}」？`);
                renderModalIfOpen();
            }, true));

            row.append(selectCell, nameCell, sizeCell, clicksCell, visitedCell, actionsCell);
            tableBody.appendChild(row);
        });
        modal.querySelector('[data-clm-count]').textContent = `${records.length} 条`;
    }

    function showToast(message) {
        let toast = document.getElementById('clm-library-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'clm-library-toast';
            toast.style.cssText = 'position:fixed;z-index:2147483003;left:50%;bottom:24px;transform:translateX(-50%);padding:9px 14px;border-radius:8px;background:#172033;color:#fff;font:13px system-ui,sans-serif;box-shadow:0 4px 16px #0003;';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.hidden = false;
        clearTimeout(showToast.timer);
        showToast.timer = setTimeout(() => { toast.hidden = true; }, 1800);
    }

    function closeModal() {
        document.querySelector('.clm-library-modal-backdrop')?.remove();
        document.body.classList.remove(MODAL_OPEN_CLASS);
    }

    function openModal() {
        closeModal();
        const backdrop = document.createElement('div');
        backdrop.className = 'clm-library-modal-backdrop';
        document.body.classList.add(MODAL_OPEN_CLASS);
        const modal = document.createElement('section');
        modal.className = 'clm-library-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', '种子库');
        modal.innerHTML = `
            <header>
                <h2>种子库</h2>
                <input id="clm-library-search" type="search" placeholder="搜索名称、hash、备注">
                <select id="clm-library-filter" aria-label="筛选">
                    <option value="all">全部</option><option value="visited">点击过</option><option value="starred">已星标</option><option value="noted">有备注</option><option value="hidden">已隐藏</option>
                </select>
                <select id="clm-library-sort" aria-label="排序">
                    <option value="recent">最近访问</option><option value="clicks">点击次数</option><option value="starred">星标优先</option><option value="name">名称</option>
                </select>
                <button type="button" data-clm-close aria-label="关闭"></button>
            </header>
            <div class="clm-library-table-wrap">
                <table class="clm-library-table">
                    <thead><tr><th class="select-cell"></th><th>名称</th><th>大小</th><th>点击</th><th>上次访问</th><th>操作</th></tr></thead>
                    <tbody class="clm-library-table-body"></tbody>
                </table>
            </div>
            <footer>
                <span data-clm-count></span>
                <button type="button" data-clm-select-visible>全选</button>
                <button type="button" data-clm-copy-selected class="primary">复制</button>
                ${IS_PIKPAK ? '<button type="button" data-clm-cloud-selected class="primary">填入云下载</button>' : ''}
                <button type="button" data-clm-delete-selected>删除</button>
            </footer>`;
        const closeButton = createIconButton('close', '关闭', closeModal);
        closeButton.dataset.clmClose = '1';
        modal.querySelector('[data-clm-close]').replaceWith(closeButton);
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);
        backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeModal(); });
        modal.querySelector('#clm-library-search').addEventListener('input', () => renderModalList(modal));
        modal.querySelector('#clm-library-filter').value = state.modalFilter;
        modal.querySelector('#clm-library-sort').value = state.sort;
        modal.querySelector('#clm-library-filter').addEventListener('change', (event) => {
            state.modalFilter = event.target.value;
            renderModalList(modal);
        });
        modal.querySelector('#clm-library-sort').addEventListener('change', (event) => {
            state.sort = event.target.value;
            renderModalList(modal);
        });
        modal.querySelector('[data-clm-select-visible]').addEventListener('click', () => {
            const inputs = Array.from(modal.querySelectorAll('[data-clm-select]'));
            const selectAll = inputs.some((input) => !input.checked);
            inputs.forEach((input) => { input.checked = selectAll; });
        });
        modal.querySelector('[data-clm-copy-selected]').addEventListener('click', async () => {
            const selected = Array.from(modal.querySelectorAll('[data-clm-select]:checked')).map((input) => input.value);
            const magnets = selected.map((hash) => state.records[hash]?.magnet || `magnet:?xt=urn:btih:${hash}`);
            try {
                await copyText(magnets.join('\n'));
                showToast(`已复制 ${magnets.length} 条磁链`);
            } catch (error) { showToast(error.message); }
        });
        modal.querySelector('[data-clm-cloud-selected]')?.addEventListener('click', () => {
            const selected = Array.from(modal.querySelectorAll('[data-clm-select]:checked'))
                .map((input) => state.records[input.value]).filter(Boolean);
            sendToPikPak(selected);
        });
        modal.querySelector('[data-clm-delete-selected]').addEventListener('click', () => {
            const selected = Array.from(modal.querySelectorAll('[data-clm-select]:checked')).map((input) => input.value);
            deleteRecords(selected, selected.length ? `删除选中的 ${selected.length} 条种子记录？` : '');
        });
        renderModalList(modal);
        modal.querySelector('#clm-library-search').focus();
    }

    function renderModalIfOpen() {
        const modal = document.querySelector('.clm-library-modal');
        if (modal) renderModalList(modal);
    }

    function renderLibraryControls() {
        let controls = document.querySelector('.clm-library-control');
        if (!controls) {
            controls = document.createElement('div');
            controls.className = 'clm-library-control';
            const open = document.createElement('button');
            open.type = 'button';
            open.textContent = '种子库';
            open.addEventListener('click', openModal);
            controls.appendChild(open);

            if (IS_SEARCH) {
                const toggleHidden = document.createElement('button');
                toggleHidden.type = 'button';
                toggleHidden.addEventListener('click', () => {
                    state.showHidden = !state.showHidden;
                    localStorage.setItem(`${STORE_KEY}:show-hidden`, state.showHidden ? '1' : '0');
                    refreshSearchCards();
                    renderLibraryControls();
                });
                controls.appendChild(toggleHidden);
            }
            document.body.appendChild(controls);
        }
        const toggleHidden = controls.querySelector('button:nth-child(2)');
        if (toggleHidden) {
            toggleHidden.textContent = state.showHidden ? '隐藏已隐藏' : '显示已隐藏';
            toggleHidden.setAttribute('aria-pressed', String(state.showHidden));
        }
    }

    function scheduleSearchScan() {
        if (state.scanQueued) return;
        state.scanQueued = true;
        requestAnimationFrame(() => {
            state.scanQueued = false;
            decorateSearchResults();
        });
    }

    function init() {
        if (!document.body) return;
        addStyle();
        renderLibraryControls();

        if (IS_PIKPAK) {
            decoratePikPakTaskDialog();
            state.observer = new MutationObserver(schedulePikPakScan);
            state.observer.observe(document.body, { childList: true, subtree: true });
        } else if (DETAIL_PATH.test(location.pathname)) {
            installDetailActions();
            const record = detailRecord();
            if (record) saveRecords();
        } else if (IS_SEARCH) {
            decorateSearchResults();
            state.observer = new MutationObserver(scheduleSearchScan);
            state.observer.observe(document.body, { childList: true, subtree: true });
        }

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeModal();
        });

        window.addEventListener('storage', (event) => {
            if (!IS_PIKPAK && event.key === STORE_KEY) {
                state.records = loadRecords();
                refreshSearchCards();
            } else if (event.key === `${STORE_KEY}:show-hidden`) {
                state.showHidden = event.newValue === '1';
                refreshSearchCards();
                renderLibraryControls();
            }
        });
        GM_addValueChangeListener(SHARED_STORE_KEY, (_key, _oldValue, newValue, remote) => {
            if (!remote || !newValue || typeof newValue !== 'object') return;
            state.records = newValue;
            refreshSearchCards();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
