// Configuración de espacios y sus imágenes
const espaciosData = {
    almaterra: {
        title: 'Almaterra - Coworking Elegante',
        description: 'Un espacio de coworking sofisticado donde los negocios se fusionan con la gastronomía de altura. Ambiente ejecutivo con tecnología de vanguardia.',
        folder: 'almaterra'
    },
    arca: {
        title: 'Arca - Salón Principal',
        description: 'El corazón de Mar&Tierra. Nuestro salón principal combina la elegancia clásica con toques contemporáneos en el primer piso.',
        folder: 'arca'
    },
    barco: {
        title: 'Barco - Experiencia Náutica',
        description: 'Una travesía gastronómica en nuestro salón temático del primer piso, inspirado en los grandes transatlánticos.',
        folder: 'barco'
    },
    chillout: {
        title: 'Chillout - Pet Friendly',
        description: 'Un oasis de relajación al aire libre donde las mascotas son bienvenidas. Terraza con ambiente distendido.',
        folder: 'Chillout'
    },
    rooftop: {
        title: 'Rooftop - Vista Panorámica',
        description: 'La cima de la experiencia Mar&Tierra. Nuestro exclusivo rooftop bar ofrece vistas panorámicas de Bucaramanga.',
        folder: 'rooftop'
    },
    salonvip: {
        title: 'Salón VIP - Recomendado',
        description: 'El pináculo del lujo y la exclusividad. Nuestro salón VIP es un santuario de elegancia suprema.',
        folder: 'SalonVIP'
    }
};

// CONFIGURACIÓN DE IMÁGENES - SISTEMA HÍBRIDO (LOCAL + URLS EXTERNAS)
const imageConfig = {
    // Cambiar a true cuando tengas las URLs del hosting
    useExternalURLs: false,

    // URL base del hosting (actualizar cuando esté disponible)
    externalBaseURL: '', // Ejemplo: 'https://tudominio.com/images/instalaciones'

    // Imágenes locales (formato WebP optimizado)
    localImages: {
        almaterra: ['_MG_8912.webp', '_MG_8993.webp'],
        arca: ['_MG_8885.webp', '_MG_8888.webp', '_MG_8945.webp', '_MG_8967.webp'],
        barco: ['_MG_8908.webp', '_MG_8993.webp'],
        chillout: ['_MG_9344.webp', '_MG_9346.webp'],
        rooftop: ['_MG_9320.webp', '_MG_9326.webp', '_MG_9337.webp'],
        salonvip: ['_MG_8865.webp', '_MG_8866.webp', '_MG_8871.webp', '_MG_8880.webp']
    },

    // URLs externas (actualizar cuando subas las imágenes al hosting)
    externalImages: {
        almaterra: [
            // 'https://tudominio.com/images/almaterra/_MG_8912.webp',
            // 'https://tudominio.com/images/almaterra/_MG_8993.webp'
        ],
        arca: [
            // 'https://tudominio.com/images/arca/_MG_8885.webp',
            // etc...
        ],
        barco: [],
        chillout: [],
        rooftop: [],
        salonvip: []
    }
};

// Variable global para el Swiper
let espacioSwiper = null;

// Función para abrir el modal con la galería
function openEspacioModal(espacioKey) {
    const modal = document.getElementById('espacioModal');
    const swiperWrapper = document.getElementById('espacioSwiperWrapper');
    const modalTitle = document.getElementById('espacioModalTitle');
    const modalDescription = document.getElementById('espacioModalDescription');

    if (!modal || !swiperWrapper) return;

    const espacio = espaciosData[espacioKey];
    if (!espacio) return;

    // Actualizar información del modal
    modalTitle.textContent = espacio.title;
    modalDescription.textContent = espacio.description;

    // Limpiar slides anteriores
    swiperWrapper.innerHTML = '';

    // Cargar imágenes dinámicamente
    loadEspacioImages(espacioKey, espacio.folder, swiperWrapper);

    // Mostrar modal con animación
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Inicializar o actualizar Swiper después de un pequeño delay
    setTimeout(() => {
        initializeEspacioSwiper();
    }, 100);
}

// Función para cargar imágenes de cada espacio
async function loadEspacioImages(espacioKey, folder, wrapper) {
    const imageFiles = await getImagesForSpace(espacioKey);

    if (imageFiles.length === 0) {
        // Si no hay imágenes, usar placeholder
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';
        slide.innerHTML = `
            <img src="https://via.placeholder.com/1200x800/D4C4AA/6B4C3B?text=Mar%26Tierra"
                 alt="${espacioKey}"
                 loading="lazy">
        `;
        wrapper.appendChild(slide);
    } else {
        // Cargar imágenes reales
        imageFiles.forEach(imageSrc => {
            const slide = document.createElement('div');
            slide.className = 'swiper-slide';

            // Si es una URL externa, usarla directamente
            // Si es un archivo local, construir la ruta
            const isExternal = imageSrc.startsWith('http');
            const finalSrc = isExternal
                ? imageSrc
                : `images/EspaciosRestaurante/${folder}/${imageSrc}`;

            slide.innerHTML = `
                <img src="${finalSrc}"
                     alt="${espacioKey}"
                     loading="lazy"
                     onerror="this.src='https://via.placeholder.com/1200x800/D4C4AA/6B4C3B?text=Imagen+No+Disponible'">
            `;
            wrapper.appendChild(slide);
        });
    }
}

