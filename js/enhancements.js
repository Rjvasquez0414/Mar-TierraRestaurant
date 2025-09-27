// Professional Enhancements for Mar&Tierra

document.addEventListener('DOMContentLoaded', function() {
    // Initialize all enhancements
    initParallaxEffects();
    initSmoothScrolling();
    initMagneticButtons();
    initTextAnimations();
    initImageLazyLoading();
    initAdvancedHoverEffects();
    initScrollReveal();
    enhanceFormElements();
    initPerformanceOptimizations();
});

// Parallax scrolling effects
function initParallaxEffects() {
    const parallaxElements = document.querySelectorAll('[data-parallax]');

    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;

        parallaxElements.forEach(element => {
            const speed = element.dataset.parallax || 0.5;
            const yPos = -(scrolled * speed);
            element.style.transform = `translateY(${yPos}px)`;
        });

        // Hero parallax
        const hero = document.querySelector('.hero');
        if (hero && scrolled < window.innerHeight) {
            hero.style.transform = `translateY(${scrolled * 0.3}px)`;
            const heroContent = hero.querySelector('.hero-content');
            if (heroContent) {
                heroContent.style.opacity = 1 - (scrolled / window.innerHeight);
                heroContent.style.transform = `translateY(${scrolled * 0.5}px)`;
            }
        }
    });
}

// Smooth scrolling with easing
function initSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const headerOffset = 80;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Magnetic button effects
function initMagneticButtons() {
    const magneticButtons = document.querySelectorAll('.reservation-btn, .hero-cta, .plan-cta-button');

    magneticButtons.forEach(button => {
        button.addEventListener('mousemove', (e) => {
            const rect = button.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;

            button.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
        });

        button.addEventListener('mouseleave', () => {
            button.style.transform = '';
        });
    });
}

// Text reveal animations
function initTextAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const textObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('text-visible');

                // Animate letters for special headings
                if (entry.target.classList.contains('animate-letters')) {
                    const text = entry.target.textContent;
                    entry.target.textContent = '';
                    text.split('').forEach((letter, i) => {
                        const span = document.createElement('span');
                        span.textContent = letter === ' ' ? '\u00A0' : letter;
                        span.style.animationDelay = `${i * 0.05}s`;
                        span.classList.add('letter-animation');
                        entry.target.appendChild(span);
                    });
                }
            }
        });
    }, observerOptions);

    document.querySelectorAll('.section-title, .section-description').forEach(el => {
        textObserver.observe(el);
    });
}

// Advanced lazy loading with blur effect
function initImageLazyLoading() {
    const images = document.querySelectorAll('img[data-src]');

    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;

                // Create low quality placeholder
                const placeholder = new Image();
                placeholder.src = img.dataset.placeholder || img.dataset.src;

                placeholder.onload = () => {
                    img.style.filter = 'blur(20px)';
                    img.src = img.dataset.src;

                    img.onload = () => {
                        img.style.filter = '';
                        img.classList.add('loaded');
                    };
                };

                imageObserver.unobserve(img);
            }
        });
    });

    images.forEach(img => imageObserver.observe(img));
}

// Advanced hover effects
function initAdvancedHoverEffects() {
    // 3D card tilt effect
    const cards = document.querySelectorAll('.category-card, .espacio-card, .menu-item');

    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;

            const tiltX = (y - 0.5) * 10;
            const tiltY = (x - 0.5) * -10;

            card.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(1.02)`;
            card.style.boxShadow = `${tiltY * 2}px ${tiltX * 2}px 30px rgba(107, 76, 59, 0.2)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
            card.style.boxShadow = '';
        });
    });

    // Ripple effect on click
    document.querySelectorAll('.category-card, .espacio-card').forEach(element => {
        element.addEventListener('click', function(e) {
            const ripple = document.createElement('div');
            ripple.classList.add('ripple');

            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;

            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';

            this.appendChild(ripple);

            setTimeout(() => ripple.remove(), 600);
        });
    });
}

// Scroll reveal animations
function initScrollReveal() {
    const reveals = document.querySelectorAll('.category-card, .menu-item, .espacio-card');

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.classList.add('revealed');
                }, index * 100);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    });

    reveals.forEach(element => {
        element.classList.add('reveal-element');
        revealObserver.observe(element);
    });
}

