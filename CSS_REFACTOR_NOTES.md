# CSS Refactor — Plan por fases

> Documento de deuda técnica y plan de migración del CSS de Mar&Tierra.
> Estado actual: 8 archivos CSS, ~6.800 líneas. Última auditoría: 2026-05-19.

---

## Estado actual de los archivos CSS

| Archivo | Líneas | Rol | Salud |
|---|---|---|---|
| `styles.css` | 3.108 | Base global, hero, menú, navegación, contacto | 🟡 Mejorable (poco modularizado) |
| `reservations.css` *(antes `reservas-fix.css`)* | 1.815 | Tarjetas de reserva, planes decoración, modal detalle, servicios | 🟠 Heredó deuda técnica |
| `instalaciones.css` | 676 | Sección Instalaciones + modal Espacios | 🟡 Bien acotado |
| `enhancements.css` | 477 | Animaciones premium, parallax, glassmorphism | 🟡 Algunas duplicaciones |
| `site-shell.css` ✨ | 358 | Footer, WhatsApp flotante, focus, z-index, reduced-motion | 🟢 Limpio (nuevo) |
| `gallery.css` ✨ | 220 | Galería masonry + lightbox | 🟢 Limpio (nuevo) |
| `modal-premium.css` | 230 | Modal premium efectos | 🟡 Pequeño, fácil de absorber |
| `custom-fonts.css` | 205 | @font-face + tipografía global | 🟠 Demasiados `!important` (35) |
| `testimonials.css` ✨ | 165 | Sección testimonios | 🟢 Limpio (nuevo) |
| `legal.css` ✨ | 160 | Páginas legales | 🟢 Limpio (nuevo) |
| `planes-decoracion.css` | 117 | Posiblemente redundante con reservations.css | 🔴 Auditar |

✨ = nuevo, escrito en 2026-05-19 con sistema de tokens y prácticas modernas.

---

## Cambios ya hechos en este refactor (2026-05-19)

✅ **Renombrado** `reservas-fix.css` → `reservations.css`. El nombre "fix" sugería un archivo de parches; el contenido real son estilos de la sección. El cambio se hizo con `git mv` para preservar historia.

✅ **Bug latente arreglado**: había 2 `@keyframes fadeIn` en el mismo archivo (líneas 282 y 1472). La segunda silenciaba la primera (transform: translateY desaparecía). Renombrada la segunda a `fadeInOpacity` y actualizado el único uso.

✅ **Variables de dorado completas en `:root`**: ahora `--dorado-brillante`, `--dorado-sutil`, `--dorado-premium` y `--dorado-oscuro` están definidas. Los 36 usos de `var(--dorado-premium, #D4AF37)` que tenían fallback hardcoded ahora resuelven la variable real.

✅ **1 ocurrencia 100% hardcoded** (`color: #D4AF37` sin var) en `.service-icon` migrada a `var(--dorado-premium)`.

✅ **Tokens de `z-index` semánticos** introducidos en `site-shell.css`: `--z-header`, `--z-modal`, `--z-wa-float`, etc. (Los `z-index: 99999` legacy siguen funcionando — se migran cuando se toque el archivo.)

✅ **`prefers-reduced-motion` global** en `site-shell.css`.

✅ **`:focus-visible` consistente** con anillo dorado en `site-shell.css`.

---

## Plan por fases (lo que queda)

### Fase A — Quick wins (1–2 horas, sin riesgo visual)

- [ ] **Auditar `planes-decoracion.css` (117 líneas)**: parece redundante con bloques de `reservations.css`. Comparar y eliminar duplicados o absorber.
- [ ] **Migrar usos restantes de `var(--dorado-premium, #D4AF37)` a `var(--dorado-premium)`** (sin fallback). El fallback nunca se usa porque la variable ya existe. Es estético y reduce 36 ocurrencias del hex.
- [ ] **Eliminar `console.log` y comentarios obsoletos** de `enhancements.css` y `instalaciones.css`.
- [ ] **Auditar `!important` en `custom-fonts.css`** (35 ocurrencias). La mayoría son para forzar overrides de un CSS base que no respeta especificidad. Posible solución: cargar `custom-fonts.css` el último (ya se hace) y eliminar los `!important`.

