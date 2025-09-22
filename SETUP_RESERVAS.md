# 📋 Sistema de Reservas Mar&Tierra - Guía de Configuración

## 🚀 Configuración Paso a Paso

### Paso 1: Crear Google Sheet para las Reservas

1. **Acceda a Google Sheets**
   - Vaya a [sheets.google.com](https://sheets.google.com)
   - Inicie sesión con su cuenta de Google

2. **Cree una nueva hoja de cálculo**
   - Haga clic en el botón "+" para crear una hoja nueva
   - Nombre la hoja: "Reservas Mar&Tierra Restaurant"

3. **Copie el ID de la hoja**
   - En la URL verá algo como: `https://docs.google.com/spreadsheets/d/ABC123XYZ/edit`
   - El ID es la parte entre `/d/` y `/edit` (en este ejemplo: `ABC123XYZ`)
   - **GUARDE ESTE ID**, lo necesitará más adelante

### Paso 2: Configurar Google Apps Script

1. **Acceda a Google Apps Script**
   - Vaya a [script.google.com](https://script.google.com)
   - Haga clic en "Nuevo proyecto"

2. **Configure el proyecto**
   - Nombre el proyecto: "Sistema Reservas Mar&Tierra"
   - Elimine todo el código existente

3. **Copie el código del Apps Script**
   - Abra el archivo `google-apps-script.js` de este proyecto
   - Copie TODO el contenido
   - Péguelo en el editor de Google Apps Script

4. **Configure las variables**
   - Busque la línea: `const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';`
   - Reemplace `YOUR_SPREADSHEET_ID_HERE` con el ID que copió en el Paso 1
   - Ejemplo: `const SPREADSHEET_ID = 'ABC123XYZ';`

5. **Configure el email del restaurante (opcional)**
   - Busque: `const RESTAURANT_EMAIL = 'restaurant@example.com';`
   - Reemplace con el email real del restaurante
   - Si no desea notificaciones, déjelo como está

6. **Guarde el proyecto**
   - Presione `Ctrl+S` o haga clic en el icono de guardar

### Paso 3: Publicar como Web App

1. **Haga clic en "Implementar"** (Deploy)
   - En la parte superior derecha, haga clic en "Implementar" > "Nueva implementación"

2. **Configure la implementación**
   - Tipo: Seleccione "Aplicación web" (Web app)
   - Descripción: "Sistema de Reservas v1.0"
   - Ejecutar como: "Yo" (Me)
   - Quién tiene acceso: "Cualquiera" (Anyone)

3. **Autorice el script**
   - Haga clic en "Implementar"
   - Si aparece una advertencia de seguridad:
     - Haga clic en "Revisar permisos"
     - Seleccione su cuenta de Google
     - Haga clic en "Avanzado"
     - Haga clic en "Ir a Sistema Reservas Mar&Tierra (inseguro)"
     - Haga clic en "Permitir"

4. **Copie la URL del Web App**
   - Después de la implementación, verá una URL como:
     ```
     https://script.google.com/macros/s/AKfycbxxx.../exec
     ```
   - **COPIE ESTA URL COMPLETA**

### Paso 4: Configurar el sitio web

1. **Abra el archivo `js/script.js`**

2. **Busque la línea 790:**
   ```javascript
   const GOOGLE_SCRIPT_URL = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';
   ```

3. **Reemplace con su URL:**
   ```javascript
   const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxxx.../exec';
   ```

4. **Guarde el archivo**

### Paso 5: Probar el Sistema

1. **Abra el sitio web** en su navegador

2. **Haga clic en "Reservar Mesa"**

3. **Complete el formulario** con datos de prueba

4. **Envíe la reserva**

5. **Verifique en Google Sheets**
   - Abra su Google Sheet
   - Debería ver una nueva fila con los datos de la reserva

## 📊 Estructura del Google Sheet

El sistema creará automáticamente las siguientes columnas:

| Columna | Descripción |
|---------|-------------|
| ID Reserva | Identificador único |
| Timestamp | Fecha y hora del envío |
| Nombre | Nombre del cliente |
| Teléfono | Teléfono de contacto |
| Email | Correo electrónico |
| Fecha | Fecha de la reserva |
| Hora | Hora de la reserva |
| Personas | Número de comensales |
| Comentarios | Notas especiales |
| Estado | Estado de la reserva |
| Fecha de Registro | Fecha/hora local |

## 🔧 Personalización Opcional

### Activar/Desactivar Emails

En `google-apps-script.js`:

```javascript
// Para desactivar emails de confirmación al cliente:
const SEND_CONFIRMATION_EMAIL = false;

// Para desactivar notificaciones al restaurante:
const SEND_RESTAURANT_NOTIFICATION = false;
```

### Cambiar el nombre de la hoja

```javascript
const SHEET_NAME = 'MiHojaPersonalizada';
```

### Modificar campos del formulario

Los campos están en `index.html` dentro del formulario con ID `reservationForm`

## 🐛 Solución de Problemas

### Error: "Por favor configure la URL de Google Apps Script"
- **Solución**: Asegúrese de haber reemplazado la URL en `script.js` línea 790

### Las reservas no aparecen en Google Sheets
- **Verificar**: 
  - El ID del spreadsheet es correcto
  - El Web App está publicado como "Cualquiera"
  - La URL del Web App es correcta en script.js

### Error de permisos en Google Apps Script
- **Solución**: 
  - Vuelva a autorizar el script
  - Asegúrese de estar usando la cuenta correcta de Google

### El formulario no valida correctamente
- **Verificar**:
  - JavaScript está habilitado en el navegador
  - No hay errores en la consola del navegador (F12)

## 📱 Características del Sistema

✅ **Validaciones automáticas**
- Campos requeridos
- Formato de email
- Formato de teléfono
- Fechas futuras únicamente (mínimo 1 día de anticipación)
- Máximo 3 meses de anticipación

✅ **Experiencia de usuario**
- Modal elegante y responsive
- Animaciones suaves
- Estados de carga
- Mensajes de éxito/error
- Cierre automático después de confirmar

✅ **Notificaciones**
- Email de confirmación al cliente (opcional)
- Email de notificación al restaurante (opcional)
- Registro automático con timestamp

## 🔒 Seguridad

- Los datos se almacenan en su cuenta de Google
- No se requiere base de datos externa
- Acceso controlado mediante permisos de Google
- Sin costos adicionales de hosting

## 📞 Soporte

Si necesita ayuda adicional:

1. Revise esta guía completamente
2. Verifique la consola del navegador para errores (F12)
3. Asegúrese de que todos los IDs y URLs estén correctamente configurados
4. Pruebe con diferentes navegadores

## ✨ Próximos Pasos

Una vez configurado, puede:

1. **Personalizar los horarios** disponibles en el formulario
2. **Agregar más campos** si es necesario
3. **Configurar filtros** en Google Sheets para organizar reservas
4. **Crear gráficos** para analizar tendencias de reservas
5. **Exportar datos** para reportes mensuales

---

**¡El sistema de reservas está listo para usar!** 🎉

Recuerde hacer pruebas completas antes de publicar en producción.