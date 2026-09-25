/**
 * SignSpeaker Flowchart Studio — Interactive Application Logic
 * Elsewedy Technical Academy (STA) × Arab International Optronics (AIO)
 */

document.addEventListener('DOMContentLoaded', () => {
    initMermaid();
    initZoomPanControllers();
    initFullscreenModal();
    initCodeCopy();
    initSvgExport();
    initSearchAndFilters();
    initAccordions();
    initSidebarScrollSpy();
    initThemeToggle();
    detectLocalPort();
});

// ==========================================================================
// 1. Mermaid.js Initialization
// ==========================================================================

function initMermaid() {
    if (typeof mermaid === 'undefined') {
        console.error('Mermaid library not loaded');
        return;
    }

    const isLight = document.body.classList.contains('light-theme');

    mermaid.initialize({
        startOnLoad: true,
        theme: isLight ? 'default' : 'dark',
        securityLevel: 'loose',
        themeVariables: isLight ? {
            darkMode: false,
            background: '#ffffff',
            primaryColor: '#e0f2fe',
            primaryTextColor: '#0f172a',
            primaryBorderColor: '#0284c7',
            lineColor: '#0284c7',
            secondaryColor: '#f1f5f9',
            tertiaryColor: '#f8fafc',
            fontFamily: "'Outfit', sans-serif"
        } : {
            darkMode: true,
            background: '#060b18',
            primaryColor: '#13284f',
            primaryTextColor: '#f8fafc',
            primaryBorderColor: '#38bdf8',
            lineColor: '#38bdf8',
            secondaryColor: '#0d1a33',
            tertiaryColor: '#172a4d',
            fontFamily: "'Outfit', sans-serif"
        },
        flowchart: {
            curve: 'basis',
            useMaxWidth: false,
            htmlLabels: true
        }
    });
}

// ==========================================================================
// 2. Interactive Zoom & Pan Engine
// ==========================================================================

const zoomStates = new Map();

function initZoomPanControllers() {
    document.querySelectorAll('.diagram-viewport').forEach(viewport => {
        const id = viewport.id;
        const wrap = viewport.querySelector('.mermaid-wrap');
        if (!wrap) return;

        const state = {
            scale: 1,
            panning: false,
            pointX: 0,
            pointY: 0,
            startX: 0,
            startY: 0
        };

        zoomStates.set(id, state);

        function updateTransform() {
            wrap.style.transform = `translate(${state.pointX}px, ${state.pointY}px) scale(${state.scale})`;
        }

        // Mouse Down (Drag start)
        viewport.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Only left click
            state.panning = true;
            state.startX = e.clientX - state.pointX;
            state.startY = e.clientY - state.pointY;
            viewport.classList.add('panning');
        });

        // Mouse Move (Dragging)
        window.addEventListener('mousemove', (e) => {
            if (!state.panning) return;
            state.pointX = e.clientX - state.startX;
            state.pointY = e.clientY - state.startY;
            updateTransform();
        });

        // Mouse Up (Drag end)
        window.addEventListener('mouseup', () => {
            if (state.panning) {
                state.panning = false;
                viewport.classList.remove('panning');
            }
        });

        // Mouse Wheel (Zoom in/out centered)
        viewport.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 1.15 : 0.85;
            const newScale = Math.min(Math.max(0.3, state.scale * delta), 4.0);
            
            state.scale = newScale;
            updateTransform();
        }, { passive: false });

        // Connect Toolbar Buttons
        const card = viewport.closest('.chart-card');
        if (card) {
            const zoomInBtn = card.querySelector('.zoom-in');
            const zoomOutBtn = card.querySelector('.zoom-out');
            const zoomResetBtn = card.querySelector('.zoom-reset');

            if (zoomInBtn) {
                zoomInBtn.addEventListener('click', () => {
                    state.scale = Math.min(4.0, state.scale * 1.25);
                    updateTransform();
                });
            }

            if (zoomOutBtn) {
                zoomOutBtn.addEventListener('click', () => {
                    state.scale = Math.max(0.3, state.scale / 1.25);
                    updateTransform();
                });
            }

            if (zoomResetBtn) {
                zoomResetBtn.addEventListener('click', () => {
                    state.scale = 1;
                    state.pointX = 0;
                    state.pointY = 0;
                    updateTransform();
                });
            }
        }
    });
}

// ==========================================================================
// 3. Fullscreen Modal Viewer
// ==========================================================================