// Función para obtener las imágenes de cada espacio (con soporte híbrido)
async function getImagesForSpace(espacioKey) {
    // Si está configurado para usar URLs externas y existen
    if (imageConfig.useExternalURLs && imageConfig.externalImages[espacioKey]?.length > 0) {
        return imageConfig.externalImages[espacioKey];
    }

    // Si no, usar imágenes locales
    return imageConfig.localImages[espacioKey] || [];
}

// Función para inicializar Swiper
function initializeEspacioSwiper() {
    // Verificar que Swiper esté disponible
    if (typeof Swiper === 'undefined') {
        console.error('Swiper no está cargado. Asegúrate de incluir la librería Swiper.');
        // Fallback: mostrar imágenes sin carousel
        document.querySelector('.espacioSwiper').style.display = 'block';
        return;
    }

    // Destruir instancia anterior si existe
    if (espacioSwiper) {
        espacioSwiper.destroy(true, true);
    }

    // Crear nueva instancia de Swiper
    espacioSwiper = new Swiper('.espacioSwiper', {
        loop: true,
        effect: 'fade',
        fadeEffect: {
            crossFade: true
        },
        autoplay: {
            delay: 4000,
            disableOnInteraction: false
        },
        pagination: {
            el: '.swiper-pagination',
            clickable: true,
            dynamicBullets: true
        },
        navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
        },
        keyboard: {
            enabled: true,
            onlyInViewport: true
        },
        // Añadir configuración responsive
        breakpoints: {
            320: {
                slidesPerView: 1,
                spaceBetween: 10
            },
            768: {
                slidesPerView: 1,
                spaceBetween: 20
            },
            1024: {
                slidesPerView: 1,
                spaceBetween: 30
            }
        }
    });
}

// Función para cerrar el modal
function closeEspacioModal() {
    const modal = document.getElementById('espacioModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';

        // Destruir Swiper cuando se cierra el modal
        if (espacioSwiper) {
            espacioSwiper.destroy(true, true);
            espacioSwiper = null;
        }
    }
}

// Cerrar modal con tecla ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeEspacioModal();
    }
});

// Cargar imágenes de fondo para las tarjetas (ahora en WebP)
document.addEventListener('DOMContentLoaded', () => {
    // Configurar imágenes de fondo reales para cada espacio
    const espacioImages = {
        'arca-image': 'images/EspaciosRestaurante/arca/_MG_8885.webp',
        'barco-image': 'images/EspaciosRestaurante/barco/_MG_8908.webp',
        'chillout-image': 'images/EspaciosRestaurante/Chillout/_MG_9344.webp',
        'rooftop-image': 'images/EspaciosRestaurante/rooftop/_MG_9320.webp',
        'salonvip-image': 'images/EspaciosRestaurante/SalonVIP/_MG_8865.webp'
    };

    // Aplicar imágenes de fondo
    Object.entries(espacioImages).forEach(([id, url]) => {
        const element = document.getElementById(id);
        if (element) {
            element.style.backgroundImage = `url('${url}')`;
            element.style.backgroundSize = 'cover';
            element.style.backgroundPosition = 'center';
        }
    });
});

// Animación de parallax en scroll
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const parallaxElements = document.querySelectorAll('.parallax-element');

    parallaxElements.forEach(element => {
        const speed = element.dataset.speed || 0.5;
        const yPos = -(scrolled * speed);
        element.style.transform = `translateY(${yPos}px)`;
    });
});

// Lazy loading de imágenes
if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.add('fade-in');
                imageObserver.unobserve(img);
            }
        });
    });

    // Observar todas las imágenes con lazy loading
    document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
    });
}

// FUNCIÓN DE UTILIDAD: Cambiar entre imágenes locales y URLs externas
// Puedes llamar esta función cuando tengas las URLs listas
function switchToExternalImages(baseURL = '') {
    imageConfig.useExternalURLs = true;
    imageConfig.externalBaseURL = baseURL;
    console.log('Cambiado a imágenes externas. Base URL:', baseURL);
}

// FUNCIÓN DE UTILIDAD: Actualizar URLs externas para un espacio específico
function updateExternalImages(espacioKey, urls) {
    if (imageConfig.externalImages[espacioKey]) {
        imageConfig.externalImages[espacioKey] = urls;
        console.log(`URLs actualizadas para ${espacioKey}:`, urls);
    }
}

// Exportar funciones útiles para configuración
window.MarTierraConfig = {
    switchToExternalImages,
    updateExternalImages,
    imageConfig
};