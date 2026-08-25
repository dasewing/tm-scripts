// ==UserScript==
// @name         JD search result optimizer
// @namespace    https://github.com/dasewing/tm-scripts
// @version      1.0.0
// @description  Hide JD search result cards carrying the 京喜自营 badge.
// @author       David
// @match        https://search.jd.com/Search*
// @updateURL    https://raw.githubusercontent.com/dasewing/tm-scripts/main/scripts/jd-search-result-optimizer.user.js
// @downloadURL  https://raw.githubusercontent.com/dasewing/tm-scripts/main/scripts/jd-search-result-optimizer.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const CARD_SELECTOR = '.plugin_goodsCardWrapper[data-sku], [data-sku].plugin_goodsCardWrapper';
    const BADGE_SELECTOR = '.plugin_goodsContainer img[alt="京喜自营"]';
    const HIDDEN_CLASS = 'tm-jd-hide-jingxi-self-operated';

    function addHideStyle() {
        if (document.getElementById('tm-jd-search-result-optimizer-style')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'tm-jd-search-result-optimizer-style';
        style.textContent = `.${HIDDEN_CLASS} { display: none !important; }`;
        (document.head || document.documentElement).appendChild(style);
    }

    function findCard(badge) {
        return badge.closest(CARD_SELECTOR) || badge.closest('[data-sku]');
    }

    function hideJingxiCards() {
        document.querySelectorAll(BADGE_SELECTOR).forEach((badge) => {
            const card = findCard(badge);

            if (card) {
                card.classList.add(HIDDEN_CLASS);
            }
        });
    }

    let scanQueued = false;

    function scheduleScan() {
        if (scanQueued) {
            return;
        }

        scanQueued = true;
        requestAnimationFrame(() => {
            scanQueued = false;
            hideJingxiCards();
        });
    }

    function init() {
        addHideStyle();
        hideJingxiCards();

        const observer = new MutationObserver(scheduleScan);
        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    if (document.body) {
        init();
    } else {
        window.addEventListener('DOMContentLoaded', init, { once: true });
    }
})();