### Fase B — Reorganización lógica (3–5 horas, requiere validar visualmente)

Reestructurar por dominio en vez de por "archivo histórico":

```
css/
├── tokens.css           ← (nuevo) :root vars + escalas (spacing, radius, shadows)
├── base.css             ← reset + body + tipografía global (extraído de styles.css)
├── components/
│   ├── buttons.css      ← .btn-*, .reservation-btn (extraído de varios)
│   ├── cards.css        ← .menu-item, .category-card, .espacio-card, .testimonial-card
│   ├── modals.css       ← .dish-modal, .detail-modal, .reservation-modal (consolidado)
│   ├── forms.css        ← inputs, checkboxes, validación
│   ├── nav.css          ← #header, #nav
│   ├── ornaments.css    ← .ornament, .section-header, .wave-divider
│   └── lightbox.css     ← (movido desde gallery.css si crece)
├── sections/
│   ├── hero.css
│   ├── menu.css
│   ├── instalaciones.css ← ya existe
│   ├── gallery.css      ← ya existe
│   ├── testimonials.css ← ya existe
│   ├── reservations.css ← refactorizado
│   ├── contact.css
│   └── footer.css       ← movido desde site-shell.css
├── utilities.css        ← .sr-only, .hidden, etc.
└── motion.css           ← @keyframes + reduced-motion
```

**Por qué esta estructura:**
- Cada archivo < 300 líneas → fácil de mantener
- Por dominio, no por orden histórico de creación
- Permite cargar sólo lo necesario (futuro: critical CSS)

**Riesgo:** romper especificidad o cascada. Mitigación: hacerlo archivo por archivo, validando visualmente cada extracción.

### Fase C — Modernización CSS (futuro, opcional)

- [ ] **Container queries** para componentes que se adaptan a su contenedor, no a la viewport (ej. `.category-card`).
- [ ] **`:has()` selector** para estados complejos (ej. `.filter-buttons:has(.active)`).
- [ ] **`color-mix()`** para variantes hover/active sin hardcodear segundo color.
- [ ] **Aspect-ratio en CSS** para reemplazar `width`/`height` en imágenes responsive.
- [ ] **`@layer`** para controlar cascada explícitamente: `@layer reset, base, components, sections, utilities, overrides;`.

### Fase D — Eliminación de `!important`

Estado actual: ~86 `!important` totales. Objetivo: < 10 (sólo para utilidades y accesibilidad).

Distribución:
- `custom-fonts.css`: 35 → arreglable cargando este archivo el último (ya se hace) y eliminándolos.
- `reservations.css`: 21 → la mitad son overrides legítimos del modal cuando está activo; la otra mitad probablemente refactorizables.
- `site-shell.css`: 9 → todos en `prefers-reduced-motion` (legítimos) o `.skip-link:focus` (legítimo).
- Otros: 21 distribuidos.

---

## Métricas objetivo (Q3 2026)

| Métrica | Hoy | Meta |
|---|---|---|
| Total líneas CSS | ~6.800 | ~4.500 |
| Archivos > 500 líneas | 3 | 0 |
| `!important` | 86 | < 15 |
| Selectores con > 3 niveles | ~40 | < 10 |
| `z-index` arbitrarios | 30+ | 0 (todo en tokens) |
| Duplicaciones de keyframes | 0 ✅ | 0 |
| Cobertura `prefers-reduced-motion` | global ✅ | global |

---

## Notas para tu yo del futuro (Roberto)

1. **No tengas miedo de borrar.** El archivo `reservations.css` parece intocable porque "podría romper algo". Si tienes tests visuales y git, puedes experimentar tranquilo.
2. **Antes de añadir `!important`, pregúntate qué especificidad mata tu regla.** El 90% de los `!important` se resuelven con un selector ligeramente más específico.
3. **Cuando crees un archivo CSS nuevo, decide si es un componente o una sección.** Sección = parte única del sitio (hero, footer). Componente = reusable (botones, cards). No mezclar.
4. **El sistema de tokens es la única verdad.** Si necesitas un dorado nuevo, añádelo a `:root` en `styles.css`; no hardcodees.
