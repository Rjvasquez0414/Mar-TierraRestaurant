# 🎉 NUEVA FUNCIONALIDAD DE RESERVAS - MAR&TIERRA RESTAURANT

## ✅ CAMBIOS IMPLEMENTADOS

### 1. **Nueva Sección de Información de Reservas**
   - Se agregó una sección completa después del hero mostrando todos los tipos de reservas
   - Cards visuales para:
     - Reservas Regulares (hasta 14 personas)
     - Reservas Especiales (15+ personas y Salón Gold)
     - Planes de Decoración (Plata, Oro, Luxury)
     - Servicios Adicionales (Saxofonista, Violinista, Fotógrafo, DJ)
   - Información clara de políticas y métodos de pago

### 2. **Modal de Reservas Actualizado**
   - **Nuevos campos agregados:**
     - Tipo de reserva (Regular/Especial/Salón Gold)
     - Plan de decoración (con múltiples opciones)
     - Servicios adicionales (checkboxes)
     - Cálculo automático del anticipo
     - Resumen de costos en tiempo real

### 3. **Sistema de Cálculo Automático**
   - Calcula anticipo base: $100,000 por persona
   - Suma costos de decoración según plan seleccionado
   - Suma servicios adicionales
   - Muestra total del anticipo requerido

### 4. **Google Apps Script Mejorado (v2)**
   - **Nuevo archivo:** `google-apps-script-v2.js`
   - **Menú personalizado en Google Sheets con opciones:**
     - ✅ Confirmar Pago de Reserva
     - 📧 Enviar Recordatorio de Pago  
     - 📨 Enviar Confirmación Final
     - 📊 Ver Estadísticas
     - 🔍 Buscar Reserva
   - **Nuevas columnas en el Sheet:**
     - Tipo de Reserva
     - Plan de Decoración
     - Servicios Adicionales
     - Anticipo Total
     - Estado de Pago
     - Fecha de Confirmación
     - Contador de Recordatorios

## 📋 INSTRUCCIONES DE CONFIGURACIÓN

### Paso 1: Configurar Google Apps Script
1. Ve a [script.google.com](https://script.google.com)
2. Crea un nuevo proyecto
3. Copia TODO el contenido de `google-apps-script-v2.js`
4. Modifica la línea 20: `const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';`
5. Modifica la línea 26: `const RESTAURANT_EMAIL = 'email@restaurante.com';`
6. Guarda el proyecto
7. Publica como Web App:
   - Ejecutar como: Yo
   - Acceso: Cualquiera
8. Copia la URL generada

### Paso 2: Actualizar la URL en el Frontend
1. Abre `/js/script.js`
2. Busca la línea 790 (aproximadamente)
3. Reemplaza la URL existente con la nueva URL del Web App

### Paso 3: Agregar Información de Pago
1. En `index.html`, busca "[INFORMACIÓN DE PAGO PENDIENTE]"
2. Reemplaza con los datos bancarios reales del restaurante

## 🚀 NUEVAS FUNCIONALIDADES

### Para el Cliente:
- Ve claramente los tipos de reserva disponibles
- Calcula automáticamente el anticipo requerido
- Selecciona decoración y servicios adicionales
- Recibe confirmación clara de que debe pagar para confirmar

### Para el Restaurante (en Google Sheets):
- **Menú "🍽️ Gestión de Reservas"** con todas las opciones
- **Confirmar pagos** con un clic
- **Enviar recordatorios** automáticos
- **Ver estadísticas** de reservas
- **Buscar reservas** específicas
- **Estados con colores:**
  - 🟡 Amarillo: Pendiente de pago
  - 🟢 Verde: Confirmada
  - 🔴 Rojo: Cancelada

## 📧 EMAILS AUTOMÁTICOS

### 1. **Email Inicial** (cuando se hace la reserva)
   - Informa que la reserva fue recibida
   - Muestra el anticipo requerido
   - Incluye información de pago
   - Aclara que debe pagar para confirmar

### 2. **Email de Confirmación de Pago**
   - Se envía cuando el restaurante confirma el pago
   - Confirma definitivamente la reserva
   - Incluye todos los detalles

### 3. **Email Recordatorio**
   - Para clientes que no han pagado
   - Recuerda el monto del anticipo
   - Incluye información de pago

### 4. **Email de Confirmación Final**
   - Con todos los detalles de la reserva
   - Incluye servicios especiales contratados
   - Código de reserva para presentar

## 🎨 DISEÑO IMPLEMENTADO

- Diseño elegante y profesional
- Colores consistentes con la marca
- Cards con efectos hover sutiles
- Totalmente responsive
- Animaciones suaves
- Iconos representativos

## ⚠️ IMPORTANTE - PRÓXIMOS PASOS

1. **Actualizar información de pago real** en el HTML
2. **Configurar el Google Apps Script** con los IDs correctos
3. **Probar el sistema** haciendo una reserva de prueba
4. **Capacitar al personal** sobre el uso del menú en Google Sheets

## 📝 NOTAS ADICIONALES

- El sistema detecta automáticamente cuando un grupo es de 15+ personas
- Los planes de decoración se pueden combinar
- El anticipo se descuenta de la cuenta final
- Las reservas quedan en estado "Pendiente" hasta confirmar el pago
- El personal puede cambiar manualmente los estados desde Google Sheets

## 🔧 ARCHIVOS MODIFICADOS

1. `/index.html` - Nueva sección y modal actualizado
2. `/js/script.js` - Funciones de cálculo y validación
3. `/css/styles.css` - Estilos para nuevas secciones
4. `/google-apps-script-v2.js` - Script mejorado (NUEVO)

---

**Sistema desarrollado y listo para usar** ✨
Cualquier duda o ajuste adicional, estoy disponible para ayudar.