/**
 * Google Apps Script for Mar&Tierra Restaurant Reservation System
 * 
 * INSTRUCCIONES DE USO:
 * 1. Copie TODO este código
 * 2. Vaya a Google Apps Script (script.google.com)
 * 3. Cree un nuevo proyecto
 * 4. Pegue este código reemplazando todo el contenido
 * 5. Modifique SPREADSHEET_ID con el ID de su Google Sheet
 * 6. Guarde y publique como Web App
 * 7. Copie la URL del Web App y péguela en script.js
 */

// ============================================
// CONFIGURACIÓN - MODIFIQUE ESTOS VALORES
// ============================================

// ID de su Google Sheet (lo encuentra en la URL del sheet)
// Ejemplo: https://docs.google.com/spreadsheets/d/[ESTE_ES_EL_ID]/edit
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';

// Nombre de la hoja donde se guardarán las reservas
const SHEET_NAME = 'Reservas';

// Email del restaurante para notificaciones (opcional)
const RESTAURANT_EMAIL = 'restaurant@example.com';

// Activar/desactivar email de confirmación al cliente
const SEND_CONFIRMATION_EMAIL = true;

// Activar/desactivar notificación al restaurante
const SEND_RESTAURANT_NOTIFICATION = true;

// ============================================
// FUNCIONES PRINCIPALES - NO MODIFICAR
// ============================================

/**
 * Función principal que recibe las peticiones POST
 */
