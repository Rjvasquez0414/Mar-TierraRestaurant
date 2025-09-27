// Configuración de espacios y sus imágenes
const espaciosData = {
    almaterra: {
        title: 'Almaterra - Coworking Elegante',
        description: 'Un espacio de coworking sofisticado donde los negocios se fusionan con la gastronomía de altura. Ambiente ejecutivo con tecnología de vanguardia.',
        images: ['_MG_8912.JPG'],
        folder: 'almaterra'
    },
    arca: {
        title: 'Arca - Salón Principal',
        description: 'El corazón de Mar&Tierra. Nuestro salón principal combina la elegancia clásica con toques contemporáneos en el primer piso.',
        images: [],
        folder: 'arca'
    },
    barco: {
        title: 'Barco - Experiencia Náutica',
        description: 'Una travesía gastronómica en nuestro salón temático del primer piso, inspirado en los grandes transatlánticos.',
        images: [],
        folder: 'barco'
    },
    chillout: {
        title: 'Chillout - Pet Friendly',
        description: 'Un oasis de relajación al aire libre donde las mascotas son bienvenidas. Terraza con ambiente distendido.',
        images: [],
        folder: 'Chillout'
    },
    rooftop: {
        title: 'Rooftop - Vista Panorámica',
        description: 'La cima de la experiencia Mar&Tierra. Nuestro exclusivo rooftop bar ofrece vistas panorámicas de Bucaramanga.',
        images: [],
        folder: 'rooftop'
    },
    salonvip: {
        title: 'Salón VIP - Ultra Exclusivo',
        description: 'El pináculo del lujo y la exclusividad. Nuestro salón VIP es un santuario de elegancia suprema.',
        images: [],
        folder: 'SalonVIP'
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
    const basePath = `images/EspaciosRestaurante/${folder}/`;

    // Lista de posibles imágenes (necesitarías actualizar esto con los nombres reales)
    // Por ahora usaremos placeholders y las imágenes conocidas
    const imageFiles = await getImagesForSpace(espacioKey);

    if (imageFiles.length === 0) {
        // Si no hay imágenes, usar placeholder
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';
        slide.innerHTML = `
            <img src="https://source.unsplash.com/1200x800/?restaurant,${espacioKey}"
                 alt="${espacioKey}"
                 loading="lazy">
        `;
        wrapper.appendChild(slide);
    } else {
        // Cargar imágenes reales
        imageFiles.forEach(fileName => {
            const slide = document.createElement('div');
            slide.className = 'swiper-slide';
            slide.innerHTML = `
                <img src="${basePath}${fileName}"
                     alt="${espacioKey}"
                     loading="lazy"
                     onerror="this.src='https://source.unsplash.com/1200x800/?restaurant,luxury'">
            `;
            wrapper.appendChild(slide);
        });
    }
}

// Función para obtener las imágenes de cada espacio
async function getImagesForSpace(espacioKey) {
    // Imágenes reales de cada espacio
    switch(espacioKey) {
        case 'almaterra':
            return ['_MG_8912.JPG'];
        case 'arca':
            return ['_MG_8885.JPG', '_MG_8888.JPG', '_MG_8892.JPG', '_MG_8895.JPG', '_MG_8940.JPG'];
        case 'barco':
            return ['_MG_8908.JPG', '_MG_8910.JPG', '_MG_8914.JPG'];
        case 'chillout':
            return ['_MG_9343.JPG', '_MG_9344.JPG', '_MG_9346.JPG'];
        case 'rooftop':
            return ['_MG_9320.JPG', '_MG_9322.JPG', '_MG_9324.JPG', '_MG_9326.JPG', '_MG_9337.JPG'];
        case 'salonvip':
            return ['_MG_8865.JPG', '_MG_8866.JPG', '_MG_8871.JPG', '_MG_8880.JPG', '_MG_8882.JPG'];
        default:
            return [];
    }
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

// Cargar imágenes de fondo para las tarjetas
document.addEventListener('DOMContentLoaded', () => {
    // Configurar imágenes de fondo reales para cada espacio
    const espacioImages = {
        'arca-image': 'images/EspaciosRestaurante/arca/_MG_8885.JPG',
        'barco-image': 'images/EspaciosRestaurante/barco/_MG_8908.JPG',
        'chillout-image': 'images/EspaciosRestaurante/Chillout/_MG_9343.JPG',
        'rooftop-image': 'images/EspaciosRestaurante/rooftop/_MG_9320.JPG',
        'salonvip-image': 'images/EspaciosRestaurante/SalonVIP/_MG_8865.JPG'
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