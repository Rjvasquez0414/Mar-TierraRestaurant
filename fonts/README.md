# Instrucciones para las Fuentes Personalizadas

## Fuentes Requeridas:

### 1. **Valerius** (Para el título principal "Mar&Tierra")
- **Dónde obtenerla**:
  - MyFonts: https://www.myfonts.com/fonts/typefolio/valerius/
  - Creative Market o sitios similares de fuentes premium

### 2. **Causten Light** (Para todo el resto del contenido)
- **Dónde obtenerla**:
  - https://www.dafont.com/causten.font
  - https://www.behance.net/gallery/68467605/Causten-Free-Font

## Cómo instalar las fuentes:

1. **Descarga los archivos de fuente** (.ttf, .otf, .woff o .woff2)

2. **Coloca los archivos en esta carpeta** (`/fonts/`):
   - Valerius.ttf (o .woff/.woff2)
   - Causten-Light.ttf
   - Causten-Regular.ttf (opcional)

3. **Convierte a formatos web** (si es necesario):
   - Usa https://transfonter.org/ para convertir a .woff y .woff2
   - Estos formatos son más eficientes para web

4. **Los archivos ya están referenciados** en `css/custom-fonts.css`

## Alternativas Actuales:

Mientras obtienes las fuentes exactas, el sitio está usando:

- **Para Valerius**: Playfair Display (serif elegante similar)
- **Para Causten**: Outfit (sans-serif moderna y limpia muy similar)

Estas alternativas se cargan desde Google Fonts y mantienen un aspecto profesional.

## Estructura de archivos esperada:
```
fonts/
├── Valerius.woff2
├── Valerius.woff
├── Valerius.ttf
├── Causten-Light.woff2
├── Causten-Light.woff
├── Causten-Light.ttf
├── Causten-Regular.woff2
├── Causten-Regular.woff
└── Causten-Regular.ttf
```