function doPost(e) {
  try {
    // Parse the JSON data from the request
    const data = JSON.parse(e.postData.contents);
    
    // Save to Google Sheet
    const result = saveReservation(data);
    
    // Send emails if configured
    if (SEND_CONFIRMATION_EMAIL && data.email) {
      sendConfirmationEmail(data);
    }
    
    if (SEND_RESTAURANT_NOTIFICATION && RESTAURANT_EMAIL !== 'restaurant@example.com') {
      sendRestaurantNotification(data);
    }
    
    // Return success response
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Reserva guardada exitosamente',
      reservationId: result.reservationId
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    // Return error response
    console.error('Error processing reservation:', error);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Error al procesar la reserva',
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Función GET para verificar que el script está funcionando
 */
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'active',
    message: 'Mar&Tierra Reservation System API is running',
    version: '1.0.0'
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Guarda la reserva en Google Sheets
 */
function saveReservation(data) {
  // Open the spreadsheet
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  
  // If sheet doesn't exist, create it with headers
  if (!sheet) {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const newSheet = spreadsheet.insertSheet(SHEET_NAME);
    
    // Add headers
    const headers = [
      'ID Reserva',
      'Timestamp',
      'Nombre',
      'Teléfono',
      'Email',
      'Fecha',
      'Hora',
      'Personas',
      'Comentarios',
      'Estado',
      'Fecha de Registro'
    ];
    newSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Format headers
    newSheet.getRange(1, 1, 1, headers.length)
      .setBackground('#0056D2')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
    
    // Use the new sheet
    sheet = newSheet;
  }
  
  // Generate reservation ID
  const reservationId = 'RES-' + Date.now();
  
  // Prepare row data
  const rowData = [
    reservationId,
    data.timestamp || new Date().toISOString(),
    data.name,
    data.phone,
    data.email,
    data.date,
    data.time,
    data.people,
    data.comments || '',
    data.status || 'Pendiente',
    new Date().toLocaleString('es-CO', {timeZone: 'America/Bogota'})
  ];
  
  // Append the row
  sheet.appendRow(rowData);
  
  // Auto-resize columns
  sheet.autoResizeColumns(1, rowData.length);
  
  return {
    reservationId: reservationId,
    rowNumber: sheet.getLastRow()
  };
}

/**
 * Envía email de confirmación al cliente
 */
function sendConfirmationEmail(data) {
  try {
    const subject = '✅ Confirmación de Reserva - Mar&Tierra Restaurant';
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0056D2, #3B82F6); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .reservation-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
          .detail-label { font-weight: bold; color: #666; }
          .detail-value { color: #333; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .button { display: inline-block; padding: 12px 30px; background: #0056D2; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>¡Reserva Confirmada!</h1>
            <p>Gracias por elegir Mar&Tierra Restaurant</p>
          </div>
          
          <div class="content">
            <p>Estimado/a <strong>${data.name}</strong>,</p>
            
            <p>Hemos recibido su reserva exitosamente. A continuación los detalles:</p>
            
            <div class="reservation-details">
              <div class="detail-row">
                <span class="detail-label">📅 Fecha:</span>
                <span class="detail-value">${formatDate(data.date)}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">🕐 Hora:</span>
                <span class="detail-value">${data.time}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">👥 Número de Personas:</span>
                <span class="detail-value">${data.people}</span>
              </div>
              ${data.comments && data.comments !== 'Sin comentarios' ? `
              <div class="detail-row">
                <span class="detail-label">📝 Comentarios:</span>
                <span class="detail-value">${data.comments}</span>
              </div>
              ` : ''}
            </div>
            
            <h3>📍 Ubicación</h3>
            <p>
              Cra 35a #46-102<br>
              Barrio Cabecera del Llano<br>
              Bucaramanga, Colombia
            </p>
            
            <h3>📞 Contacto</h3>
            <p>
              Teléfono: 300 826 3403<br>
              Instagram: @marytierrarestaurantbga
            </p>
            
            <p style="margin-top: 30px;">
              <strong>Nota importante:</strong> Si necesita cancelar o modificar su reserva, 
              por favor contáctenos con al menos 2 horas de anticipación.
            </p>
          </div>
          
          <div class="footer">
            <p>Este es un correo automático, por favor no responda a este mensaje.</p>
            <p>© ${new Date().getFullYear()} Mar&Tierra Restaurant - Todos los derechos reservados</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    MailApp.sendEmail({
      to: data.email,
      subject: subject,
      htmlBody: htmlBody
    });
    
  } catch (error) {
    console.error('Error sending confirmation email:', error);
  }
}

/**
 * Envía notificación al restaurante
 */
function sendRestaurantNotification(data) {
  try {
    const subject = `🔔 Nueva Reserva - ${data.name} - ${formatDate(data.date)} ${data.time}`;
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #D4AF37; color: #333; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .detail-row { padding: 10px 0; border-bottom: 1px solid #ddd; }
          .label { font-weight: bold; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>📋 Nueva Reserva Recibida</h2>
          </div>
          
          <div class="content">
            <div class="detail-row">
              <span class="label">Cliente:</span> ${data.name}
            </div>
            <div class="detail-row">
              <span class="label">Teléfono:</span> ${data.phone}
            </div>
            <div class="detail-row">
              <span class="label">Email:</span> ${data.email}
            </div>
            <div class="detail-row">
              <span class="label">Fecha:</span> ${formatDate(data.date)}
            </div>
            <div class="detail-row">
              <span class="label">Hora:</span> ${data.time}
            </div>
            <div class="detail-row">
              <span class="label">Personas:</span> ${data.people}
            </div>
            <div class="detail-row">
              <span class="label">Comentarios:</span> ${data.comments || 'Sin comentarios'}
            </div>
            <div class="detail-row">
              <span class="label">Registrado:</span> ${new Date().toLocaleString('es-CO', {timeZone: 'America/Bogota'})}
            </div>
            
            <p style="margin-top: 20px;">
              <a href="https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}" 
                 style="background: #0056D2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                Ver todas las reservas
              </a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    MailApp.sendEmail({
      to: RESTAURANT_EMAIL,
      subject: subject,
      htmlBody: htmlBody
    });
    
  } catch (error) {
    console.error('Error sending restaurant notification:', error);
  }
}

/**
 * Formatea la fecha para mostrar
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  
  return `${days[date.getDay()]}, ${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
}

/**
 * Función de prueba para verificar la configuración
 */
function testConfiguration() {
  console.log('Testing configuration...');
  console.log('Spreadsheet ID:', SPREADSHEET_ID);
  console.log('Sheet Name:', SHEET_NAME);
  console.log('Restaurant Email:', RESTAURANT_EMAIL);
  
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log('✅ Spreadsheet found:', sheet.getName());
    
    const testData = {
      name: 'Test User',
      phone: '123456789',
      email: 'test@example.com',
      date: '2024-12-25',
      time: '19:00',
      people: '2',
      comments: 'Test reservation'
    };
    
    const result = saveReservation(testData);
    console.log('✅ Test reservation saved:', result);
    
    return 'Configuration test successful!';
  } catch (error) {
    console.error('❌ Configuration test failed:', error);
    return 'Configuration test failed: ' + error.toString();
  }
}