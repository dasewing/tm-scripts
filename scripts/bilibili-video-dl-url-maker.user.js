// ==UserScript==
// @name         Bilibili video download URL maker
// @namespace    https://github.com/dasewing/tm-scripts
// @version      1.1.0
// @description  Export Bilibili cover-card URLs as bbd commands.
// @author       David
// @match        https://*.bilibili.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    window.make_bl_download_scripts = function makeBlDownloadScripts() {
        const result = [...document.querySelectorAll('a.bili-cover-card[href]')]
            .map((link) => `bbd ${new URL(link.href, location.href).href}`)
            .join('\n');

        console.log(result);

        if (result && navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(result).catch(() => {});
        }

        return result;
    };
})();