function initFullscreenModal() {
    const modal = document.getElementById('fullscreenModal');
    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');
    const closeBtn = document.getElementById('modalCloseBtn');
    const zoomInBtn = document.getElementById('modalZoomIn');
    const zoomOutBtn = document.getElementById('modalZoomOut');
    const zoomResetBtn = document.getElementById('modalZoomReset');

    if (!modal || !modalBody) return;

    let modalScale = 1;
    let modalPointX = 0;
    let modalPointY = 0;
    let modalPanning = false;
    let modalStartX = 0;
    let modalStartY = 0;

    function updateModalTransform() {
        const targetSvg = modalBody.querySelector('svg');
        if (targetSvg) {
            targetSvg.style.transform = `translate(${modalPointX}px, ${modalPointY}px) scale(${modalScale})`;
            targetSvg.style.transformOrigin = 'center center';
            targetSvg.style.transition = 'transform 0.05s linear';
        }
    }

    // Open Modal
    document.querySelectorAll('.fullscreen-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const title = btn.dataset.title || 'Diagram Preview';
            const sourceViewport = document.getElementById(targetId);
            if (!sourceViewport) return;

            const svg = sourceViewport.querySelector('svg');
            if (!svg) {
                showToast('Diagram is still rendering, please wait a moment.', 'warning');
                return;
            }

            modalTitle.textContent = title;
            modalBody.innerHTML = '';
            
            const clonedSvg = svg.cloneNode(true);
            clonedSvg.removeAttribute('id');
            modalBody.appendChild(clonedSvg);

            // Reset zoom for modal
            modalScale = 1.1;
            modalPointX = 0;
            modalPointY = 0;
            updateModalTransform();

            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        });
    });

    // Close Modal
    function closeModal() {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        modalBody.innerHTML = '';
        document.body.style.overflow = '';
    }

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('open')) {
            closeModal();
        }
    });

    // Modal Zoom/Pan Controls
    zoomInBtn.addEventListener('click', () => {
        modalScale = Math.min(5.0, modalScale * 1.3);
        updateModalTransform();
    });

    zoomOutBtn.addEventListener('click', () => {
        modalScale = Math.max(0.2, modalScale / 1.3);
        updateModalTransform();
    });

    zoomResetBtn.addEventListener('click', () => {
        modalScale = 1;
        modalPointX = 0;
        modalPointY = 0;
        updateModalTransform();
    });

    modalBody.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 1.15 : 0.85;
        modalScale = Math.min(Math.max(0.2, modalScale * delta), 5.0);
        updateModalTransform();
    }, { passive: false });

    modalBody.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        modalPanning = true;
        modalStartX = e.clientX - modalPointX;
        modalStartY = e.clientY - modalPointY;
        modalBody.classList.add('panning');
    });

    window.addEventListener('mousemove', (e) => {
        if (!modalPanning) return;
        modalPointX = e.clientX - modalStartX;
        modalPointY = e.clientY - modalStartY;
        updateModalTransform();
    });

    window.addEventListener('mouseup', () => {
        if (modalPanning) {
            modalPanning = false;
            modalBody.classList.remove('panning');
        }
    });
}

// ==========================================================================
// 4. Copy Mermaid Code to Clipboard
// ==========================================================================

function initCodeCopy() {
    document.querySelectorAll('.copy-code').forEach(btn => {
        btn.addEventListener('click', () => {
            const codeId = btn.dataset.code;
            const pre = document.getElementById(codeId);
            if (!pre) return;

            const codeText = pre.textContent.trim();
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(codeText).then(() => {
                    showToast('Mermaid code copied to clipboard!', 'success');
                }).catch(() => {
                    fallbackCopy(codeText);
                });
            } else {
                fallbackCopy(codeText);
            }
        });
    });
}

function fallbackCopy(text) {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
        document.execCommand('copy');
        showToast('Mermaid code copied to clipboard!', 'success');
    } catch (e) {
        showToast('Unable to copy code automatically.', 'error');
    }
    document.body.removeChild(area);
}

// ==========================================================================
// 5. Export Diagram as SVG
// ==========================================================================