// Enhance form elements
function enhanceFormElements() {
    const formGroups = document.querySelectorAll('.form-group');

    formGroups.forEach(group => {
        const input = group.querySelector('input, select, textarea');
        const label = group.querySelector('label');

        if (input && label) {
            // Floating labels
            input.addEventListener('focus', () => {
                label.classList.add('active');
                group.classList.add('focused');
            });

            input.addEventListener('blur', () => {
                if (!input.value) {
                    label.classList.remove('active');
                }
                group.classList.remove('focused');
            });

            // Check initial value
            if (input.value) {
                label.classList.add('active');
            }
        }
    });
}

// Performance optimizations
function initPerformanceOptimizations() {
    // Debounce scroll events
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        if (scrollTimeout) {
            window.cancelAnimationFrame(scrollTimeout);
        }
        scrollTimeout = window.requestAnimationFrame(() => {
            document.body.classList.toggle('scrolling', window.pageYOffset > 50);
        });
    });

    // Optimize animations on mobile
    if (window.matchMedia('(max-width: 768px)').matches) {
        document.body.classList.add('mobile-optimized');
    }

    // Preload critical images
    const criticalImages = [
        'images/EspaciosRestaurante/almaterra/_MG_8912.JPG',
        'images/EspaciosRestaurante/arca/_MG_8885.JPG'
    ];

    criticalImages.forEach(src => {
        const img = new Image();
        img.src = src;
    });
}

// Add custom cursor effect (optional - for ultra premium feel)
function initCustomCursor() {
    const cursor = document.createElement('div');
    cursor.classList.add('custom-cursor');
    document.body.appendChild(cursor);

    const cursorDot = document.createElement('div');
    cursorDot.classList.add('cursor-dot');
    document.body.appendChild(cursorDot);

    document.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';

        setTimeout(() => {
            cursorDot.style.left = e.clientX + 'px';
            cursorDot.style.top = e.clientY + 'px';
        }, 100);
    });

    // Cursor effects on hover
    document.querySelectorAll('a, button, .category-card, .espacio-card').forEach(element => {
        element.addEventListener('mouseenter', () => {
            cursor.classList.add('hover');
            cursorDot.classList.add('hover');
        });

        element.addEventListener('mouseleave', () => {
            cursor.classList.remove('hover');
            cursorDot.classList.remove('hover');
        });
    });
}

// Add CSS for ripple effect
const style = document.createElement('style');
style.textContent = `
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(201, 169, 97, 0.3);
        animation: rippleAnimation 0.6s ease-out;
        pointer-events: none;
    }

    @keyframes rippleAnimation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }

    .reveal-element {
        opacity: 0;
        transform: translateY(30px);
        transition: all 0.8s cubic-bezier(0.23, 1, 0.32, 1);
    }

    .reveal-element.revealed {
        opacity: 1;
        transform: translateY(0);
    }

    .letter-animation {
        display: inline-block;
        opacity: 0;
        transform: translateY(20px);
        animation: letterReveal 0.6s ease-out forwards;
    }

    @keyframes letterReveal {
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    img.loaded {
        animation: imageReveal 0.6s ease-out;
    }

    @keyframes imageReveal {
        from {
            opacity: 0;
            transform: scale(1.1);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }

    .form-group.focused label {
        color: var(--dorado-sutil);
        transform: translateY(-25px) scale(0.85);
    }

    body.scrolling #header {
        box-shadow: 0 5px 30px rgba(107, 76, 59, 0.1);
    }

    .custom-cursor {
        width: 20px;
        height: 20px;
        border: 2px solid var(--dorado-sutil);
        border-radius: 50%;
        position: fixed;
        pointer-events: none;
        transition: all 0.1s ease;
        z-index: 9999;
        mix-blend-mode: difference;
    }

    .cursor-dot {
        width: 4px;
        height: 4px;
        background: var(--dorado-sutil);
        border-radius: 50%;
        position: fixed;
        pointer-events: none;
        z-index: 9999;
        transition: all 0.3s ease;
    }

    .custom-cursor.hover {
        width: 40px;
        height: 40px;
        border-color: var(--marron-elegante);
    }

    .cursor-dot.hover {
        transform: scale(2);
    }
`;
document.head.appendChild(style);