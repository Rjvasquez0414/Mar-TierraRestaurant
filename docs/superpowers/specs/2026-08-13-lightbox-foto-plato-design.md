# Ver la foto del plato en grande — diseño

**Fecha:** 2026-08-13
**Estado:** aprobado, pendiente de implementar

## Problema

Un cliente que abre un plato de la carta no alcanza a ver el plato.

Las fotos de Cloudinary son verticales y grandes — la de Flor de Loto mide 2471×3742 px. El modal de plato las muestra con `object-fit: cover` en cajas mucho más anchas que altas:

| Dónde | Caja | Qué se ve |
|---|---|---|
| Modal, escritorio | 576×880 | recorte vertical, aceptable |
| **Modal, móvil** | **378×252** | **alrededor de un cuarto de la foto** |
| Miniatura, escritorio | 564×451 | recorte fuerte |
| Miniatura, móvil | 338×254 | recorte fuerte |

El caso crítico es el modal en móvil: de una foto que es 1,5 veces más alta que ancha se muestra un recuadro apaisado. El plato queda cortado por arriba y por abajo justo donde está el emplatado.

No falta el modal — ya existe y funciona. Falta poder ver la foto completa y en grande.

## Decisiones tomadas

| Decisión | Elegida | Por qué |
|---|---|---|
| Dónde se abre la foto grande | Tocando la foto **dentro del modal** | No cambia el flujo actual: la tarjeta sigue abriendo el modal. Solo añade un nivel más. Evita partir la tarjeta en dos zonas de toque, que en móvil confunde |
| Navegación en pantalla completa | **Solo el plato abierto** | Cerrar devuelve exactamente al mismo modal. Nada puede desincronizarse. Si más adelante se quiere deslizar entre platos, se añade encima sin rehacer nada |
| Librería | **PhotoSwipe 5**, ya cargado | Lo usa la galería desde `index.html`. Trae pinch para zoom, arrastrar para cerrar y `Escape`. No entra ninguna dependencia nueva |
| Recorte de las miniaturas de la carta | **No se toca** | Decisión explícita de Roberto. Queda registrado como hallazgo, no como tarea |

## Arquitectura

Módulo aislado, mismo patrón que `events` y `hero-cinema`: quitar el `<link>` y el `<script>` de `index.html` revierte todo sin residuos.

**Archivos nuevos**
- `js/dish-lightbox.js`
- `css/dish-lightbox.css`

**Archivo modificado**
- `index.html` — un `<link>`, un `<script>` y el bump de `?v=`

**No se modifica `js/script.js`.** El modal de plato es HTML estático (`index.html:1258`) y `#modalDishImage` persiste entre platos: `openDishModal()` solo le reasigna el `src`. Basta un listener sobre ese `<img>`, sin tocar las 2770 líneas de `script.js`.

### Cómo obtiene las dimensiones

PhotoSwipe necesita el ancho y alto reales de la foto para calcular el zoom. No hay que añadirlos a `menu-data.js` ni pedirlos al servidor: **cuando el modal está abierto la imagen ya está cargada**, así que se leen de `naturalWidth` / `naturalHeight` del propio `<img>`. Cero datos nuevos que mantener sincronizados con la carta.

Si en el momento del toque la imagen todavía no terminó de cargar (`naturalWidth === 0`), se espera su `decode()` antes de abrir.

### Cómo se abre

Con la API programática, no con el modo galería:

```js
new PhotoSwipe({ dataSource: [{ src, width, height, alt }], index: 0 }).init()
```

Una foto, un origen, sin elementos DOM intermedios ni selectores de galería.

### Afordancia

Hoy la foto del modal tiene `cursor: default` — nada indica que se puede tocar. Se añade:

- Escritorio: `cursor: zoom-in`
- Móvil: icono discreto de expandir en la **esquina inferior derecha** de la foto. Arriba a la derecha está el botón de cerrar del modal y a la izquierda caen las etiquetas (`POPULAR`, etc.); la inferior derecha es la única esquina libre