function initSvgExport() {
    document.querySelectorAll('.export-svg').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const name = btn.dataset.name || 'signspeaker-flowchart';
            const viewport = document.getElementById(targetId);
            if (!viewport) return;

            const svg = viewport.querySelector('svg');
            if (!svg) {
                showToast('Diagram not rendered yet.', 'warning');
                return;
            }

            try {
                const serializer = new XMLSerializer();
                let source = serializer.serializeToString(svg);

                // Add namespace if missing
                if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
                    source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
                }

                const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${name}.svg`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                showToast(`Saved as ${name}.svg!`, 'success');
            } catch (err) {
                console.error(err);
                showToast('Failed to export SVG.', 'error');
            }
        });
    });
}

// ==========================================================================
// 6. Search & Category Filters
// ==========================================================================

function initSearchAndFilters() {
    const searchInput = document.getElementById('chartSearchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    const filterPills = document.querySelectorAll('.filter-pill');
    const cards = document.querySelectorAll('.chart-card');

    let currentCategory = 'all';
    let searchQuery = '';

    function applyFilters() {
        let visibleCount = 0;

        cards.forEach(card => {
            const categories = (card.dataset.categories || '').split(' ');
            const cardText = card.innerText.toLowerCase();

            const matchesCategory = currentCategory === 'all' || categories.includes(currentCategory);
            const matchesSearch = !searchQuery || cardText.includes(searchQuery);

            if (matchesCategory && matchesSearch) {
                card.style.display = 'block';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });

        if (clearBtn) {
            clearBtn.style.display = searchQuery ? 'block' : 'none';
        }
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim().toLowerCase();
            applyFilters();
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchQuery = '';
            applyFilters();
            searchInput.focus();
        });
    }

    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            filterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentCategory = pill.dataset.cat;
            applyFilters();
        });
    });
}

// ==========================================================================
// 7. Technical Accordions (Specification Sheets)
// ==========================================================================

function initAccordions() {
    document.querySelectorAll('.technical-sheet').forEach(sheet => {
        const toggle = sheet.querySelector('.sheet-toggle');
        if (!toggle) return;

        toggle.addEventListener('click', () => {
            sheet.classList.toggle('open');
        });
    });

    const collapseAllBtn = document.getElementById('collapseAllBtn');
    if (collapseAllBtn) {
        let allOpen = false;
        collapseAllBtn.addEventListener('click', () => {
            allOpen = !allOpen;
            document.querySelectorAll('.technical-sheet').forEach(sheet => {
                if (allOpen) sheet.classList.add('open');
                else sheet.classList.remove('open');
            });
            showToast(allOpen ? 'Expanded all specifications' : 'Collapsed all specifications', 'info');
        });
    }
}

// ==========================================================================
// 8. Sidebar Scroll Spy
// ==========================================================================

function initSidebarScrollSpy() {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    const sections = Array.from(navItems).map(item => {
        const id = item.getAttribute('href').substring(1);
        return document.getElementById(id);
    }).filter(Boolean);

    window.addEventListener('scroll', () => {
        const scrollPos = window.scrollY + 120;

        sections.forEach(section => {
            const top = section.offsetTop;
            const height = section.offsetHeight;
            const id = section.id;

            if (scrollPos >= top && scrollPos < top + height) {
                navItems.forEach(item => {
                    item.classList.remove('active');
                    if (item.getAttribute('href') === `#${id}`) {
                        item.classList.add('active');
                    }
                });
            }
        });
    }, { passive: true });
}

// ==========================================================================
// 9. Theme Toggle (Dark / Light)
// ==========================================================================

function initThemeToggle() {
    const btn = document.getElementById('themeToggleBtn');
    if (!btn) return;

    // Check saved theme
    const saved = localStorage.getItem('signspeaker_theme');
    if (saved === 'light') {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
    }

    btn.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark-theme');
        if (isDark) {
            document.body.classList.remove('dark-theme');
            document.body.classList.add('light-theme');
            localStorage.setItem('signspeaker_theme', 'light');
            showToast('Switched to Light Theme', 'info');
        } else {
            document.body.classList.remove('light-theme');
            document.body.classList.add('dark-theme');
            localStorage.setItem('signspeaker_theme', 'dark');
            showToast('Switched to Dark Theme', 'info');
        }
    });
}

// ==========================================================================
// 10. Localhost Port Indicator
// ==========================================================================

function detectLocalPort() {
    const portEl = document.getElementById('currentPort');
    if (portEl && window.location.port) {
        portEl.textContent = `:${window.location.port}`;
    }
}

// ==========================================================================
// 11. Toast Notifications Utility
// ==========================================================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Auto-remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentElement) toast.parentElement.removeChild(toast);
        }, 300);
    }, 3000);
}
