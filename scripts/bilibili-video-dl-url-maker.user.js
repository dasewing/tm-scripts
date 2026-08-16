// ==UserScript==
// @name         Bilibili video download URL maker
// @namespace    https://github.com/dasewing/tm-scripts
// @version      1.3.0
// @description  Copy Bilibili cover-card URLs to the clipboard.
// @author       David
// @match        https://*.bilibili.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function (global) {
    'use strict';

    // Bundled from scripts/common/user-script-ui.js for standalone installation.
    class UserScriptUI {
        static createButton({
            id,
            text = '复制',
            onClick,
            right = '20px',
            bottom = '20px',
        }) {
            const existingButton = id ? document.getElementById(id) : null;

            if (existingButton) {
                return existingButton;
            }

            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = text;
            button.setAttribute('aria-label', text);

            if (id) {
                button.id = id;
            }

            Object.assign(button.style, {
                position: 'fixed',
                right,
                bottom,
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

        static openMultiSelectModal({
            id = 'tm-script-multi-select-modal',
            title = '选择项目',
            items = [],
            onConfirm,
        }) {
            document.getElementById(id)?.remove();

            const overlay = document.createElement('div');
            overlay.id = id;
            Object.assign(overlay.style, {
                position: 'fixed',
                inset: '0',
                zIndex: '2147483646',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                background: 'rgba(0, 0, 0, .45)',
            });

            const panel = document.createElement('div');
            Object.assign(panel.style, {
                width: 'min(680px, 92vw)',
                maxHeight: 'min(720px, 90vh)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                borderRadius: '10px',
                background: '#fff',
                color: '#222',
                boxShadow: '0 10px 40px rgba(0, 0, 0, .3)',
                fontSize: '14px',
            });

            const header = document.createElement('div');
            Object.assign(header.style, {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '16px 18px',
                borderBottom: '1px solid #eee',
            });

            const heading = document.createElement('strong');
            heading.textContent = title;
            heading.style.fontSize = '16px';

            const closeButton = document.createElement('button');
            closeButton.type = 'button';
            closeButton.textContent = '×';
            closeButton.setAttribute('aria-label', '关闭');
            Object.assign(closeButton.style, {
                border: '0',
                background: 'transparent',
                color: '#666',
                cursor: 'pointer',
                fontSize: '24px',
                lineHeight: '1',
            });

            header.append(heading, closeButton);

            const toolbar = document.createElement('div');
            Object.assign(toolbar.style, {
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 18px',
                borderBottom: '1px solid #eee',
            });

            const selectAllButton = document.createElement('button');
            selectAllButton.type = 'button';
            selectAllButton.textContent = '全选';

            const countLabel = document.createElement('span');
            countLabel.style.color = '#666';

            const list = document.createElement('div');
            Object.assign(list.style, {
                flex: '1',
                minHeight: '80px',
                overflowY: 'auto',
                padding: '8px 18px',
            });

            const checkboxes = [];

            for (const item of items) {
                const label = document.createElement('label');
                Object.assign(label.style, {
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: '8px 0',
                    cursor: 'pointer',
                    lineHeight: '1.4',
                });

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = true;
                checkbox.style.marginTop = '3px';
                checkbox.addEventListener('change', updateCount);

                const text = document.createElement('span');
                text.textContent = item.label;
                text.title = item.value;
                text.style.wordBreak = 'break-all';

                label.append(checkbox, text);
                list.appendChild(label);
                checkboxes.push(checkbox);
            }

            if (!items.length) {
                const empty = document.createElement('div');
                empty.textContent = '未找到视频';
                empty.style.padding = '24px 0';
                empty.style.color = '#666';
                list.appendChild(empty);
            }

            const footer = document.createElement('div');
            Object.assign(footer.style, {
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
                padding: '12px 18px',
                borderTop: '1px solid #eee',
            });

            const cancelButton = document.createElement('button');
            cancelButton.type = 'button';
            cancelButton.textContent = '取消';

            const confirmButton = document.createElement('button');
            confirmButton.type = 'button';
            confirmButton.textContent = '复制选中链接';

            for (const button of [selectAllButton, cancelButton, confirmButton]) {
                Object.assign(button.style, {
                    padding: '7px 12px',
                    border: '1px solid #d9d9d9',
                    borderRadius: '6px',
                    background: '#fff',
                    color: '#222',
                    cursor: 'pointer',
                });
            }

            confirmButton.style.background = '#1677ff';
            confirmButton.style.borderColor = '#1677ff';
            confirmButton.style.color = '#fff';

            footer.append(cancelButton, confirmButton);
            toolbar.append(selectAllButton, countLabel);
            panel.append(header, toolbar, list, footer);
            overlay.appendChild(panel);
            (document.body || document.documentElement).appendChild(overlay);

            function updateCount() {
                const selectedCount = checkboxes.filter((checkbox) => checkbox.checked).length;
                countLabel.textContent = `已选 ${selectedCount} / ${items.length}`;
                selectAllButton.textContent = selectedCount === items.length && items.length
                    ? '取消全选'
                    : '全选';
            }

            function close() {
                overlay.remove();
                document.removeEventListener('keydown', handleKeydown);
            }

            function handleKeydown(event) {
                if (event.key === 'Escape') {
                    close();
                }
            }

            selectAllButton.addEventListener('click', () => {
                const shouldSelect = checkboxes.some((checkbox) => !checkbox.checked);

                for (const checkbox of checkboxes) {
                    checkbox.checked = shouldSelect;
                }

                updateCount();
            });

            closeButton.addEventListener('click', close);
            cancelButton.addEventListener('click', close);
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay) {
                    close();
                }
            });
            document.addEventListener('keydown', handleKeydown);

            confirmButton.addEventListener('click', async () => {
                const selectedItems = items.filter((item, index) => checkboxes[index].checked);
                confirmButton.disabled = true;

                try {
                    const shouldClose = await onConfirm(selectedItems);

                    if (shouldClose !== false) {
                        close();
                    }
                } finally {
                    confirmButton.disabled = false;
                }
            });

            updateCount();
            return overlay;
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

    global.TMScriptUI = global.TMScriptUI || UserScriptUI;

    function getVideoItems() {
        const seen = new Set();

        return [...document.querySelectorAll('a.bili-cover-card[href]')]
            .map((link) => {
                const value = new URL(link.href, location.href).href;
                const label = link.getAttribute('title')?.trim()
                    || link.textContent?.trim()
                    || value;

                return { label, value };
            })
            .filter((item) => {
                if (seen.has(item.value)) {
                    return false;
                }

                seen.add(item.value);
                return true;
            });
    }

    function getVideoUrls() {
        return getVideoItems().map((item) => item.value);
    }

    global.make_bl_download_scripts = function makeBlDownloadScripts() {
        const result = getVideoUrls().join('\n');
        console.log(result);
        return result;
    };

    global.TMScriptUI.createButton({
        id: 'tm-bilibili-video-dl-url-maker',
        text: '复制视频链接',
        onClick: async () => {
            const result = global.make_bl_download_scripts();
            const count = result ? result.split('\n').length : 0;
            const copied = await global.TMScriptUI.copyToClipboard(result);

            if (copied) {
                global.TMScriptUI.toast(`复制成功，共 ${count} 条`);
            } else if (count) {
                global.TMScriptUI.toast(`复制失败，共 ${count} 条`, { type: 'error' });
            } else {
                global.TMScriptUI.toast('复制失败：未找到链接', { type: 'error' });
            }
        },
    });

    global.TMScriptUI.createButton({
        id: 'tm-bilibili-video-dl-url-selector',
        text: '选择视频',
        right: '140px',
        onClick: async () => {
            global.TMScriptUI.openMultiSelectModal({
                id: 'tm-bilibili-video-dl-url-modal',
                title: '选择要复制的视频',
                items: getVideoItems(),
                onConfirm: async (selectedItems) => {
                    const result = selectedItems.map((item) => item.value).join('\n');
                    const count = selectedItems.length;
                    const copied = await global.TMScriptUI.copyToClipboard(result);

                    if (copied) {
                        global.TMScriptUI.toast(`复制成功，共 ${count} 条`);
                        return true;
                    }

                    global.TMScriptUI.toast(
                        count ? `复制失败，共 ${count} 条` : '复制失败：未选择视频',
                        { type: 'error' },
                    );
                    return false;
                },
            });
        },
    });
})(window);
