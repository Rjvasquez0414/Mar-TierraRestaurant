// Datos del Menú - Mar&Tierra Restaurant
// Archivo de fácil edición para actualizar el menú

window.menuData = {
    // ENTRADAS
    entradas: [
        {
            id: "trilogia-amazonica",
            name: "TRILOGÍA AMAZÓNICA",
            description: "Pesca fresca del Pacífico con pulpo, langostinos y corvina en leche de tigre",
            price: "$52.000",
            image: "images/placeholder.jpg", // TODO: Agregar imagen trilogia-amazonica.jpg
            tags: ["popular", "nuevo"],
            available: true,
            category: "entradas"
        },
        {
            id: "carpaccio-mare-oliva",
            name: "CARPACCIO MARE E OLIVA",
            description: "Carpaccio de pulpo con aceitunas negras trufadas, espuma de cilantro y masago",
            price: "$62.000",
            image: "images/placeholder.jpg", // TODO: Agregar imagen carpaccio
            tags: ["popular"],
            available: true,
            category: "entradas"
        },
        {
            id: "perla-pacifica",
            name: "PERLA PACÍFICA",
            description: "Croquetas de jaiba ahumada con queso mozzarella y salsa pecorino romano",
            price: "$45.000",
            image: "images/placeholder.jpg", // TODO: Agregar imagen croquetas-jaiba.jpg
            tags: [],
            available: true,
            category: "entradas"
        },
        {
            id: "tuetano-imperial",
            name: "TUÉTANO IMPERIAL",
            description: "Piezas de tuétano coronadas con lomo fino madurado a la robata yaki",
            price: "$49.000",
            image: "images/placeholder.jpg", // TODO: Agregar imagen tuetano-imperial.jpg
            tags: ["nuevo"],
            available: true,
            category: "entradas"
        }
    ],

    // RITUAL DE MAR
    mar: [
        {
            id: "reserva-capitan",
            name: "RESERVA DEL CAPITÁN",
            description: "Langosta seleccionada con champiñones y queso mozzarella en robata yaki",
            price: "$350/gr",
            image: "", // Imagen pendiente
            tags: ["popular"],
            available: true,
            category: "mar"
        },
        {
            id: "pulpo-ancestral",
            name: "PULPO ANCESTRAL",
            description: "Pulpo parrillado con chimichurri en cama de puré amazónico",
            price: "$95.000",
            image: "", // Imagen pendiente
            tags: ["popular"],
            available: true,
            category: "mar"
        },
        {
            id: "salmon-silvestre",
            name: "SALMÓN SILVESTRE",
            description: "Pieza de salmón a la robata yaki en salsa menier cremosa",
            price: "$80.000",
            image: "", // Imagen pendiente
            tags: [],
            available: true,
            category: "mar"
        },
        {
            id: "robalo-koi",
            name: "RÓBALO KOI",
            description: "Pieza de róbalo a la robata yaki con ravioles artesanales de ricota",
            price: "$76.000",
            image: "", // Imagen pendiente
            tags: ["nuevo"],
            available: true,
            category: "mar"
        }
    ],

    // RITUAL DE TIERRA
    tierra: [
        {
            id: "beef-wellington",
            name: "BEEF WELLINGTON",
            description: "Técnica Vanguardia de Solomillo envuelto en paté y hojaldre",
            price: "$97.000",
            image: "images/beef-wellington.jpg", // Cambiar por imagen real
            tags: ["popular"],
            available: true,
            category: "tierra"
        },
        {
            id: "filet-mignon",
            name: "FILET MIGNON",
            description: "Lomo fino premium en parrilla con panceta ahumada y langostinos",
            price: "$81.000",
            image: "images/filet-mignon.jpg", // Cambiar por imagen real
            tags: ["popular"],
            available: true,
            category: "tierra"
        },
        {
            id: "short-ribs-ahumadas",
            name: "SHORT RIBS AHUMADAS",
            description: "Baby Rack de cerdo cocción lenta 24 hrs en salsa BBQ con tamarindo",
            price: "$75.000",
            image: "images/short-ribs.jpg", // Cambiar por imagen real
            tags: [],
            available: true,
            category: "tierra"
        },
        {
            id: "cordon-blue-3-quesos",
            name: "CORDÓN BLUE 3 QUESOS",
            description: "Suprema de pollo rellena con jamón cotto y tres quesos artesanales",
            price: "$60.000",
            image: "images/cordon-blue.jpg", // Cambiar por imagen real
            tags: [],
            available: true,
            category: "tierra"
        }
    ],

    // PASTA
    pasta: [
        {
            id: "tagliatelle-marino",
            name: "TAGLIATELLE MARINO",
            description: "Pasta al pimentón ahumado con bisquet furikake y frutos del mar",
            price: "$72.000",
            image: "images/tagliatelle-marino.jpg", // Cambiar por imagen real
            tags: ["popular"],
            available: true,
            category: "pasta"
        },
        {
            id: "carbonara-di-mare",
            name: "CARBONARA DI MARE",
            description: "Pasta mafaldine con salmón curado y toque de ginebra",
            price: "$67.000",
            image: "images/carbonara-mare.jpg", // Cambiar por imagen real
            tags: ["nuevo"],
            available: true,
            category: "pasta"
        },
        {
            id: "carbonara-tagliatelle",
            name: "CARBONARA TAGLIATELLE",
            description: "Tradicional pasta en salsa carbonara con guanciale crujiente",
            price: "$60.000",
            image: "images/carbonara-tradicional.jpg", // Cambiar por imagen real
            tags: [],
            available: true,
            category: "pasta"
        }
    ],

    // ARROCES
    arroces: [
        {
            id: "risotto-mar-tierra",
            name: "RISOTTO MAR & TIERRA",
            description: "Risotto trufado con fumme katsuo, tentáculo de pulpo y piña",
            price: "$85.000",
            image: "images/risotto-mar-tierra.jpg", // Cambiar por imagen real
            tags: ["popular"],
            available: true,
            category: "arroces"
        },
        {
            id: "cremoso-marino",
            name: "CREMOSO MARINO",
            description: "Arroz cremoso con frutos del mar aromatizado con bisquet y langostino",
            price: "$80.000",
            image: "images/arroz-cremoso-marino.jpg", // Cambiar por imagen real
            tags: [],
            available: true,
            category: "arroces"
        },
        {
            id: "chaufa-aeropuerto",
            name: "CHAUFA AEROPUERTO",
            description: "Experiencia en mesa de arroz frito con frutos del mar y raíces chinas",
            price: "$59.000",
            image: "images/chaufa-aeropuerto.jpg", // Cambiar por imagen real
            tags: ["nuevo"],
            available: true,
            category: "arroces"
        }
    ],

    // VINOS Y BEBIDAS
    bebidas: [
        {
            id: "don-melchor-cabernet",
            name: "DON MELCHOR CABERNET",
            description: "Puente Alto, Chile - Tinto intenso y envolvente",
            price: "$1.555.000",
            image: "images/don-melchor.jpg", // Cambiar por imagen real
            tags: ["popular"],
            available: true,
            category: "bebidas"
        },
        {
            id: "marques-casa-concha",
            name: "MARQUES DE CASA CONCHA",
            description: "Valle del Maule, Chile - Merlot elegante",
            price: "$265.000",
            image: "images/marques-casa-concha.jpg", // Cambiar por imagen real
            tags: [],
            available: true,
            category: "bebidas"
        },
        {
            id: "cocktail-mar-tierra",
            name: "COCKTAIL MAR Y TIERRA",
            description: "Beefeater Gin, vermouth pistachos y espuma de matcha",
            price: "$36.000",
            image: "images/cocktail-mar-tierra.jpg", // Cambiar por imagen real
            tags: ["nuevo"],
            available: true,
            category: "bebidas"
        },
        {
            id: "margarita-persia",
            name: "MARGARITA DE PERSIA",
            description: "Olmeca reposado, brebaje de naranja y eucalipto",
            price: "$36.000",
            image: "images/margarita-persia.jpg", // Cambiar por imagen real
            tags: ["popular"],
            available: true,
            category: "bebidas"
        }
    ]
};

