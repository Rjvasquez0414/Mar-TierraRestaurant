// ============================================================
// menu-schema.js
// ------------------------------------------------------------
// Inyecta dinámicamente un Schema.org Menu en el <head> a partir
// de window.menuData. Permite que Google muestre platos
// destacados en Rich Results de búsqueda local.
//
// Se carga DESPUÉS de menu-data.js (que define window.menuData).
// Google ejecuta JavaScript al indexar — el JSON-LD inyectado
// es leído correctamente por su crawler.
//
// Mantenimiento: cuando Roberto cambie menu-data.js, el schema
// se regenera automáticamente. Cero trabajo extra.
// ============================================================

(function () {
    'use strict';

    // Diccionario de metadatos por categoría (Schema.org-friendly)
    const CATEGORY_META = {
        compartir:  { name: 'Para Compartir', description: 'Ceviches, tartares y entradas para iniciar la experiencia' },
        mar:        { name: 'Ritual de Mar', description: 'Pescados y mariscos frescos con técnicas de autor' },
        tierra:     { name: 'Ritual de Tierra', description: 'Carnes selectas y platos de tradición' },
        marytierra: { name: 'Mar y Tierra', description: 'Fusión perfecta de sabores del mar y la tierra' },
        grill:      { name: 'Grill', description: 'Cortes selectos a la parrilla con chimichurri de la casa' },
        infantil:   { name: 'Menú Infantil', description: 'Platos especiales para nuestros invitados más jóvenes' },
        bebidas:    { name: 'Bebidas', description: 'Cocteles de autor, vinos y bebidas refrescantes' }
    };

    // Tags → suitableForDiet (vocabulario Schema.org)
    const TAG_TO_DIET = {
        'vegano':       'https://schema.org/VeganDiet',
        'vegetariano':  'https://schema.org/VegetarianDiet',
        'sin_gluten':   'https://schema.org/GlutenFreeDiet'
    };

    function parsePrice(priceString) {
        // "$68.000" → 68000 (formato colombiano: punto separa miles)
        if (!priceString || typeof priceString !== 'string') return null;
        const digits = priceString.replace(/[^\d]/g, '');
        const n = parseInt(digits, 10);
        return isFinite(n) ? n : null;
    }

    function buildMenuItem(item) {
        const menuItem = {
            '@type': 'MenuItem',
            'name': item.name,
            'description': item.description
        };

        const price = parsePrice(item.price);
        if (price !== null) {
            menuItem.offers = {
                '@type': 'Offer',
                'price': String(price),
                'priceCurrency': 'COP',
                'availability': item.available
                    ? 'https://schema.org/InStock'
                    : 'https://schema.org/OutOfStock'
            };
        }

        if (item.image) {
            menuItem.image = item.image;
        }

        // Mapear tags dietéticos
        if (Array.isArray(item.tags) && item.tags.length) {
            const diets = item.tags
                .map(t => TAG_TO_DIET[t])
                .filter(Boolean);
            if (diets.length) {
                menuItem.suitableForDiet = diets.length === 1 ? diets[0] : diets;
            }
        }

        return menuItem;
    }

    function buildMenuSchema(menuData) {
        const sections = [];

        Object.keys(menuData).forEach(categoryKey => {
            const items = menuData[categoryKey];
            if (!Array.isArray(items) || !items.length) return;

            const meta = CATEGORY_META[categoryKey] || {
                name: categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1)
            };

            sections.push({
                '@type': 'MenuSection',
                'name': meta.name,
                'description': meta.description,
                'hasMenuItem': items.map(buildMenuItem)
            });
        });

        return {
            '@context': 'https://schema.org',
            '@type': 'Menu',
            '@id': 'https://marytierrarestaurantbga.com/#menu',
            'name': 'Menú Mar&Tierra',
            'description': 'Cocina de autor: del mar a la tierra, en perfecta armonía. ' +
                           'Ceviches, mariscos frescos, cortes premium y experiencias exclusivas.',
            'inLanguage': 'es-CO',
            'provider': {
                '@type': 'Restaurant',
                '@id': 'https://marytierrarestaurantbga.com/#restaurant'
            },
            'hasMenuSection': sections
        };
    }

    function injectMenuSchema() {
        if (!window.menuData) {
            console.warn('[menu-schema] window.menuData no disponible — schema no generado');
            return;
        }

        try {
            const schema = buildMenuSchema(window.menuData);
            const script = document.createElement('script');
            script.type = 'application/ld+json';
            script.id = 'menu-schema-ld';
            script.textContent = JSON.stringify(schema);
            document.head.appendChild(script);
        } catch (err) {
            // Falla silenciosa — el schema es nice-to-have, no debe romper el sitio
            console.warn('[menu-schema] No se pudo generar el schema:', err);
        }
    }

    // Inyectar tras DOM listo (menu-data.js ya cargó por defer)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectMenuSchema);
    } else {
        injectMenuSchema();
    }
})();
