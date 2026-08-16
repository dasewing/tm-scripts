(function (global) {
    class UserScriptUI {
        static createButton({ id, text = '复制', onClick }) {
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

    global.TMScriptUI = global.TMScriptUI || UserScriptUI;
})(window);