// Configuración adicional del menú
window.menuConfig = {
    // Información del restaurante
    restaurant: {
        name: "Mar&Tierra",
        tagline: "Algo Diferente",
        description: "Un encuentro de culturas, texturas e historias",
        fullDescription: "Donde el mar y la tierra no compiten, se complementan. Y en ese equilibrio es donde nace nuestra esencia."
    },

    // Configuración de imágenes
    images: {
        defaultPlaceholder: "images/placeholder.jpg",
        hero: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=2070",
        logo: "images/logo-sin-fondo.png" // Aquí va tu logo sin fondo
    },

    // Configuración de categorías
    categories: {
        entradas: {
            icon: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <circle cx="30" cy="50" r="15" stroke-dasharray="3 2"/>
                <circle cx="50" cy="50" r="15" stroke-dasharray="3 2"/>
                <circle cx="70" cy="50" r="15" stroke-dasharray="3 2"/>
                <path d="M20 35 Q50 25 80 35" stroke-dasharray="5 3"/>
            </svg>`,
            title: "Entradas",
            description: "Trilogía Amazónica y selección de ceviches que despiertan los sentidos"
        },
        mar: {
            icon: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 20 C30 20 20 35 30 50 S50 80 50 80 S70 65 70 50 S70 20 50 20"/>
                <path d="M30 45 Q50 35 70 45" stroke-dasharray="3 2"/>
                <circle cx="40" cy="40" r="2" fill="#0056D2"/>
                <circle cx="60" cy="40" r="2" fill="#0056D2"/>
            </svg>`,
            title: "Ritual de Mar",
            description: "Pescados y mariscos frescos con técnicas mediterráneas nikkei"
        },
        tierra: {
            icon: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <path d="M30 60 L30 40 Q30 30 40 30 L60 30 Q70 30 70 40 L70 60 Q70 70 60 70 L40 70 Q30 70 30 60"/>
                <path d="M35 50 L65 50" stroke-dasharray="5 2"/>
                <path d="M40 40 L40 60 M50 35 L50 65 M60 40 L60 60"/>
            </svg>`,
            title: "Ritual de Tierra",
            description: "Carnes seleccionadas con técnicas de cocción lenta al fuego"
        },
        pasta: {
            icon: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 40 Q30 30 40 40 T60 40 T80 40" stroke-dasharray="none"/>
                <path d="M20 50 Q30 40 40 50 T60 50 T80 50" stroke-dasharray="none"/>
                <path d="M20 60 Q30 50 40 60 T60 60 T80 60" stroke-dasharray="none"/>
            </svg>`,
            title: "Pasta",
            description: "Herencia mediterránea con alma fusión"
        },
        arroces: {
            icon: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="30"/>
                <circle cx="50" cy="50" r="20" stroke-dasharray="2 2"/>
                <path d="M35 50 Q50 40 65 50 Q50 60 35 50" fill="none"/>
                <circle cx="45" cy="48" r="2" fill="#D4AF37"/>
                <circle cx="55" cy="48" r="2" fill="#D4AF37"/>
                <circle cx="50" cy="52" r="2" fill="#D4AF37"/>
            </svg>`,
            title: "Arroces",
            description: "Ritual de fuego lento y sazón profunda"
        },
        bebidas: {
            icon: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <path d="M40 20 L40 70 Q40 80 50 80 Q60 80 60 70 L60 20"/>
                <path d="M35 25 L65 25"/>
                <ellipse cx="50" cy="45" rx="8" ry="15" fill="none" stroke-dasharray="3 2"/>
                <path d="M30 75 L70 75"/>
            </svg>`,
            title: "Vinos y Bebidas",
            description: "Maridaje perfecto para cada momento"
        }
    },

    // Información de contacto
    contact: {
        address: {
            street: "Cra 35a #46-102",
            neighborhood: "Barrio Cabecera del Llano",
            city: "Bucaramanga, Colombia"
        },
        phone: "300 826 3403",
        instagram: "@marytierrarestaurantbga",
        hours: [
            { day: "Lunes - Viernes", time: "7:30 AM - 9:30 PM" },
            { day: "Sábado", time: "8:30 AM - 9:00 PM" },
            { day: "Domingo", time: "Cerrado" }
        ]
    },

    // Configuraciones técnicas
    settings: {
        animationDuration: 300,
        lazyLoadOffset: 100,
        searchDelay: 300
    }
};

