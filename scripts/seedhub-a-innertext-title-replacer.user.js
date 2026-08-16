// ==UserScript==
// @name         SeedHub A innerText title replacer
// @namespace    https://github.com/dasewing/tm-scripts
// @version      1.1.2
// @description  Replace SeedHub seed-list link text with the title attribute.
// @match        https://www.seedhub.cc/movies/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    function replaceLinkText(root) {
        const links = [];
        const selector = '.seed-list > ul > li > a[title]';

        if (root instanceof HTMLAnchorElement && root.matches(selector)) {
            links.push(root);
        }

        if (root.querySelectorAll) {
            links.push(...root.querySelectorAll(selector));
        }

        for (const link of links) {
            const title = link.getAttribute('title');

            if (title && link.innerText !== title) {
                link.innerText = title;
            }
        }
    }

    replaceLinkText(document);

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    replaceLinkText(node);
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });
})();
