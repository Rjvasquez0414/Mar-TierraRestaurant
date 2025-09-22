# Mar&Tierra Restaurant - Menú Digital

## 🍽️ Descripción

Sistema de menú digital elegante y moderno para Mar&Tierra Restaurant. Completamente organizado con archivos separados para fácil mantenimiento y personalización.

## 📁 Estructura del Proyecto

```
MenuMarYtIERRA/
├── index.html              # Página principal
├── css/
│   └── styles.css          # Todos los estilos CSS
├── js/
│   ├── menu-data.js        # Datos del menú (FÁCIL DE EDITAR)
│   └── script.js           # Lógica de la aplicación
├── images/
│   ├── placeholder.jpg     # Imagen temporal para platos
│   └── placeholder.svg     # Versión SVG del placeholder
└── README.md              # Este archivo
```

## 🎨 Colores de Marca Actualizados

El diseño ahora usa los colores oficiales de la marca:

- **Azul Principal**: #0056D2 (color del logo)
- **Azul Secundario**: #3B82F6
- **Dorado Acento**: #D4AF37
- **Blanco**: #FFFFFF
- **Gris Claro**: #F5F5F5

## ✏️ Cómo Editar el Menú

### Opción 1: Edición Básica (Recomendada)

**Archivo a modificar**: `js/menu-data.js`

1. **Agregar un nuevo plato**:
```javascript
// En la categoría correspondiente, agrega un nuevo objeto:
{
    id: "nombre-del-plato",
    name: "NOMBRE DEL PLATO",
    description: "Descripción del plato aquí",
    price: "$50.000",
    image: "images/mi-nueva-imagen.jpg", // Opcional
    tags: ["nuevo", "popular"], // Opcional
    available: true,
    category: "entradas"
}
```

2. **Editar un plato existente**:
   - Busca el plato por su `name` o `id`
   - Modifica los campos necesarios (name, description, price, etc.)

3. **Cambiar precios**:
   - Busca el plato y modifica el campo `price`
   - Ejemplo: `"price": "$75.000"`

4. **Marcar plato como agotado**:
   - Cambia `"available": false`

5. **Agregar etiquetas**:
   - Modifica el array `tags`: `["nuevo", "popular", "vegano"]`
   - Etiquetas disponibles: `nuevo`, `popular`, `vegano`, `vegetariano`, `sin_gluten`, `picante`

### Opción 2: Usando Funciones JavaScript (Avanzado)

Abre la consola del navegador (F12) y usa estas funciones:

```javascript
// Agregar nuevo plato
addMenuItem("entradas", {
    name: "NUEVO PLATO DELICIOSO",
    description: "Descripción del nuevo plato",
    price: "$45.000",
    tags: ["nuevo"]
});

// Actualizar un plato
updateMenuItem("entradas", "trilogia-amazonica", {
    price: "$55.000",
    description: "Nueva descripción actualizada"
});

// Eliminar un plato
removeMenuItem("entradas", "id-del-plato");
```

## 🖼️ Gestión de Imágenes

### Cambiar el Logo del Preloader

1. **Preparar tu logo**:
   - Formato recomendado: PNG con fondo transparente
   - Tamaño recomendado: 300x300px o mayor
   - Guarda como: `images/logo-sin-fondo.png`

2. **El sistema detectará automáticamente** tu logo y lo mostrará con:
   - ✨ Animación de flotación suave
   - 🔄 Anillos de pulso elegantes  
   - ⚡ Efecto de aparición gradual
   - 💫 Sombra con colores de marca

3. **Si no hay logo**: Se usa automáticamente un SVG elegante como respaldo

### Agregar Imágenes de Platos

1. **Subir la imagen**:
   - Coloca la imagen en la carpeta `images/`
   - Formatos recomendados: JPG, PNG, WebP
   - Tamaño recomendado: 400x300px
   - Ejemplo: `images/salmon-robata.jpg`

2. **Actualizar el menú**:
   - En `js/menu-data.js`, cambia el campo `image`:
   ```javascript
   "image": "images/salmon-robata.jpg"
   ```

