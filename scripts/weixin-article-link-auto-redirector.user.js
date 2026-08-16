// ==UserScript==
// @name         WeChat article auto redirector
// @namespace    https://github.com/dasewing/tm-scripts
// @version      1.1.0
// @description  Redirect supported article pages to their WeChat article URL.
// @author       David
// @match        https://www.huxiu.com/article/*
// @match        https://36kr.com/p/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const wechatLinkSelector = [
        'a[href^="https://mp.weixin.qq.com/s"]',
        'a[href^="http://mp.weixin.qq.com/s"]',
    ].join(',');

    function redirectToWechatArticle() {
        const link = document.querySelector(wechatLinkSelector);
        const href = link?.href;

        if (!href || href === location.href) {
            return;
        }

        console.log(href);
        location.assign(href);
    }

    setTimeout(redirectToWechatArticle, 1000);
})();
