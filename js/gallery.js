// ============================================================
// gallery.js — Lightbox custom para la sección Galería
// Sin dependencias externas. Maneja teclado, swipe básico,
// foco, y se desactiva si el usuario prefiere reduced-motion
// (la galería sigue funcionando, sólo sin transiciones).
// ============================================================

(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', initGalleryLightbox);

    function initGalleryLightbox() {
        const masonry = document.getElementById('galleryMasonry');
        const lightbox = document.getElementById('lightbox');
        if (!masonry || !lightbox) return;

        const items = Array.from(masonry.querySelectorAll('.gallery-item'));
        if (!items.length) return;

        // Inventario: src + alt + caption
        const slides = items.map(fig => {
            const img = fig.querySelector('img');
            const caption = fig.querySelector('figcaption');
            return {
                src: img ? img.getAttribute('src') : '',
                alt: img ? img.getAttribute('alt') : '',
                caption: caption ? caption.textContent.trim() : ''
            };
        });

        const imgEl       = lightbox.querySelector('.lightbox-image');
        const captionEl   = lightbox.querySelector('.lightbox-caption');
        const counterEl   = lightbox.querySelector('.lightbox-counter');
        const closeBtn    = lightbox.querySelector('.lightbox-close');
        const prevBtn     = lightbox.querySelector('.lightbox-prev');
        const nextBtn     = lightbox.querySelector('.lightbox-next');

        let currentIndex = 0;
        let lastFocused = null;

        function render() {
            const slide = slides[currentIndex];
            imgEl.style.opacity = '0';
            // pequeño defer para que el fade-in se note
            requestAnimationFrame(() => {
                imgEl.setAttribute('src', slide.src);
                imgEl.setAttribute('alt', slide.alt);
                captionEl.textContent = slide.caption;
                counterEl.textContent = (currentIndex + 1) + ' / ' + slides.length;
                imgEl.onload = () => { imgEl.style.opacity = '1'; };
            });
        }

        function open(index) {
            currentIndex = index;
            lastFocused = document.activeElement;
            lightbox.hidden = false;
            // forzamos reflow para que la transición funcione
            void lightbox.offsetWidth;
            lightbox.classList.add('is-open');
            document.body.style.overflow = 'hidden';
            render();
            // mover foco al botón cerrar
            closeBtn.focus({ preventScroll: true });
        }

        function close() {
            lightbox.classList.remove('is-open');
            document.body.style.overflow = '';
            setTimeout(() => {
                lightbox.hidden = true;
                if (lastFocused && typeof lastFocused.focus === 'function') {
                    lastFocused.focus({ preventScroll: true });
                }
            }, 250);
        }

        function next() {
            currentIndex = (currentIndex + 1) % slides.length;
            render();
        }

        function prev() {
            currentIndex = (currentIndex - 1 + slides.length) % slides.length;
            render();
        }

        // Click en cada item abre el lightbox
        items.forEach((fig, i) => {
            const trigger = fig.querySelector('.gallery-trigger');
            if (!trigger) return;
            trigger.addEventListener('click', () => open(i));
        });

        // Controles
        closeBtn.addEventListener('click', close);
        prevBtn.addEventListener('click', prev);
        nextBtn.addEventListener('click', next);

        // Click en el fondo (no en la imagen) cierra
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) close();
        });

        // Teclado: Esc cierra, flechas navegan
        document.addEventListener('keydown', (e) => {
            if (lightbox.hidden) return;
            switch (e.key) {
                case 'Escape':    close(); break;
                case 'ArrowLeft': prev();  break;
                case 'ArrowRight': next(); break;
            }
        });

        // Swipe básico en táctil
        let touchStartX = 0;
        lightbox.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        lightbox.addEventListener('touchend', (e) => {
            const dx = e.changedTouches[0].screenX - touchStartX;
            if (Math.abs(dx) < 40) return;
            if (dx < 0) next(); else prev();
        }, { passive: true });
    }
})();