3. **Si no tienes imagen**:
   - Usa `"images/placeholder.jpg"` (se mostrará imagen genérica elegante)

### Nombres de Archivo Recomendados

- `trilogia-amazonica.jpg`
- `carpaccio-pulpo.jpg`
- `beef-wellington.jpg`
- `cocktail-mar-tierra.jpg`

## 🏷️ Sistema de Etiquetas

Las etiquetas se muestran como pequeñas badges de colores:

- **nuevo**: Azul - Para platos nuevos
- **popular**: Dorado - Para platos más pedidos
- **vegano**: Verde - Para platos veganos
- **vegetariano**: Verde claro
- **sin_gluten**: Naranja
- **picante**: Rojo

Ejemplo de uso:
```javascript
"tags": ["nuevo", "popular", "sin_gluten"]
```

## 🔍 Funcionalidades Incluidas

✅ **Búsqueda avanzada**: Funciona en todas las categorías del menú  
✅ **Filtros inteligentes**: Por categoría (nuevo, popular, vegano, etc.)  
✅ **Preloader personalizado**: Con tu logo y animación elegante  
✅ **Legibilidad mejorada**: Hero section con overlay y mejor contraste  
✅ **Responsive optimizado**: Se adapta perfectamente a móviles y tablets  
✅ **Imágenes con placeholder**: Sistema elegante para platos sin foto  
✅ **Animaciones suaves**: Transiciones elegantes y profesionales  
✅ **Colores de marca**: Totalmente actualizado con la identidad visual

## 📱 Compatibilidad

- ✅ Todos los navegadores modernos
- ✅ Dispositivos móviles
- ✅ Tablets
- ✅ Computadoras de escritorio

## 🛠️ Personalización Avanzada

### Cambiar Información del Restaurante

Edita en `js/menu-data.js` la sección `window.menuConfig`:

```javascript
restaurant: {
    name: "Mar&Tierra",
    tagline: "Algo Diferente",
    description: "Tu nueva descripción aquí"
},

contact: {
    address: {
        street: "Tu nueva dirección",
        neighborhood: "Tu barrio",
        city: "Tu ciudad"
    },
    phone: "Tu teléfono",
    instagram: "@tu_instagram"
}
```

### Cambiar Horarios

```javascript
hours: [
    { day: "Lunes - Viernes", time: "7:30 AM - 9:30 PM" },
    { day: "Sábado", time: "8:30 AM - 9:00 PM" },
    { day: "Domingo", time: "Cerrado" }
]
```

## 🚀 Despliegue

1. **Servidor local** (para pruebas):
   - Abre `index.html` directamente en el navegador

2. **Servidor web**:
   - Sube todos los archivos al servidor
   - Asegúrate de mantener la estructura de carpetas

## ❓ Preguntas Frecuentes

**P: ¿Cómo cambio un precio?**
R: Edita el archivo `js/menu-data.js`, busca el plato y cambia el campo `"price"`

**P: ¿Puedo agregar más categorías?**
R: Sí, pero requiere modificaciones más avanzadas en los archivos HTML y JS

**P: ¿Las imágenes se cargan automáticamente?**
R: Sí, solo coloca la imagen en `/images/` y actualiza la ruta en menu-data.js

**P: ¿Cómo marco un plato como agotado?**
R: Cambia `"available": false` en el plato correspondiente

## 💡 Consejos

1. **Haz siempre respaldo** antes de editar archivos
2. **Prueba en el navegador** después de cada cambio
3. **Usa imágenes optimizadas** (menos de 1MB cada una)
4. **Mantén descripciones concisas** (máximo 2 líneas)
5. **Actualiza precios regularmente**

## 🆘 Soporte

Si necesitas ayuda adicional:

1. Revisa este README completo
2. Verifica que la estructura de archivos esté intacta
3. Asegúrate de que las imágenes existan en la carpeta correcta
4. Comprueba la consola del navegador (F12) para errores

---

**¡Tu menú digital está listo! 🎉**

*Recuerda: El archivo más importante para editar es `js/menu-data.js` - ahí está toda la información del menú.*