// Funciones utilitarias para administrar el menú

// Función para agregar un nuevo plato
window.addMenuItem = function(category, item) {
    if (!window.menuData[category]) {
        console.error(`Categoría '${category}' no existe`);
        return false;
    }
    
    // Generar ID único si no se proporciona
    if (!item.id) {
        item.id = item.name.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
    }
    
    // Asegurar que tenga la estructura correcta
    const newItem = {
        id: item.id,
        name: item.name || "Nuevo Plato",
        description: item.description || "",
        price: item.price || "$0",
        image: item.image || "images/placeholder.jpg",
        tags: item.tags || [],
        available: item.available !== undefined ? item.available : true,
        category: category
    };
    
    window.menuData[category].push(newItem);
    return true;
};

// Función para actualizar un plato existente
window.updateMenuItem = function(category, itemId, updates) {
    if (!window.menuData[category]) {
        console.error(`Categoría '${category}' no existe`);
        return false;
    }
    
    const itemIndex = window.menuData[category].findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
        console.error(`Plato con ID '${itemId}' no encontrado en ${category}`);
        return false;
    }
    
    // Actualizar el plato
    window.menuData[category][itemIndex] = {
        ...window.menuData[category][itemIndex],
        ...updates
    };
    
    return true;
};

// Función para eliminar un plato
window.removeMenuItem = function(category, itemId) {
    if (!window.menuData[category]) {
        console.error(`Categoría '${category}' no existe`);
        return false;
    }
    
    const itemIndex = window.menuData[category].findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
        console.error(`Plato con ID '${itemId}' no encontrado en ${category}`);
        return false;
    }
    
    window.menuData[category].splice(itemIndex, 1);
    return true;
};

// Función para obtener todos los platos de una categoría
window.getCategoryItems = function(category) {
    return window.menuData[category] || [];
};

// Función para buscar platos
window.searchMenuItems = function(searchTerm) {
    const results = [];
    const term = searchTerm.toLowerCase();
    
    Object.keys(window.menuData).forEach(category => {
        window.menuData[category].forEach(item => {
            if (item.name.toLowerCase().includes(term) ||
                item.description.toLowerCase().includes(term) ||
                item.tags.some(tag => tag.includes(term))) {
                results.push(item);
            }
        });
    });
    
    return results;
};