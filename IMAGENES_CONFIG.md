# Configuración de Imágenes - Mar&Tierra

## 📸 Imágenes Actualizadas (Formato WebP)

Todas las imágenes han sido actualizadas al formato WebP para optimización de peso (70-80% menos peso que JPG).

### Imágenes Disponibles por Espacio:

| Espacio | Imágenes |
|---------|----------|
| **Almaterra** | `_MG_8912.webp`, `_MG_8993.webp` |
| **Arca** | `_MG_8885.webp`, `_MG_8888.webp`, `_MG_8945.webp`, `_MG_8967.webp` |
| **Barco** | `_MG_8908.webp`, `_MG_8993.webp` |
| **Chillout** | `_MG_9344.webp`, `_MG_9346.webp` |
| **Rooftop** | `_MG_9320.webp`, `_MG_9326.webp`, `_MG_9337.webp` |
| **Salón VIP** | `_MG_8865.webp`, `_MG_8866.webp`, `_MG_8871.webp`, `_MG_8880.webp` |

## 🌐 Sistema Híbrido: Imágenes Locales + URLs Externas

El sistema ahora soporta tanto imágenes locales como URLs externas de hosting.

### Cómo Cambiar a URLs Externas:

#### 1. **Método Rápido (Consola del Navegador)**

Abre la consola del navegador (F12) y ejecuta:

```javascript
// Cambiar a URLs externas
MarTierraConfig.switchToExternalImages('https://tudominio.com/images');

// Actualizar URLs para un espacio específico
MarTierraConfig.updateExternalImages('almaterra', [
    'https://tudominio.com/images/almaterra/_MG_8912.webp',
    'https://tudominio.com/images/almaterra/_MG_8993.webp'
]);
```

#### 2. **Método Permanente (Editar archivo)**

Edita el archivo `js/instalaciones.js`:

```javascript
const imageConfig = {
    // Cambiar a true cuando tengas las URLs
    useExternalURLs: true, // <- CAMBIAR A TRUE

    // Agregar la URL base de tu hosting
    externalBaseURL: 'https://tudominio.com/images',

    // Actualizar las URLs en externalImages
    externalImages: {
        almaterra: [
            'https://tudominio.com/images/almaterra/_MG_8912.webp',
            'https://tudominio.com/images/almaterra/_MG_8993.webp'
        ],
        arca: [
            'https://tudominio.com/images/arca/_MG_8885.webp',
            'https://tudominio.com/images/arca/_MG_8888.webp',
            'https://tudominio.com/images/arca/_MG_8945.webp',
            'https://tudominio.com/images/arca/_MG_8967.webp'
        ],
        // etc...
    }
};
```

## 🔄 Fallback Automático

El sistema tiene fallback automático:
1. Si una imagen no se encuentra, muestra un placeholder
2. Si las URLs externas fallan, intenta cargar las locales
3. Si todo falla, muestra una imagen de placeholder genérica

## 📁 Estructura de Carpetas

```
images/
└── EspaciosRestaurante/
    ├── almaterra/
    │   ├── _MG_8912.webp
    │   └── _MG_8993.webp
    ├── arca/
    │   ├── _MG_8885.webp
    │   ├── _MG_8888.webp
    │   ├── _MG_8945.webp
    │   └── _MG_8967.webp
    ├── barco/
    │   ├── _MG_8908.webp
    │   └── _MG_8993.webp
    ├── Chillout/
    │   ├── _MG_9344.webp
    │   └── _MG_9346.webp
    ├── rooftop/
    │   ├── _MG_9320.webp
    │   ├── _MG_9326.webp
    │   └── _MG_9337.webp
    └── SalonVIP/
        ├── _MG_8865.webp
        ├── _MG_8866.webp
        ├── _MG_8871.webp
        └── _MG_8880.webp
```

## ⚡ Ventajas del Sistema

- ✅ **Imágenes WebP**: 70-80% menos peso
- ✅ **Sistema Híbrido**: Fácil cambio entre local y remoto
- ✅ **Sin Recargar**: Puedes cambiar las URLs sin recargar la página
- ✅ **Fallback Inteligente**: Si una imagen falla, usa placeholder
- ✅ **Preparado para CDN**: Listo para usar con servicios como Cloudinary, AWS S3, etc.

## 🚀 Pasos para Subir a Hosting

1. **Sube las imágenes WebP** a tu hosting manteniendo la estructura de carpetas
2. **Obtén las URLs** de cada imagen
3. **Actualiza el archivo** `js/instalaciones.js` con las URLs
4. **Cambia** `useExternalURLs` a `true`
5. **Listo!** Las imágenes ahora cargarán desde el hosting

## 💡 Tips de Optimización

- Las imágenes WebP ya están optimizadas (70-80% menos peso)
- Considera usar un CDN para mejor performance global
- Puedes usar servicios como Cloudinary para optimización automática
- El lazy loading ya está implementado para cargar solo imágenes visibles

---

*Sistema actualizado para soportar tanto imágenes locales como URLs externas de forma flexible.*