// ============================================================
// gallery-v2.js — Init PhotoSwipe 5 + Vanilla-Tilt para galeria
// ------------------------------------------------------------
// Reemplaza al lightbox custom de gallery.js cuando hay
// container .gallery-v2 presente. Se desactiva en mobile/touch
// para tilt (PhotoSwipe sigue funcionando perfecto en touch).
// ============================================================

(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        const gallery = document.querySelector('.gallery-v2');
        if (!gallery) return;

        initPhotoSwipe();
        initTilt(gallery);
    }

    function initPhotoSwipe() {
        if (typeof PhotoSwipeLightbox === 'undefined') {
            console.warn('[gallery-v2] PhotoSwipeLightbox not loaded');
            return;
        }

        const lightbox = new PhotoSwipeLightbox({
            gallery: '.gallery-v2',
            children: 'a.gallery-trigger',
            pswpModule: PhotoSwipe,
            bgOpacity: 0.95,
            showHideAnimationType: 'zoom',
            zoom: true,
            counter: true
        });

        // Caption en cada slide
        lightbox.on('uiRegister', function () {
            lightbox.pswp.ui.registerElement({
                name: 'custom-caption',
                order: 9,
                isButton: false,
                appendTo: 'root',
                html: '',
                onInit: (el, pswp) => {
                    pswp.on('change', () => {
                        const currSlide = pswp.currSlide;
                        const link = currSlide && currSlide.data && currSlide.data.element;
                        let caption = '';
                        if (link) {
                            const fig = link.closest('figure');
                            const cap = fig && fig.querySelector('figcaption');
                            if (cap) caption = cap.textContent.trim();
                        }
                        el.innerHTML = caption ? '<div class="pswp__caption">' + caption + '</div>' : '';
                    });
                }
            });
        });

        lightbox.init();
    }

    function initTilt(gallery) {
        if (typeof VanillaTilt === 'undefined') return;

        const hasHover = window.matchMedia('(hover: hover)').matches;
        const isDesktop = window.matchMedia('(min-width: 901px)').matches;
        if (!hasHover || !isDesktop) return;

        const tiles = gallery.querySelectorAll('.gallery-item');
        VanillaTilt.init(tiles, {
            max: 5,
            speed: 700,
            glare: true,
            'max-glare': 0.16,
            scale: 1.015,
            perspective: 1400,
            gyroscope: false,
            transition: true
        });
    }
})();