Un `MutationObserver` sobre el atributo `class` de `#dishModal` detecta cuándo se abre y marca el contenedor de la imagen con una clase (`dl-ampliable`) según el plato tenga foto real o no. Esa clase gobierna el cursor y el icono.

### Accesibilidad

La foto pasa a ser un control real: `role="button"`, `tabindex="0"`, `aria-label` de "Ver la foto en grande", y responde a Enter y Espacio además del clic. `Escape` cierra el lightbox (lo trae PhotoSwipe).

## Los dos riesgos reales

### El scroll de fondo

`openDishModal()` bloquea el scroll con `document.body.style.overflow = 'hidden'`. PhotoSwipe gestiona el scroll por su cuenta y **al cerrarse lo restaura**, pisando el bloqueo del modal, que sigue abierto detrás. Resultado: la página de atrás empieza a moverse debajo del modal.

Es el bug clásico de apilar dos capas modales. Mitigación: al cerrar el lightbox, si `#dishModal` conserva la clase `active`, se repone `document.body.style.overflow = 'hidden'`.

### El peso en datos móviles

Las URLs de Cloudinary en `menu-data.js` no llevan transformación:

```
https://res.cloudinary.com/dxvl2i2fy/image/upload/v1768570224/Flor_de_Loto_bfu9oq.jpg
```

Se está sirviendo el original de 2471×3742 px. El lightbox insertará `f_auto,q_auto,w_1600` después de `/upload/` — misma foto, una fracción del peso, diferencia notable en 4G.

La transformación se aplica **solo si la URL es de Cloudinary y aún no trae transformaciones**. Cualquier otra URL se usa tal cual.

## Casos excluidos

- **Platos sin foto.** El modal cae a `images/placeholder.jpg` cuando `item.image` viene vacío. Ahí la foto no se vuelve tocable: ampliar un placeholder no aporta nada.
- **Platos con video.** Usan `openVideoModal()` y no pasan por el modal de plato. No se ven afectados.

## Móvil

- La foto ocupa la pantalla completa.
- Botón de cerrar arriba a la derecha, dentro del alcance del pulgar, respetando el notch con `env(safe-area-inset-*)`.
- Pinch para zoom y arrastrar hacia abajo para cerrar — ambos de PhotoSwipe.

## Criterios de aceptación

Verificables con Playwright a 390×844 (móvil) y 1440×900 (escritorio):

1. Tocar la foto del modal abre la pantalla completa con la foto **sin recorte**.
2. La foto se ve completa: la relación de aspecto mostrada coincide con `naturalWidth / naturalHeight`.
3. Cerrar el lightbox devuelve al modal del mismo plato, todavía abierto.
4. Tras cerrar el lightbox, **la página de fondo sigue bloqueada** (no hace scroll bajo el modal).
5. Un plato sin foto no abre lightbox y no muestra el icono de expandir.
6. La foto es alcanzable con teclado y se abre con Enter.
7. Ningún error **nuevo** en consola en ambos tamaños. El 404 de `get_upcoming_events` es preexistente y esperado hasta que se aplique la migración 017.
8. En móvil, el botón de cerrar queda dentro del área visible, sin quedar bajo el notch.

## Fuera de alcance

- El recorte de las miniaturas de la carta (decisión explícita).
- Deslizar entre platos dentro del lightbox.
- La revisión general de móvil, que va como bloque aparte.

## Bloque siguiente: revisión de móvil

Va **después** de esto y por separado, porque no se puede planificar el arreglo de problemas que todavía no se han encontrado. El orden es:

1. Auditar el sitio completo en celular con capturas reales: inicio, carta, instalaciones, galería, calendario, reservas, contacto.
2. Entregar un listado priorizado de lo encontrado.
3. Roberto decide qué se arregla.

Así no se "mejoran" cosas que están bien como están.

## Hallazgos registrados, sin acción

- Las miniaturas de la carta cargan el original de Cloudinary sin transformación. En una categoría de 8 platos son varios megas en datos móviles. Candidato natural para la auditoría de móvil.
- `#modalDishImage` tiene `loading="lazy"` dentro de un modal oculto, lo que puede retrasar la primera pintura de la foto al abrirlo.
