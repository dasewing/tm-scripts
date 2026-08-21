// ==UserScript==
// @name         SeedHub opti
// @namespace    https://github.com/dasewing/tm-scripts
// @version      1.2.0
// @description  Replace SeedHub seed titles and decode/copy QR-code links.
// @match        https://www.seedhub.cc/movies/*
// @match        https://www.seedhub.cc/link_start/*
// @updateURL    https://raw.githubusercontent.com/dasewing/tm-scripts/main/scripts/seedhub-opti.user.js
// @downloadURL  https://raw.githubusercontent.com/dasewing/tm-scripts/main/scripts/seedhub-opti.user.js
// @require      https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    class UserScriptUI {
        static createButton({ id, text, onClick }) {
            const existingButton = document.getElementById(id);

            if (existingButton) {
                return existingButton;
            }

            const button = document.createElement('button');
            button.id = id;
            button.type = 'button';
            button.textContent = text;

            Object.assign(button.style, {
                position: 'fixed',
                right: '20px',
                bottom: '20px',
                zIndex: '2147483647',
                padding: '10px 16px',
                border: '0',
                borderRadius: '8px',
                background: '#1677ff',
                color: '#fff',
                boxShadow: '0 2px 10px rgba(0, 0, 0, .25)',
                cursor: 'pointer',
                fontSize: '14px',
                lineHeight: '1.4',
            });

            button.addEventListener('mouseenter', () => {
                button.style.filter = 'brightness(1.1)';
            });

            button.addEventListener('mouseleave', () => {
                button.style.filter = '';
            });

            button.addEventListener('click', async () => {
                button.disabled = true;

                try {
                    await onClick(button);
                } finally {
                    button.disabled = false;
                }
            });

            (document.body || document.documentElement).appendChild(button);
            return button;
        }

        static async copyToClipboard(text) {
            if (!text) {
                return false;
            }

            try {
                if (navigator.clipboard?.writeText && window.isSecureContext) {
                    await navigator.clipboard.writeText(text);
                    return true;
                }

                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.setAttribute('readonly', '');
                Object.assign(textarea.style, {
                    position: 'fixed',
                    left: '-9999px',
                    top: '0',
                });
                document.body.appendChild(textarea);
                textarea.select();
                const copied = document.execCommand('copy');
                textarea.remove();
                return copied;
            } catch {
                return false;
            }
        }

        static toast(message, { type = 'success', duration = 2000 } = {}) {
            const toast = document.createElement('div');
            toast.textContent = message;
            toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

            Object.assign(toast.style, {
                position: 'fixed',
                right: '20px',
                bottom: '72px',
                zIndex: '2147483647',
                maxWidth: 'min(80vw, 420px)',
                padding: '9px 14px',
                borderRadius: '6px',
                background: type === 'error' ? '#d93025' : '#1a7f37',
                color: '#fff',
                boxShadow: '0 2px 10px rgba(0, 0, 0, .25)',
                fontSize: '14px',
                lineHeight: '1.4',
            });

            (document.body || document.documentElement).appendChild(toast);
            window.setTimeout(() => toast.remove(), duration);
            return toast;
        }
    }

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

    function waitForImage(image) {
        if (image.complete && image.naturalWidth > 0) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            image.addEventListener('load', resolve, { once: true });
            image.addEventListener('error', () => reject(new Error('二维码图片加载失败')), { once: true });
        });
    }

    async function decodeQrImage(image) {
        await waitForImage(image);

        if ('BarcodeDetector' in window) {
            try {
                const supportedFormats = await BarcodeDetector.getSupportedFormats();

                if (supportedFormats.includes('qr_code')) {
                    const detector = new BarcodeDetector({ formats: ['qr_code'] });
                    const codes = await detector.detect(image);
                    const value = codes.find((code) => code.rawValue)?.rawValue;

                    if (value) {
                        return value.trim();
                    }
                }
            } catch {
                // Fall back to jsQR below.
            }
        }

        if (typeof window.jsQR !== 'function') {
            throw new Error('二维码解码器未加载');
        }

        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;

        if (!canvas.width || !canvas.height) {
            throw new Error('二维码图片尺寸无效');
        }

        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const result = window.jsQR(
            imageData.data,
            imageData.width,
            imageData.height,
            { inversionAttempts: 'attemptBoth' },
        );

        if (!result?.data) {
            throw new Error('未识别到二维码内容');
        }

        return result.data.trim();
    }

    function showQrResult(qrcode, value) {
        document.getElementById('tm-seedhub-qr-result')?.remove();

        const result = document.createElement('div');
        result.id = 'tm-seedhub-qr-result';
        Object.assign(result.style, {
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            maxWidth: 'min(90vw, 720px)',
            margin: '12px auto',
            padding: '10px 12px',
            border: '1px solid #d9d9d9',
            borderRadius: '6px',
            background: '#fff',
            boxShadow: '0 2px 8px rgba(0, 0, 0, .12)',
            fontSize: '14px',
        });

        const isLink = /^(https?|magnet):/i.test(value);
        const link = document.createElement(isLink ? 'a' : 'span');
        link.textContent = value;
        link.title = value;
        link.style.flex = '1 1 300px';
        link.style.minWidth = '0';
        link.style.overflowWrap = 'anywhere';

        if (isLink) {
            link.href = value;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        }

        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.textContent = '复制链接';
        Object.assign(copyButton.style, {
            padding: '6px 10px',
            border: '1px solid #1677ff',
            borderRadius: '5px',
            background: '#1677ff',
            color: '#fff',
            cursor: 'pointer',
        });

        copyButton.addEventListener('click', async () => {
            const copied = await UserScriptUI.copyToClipboard(value);
            UserScriptUI.toast(copied ? '复制成功' : '复制失败', {
                type: copied ? 'success' : 'error',
            });
        });

        result.append(link, copyButton);
        qrcode.insertAdjacentElement('afterend', result);
    }

    function setupQrTools() {
        const qrcode = document.getElementById('qrcode');
        const image = qrcode?.querySelector(':scope > img');

        if (!qrcode || !image || qrcode.dataset.tmSeedhubQrReady) {
            return;
        }

        qrcode.dataset.tmSeedhubQrReady = '1';

        UserScriptUI.createButton({
            id: 'tm-seedhub-qr-decode',
            text: '识别二维码',
            onClick: async () => {
                try {
                    const value = await decodeQrImage(image);
                    showQrResult(qrcode, value);
                    UserScriptUI.toast('二维码识别成功');
                } catch (error) {
                    UserScriptUI.toast(error.message || '二维码识别失败', { type: 'error' });
                }
            },
        });
    }

    replaceLinkText(document);
    setupQrTools();

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    replaceLinkText(node);
                }
            }
        }

        setupQrTools();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });
})();
